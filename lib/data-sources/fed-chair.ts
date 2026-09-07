import { canonicalizeEventTitle, EventParserStructureError } from "../event-risk";
import type { FedChairIdentity } from "../../types/event-risk";

export const FED_BOARD_MEMBERS_URL = "https://www.federalreserve.gov/aboutthefed/bios/board/default.htm";

export function parseFedChairIdentityHtml(html: string): FedChairIdentity {
  const pageText = toText(html);
  if (!/Board Members/i.test(pageText) || !/Board of Governors/i.test(pageText)) {
    throw new EventParserStructureError("Federal Reserve Chair Identity", "response is not a recognizable Board Members page");
  }
  const candidates: string[] = [];
  const linkedLabel = /<a\b[^>]*href=["'][^"']*\/aboutthefed\/bios\/board\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkedLabel)) {
    const label = toText(match[1]);
    const currentChair = /^(.+?),\s*Chair(?:man|woman)?$/i.exec(label);
    if (currentChair) candidates.push(currentChair[1].trim());
  }
  const unique = [...new Map(candidates.filter(Boolean).map((name) => [canonicalizeEventTitle(name), name])).values()];
  if (unique.length !== 1) {
    throw new EventParserStructureError("Federal Reserve Chair Identity", `expected exactly one current Chair, found ${unique.length}`);
  }
  return { canonical_name: unique[0] };
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
