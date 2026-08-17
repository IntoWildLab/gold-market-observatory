/**
 * FRED (St. Louis Fed) 数据源
 *
 * 两种接入方式:
 * 1. 首选: 官方 API (需免费 Key, 通过 FRED_API_KEY 环境变量注入)
 *    https://fred.stlouisfed.org/docs/api/api_key.html
 * 2. 回退: fredgraph.csv (免 Key, 但存在反爬限流, 需节流+重试)
 *    https://fred.stlouisfed.org/graph/fredgraph.csv?id=XXX
 *
 * 注意: 实测 fredgraph.csv 连发 4~5 次后会被短暂封禁(返回 St. Louis Fed 错误页),
 * 冷却后自动恢复。因此本模块内置全局最小请求间隔 + 退避重试。
 */

import { httpGetJson, httpGetText, parseNum, sleep } from "./http";

export interface FredSeriesConfig {
  id: string;
  name: string;
  description: string;
}

export const FRED_SERIES: Record<string, FredSeriesConfig> = {
  DFII10: { id: "DFII10", name: "10-Year Real Rate (TIPS)", description: "Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity, Inflation-Indexed" },
  DGS10: { id: "DGS10", name: "10-Year Nominal Yield", description: "Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity" },
  T10YIE: { id: "T10YIE", name: "10-Year Breakeven Inflation", description: "10-Year Breakeven Inflation Rate" },
  DTWEXBGS: { id: "DTWEXBGS", name: "Broad Dollar Index", description: "Nominal Broad U.S. Dollar Index (index March 1973=100)" },
  DTWEXMGS: { id: "DTWEXMGS", name: "Major Currencies Dollar Index", description: "Nominal Major Currencies U.S. Dollar Index" },
  DEXCHUS: { id: "DEXCHUS", name: "USD/CNY", description: "Chinese Yuan to U.S. Dollar Spot Exchange Rate (Federal Reserve H.10, CNY per USD)" },
};

/** 全局 FRED 请求节流: 避免触发 fredgraph.csv 反爬 */
let lastFredRequestAt = 0;
const MIN_FRED_INTERVAL_MS = 12000;

async function fredThrottle(): Promise<void> {
  const now = Date.now();
  const wait = lastFredRequestAt + MIN_FRED_INTERVAL_MS - now;
  if (wait > 0) await sleep(wait);
  lastFredRequestAt = Date.now();
}

export interface FredPoint {
  date: string;
  value: number | null;
}

/** 用官方 API 拉取(需要 FRED_API_KEY) */
async function fetchViaApi(seriesId: string, start: string, end: string, apiKey: string): Promise<FredPoint[]> {
  const url =
    `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}` +
    `&api_key=${apiKey}&file_type=json&observation_start=${start}&observation_end=${end}`;
  const json = await httpGetJson<{ observations: Array<{ date: string; value: string }> }>(url, { retries: 2, timeoutMs: 30000 });
  return json.observations.map((o) => ({ date: o.date, value: parseNum(o.value) }));
}

/** 用 fredgraph.csv 拉取(免 Key, 有限流) */
async function fetchViaCsv(seriesId: string, start: string, end: string): Promise<FredPoint[]> {
  await fredThrottle();
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=${start}&coed=${end}`;
  // 404 可能是限流, 退避后重试一次
  const text = await httpGetText(url, { retries: 1, backoffMs: 90000, timeoutMs: 40000 });
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  // 校验表头
  const header = lines[0];
  if (!header.includes("observation_date")) {
    // 若拿到的是 HTML 错误页, 抛出以便上层回退
    throw new Error(`fredgraph.csv 返回非预期内容(可能被限流): ${text.slice(0, 80)}`);
  }
  const points: FredPoint[] = [];
  for (const line of lines.slice(1)) {
    const [date, ...rest] = line.split(",");
    if (!date) continue;
    const raw = rest.join(",").trim();
    points.push({ date, value: parseNum(raw) });
  }
  return points;
}

export interface FredFetchResult {
  seriesId: string;
  points: FredPoint[];
  via: "api" | "csv";
  fetchedAt: string;
}

/** 拉取一个 FRED 系列。返回空数组表示失败(调用方回退快照)。 */
export async function fetchFredSeries(
  seriesId: string,
  start: string,
  end: string,
  opts: { apiKey?: string } = {},
): Promise<FredFetchResult> {
  const apiKey = opts.apiKey || process.env.FRED_API_KEY;
  const fetchedAt = new Date().toISOString();
  if (apiKey) {
    try {
      const points = await fetchViaApi(seriesId, start, end, apiKey);
      if (points.length) return { seriesId, points, via: "api", fetchedAt };
    } catch (e) {
      console.warn(`[fred] API 方式失败(${seriesId}): ${(e as Error).message}, 回退 fredgraph.csv`);
    }
  }
  const points = await fetchViaCsv(seriesId, start, end);
  return { seriesId, points, via: "csv", fetchedAt };
}

/** 抓取当前环境日期对应的起始日(默认近 3 年, 覆盖 1 年图表需求) */
export function defaultStartDate(endDate: Date): string {
  const d = new Date(endDate);
  d.setFullYear(d.getFullYear() - 3);
  return d.toISOString().slice(0, 10);
}
