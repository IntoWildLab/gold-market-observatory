/**
 * 黄金市场观察站 —— 统一数据模型
 *
 * 核心原则：
 * - observation_date: 数据"对应哪一天/哪一期"（如央行储备对应的月末）
 * - published_at:     数据"何时被发布"（低频数据如央行储备，与 observation_date 不同）
 * - fetched_at:       程序"何时抓取"到这条数据
 * 三者必须明确区分，不允许混淆。
 */

export type SeriesId =
  | "gold_price"          // XAU/USD 现货黄金(美元/盎司), 日频
  | "dxy_proxy"           // 美元指数代理(FRED 广义美元指数 DTWEXBGS), 日频
  | "us10y_real"          // 美国10年期实际利率(10Y TIPS, FRED DFII10), 交易日
  | "us10y_nominal"       // 美国10年期名义国债收益率(FRED DGS10), 交易日
  | "us10y_breakeven"     // 美国10年期通胀预期(FRED T10YIE), 交易日
  | "gold_etf_holdings"   // 全球黄金ETF持仓(吨, 分区域), 周频 (WGC)
  | "gold_etf_flows"      // 全球黄金ETF资金流(吨/美元, 分区域), 周频 (WGC)
  | "gld_holdings"        // SPDR Gold Shares (GLD) 持仓(吨), 日频 (SPDR 官方)
  | "cb_gold_purchases"   // 全球央行季度黄金净购买(吨), 季度 (WGC GDT)
  | "china_gold_reserves" // 中国央行黄金储备(吨), 季度 (WGC/IMF IFS, 依据人民银行数据)
  | "china_gold_reserves_usd" // 中国央行黄金储备(亿美元), 季度 (WGC/IMF IFS)
  | "au99_99"             // 上海黄金交易所 Au99.99 日度价格(人民币/克), 交易日 (WGC 汇编自 SGE)
  | "usd_cny"             // 美元兑人民币(CNY per USD), 交易日 (FRED H.10 DEXCHUS)
  | "cn_gold_etf_price"   // 国内代表性黄金ETF 518880 收盘价(元/份), 交易日 (腾讯行情·上交所)
  | "cn_gold_etf_shares"; // 518880 期末份额(亿份), 季度 (东方财富·基金公司披露)

export type Frequency = "daily" | "weekly" | "monthly" | "quarterly";

export type Unit =
  | "usd_per_oz"
  | "index"
  | "percent"
  | "tonnes"
  | "usd_millions"
  | "usd_hundred_millions"
  | "cny_per_gram"
  | "cny_per_usd"
  | "cny_per_share"
  | "hundred_million_shares";

export interface DataSourceMeta {
  /** 数据源名称(展示用) */
  name: string;
  /** 数据源官网/文档 */
  url: string;
  /** 官方/代理/汇总 分类 */
  tier: "official" | "aggregator" | "proxy" | "manual";
  /** 更新频率说明 */
  update_note: string;
  /** 延迟说明 */
  lag_note?: string;
  /** 是否需要 API Key */
  requires_api_key: boolean;
  /** 是否为 DXY 等指标的代理指标(需要明确标注) */
  is_proxy_of?: string;
}

export interface Observation {
  series: SeriesId;
  /** 数据对应日期: 日频 YYYY-MM-DD / 月频 YYYY-MM / 季度用季度末 YYYY-MM-DD */
  observation_date: string;
  value: number;
  unit: Unit;
  source: string;
  source_url?: string;
  frequency: Frequency;
  /** 低频数据的发布日期(如央行数据) */
  published_at?: string;
  /** 程序抓取时间 */
  fetched_at: string;
  /** 是否 Mock/示例数据(仅当真实数据不可得时, 且页面必须显著标注) */
  is_mock?: boolean;
  /** 附加说明 */
  note?: string;
}

export interface SeriesFile {
  meta: {
    series: SeriesId;
    name: string;
    description: string;
    unit: Unit;
    frequency: Frequency;
    source: DataSourceMeta;
  };
  /** 最新一条数据的抓取时间, 用于页面显示"最近数据刷新时间" */
  last_fetched_at: string;
  /** 最新数据对应日期 */
  last_observation_date: string | null;
  /** 是否全部为真实数据 */
  all_real: boolean;
  observations: Observation[];
}

/** 每个指标在页面上的元信息 */
export const SERIES_META: Record<SeriesId, { name: string; short: string; unitLabel: string }> = {
  gold_price: { name: "黄金价格 XAU/USD", short: "黄金", unitLabel: "美元/盎司" },
  dxy_proxy: { name: "美元指数 (广义美元指数代理)", short: "美元指数", unitLabel: "指数" },
  us10y_real: { name: "美国10年期实际利率", short: "10Y实际利率", unitLabel: "%" },
  us10y_nominal: { name: "美国10年期名义收益率", short: "10Y名义收益率", unitLabel: "%" },
  us10y_breakeven: { name: "美国10年期通胀预期", short: "10Y通胀预期", unitLabel: "%" },
  gold_etf_holdings: { name: "全球黄金ETF持仓", short: "ETF持仓", unitLabel: "吨" },
  gold_etf_flows: { name: "全球黄金ETF资金流", short: "ETF资金流", unitLabel: "吨" },
  gld_holdings: { name: "SPDR GLD 持仓", short: "GLD持仓", unitLabel: "吨" },
  cb_gold_purchases: { name: "全球央行黄金净购买", short: "央行购金", unitLabel: "吨" },
  china_gold_reserves: { name: "中国央行黄金储备", short: "中国央行储备", unitLabel: "吨" },
  china_gold_reserves_usd: { name: "中国央行黄金储备(美元)", short: "中国央行储备(USD)", unitLabel: "亿美元" },
  au99_99: { name: "上海黄金交易所 Au99.99", short: "Au99.99", unitLabel: "元/克" },
  usd_cny: { name: "美元兑人民币 USD/CNY", short: "USD/CNY", unitLabel: "人民币/美元" },
  cn_gold_etf_price: { name: "国内黄金ETF 518880 收盘价", short: "518880", unitLabel: "元/份" },
  cn_gold_etf_shares: { name: "国内黄金ETF 518880 份额", short: "518880份额", unitLabel: "亿份" },
};
