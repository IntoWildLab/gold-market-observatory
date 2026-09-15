const test = require("node:test");
const assert = require("node:assert/strict");
const { buildWhatChanged, WHAT_CHANGED_THRESHOLDS } = require("../.tmp-pipeline/lib/what-changed.js");

const NOW = new Date("2026-09-12T00:00:00.000Z");
const DATES = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12"];

function series(id, values, dates = DATES.slice(-values.length)) {
  return {
    meta: { series: id, name: id, frequency: "daily", source: { name: "fixture", url: "https://example.com" } },
    observations: values.map((value, index) => ({ series: id, observation_date: dates[index], value, unit: "fixture", frequency: "daily", source: "fixture", source_url: "https://example.com", fetched_at: NOW.toISOString() })),
    last_observation_date: dates.at(-1),
    last_fetched_at: NOW.toISOString(),
  };
}

function eventRisk(overrides = {}) {
  return {
    availability: "unavailable",
    stale: false,
    additionalEventCount: 0,
    provenance: { usesVerifiedCache: false, hasLiveSourceFailure: false },
    ...overrides,
  };
}

function bundle({ gold = -1, realBp = 10, dxyPct = 0.8, nominalBp = 8, dxyDates } = {}) {
  return {
    gold_price: series("gold_price", [100, 100 * (1 + gold / 100)], ["2026-09-11", "2026-09-12"]),
    us10y_real: series("us10y_real", [2, 2, 2, 2, 2, 2 + realBp / 100]),
    dxy_proxy: series("dxy_proxy", [100, 100, 100, 100, 100, 100 * (1 + dxyPct / 100)], dxyDates),
    us10y_nominal: series("us10y_nominal", [4, 4, 4, 4, 4, 4 + nominalBp / 100]),
    gold_etf_flows: series("gold_etf_flows", [10, 20, 30, 40]),
    cb_gold_purchases: series("cb_gold_purchases", [50, 60]),
  };
}

function view(options, risk = eventRisk()) {
  return buildWhatChanged(bundle(options), risk, NOW);
}

test("Gold down + real yield up + DXY up uses the combined-pressure label", () => {
  assert.equal(view({}).environment.label, "利率与美元共同施压");
});

test("Gold down + real yield up + neutral DXY highlights rate pressure", () => {
  assert.equal(view({ dxyPct: 0.1 }).environment.label, "利率压力更明显");
});

test("Gold down + neutral real yield + DXY up highlights dollar pressure", () => {
  assert.equal(view({ realBp: 2 }).environment.label, "美元压力更明显");
});

test("Gold up + real yield down + DXY down uses the combined-support label", () => {
  assert.equal(view({ gold: 1, realBp: -10, dxyPct: -0.8 }).environment.label, "利率与美元环境共同支持");
});

test("an obvious gold move without supporting macro evidence stays divided", () => {
  assert.equal(view({ gold: -1, realBp: -10, dxyPct: -0.8 }).environment.label, "黄金变化明显，但宏观证据分化");
});

test("gold inside the fixed neutral threshold is described as limited", () => {
  const result = view({ gold: WHAT_CHANGED_THRESHOLDS.goldDailyPct - 0.01 });
  assert.equal(result.goldMove.description, "黄金变化有限");
  assert.equal(result.goldMove.direction, "neutral");
});

test("nominal yield is auxiliary and cannot change the environment verdict", () => {
  const rising = view({ nominalBp: 20 });
  const falling = view({ nominalBp: -20 });
  assert.equal(rising.environment.label, falling.environment.label);
  assert.equal(rising.evidence.find((item) => item.id === "nominal_yield").auxiliary, true);
});

test("weekly ETF flows cannot change the daily macro verdict", () => {
  const input = bundle({});
  const baseline = buildWhatChanged(input, eventRisk(), NOW).environment.label;
  input.gold_etf_flows = series("gold_etf_flows", [-1000, -1000, -1000, -1000]);
  assert.equal(buildWhatChanged(input, eventRisk(), NOW).environment.label, baseline);
});

test("quarterly central-bank data cannot enter or change the daily explanation", () => {
  const input = bundle({});
  const baseline = buildWhatChanged(input, eventRisk(), NOW);
  input.cb_gold_purchases = series("cb_gold_purchases", [-999, -999]);
  const changed = buildWhatChanged(input, eventRisk(), NOW);
  assert.equal(changed.environment.label, baseline.environment.label);
  assert.equal(changed.evidence.some((item) => item.id.includes("central")), false);
});

test("an available future Event Risk item becomes the next observation point", () => {
  const risk = eventRisk({ availability: "available", nearestEvent: { title: "FOMC Policy Decision", scheduledAt: "2026-09-13T00:00:00.000Z" } });
  const result = view({}, risk);
  assert.deepEqual(result.nextWatch, { kind: "event", label: "FOMC Policy Decision", scheduledAt: "2026-09-13T00:00:00.000Z", hoursUntil: 24, direction: "unknown" });
});

test("unavailable Event Risk falls back to a non-predictive observation prompt", () => {
  const result = view({});
  assert.equal(result.nextWatch.kind, "observation");
  assert.match(result.nextWatch.label, /实际利率和美元是否继续同步走强/);
});

test("one missing core macro series produces partial availability", () => {
  const input = bundle({});
  input.dxy_proxy = null;
  const result = buildWhatChanged(input, eventRisk(), NOW);
  assert.equal(result.availability, "partial");
  assert.equal(result.environment.label, "宏观证据暂不完整");
});

test("missing gold history produces an insufficient view without throwing", () => {
  const input = bundle({});
  input.gold_price = series("gold_price", [100], ["2026-09-12"]);
  const result = buildWhatChanged(input, eventRisk(), NOW);
  assert.equal(result.availability, "insufficient");
  assert.equal(result.goldMove.description, "当前变化数据不足");
});

test("stale macro evidence is dated and cannot masquerade as current evidence", () => {
  const staleDates = ["2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30", "2026-08-31", "2026-09-01"];
  const result = view({ dxyDates: staleDates });
  const dxy = result.evidence.find((item) => item.id === "dxy");
  assert.equal(result.availability, "partial");
  assert.equal(result.environment.label, "宏观证据更新较慢");
  assert.equal(dxy.endDate, "2026-09-01");
  assert.equal(dxy.stale, true);
});

test("evidence is capped at three rows and preserves each end date and window", () => {
  const result = view({});
  assert.equal(result.evidence.length, 3);
  assert.equal(result.evidence.every((item) => item.window === "近5个有效观测" && item.endDate === "2026-09-12"), true);
});

test("generated copy contains neither policy-expectation claims nor prohibited action language", () => {
  const result = view({});
  const copy = JSON.stringify(result);
  for (const phrase of ["加息预期升温", "降息预期下降", "买入", "卖出", "抄底", "止损", "目标价", "强烈看涨", "强烈看跌"]) {
    assert.equal(copy.includes(phrase), false, phrase);
  }
});
