"use client";

import { useState, useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from "recharts";
import { fmtNumber } from "@/lib/format";

export interface ComparePoint {
  date: string;
  gold: number | null;
  dxy: number | null;
  real10y: number | null;
  nominal10y: number | null;
}

interface Props {
  points: ComparePoint[];
  sourceNote: string;
}

const COLORS: Record<string, string> = {
  gold: "#d4a72c",
  dxy: "#38bdf8",
  real10y: "#a78bfa",
  nominal10y: "#f472b6",
};

const LABELS: Record<string, string> = {
  gold: "黄金",
  dxy: "美元指数(代理)",
  real10y: "10Y实际利率",
  nominal10y: "10Y名义收益率",
};

/**
 * 宏观对比: 基准日 = 100。
 * 对收益率类指标做指数化, 仅用于比较变化幅度, 不代表实际收益率数值;
 * 原始收益率仍可单独查看(见各指标图表)。
 */
export default function MacroCompareChart({ points, sourceNote }: Props) {
  const [range, setRange] = useState("3M");
  const ranges = ["1M", "3M", "6M", "1Y"];

  const data = useMemo(() => {
    const n = { "1M": 21, "3M": 63, "6M": 126, "1Y": 252 }[range] ?? 63;
    const slice = points.slice(-n);
    // 基准日 = 100: 取区间内各序列首个非空值作为基准
    const base: Record<string, number> = { gold: 0, dxy: 0, real10y: 0, nominal10y: 0 };
    for (const k of Object.keys(base)) {
      const first = slice.find((p) => p[k as keyof ComparePoint] !== null);
      base[k] = first ? Number(first[k as keyof ComparePoint]) : 0;
    }
    return slice.map((p) => {
      const out: Record<string, number | string | null> = { date: p.date };
      for (const k of Object.keys(base)) {
        const v = p[k as keyof ComparePoint] as number | null;
        out[k] = v !== null && base[k] !== 0 ? (v / base[k]) * 100 : null;
      }
      return out as { date: string; gold: number | null; dxy: number | null; real10y: number | null; nominal10y: number | null };
    });
  }, [points, range]);

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="panel-title">宏观对比 (基准日 = 100)</div>
          <div className="text-[10px] text-[#8b949e]">
            黄金 / 美元指数 / 10Y实际利率 / 10Y名义收益率 · {sourceNote}
          </div>
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

      <div className="mt-3 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#2d333b" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#2d333b" }} minTickGap={40} />
            <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} width={50} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(0)} />
            <Tooltip
              contentStyle={{ background: "#161b22", border: "1px solid #2d333b", borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: "#8b949e" }}
              formatter={(value: number | string, name: string) => [`${fmtNumber(Number(value), 1)}`, LABELS[String(name)] ?? String(name)]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={100} stroke="#4b5563" strokeDasharray="4 4" />
            {Object.keys(COLORS).map((k) => (
              <Line key={k} type="monotone" dataKey={k} name={LABELS[k]} stroke={COLORS[k]} strokeWidth={1.6} dot={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[10px] text-[#8b949e]">
        说明: 所有序列以所选区间首日为 100 指数化, 仅用于比较相对变化; 收益率为指数化展示, 不代表实际收益率数值。原始实际收益率请查看各指标图表。
      </p>
    </div>
  );
}
