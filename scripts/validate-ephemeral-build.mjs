import { appendFile, open, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

const requiredSeries = [
  "au99_99",
  "cb_gold_purchases",
  "china_gold_reserves",
  "china_gold_reserves_usd",
  "cn_gold_etf_nav",
  "cn_gold_etf_price",
  "cn_gold_etf_shares",
  "cn_gold_etf_shares_daily",
  "dxy_proxy",
  "gld_holdings",
  "gold_etf_flows",
  "gold_etf_holdings",
  "gold_price",
  "us10y_breakeven",
  "us10y_nominal",
  "us10y_real",
  "usd_cny",
];

const requiredDerived = [
  "china-gold-attribution.json",
  "cn-gold-etf-foundation.json",
  "cn-gold-etf-tracking.json",
  "gold-etf-flows-usd.json",
  "gold-etf-regional.json",
];

export const requiredRuntimeFiles = [
  ...requiredSeries.map((id) => `data/series/${id}.json`),
  ...requiredDerived.map((name) => `data/derived/${name}`),
  "data/latest-cn-etf.json",
  "data/latest-spot.json",
  "data/manifest.json",
];

function fail(message) {
  console.error(`::error::${message}`);
  process.exitCode = 1;
}

async function readJson(relativePath) {
  try {
    return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
  } catch (error) {
    throw new Error(`${relativePath} is missing or invalid JSON: ${error.message}`);
  }
}

async function writeOutputs(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n");
  await appendFile(process.env.GITHUB_OUTPUT, `${lines}\n`, "utf8");
}

async function validateData() {
  const actualSeries = (await readdir(path.join(root, "data", "series")))
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -5))
    .sort();
  const expectedSeries = [...requiredSeries].sort();
  if (JSON.stringify(actualSeries) !== JSON.stringify(expectedSeries)) {
    throw new Error(`Expected exactly ${expectedSeries.length} production series; found ${actualSeries.length}. Missing or unexpected series: ${[
      ...expectedSeries.filter((id) => !actualSeries.includes(id)).map((id) => `missing ${id}`),
      ...actualSeries.filter((id) => !expectedSeries.includes(id)).map((id) => `unexpected ${id}`),
    ].join(", ") || "unknown mismatch"}`);
  }

  const latestDates = [];
  for (const id of requiredSeries) {
    const data = await readJson(`data/series/${id}.json`);
    if (data?.meta?.series !== id) throw new Error(`${id}: meta.series does not match filename`);
    if (!Array.isArray(data.observations) || data.observations.length === 0) throw new Error(`${id}: observations are empty`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.last_observation_date ?? "")) throw new Error(`${id}: last_observation_date is invalid`);
    latestDates.push(data.last_observation_date);
  }

  const actualDerived = (await readdir(path.join(root, "data", "derived")))
    .filter((name) => name.endsWith(".json"))
    .sort();
  const expectedDerived = [...requiredDerived].sort();
  if (JSON.stringify(actualDerived) !== JSON.stringify(expectedDerived)) {
    throw new Error(`Expected exactly ${expectedDerived.length} derived files; found ${actualDerived.length}`);
  }

  for (const name of requiredDerived) {
    const data = await readJson(`data/derived/${name}`);
    const hasRows = Array.isArray(data?.rows) && data.rows.length > 0;
    const hasWindows = Array.isArray(data?.windows) && data.windows.length > 0;
    if (!hasRows && !hasWindows) throw new Error(`${name}: required derived output is empty`);
  }

  const latestSpot = await readJson("data/latest-spot.json");
  if (!(latestSpot?.price_usd > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(latestSpot?.as_of_date ?? "")) {
    throw new Error("latest-spot.json is incomplete");
  }
  const latestCnEtf = await readJson("data/latest-cn-etf.json");
  if (!(latestCnEtf?.price > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(latestCnEtf?.quote_date ?? "")) {
    throw new Error("latest-cn-etf.json is incomplete");
  }

  const manifest = await readJson("data/manifest.json");
  const manifestIds = (Array.isArray(manifest?.series) ? manifest.series : []).map((item) => item?.series).sort();
  if (JSON.stringify(manifestIds) !== JSON.stringify(expectedSeries)) {
    throw new Error(`manifest.json must contain exactly ${expectedSeries.length} production series`);
  }

  latestDates.sort();
  await writeOutputs({
    series_count: requiredSeries.length,
    derived_count: requiredDerived.length,
    latest_date_min: latestDates[0],
    latest_date_max: latestDates.at(-1),
  });
  console.log(`Ephemeral dataset complete: ${requiredSeries.length} series, ${requiredDerived.length} derived files, 2 latest files, and manifest.`);
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
    else if (entry.isSymbolicLink()) {
      const target = await stat(fullPath);
      if (target.isDirectory()) files.push(...await listFiles(fullPath));
      else if (target.isFile()) files.push(fullPath);
    }
  }
  return files;
}

async function listFunctionBundles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const bundles = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.name.endsWith(".func") && (entry.isDirectory() || entry.isSymbolicLink())) {
      bundles.push(fullPath);
    } else if (entry.isDirectory()) {
      bundles.push(...await listFunctionBundles(fullPath));
    }
  }
  return bundles;
}

function projectRelative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

async function fileContains(file, needle) {
  if (!needle.length) return false;
  const handle = await open(file, "r");
  const chunk = Buffer.alloc(64 * 1024);
  let carry = Buffer.alloc(0);
  try {
    while (true) {
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
      if (!bytesRead) return false;
      const combined = Buffer.concat([carry, chunk.subarray(0, bytesRead)]);
      if (combined.includes(needle)) return true;
      carry = combined.subarray(Math.max(0, combined.length - needle.length + 1));
    }
  } finally {
    await handle.close();
  }
}

async function validateTrace() {
  const nextDir = path.join(root, ".next");
  const buildFiles = await listFiles(nextDir);
  const traceFiles = buildFiles.filter((file) => file.endsWith(".nft.json"));
  if (!traceFiles.length) throw new Error("No Next.js output trace files were found");

  const traced = new Set();
  for (const traceFile of traceFiles) {
    const trace = JSON.parse(await readFile(traceFile, "utf8"));
    for (const entry of Array.isArray(trace?.files) ? trace.files : []) {
      const resolved = path.resolve(path.dirname(traceFile), entry);
      const relative = projectRelative(resolved);
      if (!relative.startsWith("../")) traced.add(relative);
    }
  }

  const missing = requiredRuntimeFiles.filter((file) => !traced.has(file));
  if (missing.length) throw new Error(`Required runtime data is absent from Next.js traces: ${missing.join(", ")}`);

  const forbidden = [...traced].filter((file) =>
    file.startsWith("data/raw/")
      || file.includes("/probe-out/")
      || file.startsWith("scripts/probe-out")
      || /(^|\/)\.env(?:\.|$)/.test(file)
  );
  if (forbidden.length) throw new Error(`Forbidden staging or environment files are present in Next.js traces: ${forbidden.join(", ")}`);

  const secret = process.env.EPHEMERAL_SECRET_TO_REJECT;
  if (!secret) throw new Error("EPHEMERAL_SECRET_TO_REJECT is required for build-output secret scanning");
  const needle = Buffer.from(secret);
  for (const file of buildFiles) {
    if (await fileContains(file, needle)) throw new Error("The FRED_API_KEY value was found in the Next.js build output");
  }

  await writeOutputs({ raw_status: "clean" });
  console.log(`Build trace complete: ${requiredRuntimeFiles.length} runtime data files present; raw, probe, environment, and secret checks passed.`);
}

function slashPath(file) {
  return file.split(path.sep).join("/");
}

function isEnvExamplePath(file) {
  return path.posix.basename(slashPath(file)) === ".env.example";
}

function isForbiddenRuntimePath(file) {
  if (isEnvExamplePath(file)) return false;
  return file === "data/raw"
    || file.startsWith("data/raw/")
    || file === "scripts/probe-out"
    || file.startsWith("scripts/probe-out/")
    || file.includes("/probe-out/")
    || /(^|\/)\.env(?:\.|$)/.test(file);
}

function isExplicitExamplePlaceholder(value) {
  const unquoted = value.length >= 2 && value[0] === value.at(-1) && ["'", '"'].includes(value[0])
    ? value.slice(1, -1).trim()
    : value;
  if (!unquoted) return true;
  return /^(?:example|placeholder|changeme|replace[-_]?me|dummy|sample|test)$/i.test(unquoted)
    || /^your(?:[-_][a-z0-9]+)+(?:[-_]here)?$/i.test(unquoted)
    || /^<(?:your|example|placeholder|replace[-_]?me)(?:[-_ ][a-z0-9]+)*>$/i.test(unquoted);
}

async function validateEnvExample(file) {
  const contents = await readFile(file, "utf8");
  for (const [index, line] of contents.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const assignment = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
    if (!assignment) throw new Error(`Unsafe .env.example syntax at line ${index + 1}`);
    if (!isExplicitExamplePlaceholder(assignment[2].trim())) {
      throw new Error(`Unsafe non-placeholder value for ${assignment[1]} in .env.example at line ${index + 1}`);
    }
  }
}

async function readFunctionBundle(bundleDir, rootDir) {
  const configPath = path.join(bundleDir, ".vc-config.json");
  let config;
  try {
    config = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    throw new Error(`${slashPath(path.relative(rootDir, configPath))} is missing or invalid JSON: ${error.message}`);
  }

  const physicalFiles = await listFiles(bundleDir);
  const physicalRuntimePaths = physicalFiles.map((file) => slashPath(path.relative(bundleDir, file)));
  const filePathMap = config?.filePathMap && typeof config.filePathMap === "object" ? config.filePathMap : {};
  const mappedRuntimePaths = Object.values(filePathMap)
    .filter((file) => typeof file === "string")
    .map((file) => slashPath(path.normalize(file)).replace(/^\.\//, ""));
  const runtimePaths = new Set([...physicalRuntimePaths, ...mappedRuntimePaths]);

  const mappedSourceFiles = Object.keys(filePathMap)
    .filter((file) => typeof file === "string")
    .map((file) => path.resolve(rootDir, file))
    .filter((file) => {
      const relative = path.relative(rootDir, file);
      return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
    });

  const envExampleFiles = new Set(physicalFiles.filter((file) => isEnvExamplePath(path.relative(bundleDir, file))));
  for (const [source, target] of Object.entries(filePathMap)) {
    if (typeof source !== "string" || typeof target !== "string" || !isEnvExamplePath(target)) continue;
    const resolved = path.resolve(rootDir, source);
    const relative = path.relative(rootDir, resolved);
    if (relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)) envExampleFiles.add(resolved);
  }

  return { physicalFiles, mappedSourceFiles, runtimePaths, envExampleFiles };
}

async function dataTraceEntrypoints(rootDir) {
  const nextDir = path.join(rootDir, ".next");
  let buildFiles;
  try {
    buildFiles = await listFiles(nextDir);
  } catch (error) {
    if (error?.code === "ENOENT") return new Set();
    throw error;
  }

  const entrypoints = new Set();
  for (const traceFile of buildFiles.filter((file) => file.endsWith(".nft.json"))) {
    const trace = JSON.parse(await readFile(traceFile, "utf8"));
    const tracedRuntimePaths = new Set((Array.isArray(trace?.files) ? trace.files : []).map((file) =>
      slashPath(path.relative(rootDir, path.resolve(path.dirname(traceFile), file)))
    ));
    if (requiredRuntimeFiles.some((file) => tracedRuntimePaths.has(file))) {
      entrypoints.add(slashPath(path.relative(rootDir, traceFile.slice(0, -".nft.json".length))));
    }
  }
  return entrypoints;
}

export async function validateVercelOutput({
  rootDir = root,
  secret = process.env.EPHEMERAL_SECRET_TO_REJECT,
  emitOutputs = rootDir === root,
} = {}) {
  const outputDir = path.join(rootDir, ".vercel", "output");
  const outputFiles = await listFiles(outputDir);
  const relativeFiles = outputFiles.map((file) => slashPath(path.relative(rootDir, file)));
  if (!relativeFiles.includes(".vercel/output/config.json")) {
    throw new Error("Vercel Build Output API config.json is missing");
  }

  const functionsDir = path.join(outputDir, "functions");
  const bundleDirs = await listFunctionBundles(functionsDir);
  if (!bundleDirs.length) throw new Error("No Vercel Server Function bundles were found");

  const tracedDataEntrypoints = await dataTraceEntrypoints(rootDir);
  const mappedDataEntrypoints = new Set();
  const dataBundles = [];
  const scanFiles = new Set(outputFiles);
  const envExampleFiles = new Set(outputFiles.filter((file) => isEnvExamplePath(path.relative(outputDir, file))));
  for (const bundleDir of bundleDirs) {
    const bundle = await readFunctionBundle(bundleDir, rootDir);
    const bundleName = slashPath(path.relative(functionsDir, bundleDir));
    const forbidden = [...bundle.runtimePaths].filter(isForbiddenRuntimePath);
    if (forbidden.length) {
      throw new Error(`Forbidden staging or environment files are present in Vercel function ${bundleName}: ${forbidden.join(", ")}`);
    }
    for (const file of bundle.mappedSourceFiles) scanFiles.add(file);
    for (const file of bundle.envExampleFiles) envExampleFiles.add(file);

    const bundleDataEntrypoints = [...tracedDataEntrypoints].filter((file) => bundle.runtimePaths.has(file));
    for (const entrypoint of bundleDataEntrypoints) mappedDataEntrypoints.add(entrypoint);
    const hasRuntimeData = requiredRuntimeFiles.some((file) => bundle.runtimePaths.has(file));
    if (!hasRuntimeData && !bundleDataEntrypoints.length) continue;

    const missing = requiredRuntimeFiles.filter((file) => !bundle.runtimePaths.has(file));
    if (missing.length) {
      throw new Error(`Vercel function ${bundleName} is missing required runtime data: ${missing.join(", ")}`);
    }
    dataBundles.push(bundleName);
  }
  if (!dataBundles.length) {
    throw new Error("Required runtime data is absent from every Vercel Server Function bundle");
  }
  const unmappedEntrypoints = [...tracedDataEntrypoints].filter((file) => !mappedDataEntrypoints.has(file));
  if (unmappedEntrypoints.length) {
    throw new Error(`Next.js data-dependent entrypoints are absent from Vercel Server Function bundles: ${unmappedEntrypoints.join(", ")}`);
  }

  const forbidden = relativeFiles.filter((file) =>
    isForbiddenRuntimePath(file.replace(/^\.vercel\/output\/functions\/[^/]+\.func\//, ""))
  );
  if (forbidden.length) throw new Error(`Forbidden staging or environment files are present in .vercel/output: ${forbidden.join(", ")}`);

  for (const file of envExampleFiles) await validateEnvExample(file);

  if (!secret) throw new Error("EPHEMERAL_SECRET_TO_REJECT is required for Vercel output secret scanning");
  const needle = Buffer.from(secret);
  for (const file of scanFiles) {
    if (await fileContains(file, needle)) throw new Error("The FRED_API_KEY value was found in .vercel/output");
  }

  if (emitOutputs) await writeOutputs({
    output_status: "clean",
    function_bundle_count: bundleDirs.length,
    data_bundle_count: dataBundles.length,
    runtime_file_count: requiredRuntimeFiles.length,
  });
  console.log(`Vercel output complete: ${dataBundles.length} data-dependent function bundle(s), each with ${requiredRuntimeFiles.length} runtime data files; raw, probe, environment, and secret checks passed.`);
  return { bundleCount: bundleDirs.length, dataBundleCount: dataBundles.length, dataBundles };
}

const mode = process.argv[2];
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (mode === "data") await validateData();
    else if (mode === "trace") await validateTrace();
    else if (mode === "vercel-output") await validateVercelOutput();
    else throw new Error("Usage: node scripts/validate-ephemeral-build.mjs <data|trace|vercel-output>");
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
