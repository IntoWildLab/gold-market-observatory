/**
 * 中国投资者视角 —— 国际黄金 → 人民币汇率 → 国内黄金 → 国内ETF 的映射观察
 *
 * 核心原则:
 * - 解释必须来自明确规则, 不使用 AI 黑箱自由归因;
 * - 汇率影响只作为"解释框架", 不写成严格数学等式, 不使用绝对因果;
 * - 理论折算价仅作为研究参考, 明确标注, 不做伪实时价差。
 */

import type { Observation } from "@/types";
import { validValues } from "./indicators/returns";

/** 1 金衡盎司 = 31.1034768 克 */
export const TROY_OZ_GRAMS = 31.1034768;

export interface PeriodChange {
  label: string;
  changePct: number | null;
}

export interface ChinaComparison {
  gold: PeriodChange[];
  au99: PeriodChange[];
  usdcny: PeriodChange[];
  /** 由规则生成的克制解释 */
  explanation: string;
  ruleText: string;
}

/**
 * 国际 vs 国内对比: 计算三个序列在 5D/20D/60D 的收益率, 并按明确规则生成解释。
 */
export function computeChinaComparison(
  goldObs: Observation[],
  au99Obs: Observation[],
  usdcnyObs: Observation[],
): ChinaComparison {
  const rets = (obs: Observation[], n: number) => {
    const vals = validValues(obs);
    if (vals.length < n + 1) return null;
    const last = vals[vals.length - 1].value;
    const first = vals[vals.length - 1 - n].value;
    return first === 0 ? null : ((last - first) / Math.abs(first)) * 100;
  };

  const gold = ["5D", "20D", "60D"].map((label) => ({ label, changePct: rets(goldObs, { "5D": 5, "20D": 20, "60D": 60 }[label]!) }));
  const au99 = ["5D", "20D", "60D"].map((label) => ({ label, changePct: rets(au99Obs, { "5D": 5, "20D": 20, "60D": 60 }[label]!) }));
  const usdcny = ["5D", "20D", "60D"].map((label) => ({ label, changePct: rets(usdcnyObs, { "5D": 5, "20D": 20, "60D": 60 }[label]!) }));

  const explanation = buildExplanation(gold, au99, usdcny);

  return {
    gold,
    au99,
    usdcny,
    explanation,
    ruleText:
      "解释规则: 以近20日涨跌幅对比为基础。人民币相对美元走弱(USD/CNY 上升)可能对人民币计价黄金形成额外支撑, 走强则可能部分抵消国际金价变化; 汇率变化很小时, 国内外涨跌幅差异主要由国内供需/溢价/交易时段解释。仅作观察框架, 不构成因果断言。",
  };
}

function buildExplanation(gold: PeriodChange[], au99: PeriodChange[], usdcny: PeriodChange[]): string {
  const g = gold.find((x) => x.label === "20D")?.changePct ?? null;
  const a = au99.find((x) => x.label === "20D")?.changePct ?? null;
  const c = usdcny.find((x) => x.label === "20D")?.changePct ?? null;
  if (g === null || a === null || c === null) {
    return "近20日数据不足, 暂无法生成国内外对比解释。";
  }
  const fmt = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  const gDir = g >= 0 ? "上涨" : "下跌";
  const parts: string[] = [];
  parts.push(`国际黄金近20日${gDir}${fmt(g)}，国内 Au99.99 近20日${a >= 0 ? "上涨" : "下跌"}${fmt(a)}。`);

  if (c > 0.1) {
    parts.push(`同期人民币相对美元走弱(USD/CNY ${fmt(c)})，可能对人民币计价黄金形成额外支撑。`);
    if (a > g + 0.1) parts.push(`国内金价涨幅高于国际金价，与此框架一致。`);
    else if (a < g - 0.1) parts.push(`但国内金价涨幅低于国际金价，说明国内供需/溢价/交易时段等其他因素影响更明显。`);
    else parts.push(`国内外涨幅接近，汇率影响并不突出。`);
  } else if (c < -0.1) {
    parts.push(`同期人民币相对美元走强(USD/CNY ${fmt(c)})，可能部分抵消国际金价变化对人民币金价的影响。`);
    if (a < g - 0.1) parts.push(`国内金价涨幅低于国际金价，与此框架一致。`);
    else if (a > g + 0.1) parts.push(`但国内金价涨幅仍高于国际金价，说明国内自身因素影响更明显。`);
    else parts.push(`国内外涨幅接近，汇率影响有限。`);
  } else {
    parts.push(`同期人民币汇率变化较小(USD/CNY ${fmt(c)})，国内外涨跌幅差异主要由国内市场自身因素(供需/溢价/交易时段)解释。`);
  }
  parts.push(`注意: 以上仅为解释框架(相关观察)，不构成因果断言，也不构成投资建议。`);
  return parts.join("");
}

// ---------- 人民币黄金理论折算参考价 ----------

export interface TheoreticalPoint {
  date: string;
  /** 国际黄金 (USD/oz, LBMA 定盘) */
  goldUsd: number;
  /** USD/CNY (FRED H.10) */
  usdcny: number;
  /** 理论折算 (CNY/g) */
  theoretical: number;
  /** 当日 Au99.99 (CNY/g, 上海交易日才有) */
  au99: number | null;
  /** 国内溢价/折价 (CNY/g) */
  premiumCny: number | null;
  /** 国内溢价/折价 (%) */
  premiumPct: number | null;
}

export interface TheoreticalResult {
  points: TheoreticalPoint[];
  latest: TheoreticalPoint | null;
  caveat: string;
}

/**
 * 构建"国际黄金人民币理论折算参考价"序列(日度对齐)。
 *
 * 时间对齐说明: 三者均为"同一日历日"的日度值, 但交易时段不同
 * (LBMA 伦敦定盘 / H.10 纽约时段 / 上交所上海时段), 且中国节假日
 * 上交所休市。因此该值仅作研究参考, 明确标注, 不做伪实时价差。
 */
export function buildTheoreticalSeries(
  goldObs: Observation[],
  usdcnyObs: Observation[],
  au99Obs: Observation[],
): TheoreticalResult {
  const gold = validValues(goldObs);
  const usdcny = validValues(usdcnyObs);
  const au99 = validValues(au99Obs);
  const au99ByDate = new Map(au99.map((x) => [x.date, x.value]));
  const usdcnyByDate = new Map(usdcny.map((x) => [x.date, x.value]));

  const points: TheoreticalPoint[] = [];
  for (const g of gold) {
    const cny = usdcnyByDate.get(g.date);
    if (cny === undefined || cny === null) continue;
    const theoretical = (g.value * cny) / TROY_OZ_GRAMS;
    const a = au99ByDate.get(g.date) ?? null;
    let premiumCny: number | null = null;
    let premiumPct: number | null = null;
    if (a !== null && theoretical > 0) {
      premiumCny = a - theoretical;
      premiumPct = (a / theoretical - 1) * 100;
    }
    points.push({ date: g.date, goldUsd: g.value, usdcny: cny, theoretical, au99: a, premiumCny, premiumPct });
  }

  const latest = points.length ? points[points.length - 1] : null;
  return {
    points,
    latest,
    caveat:
      "理论折算参考值 = 国际黄金(LBMA 定盘, USD/oz) × USD/CNY(H.10) ÷ 31.1035(克/金衡盎司)。因三个市场交易时段/时区/节假日不同, 该值为日度对齐的研究参考, 不代表 Au99.99 的合理价格; 国内溢价/折价可能受市场供需、交易结构、交易时间差与数据时间差影响, 仅作观察工具, 不是套利模型。",
  };
}
