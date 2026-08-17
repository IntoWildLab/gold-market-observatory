"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { fmtNumber } from "@/lib/format";

export interface SeriesPoint {
  date: string;
  value: number | null;
}

interface Props {
  title: string;
  unit: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly";
  points: SeriesPoint[];
  source: string;
  color?: string;
  bar?: boolean; // 柱状图(用于资金流/购金等可正可负序列)
  note?: string;
}

/** 依据频率给各档位对应的"观测数量" */
function rangeObs(frequency: string, range: string): number {
  switch (frequency) {
    case "daily":
      return { "1M": 21, "3M": 63, "6M": 126, "1Y": 252 }[range] ?? 252;
    case "weekly":
      return { "1Y": 52, "3Y": 156, "5Y": 260 }[range] ?? 52;
    case "monthly":
      return { "1Y": 12, "3Y": 36, "5Y": 60 }[range] ?? 12;
    case "quarterly":
      return { "1Y": 4, "3Y": 12, "5Y": 20 }[range] ?? 12;
    default:
      return 252;
  }
}

export default function SeriesChart({ title, unit, frequency, points, source, color = "#d4a72c", bar, note }: Props) {
  const ranges = frequency === "daily" ? ["1M", "3M", "6M", "1Y"] : ["1Y", "3Y", "5Y"];
  const [range, setRange] = useState(ranges[0]);

  const data = useMemo(() => {
    const n = rangeObs(frequency, range);
    return points.slice(-n);
  }, [points, frequency, range]);

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="panel-title">{title}</div>
          <div className="text-[10px] text-[#8b949e]">
            来源: {source} · 频率: {frequency}
            {note && ` · ${note}`}
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
      <div className="mt-2 h-64">
        <ResponsiveContainer width="100%" height="100%">
          {bar ? (
            <AreaChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#2d333b" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#2d333b" }} minTickGap={40} />
              <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} width={64} domain={["auto", "auto"]} tickFormatter={(v: number) => fmtNumber(v, v >= 1000 ? 0 : 2)} />
              <Tooltip
                contentStyle={{ background: "#161b22", border: "1px solid #2d333b", borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: "#8b949e" }}
                formatter={(value: number | string) => [`${fmtNumber(Number(value), 2)} ${unit}`, title]}
              />
              <ReferenceLine y={0} stroke="#4b5563" />
              <Area type="monotone" dataKey="value" stroke={color} fill={`url(#grad-${title})`} strokeWidth={1.5} connectNulls dot={false} />
            </AreaChart>
          ) : (
            <AreaChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#2d333b" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#2d333b" }} minTickGap={40} />
              <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} width={64} domain={["auto", "auto"]} tickFormatter={(v: number) => fmtNumber(v, v >= 1000 ? 0 : 2)} />
              <Tooltip
                contentStyle={{ background: "#161b22", border: "1px solid #2d333b", borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: "#8b949e" }}
                formatter={(value: number | string) => [`${fmtNumber(Number(value), 2)} ${unit}`, title]}
              />
              <Area type="monotone" dataKey="value" stroke={color} fill={`url(#grad-${title})`} strokeWidth={1.5} connectNulls dot={false} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
