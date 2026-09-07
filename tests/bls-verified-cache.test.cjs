const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const {
  BLS_VERIFIED_CACHE_MAX_AGE_HOURS,
  eventsFromBlsVerifiedScheduleCache,
  isBlsVerifiedScheduleCacheFresh,
  validateBlsVerifiedScheduleCache,
} = require("../.tmp-pipeline/lib/data-sources/bls-verified-cache.js");
const { fetchEventRiskSnapshot } = require("../.tmp-pipeline/lib/event-risk-snapshot.js");

const fixture = (name) => readFileSync(path.join(__dirname, "fixtures", "events", name), "utf8");
const cacheFile = path.join(__dirname, "..", "data", "reference", "bls-event-schedule.json");
const cacheFixture = () => JSON.parse(readFileSync(cacheFile, "utf8"));
const noWait = async () => {};
const htmlResponse = (body, status = 200) => new Response(body, {
  status,
  headers: { "content-type": "text/html; charset=utf-8" },
});
const calendarResponse = (body, status = 200) => new Response(body, {
  status,
  headers: { "content-type": "text/calendar; charset=utf-8" },
});

test("verified BLS cache validates exact official coverage and derives safe domain events", () => {
  const cache = validateBlsVerifiedScheduleCache(cacheFixture());
  assert.equal(cache.sources.length, 3);
  assert.equal(cache.events.length, 11);
  const events = eventsFromBlsVerifiedScheduleCache(cache);
  assert.equal(events.every((event) => event.direction === "unknown"), true);
  assert.equal(events.find((event) => event.category === "us_cpi").impact, "high");
  assert.equal(events.find((event) => event.category === "us_ppi").impact, "medium");
  assert.equal(JSON.stringify(events).includes("is_mock"), false);
});

test("verified BLS cache freshness accepts the exact 168-hour boundary and rejects stale or future verification", () => {
  const cache = validateBlsVerifiedScheduleCache(cacheFixture());
  const verified = Date.parse(cache.verified_at);
  assert.equal(BLS_VERIFIED_CACHE_MAX_AGE_HOURS, 168);
  assert.equal(isBlsVerifiedScheduleCacheFresh(cache, new Date(verified + 168 * 60 * 60 * 1000)), true);
  assert.equal(isBlsVerifiedScheduleCacheFresh(cache, new Date(verified + 168 * 60 * 60 * 1000 + 1)), false);
  assert.equal(isBlsVerifiedScheduleCacheFresh(cache, new Date(verified - 1)), false);
});

test("verified BLS cache rejects malformed schema, unknown categories and non-official URLs", () => {
  const malformed = cacheFixture();
  malformed.schema_version = 2;
  assert.throws(() => validateBlsVerifiedScheduleCache(malformed), /schema_version/);

  const unknown = cacheFixture();
  unknown.events[0].category = "real_earnings";
  assert.throws(() => validateBlsVerifiedScheduleCache(unknown), /category/);

  const thirdParty = cacheFixture();
  thirdParty.events[0].source_url = "https://example.com/ppi";
  assert.throws(() => validateBlsVerifiedScheduleCache(thirdParty), /source_url/);
});

test("verified BLS cache rejects invalid dates, duplicates, extra dynamic fields and nondeterministic order", () => {
  const invalidDate = cacheFixture();
  invalidDate.events[0].scheduled_at = "2026-02-30T12:30:00.000Z";
  assert.throws(() => validateBlsVerifiedScheduleCache(invalidDate), /invalid UTC calendar fields/);

  const duplicate = cacheFixture();
  duplicate.events.push(structuredClone(duplicate.events[0]));
  assert.throws(() => validateBlsVerifiedScheduleCache(duplicate), /duplicate/);

  const dynamic = cacheFixture();
  dynamic.events[0].countdown = "soon";
  assert.throws(() => validateBlsVerifiedScheduleCache(dynamic), /fields/);

  const unsorted = cacheFixture();
  unsorted.events.reverse();
  assert.throws(() => validateBlsVerifiedScheduleCache(unsorted), /sorted/);
});

function liveSuccessFetch() {
  return async (input) => {
    const url = String(input);
    if (url.includes("/aboutthefed/bios/board/default.htm")) return htmlResponse(fixture("fed-chair.html"));
    if (url.includes("federalreserve.gov/newsevents")) return htmlResponse('<html><h1>Calendar: October 2026</h1><div class="eventlist" data-date="7"><div class="eventlist__event__title">Community Banking Webinar</div><div class="eventlist__event__time">10:00 a.m.</div></div></html>');
    if (url.endsWith("bls.ics")) return calendarResponse(fixture("bls-calendar.ics"));
    if (url.includes("bea.gov/news/schedule")) return htmlResponse(fixture("bea-schedule.html"));
    throw new Error(`Unexpected URL: ${url}`);
  };
}

function blsBlockedFetch() {
  return async (input) => {
    const url = String(input);
    if (url.includes("bls.gov")) return htmlResponse("forbidden", 403);
    if (url.includes("/aboutthefed/bios/board/default.htm")) return htmlResponse(fixture("fed-chair.html"));
    if (url.includes("federalreserve.gov/newsevents")) return htmlResponse('<html><h1>Calendar: September 2026</h1><div class="eventlist" data-date="8"><div class="eventlist__event__title">Community Banking Webinar</div><div class="eventlist__event__time">10:00 a.m.</div></div></html>');
    if (url.includes("bea.gov/news/schedule")) return htmlResponse(fixture("bea-schedule.html"));
    throw new Error(`Unexpected URL: ${url}`);
  };
}

test("live BLS success never reads or validates the verified cache", async () => {
  const snapshot = await fetchEventRiskSnapshot({
    now: new Date("2026-10-06T12:00:00.000Z"),
    fetchImpl: liveSuccessFetch(),
    wait: noWait,
    blsVerifiedCache: { invalid: true },
  });
  const source = snapshot.sources.find((item) => item.name.includes("Labor Statistics"));
  assert.equal(source.status, "ok");
  assert.equal(source.mode, "live");
  assert.equal(source.verified_at, undefined);
});

test("all live BLS transports failing uses a fresh verified cache with transparent partial provenance", async () => {
  const snapshot = await fetchEventRiskSnapshot({
    now: new Date("2026-09-07T15:55:35.410Z"),
    fetchImpl: blsBlockedFetch(),
    wait: noWait,
    blsVerifiedCache: cacheFixture(),
  });
  const source = snapshot.sources.find((item) => item.name.includes("Labor Statistics"));
  assert.equal(snapshot.availability, "partial");
  assert.deepEqual(source, {
    name: "U.S. Bureau of Labor Statistics Calendar",
    status: "failed",
    fetched_at: "2026-09-07T15:55:35.410Z",
    error_code: "parse_source_unavailable",
    mode: "verified_cache",
    verified_at: "2026-09-07T15:55:35.410Z",
  });
  assert.deepEqual(snapshot.events.map((event) => event.category), ["us_ppi"]);
  assert.equal(snapshot.events[0].scheduled_at, "2026-09-10T12:30:00.000Z");
  assert.equal(snapshot.events[0].direction, "unknown");
  assert.equal(snapshot.events[0].impact, "medium");
  assert.match(snapshot.events[0].note, /Verified official BLS schedule cache/);
});

test("verified cache respects the fixed 72-hour horizon without expanding it", async () => {
  const snapshot = await fetchEventRiskSnapshot({
    now: new Date("2026-09-07T15:55:35.410Z"),
    fetchImpl: blsBlockedFetch(),
    wait: noWait,
    blsVerifiedCache: cacheFixture(),
  });
  assert.equal(snapshot.events.some((event) => event.category === "us_ppi" && event.scheduled_at === "2026-09-10T12:30:00.000Z"), true);
  assert.equal(snapshot.events.some((event) => event.category === "us_cpi" && event.scheduled_at === "2026-09-11T12:30:00.000Z"), false);
});

test("all live failures plus stale or malformed verified cache remains unavailable with no fallback events", async () => {
  for (const cache of [
    { ...cacheFixture(), verified_at: "2026-08-01T00:00:00.000Z" },
    { invalid: true },
  ]) {
    const snapshot = await fetchEventRiskSnapshot({
      now: new Date("2026-10-06T12:00:00.000Z"),
      fetchImpl: async () => htmlResponse("forbidden", 403),
      wait: noWait,
      blsVerifiedCache: cache,
    });
    const source = snapshot.sources.find((item) => item.name.includes("Labor Statistics"));
    assert.equal(snapshot.availability, "unavailable");
    assert.deepEqual(snapshot.events, []);
    assert.equal(source.mode, "live");
    assert.equal(source.status, "failed");
    assert.equal(source.verified_at, undefined);
  }
});
