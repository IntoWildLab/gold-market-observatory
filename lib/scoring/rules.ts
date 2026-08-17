/**
 * 黄金市场评估规则引擎 v2 —— 结构性重构
 *
 * 设计目标 (本轮优化):
 * 1. 取消"8 条规则各 +1 → 8/8 满分"的等权累加模式, 改为四维度判定:
 *      宏观环境 / 资金环境 / 长期结构 / 黄金趋势
 * 2. 消除相关指标重复计分:
 *      - 10Y 实际利率为宏观核心, 10Y 名义收益率降为"辅助确认"(不独立投票)
 *      - 全球黄金 ETF 为资金核心, GLD 降为"代表性 ETF 辅助确认"(不独立投票)
 *      - 黄金自身趋势单独展示, 不作为驱动因素投票(避免"因为黄金涨所以环境强"的循环解释)
 * 3. 明确时间尺度:
 *      - 宏观环境: 近5个观测(交易日)
 *      - 资金环境: 近4周(全球ETF) / 近20个交易日(GLD确认)
 *      - 长期结构: 季度(最近公布), 仅用于中长期需求观察, 不解释当日行情
 *      - 黄金趋势: 近20个有效观测
 *
 * 所有判定均来自下面的明确规则, 不是 AI 判断。
 */

import type { SeriesFile, SeriesId } from "@/types";
import { validValues, trendState, sumRange } from "@/lib/indicators/returns";

export type Layer = "macro" | "flow" | "structure" | "trend";
export type MacroVerdict = "偏利多" | "中性" | "偏利空";
export type FlowVerdict = "偏流入" | "中性" | "偏流出";
export type StructureVerdict = "偏支持" | "中性" | "偏弱";
export type TrendVerdict = "上行" | "震荡" | "下行";

export const LAYER_LABELS: Record<Layer, string> = {
  macro: "宏观环境",
  flow: "资金环境",
  structure: "长期结构",
  trend: "黄金趋势",
};

/** 核心观察行: 决定维度方向的一票 */
export interface EvidenceRow {
  id: string;
  label: string;
  detail: string;
  /** true=对黄金有利; false=不利; null=中性/无法判断 */
  favorable: boolean | null;
}

/** 辅助确认行: 不投票, 只确认或背离核心方向 */
export interface ConfirmationRow {
  id: string;
  label: string;
  detail: string;
  /** true=与核心方向一致(确认); false=背离; null=无法判断 */
  agrees: boolean | null;
  note: string;
}

export interface DimensionResult<T> {
  verdict: T;
  timeScale: string;
  core: EvidenceRow[];
  confirmations: ConfirmationRow[];
  /** 判定规则的文字说明(可读、可审计) */
  ruleText: string;
  /** 数据是否不足(不足时判定为中性并注明) */
  insufficient: boolean;
}

export interface TrendDimension {
  verdict: TrendVerdict;
  changePct: number | null;
  detail: string;
  ruleText: string;
}

export interface AssessmentResult {
  macro: DimensionResult<MacroVerdict>;
  flow: DimensionResult<FlowVerdict>;
  structure: DimensionResult<StructureVerdict>;
  trend: TrendDimension;
}

type SeriesBundle = Record<SeriesId, SeriesFile | null>;

// ---------- 工具 ----------

function last5Change(series: SeriesFile | null): { change: number | null; first: number | null; last: number | null } {
  const vals = validValues(series?.observations ?? []);
  if (vals.length < 6) return { change: null, first: null, last: null };
  const first = vals[vals.length - 6].value;
  const last = vals[vals.length - 1].value;
  return { change: last - first, first, last };
}

const fmt = (v: number, digits = 2) => `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;

// ---------- 1. 宏观环境 ----------

export function assessMacro(s: SeriesBundle): DimensionResult<MacroVerdict> {
  const dxy = last5Change(s.dxy_proxy);
  const real = last5Change(s.us10y_real);
  const nominal = last5Change(s.us10y_nominal);

  const core: EvidenceRow[] = [];
  core.push({
    id: "dxy_5d",
    label: "美元(代理)近5日",
    detail: dxy.change === null ? "数据不足" : `变化 ${fmt(dxy.change)} 点 (${dxy.first!.toFixed(2)} → ${dxy.last!.toFixed(2)})`,
    favorable: dxy.change === null ? null : dxy.change < 0,
  });
  core.push({
    id: "real_5d",
    label: "10Y实际利率近5日",
    detail: real.change === null ? "数据不足" : `变化 ${fmt(real.change, 3)}pp (${real.first!.toFixed(2)}% → ${real.last!.toFixed(2)}%)`,
    favorable: real.change === null ? null : real.change < 0,
  });

  const confirmations: ConfirmationRow[] = [];
  if (nominal.change === null) {
    confirmations.push({ id: "nominal_5d", label: "10Y名义收益率(辅助)", detail: "数据不足", agrees: null, note: "名义收益率数据不足, 无法作辅助确认" });
  } else {
    const realFav = real.change !== null ? real.change < 0 : null;
    const nominalFav = nominal.change < 0;
    const agrees = realFav === null ? null : nominalFav === realFav;
    confirmations.push({
      id: "nominal_5d",
      label: "10Y名义收益率(辅助)",
      detail: `变化 ${fmt(nominal.change, 3)}pp (${nominal.first!.toFixed(2)}% → ${nominal.last!.toFixed(2)}%)`,
      agrees,
      note: agrees === null ? "实际利率数据不足, 名义仅作参考" : agrees ? "方向与实际利率一致, 作为辅助确认" : "方向与实际利率背离(辅助参考, 不改变判定)",
    });
  }

  const bothKnown = dxy.change !== null && real.change !== null;
  const dxyFav = dxy.change !== null && dxy.change < 0;
  const realFav = real.change !== null && real.change < 0;
  let verdict: MacroVerdict;
  let insufficient = false;
  let ruleText =
    "规则: 以美元(代理)与10Y实际利率为两个核心观察(各一票, 近5个观测变化)。两者均下降(对黄金有利) → 偏利多; 方向相反 → 中性; 均上升 → 偏利空; 任一数据不足 → 中性。名义收益率仅作辅助确认, 不投票。";
  if (!bothKnown) {
    verdict = "中性";
    insufficient = true;
    ruleText = "规则: 美元或10Y实际利率数据不足, 宏观判定为中性(数据不足)。名义收益率仅作辅助参考。";
  } else if (dxyFav && realFav) {
    verdict = "偏利多";
  } else if (!dxyFav && !realFav) {
    verdict = "偏利空";
  } else {
    verdict = "中性";
  }

  return {
    verdict,
    timeScale: "近5个交易日",
    core,
    confirmations,
    ruleText,
    insufficient,
  };
}

// ---------- 2. 资金环境 ----------

export function assessFlow(s: SeriesBundle): DimensionResult<FlowVerdict> {
  const flows = validValues(s.gold_etf_flows?.observations ?? []);
  const sum4w = sumRange(s.gold_etf_flows?.observations ?? [], 4);
  const gld = validValues(s.gld_holdings?.observations ?? []);
  const gldChange = gld.length >= 21 ? gld[gld.length - 1].value - gld[gld.length - 21].value : null;

  const core: EvidenceRow[] = [
    {
      id: "etf_4w",
      label: "全球黄金ETF近4周资金流",
      detail: sum4w === null ? "数据不足" : `合计 ${fmt(sum4w, 1)} 吨 (${flows.length ? `最新周 ${fmt(flows[flows.length - 1].value, 1)} 吨 @ ${flows[flows.length - 1].date}` : ""})`,
      favorable: sum4w === null ? null : sum4w > 0,
    },
  ];

  const confirmations: ConfirmationRow[] = [];
  if (gldChange === null) {
    confirmations.push({ id: "gld_20d", label: "GLD持仓(辅助确认)", detail: "数据不足", agrees: null, note: "GLD 数据不足, 无法作辅助确认" });
  } else {
    const gldFav = gldChange > 0;
    const etfFav = sum4w === null ? null : sum4w > 0;
    const agrees = etfFav === null ? null : gldFav === etfFav;
    confirmations.push({
      id: "gld_20d",
      label: "GLD持仓(辅助确认)",
      detail: `近20日变化 ${fmt(gldChange, 1)} 吨 (${gld[gld.length - 21].value.toFixed(1)} → ${gld[gld.length - 1].value.toFixed(1)})`,
      agrees,
      note: agrees === null ? "全球ETF数据不足, GLD仅作参考" : agrees ? "与全球ETF资金方向一致, 作为辅助确认" : "与全球ETF资金方向不一致(辅助参考)",
    });
  }

  let verdict: FlowVerdict;
  let insufficient = false;
  let ruleText =
    "规则: 以全球黄金ETF近4周资金流合计为主判断(>0 偏流入, <0 偏流出, =0/不足 中性)。GLD 为代表性ETF, 仅作辅助确认, 不投票。";
  if (sum4w === null) {
    verdict = "中性";
    insufficient = true;
    ruleText = "规则: 全球ETF近4周资金流数据不足, 资金判定为中性(数据不足)。";
  } else if (sum4w > 0) {
    verdict = "偏流入";
  } else if (sum4w < 0) {
    verdict = "偏流出";
  } else {
    verdict = "中性";
  }

  return {
    verdict,
    timeScale: "近4周(ETF) / 近20交易日(GLD)",
    core,
    confirmations,
    ruleText,
    insufficient,
  };
}

// ---------- 3. 长期结构 ----------

export function assessStructure(s: SeriesBundle): DimensionResult<StructureVerdict> {
  const cb = validValues(s.cb_gold_purchases?.observations ?? []);
  const china = validValues(s.china_gold_reserves?.observations ?? []);

  const cbLast = cb.length ? cb[cb.length - 1] : null;
  const chinaLast = china.length ? china[china.length - 1] : null;
  const chinaPrev = china.length >= 2 ? china[china.length - 2] : null;
  const chinaChange = chinaLast && chinaPrev ? chinaLast.value - chinaPrev.value : null;

  const core: EvidenceRow[] = [
    {
      id: "cb_quarter",
      label: "全球央行最近季度净购买",
      detail: cbLast ? `Q2'26 净购买 ${cbLast.value.toFixed(1)} 吨 (${cbLast.date} 季度末)` : "数据不足",
      favorable: cbLast ? cbLast.value > 0 : null,
    },
    {
      id: "china_quarter",
      label: "中国央行最近季度变化",
      detail: chinaChange === null ? "数据不足" : `${chinaPrev!.date} ${chinaPrev!.value.toFixed(1)} → ${chinaLast!.date} ${chinaLast!.value.toFixed(1)} 吨 (${fmt(chinaChange, 1)} 吨)`,
      favorable: chinaChange === null ? null : chinaChange > 0,
    },
  ];

  const cbFav = cbLast ? cbLast.value > 0 : null;
  const chinaFav = chinaChange === null ? null : chinaChange > 0;
  const votes = [cbFav, chinaFav].filter((v) => v !== null) as boolean[];
  const favorableCount = votes.filter(Boolean).length;

  let verdict: StructureVerdict;
  let insufficient = false;
  let ruleText =
    "规则: 全球央行最近季度净购买与 中国央行最近季度变化 各一票。两票均>0 → 偏支持; 一票 → 中性; 零票 → 偏弱; 数据不足 → 中性。时间尺度为季度, 仅用于中长期需求观察, 不用于解释当日行情。";
  if (votes.length === 0) {
    verdict = "中性";
    insufficient = true;
    ruleText = "规则: 央行数据不足, 长期结构判定为中性(数据不足)。";
  } else if (votes.length === 1) {
    verdict = favorableCount === 1 ? "偏支持" : "偏弱";
    insufficient = true;
    ruleText = `规则: 仅一个维度有数据(${votes.length === 1 ? "另一维度数据不足" : ""}), 按现有数据判定, 数据有限。`;
  } else if (favorableCount === 2) {
    verdict = "偏支持";
  } else if (favorableCount === 0) {
    verdict = "偏弱";
  } else {
    verdict = "中性";
  }

  return {
    verdict,
    timeScale: "季度(最近公布), 12个月以上趋势",
    core,
    confirmations: [],
    ruleText,
    insufficient,
  };
}

// ---------- 4. 黄金趋势(单独展示, 不参与驱动投票) ----------

export function assessTrend(s: SeriesBundle): TrendDimension {
  const tr = trendState(s.gold_price?.observations ?? []);
  const vals = validValues(s.gold_price?.observations ?? []);
  const last = vals.length ? vals[vals.length - 1].value : null;
  const first = vals.length >= tr.window ? vals[vals.length - tr.window].value : null;
  const detail =
    tr.changePct === null
      ? "数据不足, 无法判断趋势"
      : `近${tr.window}个有效观测收益率 ${fmt(tr.changePct)}%${first !== null && last !== null ? ` (${first.toFixed(0)} → ${last.toFixed(0)} USD/oz)` : ""}`;
  return {
    verdict: tr.state === "up" ? "上行" : tr.state === "down" ? "下行" : "震荡",
    changePct: tr.changePct,
    detail,
    ruleText: `规则: 黄金近 ${tr.window} 个有效观测收益率 ≥ +${tr.band}% → 上行; ≤ -${tr.band}% → 下行; 其余 → 震荡。黄金趋势为结果变量, 单独展示, 不参与驱动判定。`,
  };
}

export function assessAll(s: SeriesBundle): AssessmentResult {
  return {
    macro: assessMacro(s),
    flow: assessFlow(s),
    structure: assessStructure(s),
    trend: assessTrend(s),
  };
}
