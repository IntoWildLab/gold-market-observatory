import { buildEventRiskEvent, EventParserStructureError, normalizeUtcIso, sortAndDedupeEvents, zonedDateTimeToUtcIso } from "../event-risk";
import type { EventParserIssue, EventParserResult, EventRiskCategory } from "../../types/event-risk";

export const BLS_EVENT_SOURCE_URL = "https://www.bls.gov/schedule/news_release/bls.ics";
const SOURCE_NAME = "U.S. Bureau of Labor Statistics" as const;

export function parseBlsEventsIcs(ics: string, sourceUrl = BLS_EVENT_SOURCE_URL): EventParserResult {
  if (!/BEGIN:VCALENDAR/i.test(ics) || !/END:VCALENDAR/i.test(ics)) {
    throw new EventParserStructureError("BLS", "response is not a valid VCALENDAR document");
  }
  const unfolded = ics.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "");
  const blocks = [...unfolded.matchAll(/BEGIN:VEVENT\n([\s\S]*?)\nEND:VEVENT/gi)].map((match) => match[1]);
  if (!blocks.length) throw new EventParserStructureError("BLS", "no recognizable VEVENT containers");
  const issues: EventParserIssue[] = [];
  const events = [];

  for (const block of blocks) {
    const fields = parseIcsFields(block);
    const title = unescapeIcs(fields.SUMMARY?.value ?? "").trim();
    if (!title) {
      issues.push({ code: "malformed_event", detail: "VEVENT has no SUMMARY" });
      continue;
    }
    const category = classifyBlsTitle(title);
    if (!category) continue;
    const start = fields.DTSTART;
    if (!start) {
      issues.push({ code: "missing_date", detail: `${title}: DTSTART is missing` });
      continue;
    }
    try {
      const scheduledAt = parseIcsDateTime(start.value, start.params);
      const endField = fields.DTEND;
      const endsAt = endField ? parseIcsDateTime(endField.value, endField.params) : undefined;
      events.push(buildEventRiskEvent({
        title: canonicalBlsTitle(category),
        category,
        scheduled_at: scheduledAt,
        ends_at: endsAt,
        source_name: SOURCE_NAME,
        source_url: unescapeIcs(fields.URL?.value ?? "").trim() || sourceUrl,
        note: unescapeIcs(fields.DESCRIPTION?.value ?? "").trim() || undefined,
      }));
    } catch (error) {
      issues.push({ code: "unsupported_datetime", detail: `${title}: ${(error as Error).message}` });
    }
  }
  return { events: sortAndDedupeEvents(events), issues };
}

export function classifyBlsTitle(title: string): EventRiskCategory | null {
  const releasePeriod = "(?:January|February|March|April|May|June|July|August|September|October|November|December) \\d{4}";
  if (new RegExp(`^Consumer Price Index for ${releasePeriod}$`, "i").test(title)) return "us_cpi";
  if (new RegExp(`^Employment Situation for ${releasePeriod}$`, "i").test(title)) return "us_employment_situation";
  if (new RegExp(`^Producer Price Index for ${releasePeriod}$`, "i").test(title)) return "us_ppi";
  return null;
}

export function canonicalBlsTitle(category: EventRiskCategory): string {
  if (category === "us_cpi") return "US Consumer Price Index (CPI)";
  if (category === "us_employment_situation") return "US Employment Situation";
  return "US Producer Price Index (PPI)";
}

function parseIcsFields(block: string): Record<string, { value: string; params: Record<string, string> }> {
  const fields: Record<string, { value: string; params: Record<string, string> }> = {};
  for (const line of block.split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const [name, ...rawParams] = line.slice(0, separator).split(";");
    const params = Object.fromEntries(rawParams.map((item) => {
      const equals = item.indexOf("=");
      return equals < 0 ? [item.toUpperCase(), ""] : [item.slice(0, equals).toUpperCase(), item.slice(equals + 1)];
    }));
    fields[name.toUpperCase()] = { value: line.slice(separator + 1), params };
  }
  return fields;
}

function parseIcsDateTime(value: string, params: Record<string, string>): string {
  if (params.VALUE?.toUpperCase() === "DATE" || /^\d{8}$/.test(value)) throw new Error("date-only values have no reliable release time");
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(value);
  if (!match) throw new Error("unsupported ICS date-time format");
  if (match[7]) {
    return normalizeUtcIso(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] ?? "00"}Z`);
  }
  const tzid = params.TZID?.replace(/^"|"$/g, "");
  if (tzid !== "America/New_York") throw new Error(`unsupported or missing TZID: ${tzid ?? "none"}`);
  return zonedDateTimeToUtcIso({
    year: +match[1], month: +match[2], day: +match[3], hour: +match[4], minute: +match[5], second: +(match[6] ?? 0),
  });
}

function unescapeIcs(value: string): string {
  return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}
