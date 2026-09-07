import { parseBeaScheduleHtml, BEA_EVENT_SOURCE_URL } from "./bea-events";
import { fetchOfficialText } from "./event-http";
import type { EventParserResult } from "../../types/event-risk";
import type { EventFetchOptions } from "./bls-events-fetch";

export async function fetchBeaEvents(year: number, options: EventFetchOptions = {}): Promise<EventParserResult> {
  const text = await fetchOfficialText({
    url: BEA_EVENT_SOURCE_URL,
    acceptedContentTypes: ["text/html", "application/xhtml+xml"],
    requiredMarkers: [/Release Schedule/i, /<tr\b/i],
    ...options,
  });
  return parseBeaScheduleHtml(text, year);
}
