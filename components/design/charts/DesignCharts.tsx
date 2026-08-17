"use client";

import { useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";

export type ChartVariant = "terminal" | "minimal" | "story";

export interface DPoint {
  date: string;
  value: number | null;
}

const RANGE_OBS: Record<string, number> = { "1M": 21, "3M": 63, "6M": 126, "1Y": 252 };

function tooltipStyle(variant: ChartVariant) {
  switch (variant) {
    case "terminal":
      return {
        contentStyle: { background: "#0f151d", border: "1px solid #223043", borderRadius: 4, fontSize: 12, fontFamily: "ui-monospace, monospace", color: "#d7dee8", padding: "6px 10px" },
        labelStyle: { color: "#7d8794", fontSize: 10 },
        itemStyle: { color: "#e3b45c" },
      };
    case "minimal":
      return {
        contentStyle: { background: "#ffffff", border: "1px solid #e8e4da", borderRadius: 10, fontSize: 12, color: "#191816", boxShadow: "0 6px 24px rgba(0,0,0,0.06)", padding: "8px 12px" },
        labelStyle: { color: "#8a857a", fontSize: 10 },
        itemStyle: { color: "#a67c2e" },
      };
    default:
      return {
        contentStyle: { background: "#ffffff", border: "1px solid #e9e2d3", borderRadius: 12, fontSize: 12, color: "#20242c" },
        labelStyle: { color: "#8a8172", fontSize: 10 },
        itemStyle: { color: "#c08a2e" },
      };
  }
}

interface AreaProps {
  points: DPoint[];
  color: string;
  unit?: string;
  variant: ChartVariant;
  height?: number;
  ranges?: string[];
  bar?: boolean;
}

export function DAreaChart({ points, color, unit, variant, height = 260, ranges = ["1M", "3M", "6M", "1Y"], bar }: AreaProps) {
  const [range, setRange] = useState(ranges[Math.max(0, ranges.length - 3)]);
  const data = useMemo(() => points.slice(-(RANGE_OBS[range] ?? 63)), [points, range]);
  const ts = tooltipStyle(variant);

  const gridProps =
    variant === "minimal"
      ? { stroke: "#efebe2", vertical: false }
      : variant === "story"
        ? { stroke: "#efe8d8", vertical: false, strokeDasharray: "2 4" }
        : { stroke: "#1b2430", vertical: false, strokeDasharray: "3 3" };

  const axisTick = variant === "terminal" ? { fill: "#5f6b7a", fontSize: 10, fontFamily: "ui-monospace, monospace" } : { fill: "#a8a195", fontSize: 10 };

  return (
    <div>
      <div className="flex items-center justify-between">
        {ranges.length > 1 && (
          <div className={`flex gap-0.5 ${variant === "terminal" ? "" : ""}`}>
            {ranges.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={
                  variant === "terminal"
                    ? `rounded-sm px-2 py-0.5 text-[10px] font-mono uppercase ${range === r ? "bg-[#e3b45c] text-black" : "text-[#5f6b7a] hover:text-[#d7dee8]"}`
                    : variant === "minimal"
                      ? `rounded-full px-2.5 py-0.5 text-[10px] ${range === r ? "bg-[#191816] text-white" : "text-[#a8a195] hover:text-[#191816]"}`
                      : `rounded-full px-2.5 py-0.5 text-[10px] ${range === r ? "bg-[#c08a2e] text-white" : "text-[#8a8172] hover:bg-[#efe8d8]"}`
                }
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`dg-${color.replace("#", "")}-${variant}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={variant === "terminal" ? 0.28 : variant === "minimal" ? 0.14 : 0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {!bar && variant !== "minimal" && <CartesianGrid {...gridProps} />}
            {variant === "minimal" && <CartesianGrid stroke="#f0ece3" vertical={false} />}
            <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={variant === "terminal" ? { stroke: "#1b2430" } : false} minTickGap={44} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={variant === "terminal" ? 60 : 44} domain={["auto", "auto"]} tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(v % 1 === 0 ? 0 : 2))} />
            <Tooltip
              {...ts}
              formatter={(value: number | string) => [`${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`, ""]}
            />
            {bar && <ReferenceLine y={0} stroke={variant === "terminal" ? "#334" : "#ddd6c6"} />}
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={variant === "minimal" ? 1.6 : 1.8}
              fill={`url(#dg-${color.replace("#", "")}-${variant})`}
              connectNulls
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function DSpark({ points, color, height = 34, width = 110 }: { points: DPoint[]; color: string; height?: number; width?: number }) {
  const data = points.slice(-90);
  return (
    <div style={{ height, width }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.4} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 国际 vs 国内: 同期涨跌幅对比条 */
export function DeltaBars({ rows, variant }: { rows: Array<{ label: string; sub: string; v5: number | null; v20: number | null; v60: number | null }>; variant: ChartVariant }) {
  const up = variant === "terminal" ? "#ff4d5e" : variant === "minimal" ? "#b03a2e" : "#d1453f";
  const down = variant === "terminal" ? "#23c185" : variant === "minimal" ? "#2e7d5b" : "#2f8f68";
  const fmt = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
  return (
    <table className="w-full text-left">
      <thead>
        <tr className={variant === "terminal" ? "border-b border-[#1b2430] text-[10px] font-mono uppercase tracking-wider text-[#5f6b7a]" : "border-b border-[#e8e4da] text-[10px] uppercase tracking-wider text-[#a8a195]"}>
          <th className="py-2 pr-3 font-normal">指标</th>
          <th className="py-2 pr-3 text-right font-normal">近5日</th>
          <th className="py-2 pr-3 text-right font-normal">近20日</th>
          <th className="py-2 text-right font-normal">近60日</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className={variant === "terminal" ? "border-b border-[#141b25]" : "border-b border-[#f2eee6]"}>
            <td className="py-2.5 pr-3">
              <div className={variant === "terminal" ? "text-xs text-[#d7dee8]" : "text-sm text-[#191816]"}>{r.label}</div>
              <div className="text-[10px] text-[#8a857a]">{r.sub}</div>
            </td>
            {[r.v5, r.v20, r.v60].map((v, i) => (
              <td key={i} className="py-2.5 pr-3 text-right">
                <span
                  className={
                    variant === "terminal" ? "font-mono text-xs" : "font-semibold"
                  }
                  style={{ color: v === null ? "#aaa" : v >= 0 ? up : down }}
                >
                  {fmt(v)}
                </span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
