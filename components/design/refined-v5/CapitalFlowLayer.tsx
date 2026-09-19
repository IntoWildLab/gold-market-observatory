"use client";

import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DesignData } from "@/lib/design-data";
import "./capital-investor.css";

const fmt = (value: number | null | undefined, digits = 1) => value == null ? "—" : value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (value: number | null | undefined) => value == null ? "—" : `${value > 0 ? "+" : ""}${fmt(value)} 吨`;
const niceStep = (range: number) => {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(range, 1)));
  return [1, 2, 5, 10].map((factor) => factor * magnitude).find((step) => step >= range) ?? 10 * magnitude;
};

export default function CapitalFlowLayer({ data }: { data: DesignData }) {
  const [view, setView] = useState<"flows" | "holdings">("flows");
  const [plotWidth, setPlotWidth] = useState(900);
  const etf = data.etf;
  const flow = data.temperature.flow;
  const gld = data.drivers.find((row) => row.title === "GLD(代表性ETF)");
  const series = data.charts.find((chart) => chart.seriesId === (view === "flows" ? "gold_etf_flows" : "gold_etf_holdings"));
  const points = series?.points.slice(-52) ?? [];
  const label = view === "flows" ? "全球 ETF 周度资金流" : "全球 ETF 总持仓";
  const direction = flow.insufficient ? "数据不足" : flow.verdict === "偏流入" ? "偏流入" : flow.verdict === "偏流出" ? "偏流出" : "方向不明显";
  const gldReading = gld?.stance === "confirm" ? "与主方向一致" : gld?.stance === "neutral" ? "与主方向未一致" : "无法确认";
  const latest = [...points].reverse().find((point) => point.value != null);
  const tickCount = plotWidth < 500 ? 3 : plotWidth < 950 ? 4 : 6;
  const ticks = Array.from(new Set(Array.from({ length: Math.min(tickCount, points.length) }, (_, index) => points[Math.round(index * (points.length - 1) / (Math.min(tickCount, points.length) - 1 || 1))]?.date))).filter((date): date is string => Boolean(date));
  const values = points.map((point) => point.value).filter((value): value is number => value != null);
  const flowStep = niceStep(Math.max(...values.map((value) => Math.abs(value)), 0) / 2);
  const flowExtent = Math.ceil(Math.max(...values.map((value) => Math.abs(value)), 0) / flowStep) * flowStep || flowStep;
  const flowTicks = [-flowExtent, -flowExtent / 2, 0, flowExtent / 2, flowExtent];
  const holdingLow = values.length ? Math.min(...values) : 0;
  const holdingHigh = values.length ? Math.max(...values) : 0;
  const holdingStep = niceStep((holdingHigh - holdingLow) / 3);
  const holdingMin = Math.floor((holdingLow - (holdingHigh === holdingLow ? holdingStep : 0)) / holdingStep) * holdingStep;
  const holdingMax = Math.ceil((holdingHigh + (holdingHigh === holdingLow ? holdingStep : 0)) / holdingStep) * holdingStep;
  const holdingTicks = Array.from({ length: Math.round((holdingMax - holdingMin) / holdingStep) + 1 }, (_, index) => holdingMin + index * holdingStep);
  const yTicks = view === "flows" ? flowTicks : holdingTicks;
  const chartProps = { data: points, margin: { top: 12, right: 34, bottom: 3, left: 2 } };
  const grid = <CartesianGrid stroke="#698092" strokeOpacity={0.14} vertical={false} />;
  const xAxis = <XAxis dataKey="date" ticks={ticks} interval={0} tickFormatter={(date: string) => date.slice(0, 7)} tick={{ fill: "#c2d2dc", fontSize: plotWidth < 500 ? 13 : 13.5 }} minTickGap={8} tickLine={false} axisLine={{ stroke: "#647787" }} tickMargin={10} />;
  const yAxis = <YAxis domain={[yTicks[0], yTicks.at(-1) ?? 0]} ticks={yTicks} allowDataOverflow width={plotWidth < 500 ? 49 : 60} tick={{ fill: "#c2d2dc", fontSize: plotWidth < 500 ? 13 : 13.5 }} tickFormatter={(value: number) => fmt(value, 0)} tickLine={false} axisLine={false} tickMargin={8} />;
  const tooltip = <Tooltip contentStyle={{ background: "#0d1c29", border: "1px solid #6d8391", color: "#e7edf2", borderRadius: 3, fontSize: 14 }} formatter={(value) => [typeof value === "number" ? `${fmt(value)} 吨` : "—", label]} />;

  return <section className="v5-lower-section v5-capital" aria-labelledby="v5-capital-heading">
    <div className="v5-lower-section-head"><span className="v5-lower-index">04 / CAPITAL FLOW</span><h2 id="v5-capital-heading">全球黄金资金流</h2><p>全球 ETF 资金方向、持仓背景与代表性基金确认。</p></div>
    <div className="v5-capital-reading">
      <div className="v5-capital-primary"><span className="v5-lower-kicker">GLOBAL GOLD ETF · 近 4 周</span><strong className={flow.verdict === "偏流入" ? "inflow" : flow.verdict === "偏流出" ? "outflow" : "uncertain"}>{direction}</strong><p>净流量 <b>{signed(etf.flowsSum4w)}</b><span>最近一周 {signed(etf.flowsLast)} · {etf.flowsLastDate ?? "日期未知"}</span></p></div>
      <div className="v5-capital-context"><span>持仓背景 · 周频</span><strong>{fmt(etf.holdingsValue)} <small>吨</small></strong><p>近 4 周 {signed(etf.holdingsChange4w)} · {etf.holdingsDate ?? "日期未知"}</p></div>
    </div>
    <div className="v5-capital-canvas">
      <div className="v5-capital-canvas-head"><div><span className="v5-lower-kicker">RESEARCH CANVAS / WEEKLY · TONNES</span><h3>{label}</h3></div><div className="v5-lower-chart-tabs" role="group" aria-label="全球 ETF 观察序列"><button type="button" className={view === "flows" ? "selected" : ""} aria-pressed={view === "flows"} onClick={() => setView("flows")}>资金流</button><button type="button" className={view === "holdings" ? "selected" : ""} aria-pressed={view === "holdings"} onClick={() => setView("holdings")}>总持仓</button></div></div>
      <div className="v5-capital-chart-meta"><span>{view === "flows" ? <span className="v5-flow-key"><span><i className="inflow" />净流入</span><span><i className="outflow" />净流出</span></span> : "总持仓水平 · 不等同于当周流量"}</span><span>近 {points.length} 个周度观测 · 最新 {latest?.date ?? "—"}</span></div>
      <div className="v5-capital-plot" role="img" aria-label={`${label}近 ${points.length} 个周度观测，单位吨`}>
        {points.length ? <ResponsiveContainer width="100%" height="100%" onResize={(width) => setPlotWidth(width)}>{view === "flows" ? <BarChart {...chartProps}>{grid}{xAxis}{yAxis}{tooltip}<ReferenceLine y={0} stroke="#b9c8d0" strokeOpacity={0.9} strokeWidth={1.2} /><Bar dataKey="value" maxBarSize={13} isAnimationActive={false}>{points.map((point, index) => <Cell key={point.date} fill={point.value != null && point.value < 0 ? "#e4aaa3" : "#8fd8c7"} fillOpacity={index === points.length - 1 ? 1 : 0.9} stroke={index === points.length - 1 ? "#eff5f2" : "none"} strokeOpacity={0.65} strokeWidth={index === points.length - 1 ? 1 : 0} />)}</Bar></BarChart> : <AreaChart {...chartProps}><defs><linearGradient id="v5-holdings-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d1b36e" stopOpacity={0.18} /><stop offset="100%" stopColor="#d1b36e" stopOpacity={0} /></linearGradient></defs>{grid}{xAxis}{yAxis}{tooltip}<Area dataKey="value" type="monotone" stroke="#ebca79" strokeWidth={2.1} fill="url(#v5-holdings-area)" connectNulls={false} isAnimationActive={false} />{latest?.value != null && <ReferenceDot x={latest.date} y={latest.value} r={5} fill="#f2d88e" stroke="#0d1c29" strokeWidth={1.5} />}</AreaChart>}</ResponsiveContainer> : <div className="v5-lower-empty">暂无可展示的周度观测</div>}
      </div>
      <div className="v5-capital-chart-foot"><span>{series?.source ?? "来源未提供"} · 周频 · 吨</span><span>最新观测 {latest?.value == null ? "—" : view === "flows" ? signed(latest.value) : `${fmt(latest.value)} 吨`}</span></div>
    </div>
    <div className="v5-capital-gld"><div><span className="v5-lower-kicker">GLD / AUX · 不投票</span><strong>{gldReading}</strong></div><p>SPDR GLD 持仓 {fmt(etf.gldValue)} 吨 · 近 20 个交易日 {signed(etf.gldChange20d)}</p><time>数据日 {etf.gldDate ?? "未知"} · 日频 · 代表性 ETF，不代表全球总量</time></div>
    <details className="v5-lower-disclosure"><summary>阅读资金口径</summary><p>近 4 周与近 12 周全球 ETF 净流量分别为 {signed(etf.flowsSum4w)}、{signed(etf.flowsSum12w)}。资金流和持仓虽然都以吨计量，但一个是期间变化，一个是持有水平，分别观察。</p><p>GLD 为日频代表性基金，近 20 个交易日变化仅作辅助确认；全球 ETF 为周频。不同日期和窗口不直接相加。</p></details>
  </section>;
}
