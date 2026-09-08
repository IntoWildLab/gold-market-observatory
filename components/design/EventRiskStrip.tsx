import type { DesignData } from "@/lib/design-data";

type EventRisk = DesignData["eventRisk"];
type EventStatus = NonNullable<EventRisk["nearestEvent"]>["status"];

const ET_TIME_ZONE = "America/New_York";

const STATUS_STYLE: Record<EventStatus, { border: string; background: string; timing: string; timingClass: string }> = {
  upcoming: { border: "#d8c7a4", background: "#ffffff", timing: "#7a4f18", timingClass: "text-xl" },
  high_attention: { border: "#c59a55", background: "#fdfbf7", timing: "#7a4f18", timingClass: "text-xl font-bold" },
  imminent: { border: "#a87324", background: "#fbf7ee", timing: "#65400f", timingClass: "text-2xl font-bold" },
  now: { border: "#8d5d18", background: "#f3ead8", timing: "#56360d", timingClass: "text-2xl font-extrabold" },
};

export function formatEventTimeEt(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Schedule time unavailable";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TIME_ZONE,
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("month")} ${part("day")} · ${part("hour")}:${part("minute")} ET`;
}

export function formatEventDistance(scheduledAt: string, now: Date): string {
  const deltaMinutes = Math.max(0, Math.ceil((Date.parse(scheduledAt) - now.getTime()) / 60_000));
  if (!Number.isFinite(deltaMinutes) || deltaMinutes <= 0) return "NOW";
  if (deltaMinutes < 120) return `${deltaMinutes}M`;
  const hours = Math.ceil(deltaMinutes / 60);
  if (hours < 48) return `${hours}H`;
  return `${Math.round(hours / 24)}D`;
}

export function sourceLabel(sourceName: string): string {
  if (sourceName === "U.S. Bureau of Labor Statistics") return "BLS";
  if (sourceName === "Federal Reserve Board") return "Federal Reserve";
  if (sourceName === "U.S. Bureau of Economic Analysis") return "BEA";
  return sourceName;
}

export default function EventRiskStrip({ eventRisk, now = new Date() }: { eventRisk: EventRisk; now?: Date }) {
  const event = eventRisk.nearestEvent;
  const staleWithoutEvent = eventRisk.stale && !event;
  const emptyMessage = eventRisk.availability === "unavailable"
    ? "Schedule unavailable"
    : staleWithoutEvent
      ? "Schedule may be stale"
      : "No major event within 72h";

  if (!event) {
    return (
      <aside
        aria-label="Event risk for the next 72 hours"
        className="min-w-0 rounded-lg border border-l-2 px-3.5 py-3 sm:px-4"
        style={{ background: "#fdfbf7", borderColor: eventRisk.availability === "unavailable" ? "#d8d0c2" : "#d8c7a4" }}
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <div className="font-mono text-[12px] font-semibold tracking-[0.18em] text-[#7a4f18]">EVENT RISK · 72H</div>
          <div className="text-[14px] font-medium text-[#575249]">{emptyMessage}</div>
        </div>
        {staleWithoutEvent && eventRisk.generatedAt && <div className="mt-1 text-[12px] text-[#8a857a]">Last schedule update · {formatEventTimeEt(eventRisk.generatedAt)}</div>}
      </aside>
    );
  }

  const visual = STATUS_STYLE[event.status];
  const timing = event.status === "now" ? "NOW" : formatEventDistance(event.scheduledAt, now);
  const impact = `${event.impact.toUpperCase()} IMPACT`;

  return (
    <aside
      aria-label="Event risk for the next 72 hours"
      className="min-w-0 rounded-lg border border-l-[3px] px-3.5 py-3 sm:px-4"
      style={{ background: visual.background, borderColor: visual.border }}
    >
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[9.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
        <div className="min-w-0">
          <div className="font-mono text-[12px] font-semibold tracking-[0.18em] text-[#7a4f18]">EVENT RISK · 72H</div>
          <div className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[12px] font-semibold tracking-[0.08em] ${event.impact === "high" ? "text-[#65400f]" : "text-[#7d766a]"}`} style={{ borderColor: event.impact === "high" ? "#c59a55" : "#ded7ca" }}>
            {impact}
          </div>
        </div>

        <div className="min-w-0">
          <div className="break-words text-[15px] font-semibold leading-snug text-[#2b2a26] sm:text-base">{event.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#7d766a] sm:text-[13px]">
            <span className="font-mono text-[#575249]">{formatEventTimeEt(event.scheduledAt)}</span>
            <span aria-hidden="true">·</span>
            <span>Direction unknown</span>
            {eventRisk.additionalEventCount > 0 && (
              <span className="rounded bg-[#f0ede6] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#6b6459]">
                +{eventRisk.additionalEventCount} {eventRisk.additionalEventCount === 1 ? "EVENT" : "EVENTS"}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#8a857a]">
            <a className="rounded-sm underline decoration-[#c9b38b] underline-offset-2 hover:text-[#7a4f18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8d5d18]" href={event.sourceUrl} target="_blank" rel="noreferrer">
              {sourceLabel(event.sourceName)} source
            </a>
            {eventRisk.provenance.usesVerifiedCache && <span>Official schedule · verified</span>}
            {eventRisk.stale && <span>Schedule may be stale</span>}
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-3 border-t pt-2 sm:block sm:border-0 sm:pt-0 sm:text-right" style={{ borderColor: "#e8e1d1" }}>
          <span className="text-[12px] text-[#8a857a] sm:block">TIME TO EVENT</span>
          <span suppressHydrationWarning className={`font-mono leading-none ${visual.timingClass}`} style={{ color: visual.timing }}>{timing}</span>
        </div>
      </div>
    </aside>
  );
}
