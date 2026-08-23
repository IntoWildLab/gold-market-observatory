import { appendFile, open, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

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

const requiredRuntimeFiles = [
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

async function validateVercelOutput() {
  const outputDir = path.join(root, ".vercel", "output");
  const outputFiles = await listFiles(outputDir);
  const relativeFiles = outputFiles.map(projectRelative);
  if (!relativeFiles.includes(".vercel/output/config.json")) {
    throw new Error("Vercel Build Output API config.json is missing");
  }

  const missing = requiredRuntimeFiles.filter((required) =>
    !relativeFiles.some((file) => file === required || file.endsWith(`/${required}`))
  );
  if (missing.length) throw new Error(`Required runtime data is absent from .vercel/output: ${missing.join(", ")}`);

  const forbidden = relativeFiles.filter((file) =>
    file.includes("/data/raw/")
      || file.includes("/probe-out/")
      || /(^|\/)\.env(?:\.|$)/.test(file)
  );
  if (forbidden.length) throw new Error(`Forbidden staging or environment files are present in .vercel/output: ${forbidden.join(", ")}`);

  const secret = process.env.EPHEMERAL_SECRET_TO_REJECT;
  if (!secret) throw new Error("EPHEMERAL_SECRET_TO_REJECT is required for Vercel output secret scanning");
  const needle = Buffer.from(secret);
  for (const file of outputFiles) {
    if (await fileContains(file, needle)) throw new Error("The FRED_API_KEY value was found in .vercel/output");
  }

  await writeOutputs({ output_status: "clean" });
  console.log(`Vercel output complete: ${requiredRuntimeFiles.length} runtime data files present; raw, probe, environment, and secret checks passed.`);
}

const mode = process.argv[2];
try {
  if (mode === "data") await validateData();
  else if (mode === "trace") await validateTrace();
  else if (mode === "vercel-output") await validateVercelOutput();
  else throw new Error("Usage: node scripts/validate-ephemeral-build.mjs <data|trace|vercel-output>");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
