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

import { httpGetJson, httpGetTextEncoded, parseNum } from "./http";

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
  nav: number | null;
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
    const nav = parseNum(tds[4]); // 期末净资产(亿元)
    const netFlow = inflow !== null && outflow !== null ? inflow - outflow : null;
    rows.push({ date, shares, nav, netFlow });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}
