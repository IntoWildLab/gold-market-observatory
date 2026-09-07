const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, readFile, readdir, rm, writeFile } = require("node:fs/promises");
const { readFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { fetchOfficialText, EventSourceFetchError, EVENT_RISK_USER_AGENT } = require("../.tmp-pipeline/lib/data-sources/event-http.js");
const { parseFedChairIdentityHtml } = require("../.tmp-pipeline/lib/data-sources/fed-chair.js");
const { fedCalendarPagesForHorizon } = require("../.tmp-pipeline/lib/data-sources/fed-events-fetch.js");
const { parseBlsScheduleHtml } = require("../.tmp-pipeline/lib/data-sources/bls-events-html.js");
const { parseBlsReleaseScheduleHtml } = require("../.tmp-pipeline/lib/data-sources/bls-release-schedule.js");
const { fetchBlsEvents, blsSchedulePagesForHorizon } = require("../.tmp-pipeline/lib/data-sources/bls-events-fetch.js");
const {
  fetchEventRiskSnapshot,
  isEventRiskSnapshotStale,
  validateEventRiskSnapshot,
  writeEventRiskSnapshotAtomic,
} = require("../.tmp-pipeline/lib/event-risk-snapshot.js");

const fixture = (name) => readFileSync(path.join(__dirname, "fixtures", "events", name), "utf8");
const noWait = async () => {};
const htmlResponse = (body, status = 200) => new Response(body, {
  status,
  headers: { "content-type": "text/html; charset=utf-8" },
});
const calendarResponse = (body, status = 200) => new Response(body, {
  status,
  headers: { "content-type": "text/calendar; charset=utf-8" },
});

test("HTTP adapter retries only transient failures and validates successful responses", async () => {
  let attempts = 0;
  let defaultHeaders;
  const transient = async (_input, init) => {
    attempts += 1;
    defaultHeaders = new Headers(init.headers);
    return attempts < 3 ? htmlResponse("busy", 500) : htmlResponse("<html>Calendar eventlist</html>");
  };
  const result = await fetchOfficialText({
    url: "https://www.federalreserve.gov/test",
    acceptedContentTypes: ["text/html"],
    requiredMarkers: [/Calendar/, /eventlist/],
    fetchImpl: transient,
    wait: noWait,
  });
  assert.match(result, /eventlist/);
  assert.equal(attempts, 3);
  assert.equal(defaultHeaders.get("user-agent"), EVENT_RISK_USER_AGENT);
  assert.equal(defaultHeaders.get("accept"), "text/html");
  assert.equal(defaultHeaders.has("accept-language"), false);

  for (const status of [400, 401, 403, 404]) {
    attempts = 0;
    await assert.rejects(
      fetchOfficialText({
        url: "https://www.bls.gov/test",
        acceptedContentTypes: ["text/html"],
        requiredMarkers: [/ok/],
        fetchImpl: async () => { attempts += 1; return htmlResponse("error", status); },
        wait: noWait,
      }),
      (error) => error instanceof EventSourceFetchError && error.code === `http_${status}`,
    );
    assert.equal(attempts, 1);
  }
});

test("HTTP adapter retries 429, network failures and timeouts with bounded attempts", async () => {
  for (const scenario of [
    { response: () => htmlResponse("busy", 429), code: "http_429" },
    { response: () => { throw new Error("offline"); }, code: "network_error" },
    { response: () => { const error = new Error("aborted"); error.name = "AbortError"; throw error; }, code: "timeout" },
  ]) {
    let attempts = 0;
    await assert.rejects(
      fetchOfficialText({
        url: "https://www.bea.gov/test",
        acceptedContentTypes: ["text/html"],
        requiredMarkers: [/ok/],
        fetchImpl: async () => { attempts += 1; return scenario.response(); },
        wait: noWait,
      }),
      (error) => error instanceof EventSourceFetchError && error.code === scenario.code,
    );
    assert.equal(attempts, 3);
  }
});

test("HTTP 200 trust failures are not retried or treated as valid source data", async () => {
  const cases = [
    { response: new Response("Calendar eventlist", { headers: { "content-type": "application/json" } }), code: "unexpected_content_type" },
    { response: htmlResponse("<html>access denied</html>"), code: "unexpected_content" },
    { response: htmlResponse("   "), code: "empty_response" },
  ];
  for (const item of cases) {
    let attempts = 0;
    await assert.rejects(fetchOfficialText({
      url: "https://www.federalreserve.gov/test",
      acceptedContentTypes: ["text/html"],
      requiredMarkers: [/Calendar/, /eventlist/],
      fetchImpl: async () => { attempts += 1; return item.response; },
      wait: noWait,
    }), (error) => error.code === item.code);
    assert.equal(attempts, 1);
  }
});

test("current Fed Chair identity requires one explicit official Chair entry", () => {
  assert.deepEqual(parseFedChairIdentityHtml(fixture("fed-chair.html")), { canonical_name: "Jane Example" });
  assert.throws(
    () => parseFedChairIdentityHtml("<html><h1>Board Members</h1><p>Board of Governors</p><p>Chair vacancy</p></html>"),
    /exactly one current Chair/,
  );
});

test("Fed parser accepts the official panel and column monthly calendar structure", () => {
  const { parseFedCalendarHtml } = require("../.tmp-pipeline/lib/data-sources/fed-events.js");
  const html = `<html><h2>Calendar</h2><h4 class="text-center">September 2026</h4>
    <div class="panel panel-unstyled col-xs-12"><div class="panel-body"><div class="row">
      <div class="col-xs-2"><p>2:30 p.m.</p></div><div class="col-xs-7"><p><a href="/live-broadcast.htm">FOMC Press Conference</a></p></div><div class="col-xs-3"><p>16</p></div>
    </div></div></div>
    <div class="panel panel-unstyled col-xs-12"><div class="panel-body"><div class="row">
      <div class="col-xs-2"><p>9:00 a.m.</p></div><div class="col-xs-7"><p>Speech - Chair Jane Example</p><p><a href="https://events.example.com/live">Watch Live</a></p><p>Gold and Monetary Policy</p><p>At an official conference</p></div><div class="col-xs-3"><p>17</p></div>
    </div></div></div></html>`;
  const result = parseFedCalendarHtml(html, { chairIdentity: { canonical_name: "Jane Example" } });
  assert.deepEqual(result.events.map((event) => event.category), ["fomc_press_conference", "fed_chair_speech"]);
  assert.deepEqual(result.issues, []);
  assert.equal(result.events[1].title, "Speech - Gold and Monetary Policy");
  assert.equal(result.events[1].source_url, "https://www.federalreserve.gov/newsevents/calendar.htm");
});

test("Fed horizon page selection is deterministic and handles a New York month boundary", () => {
  assert.deepEqual(
    fedCalendarPagesForHorizon(new Date("2026-10-31T16:00:00.000Z")),
    [
      { year: 2026, month: 10, url: "https://www.federalreserve.gov/newsevents/2026-october.htm" },
      { year: 2026, month: 11, url: "https://www.federalreserve.gov/newsevents/2026-november.htm" },
    ],
  );
});

test("BLS HTML parser accepts only the exact V0.1 whitelist and deduplicates", () => {
  const result = parseBlsScheduleHtml(
    fixture("bls-schedule.html"),
    "https://www.bls.gov/schedule/2026/09_sched_list.htm",
  );
  assert.deepEqual(result.events.map((event) => event.category), ["us_employment_situation", "us_ppi", "us_cpi"]);
  assert.equal(result.events[0].scheduled_at, "2026-09-04T12:30:00.000Z");
  assert.equal(result.events.every((event) => new URL(event.source_url).hostname.endsWith("bls.gov")), true);
  assert.deepEqual(result.issues, []);
});

test("BLS HTML parser distinguishes invalid structure from a valid empty whitelist", () => {
  assert.throws(
    () => parseBlsScheduleHtml("<html><h1>Access denied</h1></html>", "https://www.bls.gov/schedule/2026/09_sched_list.htm"),
    /recognizable BLS release schedule/,
  );
  const empty = parseBlsScheduleHtml(
    "<html><h1>Schedule of Selected Releases</h1><table><tr><td>Friday, September 18, 2026</td><td>10:00 AM</td><td>Real Earnings for August 2026</td></tr></table><p>All times on calendar are Eastern Time</p></html>",
    "https://www.bls.gov/schedule/2026/09_sched_list.htm",
  );
  assert.deepEqual(empty, { events: [], issues: [] });
});

test("BLS HTML parser uses strict Eastern Time normalization across EST and EDT", () => {
  const html = `<html><h1>Schedule of Selected Releases</h1><table>
    <tr><td>Friday, March 6, 2026</td><td>08:30 AM</td><td>Employment Situation for February 2026</td></tr>
    <tr><td>Friday, September 4, 2026</td><td>08:30 AM</td><td>Employment Situation for August 2026</td></tr>
    </table><p>All times on calendar are Eastern Time</p></html>`;
  const result = parseBlsScheduleHtml(html, "https://www.bls.gov/schedule/2026/09_sched_list.htm");
  assert.deepEqual(result.events.map((event) => event.scheduled_at), ["2026-03-06T13:30:00.000Z", "2026-09-04T12:30:00.000Z"]);
});

test("BLS HTML fallback month selection covers only horizon months", () => {
  assert.deepEqual(blsSchedulePagesForHorizon(new Date("2026-08-31T16:00:00.000Z")), [
    { year: 2026, month: 8, url: "https://www.bls.gov/schedule/2026/08_sched_list.htm" },
    { year: 2026, month: 9, url: "https://www.bls.gov/schedule/2026/09_sched_list.htm" },
  ]);
});

test("BLS ICS success does not request the HTML fallback", async () => {
  const calls = [];
  let requestHeaders;
  const result = await fetchBlsEvents(new Date("2026-09-06T12:00:00.000Z"), {
    fetchImpl: async (input, init) => {
      calls.push(String(input));
      requestHeaders = new Headers(init.headers);
      if (!String(input).endsWith("bls.ics")) throw new Error("HTML fallback must not be called");
      return calendarResponse(fixture("bls-calendar.ics"));
    },
    wait: noWait,
  });
  assert.equal(result.transport, "ics");
  assert.equal(calls.length, 1);
  assert.equal(requestHeaders.get("user-agent"), EVENT_RISK_USER_AGENT);
  assert.equal(requestHeaders.get("accept"), "text/calendar,text/plain;q=0.9,*/*;q=0.8");
  assert.equal(requestHeaders.get("accept-language"), "en-US,en;q=0.8");
  assert.equal(/Mozilla|Chrome|Safari/i.test(requestHeaders.get("user-agent")), false);
});

test("BLS official HTML fallback handles ICS HTTP, network and parser failures", async () => {
  const primaryFailures = [
    () => calendarResponse("forbidden", 403),
    () => { throw new Error("network unavailable"); },
    () => calendarResponse("BEGIN:VCALENDAR\nBEGIN:VEVENT\n\nEND:VEVENT\nEND:VCALENDAR"),
  ];
  for (const primaryFailure of primaryFailures) {
    let htmlCalls = 0;
    let htmlHeaders;
    const result = await fetchBlsEvents(new Date("2026-09-06T12:00:00.000Z"), {
      fetchImpl: async (input, init) => {
        if (String(input).endsWith("bls.ics")) return primaryFailure();
        htmlCalls += 1;
        htmlHeaders = new Headers(init.headers);
        return htmlResponse(fixture("bls-schedule.html"));
      },
      wait: noWait,
    });
    assert.equal(result.transport, "html_fallback");
    assert.equal(htmlCalls, 1);
    assert.equal(result.events.length, 3);
    assert.equal(htmlHeaders.get("user-agent"), EVENT_RISK_USER_AGENT);
    assert.equal(htmlHeaders.get("accept"), "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8");
    assert.equal(htmlHeaders.get("accept-language"), "en-US,en;q=0.8");
  }
});

test("BLS source fails when both ICS and official HTML fallback fail", async () => {
  const result = await fetchBlsEvents(new Date("2026-09-06T12:00:00.000Z"), {
    fetchImpl: async () => htmlResponse("forbidden", 403),
    wait: noWait,
  });
  assert.equal(result.transport, "release_schedule_fallback");
  assert.deepEqual(result.release_coverage, { successful: [], failed: ["us_cpi", "us_employment_situation", "us_ppi"] });
  assert.equal(result.issues.every((issue) => issue.code === "source_unavailable"), true);
});

test("BLS release-specific parsers validate headings, dates, DST, sorting and dedupe", () => {
  const definitions = [
    ["us_cpi", "bls-release-cpi.html", "https://www.bls.gov/schedule/news_release/cpi.htm"],
    ["us_employment_situation", "bls-release-empsit.html", "https://www.bls.gov/schedule/news_release/empsit.htm"],
    ["us_ppi", "bls-release-ppi.html", "https://www.bls.gov/schedule/news_release/ppi.htm"],
  ];
  const events = definitions.flatMap(([category, name, url]) => {
    const result = parseBlsReleaseScheduleHtml(fixture(name), category, url);
    assert.deepEqual(result.issues, []);
    assert.equal(result.events.every((event) => event.category === category && new URL(event.source_url).hostname === "www.bls.gov"), true);
    return result.events;
  });
  const { sortAndDedupeEvents, visibleEventRiskEvents } = require("../.tmp-pipeline/lib/event-risk.js");
  const sorted = sortAndDedupeEvents(events);
  assert.equal(sorted.filter((event) => event.category === "us_ppi" && event.scheduled_at === "2026-09-10T12:30:00.000Z").length, 1);
  assert.equal(sorted.some((event) => event.scheduled_at === "2026-01-13T13:30:00.000Z"), true);
  assert.deepEqual(visibleEventRiskEvents(sorted, new Date("2026-09-07T12:30:00.000Z")).map((event) => event.category), ["us_ppi"]);
});

test("BLS release-specific parser rejects a wrong heading and reports malformed target rows", () => {
  const url = "https://www.bls.gov/schedule/news_release/cpi.htm";
  assert.throws(
    () => parseBlsReleaseScheduleHtml(fixture("bls-release-ppi.html"), "us_cpi", url),
    /does not match/,
  );
  const malformed = `<html><h2>Schedule of Releases for the Consumer Price Index</h2><table>
    <tr><th>Reference Month</th><th>Release Date</th><th>Release Time</th></tr>
    <tr><th>August 2026</th><td>Feb. 30, 2026</td><td>08:30 AM</td></tr>
    <tr><th>September 2026</th><td>Oct. 14, 2026</td><td>25:00 AM</td></tr></table></html>`;
  const result = parseBlsReleaseScheduleHtml(malformed, "us_cpi", url);
  assert.deepEqual(result.events, []);
  assert.deepEqual(result.issues.map((issue) => issue.code).sort(), ["missing_time", "unsupported_datetime"]);
});

function releaseFallbackFetch(failedCategory) {
  return async (input) => {
    const url = String(input);
    if (url.endsWith("bls.ics") || url.includes("_sched_list.htm")) return htmlResponse("forbidden", 403);
    const mapping = {
      "us_cpi": ["cpi.htm", "bls-release-cpi.html"],
      "us_employment_situation": ["empsit.htm", "bls-release-empsit.html"],
      "us_ppi": ["ppi.htm", "bls-release-ppi.html"],
    };
    for (const [category, [suffix, fixtureName]] of Object.entries(mapping)) {
      if (url.endsWith(suffix)) return category === failedCategory ? htmlResponse("forbidden", 403) : htmlResponse(fixture(fixtureName));
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
}

test("BLS release-specific fallback activates only after ICS and monthly failure", async () => {
  const result = await fetchBlsEvents(new Date("2026-09-07T12:30:00.000Z"), {
    fetchImpl: releaseFallbackFetch(), wait: noWait,
  });
  assert.equal(result.transport, "release_schedule_fallback");
  assert.deepEqual(result.release_coverage, { successful: ["us_cpi", "us_employment_situation", "us_ppi"], failed: [] });
  assert.deepEqual(result.issues, []);
  assert.equal(result.events.some((event) => event.category === "us_ppi" && event.scheduled_at === "2026-09-10T12:30:00.000Z"), true);
});

test("partial release-specific coverage keeps events but marks the BLS source incomplete", async () => {
  const result = await fetchBlsEvents(new Date("2026-09-07T12:30:00.000Z"), {
    fetchImpl: releaseFallbackFetch("us_cpi"), wait: noWait,
  });
  assert.deepEqual(result.release_coverage, { successful: ["us_employment_situation", "us_ppi"], failed: ["us_cpi"] });
  assert.equal(result.issues.some((issue) => issue.code === "source_unavailable"), true);
  assert.equal(result.events.some((event) => event.category === "us_ppi"), true);
});

function officialFetch(overrides = {}) {
  return async (input) => {
    const url = String(input);
    if (overrides[url]) return overrides[url]();
    if (url.includes("/aboutthefed/bios/board/default.htm")) return htmlResponse(fixture("fed-chair.html"));
    if (url.includes("/newsevents/2026-october.htm")) return htmlResponse(fixture("fed-calendar.html"));
    if (url.includes("bls.ics")) return calendarResponse(fixture("bls-calendar.ics"));
    if (url.includes("bea.gov/news/schedule")) return htmlResponse(fixture("bea-schedule.html"));
    throw new Error(`Unexpected URL: ${url}`);
  };
}

test("snapshot orchestration produces available, filtered, deterministic official data", async () => {
  const snapshot = await fetchEventRiskSnapshot({
    now: new Date("2026-10-06T12:00:00.000Z"),
    fetchImpl: officialFetch(),
    wait: noWait,
  });
  assert.equal(snapshot.availability, "available");
  assert.equal(snapshot.sources.every((source) => source.status === "ok"), true);
  assert.deepEqual(snapshot.events.map((event) => event.category), ["fomc_minutes"]);
  assert.equal(snapshot.events.every((event) => event.direction === "unknown"), true);
  assert.equal(JSON.stringify(snapshot).includes("is_mock"), false);
  validateEventRiskSnapshot(snapshot);
});

test("one calendar failure is partial and does not discard healthy official sources", async () => {
  const snapshot = await fetchEventRiskSnapshot({
    now: new Date("2026-10-06T12:00:00.000Z"),
    fetchImpl: officialFetch({
      "https://www.bls.gov/schedule/news_release/bls.ics": () => calendarResponse("busy", 503),
      "https://www.bls.gov/schedule/2026/10_sched_list.htm": () => htmlResponse("busy", 503),
    }),
    wait: noWait,
  });
  assert.equal(snapshot.availability, "partial");
  assert.equal(snapshot.sources.find((source) => source.name.includes("Labor Statistics")).error_code, "parse_source_unavailable");
  assert.deepEqual(snapshot.events.map((event) => event.category), ["fomc_minutes"]);
});

test("Chair identity failure excludes Chair events while retaining other valid Fed events", async () => {
  const identityUrl = "https://www.federalreserve.gov/aboutthefed/bios/board/default.htm";
  const snapshot = await fetchEventRiskSnapshot({
    now: new Date("2026-10-06T12:00:00.000Z"),
    fetchImpl: officialFetch({ [identityUrl]: () => htmlResponse("forbidden", 403) }),
    wait: noWait,
  });
  assert.equal(snapshot.availability, "partial");
  assert.equal(snapshot.sources.find((source) => source.name.includes("Chair Identity")).status, "failed");
  assert.equal(snapshot.events.some((event) => event.category.startsWith("fed_chair_")), false);
  assert.deepEqual(snapshot.events.map((event) => event.category), ["fomc_minutes"]);
});

test("all calendar failures produce unavailable with no fabricated fallback", async () => {
  const fetchImpl = async () => htmlResponse("forbidden", 403);
  const snapshot = await fetchEventRiskSnapshot({
    now: new Date("2026-10-06T12:00:00.000Z"), fetchImpl, wait: noWait,
  });
  assert.equal(snapshot.availability, "unavailable");
  assert.deepEqual(snapshot.events, []);
  assert.equal(snapshot.sources.every((source) => source.status === "failed"), true);
});

test("valid official pages with no whitelist matches remain available and empty", async () => {
  const fetchImpl = async (input) => {
    const url = String(input);
    if (url.includes("/aboutthefed/")) return htmlResponse(fixture("fed-chair.html"));
    if (url.includes("federalreserve.gov/newsevents")) return htmlResponse('<html><h1>Calendar: October 2026</h1><div class="eventlist" data-date="7"><div class="eventlist__event__title">Community Banking Webinar</div><div class="eventlist__event__time">10:00 a.m.</div></div></html>');
    if (url.includes("bls.ics")) return calendarResponse("BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Import Price Index\nDTSTART;TZID=America/New_York:20261007T083000\nDTEND;TZID=America/New_York:20261007T090000\nEND:VEVENT\nEND:VCALENDAR");
    return htmlResponse("<html><h1>Release Schedule</h1><table><tr><td>Gross Domestic Product</td><td>October 7</td><td>8:30 AM</td></tr></table></html>");
  };
  const snapshot = await fetchEventRiskSnapshot({ now: new Date("2026-10-06T12:00:00.000Z"), fetchImpl, wait: noWait });
  assert.equal(snapshot.availability, "available");
  assert.deepEqual(snapshot.events, []);
});

test("snapshot staleness uses a strict 36-hour boundary", () => {
  const snapshot = { generated_at: "2026-10-06T12:00:00.000Z" };
  assert.equal(isEventRiskSnapshotStale(snapshot, new Date("2026-10-08T00:00:00.000Z")), false);
  assert.equal(isEventRiskSnapshotStale(snapshot, new Date("2026-10-08T00:00:00.001Z")), true);
});

test("snapshot validation rejects dynamic fields and events outside the fixed horizon", async () => {
  const snapshot = await fetchEventRiskSnapshot({ now: new Date("2026-10-06T12:00:00.000Z"), fetchImpl: officialFetch(), wait: noWait });
  assert.throws(() => validateEventRiskSnapshot({ ...snapshot, hours_until: 4 }), /dynamic field/);
  const outside = structuredClone(snapshot);
  outside.events[0].scheduled_at = "2026-10-10T13:00:00.000Z";
  outside.events[0].ends_at = "2026-10-10T14:00:00.000Z";
  assert.throws(() => validateEventRiskSnapshot(outside), /event ID is invalid|outside the snapshot horizon/);
});

test("snapshot validation permits an event window already in progress", async () => {
  const { buildEventRiskEvent } = require("../.tmp-pipeline/lib/event-risk.js");
  const snapshot = await fetchEventRiskSnapshot({ now: new Date("2026-10-06T12:00:00.000Z"), fetchImpl: officialFetch(), wait: noWait });
  snapshot.events = [buildEventRiskEvent({
    title: "FOMC Minutes",
    category: "fomc_minutes",
    scheduled_at: "2026-10-06T11:30:00.000Z",
    ends_at: "2026-10-06T12:30:00.000Z",
    source_name: "Federal Reserve Board",
    source_url: "https://www.federalreserve.gov/newsevents/calendar.htm",
  })];
  validateEventRiskSnapshot(snapshot);
});

test("atomic writer validates first, replaces target and leaves no temp artifact", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "event-risk-"));
  const target = path.join(directory, "event-risk.json");
  try {
    const snapshot = await fetchEventRiskSnapshot({ now: new Date("2026-10-06T12:00:00.000Z"), fetchImpl: officialFetch(), wait: noWait });
    await writeFile(target, "old", "utf8");
    await writeEventRiskSnapshotAtomic(target, snapshot);
    assert.deepEqual(JSON.parse(await readFile(target, "utf8")), JSON.parse(JSON.stringify(snapshot)));
    assert.deepEqual(await readdir(directory), ["event-risk.json"]);
    await assert.rejects(writeEventRiskSnapshotAtomic(target, { ...snapshot, availability: "unavailable" }), /inconsistent/);
    assert.deepEqual(JSON.parse(await readFile(target, "utf8")), JSON.parse(JSON.stringify(snapshot)));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
