import { sortAndDedupeEvents } from "../event-risk";
import { parseBlsEventsIcs, BLS_EVENT_SOURCE_URL } from "./bls-events";
import { parseBlsScheduleHtml } from "./bls-events-html";
import { parseBlsReleaseScheduleHtml, type BlsReleaseCategory } from "./bls-release-schedule";
import { fetchOfficialText, type EventFetch } from "./event-http";
import type { EventParserResult } from "../../types/event-risk";

export interface EventFetchOptions {
  fetchImpl?: EventFetch;
  wait?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  maxAttempts?: number;
}

export interface BlsFetchResult extends EventParserResult {
  transport: "ics" | "html_fallback" | "release_schedule_fallback";
  primary_error_code?: string;
  monthly_error_code?: string;
  release_coverage?: { successful: BlsReleaseCategory[]; failed: BlsReleaseCategory[] };
}

export async function fetchBlsEvents(now: Date, options: EventFetchOptions = {}): Promise<BlsFetchResult> {
  let primaryError: unknown;
  try {
    const text = await fetchOfficialText({
      url: BLS_EVENT_SOURCE_URL,
      acceptedContentTypes: ["text/calendar", "text/plain", "application/octet-stream"],
      requiredMarkers: [/BEGIN:VCALENDAR/i, /BEGIN:VEVENT/i],
      requestHeaders: BLS_ICS_HEADERS,
      ...options,
    });
    const result = parseBlsEventsIcs(text);
    if (result.issues.length) throw Object.assign(new Error("BLS ICS contains malformed target events"), { code: `parse_${result.issues[0].code}` });
    return { ...result, transport: "ics" };
  } catch (error) {
    primaryError = error;
  }

  let monthlyError: unknown;
  try {
    const pages = blsSchedulePagesForHorizon(now);
    const parsed = await Promise.all(pages.map(async (page) => {
      const text = await fetchOfficialText({
        url: page.url,
        acceptedContentTypes: ["text/html", "application/xhtml+xml"],
        requiredMarkers: [/Schedule of (?:Selected )?Releases/i, /All times on calendar are Eastern Time/i, /<table\b/i],
        requestHeaders: BLS_HTML_HEADERS,
        ...options,
      });
      return parseBlsScheduleHtml(text, page.url);
    }));
    const issues = parsed.flatMap((result) => result.issues);
    if (issues.length) throw Object.assign(new Error("BLS HTML fallback contains malformed target events"), { code: `parse_${issues[0].code}` });
    return {
      events: sortAndDedupeEvents(parsed.flatMap((result) => result.events)),
      issues: [],
      transport: "html_fallback",
      primary_error_code: errorCode(primaryError),
    };
  } catch (error) {
    monthlyError = error;
  }

  const events = [];
  const issues: EventParserResult["issues"] = [];
  const successful: BlsReleaseCategory[] = [];
  const failed: BlsReleaseCategory[] = [];
  for (const source of BLS_RELEASE_SOURCES) {
    try {
      const text = await fetchOfficialText({
        url: source.url,
        acceptedContentTypes: ["text/html", "application/xhtml+xml"],
        requiredMarkers: [new RegExp(escapeRegex(source.heading), "i"), /Reference Month/i, /Release Date/i, /Release Time/i, /<table\b/i],
        requestHeaders: BLS_HTML_HEADERS,
        ...options,
      });
      const result = parseBlsReleaseScheduleHtml(text, source.category, source.url);
      events.push(...result.events);
      if (result.issues.length) {
        failed.push(source.category);
        issues.push(...result.issues);
      } else {
        successful.push(source.category);
      }
    } catch (error) {
      failed.push(source.category);
      issues.push({ code: "source_unavailable", detail: `${source.category}: ${errorCode(error)}` });
    }
  }
  return {
    events: sortAndDedupeEvents(events),
    issues,
    transport: "release_schedule_fallback",
    primary_error_code: errorCode(primaryError),
    monthly_error_code: errorCode(monthlyError),
    release_coverage: { successful, failed },
  };
}

const BLS_ICS_HEADERS = {
  accept: "text/calendar,text/plain;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.8",
} as const;

const BLS_HTML_HEADERS = {
  accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.8",
} as const;

const BLS_RELEASE_SOURCES: ReadonlyArray<{ category: BlsReleaseCategory; heading: string; url: string }> = [
  { category: "us_cpi", heading: "Schedule of Releases for the Consumer Price Index", url: "https://www.bls.gov/schedule/news_release/cpi.htm" },
  { category: "us_employment_situation", heading: "Schedule of Releases for the Employment Situation", url: "https://www.bls.gov/schedule/news_release/empsit.htm" },
  { category: "us_ppi", heading: "Schedule of Releases for the Producer Price Index", url: "https://www.bls.gov/schedule/news_release/ppi.htm" },
];

export function blsSchedulePagesForHorizon(now: Date, horizonHours: 72 = 72): Array<{ year: number; month: number; url: string }> {
  if (!Number.isFinite(now.getTime())) throw new Error("now is invalid");
  if (!Number.isFinite(horizonHours) || horizonHours < 0) throw new Error("horizonHours is invalid");
  const instants = [now, new Date(now.getTime() + horizonHours * 60 * 60 * 1000)];
  const unique = new Map<string, { year: number; month: number; url: string }>();
  for (const instant of instants) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", calendar: "gregory", numberingSystem: "latn", year: "numeric", month: "numeric",
    }).formatToParts(instant).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    const year = parts.year;
    const month = parts.month;
    const key = `${year}-${month}`;
    unique.set(key, { year, month, url: `https://www.bls.gov/schedule/${year}/${String(month).padStart(2, "0")}_sched_list.htm` });
  }
  return [...unique.values()];
}

function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  return "source_error";
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
