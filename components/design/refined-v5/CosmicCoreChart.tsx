"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtNumber } from "@/lib/format";

interface Point {
  date: string;
  value: number | null;
}

const RANGES: Record<string, number> = { "1M": 21, "3M": 63, "6M": 126, "1Y": 252 };

export default function CosmicCoreChart({ points }: { points: Point[] }) {
  const [range, setRange] = useState("1Y");
  const data = useMemo(() => points.slice(-(RANGES[range] ?? 252)), [points, range]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-[#e9eef8]">黄金核心走势</div>
          <div className="mt-1 text-xs text-[#7788a5]">XAU/USD · LBMA 定盘历史 · USD/oz</div>
        </div>
        <div className="flex rounded-md bg-[#0a1324] p-1" aria-label="走势图观察窗口">
          {Object.keys(RANGES).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              className={`rounded px-2.5 py-1 font-mono text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#69a7ff] ${
                range === item ? "bg-[#172641] text-[#dce9ff]" : "text-[#71819d] hover:text-[#b8c7df]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[238px] touch-pan-y sm:h-[280px] lg:h-[330px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="v5-gold-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d7ad58" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#d7ad58" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#18243a" strokeDasharray="2 5" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#657793", fontSize: 11, fontFamily: "ui-monospace, monospace" }}
              tickLine={false}
              axisLine={{ stroke: "#1c2940" }}
              minTickGap={54}
            />
            <YAxis
              tick={{ fill: "#657793", fontSize: 11, fontFamily: "ui-monospace, monospace" }}
              tickLine={false}
              axisLine={false}
              width={58}
              domain={["auto", "auto"]}
              tickFormatter={(value: number) => fmtNumber(value, Math.abs(value) >= 1000 ? 0 : 1)}
            />
            <Tooltip
              contentStyle={{
                background: "#101a2d",
                border: "1px solid #273653",
                borderRadius: 8,
                boxShadow: "none",
                color: "#edf2fb",
                fontSize: 12,
              }}
              labelStyle={{ color: "#8fa0ba", marginBottom: 4 }}
              itemStyle={{ color: "#d7ad58" }}
              formatter={(value: number | string) => [`${fmtNumber(Number(value), 2)} USD/oz`, "XAU/USD"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#d7ad58"
              strokeWidth={2}
              fill="url(#v5-gold-area)"
              connectNulls
              dot={false}
              activeDot={{ r: 3.5, fill: "#f1d18a", stroke: "#0a1324", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
