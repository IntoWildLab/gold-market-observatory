"use client";

import { useState } from "react";
import type { Assessment } from "@/lib/scoring/score";
import type { MacroVerdict, FlowVerdict, StructureVerdict, TrendVerdict } from "@/lib/scoring/rules";

function verdictColor(kind: "macro" | "flow" | "structure" | "trend", verdict: string): string {
  const favorable = ["偏利多", "偏流入", "偏支持"].includes(verdict);
  const unfavorable = ["偏利空", "偏流出", "偏弱"].includes(verdict);
  if (kind === "trend") {
    // 趋势用价格涨跌色(中国习惯: 红涨绿跌)
    if (verdict === "上行") return "bg-rose-500/15 text-rose-400 border-rose-500/40";
    if (verdict === "下行") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/40";
    return "bg-neutral-500/15 text-neutral-300 border-neutral-500/40";
  }
  if (favorable) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/40";
  if (unfavorable) return "bg-rose-500/15 text-rose-400 border-rose-500/40";
  return "bg-neutral-500/15 text-neutral-300 border-neutral-500/40";
}

function verdictTextColor(kind: "macro" | "flow" | "structure" | "trend", verdict: string): string {
  const favorable = ["偏利多", "偏流入", "偏支持"].includes(verdict);
  const unfavorable = ["偏利空", "偏流出", "偏弱"].includes(verdict);
  if (kind === "trend") {
    if (verdict === "上行") return "text-rose-400";
    if (verdict === "下行") return "text-emerald-400";
    return "text-neutral-300";
  }
  if (favorable) return "text-emerald-400";
  if (unfavorable) return "text-rose-400";
  return "text-neutral-300";
}

export default function TemperatureCard({ temp }: { temp: Assessment }) {
  const [showDetail, setShowDetail] = useState(false);
  const composite = temp.composite;

  const dims = [
    { key: "macro" as const, label: "宏观环境", timeScale: temp.macro.timeScale, verdict: temp.macro.verdict, ruleText: temp.macro.ruleText, core: temp.macro.core, confirmations: temp.macro.confirmations },
    { key: "flow" as const, label: "资金环境", timeScale: temp.flow.timeScale, verdict: temp.flow.verdict, ruleText: temp.flow.ruleText, core: temp.flow.core, confirmations: temp.flow.confirmations },
    { key: "structure" as const, label: "长期结构", timeScale: temp.structure.timeScale, verdict: temp.structure.verdict, ruleText: temp.structure.ruleText, core: temp.structure.core, confirmations: temp.structure.confirmations },
    { key: "trend" as const, label: "黄金趋势", timeScale: "近20个交易日", verdict: temp.trend.verdict, ruleText: temp.trend.ruleText, core: [{ id: "trend", label: "黄金价格(近20日)", detail: temp.trend.detail, favorable: temp.trend.verdict === "上行" ? true : temp.trend.verdict === "下行" ? false : null }], confirmations: [] },
  ] as Array<{
    key: "macro" | "flow" | "structure" | "trend";
    label: string;
    timeScale: string;
    verdict: MacroVerdict | FlowVerdict | StructureVerdict | TrendVerdict;
    ruleText: string;
    core: Array<{ id: string; label: string; detail: string; favorable: boolean | null }>;
    confirmations: Array<{ id: string; label: string; detail: string; agrees: boolean | null; note: string }>;
  }>;

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">黄金市场温度</h2>
        <button
          type="button"
          onClick={() => setShowDetail((v) => !v)}
          className="text-[11px] text-sky-400 hover:underline"
        >
          {showDetail ? "收起判定依据 ▲" : "查看为什么得到这个判定 ▼"}
        </button>
      </div>

      {/* 综合状态 */}
      <div className="mt-3 flex items-center gap-3 rounded border border-[#2d333b] bg-[#0d1117]/60 p-3">
        <div className={`text-2xl font-bold ${composite.emoji === "🟢" ? "text-emerald-400" : composite.emoji === "🔴" ? "text-rose-400" : "text-amber-400"}`}>
          {composite.emoji} {composite.label}
        </div>
        <p className="flex-1 text-xs leading-relaxed text-[#c9d1d9]">{composite.summary}</p>
      </div>

      {/* 四维度判定 */}
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {dims.map((d) => (
          <div key={d.key} className="rounded border border-[#2d333b] bg-[#0d1117]/60 p-2.5 text-center">
            <div className="text-[10px] text-[#8b949e]">{d.label}</div>
            <div className={`mt-1 inline-block rounded border px-2 py-0.5 text-sm font-semibold ${verdictColor(d.key, d.verdict)}`}>
              {d.verdict}
            </div>
            <div className="mt-1 text-[9px] text-[#8b949e]">观察: {d.timeScale}</div>
          </div>
        ))}
      </div>

      <p className="mt-3 border-t border-[#2d333b] pt-2 text-[11px] text-[#8b949e]">
        ⚠️ {temp.disclaimer} 综合状态不是简单看涨/看跌, 而是三个驱动维度方向的共振观察。
      </p>

      {showDetail && (
        <div className="mt-3 space-y-4 border-t border-[#2d333b] pt-3">
          {dims.map((d) => (
            <div key={d.key}>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-semibold text-[#c9d1d9]">
                  {d.label}:{" "}
                  <span className={verdictTextColor(d.key, d.verdict)}>{d.verdict}</span>
                </span>
                <span className="text-[10px] text-[#8b949e]">({d.timeScale})</span>
              </div>
              <div className="mb-1.5 text-[11px] text-[#8b949e]">{d.ruleText}</div>
              <div className="space-y-1">
                {d.core.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 text-xs">
                    <span className={`mt-0.5 shrink-0 ${c.favorable === true ? "text-emerald-400" : c.favorable === false ? "text-rose-400" : "text-neutral-500"}`}>
                      {c.favorable === true ? "✔" : c.favorable === false ? "✘" : "·"}
                    </span>
                    <div>
                      <span className="text-[#c9d1d9]">{c.label}</span>
                      <span className="num ml-2 text-[#8b949e]">{c.detail}</span>
                    </div>
                  </div>
                ))}
                {d.confirmations.map((cf) => (
                  <div key={cf.id} className="flex items-start gap-2 text-xs">
                    <span className={`mt-0.5 shrink-0 ${cf.agrees === true ? "text-sky-400" : cf.agrees === false ? "text-amber-400" : "text-neutral-500"}`}>
                      {cf.agrees === true ? "◉" : cf.agrees === false ? "◌" : "·"}
                    </span>
                    <div>
                      <span className="text-[#c9d1d9]">
                        {cf.label} <span className="text-[10px] text-sky-400">(辅助确认, 不投票)</span>
                      </span>
                      <span className="num ml-2 text-[#8b949e]">{cf.detail}</span>
                      <span className="ml-2 text-[10px] text-[#8b949e]">{cf.note}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[11px] text-[#8b949e]">
            {composite.ruleText} 综合描述由规则模板生成, 非 AI 判断。
          </p>
        </div>
      )}
    </div>
  );
}
