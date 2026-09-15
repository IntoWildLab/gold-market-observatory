const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { formatShanghaiDate, formatShanghaiDateTime } = require("../.tmp-pipeline/lib/date-format.js");

const FIXED_TIMESTAMP = "2026-09-15T16:30:45.123Z";

test("Shanghai formatters return fixed machine-readable output", () => {
  assert.equal(formatShanghaiDate(FIXED_TIMESTAMP), "2026-09-16");
  assert.equal(formatShanghaiDateTime(FIXED_TIMESTAMP), "2026-09-16 00:30:45");
  assert.equal(formatShanghaiDateTime(null), "—");
  assert.equal(formatShanghaiDateTime("not-a-date"), "—");
});

test("formatting is identical under UTC and Asia/Shanghai process time zones", () => {
  const modulePath = path.resolve(__dirname, "../.tmp-pipeline/lib/date-format.js");
  const script = `const f=require(${JSON.stringify(modulePath)});process.stdout.write(JSON.stringify([f.formatShanghaiDate(${JSON.stringify(FIXED_TIMESTAMP)}),f.formatShanghaiDateTime(${JSON.stringify(FIXED_TIMESTAMP)})]));`;
  const render = (TZ) => spawnSync(process.execPath, ["-e", script], { encoding: "utf8", env: { ...process.env, TZ } });
  const utc = render("UTC");
  const shanghai = render("Asia/Shanghai");
  assert.equal(utc.status, 0, utc.stderr);
  assert.equal(shanghai.status, 0, shanghai.stderr);
  assert.equal(utc.stdout, '["2026-09-16","2026-09-16 00:30:45"]');
  assert.equal(shanghai.stdout, utc.stdout);
});

test("Refined V4 renders only server-stable current date and explicit-zone timestamps", () => {
  const source = readFileSync(path.resolve(__dirname, "../components/design/RefinedV4Preview.tsx"), "utf8");
  assert.match(source, /\{d\.currentDate\}/);
  assert.match(source, /formatShanghaiDateTime\(d\.manifestGeneratedAt\)/);
  assert.match(source, /formatShanghaiDateTime\(s\.lastFetchedAt\)/);
  assert.doesNotMatch(source, /new Date\s*\(\s*\)/);
  assert.doesNotMatch(source, /toLocaleDateString\s*\(/);
  assert.doesNotMatch(source, /new Date\s*\([^)]*\)\.toLocaleString\s*\(/);
});

test("Event Risk uses the server-stable render time without hydration suppression", () => {
  const source = readFileSync(path.resolve(__dirname, "../components/design/EventRiskStrip.tsx"), "utf8");
  assert.doesNotMatch(source, /now\s*=\s*new Date\s*\(/);
  assert.doesNotMatch(source, /suppressHydrationWarning/);
});
