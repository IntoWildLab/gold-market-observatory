/**
 * 国内代表性黄金ETF —— 518880 华安黄金ETF
 *
 * 定位: 作为"国内金融投资者黄金配置需求"的一个代表性观察窗口,
 * 不是基金推荐, 也不等于支付宝等销售平台的产品。
 *
 * 数据源(均为公开金融数据接口):
 * - 日K(价格/成交量): 腾讯行情 API(上交所挂牌行情汇总)
 * - 实时报价(当日涨跌/成交额): 新浪财经行情(GBK 编码)
 * - 份额(季度): 东方财富基金公开数据(基金公司定期披露的期末总份额)
 *
 * 限制(诚实标注):
 * - 份额为季度披露频率, 不是日度; 不要把它显示成日度数据。
 * - 价格/成交为交易所行情; 成交量为手(1手=100份)。
 */

import { httpGetJson, httpGetText, httpGetTextEncoded, parseNum } from "./http";

export const CN_ETF = {
  code: "518880",
  symbol: "sh518880",
  name: "华安黄金ETF",
  sseCode: "518880",
};

export interface CnEtfKlineRow {
  date: string; // YYYY-MM-DD
  open: number;
  close: number;
  high: number;
  low: number;
  /** 成交量(手) */
  volume: number;
}

/** 腾讯日K(不含复权, 上交所挂牌数据) */
export async function fetchCnEtfKline(symbol = CN_ETF.symbol, count = 520): Promise<CnEtfKlineRow[]> {
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${symbol},day,,,${count},`;
  const json = await httpGetJson<{
    data: Record<string, { day?: Array<[string, string, string, string, string, string]> }>;
  }>(url, { timeoutMs: 20000, retries: 1, headers: { referer: "https://gu.qq.com/" } });
  const rows = json.data?.[symbol]?.day ?? [];
  const out: CnEtfKlineRow[] = [];
  for (const r of rows) {
    const [date, open, close, high, low, volume] = r;
    if (!date) continue;
    const n = (v: string) => parseNum(v);
    const o = n(open);
    const c = n(close);
    const h = n(high);
    const l = n(low);
    const v = n(volume);
    if (o === null || c === null || h === null || l === null || v === null) continue;
    out.push({ date, open: o, close: c, high: h, low: l, volume: v });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export interface CnEtfQuote {
  name: string;
  /** 最新价(元/份) */
  price: number;
  /** 昨收(元/份) */
  prevClose: number;
  /** 当日涨跌幅 % */
  changePct: number | null;
  /** 成交量(份) */
  volumeShares: number | null;
  /** 成交额(元) */
  amount: number | null;
  /** 行情日期(交易所) */
  date: string;
  /** 行情时间 */
  time: string;
}

/** 新浪实时行情(GBK 编码) */
export async function fetchCnEtfQuote(symbol = CN_ETF.symbol): Promise<CnEtfQuote> {
  const txt = await httpGetTextEncoded(`https://hq.sinajs.cn/list=${symbol}`, "gbk", {
    headers: { referer: "https://finance.sina.com.cn/" },
  });
  const m = txt.match(/var hq_str_sh518880="([^"]*)"/);
  if (!m) throw new Error("新浪行情返回格式异常");
  const f = m[1].split(",");
  // 字段: 0名称 1今开 2昨收 3最新 4最高 5最低 6买一 7卖一 8成交量(股) 9成交额(元) ... 30日期 31时间
  const name = f[0] ?? CN_ETF.name;
  const price = parseNum(f[3]);
  const prevClose = parseNum(f[2]);
  const volume = parseNum(f[8]);
  const amount = parseNum(f[9]);
  const date = f[30] ?? "";
  const time = f[31] ?? "";
  if (price === null) throw new Error("新浪行情无最新价");
  const changePct = prevClose !== null && prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : null;
  return { name, price, prevClose: prevClose ?? price, changePct, volumeShares: volume, amount, date, time };
}

export interface CnEtfSharesRow {
  /** 季度末日期 YYYY-MM-DD */
  date: string;
  /** 期末总份额(亿份) */
  shares: number | null;
  /** 期末净资产(亿元) */
  netAssets: number | null;
  /** 期间净申购(亿份, 正=净申购) */
  netFlow: number | null;
}

/**
 * 份额(季度): 东方财富基金公开数据 FundArchivesDatas gmbd 接口。
 * 返回 JS 变量 gmbd_apidata.content 内嵌 HTML 表格。
 */
export async function fetchCnEtfShares(code = CN_ETF.code): Promise<CnEtfSharesRow[]> {
  const url = `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=gmbd&code=${code}`;
  const txt = await httpGetTextEncoded(url, "utf-8", {
    headers: { referer: `https://fundf10.eastmoney.com/gmbd_${code}.html` },
  });
  const m = txt.match(/var gmbd_apidata=\s*\{[^}]*content:"([\s\S]*?)"\s*\}/);
  if (!m) throw new Error("东方财富规模数据解析失败");
  const html = m[1].replace(/\\"/g, '"').replace(/\\'/g, "'");
  const rows: CnEtfSharesRow[] = [];
  const trRe = /<tr>([\s\S]*?)<\/tr>/g;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(html)) !== null) {
    const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => x[1].replace(/<[^>]+>/g, "").trim());
    if (tds.length < 5) continue;
    const date = tds[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const inflow = parseNum(tds[1]); // 期间申购(亿份)
    const outflow = parseNum(tds[2]); // 期间赎回(亿份)
    const shares = parseNum(tds[3]); // 期末总份额(亿份)
    const netAssets = parseNum(tds[4]); // 期末净资产(亿元), 不是单位净值
    const netFlow = inflow !== null && outflow !== null ? inflow - outflow : null;
    rows.push({ date, shares, netAssets, netFlow });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export interface OfficialNavPoint {
  date: string;
  value: number;
  publishedAt: string;
  source: "huaan_product" | "huaan_pcf";
}

export interface DailySharesPoint {
  date: string;
  value: number;
  rawValue: number;
  rawUnit: "万份";
  securityCode: string;
}

export function preserveProductNavFirstObserved(point: OfficialNavPoint, previousPublishedAt?: string): OfficialNavPoint {
  return point.source === "huaan_product" && previousPublishedAt
    ? { ...point, publishedAt: previousPublishedAt }
    : point;
}

const HUAAN_PRODUCT_URL = "https://huaan.com.cn/funds/518880/index.shtml";
const HUAAN_PCF_URL = "https://huaan.com.cn/etf/518880/sgshqd.jsp";
const SSE_QUERY_URL = "https://query.sse.com.cn/commonQuery.do";

function plainText(html: string): string {
  return html.replace(/&nbsp;/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** 只解析产品页“单位净值”卡片, 绝不把相邻的累计净值当作 NAV。 */
export function parseHuaanProductNav(html: string, firstObservedAt: string): OfficialNavPoint {
  const item = html.match(/<li[^>]*>\s*<span[^>]*>\s*日期\s*<\/span>[\s\S]*?<span[^>]*>(\d{4}-\d{2}-\d{2})<\/span>\s*<\/li>[\s\S]*?<li[^>]*>\s*<span[^>]*>\s*单位净值\s*<\/span>[\s\S]*?<span[^>]*>([0-9.]+)<\/span>\s*<\/li>/i);
  if (!item) throw new Error("华安产品页未找到日期与单位净值");
  const value = Number(item[2]);
  if (!Number.isFinite(value) || value <= 0) throw new Error("华安产品页单位净值无效");
  return { date: item[1], value, publishedAt: firstObservedAt, source: "huaan_product" };
}

/** 解析 ETF 申购赎回清单中的“基金份额净值”, 日期为该信息内容所属日期。 */
export function parseHuaanPcfNav(html: string): OfficialNavPoint {
  const text = plainText(html);
  const blockDate = text.match(/(20\d{6})\s*信息内容/)?.[1];
  const announced = text.match(/公告日期\s*(20\d{6})/)?.[1];
  const valueText = text.match(/基金份额净值\s*\(?单位\s*[:：]\s*元\)?\s*[￥¥]?\s*([0-9.]+)/)?.[1];
  if (!blockDate || !valueText) throw new Error("华安 PCF 未找到信息日期或基金份额净值");
  const value = Number(valueText);
  if (!Number.isFinite(value) || value <= 0) throw new Error("华安 PCF 基金份额净值无效");
  const date = blockDate.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
  const publishedAt = (announced ?? blockDate).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
  return { date, value, publishedAt, source: "huaan_pcf" };
}

export async function fetchCnEtfOfficialNav(
  fetchedAt: string,
  getText: typeof httpGetText = httpGetText,
): Promise<{ point: OfficialNavPoint; fallbackUsed: boolean; primaryError?: string }> {
  try {
    const html = await getText(HUAAN_PRODUCT_URL, { timeoutMs: 20000, retries: 1 });
    return { point: parseHuaanProductNav(html, fetchedAt), fallbackUsed: false };
  } catch (error) {
    const primaryError = (error as Error).message;
    const html = getText === httpGetText
      ? await httpGetTextEncoded(HUAAN_PCF_URL, "gbk", { timeoutMs: 20000, retries: 1 })
      : await getText(HUAAN_PCF_URL, { timeoutMs: 20000, retries: 1 });
    return { point: parseHuaanPcfNav(html), fallbackUsed: true, primaryError };
  }
}

export async function fetchCnEtfPcfNavOn(date: string): Promise<OfficialNavPoint | null> {
  const html = await httpGetTextEncoded(`${HUAAN_PCF_URL}?querydate=${encodeURIComponent(date)}`, "gbk", { timeoutMs: 20000, retries: 1 });
  try {
    return parseHuaanPcfNav(html);
  } catch {
    return null;
  }
}

export function parseSseDailyShares(payload: unknown, expectedCode = CN_ETF.code): DailySharesPoint[] {
  const rows = (payload as { result?: Array<Record<string, unknown>> })?.result;
  if (!Array.isArray(rows)) throw new Error("上交所份额响应缺少 result");
  const seen = new Set<string>();
  const out: DailySharesPoint[] = [];
  for (const row of rows) {
    const date = String(row.STAT_DATE ?? "");
    const code = String(row.SEC_CODE ?? "");
    const rawValue = Number(row.TOT_VOL);
    if (code !== expectedCode || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(rawValue) || rawValue <= 0) {
      throw new Error("上交所份额行的代码、日期或数值无效");
    }
    if (seen.has(date)) throw new Error(`上交所份额日期重复: ${date}`);
    seen.add(date);
    out.push({ date, value: rawValue / 10000, rawValue, rawUnit: "万份", securityCode: code });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchSseShares(params: Record<string, string>): Promise<DailySharesPoint[]> {
  const query = new URLSearchParams(params);
  const payload = await httpGetJson<unknown>(`${SSE_QUERY_URL}?${query}`, {
    timeoutMs: 20000,
    retries: 1,
    headers: { referer: "https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=518880" },
  });
  return parseSseDailyShares(payload);
}

export function fetchCnEtfDailySharesLatest(): Promise<DailySharesPoint[]> {
  return fetchSseShares({
    sqlId: "COMMON_SSE_ZQPZ_ETFZL_ETFJBXX_JJGM_MOREN_L",
    SEC_CODE: CN_ETF.code,
    "pageHelp.pageSize": "400",
    "pageHelp.pageNo": "1",
  });
}

export function fetchCnEtfDailySharesOn(date: string): Promise<DailySharesPoint[]> {
  return fetchSseShares({
    sqlId: "COMMON_SSE_ZQPZ_ETFZL_ETFJBXX_JJGM_SEARCH_L",
    SEC_CODE: CN_ETF.code,
    STAT_DATE: date,
    "pageHelp.pageSize": "20",
    "pageHelp.pageNo": "1",
  });
}
