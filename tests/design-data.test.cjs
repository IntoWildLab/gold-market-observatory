const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { buildDesignData } = require("../.tmp-pipeline/lib/design-data-builder.js");

const WINDOWS = ["5D", "20D", "60D"];

function attributionWindow(window, value) {
  return {
    window,
    status: "available",
    start_date: "2026-01-01",
    end_date: "2026-02-01",
    sample_count: Number.parseInt(window) + 1,
    actual_au99_return_pct: value,
    gold_contribution_pp: value + 1,
    fx_contribution_pp: value + 2,
    deviation_contribution_pp: value + 3,
    gold_factor_return_pct: value + 4,
    fx_factor_return_pct: value + 5,
    deviation_factor_return_pct: value + 6,
    interaction_method: "shapley_equal_allocation",
    closure_error: value + 7,
  };
}

function trackingWindow(window, value) {
  return {
    window,
    status: "available",
    start_date: "2026-01-01",
    end_date: "2026-02-01",
    sample_count: Number.parseInt(window) + 1,
    nav_return_pct: value,
    benchmark_return_pct: value + 1,
    tracking_difference_pp: value + 2,
  };
}

function foundationRow(overrides = {}) {
  return {
    date: "2026-02-01",
    price: 10.2,
    nav: 10,
    navDate: "2026-02-01",
    sharesHundredMillion: 12,
    alignmentStatus: "same_date",
    premiumDiscountPct: 123.456,
    estimatedAumCny: 456,
    sharesChange5dPct: 5,
    sharesChange20dPct: 20,
    sharesChange60dPct: 60,
    shareChangeStreakDays: 1,
    marketEffectCny: 111,
    shareEffectCny: 222,
    aumChangeCny: 333,
    decompositionResidualCny: 0.125,
    priceShareRelationship: "same_direction",
    ...overrides,
  };
}

function fixture() {
  return {
    generatedAt: "2026-09-15T16:30:00.000Z",
    manifestGeneratedAt: "2026-09-15T13:23:57.252Z",
    eventRisk: {
      availability: "unavailable",
      stale: false,
      additionalEventCount: 0,
      provenance: { usesVerifiedCache: false, hasLiveSourceFailure: false },
    },
    whatChanged: {
      availability: "insufficient",
      goldMove: { direction: "neutral", changePct: null, window: "近1日", endDate: null, description: "当前变化数据不足" },
      environment: { label: "宏观证据暂不完整", tone: "neutral", explanation: "数据不足", stale: false },
      evidence: [],
      nextWatch: { kind: "observation", label: "下一步观察：数据是否恢复完整。" },
      disclaimer: "基于已发生的数据变化归纳，不是价格预测或交易建议。",
    },
    gold: {},
    macros: [],
    china: {
      au99: {},
      usdcny: {},
      etf: {
        price: 10.2,
        date: "2026-02-01",
        dailyChangePct: 1.5,
        sharesNetFlow: 0.5,
        sharesChangePct: 4.3,
      },
    },
    comparison: {},
    theoretical: {},
    etf: {},
    structure: {},
    temperature: {},
    drivers: [],
    charts: [],
    etfRegional: null,
    etfFlowsUsd: null,
    series: {},
    chinaGoldAttribution: {
      generated_at: "now",
      source_series: ["gold_price", "usd_cny", "au99_99"],
      benchmark_role: "china_gold_benchmark",
      theoretical_formula: "XAU_USD * USD_CNY / 31.1034768",
      common_calendar_count: 61,
      windows: WINDOWS.map((window, index) => attributionWindow(window, index + 10)),
    },
    cnGoldEtfFoundation: {
      generated_at: "now",
      etf_code: "518880",
      units: {},
      methodology: {},
      latest_formal_premium: null,
      rows: [foundationRow()],
    },
    cnGoldEtfTracking: {
      generated_at: "now",
      etf_code: "518880",
      source_series_id: "cn_gold_etf_nav",
      benchmark_id: "au99_99",
      benchmark_role: "china_gold_benchmark",
      benchmark_is_proxy: true,
      metric: "tracking_difference",
      unit: "percentage_points",
      common_calendar_count: 61,
      windows: WINDOWS.map((window, index) => trackingWindow(window, index + 30)),
    },
  };
}

test("5D/20D/60D 人民币黄金归因进入 DesignData 并保留 Au99.99 角色", () => {
  const data = buildDesignData(fixture());
  assert.equal(data.generatedAt, "2026-09-15T16:30:00.000Z");
  assert.equal(data.currentDate, "2026-09-16");
  assert.equal(data.manifestGeneratedAt, "2026-09-15T13:23:57.252Z");
  assert.equal(data.eventRisk.availability, "unavailable");
  assert.equal(data.whatChanged.availability, "insufficient");
  assert.deepEqual(Object.keys(data.china.goldAttribution.windows), WINDOWS);
  assert.equal(data.china.goldAttribution.windows["20D"].gold_contribution_pp, 12);
  assert.equal(data.china.goldAttribution.windows["20D"].deviation_contribution_pp, 14);
  assert.equal(data.china.goldBenchmark.id, "au99_99");
  assert.equal(data.china.goldBenchmark.role, "china_gold_benchmark");
});

test("518880 foundation 的 NAV、日频份额、窗口、AUM 与分解值进入 DesignData", () => {
  const etf = buildDesignData(fixture()).invest.chinaGoldEtf;
  assert.equal(etf.official_nav, 10);
  assert.equal(etf.nav_date, "2026-02-01");
  assert.equal(etf.total_shares, 12);
  assert.equal(etf.shares_unit, "hundred_million_shares");
  assert.equal(etf.shares_change, 0.5);
  assert.equal(etf.shares_change_pct, 4.3);
  assert.equal(etf.shares_change_windows_pct["20D"], 20);
  assert.equal(etf.estimated_aum_cny, 456);
  assert.equal(etf.estimated_market_effect_cny, 111);
  assert.equal(etf.estimated_share_flow_cny, 222);
  assert.equal(etf.decomposition_closure_residual_cny, 0.125);
});

test("same_date 才暴露正式折溢价，且不在 DesignData 重算派生值", () => {
  const input = fixture();
  const etf = buildDesignData(input).invest.chinaGoldEtf;
  assert.equal(etf.alignment_status, "same_date");
  assert.equal(etf.formal_premium_available, true);
  assert.equal(etf.premium_discount_pct, 123.456);
  assert.equal(etf.premium_discount_abs, null);
  assert.equal(etf.estimated_aum_cny, 456);
});

test("nav_lagged 保留 NAV 日期但不冒充正式折溢价", () => {
  const input = fixture();
  input.cnGoldEtfFoundation.rows = [foundationRow({ alignmentStatus: "nav_lagged", navDate: "2026-01-31" })];
  const etf = buildDesignData(input).invest.chinaGoldEtf;
  assert.equal(etf.official_nav, 10);
  assert.equal(etf.nav_date, "2026-01-31");
  assert.equal(etf.alignment_status, "nav_lagged");
  assert.equal(etf.premium_discount_pct, null);
  assert.equal(etf.formal_premium_available, false);
});

test("Tracking 使用官方 NAV 语义、20D 值与 proxy benchmark", () => {
  const tracking = buildDesignData(fixture()).invest.chinaGoldEtf.tracking;
  assert.equal(tracking.source_series_id, "cn_gold_etf_nav");
  assert.equal(tracking.benchmark_id, "au99_99");
  assert.equal(tracking.benchmark_role, "china_gold_benchmark");
  assert.equal(tracking.benchmark_is_proxy, true);
  assert.equal(tracking.windows["20D"].tracking_difference_pp, 33);
});

test("缺失 NAV、Tracking 窗口和 Attribution 窗口均安全表达", () => {
  const input = fixture();
  input.cnGoldEtfFoundation.rows = [foundationRow({ nav: null, navDate: null, alignmentStatus: "nav_missing", premiumDiscountPct: null })];
  input.cnGoldEtfTracking.windows = input.cnGoldEtfTracking.windows.filter((row) => row.window !== "60D");
  input.chinaGoldAttribution.windows = input.chinaGoldAttribution.windows.filter((row) => row.window !== "5D");
  const data = buildDesignData(input);
  assert.equal(data.invest.chinaGoldEtf.official_nav, null);
  assert.equal(data.invest.chinaGoldEtf.premium_discount_pct, null);
  assert.equal(data.invest.chinaGoldEtf.tracking.windows["60D"], null);
  assert.equal(data.china.goldAttribution.windows["5D"], null);
});

test("整个派生数据缺失时提供明确 availability 与固定窗口", () => {
  const input = fixture();
  input.chinaGoldAttribution = null;
  input.cnGoldEtfTracking = null;
  input.cnGoldEtfFoundation = null;
  input.china.etf.price = null;
  const data = buildDesignData(input);
  assert.equal(data.china.goldAttribution.availability, "unavailable");
  assert.deepEqual(data.china.goldAttribution.windows, { "5D": null, "20D": null, "60D": null });
  assert.equal(data.invest.chinaGoldEtf.availability, "unavailable");
  assert.equal(data.invest.chinaGoldEtf.tracking.availability, "unavailable");
});

test("daily shares 与 foundation 缺失时保留价格、官方 NAV 和 tracking", () => {
  const input = fixture();
  input.cnGoldEtfFoundation = null;
  input.china.etf.sharesValue = null;
  input.china.etf.sharesDate = null;
  input.china.etf.sharesNetFlow = null;
  input.china.etf.sharesChangePct = null;
  input.series.cn_gold_etf_nav = {
    meta: { name: "518880 official NAV", source: { name: "Huaan" }, frequency: "daily" },
    observations: [{ observation_date: "2026-02-01", value: 10.01 }],
    last_observation_date: "2026-02-01",
    last_fetched_at: "now",
  };
  const etf = buildDesignData(input).invest.chinaGoldEtf;
  assert.equal(etf.availability, "available");
  assert.equal(etf.daily_shares_availability, "unavailable");
  assert.equal(etf.foundation_availability, "unavailable");
  assert.equal(etf.market_close, 10.2);
  assert.equal(etf.official_nav, 10.01);
  assert.equal(etf.tracking.availability, "available");
  assert.equal(etf.total_shares, null);
  assert.equal(etf.estimated_aum_cny, null);
});

test("Refined V4 对 shares/foundation 缺失使用明确 Unavailable 文案", () => {
  const source = readFileSync(path.resolve(__dirname, "../components/design/RefinedV4Preview.tsx"), "utf8");
  assert.match(source, /daily_shares_availability/);
  assert.match(source, /foundation_availability/);
  assert.match(source, /Daily ETF shares unavailable/);
  assert.match(source, /value=\{foundationUnavailable \? "Unavailable"/);
});

test("NaN 与 Infinity 被转为 null，不进入 V4 数据契约", () => {
  const input = fixture();
  input.chinaGoldAttribution.windows[0].gold_contribution_pp = Number.NaN;
  input.chinaGoldAttribution.windows[0].sample_count = Number.POSITIVE_INFINITY;
  input.cnGoldEtfTracking.windows[0].tracking_difference_pp = Number.NEGATIVE_INFINITY;
  input.cnGoldEtfFoundation.rows[0].estimatedAumCny = Number.POSITIVE_INFINITY;
  const data = buildDesignData(input);
  assert.equal(data.china.goldAttribution.windows["5D"].gold_contribution_pp, null);
  assert.equal(data.china.goldAttribution.windows["5D"].sample_count, null);
  assert.equal(data.invest.chinaGoldEtf.tracking.windows["5D"].tracking_difference_pp, null);
  assert.equal(data.invest.chinaGoldEtf.estimated_aum_cny, null);
});
