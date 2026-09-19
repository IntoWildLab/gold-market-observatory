"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DesignData } from "@/lib/design-data";
import "./capital-investor.css";

const fmt = (value: number | null | undefined, digits = 2) => value == null ? "—" : value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (value: number | null | undefined, digits = 2) => value == null ? "—" : `${value > 0 ? "+" : ""}${fmt(value, digits)}`;

export default function InvestorLayer({ data }: { data: DesignData }) {
  const etf = data.invest.chinaGoldEtf;
  const tracking = etf.tracking.windows["20D"];
  const priceSeries = data.charts.find((chart) => chart.seriesId === "cn_gold_etf_price");
  const points = priceSeries?.points.slice(-126) ?? [];
  const ticks = points.filter((point, index) => index === 0 || index === points.length - 1 || point.date.slice(0, 7) !== points[index - 1]?.date.slice(0, 7)).map((point) => point.date);
  const premium = etf.formal_premium_available ? etf.premium_discount_pct : null;
  const share20 = etf.foundation_availability === "available" ? etf.shares_change_windows_pct["20D"] : null;
  const premiumReading = premium == null ? "无同日正式值" : premium < 0 ? "同日折价" : premium > 0 ? "同日溢价" : "与净值持平";
  const shareReading = share20 == null ? "变化暂不可用" : share20 > 0 ? "近期份额增加" : share20 < 0 ? "近期份额减少" : "近期份额持平";
  const trackingAvailable = tracking?.status === "available" && tracking.tracking_difference_pp != null;

  return <section className="v5-lower-section v5-investor" aria-labelledby="v5-investor-heading">
    <div className="v5-lower-section-head"><span className="v5-lower-index">05 / CHINA INVESTOR</span><h2 id="v5-investor-heading">中国黄金 ETF 投资者层</h2><p>从 518880 市价，读到净值、份额与跟踪状态。</p></div>
    <div className="v5-investor-reading">
      <div className="v5-investor-price"><span className="v5-lower-kicker">518880 / MARKET PRICE</span><strong>{fmt(etf.market_close, 3)} <small>元/份</small></strong><p>当日 {signed(etf.daily_return_pct)}% · 市价日 {etf.market_close_date ?? "未知"}</p></div>
      <div className="v5-investor-nav"><span>华安基金官方 NAV</span><strong>{fmt(etf.official_nav, 4)} <small>元/份</small></strong><time>净值日 {etf.nav_date ?? "未知"}</time></div>
      <div className="v5-investor-premium"><span>正式同日折溢价</span><strong className={premium == null ? "" : premium < 0 ? "negative" : "positive"}>{premium == null ? "—" : `${signed(premium)}%`}</strong><time>{premiumReading} · {etf.formal_premium_available ? etf.market_close_date : "市价与净值需同日"}</time></div>
    </div>
    <div className="v5-investor-body">
      <div className="v5-investor-observations"><span className="v5-lower-kicker">INVESTOR READING / 当前观察</span>
        <div className="v5-investor-row"><strong className="v5-investor-answer">{premium == null ? premiumReading : `${premium < 0 ? "折价" : premium > 0 ? "溢价" : "持平"} ${signed(premium)}%`}</strong><span className="v5-investor-row-label">市价与 NAV</span><div className="v5-investor-metric">{premium == null ? "等待同日正式值" : "同日正式折溢价"}</div></div>
        <div className="v5-investor-row"><strong className="v5-investor-answer">{shareReading}</strong><span className="v5-investor-row-label">ETF 份额</span><div className="v5-investor-metric">{fmt(etf.total_shares, 2)} 亿份 <span>· 近 20 日 {share20 == null ? "—" : `${signed(share20)}%`}</span></div><small>份额日 {etf.shares_date ?? "—"} · 日频</small></div>
        <div className="v5-investor-row"><strong className="v5-investor-answer">{trackingAvailable ? "跟踪偏离" : "跟踪数据不足"}</strong><span className="v5-investor-row-label">跟踪状态</span><div className="v5-investor-metric">{trackingAvailable ? `${signed(tracking.tracking_difference_pp)} pp / 20D` : "—"}</div><small>共同样本 {trackingAvailable ? tracking.sample_count ?? "—" : "—"} 个 · 截至 {tracking?.end_date ?? "—"}</small></div>
        <div className="v5-investor-row"><strong className="v5-investor-answer">{etf.foundation_availability === "available" ? "数据基础可用" : "数据基础不可用"}</strong><span className="v5-investor-row-label">Foundation</span><div className="v5-investor-metric">日度份额 {etf.daily_shares_availability === "available" ? "可用" : "不可用"} · Tracking {etf.tracking.availability === "available" ? "可用" : "不可用"}</div></div>
      </div>
      <div className="v5-investor-chart"><div className="v5-investor-chart-head"><span className="v5-lower-kicker">MARKET PRICE / DAILY</span><h3>518880 市场价格</h3><p>近 {points.length} 个观测 · 元/份 · 最新 {points.at(-1)?.date ?? "—"}</p></div><div className="v5-investor-plot" role="img" aria-label={`518880 市价近 ${points.length} 个日度观测走势图，单位元每份`}>{points.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}><defs><linearGradient id="v5-investor-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#cbb78e" stopOpacity={0.16} /><stop offset="100%" stopColor="#cbb78e" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#698092" strokeOpacity={0.13} vertical={false} /><XAxis dataKey="date" ticks={ticks} tickFormatter={(date: string) => date.slice(0, 7)} tick={{ fill: "#8399aa", fontSize: 10 }} minTickGap={35} tickLine={false} axisLine={{ stroke: "#4d6273" }} /><YAxis domain={["auto", "auto"]} width={47} tick={{ fill: "#8399aa", fontSize: 10 }} tickFormatter={(value: number) => fmt(value, 2)} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "#0d1c29", border: "1px solid #405262", color: "#e3e8ef", borderRadius: 3, fontSize: 12 }} formatter={(value) => [typeof value === "number" ? `${fmt(value, 3)} 元/份` : "—", "市场价格"]} /><Area type="monotone" dataKey="value" stroke="#cbb78e" strokeWidth={1.8} fill="url(#v5-investor-area)" connectNulls={false} isAnimationActive={false} /></AreaChart></ResponsiveContainer> : <div className="v5-lower-empty">市价序列暂不可用</div>}</div><p className="v5-investor-source">{priceSeries?.source ?? "来源未提供"} · 日频。NAV、折溢价与跟踪数据按上方独立日期阅读。</p></div>
    </div>
    <details className="v5-lower-disclosure"><summary>阅读口径与数据日期</summary><p>市场价格 {etf.market_close_date ?? "—"} · 官方 NAV {etf.nav_date ?? "—"} · 日度份额 {etf.shares_date ?? "—"} · 跟踪共同日历截至 {tracking?.end_date ?? "—"}。仅在市价与官方 NAV 同日且 Foundation 提供正式值时展示折溢价；错位日期不估算。</p><p>份额变化提供申购、赎回方向线索，不等于价格走势。20D 跟踪偏离采用官方 NAV 收益减 Au99.99 收益；Au99.99 是中国黄金现货代理基准。跟踪数值为现有派生窗口结果，不构成历史逐日曲线或投资建议。</p></details>
  </section>;
}
