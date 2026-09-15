const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const WhatChangedCard = require("../.tmp-pipeline/components/design/WhatChangedCard.js").default;

function model(overrides = {}) {
  return {
    availability: "available",
    goldMove: { direction: "down", changePct: -1.24, window: "近1日", endDate: "2026-09-12", description: "黄金短期走弱" },
    environment: { label: "利率与美元共同施压", tone: "pressure", explanation: "实际利率与美元同步走强。", stale: false },
    evidence: [
      { id: "real_yield", label: "10Y 实际利率", direction: "up", change: 12, unit: "bp", window: "近5个有效观测", startDate: "2026-09-07", endDate: "2026-09-12", auxiliary: false, stale: false },
      { id: "dxy", label: "美元指数代理", direction: "up", change: 0.8, unit: "%", window: "近5个有效观测", startDate: "2026-09-07", endDate: "2026-09-12", auxiliary: false, stale: false },
      { id: "nominal_yield", label: "10Y 名义收益率", direction: "up", change: 9, unit: "bp", window: "近5个有效观测", startDate: "2026-09-07", endDate: "2026-09-12", auxiliary: true, stale: false },
    ],
    nextWatch: { kind: "event", label: "FOMC Policy Decision", scheduledAt: "2026-09-13T00:00:00.000Z", hoursUntil: 24, direction: "unknown" },
    disclaimer: "基于已发生的数据变化归纳，不是价格预测或交易建议。",
    ...overrides,
  };
}

const render = (view) => renderToStaticMarkup(React.createElement(WhatChangedCard, { view }));

test("desktop render exposes the four-part reading hierarchy with real values", () => {
  const html = render(model());
  assert.match(html, /lg:grid-cols-\[0\.9fr_1\.45fr_1\.5fr_1fr\]/);
  assert.match(html, /黄金短期走弱/);
  assert.match(html, /-1\.24%/);
  assert.match(html, /利率与美元共同施压/);
  assert.match(html, /\+12bp/);
  assert.match(html, /\+0\.80%/);
  assert.match(html, /FOMC Policy Decision/);
  assert.match(html, /约 24 小时后/);
});

test("mobile render uses one column and stacked section separators", () => {
  const html = render(model());
  assert.match(html, /grid-cols-1/);
  assert.match(html, /border-t pt-3 lg:border-l lg:border-t-0/);
  assert.match(html, /黄金发生了什么/);
  assert.match(html, /当前数据更符合/);
  assert.match(html, /直接证据/);
  assert.match(html, /下一观察点/);
});

test("evidence exposes its own end date to assistive text and stale copy", () => {
  const staleEvidence = model().evidence.map((item, index) => index === 1 ? { ...item, endDate: "2026-09-04", stale: true } : item);
  const html = render(model({ availability: "partial", evidence: staleEvidence }));
  assert.match(html, /部分证据/);
  assert.match(html, /数据截至 2026-09-04/);
  assert.match(html, /更新较慢/);
});

test("insufficient render keeps the card usable and explicit", () => {
  const html = render(model({
    availability: "insufficient",
    goldMove: { direction: "neutral", changePct: null, window: "近1日", endDate: null, description: "当前变化数据不足" },
    evidence: [],
  }));
  assert.match(html, /当前变化数据不足/);
  assert.match(html, /近1日 —/);
  assert.match(html, /宏观变化数据不足/);
});

test("Refined V4 places What Changed after status summary and before detailed gold cards", () => {
  const source = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "../components/design/RefinedV4Preview.tsx"), "utf8");
  const status = source.indexOf("状态摘要:");
  const whatChanged = source.indexOf("<WhatChangedCard");
  const details = source.indexOf("<InternationalGoldSummary");
  assert.equal(status >= 0 && status < whatChanged && whatChanged < details, true);
});

test("UI source does not contain prohibited trading or unsupported policy-expectation copy", () => {
  const source = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "../components/design/WhatChangedCard.tsx"), "utf8");
  for (const phrase of ["买入", "卖出", "抄底", "止损", "目标价", "加息预期升温", "降息预期下降"]) assert.equal(source.includes(phrase), false, phrase);
});
