import { fetchOfficialText } from "./event-http";
import { parseFedChairIdentityHtml, FED_BOARD_MEMBERS_URL } from "./fed-chair";
import { parseFedCalendarHtml } from "./fed-events";
import { sortAndDedupeEvents } from "../event-risk";
import type { EventParserResult, FedChairIdentity } from "../../types/event-risk";
import type { EventFetchOptions } from "./bls-events-fetch";

export async function fetchFedChairIdentity(options: EventFetchOptions = {}): Promise<FedChairIdentity> {
  const text = await fetchOfficialText({
    url: FED_BOARD_MEMBERS_URL,
    acceptedContentTypes: ["text/html", "application/xhtml+xml"],
    requiredMarkers: [/Board Members/i, /Board of Governors/i, /Chair(?:man|woman)?/i],
    ...options,
  });
  return parseFedChairIdentityHtml(text);
}

export async function fetchFedCalendarEvents(
  now: Date,
  chairIdentity: FedChairIdentity | undefined,
  options: EventFetchOptions = {},
): Promise<EventParserResult> {
  const calendars = fedCalendarPagesForHorizon(now, 72);
  const parsed = await Promise.all(calendars.map(async (calendar) => {
    const text = await fetchOfficialText({
      url: calendar.url,
      acceptedContentTypes: ["text/html", "application/xhtml+xml"],
      requiredMarkers: [/Calendar/i, /eventlist/i],
      ...options,
    });
    return parseFedCalendarHtml(text, { sourceUrl: calendar.url, chairIdentity });
  }));
  return {
    events: sortAndDedupeEvents(parsed.flatMap((result) => result.events)),
    issues: parsed.flatMap((result) => result.issues),
  };
}

export function fedCalendarPagesForHorizon(now: Date, horizonHours: 72 = 72): Array<{ year: number; month: number; url: string }> {
  if (!Number.isFinite(now.getTime())) throw new Error("now is invalid");
  const instants = [now, new Date(now.getTime() + horizonHours * 60 * 60 * 1000)];
  const unique = new Map<string, { year: number; month: number; url: string }>();
  for (const instant of instants) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", year: "numeric", month: "numeric",
    }).formatToParts(instant).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    const year = parts.year;
    const month = parts.month;
    const monthName = MONTH_NAMES[month - 1];
    const key = `${year}-${month}`;
    unique.set(key, { year, month, url: `https://www.federalreserve.gov/newsevents/${year}-${monthName}.htm` });
  }
  return [...unique.values()];
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
