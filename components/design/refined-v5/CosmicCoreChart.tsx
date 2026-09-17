"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
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
const mobileQuery = "(max-width: 650px)";
const subscribeMobile = (onChange: () => void) => {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const serverSnapshot = () => false;

export default function CosmicCoreChart({ points }: { points: Point[] }) {
  const [range, setRange] = useState("1Y");
  const isMobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, serverSnapshot);
  const data = useMemo(() => points.slice(-(RANGES[range] ?? 252)), [points, range]);
  const last = [...data].reverse().find((point) => point.value != null);

  return (
    <section className="v5-chart" aria-labelledby="v5-chart-heading">
      <div className="v5-chart-heading">
        <div className="v5-chart-title">
          <h2 id="v5-chart-heading">黄金核心走势</h2>
          <div className="v5-chart-meta">
            <span>XAU/USD</span>
            <span>LBMA 定盘历史</span>
            <span>单位: USD/oz</span>
          </div>
        </div>
        <div className="v5-chart-ranges" aria-label="走势图观察窗口">
          {Object.keys(RANGES).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              aria-pressed={range === item}
              className={range === item ? "active" : ""}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="v5-chart-plot">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: isMobile ? 12 : 52, bottom: 3, left: 0 }}>
            <defs>
              <linearGradient id="v5-gold-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d7ad58" stopOpacity={0.34} />
                <stop offset="100%" stopColor="#d7ad58" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#354858" strokeOpacity={0.38} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#a4b6cc", fontSize: isMobile ? 10 : 12, fontFamily: "ui-monospace, monospace" }}
              tickLine={false}
              axisLine={{ stroke: "#8195aa" }}
              minTickGap={isMobile ? 35 : 50}
              interval={isMobile ? "preserveStartEnd" : undefined}
              tickFormatter={(value: string) => value.slice(0, 7)}
            />
            <YAxis
              tick={{ fill: "#a4b6cc", fontSize: isMobile ? 10 : 12, fontFamily: "ui-monospace, monospace" }}
              tickLine={false}
              axisLine={{ stroke: "#8195aa" }}
              width={isMobile ? 42 : 55}
              domain={["auto", "auto"]}
              tickFormatter={(value: number) => fmtNumber(value, Math.abs(value) >= 1000 ? 0 : 1)}
            />
            <Tooltip
              contentStyle={{
                background: "#0c1c2a",
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
              stroke="#ffcd65"
              strokeWidth={1.7}
              fill="url(#v5-gold-area)"
              connectNulls={false}
              dot={false}
              activeDot={{ r: 3.5, fill: "#f1d18a", stroke: "#0a1324", strokeWidth: 2 }}
            />
            {last?.value != null && <ReferenceDot x={last.date} y={last.value} r={4} fill="#ffdc97" stroke="#ffdc97" ifOverflow="extendDomain" label={isMobile ? undefined : { value: fmtNumber(last.value, 2), position: "right", fill: "#ffdc97", fontSize: 13, fontWeight: 600 }} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
