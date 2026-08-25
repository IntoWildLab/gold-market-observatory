const assert = require("node:assert/strict");
const { mkdtemp, mkdir, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const validatorUrl = pathToFileURL(path.resolve(__dirname, "../scripts/validate-ephemeral-build.mjs")).href;
const secret = "test-secret-value-that-must-not-ship";

async function loadValidator() {
  return import(validatorUrl);
}

async function createFixture({ mapped = false } = {}) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "vercel-output-validator-"));
  const bundleDir = path.join(rootDir, ".vercel", "output", "functions", "page.func");
  await mkdir(bundleDir, { recursive: true });
  await writeFile(path.join(rootDir, ".vercel", "output", "config.json"), '{"version":3}');

  const { requiredRuntimeFiles } = await loadValidator();
  const filePathMap = {};
  for (const runtimeFile of requiredRuntimeFiles) {
    if (mapped) {
      const source = path.join(rootDir, runtimeFile);
      await mkdir(path.dirname(source), { recursive: true });
      await writeFile(source, "{}");
      filePathMap[runtimeFile] = runtimeFile;
    } else {
      const target = path.join(bundleDir, runtimeFile);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, "{}");
    }
  }
  await writeFile(path.join(bundleDir, ".vc-config.json"), JSON.stringify({
    runtime: "nodejs22.x",
    handler: "index.js",
    filePathMap,
  }));
  await writeFile(path.join(bundleDir, "index.js"), "module.exports = {};");
  return { rootDir, bundleDir, requiredRuntimeFiles };
}

async function withFixture(options, callback) {
  const fixture = await createFixture(options);
  try {
    await callback(fixture);
  } finally {
    await rm(fixture.rootDir, { recursive: true, force: true });
  }
}

test("accepts complete runtime data under a .func/data tree", async () => {
  await withFixture({}, async ({ rootDir }) => {
    const { validateVercelOutput } = await loadValidator();
    const result = await validateVercelOutput({ rootDir, secret, emitOutputs: false });
    assert.equal(result.dataBundleCount, 1);
  });
});

test("accepts exact runtime destinations declared by filePathMap", async () => {
  await withFixture({ mapped: true }, async ({ rootDir }) => {
    const { validateVercelOutput } = await loadValidator();
    const result = await validateVercelOutput({ rootDir, secret, emitOutputs: false });
    assert.equal(result.dataBundleCount, 1);
  });
});

test("does not accept a same-name file in an unrelated directory", async () => {
  await withFixture({}, async ({ rootDir, bundleDir }) => {
    const { validateVercelOutput } = await loadValidator();
    await rm(path.join(bundleDir, "data", "series", "gold_price.json"));
    await mkdir(path.join(bundleDir, "unrelated"), { recursive: true });
    await writeFile(path.join(bundleDir, "unrelated", "gold_price.json"), "{}");
    await assert.rejects(
      validateVercelOutput({ rootDir, secret, emitOutputs: false }),
      /missing required runtime data: data\/series\/gold_price\.json/,
    );
  });
});

test("fails when one required series is missing", async () => {
  await withFixture({}, async ({ rootDir, bundleDir }) => {
    const { validateVercelOutput } = await loadValidator();
    await rm(path.join(bundleDir, "data", "series", "usd_cny.json"));
    await assert.rejects(
      validateVercelOutput({ rootDir, secret, emitOutputs: false }),
      /data\/series\/usd_cny\.json/,
    );
  });
});

test("fails when one required derived file is missing", async () => {
  await withFixture({}, async ({ rootDir, bundleDir }) => {
    const { validateVercelOutput } = await loadValidator();
    await rm(path.join(bundleDir, "data", "derived", "cn-gold-etf-tracking.json"));
    await assert.rejects(
      validateVercelOutput({ rootDir, secret, emitOutputs: false }),
      /data\/derived\/cn-gold-etf-tracking\.json/,
    );
  });
});

test("fails when raw staging is present", async () => {
  await withFixture({}, async ({ rootDir, bundleDir }) => {
    const { validateVercelOutput } = await loadValidator();
    await mkdir(path.join(bundleDir, "data", "raw"), { recursive: true });
    await writeFile(path.join(bundleDir, "data", "raw", "source.json"), "{}");
    await assert.rejects(validateVercelOutput({ rootDir, secret, emitOutputs: false }), /Forbidden staging/);
  });
});

test("allows a safe mapped .env.example with empty values and explicit placeholders", async () => {
  await withFixture({}, async ({ rootDir, bundleDir }) => {
    const { validateVercelOutput } = await loadValidator();
    await writeFile(path.join(rootDir, ".env.example"), [
      "# Safe configuration template",
      "FRED_API_KEY=",
      "OPTIONAL_TOKEN=<your-token-here>",
      "SAMPLE_PASSWORD=replace_me",
      "",
    ].join("\n"));
    const configPath = path.join(bundleDir, ".vc-config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    config.filePathMap[".env.example"] = ".env.example";
    await writeFile(configPath, JSON.stringify(config));
    const result = await validateVercelOutput({ rootDir, secret, emitOutputs: false });
    assert.equal(result.dataBundleCount, 1);
  });
});

test("fails when .env.example contains a non-placeholder secret-like value", async () => {
  await withFixture({}, async ({ rootDir, bundleDir }) => {
    const { validateVercelOutput } = await loadValidator();
    await writeFile(path.join(bundleDir, ".env.example"), "API_KEY=nonplaceholdervalue1234567890abcdef");
    await assert.rejects(
      validateVercelOutput({ rootDir, secret, emitOutputs: false }),
      /Unsafe non-placeholder value for API_KEY/,
    );
  });
});

for (const environmentFile of [
  ".env",
  ".env.local",
  ".env.production",
  ".env.preview.local",
  ".env.example.local",
  ".env.production.example",
]) {
  test(`fails when ${environmentFile} is present`, async () => {
    await withFixture({}, async ({ rootDir, bundleDir }) => {
      const { validateVercelOutput } = await loadValidator();
      await writeFile(path.join(bundleDir, environmentFile), "SAFE_NAME=value");
      await assert.rejects(validateVercelOutput({ rootDir, secret, emitOutputs: false }), /environment files/);
    });
  });
}

test("fails when the rejected secret value is present", async () => {
  await withFixture({}, async ({ rootDir, bundleDir }) => {
    const { validateVercelOutput } = await loadValidator();
    await writeFile(path.join(bundleDir, "payload.txt"), `prefix-${secret}-suffix`);
    await assert.rejects(validateVercelOutput({ rootDir, secret, emitOutputs: false }), /FRED_API_KEY value/);
  });
});

test("fails when a traced data-dependent function loses every runtime data file", async () => {
  await withFixture({}, async ({ rootDir, bundleDir, requiredRuntimeFiles }) => {
    const { validateVercelOutput } = await loadValidator();
    await rm(path.join(bundleDir, "data"), { recursive: true });
    const entrypoint = path.join(rootDir, ".next", "server", "app", "page.js");
    await mkdir(path.dirname(entrypoint), { recursive: true });
    await writeFile(entrypoint, "module.exports = {};");
    await writeFile(`${entrypoint}.nft.json`, JSON.stringify({
      version: 1,
      files: requiredRuntimeFiles.map((file) => path.relative(path.dirname(entrypoint), path.join(rootDir, file))),
    }));
    const bundledEntrypoint = path.join(bundleDir, ".next", "server", "app", "page.js");
    await mkdir(path.dirname(bundledEntrypoint), { recursive: true });
    await writeFile(bundledEntrypoint, "module.exports = {};");
    await assert.rejects(
      validateVercelOutput({ rootDir, secret, emitOutputs: false }),
      /missing required runtime data/,
    );
  });
});
