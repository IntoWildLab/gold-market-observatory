export type EventRiskImpact = "high" | "medium";

export type EventRiskCategory =
  | "fomc_policy_decision"
  | "fomc_press_conference"
  | "fomc_minutes"
  | "us_cpi"
  | "us_employment_situation"
  | "us_pce"
  | "us_ppi"
  | "fed_chair_speech"
  | "fed_chair_testimony";

export type EventRiskSourceName =
  | "Federal Reserve Board"
  | "U.S. Bureau of Labor Statistics"
  | "U.S. Bureau of Economic Analysis";

export interface EventRiskEvent {
  id: string;
  title: string;
  category: EventRiskCategory;
  scheduled_at: string;
  ends_at?: string;
  timezone: "America/New_York";
  impact: EventRiskImpact;
  direction: "unknown";
  source_name: EventRiskSourceName;
  source_url: string;
  note?: string;
}

export interface FedChairIdentity {
  canonical_name: string;
  accepted_official_display_aliases?: readonly string[];
}

export type EventRiskStatus = "hidden" | "upcoming" | "high_attention" | "imminent" | "now";

export interface EventParserIssue {
  code:
    | "malformed_event"
    | "missing_date"
    | "missing_time"
    | "unsupported_datetime"
    | "chair_identity_unavailable"
    | "source_unavailable";
  detail: string;
}

export interface EventParserResult {
  events: EventRiskEvent[];
  issues: EventParserIssue[];
}

export type EventRiskAvailability = "available" | "partial" | "unavailable";

export type EventRiskSnapshotSourceName =
  | "Federal Reserve Calendar"
  | "Federal Reserve Chair Identity"
  | "U.S. Bureau of Labor Statistics Calendar"
  | "U.S. Bureau of Economic Analysis Schedule";

export interface EventRiskSourceStatus {
  name: EventRiskSnapshotSourceName;
  status: "ok" | "failed";
  fetched_at: string;
  error_code?: string;
  mode?: "live" | "verified_cache";
  verified_at?: string;
}

export type BlsVerifiedCacheCategory = "us_cpi" | "us_employment_situation" | "us_ppi";

export interface BlsVerifiedCacheSource {
  category: BlsVerifiedCacheCategory;
  source_url: string;
}

export interface BlsVerifiedCacheEvent extends BlsVerifiedCacheSource {
  reference_period: string;
  scheduled_at: string;
}

export interface BlsVerifiedScheduleCache {
  schema_version: 1;
  source_name: "U.S. Bureau of Labor Statistics";
  verified_at: string;
  timezone: "America/New_York";
  sources: BlsVerifiedCacheSource[];
  events: BlsVerifiedCacheEvent[];
}

export interface EventRiskSnapshot {
  schema_version: 1;
  generated_at: string;
  horizon_hours: 72;
  availability: EventRiskAvailability;
  sources: EventRiskSourceStatus[];
  events: EventRiskEvent[];
}
