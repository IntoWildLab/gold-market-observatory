const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildCommonCalendar,
  computeChinaGoldAttribution,
  computeCnEtfTracking,
} = require("../.tmp-pipeline/lib/china-analysis.js");

function dates(count) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, 1 + index));
    return date.toISOString().slice(0, 10);
  });
}

function observations(series, values, dateList = dates(values.length)) {
  return values.map((value, index) => ({
    series,
    observation_date: dateList[index],
    value,
    unit: series === "gold_price" ? "usd_per_oz" : series === "usd_cny" ? "cny_per_usd" : series === "au99_99" ? "cny_per_gram" : "cny_per_share",
    source: "fixture",
    frequency: "daily",
    fetched_at: "2026-03-10T00:00:00Z",
  }));
}

function geometric(start, end, count) {
  return Array.from({ length: count }, (_, index) => start * Math.pow(end / start, index / (count - 1)));
}

function attributionFixture(gEnd = 1.1, fEnd = 1.02, kEnd = 0.98, count = 61) {
  const g = geometric(100, 100 * gEnd, count);
  const f = geometric(7, 7 * fEnd, count);
  const k = geometric(1, kEnd, count);
  const a = g.map((value, index) => value * f[index] / 31.1034768 * k[index]);
  return {
    gold: observations("gold_price", g),
    fx: observations("usd_cny", f),
    au99: observations("au99_99", a),
  };
}

test("共同交易日剔除错位日期", () => {
  const d = dates(4);
  const gold = observations("gold_price", [1, 2, 3], [d[0], d[1], d[2]]);
  const fx = observations("usd_cny", [1, 2, 3], [d[1], d[2], d[3]]);
  const au = observations("au99_99", [1, 2], [d[1], d[2]]);
  assert.deepEqual(buildCommonCalendar(gold, fx, au).map((row) => row.date), [d[1], d[2]]);
});

test("5D、20D、60D 使用同一共同日历的统一终点", () => {
  const fixture = attributionFixture();
  const result = computeChinaGoldAttribution(fixture.gold, fixture.fx, fixture.au99, "now");
  assert.deepEqual(result.windows.map((row) => row.window), ["5D", "20D", "60D"]);
  assert.ok(result.windows.every((row) => row.status === "available" && row.end_date === result.windows[0].end_date));
  assert.deepEqual(result.windows.map((row) => row.sample_count), [6, 21, 61]);
});

test("Shapley 单因素场景全部归属于国际黄金", () => {
  const fixture = attributionFixture(1.1, 1, 1);
  const row = computeChinaGoldAttribution(fixture.gold, fixture.fx, fixture.au99, "now").windows.at(-1);
  assert.ok(Math.abs(row.gold_contribution_pp - 10) < 1e-10);
  assert.ok(Math.abs(row.fx_contribution_pp) < 1e-10);
  assert.ok(Math.abs(row.deviation_contribution_pp) < 1e-10);
});

test("两因素交叉项对称均分并严格闭合", () => {
  const fixture = attributionFixture(1.1, 1.2, 1);
  const row = computeChinaGoldAttribution(fixture.gold, fixture.fx, fixture.au99, "now").windows.at(-1);
  assert.ok(Math.abs(row.gold_contribution_pp - 11) < 1e-10);
  assert.ok(Math.abs(row.fx_contribution_pp - 21) < 1e-10);
  assert.ok(Math.abs(row.closure_error) < 1e-10);
});

test("三因素交叉项均分且三项贡献闭合实际 Au99.99 收益", () => {
  const fixture = attributionFixture(1.1, 1.2, 1.3);
  const row = computeChinaGoldAttribution(fixture.gold, fixture.fx, fixture.au99, "now").windows.at(-1);
  const sum = row.gold_contribution_pp + row.fx_contribution_pp + row.deviation_contribution_pp;
  assert.ok(Math.abs(sum - row.actual_au99_return_pct) < 1e-10);
  assert.ok(Math.abs(row.closure_error) < 1e-10);
});

test("国内定价偏离和汇率贡献允许为负", () => {
  const fixture = attributionFixture(1.1, 0.95, 0.9);
  const row = computeChinaGoldAttribution(fixture.gold, fixture.fx, fixture.au99, "now").windows.at(-1);
  assert.ok(row.fx_contribution_pp < 0);
  assert.ok(row.deviation_contribution_pp < 0);
});

test("共同样本不足时明确返回 insufficient_data", () => {
  const fixture = attributionFixture(1.1, 1.02, 1, 10);
  const result = computeChinaGoldAttribution(fixture.gold, fixture.fx, fixture.au99, "now");
  assert.equal(result.windows.find((row) => row.window === "5D").status, "available");
  assert.equal(result.windows.find((row) => row.window === "20D").status, "insufficient_data");
  assert.equal(result.windows.find((row) => row.window === "60D").status, "insufficient_data");
});

test("NAV tracking 使用 NAV 与 Au99.99 的共同日期计算 20D/60D", () => {
  const nav = observations("cn_gold_etf_nav", geometric(10, 11, 61));
  const au = observations("au99_99", geometric(500, 560, 61));
  const result = computeCnEtfTracking(nav, au, "now");
  const row20 = result.windows.find((row) => row.window === "20D");
  const row60 = result.windows.find((row) => row.window === "60D");
  assert.equal(row20.sample_count, 21);
  assert.equal(row60.sample_count, 61);
  assert.ok(Math.abs(row60.tracking_difference_pp - (10 - 12)) < 1e-10);
  assert.equal(result.source_series_id, "cn_gold_etf_nav");
  assert.equal(result.benchmark_is_proxy, true);
});

test("Tracking 共同日期错位后按交集判断样本不足", () => {
  const d = dates(30);
  const nav = observations("cn_gold_etf_nav", geometric(10, 11, 20), d.slice(0, 20));
  const au = observations("au99_99", geometric(500, 520, 20), d.slice(10, 30));
  const result = computeCnEtfTracking(nav, au, "now");
  assert.equal(result.common_calendar_count, 10);
  assert.equal(result.windows.find((row) => row.window === "20D").status, "insufficient_data");
});

test("quality gate 拒绝市场价替代 NAV并校验 proxy/闭合", async () => {
  const { validateChinaAttributionData, validateCnEtfTrackingData } = await import("../scripts/data-quality-lib.mjs");
  const fixture = attributionFixture();
  const attribution = computeChinaGoldAttribution(fixture.gold, fixture.fx, fixture.au99, "2026-03-01");
  assert.equal(validateChinaAttributionData(attribution, new Date("2026-04-01")).errors.length, 0);
  attribution.windows[0].closure_error = 1;
  assert.ok(validateChinaAttributionData(attribution, new Date("2026-04-01")).errors.some((error) => error.includes("does not close")));

  const tracking = computeCnEtfTracking(observations("cn_gold_etf_nav", geometric(10, 11, 61)), observations("au99_99", geometric(500, 560, 61)), "now");
  tracking.source_series_id = "cn_gold_etf_price";
  tracking.benchmark_is_proxy = false;
  const errors = validateCnEtfTrackingData(tracking, new Date("2026-04-01")).errors;
  assert.ok(errors.some((error) => error.includes("official NAV")));
  assert.ok(errors.some((error) => error.includes("benchmark proxy")));
});

test("derived 数值变化属于 substantive change，纯生成时间不是", async () => {
  const { isSubstantiveDataChange, uniqueJsonPaths } = await import("../scripts/data-change-lib.mjs");
  const previous = { generated_at: "a", windows: [{ tracking_difference_pp: 1 }] };
  assert.equal(isSubstantiveDataChange(previous, { generated_at: "b", windows: [{ tracking_difference_pp: 1 }] }), false);
  assert.equal(isSubstantiveDataChange(previous, { generated_at: "b", windows: [{ tracking_difference_pp: 2 }] }), true);
  assert.deepEqual(uniqueJsonPaths(["data/manifest.json"], ["data/derived/new.json", "notes.txt"]), ["data/derived/new.json", "data/manifest.json"]);
});
