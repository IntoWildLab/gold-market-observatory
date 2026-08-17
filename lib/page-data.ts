/**
 * 页面数据装配 (服务端): 加载全部系列快照, 计算指标/评分/图表切片。
 * app/page.tsx 直接消费本模块返回的结构化数据。
 */

import "server-only";
import type { SeriesFile, SeriesId } from "@/types";
import { loadAllSeries, loadManifest, loadLatestSpot, loadLatestCnEtf, loadDerived, type LatestSpot, type LatestCnEtf } from "./data";
import { periodReturns, trendState, yearPosition, latestChange, sumRange, type PeriodReturn, type TrendResult, type YearPosition } from "./indicators/returns";
import { computeAssessment, computeDrivers, type Assessment, type DriverRow } from "./scoring/score";
import { computeChinaComparison, buildTheoreticalSeries, type ChinaComparison, type TheoreticalResult } from "./china";

export interface MacroKpi {
  seriesId: SeriesId;
  label: string;
  value: number | null;
  unit: string;
  change: number | null;
  changePct: number | null;
  changeLabel: string;
  date: string | null;
  source: string;
  sourceUrl: string;
  isProxy: boolean;
  proxyNote?: string;
  frequency: string;
  fetchedAt: string;
  note?: string;
}

export interface GoldKpi {
  latestSpot: LatestSpot | null;
  fixValue: number | null;
  fixDate: string | null;
  dailyChange: number | null;
  dailyChangePct: number | null;
  periodReturns: PeriodReturn[];
  trend: TrendResult;
  yearPos: YearPosition;
  source: string;
  sourceUrl: string;
  fetchedAt: string;
}

export interface EtfKpi {
  holdingsValue: number | null;
  holdingsDate: string | null;
  holdingsChange4w: number | null;
  flowsSum4w: number | null;
  flowsSum12w: number | null;
  flowsLast: number | null;
  flowsLastDate: string | null;
  gldValue: number | null;
  gldDate: string | null;
  gldChange20d: number | null;
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  gldNote: string;
}

export interface StructureKpi {
  cbLatest: number | null;
  cbDate: string | null;
  cbPrev: number | null;
  chinaTonnes: number | null;
  chinaDate: string | null;
  chinaPrev: number | null;
  chinaChange: number | null;
  chinaUsd: number | null;
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  publishedNote: string;
}

export interface ChartSlice {
  seriesId: SeriesId;
  label: string;
  unit: string;
  frequency: string;
  points: Array<{ date: string; value: number | null }>;
  source: string;
  isMock: boolean;
}

export interface ChinaKpi {
  au99: {
    value: number | null;
    date: string | null;
    returns: PeriodReturn[];
    source: string;
    sourceUrl: string;
    fetchedAt: string;
  };
  usdcny: {
    value: number | null;
    date: string | null;
    change: number | null;
    changePct: number | null;
    returns: PeriodReturn[];
    source: string;
    sourceUrl: string;
    fetchedAt: string;
  };
  etf: {
    price: number | null;
    date: string | null;
    dailyChangePct: number | null;
    returns: PeriodReturn[];
    sharesValue: number | null;
    sharesDate: string | null;
    sharesNetFlow: number | null;
    volumeShares: number | null;
    amount: number | null;
    source: string;
    sourceUrl: string;
    fetchedAt: string;
    note: string;
  };
}

export interface PageData {
  generatedAt: string;
  today: string;
  series: Record<SeriesId, SeriesFile | null>;
  gold: GoldKpi;
  macros: MacroKpi[];
  etf: EtfKpi;
  structure: StructureKpi;
  china: ChinaKpi;
  comparison: ChinaComparison;
  theoretical: TheoreticalResult;
  chinaEtfLatest: LatestCnEtf | null;
  temperature: Assessment;
  drivers: DriverRow[];
  charts: ChartSlice[];
  etfRegional: { date: string; northAmerica: number | null; europe: number | null; asia: number | null; other: number | null; total: number | null }[] | null;
  etfFlowsUsd: { date: string; totalUsd: number }[] | null;
  missing: Array<{ seriesId: string; reason: string }>;
  manifestGeneratedAt: string | null;
}

export async function buildPageData(): Promise<PageData> {
  const all = await loadAllSeries();
  const series = Object.fromEntries(all.map((s) => [s.meta.series, s])) as Record<SeriesId, SeriesFile | null>;
  const manifest = await loadManifest();
  const latestSpot = await loadLatestSpot();
  const today = new Date().toISOString().slice(0, 10);

  // ---- 黄金 ----
  const goldFile = series.gold_price;
  const goldObs = goldFile?.observations ?? [];
  const gDaily = latestChange(goldObs);
  const gTrend = trendState(goldObs);
  const gYearPos = yearPosition(goldObs);
  const gReturns = periodReturns(goldObs, [
    ["1D", 1],
    ["5D", 5],
    ["20D", 20],
    ["60D", 60],
    ["120D", 120],
  ]);
  const gold: GoldKpi = {
    latestSpot,
    fixValue: gDaily.value,
    fixDate: goldObs.length ? goldObs[goldObs.length - 1].observation_date : null,
    dailyChange: gDaily.change,
    dailyChangePct: gDaily.changePct,
    periodReturns: gReturns,
    trend: gTrend,
    yearPos: gYearPos,
    source: goldFile?.meta.source.name ?? "—",
    sourceUrl: goldFile?.meta.source.url ?? "",
    fetchedAt: goldFile?.last_fetched_at ?? "",
  };

  // ---- 宏观卡片 ----
  const macroDefs: Array<{ seriesId: SeriesId; label: string; unit: string; digits: number; note?: string }> = [
    { seriesId: "dxy_proxy", label: "美元指数", unit: "指数", digits: 2, note: "FRED 广义美元指数, 为 ICE DXY 的官方代理(权重不同)" },
    { seriesId: "us10y_real", label: "10Y 实际利率", unit: "%", digits: 3 },
    { seriesId: "us10y_nominal", label: "10Y 名义收益率", unit: "%", digits: 3 },
  ];
  const macros: MacroKpi[] = macroDefs.map((def) => {
    const f = series[def.seriesId];
    const obs = f?.observations ?? [];
    const ch = latestChange(obs);
    const last = obs.length ? obs[obs.length - 1] : null;
    return {
      seriesId: def.seriesId,
      label: def.label,
      value: ch.value,
      unit: def.unit,
      change: ch.change,
      changePct: ch.changePct,
      changeLabel: ch.change === null ? "—" : `${ch.change >= 0 ? "+" : ""}${ch.change.toFixed(def.digits)}`,
      date: last?.observation_date ?? null,
      source: f?.meta.source.name ?? "—",
      sourceUrl: f?.meta.source.url ?? "",
      isProxy: def.seriesId === "dxy_proxy",
      proxyNote: def.note,
      frequency: f?.meta.frequency ?? "",
      fetchedAt: f?.last_fetched_at ?? "",
      note: last?.note,
    };
  });

  // ---- ETF ----
  const etfFile = series.gold_etf_holdings;
  const flowsFile = series.gold_etf_flows;
  const gldFile = series.gld_holdings;
  const etfHolds = etfFile?.observations ?? [];
  const etfFlows = flowsFile?.observations ?? [];
  const gldObs = gldFile?.observations ?? [];
  const ehLast = etfHolds.length ? etfHolds[etfHolds.length - 1] : null;
  const ehPrev4 = etfHolds.length >= 5 ? etfHolds[etfHolds.length - 5].value : null;
  const gldLast = gldObs.length ? gldObs[gldObs.length - 1] : null;
  const gldPrev20 = gldObs.length >= 21 ? gldObs[gldObs.length - 21].value : null;
  const etf: EtfKpi = {
    holdingsValue: ehLast?.value ?? null,
    holdingsDate: ehLast?.observation_date ?? null,
    holdingsChange4w: ehPrev4 !== null && ehLast ? ehLast.value - ehPrev4 : null,
    flowsSum4w: sumRange(etfFlows, 4),
    flowsSum12w: sumRange(etfFlows, 12),
    flowsLast: etfFlows.length ? etfFlows[etfFlows.length - 1].value : null,
    flowsLastDate: etfFlows.length ? etfFlows[etfFlows.length - 1].observation_date : null,
    gldValue: gldLast?.value ?? null,
    gldDate: gldLast?.observation_date ?? null,
    gldChange20d: gldPrev20 !== null && gldLast ? gldLast.value - gldPrev20 : null,
    source: etfFile?.meta.source.name ?? flowsFile?.meta.source.name ?? "—",
    sourceUrl: etfFile?.meta.source.url ?? "",
    fetchedAt: etfFile?.last_fetched_at ?? "",
    gldNote: "GLD 为代表性 ETF, 不等于全球黄金 ETF 总量",
  };

  // ---- 长期结构 ----
  const cbFile = series.cb_gold_purchases;
  const chinaFile = series.china_gold_reserves;
  const chinaUsdFile = series.china_gold_reserves_usd;
  const cbObs = cbFile?.observations ?? [];
  const chinaObs = chinaFile?.observations ?? [];
  const cbLast = cbObs.length ? cbObs[cbObs.length - 1] : null;
  const cbPrev = cbObs.length >= 2 ? cbObs[cbObs.length - 2] : null;
  const cnLast = chinaObs.length ? chinaObs[chinaObs.length - 1] : null;
  const cnPrev = chinaObs.length >= 2 ? chinaObs[chinaObs.length - 2] : null;
  const cnUsdLast = chinaUsdFile?.observations.length ? chinaUsdFile.observations[chinaUsdFile.observations.length - 1] : null;
  const structure: StructureKpi = {
    cbLatest: cbLast?.value ?? null,
    cbDate: cbLast?.observation_date ?? null,
    cbPrev: cbPrev?.value ?? null,
    chinaTonnes: cnLast?.value ?? null,
    chinaDate: cnLast?.observation_date ?? null,
    chinaPrev: cnPrev?.value ?? null,
    chinaChange: cnLast && cnPrev ? cnLast.value - cnPrev.value : null,
    chinaUsd: cnUsdLast?.value ?? null,
    source: cbFile?.meta.source.name ?? "—",
    sourceUrl: cbFile?.meta.source.url ?? "",
    fetchedAt: cbFile?.last_fetched_at ?? "",
    publishedNote:
      "央行数据为低频数据: 全球购金为季度确认值(WGC GDT), 中国储备为季度(WGC/IMF IFS, 数据对应季度末)。不要将其显示为日度数据。人民银行按月公布官方储备资产, 本站 v1 采用季度汇总口径。",
  };

  // ---- 图表切片 ----
  const chartDefs: Array<{ seriesId: SeriesId; label: string; unit: string }> = [
    { seriesId: "gold_price", label: "黄金价格 (LBMA 定盘)", unit: "USD/oz" },
    { seriesId: "au99_99", label: "上海黄金交易所 Au99.99", unit: "元/克" },
    { seriesId: "usd_cny", label: "美元兑人民币 USD/CNY", unit: "人民币/美元" },
    { seriesId: "cn_gold_etf_price", label: "国内黄金ETF 518880", unit: "元/份" },
    { seriesId: "dxy_proxy", label: "美元指数(广义代理)", unit: "指数" },
    { seriesId: "us10y_real", label: "美国10年期实际利率", unit: "%" },
    { seriesId: "us10y_nominal", label: "美国10年期名义收益率", unit: "%" },
    { seriesId: "gold_etf_holdings", label: "全球黄金ETF持仓", unit: "吨" },
    { seriesId: "gold_etf_flows", label: "全球黄金ETF周度资金流", unit: "吨" },
    { seriesId: "cb_gold_purchases", label: "全球央行季度购金", unit: "吨" },
    { seriesId: "china_gold_reserves", label: "中国央行黄金储备", unit: "吨" },
    { seriesId: "cn_gold_etf_shares", label: "国内黄金ETF 518880 份额", unit: "亿份" },
  ];
  const charts: ChartSlice[] = chartDefs.map((def) => {
    const f = series[def.seriesId];
    return {
      seriesId: def.seriesId,
      label: def.label,
      unit: def.unit,
      frequency: f?.meta.frequency ?? "daily",
      points: (f?.observations ?? []).map((o) => ({ date: o.observation_date, value: o.value })),
      source: f?.meta.source.name ?? "—",
      isMock: (f?.observations ?? []).some((o) => o.is_mock),
    };
  });

  const etfRegional = (await loadDerived("gold-etf-regional.json")) as {
    rows: Array<{ date: string; northAmerica: number | null; europe: number | null; asia: number | null; other: number | null; total: number | null }>;
  } | null;
  const etfFlowsUsd = (await loadDerived("gold-etf-flows-usd.json")) as { rows: Array<{ date: string; totalUsd: number }> } | null;

  // ---- 中国黄金层(本轮新增) ----
  const chinaEtfLatest = await loadLatestCnEtf();
  const au99File = series.au99_99;
  const usdcnyFile = series.usd_cny;
  const cnEtfFile = series.cn_gold_etf_price;
  const cnSharesFile = series.cn_gold_etf_shares;
  const au99Obs = au99File?.observations ?? [];
  const usdcnyObs = usdcnyFile?.observations ?? [];
  const cnEtfObs = cnEtfFile?.observations ?? [];
  const cnSharesObs = cnSharesFile?.observations ?? [];

  const au99Daily = latestChange(au99Obs);
  const usdcnyDaily = latestChange(usdcnyObs);
  const cnEtfLast = cnEtfObs.length ? cnEtfObs[cnEtfObs.length - 1] : null;
  const cnSharesLast = cnSharesObs.length ? cnSharesObs[cnSharesObs.length - 1] : null;
  const cnSharesPrev = cnSharesObs.length >= 2 ? cnSharesObs[cnSharesObs.length - 2] : null;

  const china: ChinaKpi = {
    au99: {
      value: au99Daily.value,
      date: au99Obs.length ? au99Obs[au99Obs.length - 1].observation_date : null,
      returns: periodReturns(au99Obs, [
        ["1D", 1],
        ["5D", 5],
        ["20D", 20],
        ["60D", 60],
        ["120D", 120],
      ]),
      source: au99File?.meta.source.name ?? "—",
      sourceUrl: au99File?.meta.source.url ?? "",
      fetchedAt: au99File?.last_fetched_at ?? "",
    },
    usdcny: {
      value: usdcnyDaily.value,
      date: usdcnyObs.length ? usdcnyObs[usdcnyObs.length - 1].observation_date : null,
      change: usdcnyDaily.change,
      changePct: usdcnyDaily.changePct,
      returns: periodReturns(usdcnyObs, [
        ["1D", 1],
        ["5D", 5],
        ["20D", 20],
        ["60D", 60],
      ]),
      source: usdcnyFile?.meta.source.name ?? "—",
      sourceUrl: usdcnyFile?.meta.source.url ?? "",
      fetchedAt: usdcnyFile?.last_fetched_at ?? "",
    },
    etf: {
      price: chinaEtfLatest?.price ?? cnEtfLast?.value ?? null,
      date: chinaEtfLatest?.quote_date || cnEtfLast?.observation_date || null,
      dailyChangePct: chinaEtfLatest?.change_pct ?? null,
      returns: periodReturns(cnEtfObs, [
        ["1D", 1],
        ["5D", 5],
        ["20D", 20],
        ["60D", 60],
      ]),
      sharesValue: cnSharesLast?.value ?? null,
      sharesDate: cnSharesLast?.observation_date ?? null,
      sharesNetFlow: cnSharesLast && cnSharesPrev ? cnSharesLast.value - cnSharesPrev.value : null,
      volumeShares: chinaEtfLatest?.volume_shares ?? null,
      amount: chinaEtfLatest?.amount ?? null,
      source: cnEtfFile?.meta.source.name ?? "—",
      sourceUrl: cnEtfFile?.meta.source.url ?? "",
      fetchedAt: cnEtfFile?.last_fetched_at ?? "",
      note: "华安黄金ETF(518880)为国内黄金配置需求的代表性观察窗口, 非基金推荐; 份额为季度披露频率",
    },
  };

  const comparison = computeChinaComparison(goldObs, au99Obs, usdcnyObs);
  const theoretical = buildTheoreticalSeries(goldObs, usdcnyObs, au99Obs);

  // ---- 缺失数据 ----
  const missing: PageData["missing"] = [];
  if (!series.gold_price) missing.push({ seriesId: "gold_price", reason: "无数据文件" });
  if (!series.dxy_proxy) missing.push({ seriesId: "dxy_proxy", reason: "无数据文件 (需 FRED_API_KEY 或网络)" });
  if (!series.us10y_real) missing.push({ seriesId: "us10y_real", reason: "无数据文件" });
  if (!series.us10y_nominal) missing.push({ seriesId: "us10y_nominal", reason: "无数据文件" });
  if (!series.gold_etf_holdings) missing.push({ seriesId: "gold_etf_holdings", reason: "无数据文件" });
  if (!series.gold_etf_flows) missing.push({ seriesId: "gold_etf_flows", reason: "无数据文件" });
  if (!series.cb_gold_purchases) missing.push({ seriesId: "cb_gold_purchases", reason: "无数据文件" });
  if (!series.china_gold_reserves) missing.push({ seriesId: "china_gold_reserves", reason: "无数据文件" });
  if (!series.au99_99) missing.push({ seriesId: "au99_99", reason: "无数据文件 (需网络访问 WGC)" });
  if (!series.usd_cny) missing.push({ seriesId: "usd_cny", reason: "无数据文件 (需 FRED_API_KEY 或网络)" });
  if (!series.cn_gold_etf_price) missing.push({ seriesId: "cn_gold_etf_price", reason: "无数据文件 (国内行情接口不可达)" });

  const temperature = computeAssessment(series);
  const drivers = computeDrivers(series);

  return {
    generatedAt: new Date().toISOString(),
    today,
    series,
    gold,
    macros,
    etf,
    structure,
    china,
    comparison,
    theoretical,
    chinaEtfLatest,
    temperature,
    drivers,
    charts,
    etfRegional: etfRegional?.rows ?? null,
    etfFlowsUsd: etfFlowsUsd?.rows ?? null,
    missing,
    manifestGeneratedAt: manifest?.generated_at ?? null,
  };
}
