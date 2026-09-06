import { createHash } from "node:crypto";
import type {
  EventRiskCategory,
  EventRiskEvent,
  EventRiskImpact,
  EventRiskStatus,
} from "../types/event-risk";

export const EVENT_TIMEZONE = "America/New_York" as const;
const HOUR_MS = 60 * 60 * 1000;

export interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
}

const IMPACT_BY_CATEGORY: Readonly<Partial<Record<EventRiskCategory, EventRiskImpact>>> = {
  fomc_policy_decision: "high",
  fomc_press_conference: "high",
  fomc_minutes: "medium",
  us_cpi: "high",
  us_employment_situation: "high",
  us_pce: "high",
  us_ppi: "medium",
  fed_chair_speech: "high",
  fed_chair_testimony: "high",
};

export const DEFAULT_EVENT_WINDOW_MINUTES: Readonly<Record<EventRiskCategory, number>> = {
  fomc_policy_decision: 30,
  fomc_press_conference: 60,
  fomc_minutes: 15,
  us_cpi: 15,
  us_employment_situation: 15,
  us_pce: 15,
  us_ppi: 15,
  fed_chair_speech: 60,
  fed_chair_testimony: 60,
};

export class EventParserStructureError extends Error {
  readonly code = "unexpected_structure" as const;

  constructor(source: string, detail: string) {
    super(`${source}: ${detail}`);
    this.name = "EventParserStructureError";
  }
}

export function impactForCategory(category: string): EventRiskImpact | null {
  return IMPACT_BY_CATEGORY[category as EventRiskCategory] ?? null;
}

export function canonicalizeEventTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function createEventRiskId(input: Pick<EventRiskEvent, "source_name" | "category" | "scheduled_at" | "title">): string {
  const identity = [
    input.source_name,
    input.category,
    normalizeUtcIso(input.scheduled_at),
    canonicalizeEventTitle(input.title),
  ].join("|");
  return `event_${createHash("sha256").update(identity).digest("hex").slice(0, 20)}`;
}

export function buildEventRiskEvent(input: Omit<EventRiskEvent, "id" | "direction" | "timezone" | "impact">): EventRiskEvent {
  if (Object.prototype.hasOwnProperty.call(input, "impact")) {
    throw new Error("Event Risk impact is derived from category and cannot be supplied");
  }
  const impact = impactForCategory(input.category);
  if (!impact) throw new Error(`Unknown Event Risk category: ${input.category}`);
  const scheduledAt = normalizeUtcIso(input.scheduled_at);
  const suppliedEnd = input.ends_at ? normalizeUtcIso(input.ends_at) : null;
  const startMs = parseUtcIso(scheduledAt, "scheduled_at");
  const suppliedEndMs = suppliedEnd ? parseUtcIso(suppliedEnd, "ends_at") : null;
  if (suppliedEndMs !== null && suppliedEndMs < startMs) throw new Error("Event ends_at precedes scheduled_at");
  const endsAt = suppliedEndMs !== null && suppliedEndMs > startMs
    ? suppliedEnd as string
    : new Date(startMs + defaultEventWindowMs(input.category)).toISOString();
  const event: EventRiskEvent = {
    ...input,
    scheduled_at: scheduledAt,
    ends_at: endsAt,
    timezone: EVENT_TIMEZONE,
    impact,
    direction: "unknown",
    id: "",
  };
  event.id = createEventRiskId(event);
  return event;
}

export function classifyEventRiskStatus(
  event: Pick<EventRiskEvent, "category" | "scheduled_at" | "ends_at">,
  now: Date,
): EventRiskStatus {
  const nowMs = requireValidDate(now, "now");
  const startMs = parseUtcIso(event.scheduled_at, "scheduled_at");
  const suppliedEndMs = event.ends_at ? parseUtcIso(event.ends_at, "ends_at") : null;
  const endMs = suppliedEndMs !== null && suppliedEndMs > startMs
    ? suppliedEndMs
    : startMs + defaultEventWindowMs(event.category);
  if (endMs < startMs) throw new Error("Event ends_at precedes scheduled_at");
  if (nowMs >= startMs && nowMs < endMs) return "now";
  const delta = startMs - nowMs;
  if (delta < 0 || delta > 72 * HOUR_MS) return "hidden";
  if (delta >= 24 * HOUR_MS) return "upcoming";
  if (delta >= 6 * HOUR_MS) return "high_attention";
  if (delta > 0) return "imminent";
  return "now";
}

export function visibleEventRiskEvents(events: readonly EventRiskEvent[], now: Date): EventRiskEvent[] {
  return sortAndDedupeEvents(events).filter((event) => classifyEventRiskStatus(event, now) !== "hidden");
}

export function sortAndDedupeEvents(events: readonly EventRiskEvent[]): EventRiskEvent[] {
  const byId = new Map<string, EventRiskEvent>();
  for (const event of events) {
    const normalized = buildEventRiskEvent({
      title: event.title,
      category: event.category,
      scheduled_at: event.scheduled_at,
      ends_at: event.ends_at,
      source_name: event.source_name,
      source_url: event.source_url,
      note: event.note,
    });
    const existing = byId.get(normalized.id);
    if (!existing) byId.set(normalized.id, normalized);
    else {
      byId.set(normalized.id, mergeDuplicate(existing, normalized));
    }
  }
  return [...byId.values()].sort((a, b) =>
    a.scheduled_at.localeCompare(b.scheduled_at)
      || impactRank(a.impact) - impactRank(b.impact)
      || a.id.localeCompare(b.id));
}

export function zonedDateTimeToUtcIso(parts: LocalDateTimeParts, timeZone: string = EVENT_TIMEZONE): string {
  validateLocalParts(parts);
  if (timeZone !== EVENT_TIMEZONE) throw new Error(`Unsupported Event Risk timezone: ${timeZone}`);
  const second = parts.second ?? 0;
  const naiveUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, second);
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const instant = naiveUtc + hours * HOUR_MS;
    offsets.add(localPartsAsUtcMs(instant, timeZone) - instant);
  }
  const matches = [...offsets]
    .map((offset) => naiveUtc - offset)
    .filter((instant) => sameLocalParts(formatLocalParts(instant, timeZone), { ...parts, second }));
  if (matches.length !== 1) {
    throw new Error(matches.length ? "Ambiguous America/New_York local time" : "Invalid America/New_York local time");
  }
  return new Date(matches[0]).toISOString();
}

function formatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatLocalParts(instant: number, timeZone: string): Required<LocalDateTimeParts> {
  const values: Record<string, number> = {};
  for (const part of formatter(timeZone).formatToParts(new Date(instant))) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function localPartsAsUtcMs(instant: number, timeZone: string): number {
  const p = formatLocalParts(instant, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

function sameLocalParts(a: Required<LocalDateTimeParts>, b: Required<LocalDateTimeParts>): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
    && a.hour === b.hour && a.minute === b.minute && a.second === b.second;
}

function validateLocalParts(parts: LocalDateTimeParts): void {
  const values = [parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second ?? 0];
  if (!values.every(Number.isInteger)) throw new Error("Local date-time parts must be integers");
  const candidate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second ?? 0));
  if (candidate.getUTCFullYear() !== parts.year || candidate.getUTCMonth() !== parts.month - 1
    || candidate.getUTCDate() !== parts.day || candidate.getUTCHours() !== parts.hour
    || candidate.getUTCMinutes() !== parts.minute || candidate.getUTCSeconds() !== (parts.second ?? 0)) {
    throw new Error("Invalid local date-time parts");
  }
}

export function normalizeUtcIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/.exec(value);
  if (!match) {
    throw new Error("Event date-time must be an explicit UTC ISO-8601 value ending in Z");
  }
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const millisecond = Number(match[7] ?? 0);
  const instant = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const roundTrip = new Date(instant);
  if (roundTrip.getUTCFullYear() !== year || roundTrip.getUTCMonth() !== month - 1
    || roundTrip.getUTCDate() !== day || roundTrip.getUTCHours() !== hour
    || roundTrip.getUTCMinutes() !== minute || roundTrip.getUTCSeconds() !== second
    || roundTrip.getUTCMilliseconds() !== millisecond) {
    throw new Error("Event date-time contains invalid UTC calendar fields");
  }
  return roundTrip.toISOString();
}

function parseUtcIso(value: string, label: string): number {
  try {
    return Date.parse(normalizeUtcIso(value));
  } catch {
    throw new Error(`${label} is not a valid UTC ISO date-time`);
  }
}

function requireValidDate(value: Date, label: string): number {
  const time = value.getTime();
  if (!Number.isFinite(time)) throw new Error(`${label} is invalid`);
  return time;
}

function impactRank(impact: EventRiskImpact): number {
  return impact === "high" ? 0 : 1;
}

function defaultEventWindowMs(category: EventRiskCategory): number {
  const minutes = DEFAULT_EVENT_WINDOW_MINUTES[category];
  if (!(minutes > 0)) throw new Error(`Missing Event Risk window for category: ${category}`);
  return minutes * 60_000;
}

function mergeDuplicate(a: EventRiskEvent, b: EventRiskEvent): EventRiskEvent {
  const endsAt = [a.ends_at, b.ends_at].filter((value): value is string => Boolean(value)).sort().at(-1);
  return {
    ...a,
    title: preferredText(a.title, b.title) as string,
    ends_at: endsAt,
    source_url: preferredUrl(a.source_url, b.source_url),
    note: preferredText(a.note, b.note),
  };
}

function preferredText(a?: string, b?: string): string | undefined {
  const values = [...new Set([a, b].filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))];
  return values.sort((left, right) => right.length - left.length || compareCodePoints(left, right))[0];
}

function preferredUrl(a: string, b: string): string {
  return [a, b].sort((left, right) => urlSpecificity(right) - urlSpecificity(left) || compareCodePoints(left, right))[0];
}

function urlSpecificity(value: string): number {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" ? 10_000 : 0) + url.pathname.replace(/\/$/, "").length + url.search.length;
  } catch {
    return -1;
  }
}

function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
