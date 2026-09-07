import { buildEventRiskEvent, canonicalizeEventTitle, EventParserStructureError, sortAndDedupeEvents, zonedDateTimeToUtcIso } from "../event-risk";
import type { EventParserIssue, EventParserResult, EventRiskCategory, FedChairIdentity } from "../../types/event-risk";

export const FED_EVENT_SOURCE_URL = "https://www.federalreserve.gov/newsevents/calendar.htm";
const SOURCE_NAME = "Federal Reserve Board" as const;

export interface ParseFedCalendarOptions {
  sourceUrl?: string;
  chairIdentity?: FedChairIdentity;
}

export function parseFedCalendarHtml(html: string, options: ParseFedCalendarOptions = {}): EventParserResult {
  const sourceUrl = options.sourceUrl ?? FED_EVENT_SOURCE_URL;
  const pageText = toText(html);
  const context = /<h[1-6]\b[^>]*>\s*([a-z]+)\s+(20\d{2})\s*<\/h[1-6]>/i.exec(html)
    ?? /calendar(?::)?[\s\S]{0,300}?\b([a-z]+)\s+(20\d{2})\b/i.exec(pageText);
  if (!/<(?:html|div|tr)\b/i.test(html) || !context) {
    throw new EventParserStructureError("Federal Reserve", "response is not a recognizable monthly calendar");
  }
  const month = MONTHS[context[1].toLowerCase()];
  const year = +context[2];
  if (!month) throw new Error("Federal Reserve calendar month is unsupported");
  const blocks = extractEventBlocks(html);
  if (!blocks.length) throw new EventParserStructureError("Federal Reserve", "no recognizable event containers");
  const issues: EventParserIssue[] = [];
  const events = [];
  const parsedBlocks = blocks.map((block) => ({ block, ...extractOfficialEventFields(block) }));
  if (!parsedBlocks.some((item) => item.officialTitle)) {
    throw new EventParserStructureError("Federal Reserve", "event containers have no recognizable title fields");
  }

  for (const { block, officialTitle, officialSpeaker } of parsedBlocks) {
    const text = toText(block);
    if (!officialTitle) continue;
    const classified = classifyFomcEvent(officialTitle)
      ?? classifyVerifiedChairEvent(officialTitle, officialSpeaker, options.chairIdentity, issues);
    if (!classified) continue;
    const day = parseDay(block, text);
    if (!day) {
      issues.push({ code: "missing_date", detail: `${classified.title}: calendar day is missing` });
      continue;
    }
    const clock = parseClock(text);
    if (!clock) {
      issues.push({ code: "missing_time", detail: `${classified.title}: calendar time is missing` });
      continue;
    }
    try {
      const scheduledAt = zonedDateTimeToUtcIso({ year, month, day, ...clock });
      events.push(buildEventRiskEvent({
        title: classified.title,
        category: classified.category,
        scheduled_at: scheduledAt,
        source_name: SOURCE_NAME,
        source_url: firstLink(block, sourceUrl),
      }));
    } catch (error) {
      issues.push({ code: "unsupported_datetime", detail: `${classified.title}: ${(error as Error).message}` });
    }
  }
  return { events: sortAndDedupeEvents(events), issues };
}

function classifyFomcEvent(title: string): { category: EventRiskCategory; title: string } | null {
  const normalized = title.trim();
  if (/^FOMC Press Conference$/i.test(normalized)) return { category: "fomc_press_conference", title: "FOMC Press Conference" };
  if (/^FOMC Minutes$/i.test(normalized)) return { category: "fomc_minutes", title: "FOMC Minutes" };
  if (/^FOMC Meeting$/i.test(normalized)) return { category: "fomc_policy_decision", title: "FOMC Policy Decision" };
  return null;
}

function classifyVerifiedChairEvent(
  officialTitle: string,
  speaker: string | null,
  identity: FedChairIdentity | undefined,
  issues: EventParserIssue[],
): { category: EventRiskCategory; title: string } | null {
  const type = /^(Speech|Discussion|Testimony)(?:\s+-|$)/i.exec(officialTitle)?.[1]?.toLowerCase();
  if (!type || !speaker) return null;
  const chairName = explicitChairName(speaker);
  if (!chairName) return null;
  if (!identity) {
    issues.push({ code: "chair_identity_unavailable", detail: `${type}: verified current Chair identity was not supplied` });
    return null;
  }
  const acceptedNames = [identity.canonical_name, ...(identity.accepted_official_display_aliases ?? [])]
    .map(canonicalizePersonName);
  if (!acceptedNames.includes(canonicalizePersonName(chairName))) return null;
  const category = type === "testimony" ? "fed_chair_testimony" : "fed_chair_speech";
  return { category, title: officialTitle.trim() };
}

function explicitChairName(speaker: string): string | null {
  const match = /^(?:Chair|Chairman|Chairwoman)\s+(.+)$/i.exec(speaker.trim());
  return match?.[1]?.trim() || null;
}

function canonicalizePersonName(value: string): string {
  return canonicalizeEventTitle(value.replace(/\b(?:former|governor|president)\b/gi, " $& "));
}

function extractOfficialSpeaker(block: string, officialTitle: string): string | null {
  const field = extractClassText(block, ["eventlist__event__speaker", "event-speaker", "speaker-role"]);
  if (field) return field;
  const embedded = /^(?:Speech|Discussion|Testimony)\s+-\s+((?:Chair|Chairman|Chairwoman)\s+[^–—-]+)(?:\s+[-–—]|$)/i.exec(officialTitle);
  return embedded?.[1]?.trim() ?? null;
}

function parseDay(html: string, text: string): number | null {
  const attr = /data-(?:date|day)=["'](?:20\d{2}-\d{2}-)?(\d{1,2})["']/i.exec(html);
  if (attr) return +attr[1];
  const semantic = /class=["'][^"']*(?:eventlist__event__date|event-date)[^"']*["'][^>]*>\s*(\d{1,2})\s*</i.exec(html);
  if (semantic) return +semantic[1];
  const officialColumns = [...html.matchAll(/class=["'][^"']*\bcol-xs-3\b[^"']*["'][^>]*>\s*<p\b[^>]*>\s*(\d{1,2})\s*<\/p>/gi)];
  if (officialColumns.length) return +officialColumns[officialColumns.length - 1][1];
  const tail = /\b(\d{1,2})\s*$/.exec(text);
  return tail ? +tail[1] : null;
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

function extractEventBlocks(html: string): string[] {
  const starts: number[] = [];
  const opening = /<(?:div|tr)\b[^>]*class=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(opening)) {
    const classes = match[1].split(/\s+/);
    if (classes.includes("eventlist") || classes.includes("event-row") || classes.includes("panel")) starts.push(match.index);
  }
  return starts.map((start, index) => html.slice(start, starts[index + 1] ?? html.length));
}

function extractOfficialEventFields(html: string): { officialTitle: string | null; officialSpeaker: string | null } {
  const semanticTitle = extractClassText(html, ["eventlist__event__title", "event-title"]);
  if (semanticTitle) {
    return { officialTitle: semanticTitle, officialSpeaker: extractOfficialSpeaker(html, semanticTitle) };
  }
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => toText(match[1])).filter(Boolean);
  const exactFomc = paragraphs.find((value) => /^(?:FOMC Meeting|FOMC Press Conference|FOMC Minutes)$/i.test(value));
  if (exactFomc) return { officialTitle: exactFomc, officialSpeaker: null };
  const roleIndex = paragraphs.findIndex((value) => /^(?:Speech|Discussion|Testimony)\s+-\s+(?:Chair|Chairman|Chairwoman)\s+.+$/i.test(value));
  if (roleIndex < 0) return { officialTitle: null, officialSpeaker: null };
  const role = /^(Speech|Discussion|Testimony)\s+-\s+(.+)$/i.exec(paragraphs[roleIndex]);
  if (!role) return { officialTitle: null, officialSpeaker: null };
  const topic = paragraphs.slice(roleIndex + 1).find((value) => !/^Watch Live$/i.test(value) && !/^At\b/i.test(value) && !/^\d{1,2}$/.test(value));
  return { officialTitle: topic ? `${role[1]} - ${topic}` : role[1], officialSpeaker: role[2] };
}

function extractClassText(html: string, classNames: readonly string[]): string | null {
  const opening = /<([a-z][\w:-]*)\b[^>]*class=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(opening)) {
    if (!match[2].split(/\s+/).some((name) => classNames.includes(name))) continue;
    const contentStart = match.index + match[0].length;
    const close = new RegExp(`<\/${match[1]}\s*>`, "i").exec(html.slice(contentStart));
    if (close) return toText(html.slice(contentStart, contentStart + close.index));
  }
  return null;
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function toText(html: string): string {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

function firstLink(html: string, fallback: string): string {
  const match = /<a\b[^>]*href=["']([^"']+)["']/i.exec(html);
  if (!match) return fallback;
  try {
    const candidate = new URL(match[1], fallback);
    if (candidate.protocol === "https:" && (candidate.hostname === "federalreserve.gov" || candidate.hostname.endsWith(".federalreserve.gov"))) {
      return candidate.toString();
    }
    return fallback;
  } catch { return fallback; }
}
