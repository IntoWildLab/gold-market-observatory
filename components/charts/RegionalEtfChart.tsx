"use client";

import { useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { fmtNumber } from "@/lib/format";

export interface RegionalRow {
  date: string;
  northAmerica: number | null;
  europe: number | null;
  asia: number | null;
  other: number | null;
  total: number | null;
}

interface Props {
  rows: RegionalRow[];
  source: string;
}

const REGION_META: Array<{ key: keyof RegionalRow; label: string; color: string }> = [
  { key: "northAmerica", label: "北美", color: "#38bdf8" },
  { key: "europe", label: "欧洲", color: "#a78bfa" },
  { key: "asia", label: "亚洲", color: "#f472b6" },
  { key: "other", label: "其他", color: "#fbbf24" },
];

export default function RegionalEtfChart({ rows, source }: Props) {
  const [range, setRange] = useState("1Y");
  const ranges = ["6M", "1Y", "3Y", "5Y"];
  const data = useMemo(() => {
    const n = { "6M": 26, "1Y": 52, "3Y": 156, "5Y": 260 }[range] ?? 52;
    return rows.slice(-n).map((r) => ({
      date: r.date,
      northAmerica: r.northAmerica ?? 0,
      europe: r.europe ?? 0,
      asia: r.asia ?? 0,
      other: r.other ?? 0,
    }));
  }, [rows, range]);

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="panel-title">黄金 ETF 持仓结构 (分区域, 吨)</div>
          <div className="text-[10px] text-[#8b949e]">来源: {source} · 周频</div>
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
          <AreaChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#2d333b" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#2d333b" }} minTickGap={40} />
            <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} width={60} tickFormatter={(v: number) => fmtNumber(v, 0)} />
            <Tooltip
              contentStyle={{ background: "#161b22", border: "1px solid #2d333b", borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: "#8b949e" }}
              formatter={(value: number | string, name: string) => [`${fmtNumber(Number(value), 1)} 吨`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {REGION_META.map((r) => (
              <Area
                key={r.key}
                type="monotone"
                dataKey={r.key}
                name={r.label}
                stackId="1"
                stroke={r.color}
                fill={r.color}
                fillOpacity={0.35}
                strokeWidth={1}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
