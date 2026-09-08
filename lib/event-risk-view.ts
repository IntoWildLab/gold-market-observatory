import { classifyEventRiskStatus, visibleEventRiskEvents } from "./event-risk";
import { isEventRiskSnapshotStale, validateEventRiskSnapshot } from "./event-risk-snapshot";
import type {
  EventRiskAvailability,
  EventRiskCategory,
  EventRiskImpact,
  EventRiskSnapshot,
  EventRiskStatus,
} from "../types/event-risk";

export interface EventRiskView {
  availability: EventRiskAvailability;
  stale: boolean;
  generatedAt?: string;
  nearestEvent?: {
    title: string;
    category: EventRiskCategory;
    scheduledAt: string;
    endsAt: string;
    impact: EventRiskImpact;
    direction: "unknown";
    sourceName: string;
    sourceUrl: string;
    status: Exclude<EventRiskStatus, "hidden">;
  };
  additionalEventCount: number;
  provenance: {
    usesVerifiedCache: boolean;
    hasLiveSourceFailure: boolean;
  };
}

export function unavailableEventRiskView(): EventRiskView {
  return {
    availability: "unavailable",
    stale: false,
    additionalEventCount: 0,
    provenance: { usesVerifiedCache: false, hasLiveSourceFailure: false },
  };
}

export function parseEventRiskSnapshot(raw: string): EventRiskSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    validateEventRiskSnapshot(parsed as EventRiskSnapshot);
    return parsed as EventRiskSnapshot;
  } catch {
    return null;
  }
}

export function buildEventRiskView(snapshot: EventRiskSnapshot | null, now: Date): EventRiskView {
  if (!snapshot) return unavailableEventRiskView();

  const visible = visibleEventRiskEvents(snapshot.events, now);
  const nearest = visible[0];
  const status = nearest ? classifyEventRiskStatus(nearest, now) : "hidden";

  return {
    availability: snapshot.availability,
    stale: isEventRiskSnapshotStale(snapshot, now),
    generatedAt: snapshot.generated_at,
    nearestEvent: nearest && status !== "hidden" ? {
      title: nearest.title,
      category: nearest.category,
      scheduledAt: nearest.scheduled_at,
      endsAt: nearest.ends_at as string,
      impact: nearest.impact,
      direction: nearest.direction,
      sourceName: nearest.source_name,
      sourceUrl: nearest.source_url,
      status,
    } : undefined,
    additionalEventCount: Math.max(0, visible.length - 1),
    provenance: {
      usesVerifiedCache: snapshot.sources.some((source) => source.mode === "verified_cache"),
      hasLiveSourceFailure: snapshot.sources.some((source) => source.status === "failed"),
    },
  };
}
