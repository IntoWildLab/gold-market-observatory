const DRIVER_SERIES_BY_TITLE: Readonly<Record<string, string>> = {
  "美元(代理)": "dxy_proxy",
  "10Y实际利率": "us10y_real",
  "10Y名义收益率": "us10y_nominal",
  "全球黄金ETF": "gold_etf_flows",
  "GLD(代表性ETF)": "gld_holdings",
  "全球央行": "cb_gold_purchases",
  "中国央行": "china_gold_reserves",
  "黄金价格(近20日)": "gold_price",
};

export function resolveDriverSeriesId(title: string): string | null {
  return DRIVER_SERIES_BY_TITLE[title] ?? null;
}
