"use client";

import type { DesignData } from "@/lib/design-data";
import { formatShanghaiDateTime } from "@/lib/date-format";
import CosmicCoreChart from "./CosmicCoreChart";
import EvidenceLayer from "./EvidenceLayer";
import StructuralLayer from "./StructuralLayer";
import V5DataAvailability from "./V5DataAvailability";
import V5EventRisk from "./V5EventRisk";
import "./refined-v5.css";

const fmt = (value: number | null | undefined, digits = 2) => value == null ? "—" : value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (value: number | null | undefined) => value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const tone = (value: number | null | undefined) => value == null ? "neutral" : value > 0 ? "up" : value < 0 ? "down" : "neutral";

function ObservationStrip({ data }: { data: DesignData }) {
  const price = data.gold.latestSpot?.price_usd ?? data.gold.fixValue;
  const return20 = data.gold.periodReturns.find((item) => item.window === "20D")?.changePct ?? null;
  return <section className="v5-observation" aria-label="顶部市场观察">
    <div className="v5-observation-inner">
      <div className="v5-spot"><span className="v5-spot-label"><b>XAU</b> 现货黄金</span><strong>{fmt(price)}</strong><span className="v5-unit">USD/oz</span></div>
      <div className="v5-strip-change"><span className="v5-strip-window">短线价格 · 近 1 日</span><strong className={tone(data.gold.dailyChangePct)}>{pct(data.gold.dailyChangePct)}</strong><span>中期价格 · 20D <b className={tone(return20)}>{pct(return20)}</b></span></div>
      <div className="v5-status"><span>综合环境</span><strong>{data.temperature.composite.label}</strong><span className="v5-signal" aria-hidden="true"><i /><i /><i /></span></div>
      <div className="v5-updated"><span>数据更新&nbsp; <time>{formatShanghaiDateTime(data.manifestGeneratedAt)}</time></span><small>不同来源按各自数据日更新</small></div>
      <V5EventRisk data={data} />
    </div>
  </section>;
}

function Transmission({ data }: { data: DesignData }) {
  const auDaily = data.china.au99.returns.find((item) => item.window === "1D")?.changePct ?? null;
  const stages = [
    { stage: "GLOBAL", role: "全球定价", asset: "XAU/USD", value: fmt(data.gold.latestSpot?.price_usd ?? data.gold.fixValue), unit: "USD/oz", change: data.gold.dailyChangePct, source: "全球黄金定价基准 · LBMA", date: data.gold.latestSpot?.as_of_date ?? data.gold.fixDate },
    { stage: "CHINA", role: "中国市场", asset: "Au99.99", value: fmt(data.china.au99.value), unit: "元/克", change: auDaily, source: "上海黄金交易所 · 人民币计价", date: data.china.au99.date },
    { stage: "INVEST", role: "投资工具", asset: "518880", value: fmt(data.invest.chinaGoldEtf.market_close, 3), unit: "元/份", change: data.invest.chinaGoldEtf.daily_return_pct, source: "黄金ETF · 上交所", date: data.invest.chinaGoldEtf.market_close_date },
  ];
  return <section id="transmission" className="v5-transmission" aria-label="全球到中国到投资工具的市场传导">
    <div className="v5-transmission-line" aria-hidden="true"><span /><span /><span /></div>
    {stages.map((item, index) => <div className={`v5-stage v5-stage-${index + 1}`} key={item.stage}>
      <div className="v5-stage-heading"><strong>{item.stage}</strong><span>{item.role}</span></div>
      <div className="v5-stage-asset">{item.asset}</div>
      <div className="v5-stage-value">{item.value} <span>{item.unit}</span></div>
      <div className={`v5-stage-change ${tone(item.change)}`}>{pct(item.change)}</div>
      <div className="v5-stage-source">{item.source}</div>
      <span className="sr-only">数据日 {item.date ?? "未知"}</span>
    </div>)}
  </section>;
}

function MarketBrief({ data }: { data: DesignData }) {
  const view = data.whatChanged;
  return <aside id="market-brief" className="v5-brief" aria-labelledby="v5-brief-heading">
    <div className="v5-brief-heading"><h2 id="v5-brief-heading">市场简报</h2><span>What Changed</span></div>
    <span className="v5-brief-window">短线价格表现</span><h3>{view.goldMove.description}</h3>
    <div className="v5-brief-move"><span>{view.goldMove.window} 变化</span><strong className={tone(view.goldMove.changePct)}>{pct(view.goldMove.changePct)}</strong></div>
    <div className="v5-evidence-title">关键证据{view.availability === "partial" && <span> · 部分证据</span>}</div>
    <div className="v5-evidence">
      {view.evidence.length ? view.evidence.slice(0, 3).map((item) => <div className="v5-evidence-item" key={item.id}>
        <div className="v5-evidence-main"><strong>{item.label}</strong><b className={tone(item.change)}>{`${item.change >= 0 ? "+" : ""}${item.change.toFixed(item.unit === "bp" ? 0 : 2)}${item.unit}`}</b></div>
        <div className="v5-evidence-sub">{item.auxiliary ? "辅助确认" : "核心证据"} · {item.startDate} → {item.endDate}{item.stale ? " · 更新较慢" : ""}</div>
      </div>) : <p className="v5-muted">宏观变化数据不足</p>}
    </div>
    <div className="v5-brief-note"><span>综合环境 · 驱动判断</span><strong>{view.environment.label}</strong><p>{view.environment.explanation}</p></div>
    <div className="v5-brief-note"><span>下一观察点</span><strong>{view.nextWatch.label}</strong></div>
    <p className="v5-brief-disclaimer">{view.disclaimer}</p>
  </aside>;
}

export default function CosmicV5Preview({ data }: { data: DesignData }) {
  const goldPoints = data.charts.find((chart) => chart.seriesId === "gold_price")?.points ?? [];
  return <div className="v5-page" data-v5-page="refined-v5">
    <header className="v5-header"><div className="v5-header-inner">
      <a href="#top" className="v5-brand"><span className="v5-brand-mark" aria-hidden="true"><i /><i /></span><h1>黄金市场观察站</h1></a>
      <span className="v5-tagline">看见周期 · 认识价值 · 做更好的决策</span>
      <nav className="v5-nav" aria-label="主导航"><a className="active" href="#top">市场观察</a><a href="#market-brief">研究视角</a><a href="#transmission">数据工具</a><a href="#v5-footer">关于我们</a></nav>
      <span className="v5-context-label">研究工作台</span>
      <span className="v5-mobile-freshness">数据 {formatShanghaiDateTime(data.manifestGeneratedAt).slice(5, 10)} 更新</span>
      <time className="v5-header-time">{formatShanghaiDateTime(data.manifestGeneratedAt).slice(0, 16)}</time>
    </div></header>
    <main id="top">
      <ObservationStrip data={data} />
      <V5DataAvailability missing={data.missing} />
      <div className="v5-workspace">
        <div className="v5-atmosphere" aria-hidden="true" />
        <div className="v5-workspace-inner">
          <div className="v5-canvas"><CosmicCoreChart points={goldPoints} /><Transmission data={data} /></div>
          <MarketBrief data={data} />
          <div className="v5-mobile-risk"><V5EventRisk data={data} /></div>
        </div>
      </div>
      <div className="v5-continuation"><div><span>继续观察</span><strong>研究与证据层</strong><p>跨市场对照、驱动证据、资金流与长期结构</p></div><a href="#v5-research-heading">进入 01 / RESEARCH <span aria-hidden="true">↓</span></a></div>
      <EvidenceLayer data={data} />
      <StructuralLayer data={data} />
      <footer id="v5-footer" className="v5-footer"><strong>黄金市场观察站</strong><span>穿越周期 · 遇见更大的图景</span><small>数据仅用于市场观察，不构成投资建议。</small></footer>
    </main>
  </div>;
}
