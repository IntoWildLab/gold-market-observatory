import type { Observation } from "../types";
import { TROY_OZ_GRAMS } from "./china";

export const ATTRIBUTION_WINDOWS = [5, 20, 60] as const;
export const TRACKING_WINDOWS = [5, 20, 60] as const;
export type AnalysisWindow = (typeof ATTRIBUTION_WINDOWS)[number];
export type AnalysisStatus = "available" | "insufficient_data";

export interface CommonCalendarPoint {
  date: string;
  values: number[];
}

export interface ChinaGoldAttributionWindow {
  window: `${AnalysisWindow}D`;
  status: AnalysisStatus;
  start_date: string | null;
  end_date: string | null;
  sample_count: number;
  actual_au99_return_pct: number | null;
  gold_factor_return_pct: number | null;
  fx_factor_return_pct: number | null;
  deviation_factor_return_pct: number | null;
  gold_contribution_pp: number | null;
  fx_contribution_pp: number | null;
  deviation_contribution_pp: number | null;
  interaction_method: "shapley_equal_allocation";
  closure_error: number | null;
}

export interface ChinaGoldAttributionData {
  generated_at: string;
  source_series: ["gold_price", "usd_cny", "au99_99"];
  benchmark_role: "china_gold_benchmark";
  theoretical_formula: "XAU_USD * USD_CNY / 31.1034768";
  common_calendar_count: number;
  windows: ChinaGoldAttributionWindow[];
}

export interface CnEtfTrackingWindow {
  window: `${AnalysisWindow}D`;
  status: AnalysisStatus;
  start_date: string | null;
  end_date: string | null;
  sample_count: number;
  nav_return_pct: number | null;
  benchmark_return_pct: number | null;
  tracking_difference_pp: number | null;
}

export interface CnEtfTrackingData {
  generated_at: string;
  etf_code: "518880";
  source_series_id: "cn_gold_etf_nav";
  benchmark_id: "au99_99";
  benchmark_role: "china_gold_benchmark";
  benchmark_is_proxy: true;
  metric: "tracking_difference";
  unit: "percentage_points";
  common_calendar_count: number;
  windows: CnEtfTrackingWindow[];
}

function validMap(observations: Observation[]): Map<string, number> {
  return new Map(
    observations
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.observation_date) && Number.isFinite(item.value) && item.value > 0)
      .map((item) => [item.observation_date, item.value]),
  );
}

/** 只保留所有输入序列都存在有效观测的日期，所有窗口共享这一日历。 */
export function buildCommonCalendar(...series: Observation[][]): CommonCalendarPoint[] {
  if (!series.length) return [];
  const maps = series.map(validMap);
  return [...maps[0].keys()]
    .filter((date) => maps.every((map) => map.has(date)))
    .sort()
    .map((date) => ({ date, values: maps.map((map) => map.get(date) as number) }));
}

function insufficientAttribution(window: AnalysisWindow, sampleCount: number): ChinaGoldAttributionWindow {
  return {
    window: `${window}D`, status: "insufficient_data", start_date: null, end_date: null, sample_count: sampleCount,
    actual_au99_return_pct: null, gold_factor_return_pct: null, fx_factor_return_pct: null,
    deviation_factor_return_pct: null, gold_contribution_pp: null, fx_contribution_pp: null,
    deviation_contribution_pp: null, interaction_method: "shapley_equal_allocation", closure_error: null,
  };
}

export function computeChinaGoldAttribution(
  gold: Observation[],
  fx: Observation[],
  au99: Observation[],
  generatedAt: string,
): ChinaGoldAttributionData {
  const calendar = buildCommonCalendar(gold, fx, au99);
  const windows = ATTRIBUTION_WINDOWS.map((window): ChinaGoldAttributionWindow => {
    if (calendar.length < window + 1) return insufficientAttribution(window, calendar.length);
    const start = calendar[calendar.length - 1 - window];
    const end = calendar[calendar.length - 1];
    const [g0, f0, a0] = start.values;
    const [g1, f1, a1] = end.values;
    const t0 = g0 * f0 / TROY_OZ_GRAMS;
    const t1 = g1 * f1 / TROY_OZ_GRAMS;
    const k0 = a0 / t0;
    const k1 = a1 / t1;
    const rG = g1 / g0 - 1;
    const rF = f1 / f0 - 1;
    const rK = k1 / k0 - 1;
    const triple = rG * rF * rK;
    const cG = rG + (rG * rF + rG * rK) / 2 + triple / 3;
    const cF = rF + (rG * rF + rF * rK) / 2 + triple / 3;
    const cK = rK + (rG * rK + rF * rK) / 2 + triple / 3;
    const actual = a1 / a0 - 1;
    return {
      window: `${window}D`, status: "available", start_date: start.date, end_date: end.date,
      sample_count: window + 1,
      actual_au99_return_pct: actual * 100,
      gold_factor_return_pct: rG * 100,
      fx_factor_return_pct: rF * 100,
      deviation_factor_return_pct: rK * 100,
      gold_contribution_pp: cG * 100,
      fx_contribution_pp: cF * 100,
      deviation_contribution_pp: cK * 100,
      interaction_method: "shapley_equal_allocation",
      closure_error: (cG + cF + cK - actual) * 100,
    };
  });
  return {
    generated_at: generatedAt,
    source_series: ["gold_price", "usd_cny", "au99_99"],
    benchmark_role: "china_gold_benchmark",
    theoretical_formula: "XAU_USD * USD_CNY / 31.1034768",
    common_calendar_count: calendar.length,
    windows,
  };
}

function insufficientTracking(window: AnalysisWindow, sampleCount: number): CnEtfTrackingWindow {
  return {
    window: `${window}D`, status: "insufficient_data", start_date: null, end_date: null,
    sample_count: sampleCount, nav_return_pct: null, benchmark_return_pct: null, tracking_difference_pp: null,
  };
}

export function computeCnEtfTracking(
  nav: Observation[],
  au99: Observation[],
  generatedAt: string,
): CnEtfTrackingData {
  const calendar = buildCommonCalendar(nav, au99);
  const windows = TRACKING_WINDOWS.map((window): CnEtfTrackingWindow => {
    if (calendar.length < window + 1) return insufficientTracking(window, calendar.length);
    const start = calendar[calendar.length - 1 - window];
    const end = calendar[calendar.length - 1];
    const [nav0, benchmark0] = start.values;
    const [nav1, benchmark1] = end.values;
    const navReturn = (nav1 / nav0 - 1) * 100;
    const benchmarkReturn = (benchmark1 / benchmark0 - 1) * 100;
    return {
      window: `${window}D`, status: "available", start_date: start.date, end_date: end.date,
      sample_count: window + 1, nav_return_pct: navReturn, benchmark_return_pct: benchmarkReturn,
      tracking_difference_pp: navReturn - benchmarkReturn,
    };
  });
  return {
    generated_at: generatedAt,
    etf_code: "518880",
    source_series_id: "cn_gold_etf_nav",
    benchmark_id: "au99_99",
    benchmark_role: "china_gold_benchmark",
    benchmark_is_proxy: true,
    metric: "tracking_difference",
    unit: "percentage_points",
    common_calendar_count: calendar.length,
    windows,
  };
}
