/**
 * World Gold Council (gold.org / fsapi.gold.org) 数据源
 *
 * 全部为 WGC 官方公开数据接口(无 Key), 主要给:
 * - 黄金价格历史: LBMA 定盘价 (chart/main)
 * - 黄金现货实时报价: spotprice (60s 更新)
 * - 全球黄金 ETF 持仓 / 资金流(周频, 分区域): etfv2
 * - 全球央行季度购金: supply-and-demand/43
 * - 各国官方黄金储备(月度, IMF IFS): cbd (Central Banks Dashboard)
 */

import { httpGetJson, parseNum, msToDate } from "./http";

const BASE = "https://fsapi.gold.org/api";

export interface GoldPricePoint {
  date: string; // YYYY-MM-DD
  value: number; // US$/oz
}

interface WgcEnvelope<T> {
  system: { request_time: string };
  chartData: T;
}

/** 1. 黄金日频历史: LBMA AM/PM 定盘价 (2023-08 至今) */
export async function fetchGoldLbmaHistory(): Promise<{ points: GoldPricePoint[]; asOfDate: string | null }> {
  const json = await httpGetJson<WgcEnvelope<Record<string, Array<[number, number]>>>>(
    `${BASE}/goldprice/v13/chart/main?cache09092024`,
  );
  const cd = json.chartData;
  const raw = cd.lbma_pm_usd || cd.lbma_am_usd || [];
  const points = raw
    .filter((p) => Array.isArray(p) && p.length === 2 && typeof p[1] === "number" && p[0] > 0)
    .map((p) => ({ date: msToDate(p[0]), value: p[1] }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { points, asOfDate: null };
}

/**
 * 1b. 上海黄金交易所 Au99.99 日度价格 (人民币/克)
 * 来源: WGC goldhub 黄金参考价 (sge_am_cny / sge_pm_cny), 数据由 WGC 汇编自上海黄金交易所。
 * 说明: 与 LBMA 定盘价取自同一 chart/main 接口, 一次请求即可同时获得。
 */
export interface SgeGoldPoint {
  date: string;
  /** 上海时段早盘(人民币/克) */
  amCny: number | null;
  /** 上海时段午盘(人民币/克) */
  pmCny: number | null;
}

export async function fetchSgeGoldPrice(): Promise<{ points: SgeGoldPoint[] }> {
  const json = await httpGetJson<WgcEnvelope<Record<string, Array<[number, number]>>>>(
    `${BASE}/goldprice/v13/chart/main?cache09092024`,
  );
  const cd = json.chartData;
  const am = cd.sge_am_cny || [];
  const pm = cd.sge_pm_cny || [];
  const map = new Map<string, SgeGoldPoint>();
  for (const [ts, v] of am) {
    const date = msToDate(ts);
    const row = map.get(date) ?? { date, amCny: null, pmCny: null };
    row.amCny = v;
    map.set(date, row);
  }
  for (const [ts, v] of pm) {
    const date = msToDate(ts);
    const row = map.get(date) ?? { date, amCny: null, pmCny: null };
    row.pmCny = v;
    map.set(date, row);
  }
  const points = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { points };
}

/** 2. 黄金实时现货报价 (USD mid, 60s 更新) */
export interface SpotPriceSnapshot {
  priceUsd: number;
  timestamp: string; // ISO
  asOfDate: string;
  currencies: Record<string, number>;
}

export async function fetchGoldSpotPrice(): Promise<SpotPriceSnapshot> {
  const json = await httpGetJson<WgcEnvelope<{
    asOfDate: string;
    timestamp: string;
    usd: { mid: { price: string } };
  }>>(`${BASE}/goldprice/v13/charts/spotprice?break-cache=${Date.now() % 100000}`);
  const cd = json.chartData;
  const price = parseNum(cd.usd?.mid?.price);
  if (price === null) throw new Error("WGC spotprice 无 USD mid 价格");
  return {
    priceUsd: price,
    timestamp: cd.timestamp,
    asOfDate: cd.asOfDate,
    currencies: {},
  };
}

/** 3. ETF 持仓(周频, 分区域, 吨) */
export interface EtfHoldingsRow {
  date: string;
  northAmerica: number | null;
  europe: number | null;
  asia: number | null;
  other: number | null;
  total: number | null;
  goldUsdOz: number | null;
}

export async function fetchGoldEtfHoldings(): Promise<{ rows: EtfHoldingsRow[]; asOfDate: string | null }> {
  const json = await httpGetJson<WgcEnvelope<{
    data: { Weekly: { tonnes: { columns: string[]; set: Array<Array<number | null>> } } };
  }>>(`${BASE}/v11/charts/etfv2/revised/holdings-chart2?break-cache=0`);
  const t = json.chartData.data.Weekly.tonnes;
  const col = t.columns.map((c) => c.trim());
  const idx = {
    date: col.findIndex((c) => /date/i.test(c)),
    na: col.findIndex((c) => /north america/i.test(c)),
    eu: col.findIndex((c) => /europe/i.test(c)),
    asia: col.findIndex((c) => /asia/i.test(c)),
    other: col.findIndex((c) => /other/i.test(c)),
    gold: col.findIndex((c) => /gold|us\$/i.test(c)),
  };
  const rows: EtfHoldingsRow[] = [];
  for (const row of t.set) {
    const na = idx.na >= 0 ? parseNum(row[idx.na]) : null;
    const eu = idx.eu >= 0 ? parseNum(row[idx.eu]) : null;
    const asia = idx.asia >= 0 ? parseNum(row[idx.asia]) : null;
    const other = idx.other >= 0 ? parseNum(row[idx.other]) : null;
    const parts = [na, eu, asia, other].filter((v): v is number => v !== null);
    const total = parts.length ? parts.reduce((a, b) => a + b, 0) : null;
    rows.push({
      date: msToDate(Number(row[idx.date])),
      northAmerica: na,
      europe: eu,
      asia,
      other,
      total,
      goldUsdOz: idx.gold >= 0 ? parseNum(row[idx.gold]) : null,
    });
  }
  return { rows, asOfDate: null };
}

/** 4. ETF 资金流(周频, 分区域, 吨与美元) */
export interface EtfFlowsRow {
  date: string;
  totalTonnes: number;
  totalUsd: number;
  regionsTonnes: Record<string, number>;
  regionsUsd: Record<string, number>;
}

export async function fetchGoldEtfFlows(): Promise<{ rows: EtfFlowsRow[] }> {
  const json = await httpGetJson<WgcEnvelope<{
    data: { Weekly: { series: { tonnes: Array<{ name: string; data: Array<[number, number]> }>; usd: Array<{ name: string; data: Array<[number, number]> }> } } };
  }>>(`${BASE}/v11/charts/etfv2/revised/flows-chart2?break-cache=0`);
  const weekly = json.chartData.data.Weekly.series;
  // 过滤非区域序列("Gold Price (rhs)" 是右侧价格轴, 不是区域; "Total" 若存在会重复计算)
  const isRegion = (name: string) => !/gold\s*price|total/i.test(name);
  const byDate = new Map<string, EtfFlowsRow>();
  for (const series of weekly.tonnes) {
    if (!isRegion(series.name)) continue;
    for (const [ts, val] of series.data) {
      const date = msToDate(ts);
      const row = byDate.get(date) || { date, totalTonnes: 0, totalUsd: 0, regionsTonnes: {}, regionsUsd: {} };
      row.totalTonnes += val;
      row.regionsTonnes[series.name] = (row.regionsTonnes[series.name] || 0) + val;
      byDate.set(date, row);
    }
  }
  for (const series of weekly.usd) {
    if (!isRegion(series.name)) continue;
    for (const [ts, val] of series.data) {
      const date = msToDate(ts);
      const row = byDate.get(date);
      if (!row) continue;
      row.totalUsd += val;
      row.regionsUsd[series.name] = (row.regionsUsd[series.name] || 0) + val;
    }
  }
  const rows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { rows };
}

/** 5. 全球央行季度购金(WGC Gold Demand Trends) */
export interface CbQuarterlyPoint {
  /** 季度末日期, 如 2026-06-30 */
  date: string;
  label: string;
  tonnes: number | null;
}

export async function fetchCbQuarterlyPurchases(): Promise<{ points: CbQuarterlyPoint[]; asOfDate: string | null }> {
  const json = await httpGetJson<WgcEnvelope<{
    Demand_Quarterly?: { categories: string[]; series: Array<{ name: string; data: Array<number | null> }> };
    asOfDate?: string;
  }>>(`${BASE}/v11/charts/supply-and-demand/43?break-cache=0`);
  const dq = json.chartData.Demand_Quarterly;
  if (!dq) return { points: [], asOfDate: null };
  const cb = dq.series.find((s) => /central/i.test(s.name));
  const quarterEndDate = (q: number, year: number): string => {
    const end: Record<number, string> = { 1: "03-31", 2: "06-30", 3: "09-30", 4: "12-31" };
    return `${year}-${end[q]}`;
  };
  const points: CbQuarterlyPoint[] = [];
  if (cb) {
    dq.categories.forEach((label, i) => {
      const m = label.match(/Q([1-4])\s*'(\d{2})/);
      if (!m) return;
      const q = Number(m[1]);
      const year = 2000 + Number(m[2]);
      points.push({ date: quarterEndDate(q, year), label, tonnes: cb.data[i] ?? null });
    });
  }
  return { points, asOfDate: json.chartData.asOfDate ?? null };
}

/** 6. 各国官方黄金储备(CBD dashboard, IMF IFS) */
export interface CountryGoldReservesRow {
  country: string;
  /** 季度末日期, 如 2026-03-31 */
  date: string; // YYYY-MM-DD
  label: string; // 如 "Q1 26"
  tonnes: number | null;
  usdMillions: number | null;
}

/**
 * 抓取指定国家储备(CBD date_range + QTD_FULL, 季度粒度)。
 * 响应结构: chartData.table[QTD_FULL][metricKey] = { headers:[[{val},...]], rows:[[{iso3,val}, {val}, ...]] }
 * 备选: snapshot 页 LAST_YEAR_END (年度) 作为回退。
 */
export async function fetchCbdCountry(countryCode = "CHN"): Promise<{ rows: CountryGoldReservesRow[]; meta: Record<string, unknown> }> {
  const end = new Date();
  const endIso = end.toISOString().slice(0, 10);
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 6);
  const startIso = start.toISOString().slice(0, 10);
  const url =
    `${BASE}/cbd/v11/charts/getPage?page=date_range&periodicity=QTD_FULL&countries=${countryCode}` +
    `&startDate=${startIso}&endDate=${endIso}`;
  const json = await httpGetJson<Record<string, unknown>>(url);
  const meta: Record<string, unknown> = {};
  const rows: CountryGoldReservesRow[] = [];
  const chartData = (json.chartData ?? {}) as Record<string, unknown>;
  const table = (chartData.table ?? {}) as Record<string, unknown>;
  const q = table.QTD_FULL as Record<string, unknown> | undefined;
  if (q) {
    const tonnesCol = q.gold_reserves_tns as CbdTable | undefined;
    const usdCol = q.gold_reserves as CbdTable | undefined;
    const dates = extractCbdDates(tonnesCol ?? usdCol ?? null);
    if (dates.length) {
      const tVals = tonnesCol ? extractCbdRow(tonnesCol, countryCode) : null;
      const uVals = usdCol ? extractCbdRow(usdCol, countryCode) : null;
      for (const { date, label } of dates) {
        rows.push({
          country: countryCode,
          date,
          label,
          tonnes: tVals?.get(label) ?? null,
          usdMillions: uVals?.get(label) ?? null,
        });
      }
    }
  }
  return { rows, meta };
}

interface CbdTable {
  headers: Array<Array<{ val: string }>>;
  rows: Array<Array<{ iso3?: string; val?: string | number }>>;
}

function extractCbdDates(t: CbdTable | null): Array<{ date: string; label: string }> {
  if (!t) return [];
  const header = t.headers?.[0] ?? [];
  const out: Array<{ date: string; label: string }> = [];
  const endByQ: Record<number, string> = { 1: "03-31", 2: "06-30", 3: "09-30", 4: "12-31" };
  for (const h of header.slice(1)) {
    const label = String(h.val ?? "").trim();
    const m = label.match(/^Q([1-4])\s*'?(\d{2}|\d{4})$/i);
    if (m) {
      const q = Number(m[1]);
      const yr = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
      out.push({ label, date: `${yr}-${endByQ[q]}` });
    }
  }
  return out;
}

function extractCbdRow(t: CbdTable, iso3: string): Map<string, number> | null {
  const row = t.rows.find((r) => String(r[0]?.iso3 ?? "").toUpperCase() === iso3.toUpperCase() || String(r[0]?.val ?? "").toUpperCase() === iso3.toUpperCase());
  if (!row) return null;
  const map = new Map<string, number>();
  const headers = t.headers?.[0] ?? [];
  headers.forEach((h, i) => {
    if (i === 0) return;
    const v = parseNum(row[i]?.val);
    if (v !== null) map.set(String(h.val).trim(), v);
  });
  return map;
}
