import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseEventRiskSnapshot } from "./event-risk-view";
import type { EventRiskSnapshot } from "../types/event-risk";

const EVENT_RISK_SNAPSHOT_FILE = path.join(process.cwd(), "data", "events", "event-risk.json");

export async function loadEventRiskSnapshot(file: string | undefined = EVENT_RISK_SNAPSHOT_FILE): Promise<EventRiskSnapshot | null> {
  try {
    return parseEventRiskSnapshot(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}
