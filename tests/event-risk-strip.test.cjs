const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const {
  default: EventRiskStrip,
  formatEventDistance,
  formatEventTimeEt,
} = require("../.tmp-pipeline/components/design/EventRiskStrip.js");

const NOW = new Date("2026-09-08T12:00:00.000Z");

function model(overrides = {}) {
  return {
    availability: "partial",
    stale: false,
    generatedAt: "2026-09-08T11:00:00.000Z",
    nearestEvent: {
      title: "US Producer Price Index (PPI)",
      category: "us_ppi",
      scheduledAt: "2026-09-10T12:30:00.000Z",
      endsAt: "2026-09-10T12:45:00.000Z",
      impact: "medium",
      direction: "unknown",
      sourceName: "U.S. Bureau of Labor Statistics",
      sourceUrl: "https://www.bls.gov/schedule/news_release/ppi.htm",
      status: "upcoming",
    },
    additionalEventCount: 0,
    provenance: { usesVerifiedCache: true, hasLiveSourceFailure: true },
    ...overrides,
  };
}

function render(eventRisk) {
  return renderToStaticMarkup(React.createElement(EventRiskStrip, { eventRisk, now: NOW }));
}

test("nearest MEDIUM event renders ET time, distance, direction, verified provenance and source link", () => {
  const html = render(model());
  assert.match(html, /US Producer Price Index \(PPI\)/);
  assert.match(html, /MEDIUM IMPACT/);
  assert.match(html, /Sep 10 · 08:30 ET/);
  assert.match(html, />2D</);
  assert.match(html, /Direction unknown/);
  assert.match(html, /Official schedule · verified/);
  assert.match(html, /href="https:\/\/www\.bls\.gov\/schedule\/news_release\/ppi\.htm"/);
  assert.doesNotMatch(html, /partial|verified_cache|hasLiveSourceFailure|HTTP 403/i);
});

test("HIGH impact receives stronger textual emphasis without traffic-light language", () => {
  const high = model({ nearestEvent: { ...model().nearestEvent, impact: "high" } });
  const html = render(high);
  assert.match(html, /HIGH IMPACT/);
  assert.doesNotMatch(html, /red alert|yellow|warning triangle/i);
});

test("all four statuses render their intended static timing hierarchy", () => {
  for (const [status, scheduledAt, expected] of [
    ["upcoming", "2026-09-10T12:30:00.000Z", "2D"],
    ["high_attention", "2026-09-09T06:00:00.000Z", "18H"],
    ["imminent", "2026-09-08T17:00:00.000Z", "5H"],
    ["now", "2026-09-08T12:00:00.000Z", "NOW"],
  ]) {
    const html = render(model({ nearestEvent: { ...model().nearestEvent, status, scheduledAt } }));
    assert.match(html, new RegExp(`>${expected}<`));
    if (status !== "now") assert.doesNotMatch(html, new RegExp(status, "i"));
  }
});

test("additional events remain a compact count", () => {
  assert.match(render(model({ additionalEventCount: 2 })), /\+2 EVENTS/);
  assert.match(render(model({ additionalEventCount: 1 })), /\+1 EVENT/);
});

test("fresh covered empty schedule says no major event", () => {
  const html = render(model({ availability: "available", nearestEvent: undefined, provenance: { usesVerifiedCache: false, hasLiveSourceFailure: false } }));
  assert.match(html, /No major event within 72h/);
  assert.doesNotMatch(html, /Schedule unavailable|Schedule may be stale/);
});

test("unavailable schedule never claims there is no major event", () => {
  const html = render(model({ availability: "unavailable", nearestEvent: undefined }));
  assert.match(html, /Schedule unavailable/);
  assert.doesNotMatch(html, /No major event/);
});

test("stale empty schedule takes priority over the no-event message", () => {
  const html = render(model({ availability: "partial", stale: true, nearestEvent: undefined }));
  assert.match(html, /Schedule may be stale/);
  assert.match(html, /Last schedule update/);
  assert.doesNotMatch(html, /No major event/);
});

test("long title wraps and directional prediction language is absent", () => {
  const longTitle = "Federal Open Market Committee Press Conference With Extended Official Schedule Title";
  const html = render(model({ nearestEvent: { ...model().nearestEvent, title: longTitle, sourceName: "Federal Reserve Board" } }));
  assert.match(html, new RegExp(longTitle));
  assert.match(html, /break-words/);
  assert.match(html, /Federal Reserve source/);
  assert.doesNotMatch(html, /bullish|bearish|positive|negative/i);
});

test("formatters are deterministic in Eastern Time and use low-frequency distance", () => {
  assert.equal(formatEventTimeEt("2026-09-10T12:30:00.000Z"), "Sep 10 · 08:30 ET");
  assert.equal(formatEventDistance("2026-09-08T13:30:00.000Z", NOW), "90M");
  assert.equal(formatEventDistance("2026-09-08T12:00:00.000Z", NOW), "NOW");
});
