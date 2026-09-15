import type { SeriesFile, SeriesId } from "@/types";
import { validValues } from "./indicators/returns";
import type { EventRiskView } from "./event-risk-view";

type SeriesBundle = Record<SeriesId, SeriesFile | null>;

export type WhatChangedAvailability = "available" | "partial" | "insufficient";
export type ChangeDirection = "up" | "down" | "neutral";
export type WhatChangedTone = "support" | "pressure" | "neutral" | "caution";

export interface WhatChangedEvidence {
  id: "real_yield" | "dxy" | "nominal_yield";
  label: string;
  direction: ChangeDirection;
  change: number;
  unit: "bp" | "%";
  window: "近5个有效观测";
  startDate: string;
  endDate: string;
  auxiliary: boolean;
  stale: boolean;
}

export interface WhatChangedView {
  availability: WhatChangedAvailability;
  goldMove: {
    direction: ChangeDirection;
    changePct: number | null;
    window: "近1日";
    endDate: string | null;
    description: string;
  };
  environment: {
    label: string;
    tone: WhatChangedTone;
    explanation: string;
    stale: boolean;
  };
  evidence: WhatChangedEvidence[];
  nextWatch:
    | { kind: "event"; label: string; scheduledAt: string; hoursUntil: number; direction: "unknown" }
    | { kind: "observation"; label: string };
  disclaimer: string;
}

/**
 * V0.1 fixed neutral bands. A 2026-09-15 read-only audit of the latest 252
 * observations found absolute-change quartiles of about 0.46% for gold 1D,
 * 0.18% for DXY 5D, and 2bp for 10Y yields 5D. These deliberately simple
 * bands suppress tiny moves without turning the rule layer into a model.
 */
export const WHAT_CHANGED_THRESHOLDS = {
  goldDailyPct: 0.3,
  dxyFiveObservationPct: 0.2,
  yieldFiveObservationBp: 3,
  macroMaxLagCalendarDays: 4,
} as const;

const DISCLAIMER = "基于已发生的数据变化归纳，不是价格预测或交易建议。";
const MACRO_WINDOW = "近5个有效观测" as const;

interface WindowChange {
  direction: ChangeDirection;
  change: number;
  startDate: string;
  endDate: string;
}

function direction(value: number, neutralBand: number): ChangeDirection {
  if (value >= neutralBand) return "up";
  if (value <= -neutralBand) return "down";
  return "neutral";
}

function percentageWindow(series: SeriesFile | null, intervals: number, band: number): WindowChange | null {
  const values = validValues(series?.observations ?? []);
  if (values.length <= intervals) return null;
  const first = values[values.length - 1 - intervals];
  const last = values[values.length - 1];
  if (first.value === 0) return null;
  const change = ((last.value - first.value) / Math.abs(first.value)) * 100;
  return { direction: direction(change, band), change, startDate: first.date, endDate: last.date };
}

function yieldWindow(series: SeriesFile | null, intervals: number): WindowChange | null {
  const values = validValues(series?.observations ?? []);
  if (values.length <= intervals) return null;
  const first = values[values.length - 1 - intervals];
  const last = values[values.length - 1];
  const change = (last.value - first.value) * 100;
  return {
    direction: direction(change, WHAT_CHANGED_THRESHOLDS.yieldFiveObservationBp),
    change,
    startDate: first.date,
    endDate: last.date,
  };
}

function calendarLagDays(anchorDate: string, evidenceDate: string): number {
  const anchor = Date.parse(`${anchorDate}T00:00:00Z`);
  const evidence = Date.parse(`${evidenceDate}T00:00:00Z`);
  if (!Number.isFinite(anchor) || !Number.isFinite(evidence)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((anchor - evidence) / 86_400_000));
}

function environmentFor(
  gold: ChangeDirection,
  real: ChangeDirection,
  dxy: ChangeDirection,
): Pick<WhatChangedView["environment"], "label" | "tone" | "explanation"> {
  if (gold === "neutral") {
    return {
      label: "黄金变化有限",
      tone: "neutral",
      explanation: "黄金近1日仍在中性阈值内，暂不根据小幅波动强行归因。",
    };
  }

  const realSupports = (gold === "down" && real === "up") || (gold === "up" && real === "down");
  const dxySupports = (gold === "down" && dxy === "up") || (gold === "up" && dxy === "down");
  const supportWord = gold === "up" ? "支持" : "施压";
  const tone: WhatChangedTone = gold === "up" ? "support" : "pressure";

  if (realSupports && dxySupports) {
    return {
      label: gold === "up" ? "利率与美元环境共同支持" : "利率与美元共同施压",
      tone,
      explanation: `实际利率与美元的变化方向同时与黄金${gold === "up" ? "走强" : "走弱"}并存，当前数据更符合两项宏观因素共同${supportWord}的环境。`,
    };
  }
  if (realSupports) {
    return {
      label: gold === "up" ? "利率环境提供支持" : "利率压力更明显",
      tone,
      explanation: `实际利率变化与黄金${gold === "up" ? "走强" : "走弱"}同时出现，美元证据未形成同等强度的确认。`,
    };
  }
  if (dxySupports) {
    return {
      label: gold === "up" ? "美元环境提供支持" : "美元压力更明显",
      tone,
      explanation: `美元变化与黄金${gold === "up" ? "走强" : "走弱"}同时出现，实际利率证据未形成同等强度的确认。`,
    };
  }
  return {
    label: "黄金变化明显，但宏观证据分化",
    tone: "caution",
    explanation: "当前已有宏观指标没有形成支持这一变化的方向，暂不强行归因。",
  };
}

function fallbackWatch(real: ChangeDirection | null, dxy: ChangeDirection | null): string {
  if (real === "up" && dxy === "up") return "下一步观察：实际利率和美元是否继续同步走强。";
  if (real === "down" && dxy === "down") return "下一步观察：实际利率和美元是否继续同步走弱。";
  if (real === null || dxy === null) return "下一步观察：实际利率与美元数据是否恢复完整。";
  return "下一步观察：实际利率与美元是否重新形成一致方向。";
}

function eventOrFallback(
  eventRisk: EventRiskView,
  now: Date,
  real: ChangeDirection | null,
  dxy: ChangeDirection | null,
): WhatChangedView["nextWatch"] {
  const event = eventRisk.nearestEvent;
  if ((eventRisk.availability === "available" || eventRisk.availability === "partial") && event) {
    const milliseconds = Date.parse(event.scheduledAt) - now.getTime();
    return {
      kind: "event",
      label: event.title,
      scheduledAt: event.scheduledAt,
      hoursUntil: Math.max(0, Math.ceil(milliseconds / 3_600_000)),
      direction: "unknown",
    };
  }
  return { kind: "observation", label: fallbackWatch(real, dxy) };
}

export function buildWhatChanged(
  series: SeriesBundle,
  eventRisk: EventRiskView,
  now: Date,
): WhatChangedView {
  const goldValues = validValues(series.gold_price?.observations ?? []);
  const goldLast = goldValues.at(-1);
  const goldPrev = goldValues.at(-2);
  if (!goldLast || !goldPrev || goldPrev.value === 0) {
    return {
      availability: "insufficient",
      goldMove: { direction: "neutral", changePct: null, window: "近1日", endDate: goldLast?.date ?? null, description: "当前变化数据不足" },
      environment: { label: "宏观证据暂不完整", tone: "neutral", explanation: "黄金价格缺少两个有效观测，无法计算近1日变化。", stale: false },
      evidence: [],
      nextWatch: eventOrFallback(eventRisk, now, null, null),
      disclaimer: DISCLAIMER,
    };
  }

  const goldChangePct = ((goldLast.value - goldPrev.value) / Math.abs(goldPrev.value)) * 100;
  const goldDirection = direction(goldChangePct, WHAT_CHANGED_THRESHOLDS.goldDailyPct);
  const real = yieldWindow(series.us10y_real, 5);
  const dxy = percentageWindow(series.dxy_proxy, 5, WHAT_CHANGED_THRESHOLDS.dxyFiveObservationPct);
  const nominal = yieldWindow(series.us10y_nominal, 5);
  const coreMissing = !real || !dxy;
  const isStale = (change: WindowChange | null) => Boolean(change && calendarLagDays(goldLast.date, change.endDate) > WHAT_CHANGED_THRESHOLDS.macroMaxLagCalendarDays);
  const realStale = isStale(real);
  const dxyStale = isStale(dxy);
  const macroStale = realStale || dxyStale;
  const evidence: WhatChangedEvidence[] = [];

  if (real) evidence.push({ id: "real_yield", label: "10Y 实际利率", ...real, unit: "bp", window: MACRO_WINDOW, auxiliary: false, stale: realStale });
  if (dxy) evidence.push({ id: "dxy", label: "美元指数代理", ...dxy, unit: "%", window: MACRO_WINDOW, auxiliary: false, stale: dxyStale });
  if (nominal) evidence.push({ id: "nominal_yield", label: "10Y 名义收益率", ...nominal, unit: "bp", window: MACRO_WINDOW, auxiliary: true, stale: isStale(nominal) });

  let environment: WhatChangedView["environment"];
  if (coreMissing) {
    environment = {
      label: "宏观证据暂不完整",
      tone: "neutral",
      explanation: "实际利率或美元指数代理缺少足够的有效观测，仅保留可确认的黄金变化事实。",
      stale: false,
    };
  } else if (macroStale) {
    environment = {
      label: "宏观证据更新较慢",
      tone: "caution",
      explanation: "部分宏观证据的数据日明显早于黄金数据日，当前环境解释强度已降低。",
      stale: true,
    };
  } else {
    environment = { ...environmentFor(goldDirection, real.direction, dxy.direction), stale: false };
  }

  return {
    availability: coreMissing || macroStale ? "partial" : "available",
    goldMove: {
      direction: goldDirection,
      changePct: goldChangePct,
      window: "近1日",
      endDate: goldLast.date,
      description: goldDirection === "up" ? "黄金短期走强" : goldDirection === "down" ? "黄金短期走弱" : "黄金变化有限",
    },
    environment,
    evidence,
    nextWatch: eventOrFallback(eventRisk, now, real?.direction ?? null, dxy?.direction ?? null),
    disclaimer: DISCLAIMER,
  };
}
