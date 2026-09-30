const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, mkdir, readFile, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");

test("buildPageData does not crash when quarterly shares, daily shares and foundation are absent", async () => {
  const repoRoot = path.resolve(__dirname, "..");
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "page-data-degraded-"));
  await mkdir(path.join(fixtureRoot, "data", "series"), { recursive: true });
  const previousCwd = process.cwd();
  const originalLoad = Module._load;
  try {
    process.chdir(fixtureRoot);
    Module._load = function(request, parent, isMain) {
      if (request === "server-only") return {};
      if (request.startsWith("@/")) {
        return originalLoad.call(this, path.join(repoRoot, ".tmp-pipeline", `${request.slice(2)}.js`), parent, isMain);
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    const { buildPageData } = require(path.join(repoRoot, ".tmp-pipeline", "lib", "page-data.js"));
    const data = await buildPageData(new Date("2026-09-14T00:00:00Z"));
    assert.equal(data.series.cn_gold_etf_shares_daily, undefined);
    assert.equal(data.charts.find((chart) => chart.seriesId === "cn_gold_etf_shares").points.length, 0);
    assert.equal(data.cnGoldEtfFoundation, null);
    assert.equal(data.china.etf.sharesValue, null);
    assert.equal(data.china.etf.price, null);
  } finally {
    Module._load = originalLoad;
    process.chdir(previousCwd);
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("refined-v5 investor layer renders an explicit unavailable shares state", async () => {
  const source = await readFile(path.resolve(__dirname, "../components/design/refined-v5/InvestorLayer.tsx"), "utf8");
  assert.match(source, /daily_shares_availability === "available"/);
  assert.match(source, /日度份额.*不可用/);
});
