const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseHuaanProductNav,
  parseHuaanPcfNav,
  parseSseDailyShares,
  fetchCnEtfOfficialNav,
  fetchCnEtfDailySharesLatest,
  fetchCnEtfDailySharesLatestWithFallback,
  fetchCnEtfDailySharesOn,
  fetchSseSharesOfficialFallback,
  validateSseSharesConsistency,
  preserveProductNavFirstObserved,
} = require("../.tmp-pipeline/lib/data-sources/cnEtf.js");
const { HttpError } = require("../.tmp-pipeline/lib/data-sources/http.js");
const { buildEtfFoundationRows } = require("../.tmp-pipeline/lib/cn-etf-foundation.js");
const { mergeObservations } = require("../.tmp-pipeline/lib/series-merge.js");

const product = `<li><span>日期</span><br><span>2026-08-21</span></li>
<li><span>单位净值</span><br><span>9.3598</span></li>
<li><span>累计净值</span><br><span>3.5344</span></li>`;
const pcf = `<div>公告日期 20260821</div><div>20260820 信息内容</div>
<p>基金份额净值(单位:元) ￥9.2133</p>`;

test("华安产品页只读取单位净值并记录首次观察时间", () => {
  const point = parseHuaanProductNav(product, "2026-08-22T01:02:03.000Z");
  assert.deepEqual(point, { date: "2026-08-21", value: 9.3598, publishedAt: "2026-08-22T01:02:03.000Z", source: "huaan_product" });
  assert.notEqual(point.value, 3.5344);
});

test("华安产品页字段缺失时明确失败", () => {
  assert.throws(() => parseHuaanProductNav("<li>累计净值 3.5</li>", "x"), /未找到/);
});

test("PCF 使用信息内容日期和基金份额净值", () => {
  assert.deepEqual(parseHuaanPcfNav(pcf), { date: "2026-08-20", value: 9.2133, publishedAt: "2026-08-21", source: "huaan_pcf" });
});

test("NAV 主源失败时回退 PCF", async () => {
  let calls = 0;
  const result = await fetchCnEtfOfficialNav("2026-08-22T00:00:00Z", async () => (++calls === 1 ? Promise.reject(new Error("primary down")) : pcf));
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.point.value, 9.2133);
});

test("产品页重复抓取保留首次观察时间", () => {
  const point = parseHuaanProductNav(product, "2026-08-23T06:20:00Z");
  assert.equal(preserveProductNavFirstObserved(point, "2026-08-23T06:08:00Z").publishedAt, "2026-08-23T06:08:00Z");
});

test("上交所份额校验代码并把万份换算成亿份", () => {
  const [point] = parseSseDailyShares({ result: [{ STAT_DATE: "2026-08-21", SEC_CODE: "518880", TOT_VOL: "1027234.08" }] });
  assert.equal(point.rawValue, 1027234.08);
  assert.ok(Math.abs(point.value - 102.723408) < 1e-10);
  assert.throws(() => parseSseDailyShares({ result: [{ STAT_DATE: "2026-08-21", SEC_CODE: "000000", TOT_VOL: 1 }] }), /无效/);
});

test("重复份额日期被拒绝", () => {
  const row = { STAT_DATE: "2026-08-21", SEC_CODE: "518880", TOT_VOL: 1 };
  assert.throws(() => parseSseDailyShares({ result: [row, row] }), /重复/);
});

const validSseSharesPayload = {
  result: [{ STAT_DATE: "2026-08-21", SEC_CODE: "518880", TOT_VOL: "1027234.08" }],
};

function noWaitDependencies(getJson, warnings = []) {
  return { getJson, wait: async () => {}, warn: (message) => warnings.push(message) };
}

function failingPrimaryThenFallback(primaryError, fallbackPayload, urls = [], warnings = []) {
  return noWaitDependencies(async (url) => {
    urls.push(url);
    const sqlId = new URL(url).searchParams.get("sqlId");
    if (sqlId.includes("ETFJBXX")) throw primaryError();
    return fallbackPayload;
  }, warnings);
}

test("日度份额第一次请求成功且不重试", async () => {
  let calls = 0;
  const points = await fetchCnEtfDailySharesLatest(noWaitDependencies(async () => {
    calls += 1;
    return validSseSharesPayload;
  }));
  assert.equal(calls, 1);
  assert.equal(points[0].securityCode, "518880");
});

test("日度份额第一次网络失败后第二次成功", async () => {
  let calls = 0;
  const waits = [];
  const warnings = [];
  const points = await fetchCnEtfDailySharesLatest({
    getJson: async () => {
      calls += 1;
      if (calls === 1) {
        const error = new TypeError("fetch failed");
        error.cause = { code: "ECONNRESET" };
        throw error;
      }
      return validSseSharesPayload;
    },
    wait: async (ms) => waits.push(ms),
    warn: (message) => warnings.push(message),
  });
  assert.equal(calls, 2);
  assert.deepEqual(waits, [1000]);
  assert.equal(points.length, 1);
  assert.match(warnings[0], /attempt 1\/3.*ECONNRESET.*query\.sse\.com\.cn\/commonQuery\.do/);
  assert.doesNotMatch(warnings[0], /sqlId|SEC_CODE/);
});

test("日度份额在 timeout、HTTP 429 和 5xx 后重试", async () => {
  for (const status of [0, 429, 503]) {
    let calls = 0;
    const points = await fetchCnEtfDailySharesLatest(noWaitDependencies(async () => {
      calls += 1;
      if (calls === 1) {
        throw new HttpError(status === 0 ? "timeout after 20000ms" : `HTTP ${status}`, status, "https://query.sse.com.cn/commonQuery.do?sensitive=hidden");
      }
      return validSseSharesPayload;
    }));
    assert.equal(calls, 2);
    assert.equal(points.length, 1);
  }
});

test("带回退的 latest 查询主源首试成功时不调用回退", async () => {
  const urls = [];
  const result = await fetchCnEtfDailySharesLatestWithFallback("2026-08-21", noWaitDependencies(async (url) => {
    urls.push(url);
    return validSseSharesPayload;
  }));
  assert.equal(result.transport, "primary");
  assert.equal(urls.length, 1);
  assert.match(urls[0], /ETFJBXX_JJGM_MOREN_L/);
});

test("带回退的 latest 查询主源瞬时失败后成功时不调用回退", async () => {
  const urls = [];
  let calls = 0;
  const result = await fetchCnEtfDailySharesLatestWithFallback("2026-08-21", noWaitDependencies(async (url) => {
    urls.push(url);
    calls += 1;
    if (calls === 1) throw new HttpError("HTTP 503", 503, url);
    return validSseSharesPayload;
  }));
  assert.equal(result.transport, "primary");
  assert.equal(urls.length, 2);
  assert.ok(urls.every((url) => url.includes("ETFJBXX_JJGM_MOREN_L")));
});

for (const [name, errorFactory] of [
  ["HTTP 403", () => new HttpError("HTTP 403", 403, "https://query.sse.com.cn/commonQuery.do")],
  ["ETIMEDOUT", () => Object.assign(new TypeError("fetch failed"), { cause: { code: "ETIMEDOUT" } })],
  ["HTTP 5xx", () => new HttpError("HTTP 503", 503, "https://query.sse.com.cn/commonQuery.do")],
]) {
  test(`主源 ${name} 三次耗尽后使用官方 ETF规模回退`, async () => {
    const urls = [];
    const warnings = [];
    const result = await fetchCnEtfDailySharesLatestWithFallback(
      "2026-08-21",
      failingPrimaryThenFallback(errorFactory, validSseSharesPayload, urls, warnings),
    );
    assert.equal(result.transport, "official_scale_fallback");
    assert.equal(urls.filter((url) => url.includes("ETFJBXX_JJGM_MOREN_L")).length, 3);
    assert.equal(urls.filter((url) => url.includes("XXPL_ETFGM_SEARCH_L")).length, 1);
    assert.match(warnings.at(-1), /official scale fallback succeeded: 2026-08-21/);
  });
}

test("官方回退拒绝错误 SEC_CODE", async () => {
  await assert.rejects(
    fetchCnEtfDailySharesLatestWithFallback("2026-08-21", failingPrimaryThenFallback(
      () => new HttpError("HTTP 403", 403, "x"),
      { result: [{ STAT_DATE: "2026-08-21", SEC_CODE: "000000", TOT_VOL: 1 }] },
    )),
    /缺少证券代码 518880/,
  );
});

test("官方回退拒绝不真实的 STAT_DATE", async () => {
  await assert.rejects(
    fetchCnEtfDailySharesLatestWithFallback("2026-08-21", failingPrimaryThenFallback(
      () => new HttpError("HTTP 403", 403, "x"),
      { result: [{ STAT_DATE: "2026-02-30", SEC_CODE: "518880", TOT_VOL: 1 }] },
    )),
    /无效/,
  );
});

test("官方回退拒绝无效 TOT_VOL", async () => {
  await assert.rejects(
    fetchCnEtfDailySharesLatestWithFallback("2026-08-21", failingPrimaryThenFallback(
      () => new HttpError("HTTP 403", 403, "x"),
      { result: [{ STAT_DATE: "2026-08-21", SEC_CODE: "518880", TOT_VOL: 0 }] },
    )),
    /无效/,
  );
});

test("官方回退拒绝重复日期", async () => {
  const row = { STAT_DATE: "2026-08-21", SEC_CODE: "518880", TOT_VOL: 1 };
  await assert.rejects(
    fetchCnEtfDailySharesLatestWithFallback("2026-08-21", failingPrimaryThenFallback(
      () => new HttpError("HTTP 403", 403, "x"),
      { result: [row, row] },
    )),
    /重复/,
  );
});

test("主源与官方回退均失败时拒绝且不制造数据", async () => {
  let generated;
  let calls = 0;
  await assert.rejects(async () => {
    generated = await fetchCnEtfDailySharesLatestWithFallback("2026-08-21", noWaitDependencies(async (url) => {
      calls += 1;
      throw new HttpError("HTTP 503", 503, url);
    }));
  }, /HTTP 503/);
  assert.equal(calls, 4);
  assert.equal(generated, undefined);
});

test("主源与官方回退同日同值通过一致性检查", () => {
  const primary = parseSseDailyShares(validSseSharesPayload);
  const fallback = parseSseDailyShares({ result: [{ ...validSseSharesPayload.result[0], TOT_VOL: 1027234.08 }] });
  assert.doesNotThrow(() => validateSseSharesConsistency(primary, fallback));
  const inconsistent = parseSseDailyShares({ result: [{ ...validSseSharesPayload.result[0], TOT_VOL: 1027234.09 }] });
  assert.throws(() => validateSseSharesConsistency(primary, inconsistent), /不一致/);
});

test("官方回退最多查看五个日历日、跳过周末并在首个结果停止", async () => {
  const requestedDates = [];
  const points = await fetchSseSharesOfficialFallback("2026-08-24", noWaitDependencies(async (url) => {
    const date = new URL(url).searchParams.get("STAT_DATE");
    requestedDates.push(date);
    return date === "2026-08-21" ? validSseSharesPayload : { result: [] };
  }));
  assert.deepEqual(requestedDates, ["2026-08-24", "2026-08-21"]);
  assert.equal(points[0].date, "2026-08-21");

  const allEmptyDates = [];
  await assert.rejects(fetchSseSharesOfficialFallback("2026-08-24", noWaitDependencies(async (url) => {
    allEmptyDates.push(new URL(url).searchParams.get("STAT_DATE"));
    return { result: [] };
  })), /5 个日历日/);
  assert.deepEqual(allEmptyDates, ["2026-08-24", "2026-08-21", "2026-08-20"]);
});

test("官方日度回退只接受 SSE TOT_VOL，不读取季度份额字段", async () => {
  await assert.rejects(fetchSseSharesOfficialFallback("2026-08-21", noWaitDependencies(async () => ({
    result: [{ STAT_DATE: "2026-08-21", SEC_CODE: "518880", SHARES: 117.8, NET_ASSETS: 100 }],
  }))), /无效/);
});

test("日度份额 latest 查询第一次 HTTP 403 后重试成功", async () => {
  let calls = 0;
  const waits = [];
  const points = await fetchCnEtfDailySharesLatest({
    getJson: async () => {
      calls += 1;
      if (calls === 1) throw new HttpError("HTTP 403", 403, "https://query.sse.com.cn/commonQuery.do");
      return validSseSharesPayload;
    },
    wait: async (ms) => waits.push(ms),
    warn: () => {},
  });
  assert.equal(calls, 2);
  assert.deepEqual(waits, [1000]);
  assert.equal(points.length, 1);
});

test("日度份额 latest 查询连续 HTTP 403 三次后仍然失败", async () => {
  let calls = 0;
  const waits = [];
  await assert.rejects(
    fetchCnEtfDailySharesLatest({
      getJson: async () => {
        calls += 1;
        throw new HttpError("HTTP 403", 403, "https://query.sse.com.cn/commonQuery.do");
      },
      wait: async (ms) => waits.push(ms),
      warn: () => {},
    }),
    /HTTP 403/,
  );
  assert.equal(calls, 3);
  assert.deepEqual(waits, [1000, 3000]);
});

test("日度份额 historical dated 查询 HTTP 403 不重试", async () => {
  let calls = 0;
  const waits = [];
  await assert.rejects(
    fetchCnEtfDailySharesOn("2026-08-21", {
      getJson: async () => {
        calls += 1;
        throw new HttpError("HTTP 403", 403, "https://query.sse.com.cn/commonQuery.do");
      },
      wait: async (ms) => waits.push(ms),
      warn: () => {},
    }),
    /HTTP 403/,
  );
  assert.equal(calls, 1);
  assert.deepEqual(waits, []);
});

test("日度份额 latest 查询 HTTP 404 不重试", async () => {
  let calls = 0;
  const waits = [];
  await assert.rejects(
    fetchCnEtfDailySharesLatest({
      getJson: async () => {
        calls += 1;
        throw new HttpError("HTTP 404", 404, "https://query.sse.com.cn/commonQuery.do");
      },
      wait: async (ms) => waits.push(ms),
      warn: () => {},
    }),
    /HTTP 404/,
  );
  assert.equal(calls, 1);
  assert.deepEqual(waits, []);
});

test("日度份额永久网络失败三次后仍然失败", async () => {
  let calls = 0;
  const waits = [];
  const warnings = [];
  await assert.rejects(
    fetchCnEtfDailySharesLatest({
      getJson: async () => {
        calls += 1;
        const error = new TypeError("fetch failed");
        error.cause = { code: "ETIMEDOUT" };
        throw error;
      },
      wait: async (ms) => waits.push(ms),
      warn: (message) => warnings.push(message),
    }),
    /fetch failed/,
  );
  assert.equal(calls, 3);
  assert.deepEqual(waits, [1000, 3000]);
  assert.match(warnings.at(-1), /failed after 3 attempts.*ETIMEDOUT/);
});

test("日度份额 parser/schema 错误不重试", async () => {
  let calls = 0;
  const warnings = [];
  await assert.rejects(
    fetchCnEtfDailySharesLatest(noWaitDependencies(async () => {
      calls += 1;
      return { unexpected: [] };
    }, warnings)),
    /缺少 result/,
  );
  assert.equal(calls, 1);
  assert.match(warnings.at(-1), /parser\/schema error/);
});

test("日度份额失败时旧 snapshot observations 保持不变", async () => {
  const old = [{ series: "cn_gold_etf_shares_daily", observation_date: "2026-08-20", value: 100, fetched_at: "old" }];
  let calls = 0;
  await assert.rejects(fetchCnEtfDailySharesLatest(noWaitDependencies(async () => {
    calls += 1;
    throw new HttpError("HTTP 404", 404, "https://query.sse.com.cn/commonQuery.do");
  })));
  assert.equal(calls, 1);
  assert.deepEqual(mergeObservations(old, []), old);
});

test("日度份额空 runner 永久失败时不生成空或伪造数据", async () => {
  let generated;
  await assert.rejects(async () => {
    generated = await fetchCnEtfDailySharesLatest(noWaitDependencies(async () => {
      throw new HttpError("HTTP 503", 503, "https://query.sse.com.cn/commonQuery.do");
    }));
  });
  assert.equal(generated, undefined);
});

test("同日价格与 NAV 才计算正式折溢价", () => {
  const [row] = buildEtfFoundationRows([{ date: "2026-01-02", value: 10.1 }], [{ date: "2026-01-02", value: 10 }], []);
  assert.equal(row.alignmentStatus, "same_date");
  assert.ok(Math.abs(row.premiumDiscountPct - 1) < 1e-10);
});

test("错日 NAV 仅标 lagged，不计算折溢价", () => {
  const rows = buildEtfFoundationRows([{ date: "2026-01-05", value: 10.1 }], [{ date: "2026-01-02", value: 10 }], []);
  const row = rows.at(-1);
  assert.equal(row.alignmentStatus, "nav_lagged");
  assert.equal(row.navDate, "2026-01-02");
  assert.equal(row.premiumDiscountPct, null);
});

test("周末 NAV 单独存在时标记 price_missing", () => {
  const [row] = buildEtfFoundationRows([], [{ date: "2026-01-03", value: 10 }], []);
  assert.equal(row.alignmentStatus, "price_missing");
});

test("同日 NAV 与份额计算估算规模", () => {
  const [row] = buildEtfFoundationRows([], [{ date: "2026-01-02", value: 10 }], [{ date: "2026-01-02", value: 2 }]);
  assert.equal(row.estimatedAumCny, 2_000_000_000);
});

test("对称分解精确闭合并生成份额窗口", () => {
  const dates = Array.from({ length: 61 }, (_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`);
  const navs = dates.map((date, i) => ({ date, value: 10 + i / 100 }));
  const shares = dates.map((date, i) => ({ date, value: 2 + i / 100 }));
  const row = buildEtfFoundationRows([], navs, shares).at(-1);
  assert.ok(Math.abs(row.aumChangeCny - row.marketEffectCny - row.shareEffectCny) < 1e-5);
  assert.notEqual(row.sharesChange5dPct, null);
  assert.notEqual(row.sharesChange20dPct, null);
  assert.notEqual(row.sharesChange60dPct, null);
  assert.equal(row.shareChangeStreakDays, 60);
});

test("空抓取合并不会清空旧快照且审计时间变化不覆写", () => {
  const old = [{ series: "cn_gold_etf_nav", observation_date: "2026-01-02", value: 10, unit: "cny_per_share", source: "x", frequency: "daily", fetched_at: "old" }];
  assert.deepEqual(mergeObservations(old, []), old);
  assert.deepEqual(mergeObservations(old, [{ ...old[0], fetched_at: "new" }]), old);
});

test("质量规则覆盖异常跳变、字段血缘与单位换算", async () => {
  const { validateSeriesData } = await import("../scripts/data-quality-lib.mjs");
  const data = { meta: { unit: "hundred_million_shares", frequency: "daily" }, observations: [
    { observation_date: "2026-01-01", value: 1, raw_value: 10000, raw_unit: "万份", security_code: "518880" },
    { observation_date: "2026-01-02", value: 1.3, raw_value: 13000, raw_unit: "万份", security_code: "518880" },
  ] };
  const result = validateSeriesData("cn_gold_etf_shares_daily", data, new Date("2026-01-03"));
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 1);
  data.observations[1].raw_value = 1;
  assert.ok(validateSeriesData("cn_gold_etf_shares_daily", data, new Date("2026-01-03")).errors.length > 0);
});

test("实质变化判断忽略审计时间但识别数值变化", async () => {
  const { isSubstantiveDataChange } = await import("../scripts/data-change-lib.mjs");
  assert.equal(isSubstantiveDataChange({ value: 1, fetched_at: "a" }, { value: 1, fetched_at: "b" }), false);
  assert.equal(isSubstantiveDataChange({ value: 1 }, { value: 2 }), true);
});
