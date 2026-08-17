"use client";

import { useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from "recharts";
import { fmtNumber } from "@/lib/format";

export interface CompareRow {
  date: string;
  au99: number | null;
  theoretical: number | null;
  premiumPct: number | null;
}

interface Props {
  rows: CompareRow[];
  sourceNote: string;
}

/**
 * 国内 Au99.99 vs 国际黄金人民币理论折算参考值(双线)。
 * 明确标注: 理论值为研究参考, 日度对齐, 存在交易时段/节假日差异。
 */
export default function ChinaCompareChart({ rows, sourceNote }: Props) {
  const [range, setRange] = useState("3M");
  const ranges = ["1M", "3M", "6M", "1Y"];
  const data = useMemo(() => {
    const n = { "1M": 21, "3M": 63, "6M": 126, "1Y": 252 }[range] ?? 63;
    return rows.slice(-n);
  }, [rows, range]);

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="panel-title">Au99.99 vs 国际黄金人民币理论折算参考值</div>
          <div className="text-[10px] text-[#8b949e]">单位: 元/克 · 理论值 = XAU/USD × USD/CNY ÷ 31.1035</div>
        </div>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded px-2 py-0.5 text-[11px] ${
                range === r ? "bg-[#d4a72c]/20 text-[#d4a72c]" : "text-[#8b949e] hover:bg-[#2d333b]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#2d333b" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#2d333b" }} minTickGap={40} />
            <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} width={60} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(0)} />
            <Tooltip
              contentStyle={{ background: "#161b22", border: "1px solid #2d333b", borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: "#8b949e" }}
              formatter={(value: number | string, name: string) => [
                `${fmtNumber(Number(value), 2)} 元/克`,
                name === "au99" ? "Au99.99" : "理论折算参考值",
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="au99" name="Au99.99" stroke="#f87171" strokeWidth={1.6} dot={false} connectNulls />
            <Line type="monotone" dataKey="theoretical" name="理论折算参考值" stroke="#38bdf8" strokeWidth={1.6} dot={false} connectNulls strokeDasharray="4 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-[#8b949e]">
        {sourceNote}
      </p>
    </div>
  );
}
