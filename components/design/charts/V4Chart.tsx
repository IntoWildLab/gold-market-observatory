"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { fmtNumber } from "@/lib/format";

/**
 * refined-v4 统一图表令牌 —— 浅暖白金融风(仅 /design/refined-v4 使用)。
 * 注意: 本页涨跌色按本轮要求为「涨=绿 / 跌=红」(与正式页的红涨绿跌不同, 正式页不受影响)。
 */
export const V4 = {
  grid: "#ebe5d6",
  axis: "#a8a193",
  tick: { fill: "#6b6459", fontSize: 12, fontFamily: "ui-monospace, monospace" },
  tooltip: {
    contentStyle: { background: "#ffffff", border: "1px solid #e7e0d0", borderRadius: 10, fontSize: 13, color: "#2a2a28", boxShadow: "0 8px 24px rgba(60,50,20,0.08)", padding: "8px 12px" },
    labelStyle: { color: "#7d766a", fontSize: 11, marginBottom: 2 },
    itemStyle: { color: "#2a2a28" },
  },
};

export interface VPoint {
  date: string;
  value: number | null;
}

const RANGES: Record<string, number> = { "1M": 21, "3M": 63, "6M": 126, "1Y": 252 };

interface AreaProps {
  points: VPoint[];
  color: string;
  unit?: string;
  height?: number;
  ranges?: string[];
  defaultRange?: string;
  fillOpacity?: number;
  bar?: boolean;
  heightClassName?: string;
}

/** refined-v4 统一面积/柱图(浅色) */
export function V4AreaChart({ points, color, unit, height = 240, ranges = ["1M", "3M", "6M", "1Y"], defaultRange, fillOpacity = 0.14, bar, heightClassName }: AreaProps) {
  const [range, setRange] = useState(defaultRange ?? ranges[0]);
  const data = useMemo(() => points.slice(-(RANGES[range] ?? 63)), [points, range]);

  return (
    <div>
      {ranges.length > 1 && (
        <div className="mb-1 flex justify-end gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-full px-2.5 py-0.5 text-[13px] font-mono transition ${range === r ? "bg-[#b07d2b] text-white" : "text-[#8a857a] hover:bg-[#f3ead8]"}`}
            >
              {r}
            </button>
          ))}
        </div>
      )}
      <div className={heightClassName} style={heightClassName ? undefined : { height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`v4-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={V4.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={V4.tick} tickLine={false} axisLine={{ stroke: V4.grid }} minTickGap={48} />
            <YAxis tick={V4.tick} tickLine={false} axisLine={false} width={58} domain={["auto", "auto"]} tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? fmtNumber(v, 0) : fmtNumber(v, Math.abs(v) < 1 ? 2 : 1))} />
            <Tooltip {...V4.tooltip} formatter={(value: number | string) => [`${fmtNumber(Number(value), 2)}${unit ? ` ${unit}` : ""}`, ""]} />
            {bar && <ReferenceLine y={0} stroke={V4.grid} />}
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.8} fill={`url(#v4-${color.replace("#", "")})`} connectNulls dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** 迷你火花线 */
export function V4Spark({ points, color, height = 30, width = 96 }: { points: VPoint[]; color: string; height?: number; width?: number }) {
  const data = points.slice(-90);
  return (
    <div style={{ height, width }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 1, right: 0, bottom: 0, left: 0 }}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.4} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface RegionRow {
  date: string;
  northAmerica: number | null;
  europe: number | null;
  asia: number | null;
  other: number | null;
  total: number | null;
}

export const REGION_META = [
  { key: "northAmerica" as const, label: "北美", color: "#4a8fd4" },
  { key: "europe" as const, label: "欧洲", color: "#8a6fd4" },
  { key: "asia" as const, label: "亚洲", color: "#d98e3f" },
  { key: "other" as const, label: "其他", color: "#9aa3ad" },
];

/** 当前区域结构 Donut(占比) */
export function V4Donut({ rows }: { rows: RegionRow[] }) {
  const last = rows[rows.length - 1];
  const data = REGION_META.map((r) => {
    const v = last ? last[r.key] ?? 0 : 0;
    return { name: r.label, value: Math.max(v, 0), color: r.color };
  });
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <div className="flex items-center gap-5">
      <div className="h-36 w-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={46} outerRadius={66} paddingAngle={2} strokeWidth={0}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip {...V4.tooltip} formatter={(value: number | string) => [`${((Number(value) / total) * 100).toFixed(1)}%`, ""]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-[13px]">
            <span className="h-2 w-2 rounded-sm" style={{ background: d.color }} />
            <span className="text-[#7a7468]">{d.name}</span>
            <span className="font-mono font-semibold text-[#2a2a28]">{((d.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
        <div className="border-t border-[#ebe5d6] pt-1 text-[13px] text-[#8a857a]">
          合计 {fmtNumber(total, 0)} 吨 · {last?.date}
        </div>
      </div>
    </div>
  );
}

/** 历史区域结构: 100% 份额堆叠面积(观察各地区占比变化) */
export function V4ShareStack({ rows }: { rows: RegionRow[] }) {
  const [range, setRange] = useState("1Y");
  const n = { "6M": 26, "1Y": 52, "2Y": 104 }[range] ?? 52;
  const data = useMemo(
    () =>
      rows.slice(-n).map((r) => {
        const vals = REGION_META.map((m) => Math.max(r[m.key] ?? 0, 0));
        const total = vals.reduce((a, b) => a + b, 0) || 1;
        const out: Record<string, string | number> = { date: r.date };
        REGION_META.forEach((m, i) => {
          out[m.key] = (vals[i] / total) * 100;
        });
        return out;
      }),
    [rows, n],
  );
  return (
    <div>
      <div className="mb-1 flex justify-end gap-1">
        {["6M", "1Y", "2Y"].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`rounded-full px-2.5 py-0.5 text-[13px] font-mono ${range === r ? "bg-[#b07d2b] text-white" : "text-[#8a857a] hover:bg-[#f3ead8]"}`}
          >
            {r}
          </button>
        ))}
      </div>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={V4.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={V4.tick} tickLine={false} axisLine={{ stroke: V4.grid }} minTickGap={48} />
            <YAxis tick={V4.tick} tickLine={false} axisLine={false} width={46} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip {...V4.tooltip} formatter={(value: number | string, name: string) => [`${Number(value).toFixed(1)}%`, name]} />
            {REGION_META.map((m) => (
              <Area key={m.key} type="monotone" dataKey={m.key} name={m.label} stackId="1" stroke={m.color} fill={m.color} fillOpacity={0.55} strokeWidth={1} dot={false} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** 宏观联动(基准日 = 100): 黄金/美元/实际利率/名义收益率 */
export function V4Compare({ rows }: { rows: Array<{ date: string; gold: number | null; dxy: number | null; real10y: number | null; nominal10y: number | null }> }) {
  const [range, setRange] = useState("3M");
  const n = { "1M": 21, "3M": 63, "6M": 126, "1Y": 252 }[range] ?? 63;
  const KEYS = ["gold", "dxy", "real10y", "nominal10y"] as const;
  const data = useMemo(() => {
    const slice = rows.slice(-n);
    const base: Record<string, number> = { gold: 0, dxy: 0, real10y: 0, nominal10y: 0 };
    for (const k of KEYS) {
      const first = slice.find((p) => p[k] !== null);
      base[k] = first ? Number(first[k]) : 0;
    }
    return slice.map((p) => {
      const out: Record<string, number | string | null> = { date: p.date };
      for (const k of KEYS) {
        const v = p[k];
        out[k] = v !== null && base[k] !== 0 ? (v / base[k]) * 100 : null;
      }
      return out;
    });
  }, [rows, n]);

  const series = [
    { key: "gold", name: "黄金", color: "#b07d2b" },
    { key: "dxy", name: "美元指数(代理)", color: "#4a8fd4" },
    { key: "real10y", name: "10Y实际利率", color: "#8a6fd4" },
    { key: "nominal10y", name: "10Y名义(辅助)", color: "#9aa3ad" },
  ];

  return (
    <div>
      <div className="mb-1 flex justify-end gap-1">
        {["1M", "3M", "6M", "1Y"].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`rounded-full px-2.5 py-0.5 text-[13px] font-mono ${range === r ? "bg-[#b07d2b] text-white" : "text-[#8a857a] hover:bg-[#f3ead8]"}`}
          >
            {r}
          </button>
        ))}
      </div>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={V4.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={V4.tick} tickLine={false} axisLine={{ stroke: V4.grid }} minTickGap={48} />
            <YAxis tick={V4.tick} tickLine={false} axisLine={false} width={50} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(0)} />
            <Tooltip {...V4.tooltip} formatter={(value: number | string, name: string) => [`${Number(value).toFixed(1)}`, name]} />
            <ReferenceLine y={100} stroke="#d8d0bc" strokeDasharray="4 4" />
            {series.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={1.8} dot={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[13px] text-[#8a857a]">
        各序列以所选区间首日归一化为 100，用于观察同期变化方向，不是比较原始数值大小；收益率类为指数化展示，不代表实际数值。
      </p>
    </div>
  );
}
