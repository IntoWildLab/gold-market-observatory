import type { DesignData } from "@/lib/design-data-builder";

export default function V5EventRisk({ data }: { data: Pick<DesignData, "eventRisk"> }) {
  const risk = data.eventRisk;
  const event = risk.nearestEvent;
  const partial = risk.availability === "partial";
  const stale = risk.stale;
  const verified = risk.provenance.usesVerifiedCache;
  const message = event ? event.title : risk.availability === "unavailable" ? "事件日程不可用" : risk.stale ? "事件日程可能已过期" : partial ? "已获日程暂无重大事件" : "72 小时内无重大事件";
  const qualifiers = [partial ? "部分可用" : null, stale ? "日程可能已过期" : null, verified ? "官方日程已核验" : null].filter(Boolean);
  return <a className={`v5-event${partial ? " partial" : ""}${stale ? " stale" : ""}`} href="#market-brief" data-v5-event-risk data-availability={risk.availability} data-stale={String(stale)} aria-label={`查看市场简报与事件风险：${qualifiers.length ? `${qualifiers.join("，")}，` : ""}${message}`}>
    <span className="v5-calendar" aria-hidden="true" />
    <span className="v5-event-copy"><span>Event Risk 72H{partial && <em>部分可用</em>}{stale && <em>可能过期</em>}{verified && <em>已核验</em>}</span><strong>{message}</strong></span>
    <span className="v5-chevron" aria-hidden="true">›</span>
  </a>;
}
