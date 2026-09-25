const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { default: V5EventRisk } = require("../.tmp-pipeline/components/design/refined-v5/V5EventRisk.js");
const { default: V5DataAvailability } = require("../.tmp-pipeline/components/design/refined-v5/V5DataAvailability.js");
const { resolveDriverSeriesId } = require("../.tmp-pipeline/lib/driver-presentation.js");

function risk(overrides = {}) {
  return {
    availability: "available",
    stale: false,
    generatedAt: "2026-09-18T12:00:00.000Z",
    additionalEventCount: 0,
    provenance: { usesVerifiedCache: false, hasLiveSourceFailure: false },
    ...overrides,
  };
}

function render(eventRisk) {
  return renderToStaticMarkup(React.createElement(V5EventRisk, { data: { eventRisk } }));
}

test("refined-v5 Event Risk preserves all empty schedule states", () => {
  const available = render(risk());
  assert.match(available, /72 小时内无重大事件/);
  assert.match(available, /data-availability="available"/);

  const partial = render(risk({ availability: "partial" }));
  assert.match(partial, /部分可用/);
  assert.match(partial, /已获日程暂无重大事件/);

  const stale = render(risk({ availability: "partial", stale: true }));
  assert.match(stale, /事件日程可能已过期/);
  assert.match(stale, /data-stale="true"/);

  const unavailable = render(risk({ availability: "unavailable" }));
  assert.match(unavailable, /事件日程不可用/);
  assert.doesNotMatch(unavailable, /72 小时内无重大事件/);
});

test("refined-v5 keeps stale and verified provenance visible when an event exists", () => {
  const html = render(risk({
    stale: true,
    provenance: { usesVerifiedCache: true, hasLiveSourceFailure: true },
    nearestEvent: {
      title: "Federal Open Market Committee decision",
      category: "fomc",
      scheduledAt: "2026-09-20T18:00:00.000Z",
      endsAt: "2026-09-20T19:00:00.000Z",
      impact: "high",
      direction: "unknown",
      sourceName: "Federal Reserve Board",
      sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
      status: "upcoming",
    },
  }));
  assert.match(html, /Federal Open Market Committee decision/);
  assert.match(html, /可能过期/);
  assert.match(html, /已核验/);
  assert.match(html, /日程可能已过期/);
  assert.match(html, /官方日程已核验/);
});

test("missing production data renders a restrained global availability notice", () => {
  assert.equal(renderToStaticMarkup(React.createElement(V5DataAvailability, { missing: [] })), "");
  const html = renderToStaticMarkup(React.createElement(V5DataAvailability, {
    missing: [
      { seriesId: "us10y_real", reason: "snapshot unavailable" },
      { seriesId: "gold_etf_flows", reason: "snapshot unavailable" },
    ],
  }));
  assert.match(html, /当前部分观察不可用/);
  assert.match(html, /数据不完整，2 项来源暂缺/);
  assert.match(html, /不作估算/);
  assert.match(html, /data-v5-missing-count="2"/);
  assert.doesNotMatch(html, /npm run data:fetch|red|rose/i);
});

test("header has no fake search or account affordance", () => {
  const source = readFileSync(path.resolve(__dirname, "../components/design/refined-v5/CosmicV5Preview.tsx"), "utf8");
  assert.doesNotMatch(source, /v5-search|v5-account|搜索问题、数据或观点/);
  assert.match(source, /v5-context-label/);
});

test("root and v5 route share the reusable page shell while refined-v4 remains separate", () => {
  const v5Layout = readFileSync(path.resolve(__dirname, "../app/design/refined-v5/layout.tsx"), "utf8");
  const rootPage = readFileSync(path.resolve(__dirname, "../app/page.tsx"), "utf8");
  const v4Layout = readFileSync(path.resolve(__dirname, "../app/design/refined-v4/layout.tsx"), "utf8");
  assert.match(v5Layout, /V5PageShell/);
  assert.match(rootPage, /function HomePage/);
  assert.match(rootPage, /buildDesignData\(await buildPageData\(\)\)/);
  assert.match(rootPage, /V5PageShell/);
  assert.match(rootPage, /CosmicV5Preview/);
  assert.doesNotMatch(v4Layout, /V5PageShell/);
});

test("driver title metadata mapping is explicit and unknown titles cannot fail silently", () => {
  for (const title of [
    "美元(代理)",
    "10Y实际利率",
    "10Y名义收益率",
    "全球黄金ETF",
    "GLD(代表性ETF)",
    "全球央行",
    "中国央行",
    "黄金价格(近20日)",
  ]) {
    assert.equal(typeof resolveDriverSeriesId(title), "string", title);
  }
  assert.equal(resolveDriverSeriesId("renamed driver"), null);
  const source = readFileSync(path.resolve(__dirname, "../components/design/refined-v5/EvidenceLayer.tsx"), "utf8");
  assert.match(source, /元数据映射待维护/);
});
