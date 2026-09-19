"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DesignData } from "@/lib/design-data";
import CapitalFlowLayer from "./CapitalFlowLayer";
import InvestorLayer from "./InvestorLayer";
import "./evidence-layer.css";

type SeriesId = "au99_99" | "usd_cny" | "cn_gold_etf_price";
const chartChoices: Array<{ id: SeriesId; label: string }> = [
  { id: "au99_99", label: "Au99.99" },
  { id: "usd_cny", label: "USD/CNY" },
  { id: "cn_gold_etf_price", label: "518880" },
];
const fmt = (value: number | null | undefined, digits = 2) => value == null ? "—" : value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (value: number | null | undefined, unit: string, digits = 2) => value == null ? "—" : `${value > 0 ? "+" : ""}${fmt(value, digits)}${unit}`;
const tone = (value: number | null | undefined) => value == null ? "muted" : value > 0 ? "positive" : value < 0 ? "negative" : "muted";

function ResearchChart({ data }: { data: DesignData }) {
  const [active, setActive] = useState<SeriesId>("au99_99");
  const series = data.charts.find((item) => item.seriesId === active);
  const points = series?.points.slice(-126) ?? [];
  const monthTicks = points.filter((point, index) => index === 0 || index === points.length - 1 || point.date.slice(0, 7) !== points[index - 1]?.date.slice(0, 7)).map((point) => point.date);
  const latest = [...points].reverse().find((point) => point.value != null);
  const precision = active === "usd_cny" || active === "cn_gold_etf_price" ? 3 : 1;
  return <div className="v5-lower-chart">
    <div className="v5-lower-chart-head">
      <div><span className="v5-lower-kicker">同一画布 · 单一量纲</span><h3>人民币黄金观察序列</h3></div>
      <div className="v5-lower-chart-tabs" role="group" aria-label="研究序列">
        {chartChoices.map((choice) => <button type="button" key={choice.id} className={active === choice.id ? "selected" : ""} aria-pressed={active === choice.id} onClick={() => setActive(choice.id)}>{choice.label}</button>)}
      </div>
    </div>
    <div className="v5-lower-chart-meta"><span>{series?.label ?? "序列暂不可用"} · {series?.unit ?? "—"}</span><span>近 126 个观测 · 数据日 {latest?.date ?? "—"}</span></div>
    <div className="v5-lower-chart-plot" role="img" aria-label={`${series?.label ?? "研究序列"}近 126 个观测走势图`}>
      {points.length ? <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <defs><linearGradient id="v5-lower-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c9ac75" stopOpacity={0.18} /><stop offset="100%" stopColor="#c9ac75" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke="#607080" strokeOpacity={0.14} vertical={false} />
          <XAxis dataKey="date" ticks={monthTicks} tickFormatter={(value: string) => value.slice(0, 7)} tick={{ fill: "#bfd0da", fontSize: 13 }} minTickGap={45} interval="preserveStartEnd" tickLine={false} axisLine={{ stroke: "#607686" }} />
          <YAxis domain={["auto", "auto"]} width={58} tick={{ fill: "#bfd0da", fontSize: 13 }} tickFormatter={(value: number) => fmt(value, precision)} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: "#0d1c29", border: "1px solid #6d8391", color: "#e7edf2", borderRadius: 3, fontSize: 14 }} labelStyle={{ color: "#b6c7d1" }} formatter={(value, _name, item) => [typeof value === "number" ? `${fmt(value, precision)} ${series?.unit ?? ""}` : "—", item.dataKey === "value" ? (series?.label ?? "序列") : ""]} />
          <Area type="monotone" dataKey="value" stroke="#e9ca80" strokeWidth={2.1} fill="url(#v5-lower-area)" connectNulls={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer> : <div className="v5-lower-empty">当前序列暂无可展示的观测</div>}
    </div>
    <div className="v5-lower-chart-source">{series?.source ?? "来源未提供"} · {series?.frequency ?? "频率未提供"} · 不同单位的序列分开观察</div>
  </div>;
}

function ChinaResearch({ data }: { data: DesignData }) {
  const window = data.china.goldAttribution.windows["20D"];
  const available = window?.status === "available";
  const comparison = data.comparison;
  const change = (items: typeof comparison.gold) => items.find((item) => item.label === "20D")?.changePct ?? null;
  const theoretical = data.theoretical.latest;
  return <section className="v5-lower-section v5-lower-research" aria-labelledby="v5-research-heading">
    <div className="v5-lower-section-head"><span className="v5-lower-index">01 / RESEARCH</span><h2 id="v5-research-heading">国际与人民币黄金</h2><p>从全球定价与汇率，读到国内黄金的实际表现。</p></div>
    <div className="v5-lower-research-layout">
      <div className="v5-lower-research-main">
        <div className="v5-lower-thesis"><span>20D 跨市场表现 <small>各序列独立 20 个有效观测，非同一算式</small></span><p>国际黄金 <b className={tone(change(comparison.gold))}>{signed(change(comparison.gold), "%")}</b><i>／</i> USD/CNY <b className={tone(change(comparison.usdcny))}>{signed(change(comparison.usdcny), "%")}</b><i>／</i> Au99.99 <b className={tone(change(comparison.au99))}>{signed(change(comparison.au99), "%")}</b></p></div>
        <div className="v5-lower-attribution-head"><strong>收益贡献拆解 · 20D</strong><span>共同样本日 · 单位：百分点</span></div>
        <div className="v5-lower-attribution">
          {[
            ["国际黄金", window?.gold_contribution_pp],
            ["汇率", window?.fx_contribution_pp],
            ["国内定价偏离 / 本地因素", window?.deviation_contribution_pp],
          ].map(([label, value]) => <div className="v5-lower-attribution-row" key={String(label)}><span>{label}</span><strong className={tone(value as number | null)}>{available ? signed(value as number | null, "pp") : "—"}</strong></div>)}
        </div>
        <p className="v5-lower-data-note">{available ? `共同样本 ${window.sample_count} 个 · ${window.start_date} → ${window.end_date} · Au99.99 实际收益 ${signed(window.actual_au99_return_pct, "%")}` : "共同样本不足，20D 收益贡献暂不可用。"} 与上方独立 20D 对照的日期可能不同。</p>
      </div>
      <div className="v5-lower-conversion">
        <span className="v5-lower-kicker">同日理论折算 · 研究参考</span>
        <h3>人民币黄金的折算与实际</h3>
        <div className="v5-lower-conversion-row"><span>国际金价 × USD/CNY 换算</span><strong>{fmt(theoretical?.theoretical)} <small>元/克</small></strong></div>
        <div className="v5-lower-conversion-row"><span>Au99.99 实际</span><strong>{fmt(theoretical?.au99)} <small>元/克</small></strong></div>
        <div className="v5-lower-conversion-row v5-lower-conversion-difference"><span>实际相对折算参考值</span><strong>{signed(theoretical?.premiumCny, " 元/克")} <small>({signed(theoretical?.premiumPct, "%")})</small></strong></div>
        <p>共同日历日 {theoretical?.date ?? "暂无"}。不同市场交易时段并不一致，以上不是合理价格或套利信号。</p>
      </div>
      <ResearchChart data={data} />
      <details className="v5-lower-disclosure"><summary>阅读跨市场解释与口径</summary><p>{comparison.explanation}</p><p>{comparison.ruleText}</p><p>{data.theoretical.caveat}</p><p>收益贡献采用 {data.china.goldAttribution.windows["20D"]?.interaction_method ?? "现有归因口径"}；缺失时不估算。</p></details>
    </div>
  </section>;
}

const driverSeries: Record<string, string> = {
  "美元(代理)": "dxy_proxy", "10Y实际利率": "us10y_real", "10Y名义收益率": "us10y_nominal",
  "全球黄金ETF": "gold_etf_flows", "GLD(代表性ETF)": "gld_holdings",
  "全球央行": "cb_gold_purchases", "中国央行": "china_gold_reserves", "黄金价格(近20日)": "gold_price",
};
const staleEvidence: Record<string, string> = { "美元(代理)": "dxy", "10Y实际利率": "real_yield", "10Y名义收益率": "nominal_yield" };

// Presentation-only wording for the existing dimension verdicts; no new vote or score.
const dimensionDisplay: Record<string, { label: string; tone: string }> = {
  "偏利多": { label: "利多 · 偏利多", tone: "bullish" },
  "偏利空": { label: "利空 · 偏利空", tone: "bearish" },
  "偏流入": { label: "利多 · 偏流入", tone: "bullish" },
  "偏流出": { label: "利空 · 偏流出", tone: "bearish" },
  "偏支持": { label: "利多 · 偏支持", tone: "bullish" },
  "偏弱": { label: "利空 · 偏弱", tone: "bearish" },
  "中性": { label: "中性", tone: "neutral" },
};
const displayedDimension = (verdict: string) => dimensionDisplay[verdict] ?? { label: verdict, tone: "neutral" };

function DriverLedger({ data }: { data: DesignData }) {
  const groups = ["macro", "flow", "structure", "trend"] as const;
  const groupVerdict = { macro: data.temperature.macro.verdict, flow: data.temperature.flow.verdict, structure: data.temperature.structure.verdict, trend: data.temperature.trend.verdict };
  const direction = (row: DesignData["drivers"][number]) => {
    if (row.isConfirmation) return row.stance === "confirm" ? { label: "确认 · 一致", tone: "confirm" } : row.stance === "neutral" ? { label: "确认 · 背离", tone: "confirm" } : { label: "确认 · 数据不足", tone: "confirm" };
    if (row.layer === "trend") return { label: "结果变量", tone: "result" };
    if (row.stance === "favorable") return { label: "利多", tone: "bullish" };
    if (row.stance === "unfavorable") return { label: "利空", tone: "bearish" };
    return { label: row.stance === "insufficient" ? "数据不足" : "中性", tone: "neutral" };
  };
  return <section className="v5-lower-section v5-lower-ledger" aria-labelledby="v5-ledger-heading">
    <div className="v5-lower-section-head"><span className="v5-lower-index">02 / EVIDENCE</span><h2 id="v5-ledger-heading">驱动证据记录</h2><p>变量发生了什么，以及它在判断中承担什么角色。</p></div>
    <div className="v5-lower-ledger-head" aria-hidden="true"><span>对黄金环境 · 驱动</span><span>当前变化与解释</span><span>观测日期 / 角色</span></div>
    {groups.map((layer) => {
      const rows = data.drivers.filter((row) => row.layer === layer);
      if (!rows.length) return null;
      const core = rows.filter((row) => !row.isConfirmation);
      const auxiliary = rows.filter((row) => row.isConfirmation);
      const renderRow = (row: (typeof rows)[number]) => {
        const chart = data.charts.find((item) => item.seriesId === driverSeries[row.title]);
        const chartDate = [...(chart?.points ?? [])].reverse().find((point) => point.value != null)?.date;
        const macroEvidence = data.whatChanged.evidence.find((item) => item.id === staleEvidence[row.title]);
        const date = row.title === "全球黄金ETF" ? data.etf.flowsLastDate : row.title === "GLD(代表性ETF)" ? data.etf.gldDate : row.title === "全球央行" ? data.structure.cbDate : row.title === "中国央行" ? data.structure.chinaDate : chartDate;
        const impact = direction(row);
        return <div className={`v5-lower-driver-row ${row.isConfirmation ? "auxiliary" : ""}`} key={row.title}>
          <div className="v5-lower-driver-name"><span className={`v5-lower-driver-badge ${impact.tone}`}>{impact.label}</span><strong>{row.title}</strong></div>
          <div className="v5-lower-driver-reading"><div><strong>{row.behavior}</strong>{!row.isConfirmation && <span>{row.detail}</span>}</div><p>{row.implication}</p></div>
          <div className="v5-lower-driver-fresh"><time>{date ?? "数据日未知"}</time><small>{macroEvidence?.stale ? "更新较慢" : chart?.frequency ?? (layer === "structure" ? "季度观测" : "来源日")}</small><small className="v5-lower-driver-role">{row.isConfirmation ? "AUX · 不投票" : layer === "trend" ? "RESULT · 不投票" : "CORE · 参与判断"}</small></div>
        </div>;
      };
      const verdict = groupVerdict[layer];
      return <div className="v5-lower-ledger-group" key={layer}><h3>{rows[0].layerLabel}<span>{layer === "trend" ? "结果变量" : layer === "structure" ? "中长期" : layer === "flow" ? "资金行为" : "短期宏观"}</span><em className={layer === "trend" ? "result" : displayedDimension(verdict).tone}>{layer === "trend" ? `${verdict} · 结果变量` : displayedDimension(verdict).label}</em></h3>{core.map(renderRow)}{auxiliary.length > 0 && <><div className="v5-lower-desktop-aux">{auxiliary.map(renderRow)}</div><details className="v5-lower-mobile-aux"><summary>辅助确认 · {auxiliary.length} 条</summary>{auxiliary.map(renderRow)}</details></>}</div>;
    })}
    <p className="v5-lower-ledger-note">辅助确认用于检验核心方向是否一致，不独立投票；黄金趋势是结果变量，不参与驱动判定。数据按各自来源日更新。</p>
  </section>;
}

function TemperatureRationale({ data }: { data: DesignData }) {
  const t = data.temperature;
  const dimensions = [
    { name: "宏观", value: t.macro.verdict, scale: t.macro.timeScale, explanation: t.macro.insufficient ? "核心数据不足，暂无法判断方向" : t.macro.verdict === "偏利空" ? "美元与实际利率共同形成压力" : t.macro.verdict === "偏利多" ? "美元与实际利率共同提供支持" : "美元与实际利率方向尚未一致", detail: t.macro },
    { name: "资金", value: t.flow.verdict, scale: t.flow.timeScale, explanation: t.flow.insufficient ? "全球黄金 ETF 数据不足" : t.flow.verdict === "偏流入" ? "全球黄金 ETF 近期净流入" : t.flow.verdict === "偏流出" ? "全球黄金 ETF 近期净流出" : "全球黄金 ETF 资金方向暂不明显", detail: t.flow },
    { name: "结构", value: t.structure.verdict, scale: t.structure.timeScale, explanation: t.structure.insufficient ? "央行数据有限，依据现有观测判断" : t.structure.verdict === "偏支持" ? "央行购金提供中长期支撑" : t.structure.verdict === "偏弱" ? "央行需求对长期结构的支撑减弱" : "全球与中国央行方向尚未一致", detail: t.structure },
  ];
  return <section className="v5-lower-section v5-lower-rationale" aria-labelledby="v5-rationale-heading">
    <div className="v5-lower-section-head"><span className="v5-lower-index">03 / SYNTHESIS</span><h2 id="v5-rationale-heading">当前状态的判断依据</h2><p>驱动维度参与综合判断；价格趋势独立呈现，不循环解释自身。</p></div>
    <p className="v5-lower-synthesis-path">驱动证据 <span>→</span> 维度判断 <span>→</span> 综合状态</p>
    <div className="v5-lower-rationale-list">
      {dimensions.map((dim) => <div className="v5-lower-rationale-row" key={dim.name}><span className="v5-lower-dim-name">{dim.name}</span><strong className={`v5-lower-dim-direction ${displayedDimension(dim.value).tone}`}>{displayedDimension(dim.value).label}</strong><span className="v5-lower-dim-explanation">{dim.explanation}</span></div>)}
      <div className="v5-lower-rationale-row"><span className="v5-lower-dim-name">趋势</span><strong className="v5-lower-dim-direction result">{t.trend.verdict}</strong><span className="v5-lower-dim-explanation">结果变量 · 不投票</span></div>
    </div>
    <div className="v5-lower-echo"><span>综合判断</span><strong>{t.composite.label}</strong></div>
    <details className="v5-lower-disclosure"><summary>查看判断规则与详细依据</summary>
      {dimensions.map((dim) => <div key={dim.name}><p><b>{dim.name} · {dim.scale}</b>：核心指标 {dim.detail.core.map((row) => row.label).join("、") || "无"}；辅助确认 {dim.detail.confirmations.map((row) => row.label).join("、") || "无"}（不独立投票）。</p><p>{dim.detail.ruleText}</p>{dim.detail.insufficient && <p>当前证据有限；维度判断及数据不足处理以现有规则为准。</p>}</div>)}
      <p><b>趋势 · 结果变量 · 不投票</b>：{t.trend.ruleText} {t.trend.detail}</p><p><b>综合状态</b>：{t.composite.summary}</p><p>{t.composite.ruleText}</p><p>{t.disclaimer}</p>
    </details>
  </section>;
}

export default function EvidenceLayer({ data }: { data: DesignData }) {
  return <div className="v5-lower" aria-label="黄金市场研究证据层"><div className="v5-lower-inner"><ChinaResearch data={data} /><DriverLedger data={data} /><TemperatureRationale data={data} /><CapitalFlowLayer data={data} /><InvestorLayer data={data} /></div></div>;
}
