/**
 * 黄金市场综合状态评估
 *
 * 综合状态 = 三个驱动维度(宏观环境 / 资金环境 / 长期结构)的方向汇总,
 * 黄金自身趋势单独展示, 不参与驱动判定(避免循环解释)。
 *
 * 综合判定规则 (明确、可审计):
 *   有利维度数 - 不利维度数 ≥ 2 → 🟢 偏强
 *   = 1 → 🟡 中性
 *   ≤ 0 → 🔴 偏弱
 * (中性维度计 0)
 *
 * 综合描述由模板生成, 非 AI 自由发挥; 页面明确提示不构成投资建议。
 */

import type { SeriesFile, SeriesId } from "@/types";
import {
  assessAll,
  LAYER_LABELS,
  type AssessmentResult,
  type DimensionResult,
  type Layer,
  type MacroVerdict,
  type FlowVerdict,
  type StructureVerdict,
  type TrendVerdict,
} from "./rules";

type SeriesBundle = Record<SeriesId, SeriesFile | null>;

export interface CompositeStatus {
  label: "偏强" | "中性" | "偏弱";
  emoji: "🟢" | "🟡" | "🔴";
  favorableDims: string[];
  unfavorableDims: string[];
  neutralDims: string[];
  favorableCount: number;
  unfavorableCount: number;
  /** 规则生成的克制总结 */
  summary: string;
  ruleText: string;
}

export interface Assessment {
  macro: DimensionResult<MacroVerdict>;
  flow: DimensionResult<FlowVerdict>;
  structure: DimensionResult<StructureVerdict>;
  trend: {
    verdict: TrendVerdict;
    changePct: number | null;
    detail: string;
    ruleText: string;
  };
  composite: CompositeStatus;
  disclaimer: string;
}

export function computeAssessment(series: SeriesBundle): Assessment {
  const r = assessAll(series);

  const dimVerdicts: Array<{ layer: Layer; label: string; favorable: boolean; unfavorable: boolean }> = [
    { layer: "macro", label: LAYER_LABELS.macro, favorable: r.macro.verdict === "偏利多", unfavorable: r.macro.verdict === "偏利空" },
    { layer: "flow", label: LAYER_LABELS.flow, favorable: r.flow.verdict === "偏流入", unfavorable: r.flow.verdict === "偏流出" },
    { layer: "structure", label: LAYER_LABELS.structure, favorable: r.structure.verdict === "偏支持", unfavorable: r.structure.verdict === "偏弱" },
  ];

  const favorableDims = dimVerdicts.filter((d) => d.favorable).map((d) => d.label);
  const unfavorableDims = dimVerdicts.filter((d) => d.unfavorable).map((d) => d.label);
  const neutralDims = dimVerdicts.filter((d) => !d.favorable && !d.unfavorable).map((d) => d.label);
  const favorableCount = favorableDims.length;
  const unfavorableCount = unfavorableDims.length;
  const net = favorableCount - unfavorableCount;

  let label: CompositeStatus["label"];
  let emoji: CompositeStatus["emoji"];
  if (net >= 2) {
    label = "偏强";
    emoji = "🟢";
  } else if (net <= 0) {
    label = "偏弱";
    emoji = "🔴";
  } else {
    label = "中性";
    emoji = "🟡";
  }

  // 综合描述模板(明确规则)
  const trendWord = r.trend.verdict;
  const trendSentence = `黄金自身近20日趋势${trendWord}`;
  let lead: string;
  if (favorableCount === 3) {
    lead = "当前宏观、资金与长期结构均对黄金相对友好";
  } else if (favorableCount === 2) {
    lead = `当前${favorableDims.join("、")}对黄金相对友好, 另一维度方向中性`;
  } else if (favorableCount === 1) {
    lead = `当前仅${favorableDims[0]}对黄金相对友好, 其它维度并不共振`;
  } else {
    lead = "当前三个驱动维度均未处于对黄金有利的方向";
  }
  let extra = "";
  if (unfavorableCount > 0) {
    extra += `; ${unfavorableDims.join("、")}对黄金环境偏不利`;
  }
  let divergence = "";
  if (r.trend.verdict === "下行" && favorableCount >= 2) {
    divergence = "；注意: 黄金自身趋势仍在下行, 短期价格动能与宏观环境存在背离";
  }

  const summary = `${lead}${extra}。${trendSentence}${divergence}。`;

  const composite: CompositeStatus = {
    label,
    emoji,
    favorableDims,
    unfavorableDims,
    neutralDims,
    favorableCount,
    unfavorableCount,
    summary,
    ruleText:
      "综合状态规则: 三个驱动维度(宏观/资金/长期结构)按各自方向计数, 有利-不利 ≥2 → 偏强; =1 → 中性; ≤0 → 偏弱。黄金自身趋势单独展示, 不计入驱动判定。",
  };

  return {
    macro: r.macro,
    flow: r.flow,
    structure: r.structure,
    trend: r.trend,
    composite,
    disclaimer: "该评估仅用于帮助观察不同黄金驱动因素的方向与共振情况, 不构成投资建议。全部判定来自明确规则(见 lib/scoring/rules.ts 与 score.ts), 非 AI 判断。",
  };
}

// ---------- 驱动面板(按层级的行为→含义) ----------

export interface DriverRow {
  layer: Layer;
  layerLabel: string;
  title: string;
  /** 发生了什么, 如 "近5日下降" */
  behavior: string;
  /** → 含义, 如 "对黄金环境偏利多" */
  implication: string;
  /** 依据数值 */
  detail: string;
  isConfirmation: boolean;
  stance: "favorable" | "unfavorable" | "confirm" | "neutral" | "insufficient";
}

const trendWord = (v: TrendVerdict) => (v === "上行" ? "上行" : v === "下行" ? "下行" : "震荡");

export function computeDrivers(series: SeriesBundle): DriverRow[] {
  const r = assessAll(series);
  const rows: DriverRow[] = [];

  // 宏观
  for (const c of r.macro.core) {
    const fav = c.favorable;
    rows.push({
      layer: "macro",
      layerLabel: LAYER_LABELS.macro,
      title: c.id === "dxy_5d" ? "美元(代理)" : "10Y实际利率",
      behavior: behaviorText(c, "近5日下降", "近5日上升"),
      implication: fav === true ? "对黄金环境偏利多" : fav === false ? "对黄金环境偏利空" : "中性观察",
      detail: c.detail,
      isConfirmation: false,
      stance: fav === true ? "favorable" : fav === false ? "unfavorable" : "insufficient",
    });
  }
  for (const cf of r.macro.confirmations) {
    rows.push({
      layer: "macro",
      layerLabel: LAYER_LABELS.macro,
      title: "10Y名义收益率",
      behavior: cf.detail.replace(/^变化/, "近5日变化"),
      implication: cf.note,
      detail: cf.detail,
      isConfirmation: true,
      stance: cf.agrees === true ? "confirm" : cf.agrees === false ? "neutral" : "insufficient",
    });
  }

  // 资金
  for (const c of r.flow.core) {
    rows.push({
      layer: "flow",
      layerLabel: LAYER_LABELS.flow,
      title: "全球黄金ETF",
      behavior: r.flow.verdict === "偏流入" ? "近4周净流入" : r.flow.verdict === "偏流出" ? "近4周净流出" : "近4周基本持平",
      implication: r.flow.verdict === "偏流入" ? "投资资金近期整体偏流入" : r.flow.verdict === "偏流出" ? "投资资金近期整体偏流出" : "资金方向中性",
      detail: c.detail,
      isConfirmation: false,
      stance: r.flow.verdict === "偏流入" ? "favorable" : r.flow.verdict === "偏流出" ? "unfavorable" : "insufficient",
    });
  }
  for (const cf of r.flow.confirmations) {
    rows.push({
      layer: "flow",
      layerLabel: LAYER_LABELS.flow,
      title: "GLD(代表性ETF)",
      behavior: cf.detail.replace(/^近20日变化/, "近20日持仓变化"),
      implication: cf.note,
      detail: cf.detail,
      isConfirmation: true,
      stance: cf.agrees === true ? "confirm" : cf.agrees === false ? "neutral" : "insufficient",
    });
  }

  // 长期结构
  for (const c of r.structure.core) {
    const fav = c.favorable;
    rows.push({
      layer: "structure",
      layerLabel: LAYER_LABELS.structure,
      title: c.id === "cb_quarter" ? "全球央行" : "中国央行",
      behavior: c.id === "cb_quarter" ? (fav === true ? "最近季度保持净购买" : fav === false ? "最近季度净卖出" : "数据不足") : fav === true ? "最近公布季度增持" : fav === false ? "最近公布季度减持" : "数据不足",
      implication:
        c.id === "cb_quarter"
          ? fav === true
            ? "中长期官方需求仍有支撑"
            : fav === false
              ? "中长期官方需求减弱"
              : "数据不足, 无法判断"
          : fav === true
            ? "中国官方黄金配置趋势参考: 增持"
            : fav === false
              ? "中国官方黄金配置趋势参考: 减持"
              : "数据不足, 无法判断",
      detail: c.detail,
      isConfirmation: false,
      stance: fav === true ? "favorable" : fav === false ? "unfavorable" : "insufficient",
    });
  }

  // 黄金趋势(单独展示)
  rows.push({
    layer: "trend",
    layerLabel: LAYER_LABELS.trend,
    title: "黄金价格(近20日)",
    behavior: trendWord(r.trend.verdict),
    implication: "黄金自身价格趋势, 单独展示, 不参与驱动判定",
    detail: r.trend.detail,
    isConfirmation: false,
    stance: r.trend.verdict === "上行" ? "favorable" : r.trend.verdict === "下行" ? "unfavorable" : "neutral",
  });

  return rows;
}

/** 由方向生成行为短语, 例如 "近5日下降"/"近5日上升"/"数据不足" */
function behaviorText(c: { favorable: boolean | null }, down: string, up: string): string {
  if (c.favorable === null) return "数据不足";
  return c.favorable ? down : up;
}
