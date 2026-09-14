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

async function createFixture({ mapped = false, auxiliarySource = false } = {}) {
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
  if (auxiliarySource && !mapped) {
    const { auxiliaryRuntimeFiles } = await loadValidator();
    for (const runtimeFile of auxiliaryRuntimeFiles) await writeJson(path.join(rootDir, runtimeFile), {});
  }
  await writeFile(path.join(bundleDir, ".vc-config.json"), JSON.stringify({
    runtime: "nodejs22.x",
    handler: "index.js",
    filePathMap,
  }));
  await writeFile(path.join(bundleDir, "index.js"), "module.exports = {};");
  return { rootDir, bundleDir, requiredRuntimeFiles };
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value));
}

async function createDatasetFixture({ quarterlySeries = true, dailySeries = true, auxiliaryDerived = true } = {}) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "dataset-validator-"));
  const validator = await loadValidator();
  const observationDate = "2026-09-01";
  for (const id of validator.coreRequiredSeries) {
    await writeJson(path.join(rootDir, "data", "series", `${id}.json`), {
      meta: { series: id },
      observations: [{ series: id, observation_date: observationDate, value: 1 }],
      last_observation_date: observationDate,
    });
  }
  if (quarterlySeries) {
    await writeJson(path.join(rootDir, "data", "series", "cn_gold_etf_shares.json"), {
      meta: { series: "cn_gold_etf_shares", unit: "hundred_million_shares", frequency: "quarterly" },
      observations: [{ series: "cn_gold_etf_shares", observation_date: observationDate, value: 12.3456 }],
      last_observation_date: observationDate,
      all_real: true,
    });
  }
  if (dailySeries) {
    await writeJson(path.join(rootDir, "data", "series", "cn_gold_etf_shares_daily.json"), {
      meta: { series: "cn_gold_etf_shares_daily", unit: "hundred_million_shares", frequency: "daily" },
      observations: [{ series: "cn_gold_etf_shares_daily", observation_date: observationDate, value: 12.3456, security_code: "518880", raw_unit: "万份", raw_value: 123456 }],
      last_observation_date: observationDate,
      all_real: true,
    });
  }
  for (const name of validator.coreRequiredDerived) {
    await writeJson(path.join(rootDir, "data", "derived", name), { windows: [{}] });
  }
  if (auxiliaryDerived) {
    await writeJson(path.join(rootDir, "data", "derived", "cn-gold-etf-foundation.json"), {
      etf_code: "518880",
      units: { price: "cny_per_share", nav: "cny_per_share", shares: "hundred_million_shares", estimated_aum: "cny" },
      rows: [{ date: observationDate, price: 10, nav: 10, sharesHundredMillion: 12, premiumDiscountPct: 0, estimatedAumCny: 12000000000, marketEffectCny: null, shareEffectCny: null, aumChangeCny: null, decompositionResidualCny: null, alignmentStatus: "same_date" }],
    });
  }
  const manifestIds = [
    ...validator.coreRequiredSeries,
    ...(quarterlySeries ? ["cn_gold_etf_shares"] : []),
    ...(dailySeries ? ["cn_gold_etf_shares_daily"] : []),
  ];
  await writeJson(path.join(rootDir, "data", "manifest.json"), { series: manifestIds.map((series) => ({ series })) });
  await writeJson(path.join(rootDir, "data", "latest-spot.json"), { price_usd: 2500, as_of_date: observationDate });
  await writeJson(path.join(rootDir, "data", "latest-cn-etf.json"), { price: 10, quote_date: observationDate });
  return { rootDir, validator };
}

async function withDataset(options, callback) {
  const fixture = await createDatasetFixture(options);
  try {
    await callback(fixture);
  } finally {
    await rm(fixture.rootDir, { recursive: true, force: true });
  }
}

test("accepts 15 core series and all auxiliary artifacts as complete", async () => {
  await withDataset({}, async ({ rootDir, validator }) => {
    const result = await validator.validateData({ rootDir, emitOutputs: false, now: new Date("2026-09-14T00:00:00Z") });
    assert.equal(result.dataset_status, "complete");
    assert.equal(result.core_series_count, 15);
    assert.equal(result.aux_series_count, 2);
    assert.equal(result.core_derived_count, 4);
    assert.equal(result.aux_derived_count, 1);
  });
});

test("accepts 15 core-only series and derived data as degraded", async () => {
  await withDataset({ quarterlySeries: false, dailySeries: false, auxiliaryDerived: false }, async ({ rootDir, validator }) => {
    const result = await validator.validateData({ rootDir, emitOutputs: false });
    assert.equal(result.dataset_status, "degraded");
    assert.equal(result.series_count, 15);
    assert.equal(result.derived_count, 4);
  });
});

test("accepts daily shares when quarterly shares are absent as degraded", async () => {
  await withDataset({ quarterlySeries: false }, async ({ rootDir, validator }) => {
    const result = await validator.validateData({ rootDir, emitOutputs: false });
    assert.equal(result.dataset_status, "degraded");
    assert.equal(result.quarterly_shares_status, "unavailable");
    assert.equal(result.daily_shares_status, "available");
  });
});

test("accepts quarterly shares when daily shares are absent as degraded", async () => {
  await withDataset({ dailySeries: false }, async ({ rootDir, validator }) => {
    const result = await validator.validateData({ rootDir, emitOutputs: false });
    assert.equal(result.dataset_status, "degraded");
    assert.equal(result.quarterly_shares_status, "available");
    assert.equal(result.daily_shares_status, "unavailable");
  });
});

test("rejects a missing core series", async () => {
  await withDataset({}, async ({ rootDir, validator }) => {
    await rm(path.join(rootDir, "data", "series", "gold_price.json"));
    await assert.rejects(validator.validateData({ rootDir, emitOutputs: false }), /missing gold_price/);
  });
});

test("rejects an unknown series", async () => {
  await withDataset({}, async ({ rootDir, validator }) => {
    await writeJson(path.join(rootDir, "data", "series", "unknown.json"), {});
    await assert.rejects(validator.validateData({ rootDir, emitOutputs: false }), /unexpected unknown/);
  });
});

test("rejects malformed auxiliary daily shares", async () => {
  await withDataset({}, async ({ rootDir, validator }) => {
    const file = path.join(rootDir, "data", "series", "cn_gold_etf_shares_daily.json");
    const data = JSON.parse(await readFile(file, "utf8"));
    data.observations[0].raw_unit = "shares";
    await writeJson(file, data);
    await assert.rejects(validator.validateData({ rootDir, emitOutputs: false }), /lacks SSE raw lineage/);
  });
});

test("rejects malformed auxiliary quarterly shares", async () => {
  await withDataset({}, async ({ rootDir, validator }) => {
    const file = path.join(rootDir, "data", "series", "cn_gold_etf_shares.json");
    const data = JSON.parse(await readFile(file, "utf8"));
    data.observations[0].value = 0;
    await writeJson(file, data);
    await assert.rejects(validator.validateData({ rootDir, emitOutputs: false }), /must be finite and positive/);
  });
});

test("rejects a manifest missing a core series", async () => {
  await withDataset({ quarterlySeries: false, dailySeries: false, auxiliaryDerived: false }, async ({ rootDir, validator }) => {
    const file = path.join(rootDir, "data", "manifest.json");
    const data = JSON.parse(await readFile(file, "utf8"));
    data.series = data.series.filter((item) => item.series !== "us10y_real");
    await writeJson(file, data);
    await assert.rejects(validator.validateData({ rootDir, emitOutputs: false }), /missing us10y_real/);
  });
});

test("rejects a missing core derived file", async () => {
  await withDataset({}, async ({ rootDir, validator }) => {
    await rm(path.join(rootDir, "data", "derived", "china-gold-attribution.json"));
    await assert.rejects(validator.validateData({ rootDir, emitOutputs: false }), /missing china-gold-attribution\.json/);
  });
});

test("rejects malformed auxiliary foundation", async () => {
  await withDataset({}, async ({ rootDir, validator }) => {
    const file = path.join(rootDir, "data", "derived", "cn-gold-etf-foundation.json");
    await writeJson(file, { etf_code: "not-518880", rows: [{}] });
    await assert.rejects(validator.validateData({ rootDir, emitOutputs: false }), /etf_code must be 518880/);
  });
});

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

test("accepts traces and Vercel output without absent auxiliary runtime files", async () => {
  await withFixture({}, async ({ rootDir, bundleDir }) => {
    const { validateVercelOutput, auxiliaryRuntimeFiles } = await loadValidator();
    for (const file of auxiliaryRuntimeFiles) await rm(path.join(bundleDir, file));
    const result = await validateVercelOutput({ rootDir, secret, emitOutputs: false });
    assert.equal(result.runtimeFileCount, 22);
  });
});

test("rejects Vercel output when present auxiliary runtime data is not bundled", async () => {
  await withFixture({ auxiliarySource: true }, async ({ rootDir, bundleDir }) => {
    const { validateVercelOutput, auxiliaryRuntimeFiles } = await loadValidator();
    for (const file of auxiliaryRuntimeFiles) await rm(path.join(bundleDir, file));
    await assert.rejects(
      validateVercelOutput({ rootDir, secret, emitOutputs: false }),
      /cn_gold_etf_shares\.json/,
    );
  });
});

async function createTraceFixture({ auxiliarySource = false, traceAuxiliary = false } = {}) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "trace-validator-"));
  const { coreRuntimeFiles, auxiliaryRuntimeFiles } = await loadValidator();
  if (auxiliarySource) {
    for (const file of auxiliaryRuntimeFiles) await writeJson(path.join(rootDir, file), {});
  }
  const entrypoint = path.join(rootDir, ".next", "server", "app", "page.js");
  await mkdir(path.dirname(entrypoint), { recursive: true });
  await writeFile(entrypoint, "module.exports = {};");
  const traced = [...coreRuntimeFiles, ...(traceAuxiliary ? auxiliaryRuntimeFiles : [])];
  await writeFile(`${entrypoint}.nft.json`, JSON.stringify({
    version: 1,
    files: traced.map((file) => path.relative(path.dirname(entrypoint), path.join(rootDir, file))),
  }));
  return { rootDir };
}

test("accepts Next.js traces when auxiliary source files are absent", async () => {
  const fixture = await createTraceFixture();
  try {
    const { validateTrace } = await loadValidator();
    const result = await validateTrace({ rootDir: fixture.rootDir, secret, emitOutputs: false });
    assert.equal(result.runtimeFileCount, 22);
  } finally {
    await rm(fixture.rootDir, { recursive: true, force: true });
  }
});

test("rejects Next.js traces when present auxiliary files are not traced", async () => {
  const fixture = await createTraceFixture({ auxiliarySource: true, traceAuxiliary: false });
  try {
    const { validateTrace } = await loadValidator();
    await assert.rejects(validateTrace({ rootDir: fixture.rootDir, secret, emitOutputs: false }), /cn_gold_etf_shares\.json/);
  } finally {
    await rm(fixture.rootDir, { recursive: true, force: true });
  }
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
