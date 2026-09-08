import { access, appendFile, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const snapshotPath = process.argv[2] ?? "data/events/event-risk.json";
const htmlPath = process.argv[3];

if (!htmlPath) throw new Error("Usage: node scripts/check-event-risk-render.mjs <snapshot> <html>");

function decodeHtml(value) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");
}

function visibleEvents(events, nowMs) {
  return events
    .filter((event) => {
      const startMs = Date.parse(event.scheduled_at);
      const endMs = Date.parse(event.ends_at);
      if (!Number.isFinite(startMs)) throw new Error("Event Risk snapshot has an invalid scheduled_at");
      if (nowMs >= startMs && Number.isFinite(endMs) && nowMs < endMs) return true;
      const delta = startMs - nowMs;
      return delta >= 0 && delta <= 72 * 60 * 60 * 1000;
    })
    .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
}

async function snapshotExpectation() {
  try {
    await access(snapshotPath, constants.R_OK);
  } catch (error) {
    if (error?.code === "ENOENT") return { kind: "missing", text: "Schedule unavailable" };
    throw error;
  }

  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  if (!Array.isArray(snapshot.events) || !["available", "partial", "unavailable"].includes(snapshot.availability)) {
    throw new Error("Event Risk snapshot is not readable by the staged render verifier");
  }
  const nearest = visibleEvents(snapshot.events, Date.now())[0];
  if (nearest) return { kind: "event", text: String(nearest.title) };
  if (snapshot.availability === "unavailable") return { kind: "unavailable", text: "Schedule unavailable" };
  return { kind: "empty", text: "No major event within 72h" };
}

const expected = await snapshotExpectation();
const renderedText = decodeHtml(await readFile(htmlPath, "utf8"));
if (!renderedText.includes(expected.text)) {
  throw new Error(`Staged Event Risk render does not match snapshot expectation (${expected.kind})`);
}

if (process.env.GITHUB_OUTPUT) {
  const outputText = expected.text.replace(/[\r\n]/g, " ");
  await appendFile(process.env.GITHUB_OUTPUT, `status=success\nexpected_kind=${expected.kind}\nexpected_text=${outputText}\n`, "utf8");
}
console.log(`Staged Event Risk render verified: ${expected.kind}.`);
