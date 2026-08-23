/**
 * 黄金市场观察站 —— 数据抓取管线
 *
 * 用法:
 *   npm run data:fetch            # 抓取全部数据源并更新 data/series/*.json 快照
 *   npm run data:fetch -- --only fred   # 只抓取 FRED 系列
 *
 * 原则:
 * - 每个系列独立失败隔离: 单个数据源失败不影响其它系列, 失败系列保留旧快照并记录。
 * - 所有输出为 data/series/<series>.json (统一 Observation 模型)。
 * - raw 响应存入 data/raw/ (gitignore), 便于审计。
 */

import "dotenv/config";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  fetchFredSeries,
  FRED_SERIES,
  defaultStartDate,
  type FredPoint,
} from "../lib/data-sources/fred";
import {
  fetchGoldLbmaHistory,
  fetchGoldSpotPrice,
  fetchGoldEtfHoldings,
  fetchGoldEtfFlows,
  fetchCbQuarterlyPurchases,
  fetchCbdCountry,
  fetchSgeGoldPrice,
} from "../lib/data-sources/wgc";
import { fetchGoldApiSpot } from "../lib/data-sources/goldApi";
import { downloadGldArchive, parseGldArchive } from "../lib/data-sources/spdr";
import {
  fetchCnEtfKline,
  fetchCnEtfQuote,
  fetchCnEtfShares,
  fetchCnEtfOfficialNav,
  fetchCnEtfPcfNavOn,
  fetchCnEtfDailySharesLatest,
  fetchCnEtfDailySharesOn,
  CN_ETF,
  type OfficialNavPoint,
  type DailySharesPoint,
} from "../lib/data-sources/cnEtf";
import { buildEtfFoundationRows, latestFormalPremium } from "../lib/cn-etf-foundation";
import { mergeObservations } from "../lib/series-merge";
import type { Observation, SeriesFile, SeriesId, Frequency, Unit } from "../types";

const ROOT = path.resolve(process.cwd());
const DATA_DIR = path.join(ROOT, "data");
const SERIES_DIR = path.join(DATA_DIR, "series");
const RAW_DIR = path.join(DATA_DIR, "raw");
const DERIVED_DIR = path.join(DATA_DIR, "derived");

// ---------- 工具 ----------

const NOW = new Date();
const FETCHED_AT = NOW.toISOString();

function obs(
  series: SeriesId,
  observation_date: string,
  value: number,
  unit: Unit,
  frequency: Frequency,
  source: string,
  sourceUrl: string,
  extra: Partial<Observation> = {},
): Observation {
  return {
    series,
    observation_date,
    value,
    unit,
    frequency,
    source,
    source_url: sourceUrl,
    fetched_at: FETCHED_AT,
    ...extra,
  };
}

async function readExisting(series: SeriesId): Promise<SeriesFile | null> {
  try {
    const raw = await readFile(path.join(SERIES_DIR, `${series}.json`), "utf8");
    return JSON.parse(raw) as SeriesFile;
  } catch {
    return null;
  }
}

async function writeSeries(series: SeriesFile, force = false): Promise<void> {
  await mkdir(SERIES_DIR, { recursive: true });
  const file = path.join(SERIES_DIR, `${series.meta.series}.json`);
  const existing = force ? null : await readExisting(series.meta.series);
  const mergedObs = mergeObservations(existing?.observations, series.observations);
  const last = mergedObs.length ? mergedObs[mergedObs.length - 1] : null;
  const out: SeriesFile = {
    ...series,
    observations: mergedObs,
    last_observation_date: last?.observation_date ?? null,
    last_fetched_at: FETCHED_AT,
    all_real: mergedObs.every((o) => !o.is_mock),
  };
  await writeFile(file, JSON.stringify(out, null, 2), "utf8");
  console.log(`[series] ${series.meta.series}: ${mergedObs.length} 条 (最新 ${out.last_observation_date})`);
}

async function writeRaw(name: string, content: string): Promise<void> {
  await mkdir(RAW_DIR, { recursive: true });
  await writeFile(path.join(RAW_DIR, name), content, "utf8");
}

// ---------- 各数据源抓取 ----------

interface FredMapping {
  fredId: string;
  series: SeriesId;
  unit: Unit;
  description: string;
}

const FRED_MAPPINGS: FredMapping[] = [
  { fredId: "DFII10", series: "us10y_real", unit: "percent", description: "美国10年期实际利率 (10Y TIPS)" },
  { fredId: "DGS10", series: "us10y_nominal", unit: "percent", description: "美国10年期名义国债收益率" },
  { fredId: "T10YIE", series: "us10y_breakeven", unit: "percent", description: "美国10年期通胀预期" },
  { fredId: "DTWEXBGS", series: "dxy_proxy", unit: "index", description: "美元指数代理: 美联储广义美元指数 (1973年3月=100)" },
  { fredId: "DEXCHUS", series: "usd_cny", unit: "cny_per_usd", description: "美元兑人民币 (美联储 H.10 即期汇率, 人民币/美元)" },
];

async function fetchFredBlock(): Promise<void> {
  const start = defaultStartDate(NOW);
  const end = NOW.toISOString().slice(0, 10);
  for (const m of FRED_MAPPINGS) {
    try {
      const res = await fetchFredSeries(m.fredId, start, end);
      const observations: Observation[] = res.points
        .filter((p): p is FredPoint & { value: number } => p.value !== null)
        .map((p) =>
          obs(m.series, p.date, p.value, m.unit, "daily", "FRED (St. Louis Fed)", `https://fred.stlouisfed.org/series/${m.fredId}`, {
            note: m.description,
          }),
        );
      await writeSeries({
        meta: {
          series: m.series,
          name: FRED_SERIES[m.fredId].name,
          description: m.description,
          unit: m.unit,
          frequency: "daily",
          source: {
            name: "FRED (St. Louis Fed)",
            url: `https://fred.stlouisfed.org/series/${m.fredId}`,
            tier: "official",
            update_note: "交易日更新 (约 T+1)",
            requires_api_key: false,
            ...(m.series === "dxy_proxy" ? { is_proxy_of: "DXY (ICE 美元指数)", lag_note: "FRED 不提供 ICE DXY, 使用美联储官方广义美元指数作为代理, 权重与 DXY 不同" } : {}),
          },
        },
        observations,
        last_fetched_at: FETCHED_AT,
        last_observation_date: null,
        all_real: true,
      });
    } catch (e) {
      console.warn(`[fred] ${m.fredId} 抓取失败, 保留旧快照: ${(e as Error).message}`);
    }
  }
}

async function fetchWgcBlock(): Promise<void> {
  // 1. 黄金日频历史 (LBMA 定盘价)
  try {
    const { points } = await fetchGoldLbmaHistory();
    const observations = points.map((p) =>
      obs("gold_price", p.date, p.value, "usd_per_oz", "daily", "World Gold Council / LBMA Gold Price (PM Fix, USD)", "https://www.gold.org/goldhub/data/gold-prices", {
        note: "LBMA 黄金定盘价(伦敦下午定盘, USD/oz), 由 ICE Benchmark Administration 管理",
      }),
    );
    await writeSeries({
      meta: {
        series: "gold_price",
        name: "黄金价格 XAU/USD",
        description: "现货黄金价格, 采用 LBMA Gold Price 伦敦定盘价(美元/盎司)",
        unit: "usd_per_oz",
        frequency: "daily",
        source: {
          name: "World Gold Council / LBMA",
          url: "https://www.gold.org/goldhub/data/gold-prices",
          tier: "official",
          update_note: "每个伦敦交易日两次定盘 (10:30 / 15:00 伦敦时间), 本表取 PM 定盘",
          lag_note: "定盘价为准价格, 实时盘中价见页面顶部现货报价",
          requires_api_key: false,
        },
      },
      observations,
      last_fetched_at: FETCHED_AT,
      last_observation_date: null,
      all_real: true,
    });
  } catch (e) {
    console.warn(`[wgc] gold history 失败: ${(e as Error).message}`);
  }

  // 2. 实时现货报价 (写入 latest-spot.json, 并做 gold-api 交叉校验)
  try {
    const spot = await fetchGoldSpotPrice();
    let crossCheck: { price: number; updatedAt: string } | null = null;
    try {
      crossCheck = await fetchGoldApiSpot();
    } catch {
      /* gold-api 不可用时忽略交叉校验 */
    }
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(
      path.join(DATA_DIR, "latest-spot.json"),
      JSON.stringify(
        {
          price_usd: spot.priceUsd,
          as_of_date: spot.asOfDate,
          timestamp: spot.timestamp,
          fetched_at: FETCHED_AT,
          source: { name: "World Gold Council 现货报价 (fsapi.gold.org)", url: "https://www.gold.org/goldhub/data/gold-prices", update_note: "约60秒刷新" },
          cross_check: crossCheck
            ? { price_usd: crossCheck.price, updated_at: crossCheck.updatedAt, source: "gold-api.com" }
            : null,
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log(`[wgc] spot price: $${spot.priceUsd} (asOf ${spot.asOfDate})` + (crossCheck ? ` | gold-api 交叉校验: $${crossCheck.price}` : " | 无交叉校验"));
  } catch (e) {
    console.warn(`[wgc] spot price 失败: ${(e as Error).message}`);
  }

  // 3. 全球黄金 ETF 持仓 (周频, 分区域)
  try {
    const { rows } = await fetchGoldEtfHoldings();
    const observations = rows
      .filter((r) => r.total !== null)
      .map((r) =>
        obs("gold_etf_holdings", r.date, r.total as number, "tonnes", "weekly", "World Gold Council (基于 Bloomberg/COF/ICE 数据)", "https://www.gold.org/goldhub/data/gold-etfs-holdings-and-flows", {
          note: "全球黄金 ETF 持仓合计(吨), 周频",
        }),
      );
    // 区域明细 -> derived
    await mkdir(DERIVED_DIR, { recursive: true });
    await writeFile(
      path.join(DERIVED_DIR, "gold-etf-regional.json"),
      JSON.stringify({ series: "gold_etf_holdings", frequency: "weekly", fetched_at: FETCHED_AT, rows }, null, 2),
      "utf8",
    );
    await writeSeries({
      meta: {
        series: "gold_etf_holdings",
        name: "全球黄金 ETF 持仓",
        description: "全球黄金 ETF 总持仓(吨), 周频, 来源 WGC",
        unit: "tonnes",
        frequency: "weekly",
        source: {
          name: "World Gold Council",
          url: "https://www.gold.org/goldhub/data/gold-etfs-holdings-and-flows",
          tier: "official",
          update_note: "周频更新 (WGC 每周更新)",
          requires_api_key: false,
        },
      },
      observations,
      last_fetched_at: FETCHED_AT,
      last_observation_date: null,
      all_real: true,
    });
  } catch (e) {
    console.warn(`[wgc] etf holdings 失败: ${(e as Error).message}`);
  }

  // 4. 全球黄金 ETF 资金流 (周频)
  try {
    const { rows } = await fetchGoldEtfFlows();
    const observations = rows
      .filter((r) => r.totalTonnes !== 0)
      .map((r) =>
        obs("gold_etf_flows", r.date, r.totalTonnes, "tonnes", "weekly", "World Gold Council (基于 Bloomberg/COF/ICE 数据)", "https://www.gold.org/goldhub/data/gold-etfs-holdings-and-flows", {
          note: "全球黄金 ETF 周度净流入(吨, 正=流入)",
        }),
      );
    await mkdir(DERIVED_DIR, { recursive: true });
    await writeFile(
      path.join(DERIVED_DIR, "gold-etf-flows-usd.json"),
      JSON.stringify({ series: "gold_etf_flows_usd", frequency: "weekly", fetched_at: FETCHED_AT, rows: rows.map((r) => ({ date: r.date, totalUsd: r.totalUsd, regionsUsd: r.regionsUsd })) }, null, 2),
      "utf8",
    );
    await writeSeries({
      meta: {
        series: "gold_etf_flows",
        name: "全球黄金 ETF 资金流",
        description: "全球黄金 ETF 周度净流入(吨), 周频, 来源 WGC",
        unit: "tonnes",
        frequency: "weekly",
        source: {
          name: "World Gold Council",
          url: "https://www.gold.org/goldhub/data/gold-etfs-holdings-and-flows",
          tier: "official",
          update_note: "周频更新",
          requires_api_key: false,
        },
      },
      observations,
      last_fetched_at: FETCHED_AT,
      last_observation_date: null,
      all_real: true,
    });
  } catch (e) {
    console.warn(`[wgc] etf flows 失败: ${(e as Error).message}`);
  }

  // 5. 全球央行季度购金
  try {
    const { points, asOfDate } = await fetchCbQuarterlyPurchases();
    const observations = points
      .filter((p) => p.tonnes !== null)
      .map((p) =>
        obs("cb_gold_purchases", p.date, p.tonnes as number, "tonnes", "quarterly", "World Gold Council (Gold Demand Trends)", "https://www.gold.org/goldhub/data/gold-demand-by-country", {
          note: `全球央行季度净购买(吨), WGC 黄金需求趋势报告 (${p.label})`,
          published_at: asOfDate ?? undefined,
        }),
      );
    await writeSeries({
      meta: {
        series: "cb_gold_purchases",
        name: "全球央行黄金净购买",
        description: "全球央行及官方机构季度黄金净购买量(吨)",
        unit: "tonnes",
        frequency: "quarterly",
        source: {
          name: "World Gold Council (Gold Demand Trends)",
          url: "https://www.gold.org/goldhub/research/gold-demand-trends",
          tier: "official",
          update_note: "季度更新 (GDT 报告, 季度结束后约一个月发布)",
          lag_note: "月度数据为估计, 季度数据为确认值; 本表用季度确认值",
          requires_api_key: false,
        },
      },
      observations,
      last_fetched_at: FETCHED_AT,
      last_observation_date: null,
      all_real: true,
    });
  } catch (e) {
    console.warn(`[wgc] cb purchases 失败: ${(e as Error).message}`);
  }

  // 6. 中国央行黄金储备 (CBD API, IMF IFS, 季度)
  try {
    const { rows, meta } = await fetchCbdCountry("CHN");
    await writeRaw("cbd-cn-quarterly.json", JSON.stringify({ meta, rows }, null, 2));
    if (rows.length) {
      const tonnesObs = rows
        .filter((r) => r.tonnes !== null)
        .map((r) =>
          obs("china_gold_reserves", r.date, r.tonnes as number, "tonnes", "quarterly", "World Gold Council / IMF IFS (依据中国人民银行公布数据)", "https://www.gold.org/goldhub/data/gold-reserves-by-country", {
            note: `中国官方黄金储备(吨), 季度 (${r.label}), 基于 IMF IFS 汇总`,
          }),
        );
      await writeSeries({
        meta: {
          series: "china_gold_reserves",
          name: "中国央行黄金储备",
          description: "中国官方黄金储备(吨), 季度 (WGC/IMF IFS, 数据源自人民银行官方储备资产)",
          unit: "tonnes",
          frequency: "quarterly",
          source: {
            name: "World Gold Council / IMF IFS",
            url: "https://www.gold.org/goldhub/data/gold-reserves-by-country",
            tier: "aggregator",
            update_note: "季度更新 (WGC 中央银行仪表盘, 基于 IMF IFS)",
            lag_note: "人民银行按月公布官方储备资产; 本站 v1 采用 WGC/IMF IFS 季度汇总口径, 月度明细见人民银行官网",
            requires_api_key: false,
          },
        },
        observations: tonnesObs,
        last_fetched_at: FETCHED_AT,
        last_observation_date: null,
        all_real: true,
      });
      const usdObs = rows
        .filter((r) => r.usdMillions !== null)
        .map((r) =>
          obs("china_gold_reserves_usd", r.date, (r.usdMillions as number) / 100, "usd_hundred_millions", "quarterly", "World Gold Council / IMF IFS", "https://www.gold.org/goldhub/data/gold-reserves-by-country", {
            note: `中国官方黄金储备(亿美元), 季度 (${r.label})`,
          }),
        );
      await writeSeries({
        meta: {
          series: "china_gold_reserves_usd",
          name: "中国央行黄金储备(美元)",
          description: "中国官方黄金储备(亿美元), 季度",
          unit: "usd_hundred_millions",
          frequency: "quarterly",
          source: {
            name: "World Gold Council / IMF IFS",
            url: "https://www.gold.org/goldhub/data/gold-reserves-by-country",
            tier: "aggregator",
            update_note: "季度更新",
            requires_api_key: false,
          },
        },
        observations: usdObs,
        last_fetched_at: FETCHED_AT,
        last_observation_date: null,
        all_real: true,
      });
    } else {
      console.warn("[wgc] CBD 中国储备解析未匹配到行, 请检查 data/raw/cbd-cn-quarterly.json 结构");
    }
  } catch (e) {
    console.warn(`[wgc] china reserves 失败: ${(e as Error).message}`);
  }
}

async function fetchSpdrBlock(): Promise<void> {
  try {
    const buf = await downloadGldArchive();
    await mkdir(RAW_DIR, { recursive: true });
    await writeFile(path.join(RAW_DIR, "spdr-gld-archive.xlsx"), buf);
    const rows = await parseGldArchive(buf);
    if (!rows || !rows.length) {
      console.warn("[spdr] GLD xlsx 解析失败或为空, 跳过 gld_holdings");
      return;
    }
    const observations = rows
      .filter((r) => r.holdingsTonnes !== null)
      .map((r) =>
        obs("gld_holdings", r.date, r.holdingsTonnes as number, "tonnes", "daily", "SPDR Gold Shares (State Street)", "https://www.spdrgoldshares.com/usa/gld/", {
          note: "SPDR GLD 官方持仓(吨)。注意: 为代表性单只 ETF, 不等于全球黄金 ETF 总持仓。",
        }),
      );
    await writeSeries({
      meta: {
        series: "gld_holdings",
        name: "SPDR GLD 持仓",
        description: "SPDR Gold Shares (GLD) 官方持仓(吨), 日频",
        unit: "tonnes",
        frequency: "daily",
        source: {
          name: "SPDR Gold Shares (State Street Global Advisors)",
          url: "https://www.spdrgoldshares.com/usa/gld/",
          tier: "official",
          update_note: "每个交易日更新",
          lag_note: "该数据为代表性黄金 ETF, 并不等于全球黄金 ETF 总资金流",
          requires_api_key: false,
        },
      },
      observations,
      last_fetched_at: FETCHED_AT,
      last_observation_date: null,
      all_real: true,
    });
  } catch (e) {
    console.warn(`[spdr] GLD 抓取失败: ${(e as Error).message}`);
  }
}

// ---------- 中国黄金层(本轮新增) ----------

/** Au99.99: 上海黄金交易所日度价格 (WGC 汇编, 人民币/克) */
async function fetchChinaGoldBlock(): Promise<void> {
  try {
    const { points } = await fetchSgeGoldPrice();
    const observations = points
      .filter((p) => p.pmCny !== null)
      .map((p) =>
        obs("au99_99", p.date, p.pmCny as number, "cny_per_gram", "daily", "World Gold Council (汇编自上海黄金交易所 Au99.99)", "https://www.gold.org/goldhub/data/gold-prices", {
          note: "上海黄金交易所 Au99.99 午盘价格(人民币/克)。注意: 是国内人民币计价黄金的重要价格参考, 不是'国内版 XAU/USD', 两者交易市场/报价单位/市场结构不同。",
        }),
      );
    await writeSeries({
      meta: {
        series: "au99_99",
        name: "上海黄金交易所 Au99.99",
        description: "上海黄金交易所 Au99.99 日度价格(人民币/克), WGC 汇编",
        unit: "cny_per_gram",
        frequency: "daily",
        source: {
          name: "World Gold Council (SGE Au99.99)",
          url: "https://www.gold.org/goldhub/data/gold-prices",
          tier: "aggregator",
          update_note: "上海黄金交易所交易日更新 (约 T+1)",
          lag_note: "数据由 WGC 汇编自上海黄金交易所; 官方原始数据见 www.sge.com.cn",
          requires_api_key: false,
        },
      },
      observations,
      last_fetched_at: FETCHED_AT,
      last_observation_date: null,
      all_real: true,
    });
  } catch (e) {
    console.warn(`[china] Au99.99 抓取失败: ${(e as Error).message}`);
  }
}

/** 国内黄金ETF 518880: 日K价格 + 实时报价 + 季度份额 */
async function fetchChinaEtfBlock(foundationOnly = false): Promise<void> {
  if (!foundationOnly) {
  // 1) 日K(收盘价)
  try {
    const rows = await fetchCnEtfKline();
    const observations = rows
      .filter((r) => r.close > 0)
      .map((r) =>
        obs("cn_gold_etf_price", r.date, r.close, "cny_per_share", "daily", "腾讯行情(上交所挂牌数据)", "https://gu.qq.com/sh518880", {
          note: `华安黄金ETF(${CN_ETF.code}) 收盘价(元/份), 成交量 ${r.volume.toLocaleString()} 手`,
        }),
      );
    await writeSeries({
      meta: {
        series: "cn_gold_etf_price",
        name: "国内黄金ETF 518880 收盘价",
        description: "华安黄金ETF 518880 收盘价(元/份), 上交所挂牌行情",
        unit: "cny_per_share",
        frequency: "daily",
        source: {
          name: "腾讯行情(上交所挂牌数据)",
          url: "https://gu.qq.com/sh518880",
          tier: "aggregator",
          update_note: "上交所交易日更新",
          lag_note: "行情聚合自交易所公开数据; 该 ETF 仅为国内黄金配置需求的代表性观察窗口, 非基金推荐",
          requires_api_key: false,
        },
      },
      observations,
      last_fetched_at: FETCHED_AT,
      last_observation_date: null,
      all_real: true,
    });
  } catch (e) {
    console.warn(`[china] 518880 日K 抓取失败: ${(e as Error).message}`);
  }

  // 2) 实时报价(当日涨跌/成交额) -> latest-cn-etf.json
  try {
    const quote = await fetchCnEtfQuote();
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(
      path.join(DATA_DIR, "latest-cn-etf.json"),
      JSON.stringify(
        {
          code: CN_ETF.code,
          name: CN_ETF.name,
          price: quote.price,
          prev_close: quote.prevClose,
          change_pct: quote.changePct,
          volume_shares: quote.volumeShares,
          amount: quote.amount,
          quote_date: quote.date,
          quote_time: quote.time,
          fetched_at: FETCHED_AT,
          source: { name: "新浪财经行情(交易所挂牌数据)", url: "https://finance.sina.com.cn/", note: "实时行情快照, 报价为最新成交价" },
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log(`[china] 518880 实时: ¥${quote.price} (${quote.changePct === null ? "—" : quote.changePct.toFixed(2) + "%"}) @ ${quote.date} ${quote.time}`);
  } catch (e) {
    console.warn(`[china] 518880 实时报价失败: ${(e as Error).message}`);
  }

  // 3) 季度份额(期末总份额, 亿份)
  try {
    const rows = await fetchCnEtfShares();
    const observations = rows
      .filter((r) => r.shares !== null)
      .map((r) =>
        obs("cn_gold_etf_shares", r.date, r.shares as number, "hundred_million_shares", "quarterly", "东方财富基金公开数据(基金公司季度披露)", "https://fundf10.eastmoney.com/gmbd_518880.html", {
          note: `华安黄金ETF 期末总份额(亿份), 季度披露 (${r.netFlow === null ? "净申购数据缺失" : `期间净申购 ${r.netFlow >= 0 ? "+" : ""}${r.netFlow.toFixed(2)} 亿份`}; 披露日约在季度末后 1-2 周)`,
        }),
      );
    await writeSeries({
      meta: {
        series: "cn_gold_etf_shares",
        name: "国内黄金ETF 518880 份额",
        description: "华安黄金ETF 期末总份额(亿份), 季度披露",
        unit: "hundred_million_shares",
        frequency: "quarterly",
        source: {
          name: "东方财富基金公开数据",
          url: "https://fundf10.eastmoney.com/gmbd_518880.html",
          tier: "aggregator",
          update_note: "季度披露(基金公司定期报告)",
          lag_note: "份额为季度频率, 不是日度; 份额变化用于观察国内资金是否持续申购, 不代表推荐",
          requires_api_key: false,
        },
      },
      observations,
      last_fetched_at: FETCHED_AT,
      last_observation_date: null,
      all_real: true,
    });
  } catch (e) {
    console.warn(`[china] 518880 季度份额抓取失败: ${(e as Error).message}`);
  }
  }

  // 4) 官方单位净值(日频): 华安基金产品页为主, PCF 为回退/历史来源。
  try {
    const existing = await readExisting("cn_gold_etf_nav");
    const points = new Map<string, OfficialNavPoint>();
    const latest = await fetchCnEtfOfficialNav(FETCHED_AT);
    points.set(latest.point.date, latest.point);
    const needsPublishedAtRepair = existing?.observations.some((item) =>
      item.source_url?.includes("/sgshqd.jsp") && item.published_at === item.observation_date
    ) ?? false;
    if ((existing?.observations.length ?? 0) < 60 || needsPublishedAtRepair) {
      const start = new Date(NOW);
      start.setUTCDate(start.getUTCDate() - 119);
      for (let cursor = new Date(start); cursor <= NOW; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const weekday = cursor.getUTCDay();
        if (weekday === 0 || weekday === 6) continue;
        const date = cursor.toISOString().slice(0, 10);
        try {
          const point = await fetchCnEtfPcfNavOn(date);
          if (point) points.set(point.date, point);
        } catch (error) {
          console.warn(`[china] 518880 NAV 历史 ${date} 跳过: ${(error as Error).message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    }
    const observations = [...points.values()].map((point) =>
      obs("cn_gold_etf_nav", point.date, point.value, "cny_per_share", "daily", "华安基金官方", point.source === "huaan_product" ? "https://huaan.com.cn/funds/518880/index.shtml" : "https://huaan.com.cn/etf/518880/sgshqd.jsp", {
        published_at: point.publishedAt,
        nav_kind: "official_unit_nav",
        note: point.source === "huaan_product"
          ? "官方单位净值；产品页未披露精确发布时间，published_at 为本站首次观察时间"
          : "官方申购赎回清单(PCF)披露的基金份额净值；非累计净值、非盘中 IOPV",
      }),
    );
    await writeSeries({
      meta: {
        series: "cn_gold_etf_nav",
        name: "华安黄金ETF 518880 官方单位净值",
        description: "华安黄金ETF 官方日度单位净值(元/份)，用于与同日收盘价计算折溢价",
        unit: "cny_per_share",
        frequency: "daily",
        source: {
          name: "华安基金官方",
          url: "https://huaan.com.cn/funds/518880/index.shtml",
          tier: "official",
          update_note: "基金交易日更新，通常 T 日收盘后披露",
          lag_note: "产品页为主，申购赎回清单 PCF 为回退及有限历史初始化；不使用实时 IOPV",
          requires_api_key: false,
        },
      },
      observations,
      last_fetched_at: FETCHED_AT,
      last_observation_date: null,
      all_real: true,
    });
    if (latest.fallbackUsed) console.warn(`[china] 518880 NAV 主源失败，已使用 PCF 回退: ${latest.primaryError}`);
  } catch (e) {
    console.warn(`[china] 518880 官方 NAV 抓取失败, 保留旧快照: ${(e as Error).message}`);
  }

  // 5) 上交所日度总份额；原始单位万份，统一换算为亿份。
  try {
    const existing = await readExisting("cn_gold_etf_shares_daily");
    const points = new Map<string, DailySharesPoint>();
    for (const point of await fetchCnEtfDailySharesLatest()) points.set(point.date, point);
    if (!existing?.observations.length) {
      const start = new Date(NOW);
      start.setUTCDate(start.getUTCDate() - 119);
      for (let cursor = new Date(start); cursor <= NOW; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const weekday = cursor.getUTCDay();
        if (weekday === 0 || weekday === 6) continue;
        const date = cursor.toISOString().slice(0, 10);
        try {
          for (const point of await fetchCnEtfDailySharesOn(date)) points.set(point.date, point);
        } catch (error) {
          console.warn(`[china] 518880 份额历史 ${date} 跳过: ${(error as Error).message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    }
    const observations = [...points.values()].map((point) =>
      obs("cn_gold_etf_shares_daily", point.date, point.value, "hundred_million_shares", "daily", "上海证券交易所", "https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=518880", {
        raw_value: point.rawValue,
        raw_unit: point.rawUnit,
        security_code: point.securityCode,
        note: "上交所基金规模数据 TOT_VOL，原始单位万份；统一值=原始值÷10,000 亿份",
      }),
    );
    await writeSeries({
      meta: {
        series: "cn_gold_etf_shares_daily",
        name: "华安黄金ETF 518880 日度总份额",
        description: "上交所披露的华安黄金ETF日度总份额(亿份)",
        unit: "hundred_million_shares",
        frequency: "daily",
        source: {
          name: "上海证券交易所",
          url: "https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID=518880",
          tier: "official",
          update_note: "交易日更新",
          lag_note: "上交所原始字段 TOT_VOL 单位为万份，本站除以 10,000 转为亿份",
          requires_api_key: false,
        },
      },
      observations,
      last_fetched_at: FETCHED_AT,
      last_observation_date: null,
      all_real: true,
    });
  } catch (e) {
    console.warn(`[china] 518880 日度份额抓取失败, 保留旧快照: ${(e as Error).message}`);
  }

  // 6) 派生基础层：严格同日折溢价、估算规模、份额变化与对称分解。
  try {
    const [priceFile, navFile, sharesFile] = await Promise.all([
      readExisting("cn_gold_etf_price"),
      readExisting("cn_gold_etf_nav"),
      readExisting("cn_gold_etf_shares_daily"),
    ]);
    if (!priceFile || !navFile || !sharesFile) throw new Error("价格、NAV 或日度份额快照缺失");
    const dated = (file: SeriesFile) => file.observations.map((item) => ({ date: item.observation_date, value: item.value }));
    const navValues = dated(navFile);
    const shareValues = dated(sharesFile);
    const foundationStart = [navValues[0]?.date, shareValues[0]?.date].filter((date): date is string => Boolean(date)).sort()[0];
    const priceValues = dated(priceFile).filter((item) => !foundationStart || item.date >= foundationStart);
    const rows = buildEtfFoundationRows(priceValues, navValues, shareValues);
    const latest = latestFormalPremium(rows);
    await mkdir(DERIVED_DIR, { recursive: true });
    await writeFile(path.join(DERIVED_DIR, "cn-gold-etf-foundation.json"), JSON.stringify({
      generated_at: FETCHED_AT,
      etf_code: CN_ETF.code,
      units: { price: "cny_per_share", nav: "cny_per_share", shares: "hundred_million_shares", estimated_aum: "cny" },
      methodology: {
        premium_discount: "only same-date close / official unit NAV - 1",
        estimated_aum: "official unit NAV × shares",
        decomposition: "symmetric midpoint: market=(Q1+Q0)/2×(N1-N0); shares=(N1+N0)/2×(Q1-Q0)",
      },
      latest_formal_premium: latest,
      rows,
    }, null, 2), "utf8");
    console.log(`[derived] cn-gold-etf-foundation: ${rows.length} 条`);
  } catch (e) {
    console.warn(`[derived] 518880 基础层生成失败, 保留旧快照: ${(e as Error).message}`);
  }
}

async function writeManifest(): Promise<void> {
  const files = (await readdir(SERIES_DIR)).filter((f) => f.endsWith(".json"));
  const entries: Array<Record<string, unknown>> = [];
  for (const f of files) {
    try {
      const sf = JSON.parse(await readFile(path.join(SERIES_DIR, f), "utf8")) as SeriesFile;
      entries.push({
        series: sf.meta.series,
        name: sf.meta.name,
        frequency: sf.meta.frequency,
        unit: sf.meta.unit,
        source: sf.meta.source.name,
        requires_api_key: sf.meta.source.requires_api_key,
        is_proxy_of: sf.meta.source.is_proxy_of ?? null,
        observations: sf.observations.length,
        last_observation_date: sf.last_observation_date,
        last_fetched_at: sf.last_fetched_at,
        all_real: sf.all_real,
      });
    } catch {
      /* 跳过损坏文件 */
    }
  }
  await writeFile(
    path.join(DATA_DIR, "manifest.json"),
    JSON.stringify({ generated_at: FETCHED_AT, series: entries }, null, 2),
    "utf8",
  );
  console.log(`[manifest] 已更新 (${entries.length} 个系列)`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const only = (() => {
    const i = args.indexOf("--only");
    return i >= 0 ? args[i + 1]?.split(",") ?? null : null;
  })();
  console.log(`== 黄金市场观察站 数据抓取 @ ${FETCHED_AT} ==`);
  if (!only || only.includes("fred")) await fetchFredBlock();
  if (!only || only.includes("wgc")) await fetchWgcBlock();
  if (!only || only.includes("spdr")) await fetchSpdrBlock();
  if (!only || only.includes("china")) await fetchChinaGoldBlock();
  if (!only || only.includes("china")) await fetchChinaEtfBlock(false);
  else if (only.includes("china-etf")) await fetchChinaEtfBlock(true);
  await writeManifest();
  console.log("== 完成 ==");
}

main().catch((e) => {
  console.error("管线失败:", e);
  process.exitCode = 1;
});
