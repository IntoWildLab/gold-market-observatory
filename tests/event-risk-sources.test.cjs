const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { parseBlsEventsIcs } = require("../.tmp-pipeline/lib/data-sources/bls-events.js");
const { parseBeaScheduleHtml } = require("../.tmp-pipeline/lib/data-sources/bea-events.js");
const { parseFedCalendarHtml } = require("../.tmp-pipeline/lib/data-sources/fed-events.js");

const fixture = (name) => readFileSync(join(__dirname, "fixtures", "events", name), "utf8");
const CHAIR = { canonical_name: "Jane Example", accepted_official_display_aliases: ["Jane Q. Example"] };

test("BLS parser keeps only CPI, Employment Situation and PPI", () => {
  const result = parseBlsEventsIcs(fixture("bls-calendar.ics"));
  assert.deepEqual(result.events.map((event) => event.category), ["us_cpi", "us_employment_situation", "us_ppi"]);
  assert.equal(result.events.every((event) => event.direction === "unknown"), true);
  assert.equal(result.events[0].scheduled_at, "2026-01-13T13:30:00.000Z");
  assert.match(result.events[0].note, /Official BLS release calendar/);
});

test("BLS malformed relevant events are skipped with explicit issues", () => {
  const result = parseBlsEventsIcs(fixture("bls-malformed.ics"));
  assert.equal(result.events.length, 0);
  assert.equal(result.issues.length, 4);
  assert.throws(() => parseBlsEventsIcs("<html>blocked</html>"), /VCALENDAR/);
});

test("BEA parser keeps only Personal Income and Outlays and deduplicates", () => {
  const result = parseBeaScheduleHtml(fixture("bea-schedule.html"), 2026);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].category, "us_pce");
  assert.equal(result.events[0].impact, "high");
  assert.equal(result.events[0].scheduled_at, "2026-09-30T12:30:00.000Z");
});

test("BEA missing date/time never creates an event", () => {
  const result = parseBeaScheduleHtml(fixture("bea-malformed.html"), 2026);
  assert.equal(result.events.length, 0);
  assert.deepEqual(result.issues.map((issue) => issue.code).sort(), ["missing_date", "missing_time"]);
  assert.throws(() => parseBeaScheduleHtml("<html>access denied</html>", 2026), /release schedule/);
});

test("Fed parser keeps FOMC and explicit Chair events only", () => {
  const result = parseFedCalendarHtml(fixture("fed-calendar.html"), { chairIdentity: CHAIR });
  assert.deepEqual(result.events.map((event) => event.category), [
    "fomc_minutes", "fed_chair_speech", "fed_chair_speech", "fed_chair_testimony", "fomc_policy_decision", "fomc_press_conference",
  ]);
  assert.equal(result.events.every((event) => event.source_name === "Federal Reserve Board"), true);
  assert.equal(result.events.every((event) => event.direction === "unknown"), true);
});

test("Fed decision and press conference remain distinct", () => {
  const result = parseFedCalendarHtml(fixture("fed-calendar.html"), { chairIdentity: CHAIR });
  const fomc = result.events.filter((event) => event.scheduled_at.startsWith("2026-10-28"));
  assert.equal(fomc.length, 2);
  assert.notEqual(fomc[0].id, fomc[1].id);
});

test("Fed missing date/time is exposed without fabricated events", () => {
  const result = parseFedCalendarHtml(fixture("fed-malformed.html"));
  assert.equal(result.events.length, 0);
  assert.deepEqual(result.issues.map((issue) => issue.code).sort(), ["missing_date", "missing_time"]);
  assert.throws(() => parseFedCalendarHtml("<html>unexpected</html>"), /monthly calendar/);
});

test("Fed Chair events require a supplied verified identity", () => {
  const result = parseFedCalendarHtml(fixture("fed-calendar.html"));
  assert.deepEqual(result.events.map((event) => event.category), ["fomc_minutes", "fomc_policy_decision", "fomc_press_conference"]);
  assert.equal(result.issues.filter((issue) => issue.code === "chair_identity_unavailable").length, 3);
});

test("Fed rejects former, vice, governor, regional, conference and committee chairs", () => {
  const result = parseFedCalendarHtml(fixture("fed-calendar.html"), { chairIdentity: CHAIR });
  const chairEvents = result.events.filter((event) => event.category.startsWith("fed_chair_"));
  assert.equal(chairEvents.length, 3);
  assert.equal(chairEvents.some((event) => /Supervision|Banking|Historical|Conference|Committee|Regional/.test(event.title)), false);
});

test("structure failures differ from valid calendars with no whitelist events", () => {
  assert.throws(
    () => parseBlsEventsIcs("BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR"),
    (error) => error.code === "unexpected_structure",
  );
  const blsEmpty = parseBlsEventsIcs("BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;TZID=America/New_York:20260101T100000\nSUMMARY:Job Openings and Labor Turnover Survey for November 2025\nEND:VEVENT\nEND:VCALENDAR");
  assert.deepEqual(blsEmpty, { events: [], issues: [] });

  const fedShell = "<html><h1>Calendar: October 2026</h1><div class='new-calendar-item'>changed</div></html>";
  assert.throws(() => parseFedCalendarHtml(fedShell), (error) => error.code === "unexpected_structure");
  const fedEmpty = parseFedCalendarHtml("<html><h1>Calendar: October 2026</h1><div class='row eventlist'><div class='eventlist__time'>1:00 p.m.</div><div class='eventlist__event__title'>H.15 - Selected Interest Rates</div><div class='eventlist__event__date'>1</div></div></html>");
  assert.deepEqual(fedEmpty, { events: [], issues: [] });

  const beaShell = "<html><h1>Release Schedule</h1><div class='new-release-row'>changed</div></html>";
  assert.throws(() => parseBeaScheduleHtml(beaShell, 2026), (error) => error.code === "unexpected_structure");
  const beaEmpty = parseBeaScheduleHtml("<html><h1>Release Schedule</h1><table><tr><td>October 6 8:30 AM</td><td>International Trade</td></tr></table></html>", 2026);
  assert.deepEqual(beaEmpty, { events: [], issues: [] });
});
