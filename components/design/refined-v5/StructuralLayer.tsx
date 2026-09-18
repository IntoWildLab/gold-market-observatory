"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DesignData } from "@/lib/design-data";
import "./structural-layer.css";

const fmt = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signed = (value: number | null | undefined) => value == null ? "—" : `${value > 0 ? "+" : ""}${fmt(value)}`;

export default function StructuralLayer({ data }: { data: DesignData }) {
  const structure = data.structure;
  const global = data.charts.find((chart) => chart.seriesId === "cb_gold_purchases");
  const china = data.charts.find((chart) => chart.seriesId === "china_gold_reserves");
  const globalPoints = global?.points.slice(-12) ?? [];
  const chinaPoints = china?.points.slice(-12) ?? [];
  const globalStatus = structure.cbLatest == null ? "数据暂不可用" : structure.cbLatest > 0 ? "最近季度仍为净购金" : structure.cbLatest < 0 ? "最近季度为净售金" : "最近季度净购买持平";
  const chinaStatus = structure.chinaChange == null ? "变化暂不可用" : structure.chinaChange > 0 ? "最近公布季度增持" : structure.chinaChange < 0 ? "最近公布季度减少" : "最近公布季度持平";
  const grid = <CartesianGrid stroke="#688092" strokeOpacity={0.11} vertical={false} />;
  const xAxis = <XAxis dataKey="date" interval={2} tickFormatter={(date: string) => date.slice(2, 7)} tick={{ fill: "#788d9e", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#4a5e6e" }} />;
  const yAxis = (stock: boolean) => <YAxis width={50} domain={stock ? ["dataMin - 10", "dataMax + 10"] : ["auto", "auto"]} allowDataOverflow={stock} tick={{ fill: "#788d9e", fontSize: 10 }} tickFormatter={(value: number) => fmt(value)} tickLine={false} axisLine={false} />;
  const tooltip = (unit: string) => <Tooltip contentStyle={{ background: "#0d1c29", border: "1px solid #405262", color: "#d5dfe7", borderRadius: 3, fontSize: 12 }} formatter={(value) => [typeof value === "number" ? `${fmt(value)} ${unit}` : "—", unit === "吨/季度" ? "季度净购买" : "储备总量"]} />;

  return <div className="v5-structure-shell"><div className="v5-structure-inner"><section className="v5-structure" aria-labelledby="v5-structure-heading">
    <div className="v5-lower-section-head"><span className="v5-lower-index">06 / STRUCTURE</span><h2 id="v5-structure-heading">长期结构背景</h2><p>季度官方需求 · 用于观察长期结构，不解释当日波动。</p></div>
    <div className="v5-structure-intro"><span>STRUCTURAL BACKGROUND</span><p>低频观测。全球净购买是每季度的流量，中国黄金储备是季度末的存量；两者按各自口径阅读。</p></div>
    <div className="v5-structure-observations">
      <div className="v5-structure-observation">
        <div className="v5-structure-reading"><span>GLOBAL CENTRAL BANKS / QUARTERLY</span><h3>全球央行黄金净购买</h3><strong>{globalStatus}</strong><div className="v5-structure-value">{fmt(structure.cbLatest)} <small>吨 / 季度</small></div><p>上一季度 {fmt(structure.cbPrev)} 吨 · 最新季度末 <time>{structure.cbDate ?? "未知"}</time></p></div>
        <div className="v5-structure-chart-head"><span>季度净购买历史</span><span>最近 {globalPoints.length} 季度 · 吨 / 季度</span></div>
        <div className="v5-structure-plot" role="img" aria-label={`全球央行最近 ${globalPoints.length} 季度净购买，单位吨每季度`}>{globalPoints.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={globalPoints} margin={{ top: 8, right: 6, bottom: 0, left: 0 }}>{grid}{xAxis}{yAxis(false)}{tooltip("吨/季度")}<ReferenceLine y={0} stroke="#8799a4" strokeOpacity={0.45} /><Bar dataKey="value" maxBarSize={23} isAnimationActive={false}>{globalPoints.map((point, index) => <Cell key={point.date} fill={point.value != null && point.value < 0 ? "#a38784" : "#9daa9e"} fillOpacity={index === globalPoints.length - 1 ? 0.88 : 0.55} />)}</Bar></BarChart></ResponsiveContainer> : <div className="v5-lower-empty">季度序列暂不可用</div>}</div>
        <p className="v5-structure-source">{global?.source ?? "来源未提供"} · 季度确认值 · 数据截至 {structure.cbDate ?? "—"}</p>
      </div>
      <div className="v5-structure-observation">
        <div className="v5-structure-reading"><span>CHINA RESERVES / QUARTERLY</span><h3>中国央行黄金储备</h3><strong>{chinaStatus}</strong><div className="v5-structure-value">{fmt(structure.chinaTonnes)} <small>吨 · 季度末总量</small></div><p>较上一期 {signed(structure.chinaChange)} 吨 · 最新季度末 <time>{structure.chinaDate ?? "未知"}</time></p></div>
        <div className="v5-structure-chart-head"><span>季度末储备历史</span><span>最近 {chinaPoints.length} 季度 · 总吨数</span></div>
        <div className="v5-structure-plot" role="img" aria-label={`中国央行最近 ${chinaPoints.length} 个季度末黄金储备，单位吨`}>{chinaPoints.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chinaPoints} margin={{ top: 8, right: 6, bottom: 0, left: 0 }}>{grid}{xAxis}{yAxis(true)}{tooltip("吨")}<Line type="stepAfter" dataKey="value" stroke="#9dabaa" strokeWidth={1.6} dot={false} connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <div className="v5-lower-empty">季度序列暂不可用</div>}</div>
        <p className="v5-structure-source">{china?.source ?? "来源未提供"} · 季度汇总口径 · 数据截至 {structure.chinaDate ?? "—"}</p>
      </div>
    </div>
    <div className="v5-structure-context"><span>低频背景</span><p>全球季度净购买与中国季度末储备提供长期官方需求的观察背景，不能用来解释当日价格波动。</p></div>
    <details className="v5-lower-disclosure"><summary>阅读来源、时间尺度与美元估值口径</summary><p>{structure.publishedNote}</p><p>全球央行季度净购买来自 {global?.source ?? "现有数据源"}；中国储备吨数来自 {china?.source ?? "现有数据源"}。两条真实季度历史序列分别绘制，不共用纵轴。</p><p>中国储备还存在季度美元估值序列，但价值变化同时受到储备吨数与金价影响；判断储备是否增加以吨数为准，不把美元估值与吨数叠加。</p></details>
  </section></div></div>;
}
