import { buildEventRiskEvent, EventParserStructureError, sortAndDedupeEvents, zonedDateTimeToUtcIso } from "../event-risk";
import { canonicalBlsTitle } from "./bls-events";
import type { EventParserIssue, EventParserResult, EventRiskCategory } from "../../types/event-risk";

export type BlsReleaseCategory = "us_cpi" | "us_employment_situation" | "us_ppi";

const HEADINGS: Record<BlsReleaseCategory, string> = {
  us_cpi: "Schedule of Releases for the Consumer Price Index",
  us_employment_situation: "Schedule of Releases for the Employment Situation",
  us_ppi: "Schedule of Releases for the Producer Price Index",
};

export function parseBlsReleaseScheduleHtml(
  html: string,
  category: BlsReleaseCategory,
  sourceUrl: string,
): EventParserResult {
  const pageText = toText(html);
  const expectedHeading = HEADINGS[category];
  if (!/<(?:html|table|tr)\b/i.test(html)
    || !pageText.includes(expectedHeading)
    || !/Reference Month\s+Release Date\s+Release Time/i.test(pageText)) {
    throw new EventParserStructureError("BLS release schedule", `response does not match ${expectedHeading}`);
  }

  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const releaseRows = rows.map((row) => ({ row, cells: extractCells(row) }))
    .filter(({ cells }) => /^\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}\s*$/i.test(cells[0] ?? ""));
  if (!releaseRows.length) throw new EventParserStructureError("BLS release schedule", "no recognizable release rows");

  const issues: EventParserIssue[] = [];
  const events = [];
  for (const { cells } of releaseRows) {
    const referenceMonth = cells[0];
    const date = parseReleaseDate(cells[1] ?? "");
    const clock = parseClock(cells[2] ?? "");
    if (!date) {
      issues.push({ code: "missing_date", detail: `${referenceMonth}: release date is missing or invalid` });
      continue;
    }
    if (!clock) {
      issues.push({ code: "missing_time", detail: `${referenceMonth}: release time is missing or invalid` });
      continue;
    }
    try {
      events.push(buildEventRiskEvent({
        title: canonicalBlsTitle(category),
        category,
        scheduled_at: zonedDateTimeToUtcIso({ ...date, ...clock }),
        source_name: "U.S. Bureau of Labor Statistics",
        source_url: sourceUrl,
        note: `Official BLS release-specific schedule; reference month: ${referenceMonth}`,
      }));
    } catch (error) {
      issues.push({ code: "unsupported_datetime", detail: `${referenceMonth}: ${(error as Error).message}` });
    }
  }
  return { events: sortAndDedupeEvents(events), issues };
}

function extractCells(row: string): string[] {
  return [...row.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((match) => toText(match[1]));
}

function parseReleaseDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?(?:uary|ruary|ch|il|e|y|ust|tember|ober|ember)?\s+(\d{1,2}),\s+(20\d{2})$/i.exec(value.trim());
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

function toText(html: string): string {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
