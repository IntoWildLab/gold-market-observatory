import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildEventRiskEvent, createEventRiskId, impactForCategory, normalizeUtcIso, sortAndDedupeEvents, visibleEventRiskEvents } from "./event-risk";
import { fetchBeaEvents } from "./data-sources/bea-events-fetch";
import { fetchBlsEvents, type EventFetchOptions } from "./data-sources/bls-events-fetch";
import { eventsFromBlsVerifiedScheduleCache, isBlsVerifiedScheduleCacheFresh, readBlsVerifiedScheduleCache, validateBlsVerifiedScheduleCache } from "./data-sources/bls-verified-cache";
import { EventSourceFetchError } from "./data-sources/event-http";
import { fetchFedCalendarEvents, fetchFedChairIdentity } from "./data-sources/fed-events-fetch";
import type {
  EventParserResult,
  EventRiskEvent,
  EventRiskSnapshot,
  EventRiskSnapshotSourceName,
  EventRiskSourceStatus,
  FedChairIdentity,
  BlsVerifiedScheduleCache,
} from "../types/event-risk";

export const EVENT_RISK_HORIZON_HOURS = 72 as const;
export const EVENT_RISK_STALE_AFTER_HOURS = 36 as const;

const SOURCE_ORDER: readonly EventRiskSnapshotSourceName[] = [
  "Federal Reserve Chair Identity",
  "Federal Reserve Calendar",
  "U.S. Bureau of Labor Statistics Calendar",
  "U.S. Bureau of Economic Analysis Schedule",
];

export interface FetchEventRiskSnapshotOptions extends EventFetchOptions {
  now: Date;
  blsVerifiedCache?: unknown;
  blsVerifiedCachePath?: string;
}

export async function fetchEventRiskSnapshot(options: FetchEventRiskSnapshotOptions): Promise<EventRiskSnapshot> {
  const generatedAt = normalizeUtcIso(options.now.toISOString());
  const sourceStatuses: EventRiskSourceStatus[] = [];
  const events: EventRiskEvent[] = [];
  const fetchOptions: EventFetchOptions = {
    fetchImpl: options.fetchImpl,
    wait: options.wait,
    timeoutMs: options.timeoutMs,
    maxAttempts: options.maxAttempts,
  };

  let chairIdentity: FedChairIdentity | undefined;
  try {
    chairIdentity = await fetchFedChairIdentity(fetchOptions);
    sourceStatuses.push(okStatus("Federal Reserve Chair Identity", generatedAt));
  } catch (error) {
    sourceStatuses.push(failedStatus("Federal Reserve Chair Identity", generatedAt, errorCode(error)));
  }

  const acquisitions = await Promise.all([
    acquire("Federal Reserve Calendar", generatedAt, () => fetchFedCalendarEvents(options.now, chairIdentity, fetchOptions), chairIdentity ? [] : ["chair_identity_unavailable"]),
    acquireBls(generatedAt, options, fetchOptions),
    acquire("U.S. Bureau of Economic Analysis Schedule", generatedAt, () => fetchBeaEvents(yearInNewYork(options.now), fetchOptions)),
  ]);
  for (const acquisition of acquisitions) {
    sourceStatuses.push(acquisition.status);
    events.push(...acquisition.events);
  }
  sourceStatuses.sort((a, b) => SOURCE_ORDER.indexOf(a.name) - SOURCE_ORDER.indexOf(b.name));

  const contributing = acquisitions.filter((item) => item.status.status === "ok" || item.events.length > 0);
  const allOk = sourceStatuses.every((source) => source.status === "ok");
  const snapshot: EventRiskSnapshot = {
    schema_version: 1,
    generated_at: generatedAt,
    horizon_hours: EVENT_RISK_HORIZON_HOURS,
    availability: allOk ? "available" : contributing.length ? "partial" : "unavailable",
    sources: sourceStatuses,
    events: visibleEventRiskEvents(events, options.now),
  };
  validateEventRiskSnapshot(snapshot);
  return snapshot;
}

export function isEventRiskSnapshotStale(snapshot: Pick<EventRiskSnapshot, "generated_at">, now: Date): boolean {
  const generatedMs = Date.parse(normalizeUtcIso(snapshot.generated_at));
  if (!Number.isFinite(now.getTime())) throw new Error("now is invalid");
  return now.getTime() - generatedMs > EVENT_RISK_STALE_AFTER_HOURS * 60 * 60 * 1000;
}

export function validateEventRiskSnapshot(snapshot: EventRiskSnapshot): void {
  if (snapshot.schema_version !== 1) throw new Error("Event Risk snapshot schema_version must be 1");
  normalizeUtcIso(snapshot.generated_at);
  if (snapshot.horizon_hours !== EVENT_RISK_HORIZON_HOURS) throw new Error("Event Risk snapshot horizon_hours must be 72");
  if (!["available", "partial", "unavailable"].includes(snapshot.availability)) throw new Error("Event Risk snapshot availability is invalid");
  if (snapshot.sources.length !== SOURCE_ORDER.length || new Set(snapshot.sources.map((source) => source.name)).size !== SOURCE_ORDER.length
    || SOURCE_ORDER.some((name, index) => snapshot.sources[index]?.name !== name)) {
    throw new Error("Event Risk snapshot source coverage is invalid");
  }
  for (const source of snapshot.sources) {
    if (source.status !== "ok" && source.status !== "failed") throw new Error(`${source.name}: source status is invalid`);
    normalizeUtcIso(source.fetched_at);
    if (source.status === "failed" && !source.error_code) throw new Error(`${source.name}: failed source requires error_code`);
    if (source.status === "ok" && source.error_code) throw new Error(`${source.name}: successful source cannot have error_code`);
    if (source.name !== "U.S. Bureau of Labor Statistics Calendar" && (source.mode || source.verified_at)) {
      throw new Error(`${source.name}: cache provenance is only valid for BLS`);
    }
    if (source.name === "U.S. Bureau of Labor Statistics Calendar" && source.mode !== "live" && source.mode !== "verified_cache") {
      throw new Error(`${source.name}: source mode is invalid`);
    }
    if (source.mode === "verified_cache") {
      if (source.status !== "failed" || !source.error_code || !source.verified_at) throw new Error(`${source.name}: verified cache provenance is incomplete`);
      normalizeUtcIso(source.verified_at);
    } else if (source.verified_at) {
      throw new Error(`${source.name}: live source cannot have cache verified_at`);
    }
  }
  const ids = new Set<string>();
  for (const event of snapshot.events) {
    const normalized = buildEventRiskEvent({
      title: event.title,
      category: event.category,
      scheduled_at: event.scheduled_at,
      ends_at: event.ends_at,
      source_name: event.source_name,
      source_url: event.source_url,
      note: event.note,
    });
    if (event.id !== createEventRiskId(event) || event.id !== normalized.id) throw new Error(`${event.id}: event ID is invalid`);
    if (event.direction !== "unknown") throw new Error(`${event.id}: direction must be unknown`);
    if (event.impact !== impactForCategory(event.category)) throw new Error(`${event.id}: impact does not match category`);
    if (event.timezone !== "America/New_York") throw new Error(`${event.id}: timezone is invalid`);
    if (!event.ends_at || Date.parse(event.ends_at) <= Date.parse(event.scheduled_at)) throw new Error(`${event.id}: event window is invalid`);
    const generatedMs = Date.parse(snapshot.generated_at);
    const scheduledMs = Date.parse(event.scheduled_at);
    const endsMs = Date.parse(event.ends_at);
    if (endsMs <= generatedMs || scheduledMs - generatedMs > EVENT_RISK_HORIZON_HOURS * 60 * 60 * 1000) {
      throw new Error(`${event.id}: event is outside the snapshot horizon`);
    }
    validateOfficialEventUrl(event);
    if (ids.has(event.id)) throw new Error(`${event.id}: duplicate event ID`);
    ids.add(event.id);
  }
  const sorted = sortAndDedupeEvents(snapshot.events);
  if (JSON.stringify(sorted) !== JSON.stringify(snapshot.events)) throw new Error("Event Risk events are not deterministically sorted");
  const calendarNames = new Set<EventRiskSnapshotSourceName>([
    "Federal Reserve Calendar",
    "U.S. Bureau of Labor Statistics Calendar",
    "U.S. Bureau of Economic Analysis Schedule",
  ]);
  const anyCalendarOk = snapshot.sources.some((source) => calendarNames.has(source.name) && source.status === "ok");
  const expectedAvailability = snapshot.sources.every((source) => source.status === "ok") ? "available"
    : anyCalendarOk || snapshot.events.length ? "partial" : "unavailable";
  if (snapshot.availability !== expectedAvailability) throw new Error("Event Risk snapshot availability is inconsistent with source coverage");
  rejectDynamicFields(snapshot as unknown as Record<string, unknown>);
}

export async function writeEventRiskSnapshotAtomic(file: string, snapshot: EventRiskSnapshot): Promise<void> {
  validateEventRiskSnapshot(snapshot);
  const directory = path.dirname(file);
  await mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await rename(temporary, file);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

async function acquire(
  name: EventRiskSnapshotSourceName,
  fetchedAt: string,
  operation: () => Promise<EventParserResult>,
  ignoredIssueCodes: readonly string[] = [],
): Promise<{ status: EventRiskSourceStatus; events: EventRiskEvent[] }> {
  try {
    const result = await operation();
    const materialIssues = result.issues.filter((issue) => !ignoredIssueCodes.includes(issue.code));
    return {
      status: materialIssues.length ? failedStatus(name, fetchedAt, `parse_${materialIssues[0].code}`) : okStatus(name, fetchedAt),
      events: result.events,
    };
  } catch (error) {
    return { status: failedStatus(name, fetchedAt, errorCode(error)), events: [] };
  }
}

async function acquireBls(
  fetchedAt: string,
  options: FetchEventRiskSnapshotOptions,
  fetchOptions: EventFetchOptions,
): Promise<{ status: EventRiskSourceStatus; events: EventRiskEvent[] }> {
  let liveErrorCode: string;
  try {
    const result = await fetchBlsEvents(options.now, fetchOptions);
    if (result.issues.length === 0) {
      return { status: { ...okStatus("U.S. Bureau of Labor Statistics Calendar", fetchedAt), mode: "live" }, events: result.events };
    }
    liveErrorCode = `parse_${result.issues[0].code}`;
  } catch (error) {
    liveErrorCode = errorCode(error);
  }

  const cache = await eligibleBlsCache(options).catch(() => undefined);
  if (cache) {
    return {
      status: {
        ...failedStatus("U.S. Bureau of Labor Statistics Calendar", fetchedAt, liveErrorCode),
        mode: "verified_cache",
        verified_at: cache.verified_at,
      },
      events: eventsFromBlsVerifiedScheduleCache(cache),
    };
  }
  return {
    status: { ...failedStatus("U.S. Bureau of Labor Statistics Calendar", fetchedAt, liveErrorCode), mode: "live" },
    events: [],
  };
}

async function eligibleBlsCache(options: FetchEventRiskSnapshotOptions): Promise<BlsVerifiedScheduleCache | undefined> {
  if (options.blsVerifiedCache === undefined && !options.blsVerifiedCachePath) return undefined;
  const cache = options.blsVerifiedCache !== undefined
    ? validateBlsVerifiedScheduleCache(options.blsVerifiedCache)
    : await readBlsVerifiedScheduleCache(options.blsVerifiedCachePath as string);
  return isBlsVerifiedScheduleCacheFresh(cache, options.now) ? cache : undefined;
}

function okStatus(name: EventRiskSnapshotSourceName, fetchedAt: string): EventRiskSourceStatus {
  return { name, status: "ok", fetched_at: fetchedAt };
}

function failedStatus(name: EventRiskSnapshotSourceName, fetchedAt: string, code: string): EventRiskSourceStatus {
  return { name, status: "failed", fetched_at: fetchedAt, error_code: code };
}

function errorCode(error: unknown): string {
  if (error instanceof EventSourceFetchError) return error.code;
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  return "source_error";
}

function validateOfficialEventUrl(event: EventRiskEvent): void {
  let url: URL;
  try { url = new URL(event.source_url); } catch { throw new Error(`${event.id}: source_url is invalid`); }
  const expectedDomain = event.source_name === "Federal Reserve Board" ? "federalreserve.gov"
    : event.source_name === "U.S. Bureau of Labor Statistics" ? "bls.gov" : "bea.gov";
  if (url.protocol !== "https:" || (url.hostname !== expectedDomain && !url.hostname.endsWith(`.${expectedDomain}`))) {
    throw new Error(`${event.id}: source_url is not an allowed official domain`);
  }
}

function rejectDynamicFields(value: Record<string, unknown>): void {
  const forbidden = new Set(["hours_until", "countdown", "status", "upcoming", "imminent", "bullish", "bearish", "predicted_direction"]);
  const visit = (item: unknown): void => {
    if (!item || typeof item !== "object") return;
    for (const [key, child] of Object.entries(item)) {
      const sourceStatus = key === "status" && "name" in item && "fetched_at" in item;
      if (forbidden.has(key) && !sourceStatus) throw new Error(`Event Risk snapshot contains forbidden dynamic field: ${key}`);
      visit(child);
    }
  };
  visit(value);
}

function yearInNewYork(now: Date): number {
  const year = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", calendar: "gregory", numberingSystem: "latn", year: "numeric",
  }).formatToParts(now).find((part) => part.type === "year")?.value;
  if (!year) throw new Error("Unable to determine Event Risk calendar year");
  return Number(year);
}
