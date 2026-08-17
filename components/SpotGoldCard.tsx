"use client";

import { fmtPrice, fmtSigned, pnlClass, pnlArrow, fmtDateCn } from "@/lib/format";
import type { PeriodReturn } from "@/lib/indicators/returns";

interface Props {
  spotPrice: number | null;
  spotAsOf: string | null;
  spotTimestamp: string | null;
  spotSource: string;
  crossCheck: { price_usd: number; source: string } | null;
  fixValue: number | null;
  fixDate: string | null;
  dailyChangePct: number | null;
  periodReturns: PeriodReturn[];
  trendLabel: string;
  trendExplanation: string;
  yearPosLabel: string;
  yearPosPercentile: number | null;
  yearPosExplanation: string;
  source: string;
  sourceUrl: string;
}

export default function SpotGoldCard(p: Props) {
  const returns = p.periodReturns;
  const labels: Record<string, string> = { "1D": "当日", "5D": "近5日", "20D": "近20日", "60D": "近60日", "120D": "近120日" };
  return (
    <div className="panel p-4 border-[#d4a72c]/40">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-[#8b949e]">黄金现货 XAU/USD</div>
        <div className="flex gap-1.5">
          <span className="src-tag">实时</span>
          <span className="src-tag">LBMA 定盘历史</span>
        </div>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="num text-4xl font-bold text-[#d4a72c]">{p.spotPrice !== null ? fmtPrice(p.spotPrice) : "—"}</span>
        <span className="text-sm text-[#8b949e]">美元/盎司</span>
        {p.dailyChangePct !== null && (
          <span className={`num text-lg font-semibold ${pnlClass(p.dailyChangePct)}`}>
            {pnlArrow(p.dailyChangePct)} {fmtSigned(p.dailyChangePct)}%
          </span>
        )}
      </div>
      <div className="mt-1 text-xs text-[#8b949e]">
        现货报价 {p.spotSource} · {p.spotAsOf ? `截至 ${p.spotAsOf}` : "—"}
        {p.spotTimestamp && <span className="num"> ({p.spotTimestamp})</span>}
        {p.crossCheck && (
          <span className="ml-2">
            交叉校验: <span className="num">{fmtPrice(p.crossCheck.price_usd)}</span> ({p.crossCheck.source})
          </span>
        )}
      </div>
      <div className="mt-1 text-xs text-[#8b949e]">
        日频基准(LBMA PM 定盘): <span className="num text-[#e6edf3]">{p.fixValue !== null ? fmtPrice(p.fixValue) : "—"}</span>
        {p.fixDate ? ` (${fmtDateCn(p.fixDate)})` : ""}
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2 border-t border-[#2d333b] pt-3">
        {returns.map((r) => {
          const label = labels[r.window] ?? r.label;
          return (
            <div key={r.window} className="text-center">
              <div className="text-[10px] text-[#8b949e]">{label}</div>
              <div className={`num text-sm font-semibold ${pnlClass(r.changePct)}`}>
                {r.changePct === null ? "—" : fmtSigned(r.changePct, 2) + "%"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 space-y-1 border-t border-[#2d333b] pt-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[#8b949e]">近1年位置:</span>
          <span className={`font-semibold ${p.yearPosLabel === "高位" ? "text-up" : p.yearPosLabel === "低位" ? "text-down" : "text-neutral-300"}`}>
            {p.yearPosLabel}
          </span>
          {p.yearPosPercentile !== null && <span className="num text-[#8b949e]">({p.yearPosPercentile.toFixed(0)}% 分位)</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#8b949e]">近期趋势(规则):</span>
          <span className={`font-semibold ${p.trendLabel === "上升" ? "text-up" : p.trendLabel === "下降" ? "text-down" : "text-neutral-300"}`}>{p.trendLabel}</span>
          <span className="text-[10px] text-[#8b949e]">{p.trendExplanation}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-[#8b949e]">
        <span className="src-tag">
          来源:{" "}
          <a className="hover:text-[#d4a72c] underline" href={p.sourceUrl} target="_blank" rel="noreferrer">
            {p.source}
          </a>
        </span>
        <span className="src-tag">历史: LBMA 定盘价(PM, USD/oz)</span>
      </div>
      <div className="mt-1.5 text-[10px] text-[#8b949e]">
        {p.yearPosExplanation} · 趋势判断为明确规则(近20个有效观测 ±1.5%), 非 AI 判断。
      </div>
    </div>
  );
}
