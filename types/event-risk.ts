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
    | "chair_identity_unavailable";
  detail: string;
}

export interface EventParserResult {
  events: EventRiskEvent[];
  issues: EventParserIssue[];
}
