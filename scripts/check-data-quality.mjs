import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateSeriesData } from "./data-quality-lib.mjs";

const root = process.cwd();
const seriesDir = path.join(root, "data", "series");

const required = [
  "gold_price",
  "au99_99",
  "usd_cny",
  "cn_gold_etf_price",
  "cn_gold_etf_nav",
  "cn_gold_etf_shares_daily",
  "dxy_proxy",
  "us10y_real",
  "us10y_nominal",
  "us10y_breakeven",
  "gold_etf_holdings",
  "gold_etf_flows",
  "gld_holdings",
  "cb_gold_purchases",
  "china_gold_reserves",
  "china_gold_reserves_usd",
  "cn_gold_etf_shares",
];

// Calendar-day tolerances intentionally include weekends, market holidays and
// normal publication lag. Crossing warnDays is informative; maxDays is fatal.
const freshness = {
  daily: { warnDays: 7, maxDays: 14 },
  weekly: { warnDays: 14, maxDays: 28 },
  monthly: { warnDays: 45, maxDays: 75 },
  quarterly: { warnDays: 150, maxDays: 220 },
};
// 上交所 ETF 规模公开查询当前存在约两周批量发布延迟；仍按 daily
// 校验，只在同一 freshness gate 中放宽硬失败阈值，不伪装成周频。
const freshnessOverrides = {
  cn_gold_etf_shares_daily: { warnDays: 10, maxDays: 21 },
};

const now = new Date();
const errors = [];
const warnings = [];
const rows = [];

function ageInDays(dateText) {
  const date = new Date(`${dateText}T00:00:00Z`);
  return Number.isFinite(date.getTime()) ? Math.floor((now.getTime() - date.getTime()) / 86_400_000) : null;
}

function warn(message) {
  warnings.push(message);
  console.warn(`::warning::${message}`);
}

function fail(message) {
  errors.push(message);
  console.error(`::error::${message}`);
}

for (const id of required) {
  let data;
  try {
    data = JSON.parse(await readFile(path.join(seriesDir, `${id}.json`), "utf8"));
  } catch {
    fail(`${id}: required series file is missing or invalid JSON`);
    continue;
  }

  const observations = Array.isArray(data.observations) ? data.observations : [];
  const frequency = data?.meta?.frequency;
  if (!freshness[frequency]) fail(`${id}: unsupported or missing frequency`);
  if (data?.meta?.series !== id) fail(`${id}: meta.series does not match its filename`);
  if (observations.length === 0) fail(`${id}: observations are empty`);
  if (data.all_real !== true || observations.some((item) => item?.is_mock === true)) {
    fail(`${id}: mock or non-real observations are not allowed in the production snapshot`);
  }

  let previousDate = "";
  const seenDates = new Set();
  for (const [index, item] of observations.entries()) {
    if (item?.series !== id) fail(`${id}: observation ${index} has the wrong series id`);
    if (typeof item?.value !== "number" || !Number.isFinite(item.value)) fail(`${id}: observation ${index} has a non-finite value`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item?.observation_date ?? "")) fail(`${id}: observation ${index} has an invalid date`);
    if (item.observation_date < previousDate) fail(`${id}: observations are not sorted by date`);
    if (seenDates.has(item.observation_date)) fail(`${id}: duplicate observation date ${item.observation_date}`);
    seenDates.add(item.observation_date);
    previousDate = item.observation_date;
  }
  const contract = validateSeriesData(id, data, now);
  for (const message of contract.errors) fail(message);
  for (const message of contract.warnings) warn(message);

  const latestDate = observations.at(-1)?.observation_date ?? null;
  if (data.last_observation_date !== latestDate) fail(`${id}: last_observation_date does not match the final observation`);

  const age = latestDate ? ageInDays(latestDate) : null;
  const limits = freshnessOverrides[id] ?? freshness[frequency];
  if (age === null) {
    fail(`${id}: latest observation date cannot be evaluated`);
  } else if (age < -2) {
    fail(`${id}: latest observation is unexpectedly in the future`);
  } else if (limits && age > limits.maxDays) {
    fail(`${id}: ${frequency} observation is ${age} days old (maximum ${limits.maxDays})`);
  } else if (limits && age > limits.warnDays) {
    warn(`${id}: ${frequency} observation is ${age} days old; retained as a warning within tolerance`);
  }

  const fetchedAt = new Date(data.last_fetched_at);
  const fetchAge = Number.isFinite(fetchedAt.getTime()) ? (now.getTime() - fetchedAt.getTime()) / 86_400_000 : null;
  if (fetchAge === null) fail(`${id}: last_fetched_at is missing or invalid`);
  else if (fetchAge > 2) warn(`${id}: snapshot was not refreshed by a successful fetch in the last 48 hours`);

  rows.push({ id, frequency, latestDate: latestDate ?? "—", age: age ?? "—", observations: observations.length });
}

const status = errors.length ? "failed" : warnings.length ? "partial" : "success";
const markdown = [
  "## Data quality details",
  "",
  `Status: **${status === "success" ? "Success" : status === "partial" ? "Partial (warnings)" : "Failed"}**`,
  "",
  "| Series | Frequency | Latest observation | Age (days) | Observations |",
  "|---|---:|---:|---:|---:|",
  ...rows.map((row) => `| ${row.id} | ${row.frequency} | ${row.latestDate} | ${row.age} | ${row.observations} |`),
  "",
  `Warnings: **${warnings.length}**`,
  `Errors: **${errors.length}**`,
  ...(warnings.length ? ["", "### Warnings", ...warnings.map((item) => `- ${item}`)] : []),
  ...(errors.length ? ["", "### Errors", ...errors.map((item) => `- ${item}`)] : []),
  "",
].join("\n");

console.log(markdown);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown, "utf8");
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `status=${status}\nwarnings=${warnings.length}\nerrors=${errors.length}\n`, "utf8");
}
if (process.env.DATA_QUALITY_REPORT) await writeFile(process.env.DATA_QUALITY_REPORT, markdown, "utf8");

if (errors.length) process.exitCode = 1;
