import { readFile } from "node:fs/promises";
import { buildEventRiskEvent, normalizeUtcIso, sortAndDedupeEvents } from "../event-risk";
import type {
  BlsVerifiedCacheCategory,
  BlsVerifiedCacheEvent,
  BlsVerifiedCacheSource,
  BlsVerifiedScheduleCache,
  EventRiskEvent,
} from "../../types/event-risk";

export const BLS_VERIFIED_CACHE_MAX_AGE_HOURS = 168 as const;

const SOURCE_NAME = "U.S. Bureau of Labor Statistics" as const;
const TIMEZONE = "America/New_York" as const;
const CATEGORY_ORDER: readonly BlsVerifiedCacheCategory[] = ["us_cpi", "us_employment_situation", "us_ppi"];
const SOURCE_URLS: Readonly<Record<BlsVerifiedCacheCategory, string>> = {
  us_cpi: "https://www.bls.gov/schedule/news_release/cpi.htm",
  us_employment_situation: "https://www.bls.gov/schedule/news_release/empsit.htm",
  us_ppi: "https://www.bls.gov/schedule/news_release/ppi.htm",
};
const TITLES: Readonly<Record<BlsVerifiedCacheCategory, string>> = {
  us_cpi: "US Consumer Price Index (CPI)",
  us_employment_situation: "US Employment Situation",
  us_ppi: "US Producer Price Index (PPI)",
};
const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const REFERENCE_PERIOD = new RegExp(`^(?:${MONTHS}) \\d{4}$`);

export async function readBlsVerifiedScheduleCache(file: string): Promise<BlsVerifiedScheduleCache> {
  const text = await readFile(file, "utf8");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("BLS verified cache is not valid JSON");
  }
  return validateBlsVerifiedScheduleCache(value);
}

export function validateBlsVerifiedScheduleCache(value: unknown): BlsVerifiedScheduleCache {
  const root = requireRecord(value, "BLS verified cache");
  requireExactKeys(root, ["schema_version", "source_name", "verified_at", "timezone", "sources", "events"], "BLS verified cache");
  if (root.schema_version !== 1) throw new Error("BLS verified cache schema_version must be 1");
  if (root.source_name !== SOURCE_NAME) throw new Error("BLS verified cache source_name is invalid");
  if (root.timezone !== TIMEZONE) throw new Error("BLS verified cache timezone is invalid");
  if (typeof root.verified_at !== "string") throw new Error("BLS verified cache verified_at is invalid");
  const verifiedAt = normalizeUtcIso(root.verified_at);
  if (!Array.isArray(root.sources) || !Array.isArray(root.events)) throw new Error("BLS verified cache arrays are invalid");

  const sources = root.sources.map((source, index) => validateSource(source, index));
  if (sources.length !== CATEGORY_ORDER.length || CATEGORY_ORDER.some((category, index) => sources[index]?.category !== category)) {
    throw new Error("BLS verified cache source coverage or order is invalid");
  }
  const events = root.events.map((event, index) => validateEvent(event, index));
  const eventKeys = new Set<string>();
  for (const event of events) {
    const key = [event.category, event.reference_period, event.scheduled_at, event.source_url].join("|");
    if (eventKeys.has(key)) throw new Error("BLS verified cache contains a duplicate event");
    eventKeys.add(key);
  }
  const sortedEvents = [...events].sort(compareCacheEvents);
  if (JSON.stringify(events) !== JSON.stringify(sortedEvents)) throw new Error("BLS verified cache events are not deterministically sorted");
  return { schema_version: 1, source_name: SOURCE_NAME, verified_at: verifiedAt, timezone: TIMEZONE, sources, events };
}

export function isBlsVerifiedScheduleCacheFresh(cache: Pick<BlsVerifiedScheduleCache, "verified_at">, now: Date): boolean {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error("now is invalid");
  const ageMs = nowMs - Date.parse(normalizeUtcIso(cache.verified_at));
  return ageMs >= 0 && ageMs <= BLS_VERIFIED_CACHE_MAX_AGE_HOURS * 60 * 60 * 1000;
}

export function eventsFromBlsVerifiedScheduleCache(cache: BlsVerifiedScheduleCache): EventRiskEvent[] {
  return sortAndDedupeEvents(cache.events.map((event) => buildEventRiskEvent({
    title: TITLES[event.category],
    category: event.category,
    scheduled_at: event.scheduled_at,
    source_name: SOURCE_NAME,
    source_url: event.source_url,
    note: `Verified official BLS schedule cache; reference period: ${event.reference_period}; verified at ${cache.verified_at}`,
  })));
}

function validateSource(value: unknown, index: number): BlsVerifiedCacheSource {
  const source = requireRecord(value, `BLS verified cache source ${index}`);
  requireExactKeys(source, ["category", "source_url"], `BLS verified cache source ${index}`);
  const category = requireCategory(source.category);
  requireOfficialUrl(category, source.source_url);
  return { category, source_url: SOURCE_URLS[category] };
}

function validateEvent(value: unknown, index: number): BlsVerifiedCacheEvent {
  const event = requireRecord(value, `BLS verified cache event ${index}`);
  requireExactKeys(event, ["category", "reference_period", "scheduled_at", "source_url"], `BLS verified cache event ${index}`);
  const category = requireCategory(event.category);
  if (typeof event.reference_period !== "string" || !REFERENCE_PERIOD.test(event.reference_period)) {
    throw new Error(`BLS verified cache event ${index} reference_period is invalid`);
  }
  if (typeof event.scheduled_at !== "string") throw new Error(`BLS verified cache event ${index} scheduled_at is invalid`);
  const scheduledAt = normalizeUtcIso(event.scheduled_at);
  requireOfficialUrl(category, event.source_url);
  return { category, reference_period: event.reference_period, scheduled_at: scheduledAt, source_url: SOURCE_URLS[category] };
}

function requireCategory(value: unknown): BlsVerifiedCacheCategory {
  if (typeof value !== "string" || !CATEGORY_ORDER.includes(value as BlsVerifiedCacheCategory)) {
    throw new Error("BLS verified cache category is invalid");
  }
  return value as BlsVerifiedCacheCategory;
}

function requireOfficialUrl(category: BlsVerifiedCacheCategory, value: unknown): void {
  if (value !== SOURCE_URLS[category]) throw new Error(`BLS verified cache source_url is invalid for ${category}`);
}

function compareCacheEvents(a: BlsVerifiedCacheEvent, b: BlsVerifiedCacheEvent): number {
  return a.scheduled_at.localeCompare(b.scheduled_at)
    || CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    || a.reference_period.localeCompare(b.reference_period)
    || a.source_url.localeCompare(b.source_url);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function requireExactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) throw new Error(`${label} fields are invalid`);
}
