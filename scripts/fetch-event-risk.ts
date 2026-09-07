import path from "node:path";
import { fetchEventRiskSnapshot, writeEventRiskSnapshotAtomic } from "../lib/event-risk-snapshot";

async function main(): Promise<void> {
  const now = new Date();
  console.log(`== Event Risk official fetch @ ${now.toISOString()} ==`);
  const blsVerifiedCachePath = path.join(process.cwd(), "data", "reference", "bls-event-schedule.json");
  const snapshot = await fetchEventRiskSnapshot({ now, blsVerifiedCachePath });
  const output = path.join(process.cwd(), "data", "events", "event-risk.json");
  await writeEventRiskSnapshotAtomic(output, snapshot);
  console.log(`[event-risk] availability=${snapshot.availability} events=${snapshot.events.length}`);
  for (const source of snapshot.sources) {
    console.log(`[event-risk] ${source.name}: ${source.status}${source.mode ? ` mode=${source.mode}` : ""}${source.verified_at ? ` verified_at=${source.verified_at}` : ""}${source.error_code ? ` (${source.error_code})` : ""}`);
  }
  console.log(`[event-risk] wrote ${output}`);
}

main().catch((error) => {
  console.error("Event Risk pipeline failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
