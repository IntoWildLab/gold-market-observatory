import { buildEventRiskEvent, EventParserStructureError, sortAndDedupeEvents, zonedDateTimeToUtcIso } from "../event-risk";
import type { EventParserIssue, EventParserResult } from "../../types/event-risk";

export const BEA_EVENT_SOURCE_URL = "https://www.bea.gov/news/schedule";
const SOURCE_NAME = "U.S. Bureau of Economic Analysis" as const;

export function parseBeaScheduleHtml(html: string, year: number, sourceUrl = BEA_EVENT_SOURCE_URL): EventParserResult {
  if (!/<(?:html|table|tr)\b/i.test(html) || !/release schedule/i.test(toText(html))) {
    throw new EventParserStructureError("BEA", "response is not a recognizable release schedule");
  }
  const issues: EventParserIssue[] = [];
  const events = [];
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => match[1])
    .filter((row) => [...row.matchAll(/<td\b/gi)].length >= 2);
  if (!rows.length) throw new EventParserStructureError("BEA", "no recognizable release rows");
  for (const rowHtml of rows) {
    const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => toText(match[1]));
    const title = cells.find(isPersonalIncomeAndOutlaysTitle);
    if (!title) continue;
    const text = cells.join(" ");
    const date = parseEnglishDate(text, year);
    if (!date) {
      issues.push({ code: "missing_date", detail: "Personal Income and Outlays row has no reliable date" });
      continue;
    }
    const clock = parseClock(text);
    if (!clock) {
      issues.push({ code: "missing_time", detail: "Personal Income and Outlays row has no reliable time" });
      continue;
    }
    try {
      const scheduledAt = zonedDateTimeToUtcIso({ ...date, ...clock });
      events.push(buildEventRiskEvent({
        title: "US Personal Income and Outlays (PCE)",
        category: "us_pce",
        scheduled_at: scheduledAt,
        source_name: SOURCE_NAME,
        source_url: firstLink(rowHtml, sourceUrl),
      }));
    } catch (error) {
      issues.push({ code: "unsupported_datetime", detail: `Personal Income and Outlays: ${(error as Error).message}` });
    }
  }
  return { events: sortAndDedupeEvents(events), issues };
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function parseEnglishDate(text: string, year: number): { year: number; month: number; day: number } | null {
  const match = new RegExp(`\\b(${Object.keys(MONTHS).join("|")})\\s+(\\d{1,2})\\b`, "i").exec(text);
  if (!match) return null;
  return { year, month: MONTHS[match[1].toLowerCase()], day: +match[2] };
}

function isPersonalIncomeAndOutlaysTitle(value: string): boolean {
  return /^Personal Income and Outlays(?:,\s+(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4})?$/i.test(value.trim());
}

function parseClock(text: string): { hour: number; minute: number } | null {
  const match = /\b(\d{1,2}):(\d{2})\s*([ap])\.?m\.?\b/i.exec(text);
  if (!match) return null;
  const clockHour = +match[1];
  const minute = +match[2];
  if (clockHour < 1 || clockHour > 12 || minute > 59) return null;
  let hour = clockHour % 12;
  if (match[3].toLowerCase() === "p") hour += 12;
  return { hour, minute };
}

function toText(html: string): string {
  return decodeEntities(html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeEntities(value: string): string {
  return value.replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, "\"").replace(/&#39;|&apos;/gi, "'");
}

function firstLink(html: string, fallback: string): string {
  const match = /<a\b[^>]*href=["']([^"']+)["']/i.exec(html);
  if (!match) return fallback;
  try { return new URL(match[1], fallback).toString(); } catch { return fallback; }
}
