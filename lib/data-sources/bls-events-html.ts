import { buildEventRiskEvent, EventParserStructureError, sortAndDedupeEvents, zonedDateTimeToUtcIso } from "../event-risk";
import { canonicalBlsTitle, classifyBlsTitle } from "./bls-events";
import type { EventParserIssue, EventParserResult } from "../../types/event-risk";

const SOURCE_NAME = "U.S. Bureau of Labor Statistics" as const;

export function parseBlsScheduleHtml(html: string, sourceUrl: string): EventParserResult {
  const pageText = toText(html);
  if (!/<(?:html|table|tr)\b/i.test(html)
    || !/Schedule of (?:Selected )?Releases/i.test(pageText)
    || !/All times on calendar are Eastern Time/i.test(pageText)) {
    throw new EventParserStructureError("BLS HTML", "response is not a recognizable BLS release schedule");
  }
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => match[1])
    .filter((row) => [...row.matchAll(/<td\b/gi)].length >= 3);
  if (!rows.length) throw new EventParserStructureError("BLS HTML", "no recognizable release rows");

  const issues: EventParserIssue[] = [];
  const events = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => toText(match[1]));
    const officialTitle = cells.find((cell) => classifyBlsTitle(cell) !== null);
    if (!officialTitle) continue;
    const category = classifyBlsTitle(officialTitle);
    if (!category) continue;
    const date = parseDate(cells[0]);
    if (!date) {
      issues.push({ code: "missing_date", detail: `${officialTitle}: schedule date is missing` });
      continue;
    }
    const clock = parseClock(cells[1]);
    if (!clock) {
      issues.push({ code: "missing_time", detail: `${officialTitle}: schedule time is missing` });
      continue;
    }
    try {
      events.push(buildEventRiskEvent({
        title: canonicalBlsTitle(category),
        category,
        scheduled_at: zonedDateTimeToUtcIso({ ...date, ...clock }),
        source_name: SOURCE_NAME,
        source_url: officialBlsLink(row, sourceUrl),
        note: "Official BLS Schedule of Releases (HTML fallback)",
      }));
    } catch (error) {
      issues.push({ code: "unsupported_datetime", detail: `${officialTitle}: ${(error as Error).message}` });
    }
  }
  return { events: sortAndDedupeEvents(events), issues };
}

function parseDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})$/i.exec(value.trim());
  if (!match) return null;
  return { year: +match[3], month: MONTHS[match[1].toLowerCase()], day: +match[2] };
}

function parseClock(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})\s*([AP])M$/i.exec(value.trim());
  if (!match) return null;
  const clockHour = +match[1];
  const minute = +match[2];
  if (clockHour < 1 || clockHour > 12 || minute > 59) return null;
  return { hour: clockHour % 12 + (match[3].toUpperCase() === "P" ? 12 : 0), minute };
}

function officialBlsLink(row: string, fallback: string): string {
  const match = /<a\b[^>]*href=["']([^"']+)["']/i.exec(row);
  if (!match) return fallback;
  try {
    const candidate = new URL(match[1], fallback);
    if (candidate.protocol === "https:" && (candidate.hostname === "bls.gov" || candidate.hostname.endsWith(".bls.gov"))) return candidate.toString();
  } catch { /* use the verified schedule URL */ }
  return fallback;
}

function toText(html: string): string {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
