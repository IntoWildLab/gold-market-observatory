"use client";

import { useState } from "react";
import type { DriverRow } from "@/lib/scoring/score";
import type { Layer } from "@/lib/scoring/rules";

const LAYER_ORDER: Layer[] = ["macro", "flow", "structure", "trend"];
const LAYER_LABEL: Record<Layer, string> = { macro: "宏观环境", flow: "资金环境", structure: "长期结构", trend: "黄金趋势" };

function stanceBadge(r: DriverRow): { text: string; cls: string } {
  switch (r.stance) {
    case "favorable":
      return { text: "利多", cls: "bg-emerald-500/15 text-emerald-400" };
    case "unfavorable":
      return { text: "利空", cls: "bg-rose-500/15 text-rose-400" };
    case "confirm":
      return { text: "确认", cls: "bg-sky-500/15 text-sky-400" };
    case "neutral":
      return { text: "中性", cls: "bg-neutral-500/15 text-neutral-300" };
    default:
      return { text: "数据不足", cls: "bg-neutral-500/15 text-neutral-400" };
  }
}

interface Props {
  drivers: DriverRow[];
  /** 综合状态(克制总结) */
  summary: string;
  compositeLabel: string;
  compositeEmoji: string;
}

export default function DriverPanel({ drivers, summary, compositeLabel, compositeEmoji }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const rowsByLayer = LAYER_ORDER.map((layer) => ({ layer, rows: drivers.filter((d) => d.layer === layer) }));

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">黄金驱动面板</h2>
        <span className="text-[10px] text-[#8b949e]">按层级解释目前发生了什么 · 规则见 lib/scoring/rules.ts</span>
      </div>
      <p className="panel-sub mb-3">
        每个维度说明"发生了什么 → 对黄金环境意味着什么"。名义收益率与 GLD 仅为辅助确认, 不独立计分; 黄金趋势单独展示。
      </p>

      <div className="space-y-4">
        {rowsByLayer.map(({ layer, rows }) => (
          <div key={layer}>
            <div className="mb-1.5 text-xs font-semibold text-[#8b949e]">
              {LAYER_LABEL[layer]}
              {layer === "trend" && <span className="ml-1.5 text-[10px] text-[#8b949e]">(单独展示, 不参与驱动判定)</span>}
            </div>
            <div className="space-y-1.5">
              {rows.map((r) => {
                const badge = stanceBadge(r);
                return (
                  <div key={r.layer + r.title} className="rounded border border-[#2d333b] bg-[#0d1117]/60">
                    <button
                      type="button"
                      onClick={() => setOpen(open === r.layer + r.title ? null : r.layer + r.title)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                    >
                      <span className={`inline-flex w-14 shrink-0 items-center justify-center rounded px-1 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                        {badge.text}
                      </span>
                      <span className="w-28 shrink-0 text-[#e6edf3]">{r.title}:</span>
                      <span className="flex-1 text-[#c9d1d9]">
                        {r.behavior}
                        {r.isConfirmation && <span className="ml-1 text-[10px] text-sky-400">(辅助确认)</span>}
                      </span>
                      <span className="text-[10px] text-[#8b949e]">{open === r.layer + r.title ? "收起 ▲" : "展开 ▼"}</span>
                    </button>
                    <div className="flex items-start gap-2 px-3 pb-2 text-xs">
                      <span className="text-[#8b949e]">→ {r.implication}</span>
                      <span className="num text-[10px] text-[#8b949e]">依据: {r.detail}</span>
                    </div>
                    {open === r.layer + r.title && (
                      <div className="border-t border-[#2d333b] px-3 py-2 text-[11px] leading-relaxed text-[#8b949e]">
                        观察时间尺度: {layer === "macro" ? "近5个交易日" : layer === "flow" ? "近4周 / 近20交易日" : layer === "structure" ? "季度(最近公布), 不解释当日行情" : "近20个交易日"}。
                        {r.isConfirmation ? "本行为辅助确认指标, 仅用于与核心指标交叉验证, 不独立投票。" : "本行为核心观察指标。"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 克制总结 */}
      <div className="mt-4 rounded border border-[#2d333b] bg-[#0d1117]/60 p-3">
        <div className="mb-1 text-[11px] font-semibold text-[#8b949e]">
          综合状态: <span className={compositeEmoji === "🟢" ? "text-emerald-400" : compositeEmoji === "🔴" ? "text-rose-400" : "text-amber-400"}>{compositeEmoji} {compositeLabel}</span>
        </div>
        <p className="text-xs leading-relaxed text-[#c9d1d9]">{summary}</p>
        <p className="mt-1.5 text-[10px] text-[#8b949e]">
          以上仅为驱动因素的方向观察, 不构成"黄金必然上涨/下跌"等投资判断。
        </p>
      </div>
    </div>
  );
}
