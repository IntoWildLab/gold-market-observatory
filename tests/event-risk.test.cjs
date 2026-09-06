const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildEventRiskEvent,
  canonicalizeEventTitle,
  classifyEventRiskStatus,
  createEventRiskId,
  impactForCategory,
  normalizeUtcIso,
  sortAndDedupeEvents,
  visibleEventRiskEvents,
  zonedDateTimeToUtcIso,
} = require("../.tmp-pipeline/lib/event-risk.js");

function eventAt(start, end) {
  return buildEventRiskEvent({
    title: "US Consumer Price Index (CPI)", category: "us_cpi", scheduled_at: start,
    ...(end ? { ends_at: end } : {}), source_name: "U.S. Bureau of Labor Statistics", source_url: "https://www.bls.gov/",
  });
}

test("EventRiskEvent fixes direction, timezone, impact and stable id", () => {
  const a = eventAt("2026-09-10T12:30:00Z", "2026-09-10T12:45:00Z");
  const b = eventAt("2026-09-10T12:30:00.000Z", "2026-09-10T12:45:00Z");
  assert.equal(a.direction, "unknown");
  assert.equal(a.timezone, "America/New_York");
  assert.equal(a.impact, "high");
  assert.equal(a.id, b.id);
  assert.equal(a.id, createEventRiskId(a));
});

test("impact mapping is explicit and unknown categories return null", () => {
  assert.equal(impactForCategory("fomc_policy_decision"), "high");
  assert.equal(impactForCategory("fomc_press_conference"), "high");
  assert.equal(impactForCategory("fomc_minutes"), "medium");
  assert.equal(impactForCategory("us_cpi"), "high");
  assert.equal(impactForCategory("us_employment_situation"), "high");
  assert.equal(impactForCategory("us_pce"), "high");
  assert.equal(impactForCategory("us_ppi"), "medium");
  assert.equal(impactForCategory("other_release"), null);
});

test("impact cannot be overridden by a caller", () => {
  assert.throws(() => buildEventRiskEvent({
    title: "US CPI", category: "us_cpi", scheduled_at: "2026-09-10T12:30:00Z",
    source_name: "U.S. Bureau of Labor Statistics", source_url: "https://www.bls.gov/", impact: "medium",
  }), /cannot be supplied/);
  assert.throws(() => buildEventRiskEvent({
    title: "FOMC Minutes", category: "fomc_minutes", scheduled_at: "2026-09-10T18:00:00Z",
    source_name: "Federal Reserve Board", source_url: "https://www.federalreserve.gov/", impact: "high",
  }), /cannot be supplied/);
});

test("strict UTC normalization rejects calendar rollover and invalid time fields", () => {
  for (const value of [
    "2026-02-30T12:00:00Z", "2026-04-31T12:00:00Z", "2026-13-01T12:00:00Z",
    "2026-01-01T25:00:00Z", "2026-01-01T12:60:00Z", "2026-01-01T12:00:60Z",
  ]) assert.throws(() => normalizeUtcIso(value), /invalid UTC calendar fields/);
});

test("EST and EDT normalize independently of machine timezone", () => {
  assert.equal(zonedDateTimeToUtcIso({ year: 2026, month: 1, day: 13, hour: 8, minute: 30 }), "2026-01-13T13:30:00.000Z");
  assert.equal(zonedDateTimeToUtcIso({ year: 2026, month: 7, day: 14, hour: 8, minute: 30 }), "2026-07-14T12:30:00.000Z");
});

test("DST transition dates use the official New York offset", () => {
  assert.equal(zonedDateTimeToUtcIso({ year: 2026, month: 3, day: 8, hour: 1, minute: 30 }), "2026-03-08T06:30:00.000Z");
  assert.equal(zonedDateTimeToUtcIso({ year: 2026, month: 3, day: 8, hour: 3, minute: 30 }), "2026-03-08T07:30:00.000Z");
  assert.throws(() => zonedDateTimeToUtcIso({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }), /Invalid/);
  assert.throws(() => zonedDateTimeToUtcIso({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }), /Ambiguous/);
});

test("72h, 24h and 6h status boundaries are exact", () => {
  const start = "2026-09-10T12:00:00.000Z";
  const atDelta = (ms) => classifyEventRiskStatus(eventAt(start), new Date(Date.parse(start) - ms));
  assert.equal(atDelta(72 * 3_600_000 + 1), "hidden");
  assert.equal(atDelta(72 * 3_600_000), "upcoming");
  assert.equal(atDelta(24 * 3_600_000), "upcoming");
  assert.equal(atDelta(24 * 3_600_000 - 1), "high_attention");
  assert.equal(atDelta(6 * 3_600_000), "high_attention");
  assert.equal(atDelta(6 * 3_600_000 - 1), "imminent");
});

test("event window is start-inclusive and end-exclusive", () => {
  const event = eventAt("2026-09-10T12:00:00Z", "2026-09-10T12:15:00Z");
  assert.equal(classifyEventRiskStatus(event, new Date("2026-09-10T12:00:00Z")), "now");
  assert.equal(classifyEventRiskStatus(event, new Date("2026-09-10T12:14:59.999Z")), "now");
  assert.equal(classifyEventRiskStatus(event, new Date("2026-09-10T12:15:00Z")), "hidden");
  assert.equal(classifyEventRiskStatus(event, new Date("2026-09-10T12:15:00.001Z")), "hidden");
});

test("missing or zero-length source end uses the category default window", () => {
  const missing = eventAt("2026-09-10T12:00:00Z");
  const zero = eventAt("2026-09-10T12:00:00Z", "2026-09-10T12:00:00Z");
  assert.equal(missing.ends_at, "2026-09-10T12:15:00.000Z");
  assert.equal(zero.ends_at, missing.ends_at);
  assert.equal(classifyEventRiskStatus(missing, new Date("2026-09-10T12:00:00Z")), "now");
  assert.equal(classifyEventRiskStatus(missing, new Date(missing.ends_at)), "hidden");
});

test("dedupe is stable but distinct categories at the same time remain", () => {
  const cpi = eventAt("2026-09-10T12:30:00Z");
  const duplicate = { ...cpi, id: "untrusted", note: "duplicate" };
  const ppi = buildEventRiskEvent({
    title: "US Producer Price Index (PPI)", category: "us_ppi", scheduled_at: cpi.scheduled_at,
    source_name: cpi.source_name, source_url: cpi.source_url,
  });
  const result = sortAndDedupeEvents([ppi, duplicate, cpi]);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((item) => item.category), ["us_cpi", "us_ppi"]);
});

test("duplicate metadata merge is independent of input order", () => {
  const a = eventAt("2026-09-10T12:30:00Z", "2026-09-10T12:45:00Z");
  const b = { ...a, title: "US Consumer Price Index — CPI", ends_at: "2026-09-10T13:00:00Z", note: "Official release", source_url: "https://www.bls.gov/schedule/news_release/cpi.htm" };
  const c = { ...a, title: "US Consumer Price Index (CPI)", note: "BLS" };
  assert.deepEqual(sortAndDedupeEvents([a, b, c]), sortAndDedupeEvents([c, b, a]));
});

test("Unicode canonical titles remain distinct and non-empty", () => {
  assert.equal(canonicalizeEventTitle("美国 消费者价格指数"), "美国 消费者价格指数");
  assert.notEqual(canonicalizeEventTitle("消费者价格指数"), canonicalizeEventTitle("生产者价格指数"));
});

test("visible filtering returns only the 72-hour window in stable order", () => {
  const near = eventAt("2026-09-10T12:00:00Z");
  const far = eventAt("2026-09-15T12:00:00Z");
  assert.deepEqual(visibleEventRiskEvents([far, near], new Date("2026-09-09T12:00:00Z")).map((item) => item.id), [near.id]);
});

test("dynamic status fields are absent from the persistent event model", () => {
  const event = eventAt("2026-09-10T12:00:00Z");
  assert.equal("hours_until" in event, false);
  assert.equal("countdown" in event, false);
  assert.equal("status" in event, false);
});
