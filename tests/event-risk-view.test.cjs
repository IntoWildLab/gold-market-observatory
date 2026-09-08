const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const { mkdtemp, rm, writeFile } = require("node:fs/promises");
const Module = require("node:module");

const { buildEventRiskEvent, sortAndDedupeEvents } = require("../.tmp-pipeline/lib/event-risk.js");
const { buildEventRiskView, parseEventRiskSnapshot } = require("../.tmp-pipeline/lib/event-risk-view.js");

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  if (request.startsWith("@/")) {
    return originalLoad.call(this, path.join(__dirname, "..", ".tmp-pipeline", request.slice(2)), parent, isMain);
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { loadEventRiskSnapshot } = require("../.tmp-pipeline/lib/event-risk-loader.js");
const { buildPageData } = require("../.tmp-pipeline/lib/page-data.js");
Module._load = originalLoad;

const NOW = new Date("2026-09-08T12:00:00.000Z");

function eventAt(scheduledAt, category = "us_ppi", title = "US Producer Price Index (PPI)") {
  return buildEventRiskEvent({
    title,
    category,
    scheduled_at: scheduledAt,
    source_name: "U.S. Bureau of Labor Statistics",
    source_url: "https://www.bls.gov/schedule/news_release/ppi.htm",
  });
}

function sources({ cache = false, failed = false } = {}) {
  const at = "2026-09-08T11:00:00.000Z";
  return [
    { name: "Federal Reserve Chair Identity", status: "ok", fetched_at: at },
    { name: "Federal Reserve Calendar", status: "ok", fetched_at: at },
    cache
      ? { name: "U.S. Bureau of Labor Statistics Calendar", status: "failed", fetched_at: at, error_code: "http_403", mode: "verified_cache", verified_at: at }
      : { name: "U.S. Bureau of Labor Statistics Calendar", status: failed ? "failed" : "ok", fetched_at: at, ...(failed ? { error_code: "http_403" } : {}), mode: "live" },
    { name: "U.S. Bureau of Economic Analysis Schedule", status: "ok", fetched_at: at },
  ];
}

function snapshot({ events = [], availability = "available", generatedAt = "2026-09-08T11:00:00.000Z", sourceList = sources() } = {}) {
  return { schema_version: 1, generated_at: generatedAt, horizon_hours: 72, availability, sources: sourceList, events };
}

test("valid snapshot exposes the nearest event and keeps direction unknown", () => {
  const view = buildEventRiskView(snapshot({ events: [eventAt("2026-09-09T12:00:00.000Z")] }), NOW);
  assert.equal(view.nearestEvent.title, "US Producer Price Index (PPI)");
  assert.equal(view.nearestEvent.status, "upcoming");
  assert.equal(view.nearestEvent.direction, "unknown");
});

test("multiple events expose nearest plus additional count", () => {
  const view = buildEventRiskView(snapshot({ events: [eventAt("2026-09-10T12:00:00.000Z"), eventAt("2026-09-08T18:00:00.000Z", "us_cpi", "US CPI")] }), NOW);
  assert.equal(view.nearestEvent.title, "US CPI");
  assert.equal(view.additionalEventCount, 1);
});

test("fresh available and partial empty snapshots preserve no-event semantics", () => {
  const available = buildEventRiskView(snapshot(), NOW);
  const partial = buildEventRiskView(snapshot({ availability: "partial", sourceList: sources({ failed: true }) }), NOW);
  assert.equal(available.availability, "available");
  assert.equal(partial.availability, "partial");
  assert.equal(available.nearestEvent, undefined);
  assert.equal(partial.nearestEvent, undefined);
  assert.equal(available.stale, false);
});

test("unavailable input remains distinct from an available empty schedule", () => {
  const view = buildEventRiskView(null, NOW);
  assert.deepEqual(view, {
    availability: "unavailable", stale: false, additionalEventCount: 0,
    provenance: { usesVerifiedCache: false, hasLiveSourceFailure: false },
  });
  const unavailableSources = sources({ failed: true }).map((source) => source.status === "failed"
    ? source
    : { ...source, status: "failed", error_code: "source_unavailable" });
  const persistedUnavailable = buildEventRiskView(snapshot({ availability: "unavailable", sourceList: unavailableSources }), NOW);
  assert.equal(persistedUnavailable.availability, "unavailable");
  assert.equal(persistedUnavailable.nearestEvent, undefined);
});

test("stale empty snapshot is explicitly marked stale", () => {
  const view = buildEventRiskView(snapshot({ generatedAt: "2026-09-06T23:59:59.999Z" }), NOW);
  assert.equal(view.stale, true);
  assert.equal(view.nearestEvent, undefined);
});

test("verified cache and live failure provenance pass through", () => {
  const view = buildEventRiskView(snapshot({ availability: "partial", sourceList: sources({ cache: true }) }), NOW);
  assert.equal(view.provenance.usesVerifiedCache, true);
  assert.equal(view.provenance.hasLiveSourceFailure, true);
});

test("ended and more-than-72-hour events are excluded", () => {
  const ended = eventAt("2026-09-08T11:00:00.000Z");
  const far = eventAt("2026-09-11T12:00:00.001Z", "us_cpi", "US CPI");
  const view = buildEventRiskView(snapshot({ events: [ended, far] }), NOW);
  assert.equal(view.nearestEvent, undefined);
  assert.equal(view.additionalEventCount, 0);
});

test("exact event boundaries are deterministic", () => {
  const event = eventAt("2026-09-08T12:00:00.000Z");
  assert.equal(buildEventRiskView(snapshot({ events: [event] }), NOW).nearestEvent.status, "now");
  assert.equal(buildEventRiskView(snapshot({ events: [event] }), new Date(event.ends_at)).nearestEvent, undefined);
  const at72h = eventAt("2026-09-11T12:00:00.000Z");
  assert.equal(buildEventRiskView(snapshot({ events: [at72h] }), NOW).nearestEvent.status, "upcoming");
});

test("malformed and schema-invalid JSON fail soft", () => {
  assert.equal(parseEventRiskSnapshot("{"), null);
  assert.equal(parseEventRiskSnapshot(JSON.stringify({ schema_version: 99 })), null);
});

test("loader returns null for missing, malformed, and invalid files", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "event-risk-view-"));
  try {
    assert.equal(await loadEventRiskSnapshot(path.join(directory, "missing.json")), null);
    const file = path.join(directory, "event-risk.json");
    await writeFile(file, "{", "utf8");
    assert.equal(await loadEventRiskSnapshot(file), null);
    await writeFile(file, JSON.stringify({ schema_version: 99 }), "utf8");
    assert.equal(await loadEventRiskSnapshot(file), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("loader accepts a valid dedicated fixture", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "event-risk-view-"));
  try {
    const file = path.join(directory, "event-risk.json");
    const input = snapshot({ events: sortAndDedupeEvents([eventAt("2026-09-09T12:00:00.000Z")]) });
    await writeFile(file, JSON.stringify(input), "utf8");
    assert.deepEqual(await loadEventRiskSnapshot(file), JSON.parse(JSON.stringify(input)));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("missing Event Risk snapshot does not break the normal PageData build", async () => {
  const data = await buildPageData(NOW, path.join(os.tmpdir(), "event-risk-definitely-missing.json"));
  assert.equal(data.eventRisk.availability, "unavailable");
  assert.equal(data.gold !== undefined, true);
  assert.equal(Array.isArray(data.drivers), true);
});
