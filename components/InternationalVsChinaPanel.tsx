"use client";

import { fmtSigned, pnlClass, pnlArrow } from "@/lib/format";
import type { ChinaComparison, TheoreticalResult } from "@/lib/china";
import ChinaCompareChart, { type CompareRow } from "./charts/ChinaCompareChart";

interface Props {
  comparison: ChinaComparison;
  theoretical: TheoreticalResult;
}

export default function InternationalVsChinaPanel({ comparison, theoretical }: Props) {
  const { gold, au99, usdcny } = comparison;
  const latest = theoretical.latest;
  const rows = theoretical.points.slice(-126).map((p) => ({
    date: p.date,
    au99: p.au99,
    theoretical: p.theoretical,
    premiumPct: p.premiumPct,
  })) as CompareRow[];

  const cell = (v: number | null, digits = 2) => (
    <span className={`num ${pnlClass(v)}`}>{v === null ? "—" : `${pnlArrow(v)} ${fmtSigned(v, digits)}%`}</span>
  );

  return (
    <section className="space-y-4">
      <div className="panel p-4">
        <div className="flex items-center justify-between">
          <h2 className="panel-title">国际黄金 vs 国内黄金</h2>
          <span className="text-[10px] text-[#8b949e]">回答: 为什么国内和国际黄金涨得不完全一样?</span>
        </div>

        {/* 同期涨跌幅对比表 */}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#2d333b] text-[#8b949e]">
                <th className="py-1.5 pr-3 font-medium">指标</th>
                <th className="py-1.5 pr-3 text-right font-medium">近5日</th>
                <th className="py-1.5 pr-3 text-right font-medium">近20日</th>
                <th className="py-1.5 text-right font-medium">近60日</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#2d333b]/50">
                <td className="py-1.5 pr-3 text-[#c9d1d9]">
                  国际黄金 XAU/USD
                  <span className="ml-1 text-[9px] text-[#8b949e]">(LBMA 定盘, USD/oz)</span>
                </td>
                <td className="py-1.5 pr-3 text-right">{cell(gold[0]?.changePct)}</td>
                <td className="py-1.5 pr-3 text-right">{cell(gold[1]?.changePct)}</td>
                <td className="py-1.5 text-right">{cell(gold[2]?.changePct)}</td>
              </tr>
              <tr className="border-b border-[#2d333b]/50">
                <td className="py-1.5 pr-3 text-[#c9d1d9]">
                  Au99.99
                  <span className="ml-1 text-[9px] text-[#8b949e]">(上海黄金交易所, 元/克)</span>
                </td>
                <td className="py-1.5 pr-3 text-right">{cell(au99[0]?.changePct)}</td>
                <td className="py-1.5 pr-3 text-right">{cell(au99[1]?.changePct)}</td>
                <td className="py-1.5 text-right">{cell(au99[2]?.changePct)}</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 text-[#c9d1d9]">
                  USD/CNY
                  <span className="ml-1 text-[9px] text-[#8b949e]">(上升=人民币走弱)</span>
                </td>
                <td className="py-1.5 pr-3 text-right">{cell(usdcny[0]?.changePct, 3)}</td>
                <td className="py-1.5 pr-3 text-right">{cell(usdcny[1]?.changePct, 3)}</td>
                <td className="py-1.5 text-right">{cell(usdcny[2]?.changePct, 3)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 规则化解释 */}
        <div className="mt-3 rounded border border-[#2d333b] bg-[#0d1117]/60 p-3">
          <div className="mb-1 text-[11px] font-semibold text-[#8b949e]">解释(由明确规则生成)</div>
          <p className="text-xs leading-relaxed text-[#c9d1d9]">{comparison.explanation}</p>
          <p className="mt-1.5 text-[10px] text-[#8b949e]">{comparison.ruleText}</p>
        </div>

        {/* 理论折算参考价 + 国内溢价/折价 */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded border border-[#2d333b] bg-[#0d1117]/60 p-3">
            <div className="text-[10px] text-[#8b949e]">国际黄金人民币理论折算参考值</div>
            <div className="num mt-1 text-xl font-bold text-[#38bdf8]">
              {latest ? `${latest.theoretical.toFixed(2)} 元/克` : "—"}
            </div>
            <div className="mt-0.5 text-[9px] text-[#8b949e]">
              {latest ? `${latest.date} · 国际 $${latest.goldUsd.toFixed(0)}/oz × USD/CNY ${latest.usdcny.toFixed(4)} ÷ 31.1035` : "—"}
            </div>
          </div>
          <div className="rounded border border-[#2d333b] bg-[#0d1117]/60 p-3">
            <div className="text-[10px] text-[#8b949e]">Au99.99 当日</div>
            <div className="num mt-1 text-xl font-bold text-[#e6edf3]">
              {latest?.au99 !== null && latest?.au99 !== undefined ? `${latest.au99.toFixed(2)} 元/克` : "—"}
            </div>
            <div className="mt-0.5 text-[9px] text-[#8b949e]">
              {latest ? `${latest.date} (上海交易日)` : "—"}
            </div>
          </div>
          <div className="rounded border border-[#2d333b] bg-[#0d1117]/60 p-3">
            <div className="text-[10px] text-[#8b949e]">国内溢价/折价(相对理论值)</div>
            <div className={`num mt-1 text-xl font-bold ${latest?.premiumPct !== null && latest?.premiumPct !== undefined ? (latest.premiumPct >= 0 ? "text-up" : "text-down") : "text-[#8b949e]"}`}>
              {latest?.premiumPct !== null && latest?.premiumPct !== undefined ? `${latest.premiumPct >= 0 ? "+" : ""}${latest.premiumPct.toFixed(2)}%` : "—"}
            </div>
            <div className="mt-0.5 text-[9px] text-[#8b949e]">
              {latest?.premiumCny !== null && latest?.premiumCny !== undefined
                ? `≈ ${latest.premiumCny >= 0 ? "+" : ""}${latest.premiumCny.toFixed(2)} 元/克`
                : latest?.au99 === null
                  ? "当日无 Au99.99(上海休市)"
                  : "—"}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-[#8b949e]">⚠️ {theoretical.caveat}</p>
      </div>

      <ChinaCompareChart rows={rows} sourceNote={theoretical.caveat} />
    </section>
  );
}
