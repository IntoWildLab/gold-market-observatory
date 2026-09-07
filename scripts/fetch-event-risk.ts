import path from "node:path";
import { fetchEventRiskSnapshot, writeEventRiskSnapshotAtomic } from "../lib/event-risk-snapshot";

async function main(): Promise<void> {
  const now = new Date();
  console.log(`== Event Risk official fetch @ ${now.toISOString()} ==`);
  const snapshot = await fetchEventRiskSnapshot({ now });
  const output = path.join(process.cwd(), "data", "events", "event-risk.json");
  await writeEventRiskSnapshotAtomic(output, snapshot);
  console.log(`[event-risk] availability=${snapshot.availability} events=${snapshot.events.length}`);
  for (const source of snapshot.sources) {
    console.log(`[event-risk] ${source.name}: ${source.status}${source.error_code ? ` (${source.error_code})` : ""}`);
  }
  console.log(`[event-risk] wrote ${output}`);
}

main().catch((error) => {
  console.error("Event Risk pipeline failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
