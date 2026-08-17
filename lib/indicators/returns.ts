/**
 * 指标计算: 区间收益率 / 趋势判断 / 一年位置。
 *
 * 原则: 趋势判断必须使用明确、可复现的规则, 不允许 AI 自由判断。
 *
 * 趋势规则 (文档化, 见 README):
 *  - 取最近 N 个"有效观测"(跳过缺失), 计算收益率 r = (last/first - 1) * 100
 *  - r >= +TREND_BAND → "上升"; r <= -TREND_BAND → "下降"; 其余 → "震荡"
 *  - TREND_BAND 默认 1.5%, N 默认 20 (约一个月交易日)
 */

import type { Observation } from "@/types";

export interface PeriodReturn {
  window: string; // "1D" | "5D" | "20D" | "60D" | "120D" | "1M" ...
  label: string;
  /** 窗口内收益率, % (null = 数据不足) */
  changePct: number | null;
  /** 窗口首值 */
  startValue: number | null;
  /** 窗口末值 */
  endValue: number | null;
  /** 实际使用的观测数 */
  observationsUsed: number;
}

/** 过滤缺失值, 返回按日期升序的值数组 */
export function validValues(obs: Observation[]): Array<{ date: string; value: number }> {
  return obs
    .filter((o) => typeof o.value === "number" && Number.isFinite(o.value))
    .map((o) => ({ date: o.observation_date, value: o.value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 计算区间收益率。
 * windows: 如 [["1D",1],["5D",5],["20D",20],["60D",60],["120D",120]]
 * 对周/月频数据, 1D 窗口含义为"最近两期变化", 调用方应传入合适的窗口。
 */
export function periodReturns(
  obs: Observation[],
  windows: Array<[string, number]>,
): PeriodReturn[] {
  const vals = validValues(obs);
  const out: PeriodReturn[] = [];
  for (const [label, n] of windows) {
    const last = vals[vals.length - 1];
    const idx = vals.length - 1 - n;
    if (!last || idx < 0) {
      out.push({ window: label, label, changePct: null, startValue: null, endValue: last?.value ?? null, observationsUsed: 0 });
      continue;
    }
    const first = vals[idx];
    const changePct = first.value === 0 ? null : ((last.value - first.value) / Math.abs(first.value)) * 100;
    out.push({ window: label, label, changePct, startValue: first.value, endValue: last.value, observationsUsed: n });
  }
  return out;
}

export type TrendState = "up" | "down" | "sideways";

export const TREND_BAND_PCT = 1.5;
export const TREND_WINDOW = 20;

export interface TrendResult {
  state: TrendState;
  changePct: number | null;
  window: number;
  band: number;
  label: string;
  explanation: string;
}

/** 明确规则的趋势判断 */
export function trendState(obs: Observation[], opts: { window?: number; bandPct?: number } = {}): TrendResult {
  const window = opts.window ?? TREND_WINDOW;
  const band = opts.bandPct ?? TREND_BAND_PCT;
  const vals = validValues(obs);
  const n = Math.min(window, vals.length);
  if (n < 2) {
    return { state: "sideways", changePct: null, window, band, label: "震荡", explanation: "数据不足, 无法判断趋势" };
  }
  const last = vals[vals.length - 1].value;
  const first = vals[vals.length - 1 - (n - 1)].value;
  const changePct = first === 0 ? null : ((last - first) / Math.abs(first)) * 100;
  let state: TrendState = "sideways";
  if (changePct !== null && changePct >= band) state = "up";
  else if (changePct !== null && changePct <= -band) state = "down";
  const label = state === "up" ? "上升" : state === "down" ? "下降" : "震荡";
  const explanation = `规则: 最近 ${n} 个有效观测收益率 ${
    changePct === null ? "无法计算" : `${changePct.toFixed(2)}%`
  }, 阈值 ±${band}% → ${label}`;
  return { state, changePct, window: n, band, label, explanation };
}

export interface YearPosition {
  percentile: number | null; // 0-100, 当前值在近一年中的位置
  label: "高位" | "中位" | "低位" | "数据不足";
  explanation: string;
}

/** 当前值在近一年(252 个观测)中的分位位置 */
export function yearPosition(obs: Observation[]): YearPosition {
  const vals = validValues(obs);
  const window = Math.min(252, vals.length);
  if (window < 20) {
    return { percentile: null, label: "数据不足", explanation: "近一年数据不足, 无法计算位置" };
  }
  const slice = vals.slice(-window);
  const current = slice[slice.length - 1].value;
  const sorted = slice.map((v) => v.value).sort((a, b) => a - b);
  let below = 0;
  for (const v of sorted) if (v <= current) below++;
  const percentile = (below / sorted.length) * 100;
  const label: YearPosition["label"] = percentile >= 80 ? "高位" : percentile <= 20 ? "低位" : "中位";
  const explanation = `规则: 当前值位于近一年 ${percentile.toFixed(0)}% 分位 (≥80% 高位, ≤20% 低位)`;
  return { percentile, label, explanation };
}

/** 最近一次变化(绝对值与百分比) */
export function latestChange(obs: Observation[]): { value: number; change: number | null; changePct: number | null; prevValue: number | null } {
  const vals = validValues(obs);
  const last = vals[vals.length - 1];
  const prev = vals[vals.length - 2];
  if (!last) return { value: NaN, change: null, changePct: null, prevValue: null };
  if (!prev) return { value: last.value, change: null, changePct: null, prevValue: null };
  const change = last.value - prev.value;
  const changePct = prev.value === 0 ? null : (change / Math.abs(prev.value)) * 100;
  return { value: last.value, change, changePct, prevValue: prev.value };
}

/** 区间合计(用于资金流等可加总序列) */
export function sumRange(obs: Observation[], lastN: number): number | null {
  const vals = validValues(obs);
  if (vals.length === 0) return null;
  const slice = vals.slice(-lastN);
  return slice.reduce((a, b) => a + b.value, 0);
}
