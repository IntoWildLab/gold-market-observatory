import { access, appendFile, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const snapshotPath = process.argv[2] ?? "data/events/event-risk.json";
const summaryPath = process.env.GITHUB_STEP_SUMMARY;
const outputPath = process.env.GITHUB_OUTPUT;

function safe(value) {
  return String(value ?? "not available").replace(/[\r\n|]/g, " ");
}

async function writeLines(path, lines) {
  if (path) await appendFile(path, `${lines.join("\n")}\n`, "utf8");
  else console.log(lines.join("\n"));
}

async function writeOutputs(entries) {
  if (!outputPath) return;
  await appendFile(outputPath, `${entries.map(([key, value]) => `${key}=${safe(value)}`).join("\n")}\n`, "utf8");
}

try {
  await access(snapshotPath, constants.R_OK);
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  if (!Array.isArray(snapshot.sources) || !Array.isArray(snapshot.events)) {
    throw new Error("snapshot sources or events are not arrays");
  }

  const lines = [
    "## Event Risk",
    "",
    "- snapshot: present",
    `- generated_at: ${safe(snapshot.generated_at)}`,
    `- availability: ${safe(snapshot.availability)}`,
    `- horizon_hours: ${safe(snapshot.horizon_hours)}`,
    `- event count: ${snapshot.events.length}`,
    "",
    "### Sources",
  ];

  for (const source of snapshot.sources) {
    const mode = source.mode === "verified_cache" ? "verified cache" : source.mode;
    const details = [
      `status=${safe(source.status)}`,
      source.mode ? `mode=${safe(mode)}` : null,
      source.error_code ? `error_code=${safe(source.error_code)}` : null,
    ].filter(Boolean).join(", ");
    lines.push(`- ${safe(source.name)}: ${details}`);
  }

  await writeLines(summaryPath, lines);
  const bls = snapshot.sources.find((source) => String(source.name).includes("Labor Statistics"));
  await writeOutputs([
    ["snapshot", "present"],
    ["availability", snapshot.availability],
    ["event_count", snapshot.events.length],
    ["bls_status", bls?.status ?? "not available"],
    ["bls_mode", bls?.mode ?? "not available"],
  ]);
} catch (error) {
  const missing = error?.code === "ENOENT";
  await writeLines(summaryPath, [
    "## Event Risk",
    "",
    missing ? "Event Risk snapshot unavailable" : "Event Risk snapshot unreadable",
    "Daily Core continues",
  ]);
  await writeOutputs([
    ["snapshot", missing ? "missing" : "unreadable"],
    ["availability", "unavailable"],
    ["event_count", 0],
    ["bls_status", "not available"],
    ["bls_mode", "not available"],
  ]);
  console.warn(`::warning::Event Risk diagnostic summary: ${safe(error?.message ?? error)}`);
}
