"use client";

import { fmtNumber, fmtSigned, pnlClass, pnlArrow } from "@/lib/format";
import type { PeriodReturn } from "@/lib/indicators/returns";

interface Props {
  au99: {
    value: number | null;
    date: string | null;
    returns: PeriodReturn[];
    source: string;
    sourceUrl: string;
  };
  usdcny: {
    value: number | null;
    date: string | null;
    change: number | null;
    changePct: number | null;
    returns: PeriodReturn[];
    source: string;
    sourceUrl: string;
  };
  etf: {
    price: number | null;
    date: string | null;
    dailyChangePct: number | null;
    returns: PeriodReturn[];
    sharesValue: number | null;
    sharesDate: string | null;
    sharesNetFlow: number | null;
    volumeShares: number | null;
    amount: number | null;
    source: string;
    sourceUrl: string;
    note: string;
  };
}

function ReturnsRow({ returns, digits = 2 }: { returns: PeriodReturn[]; digits?: number }) {
  return (
    <div className="mt-2 grid grid-cols-4 gap-1 border-t border-[#2d333b] pt-2">
      {returns.map((r) => (
        <div key={r.window} className="text-center">
          <div className="text-[9px] text-[#8b949e]">{r.window === "1D" ? "当日" : r.label}</div>
          <div className={`num text-xs font-semibold ${pnlClass(r.changePct)}`}>
            {r.changePct === null ? "—" : fmtSigned(r.changePct, digits) + "%"}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChinaGoldPanel(p: Props) {
  return (
    <div className="panel p-4 border-[#38bdf8]/30">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-[#8b949e]">中国黄金</div>
        <span className="text-[9px] text-[#8b949e]">国际黄金 → 汇率 → 国内黄金 → 国内ETF</span>
      </div>

      {/* Au99.99 */}
      <div className="mt-3 rounded border border-[#2d333b] bg-[#0d1117]/60 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-[#8b949e]">Au99.99 (上海黄金交易所)</span>
          <span className="text-[9px] text-[#8b949e]">元/克</span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="num text-2xl font-bold text-[#e6edf3]">{p.au99.value !== null ? fmtNumber(p.au99.value, 2) : "—"}</span>
          {p.au99.returns[0]?.changePct !== null && (
            <span className={`num text-sm font-semibold ${pnlClass(p.au99.returns[0]?.changePct)}`}>
              {pnlArrow(p.au99.returns[0]?.changePct ?? null)} {fmtSigned(p.au99.returns[0]?.changePct ?? null, 2)}%
            </span>
          )}
          <span className="ml-auto text-[10px] text-[#8b949e]">{p.au99.date ?? "—"}</span>
        </div>
        <ReturnsRow returns={p.au99.returns} />
        <div className="mt-1.5 text-[9px] text-[#8b949e]">
          来源:{" "}
          <a className="underline hover:text-[#d4a72c]" href={p.au99.sourceUrl} target="_blank" rel="noreferrer">
            {p.au99.source}
          </a>
          <span className="ml-1">· 国内人民币计价黄金的重要价格参考, 非"国内版 XAU/USD"(市场/单位/结构不同)</span>
        </div>
      </div>

      {/* USD/CNY */}
      <div className="mt-2 rounded border border-[#2d333b] bg-[#0d1117]/60 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-[#8b949e]">USD/CNY</span>
          <span className="text-[9px] text-[#8b949e]">人民币/美元</span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="num text-2xl font-bold text-[#e6edf3]">{p.usdcny.value !== null ? fmtNumber(p.usdcny.value, 4) : "—"}</span>
          {p.usdcny.change !== null && (
            <span className={`num text-sm font-semibold ${pnlClass(p.usdcny.change)}`}>
              {pnlArrow(p.usdcny.change)} {fmtSigned(p.usdcny.change, 4)}
            </span>
          )}
          <span className="ml-auto text-[10px] text-[#8b949e]">{p.usdcny.date ?? "—"}</span>
        </div>
        <ReturnsRow returns={p.usdcny.returns} digits={3} />
        <div className="mt-1.5 text-[9px] text-[#8b949e]">
          来源:{" "}
          <a className="underline hover:text-[#d4a72c]" href={p.usdcny.sourceUrl} target="_blank" rel="noreferrer">
            {p.usdcny.source}
          </a>
          <span className="ml-1">· 汇率上升=人民币相对美元走弱</span>
        </div>
      </div>

      {/* 518880 */}
      <div className="mt-2 rounded border border-[#2d333b] bg-[#0d1117]/60 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-[#8b949e]">黄金ETF 518880 华安</span>
          <span className="text-[9px] text-[#8b949e]">元/份</span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="num text-2xl font-bold text-[#e6edf3]">{p.etf.price !== null ? fmtNumber(p.etf.price, 3) : "—"}</span>
          {p.etf.dailyChangePct !== null && (
            <span className={`num text-sm font-semibold ${pnlClass(p.etf.dailyChangePct)}`}>
              {pnlArrow(p.etf.dailyChangePct)} {fmtSigned(p.etf.dailyChangePct, 2)}%
            </span>
          )}
          <span className="ml-auto text-[10px] text-[#8b949e]">{p.etf.date ?? "—"}</span>
        </div>
        <ReturnsRow returns={p.etf.returns} />
        <div className="mt-2 border-t border-[#2d333b] pt-1.5 text-[10px] text-[#8b949e]">
          <div>
            期末份额:{" "}
            <span className="num text-[#c9d1d9]">{p.etf.sharesValue !== null ? fmtNumber(p.etf.sharesValue, 2) : "—"} 亿份</span>
            {p.etf.sharesDate ? ` (${p.etf.sharesDate}, 季度)` : ""}
            {p.etf.sharesNetFlow !== null && (
              <span className={`num ml-1 ${pnlClass(p.etf.sharesNetFlow)}`}>
                {p.etf.sharesNetFlow >= 0 ? "净申购 +" : "净赎回 "}
                {fmtNumber(Math.abs(p.etf.sharesNetFlow), 2)} 亿份
              </span>
            )}
          </div>
          {p.etf.amount !== null && (
            <div>
              当日成交额: <span className="num">{fmtNumber(p.etf.amount / 1e8, 2)} 亿元</span>
              {p.etf.volumeShares !== null && (
                <span className="num"> · 成交量 {fmtNumber(p.etf.volumeShares / 1e8, 2)} 亿份</span>
              )}
            </div>
          )}
          <div className="mt-1 text-[9px] text-[#8b949e]">{p.etf.note}</div>
          <div className="mt-0.5 text-[9px]">
            来源:{" "}
            <a className="underline hover:text-[#d4a72c]" href={p.etf.sourceUrl} target="_blank" rel="noreferrer">
              {p.etf.source}
            </a>
            <span className="ml-1">· 份额为季度披露, 非日度</span>
          </div>
        </div>
      </div>
    </div>
  );
}
