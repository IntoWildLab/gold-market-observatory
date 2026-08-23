import type { PageData } from "./page-data";
import type { AlignmentStatus, EtfFoundationRow } from "./cn-etf-foundation";
import type { ChinaGoldAttributionWindow, CnEtfTrackingWindow } from "./china-analysis";

export type DesignWindow = "5D" | "20D" | "60D";
export type DesignAvailability = "available" | "unavailable";
export type DesignWindowSet<T> = Record<DesignWindow, T | null>;

export type DesignChinaGoldAttributionWindow = Omit<ChinaGoldAttributionWindow, "sample_count"> & { sample_count: number | null };
export type DesignCnEtfTrackingWindow = Omit<CnEtfTrackingWindow, "sample_count"> & { sample_count: number | null };

export interface DesignChinaGoldAttribution {
  availability: DesignAvailability;
  generated_at: string | null;
  benchmark_role: "china_gold_benchmark";
  theoretical_formula: string | null;
  common_calendar_count: number | null;
  windows: DesignWindowSet<DesignChinaGoldAttributionWindow>;
}

export interface DesignChinaBenchmark {
  id: "au99_99";
  role: "china_gold_benchmark";
}

export interface DesignCnGoldEtf {
  availability: DesignAvailability;
  etf_code: "518880";
  market_close: number | null;
  market_close_date: string | null;
  daily_return_pct: number | null;
  official_nav: number | null;
  nav_date: string | null;
  premium_discount_pct: number | null;
  premium_discount_abs: number | null;
  alignment_status: AlignmentStatus | null;
  formal_premium_available: boolean;
  total_shares: number | null;
  shares_unit: "hundred_million_shares";
  shares_date: string | null;
  shares_change: number | null;
  shares_change_pct: number | null;
  shares_change_windows_pct: DesignWindowSet<number>;
  estimated_aum_cny: number | null;
  estimated_market_effect_cny: number | null;
  estimated_share_flow_cny: number | null;
  decomposition_closure_residual_cny: number | null;
  tracking: {
    availability: DesignAvailability;
    source_series_id: "cn_gold_etf_nav";
    benchmark_id: "au99_99";
    benchmark_role: "china_gold_benchmark";
    benchmark_is_proxy: true;
    windows: DesignWindowSet<DesignCnEtfTrackingWindow>;
  };
}

export interface DesignData {
  manifestGeneratedAt: string | null;
  gold: PageData["gold"];
  macros: PageData["macros"];
  china: PageData["china"] & {
    goldAttribution: DesignChinaGoldAttribution;
    goldBenchmark: DesignChinaBenchmark;
  };
  invest: { chinaGoldEtf: DesignCnGoldEtf };
  comparison: PageData["comparison"];
  theoretical: PageData["theoretical"];
  etf: PageData["etf"];
  structure: PageData["structure"];
  temperature: PageData["temperature"];
  drivers: PageData["drivers"];
  charts: Array<Pick<PageData["charts"][number], "seriesId" | "label" | "unit" | "frequency" | "source"> & { points: Array<{ date: string; value: number | null }> }>;
  etfRegional: Array<{ date: string; northAmerica: number | null; europe: number | null; asia: number | null; other: number | null; total: number | null }>;
  etfFlowsUsd: Array<{ date: string; totalUsd: number }>;
  series: Array<{
    name: string;
    isProxy: boolean;
    source: string;
    frequency: string;
    lastObservationDate: string | null;
    lastFetchedAt: string;
  }>;
}

const MAX_POINTS = 260;
const WINDOWS: DesignWindow[] = ["5D", "20D", "60D"];

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function windowSet<T extends { window: DesignWindow }>(windows: T[] | null | undefined): DesignWindowSet<T> {
  return Object.fromEntries(WINDOWS.map((window) => [window, windows?.find((item) => item.window === window) ?? null])) as DesignWindowSet<T>;
}

function sanitizeAttributionWindow(row: ChinaGoldAttributionWindow): DesignChinaGoldAttributionWindow {
  return {
    ...row,
    sample_count: finiteOrNull(row.sample_count),
    actual_au99_return_pct: finiteOrNull(row.actual_au99_return_pct),
    gold_factor_return_pct: finiteOrNull(row.gold_factor_return_pct),
    fx_factor_return_pct: finiteOrNull(row.fx_factor_return_pct),
    deviation_factor_return_pct: finiteOrNull(row.deviation_factor_return_pct),
    gold_contribution_pp: finiteOrNull(row.gold_contribution_pp),
    fx_contribution_pp: finiteOrNull(row.fx_contribution_pp),
    deviation_contribution_pp: finiteOrNull(row.deviation_contribution_pp),
    closure_error: finiteOrNull(row.closure_error),
  };
}

function sanitizeTrackingWindow(row: CnEtfTrackingWindow): DesignCnEtfTrackingWindow {
  return {
    ...row,
    sample_count: finiteOrNull(row.sample_count),
    nav_return_pct: finiteOrNull(row.nav_return_pct),
    benchmark_return_pct: finiteOrNull(row.benchmark_return_pct),
    tracking_difference_pp: finiteOrNull(row.tracking_difference_pp),
  };
}

function latestFoundationRow(d: PageData): EtfFoundationRow | null {
  return d.cnGoldEtfFoundation?.rows.at(-1) ?? null;
}

export function buildDesignData(d: PageData): DesignData {
  const attribution = d.chinaGoldAttribution;
  const attributionWindows = windowSet(attribution?.windows.map(sanitizeAttributionWindow));
  const foundation = latestFoundationRow(d);
  const tracking = d.cnGoldEtfTracking;
  const trackingWindows = windowSet(tracking?.windows.map(sanitizeTrackingWindow));
  const sameDate = foundation?.alignmentStatus === "same_date";

  return {
    manifestGeneratedAt: d.manifestGeneratedAt,
    gold: d.gold,
    macros: d.macros,
    china: {
      ...d.china,
      goldAttribution: {
        availability: attribution ? "available" : "unavailable",
        generated_at: attribution?.generated_at ?? null,
        benchmark_role: "china_gold_benchmark",
        theoretical_formula: attribution?.theoretical_formula ?? null,
        common_calendar_count: finiteOrNull(attribution?.common_calendar_count),
        windows: attributionWindows,
      },
      goldBenchmark: { id: "au99_99", role: "china_gold_benchmark" },
    },
    invest: {
      chinaGoldEtf: {
        availability: foundation || tracking || d.china.etf.price !== null ? "available" : "unavailable",
        etf_code: "518880",
        market_close: finiteOrNull(d.china.etf.price),
        market_close_date: d.china.etf.date,
        daily_return_pct: finiteOrNull(d.china.etf.dailyChangePct),
        official_nav: finiteOrNull(foundation?.nav),
        nav_date: foundation?.navDate ?? null,
        premium_discount_pct: sameDate ? finiteOrNull(foundation?.premiumDiscountPct) : null,
        premium_discount_abs: null,
        alignment_status: foundation?.alignmentStatus ?? null,
        formal_premium_available: sameDate && finiteOrNull(foundation?.premiumDiscountPct) !== null,
        total_shares: finiteOrNull(foundation?.sharesHundredMillion),
        shares_unit: "hundred_million_shares",
        shares_date: foundation?.sharesHundredMillion != null ? foundation.date : null,
        shares_change: finiteOrNull(d.china.etf.sharesNetFlow),
        shares_change_pct: finiteOrNull(d.china.etf.sharesChangePct),
        shares_change_windows_pct: {
          "5D": finiteOrNull(foundation?.sharesChange5dPct),
          "20D": finiteOrNull(foundation?.sharesChange20dPct),
          "60D": finiteOrNull(foundation?.sharesChange60dPct),
        },
        estimated_aum_cny: finiteOrNull(foundation?.estimatedAumCny),
        estimated_market_effect_cny: finiteOrNull(foundation?.marketEffectCny),
        estimated_share_flow_cny: finiteOrNull(foundation?.shareEffectCny),
        decomposition_closure_residual_cny: finiteOrNull(foundation?.decompositionResidualCny),
        tracking: {
          availability: tracking ? "available" : "unavailable",
          source_series_id: "cn_gold_etf_nav",
          benchmark_id: "au99_99",
          benchmark_role: "china_gold_benchmark",
          benchmark_is_proxy: true,
          windows: trackingWindows,
        },
      },
    },
    comparison: d.comparison,
    theoretical: d.theoretical,
    etf: d.etf,
    structure: d.structure,
    temperature: d.temperature,
    drivers: d.drivers,
    charts: d.charts.map((c) => ({
      seriesId: c.seriesId,
      label: c.label,
      unit: c.unit,
      frequency: c.frequency,
      source: c.source,
      points: c.points.slice(-MAX_POINTS),
    })),
    etfRegional: (d.etfRegional ?? []).slice(-130),
    etfFlowsUsd: (d.etfFlowsUsd ?? []).slice(-130),
    series: Object.values(d.series)
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .map((s) => ({
        name: s.meta.name,
        isProxy: Boolean(s.meta.source.is_proxy_of),
        source: s.meta.source.name,
        frequency: s.meta.frequency,
        lastObservationDate: s.last_observation_date,
        lastFetchedAt: s.last_fetched_at,
      })),
  };
}
