"use client";

import { useState } from "react";
import type { DesignData } from "@/lib/design-data";
import { V4AreaChart, V4Donut, V4ShareStack, V4Compare, type VPoint } from "./charts/V4Chart";

/**
 * refined-v4 —— 浅暖白金融风(仅 /design/refined-v4 预览)
 * 本轮要点:
 * - 浅米白底 + 白色卡片 + 深色文字 + 金色点缀, 明亮易读
 * - 第一屏左60%国际黄金 / 右40%中国黄金(旧版三卡片)
 * - 驱动面板恢复旧版"利多/确认"盒状条目
 * - 保留 refined-v4 优点: 国际金价主图较大清晰(略缩给右侧空间)
 * - 注意: 本页涨跌色按本轮要求为「涨=绿 / 跌=红」(正式页红涨绿跌不受影响)
 */
const T = {
  bg: "#f7f4ed",
  card: "#ffffff",
  border: "#e8e1d1",
  text: "#2b2a26",
  muted: "#7d766a",
  faint: "#a8a193",
  gold: "#b07d2b",
  goldSoft: "#f3ead8",
  // 价格涨跌(中国语境: 涨=红, 跌=绿)
  up: "#d64545",
  down: "#1e8e5a",
  // 驱动判断语义色(利多/偏支持/偏流入=绿, 利空=红, 确认=蓝)
  fav: "#1e8e5a",
  unfav: "#d64545",
  confirm: "#2f7fb8",
  au99: "#d95f43",
  usd: "#4a8fd4",
  real: "#8a6fd4",
  nominal: "#9aa3ad",
  flow: "#2fa8b0",
};

const fmt = (v: number | null | undefined, dg = 2) => (v === null || v === undefined ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: dg, maximumFractionDigits: dg }));
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
const upDown = (v: number | null | undefined) => (v === null || v === undefined ? T.faint : v >= 0 ? T.up : T.down);

function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-xl border shadow-[0_1px_3px_rgba(80,70,40,0.06)] ${className}`} style={{ background: T.card, borderColor: T.border, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ k, t, sub }: { k: string; t: string; sub?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="font-mono text-[13px] font-semibold tracking-[0.22em] text-[#7a4f18]">{k}</span>
      <h2 className="text-xl font-bold tracking-wide text-[#2b2a26]">{t}</h2>
      {sub && <span className="text-[14px] text-[#5c564b]">{sub}</span>}
      <span className="h-px flex-1" style={{ background: T.border }} />
    </div>
  );
}

const pp = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}pp`);
const compactCny = (v: number | null | undefined) => (
  v === null || v === undefined ? "—" : new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 2 }).format(v)
);
const trackingExplanation = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "共同样本不足";
  if (Math.abs(value) < 0.005) return "基金NAV与Au99.99基本持平";
  return `NAV相对Au99.99${value > 0 ? "高" : "低"}${Math.abs(value).toFixed(2)}个百分点`;
};
const premiumExplanation = (value: number | null, available: boolean, alignment: string | null) => {
  if (!available || value === null) {
    return alignment === "nav_lagged" ? "暂无同日正式折溢价 · NAV日期滞后" : "暂无同日正式折溢价";
  }
  if (Math.abs(value) < 0.005) return "市价与官方NAV基本持平";
  return `市价较官方NAV${value > 0 ? "高" : "低"}${Math.abs(value).toFixed(2)}%`;
};

function ResponsiveDisclosure({ label, children, desktopOpen = false }: { label: string; children: React.ReactNode; desktopOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 border-t pt-2.5" style={{ borderColor: T.border }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center justify-between text-left text-[13px] font-medium text-[#6b6459] hover:text-[#2b2a26] ${desktopOpen ? "lg:hidden" : ""}`}
        aria-expanded={open}
      >
        <span>{label}</span><span aria-hidden>{open ? "收起 ▲" : "展开 ▼"}</span>
      </button>
      <div className={`${open ? "block" : "hidden"} ${desktopOpen ? "lg:block" : ""} mt-2`}>{children}</div>
    </div>
  );
}

function InternationalGoldSummary({ data: d }: { data: DesignData }) {
  const r20 = d.gold.periodReturns.find((row) => row.window === "20D");
  const secondary = d.gold.periodReturns.filter((row) => !["1D", "20D"].includes(row.window));
  return (
    <Card className="min-w-0 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold">国际黄金 XAU/USD</span>
            <span className="rounded px-1.5 py-px text-[13px]" style={{ background: T.goldSoft, color: T.gold }}>GLOBAL · 现货</span>
          </div>
          <div className="mt-1 truncate text-[13px] text-[#a8a193]">{d.gold.latestSpot?.as_of_date ?? "—"} · {d.gold.latestSpot?.source.name ?? "—"}</div>
        </div>
        <span className="hidden rounded px-1.5 py-px text-[13px] text-[#7d766a] sm:inline" style={{ background: "#f0ede6" }}>历史: LBMA 定盘</span>
      </div>
      <div className="mt-2.5 flex min-w-0 flex-wrap items-end gap-x-3 gap-y-1">
        <span className="min-w-0 font-mono text-[2.35rem] font-bold leading-none sm:text-5xl" style={{ color: T.gold }}>{fmt(d.gold.latestSpot?.price_usd)}</span>
        <span className="mb-0.5 font-mono text-lg font-bold" style={{ color: upDown(d.gold.dailyChangePct) }}>
          {d.gold.dailyChangePct === null ? "—" : `${d.gold.dailyChangePct >= 0 ? "▲" : "▼"} ${pct(d.gold.dailyChangePct)}`}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 divide-x rounded-lg border py-1.5 text-center" style={{ borderColor: T.border }}>
        <div className="px-2">
          <div className="text-[12px] text-[#a8a193]">近20日</div>
          <div className="font-mono text-[15px] font-bold" style={{ color: upDown(r20?.changePct) }}>{pct(r20?.changePct)}</div>
        </div>
        <div className="px-2">
          <div className="text-[12px] text-[#a8a193]">趋势</div>
          <div className="truncate text-[15px] font-bold" style={{ color: upDown(d.gold.trend.changePct) }}>{d.gold.trend.label}</div>
        </div>
        <div className="px-2">
          <div className="text-[12px] text-[#a8a193]">一年位置</div>
          <div className="truncate text-[15px] font-bold">{d.gold.yearPos.label} {d.gold.yearPos.percentile === null ? "" : `${d.gold.yearPos.percentile.toFixed(0)}%`}</div>
        </div>
      </div>
      <ResponsiveDisclosure label="更多周期与来源" desktopOpen>
        <div className="grid grid-cols-3 gap-2">
          {secondary.map((row) => (
            <div key={row.window} className="rounded-lg bg-[#faf8f2] px-2 py-1.5 text-center">
              <div className="text-[12px] text-[#a8a193]">{row.label}</div>
              <div className="font-mono text-sm font-bold" style={{ color: upDown(row.changePct) }}>{pct(row.changePct)}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-[#a8a193]">当前价来源: {d.gold.latestSpot?.source.name ?? "—"}；历史序列: {d.gold.source}。</p>
      </ResponsiveDisclosure>
    </Card>
  );
}

type CoreSeriesId = "gold_price" | "au99_99" | "cn_gold_etf_price";
function CoreGoldTrendChart({ data: d }: { data: DesignData }) {
  const [seriesId, setSeriesId] = useState<CoreSeriesId>("au99_99");
  const series = [
    { id: "gold_price" as const, selector: "XAU/USD", title: "国际黄金 XAU/USD", sub: "全球黄金价格锚", unit: "USD/oz", color: T.gold },
    { id: "au99_99" as const, selector: "Au99.99", title: "Au99.99", sub: "中国人民币黄金基准", unit: "元/克", color: T.au99 },
    { id: "cn_gold_etf_price" as const, selector: "518880", title: "黄金ETF 518880", sub: "华安黄金ETF · 市场价格", unit: "元/份", color: T.gold },
  ];
  const selected = series.find((item) => item.id === seriesId) ?? series[1];
  const points = (d.charts.find((chart) => chart.seriesId === selected.id)?.points ?? []) as VPoint[];
  return (
    <Card className="min-w-0 p-3 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <span className="text-sm font-semibold">核心黄金走势</span>
        <span className="text-[12px] text-[#a8a193]">{selected.title} · {selected.unit}</span>
      </div>
      <div className="mt-2 grid grid-cols-3 rounded-lg border bg-[#faf8f2] p-1" style={{ borderColor: T.border }} aria-label="核心黄金走势数据系列">
        {series.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSeriesId(item.id)}
            className={`min-w-0 rounded-md px-1.5 py-2 text-center text-[12px] font-semibold transition sm:text-[13px] ${seriesId === item.id ? "bg-white text-[#7a4f18] shadow-sm" : "text-[#7d766a] hover:text-[#2b2a26]"}`}
            aria-pressed={seriesId === item.id}
          >
            {item.selector}
          </button>
        ))}
      </div>
      <div className="mt-2 min-w-0">
        <div className="min-w-0"><div className="truncate text-[13px] font-semibold">{selected.title}</div><div className="truncate text-[11px] text-[#a8a193]">{selected.sub}</div></div>
      </div>
      <V4AreaChart key={seriesId} points={points} color={selected.color} unit={selected.unit} defaultRange="1Y" heightClassName="h-[190px] lg:h-[270px]" />
    </Card>
  );
}

type MacroItem = DesignData["macros"][number] | undefined;
function MacroEnvironmentStrip({ dxy, real, nominal }: { dxy: MacroItem; real: MacroItem; nominal: MacroItem }) {
  const rows = [
    { label: "美元指数代理", item: dxy, unit: "", note: "人民币黄金外部环境" },
    { label: "10Y实际利率", item: real, unit: "%", note: "核心" },
    { label: "10Y名义收益率", item: nominal, unit: "%", note: "辅助确认" },
  ];
  return (
    <Card className="p-4">
      <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[#a8a193]">Macro Environment · 宏观辅助环境</div>
      <div className="grid grid-cols-1 gap-0 sm:grid-cols-3 sm:gap-3">
        {rows.map((row, index) => (
          <div key={row.label} className={`flex items-center justify-between py-2 sm:block sm:rounded-lg sm:bg-[#faf8f2] sm:px-3 ${index ? "border-t sm:border-0" : ""}`} style={{ borderColor: T.border }}>
            <div className="text-[13px] text-[#7d766a]">{row.label} <span className="text-[11px] text-[#a8a193]">{row.note}</span></div>
            <div className="font-mono text-base font-bold">{fmt(row.item?.value)}{row.unit} <span className="text-sm" style={{ color: upDown(row.item?.change) }}>{row.item?.changeLabel ?? "—"}</span></div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Au9999BenchmarkCard({ data: d }: { data: DesignData }) {
  const daily = d.china.au99.returns.find((row) => row.window === "1D")?.changePct ?? null;
  const r20 = d.china.au99.returns.find((row) => row.window === "20D")?.changePct ?? null;
  return (
    <Card className="min-w-0 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><div className="text-base font-semibold">Au99.99</div><div className="text-[12px] font-medium" style={{ color: T.au99 }}>中国人民币黄金基准</div><div className="text-[11px] text-[#a8a193]">上海黄金交易所人民币黄金现货参考</div></div>
        <div className="text-right text-[12px] text-[#a8a193]">{d.china.au99.date ?? "—"}<br />上海黄金交易所</div>
      </div>
      <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-2">
        <span className="font-mono text-3xl font-bold" style={{ color: T.au99 }}>{fmt(d.china.au99.value)}</span>
        <span className="text-[13px] text-[#7d766a]">元/克</span>
        <span className="ml-auto font-mono text-lg font-bold" style={{ color: upDown(daily) }}>{pct(daily)}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-[#faf8f2] px-3 py-2"><div className="text-[12px] text-[#a8a193]">近20日表现</div><div className="font-mono font-bold" style={{ color: upDown(r20) }}>{pct(r20)}</div></div>
        <div className="rounded-lg bg-[#faf8f2] px-3 py-2"><div className="text-[12px] text-[#a8a193]">国内定价偏离</div><div className="font-mono font-bold" style={{ color: upDown(d.theoretical.latest?.premiumPct) }}>{pct(d.theoretical.latest?.premiumPct)}</div></div>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-[#a8a193]">国内定价偏离为同日理论折算研究参考，不代表合理价格或套利信号。</p>
    </Card>
  );
}

function ChinaGoldAttributionCard({ data: d }: { data: DesignData }) {
  const attribution = d.china.goldAttribution;
  const row = attribution.windows["20D"];
  const factors = [
    { label: "国际黄金贡献", value: row?.gold_contribution_pp },
    { label: "汇率贡献", value: row?.fx_contribution_pp },
    { label: "国内定价偏离贡献", value: row?.deviation_contribution_pp },
  ];
  return (
    <Card className="min-w-0 p-4">
      <div className="flex items-start justify-between gap-2"><div><div className="text-sm font-semibold">人民币黄金收益贡献</div><div className="text-[12px] text-[#a8a193]">默认窗口 · 20D</div></div><div className="text-right"><div className="text-[11px] text-[#a8a193]">Au99.99 实际收益</div><div className="font-mono text-lg font-bold" style={{ color: upDown(row?.actual_au99_return_pct) }}>{pct(row?.actual_au99_return_pct)}</div></div></div>
      {row ? (
        <div className="mt-3 space-y-1.5">
          {factors.map((factor) => <div key={factor.label} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border-l-2 bg-[#faf8f2] px-3 py-2" style={{ borderColor: factor.value === null || factor.value === undefined ? T.faint : factor.value >= 0 ? T.gold : T.down }}><span className="min-w-0 text-[13px] text-[#575249]">{factor.label}</span><span className="shrink-0 font-mono text-sm font-bold" style={{ color: upDown(factor.value) }}>{pp(factor.value)}</span></div>)}
        </div>
      ) : <p className="mt-3 text-[13px] text-[#a8a193]">20D 共同样本不足，暂无法展示归因。</p>}
      <ResponsiveDisclosure label="查看5D / 60D与方法说明">
        <div className="grid grid-cols-2 gap-2">
          {(["5D", "60D"] as const).map((window) => { const item = attribution.windows[window]; return <div key={window} className="rounded-lg bg-[#faf8f2] p-2 text-[12px]"><div className="font-semibold">{window} · 实际 {pct(item?.actual_au99_return_pct)}</div><div className="mt-1 text-[#7d766a]">黄金 {pp(item?.gold_contribution_pp)}<br />汇率 {pp(item?.fx_contribution_pp)}<br />偏离 {pp(item?.deviation_contribution_pp)}</div></div>; })}
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-[#a8a193]">方法: {row?.interaction_method ?? "—"}；贡献单位为百分点(pp)，允许为负；不表示百分比组成占比。{row ? ` 对齐日 ${row.start_date} → ${row.end_date}` : ""}</p>
      </ResponsiveDisclosure>
    </Card>
  );
}

function CnEtfInvestorCard({ data: d }: { data: DesignData }) {
  const etf = d.invest.chinaGoldEtf;
  const tracking20 = etf.tracking.windows["20D"];
  const tracking5 = etf.tracking.windows["5D"];
  const tracking60 = etf.tracking.windows["60D"];
  return (
    <Card className="min-w-0 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-base font-semibold">黄金ETF 518880</div><div className="text-[12px] font-medium text-[#7a4f18]">INVEST · 投资工具摘要</div></div><div className="text-right text-[12px] text-[#a8a193]">市场价 {etf.market_close_date ?? "—"}<br />华安黄金ETF · 非推荐</div></div>
      <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-2"><span className="font-mono text-3xl font-bold" style={{ color: T.gold }}>{fmt(etf.market_close, 3)}</span><span className="text-[13px] text-[#7d766a]">元/份</span><span className="ml-auto font-mono text-lg font-bold" style={{ color: upDown(etf.daily_return_pct) }}>{pct(etf.daily_return_pct)}</span></div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
        <InvestorMetric label="官方 NAV" value={etf.official_nav === null ? "—" : `${fmt(etf.official_nav, 4)} 元`} note={etf.nav_date ?? "暂无日期"} />
        <InvestorMetric label="正式同日折溢价" value={etf.formal_premium_available ? pct(etf.premium_discount_pct) : "暂无正式值"} note={premiumExplanation(etf.premium_discount_pct, etf.formal_premium_available, etf.alignment_status)} valueColor={etf.formal_premium_available ? upDown(etf.premium_discount_pct) : T.faint} />
        <InvestorMetric label="20D 份额变化" value={pct(etf.shares_change_windows_pct["20D"])} valueColor={upDown(etf.shares_change_windows_pct["20D"])} />
        <InvestorMetric label="20D 跟踪偏离" value={pp(tracking20?.tracking_difference_pp)} note={trackingExplanation(tracking20?.tracking_difference_pp)} valueColor={upDown(tracking20?.tracking_difference_pp)} />
      </div>
      <ResponsiveDisclosure label="查看规模、份额与跟踪偏离详情">
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <InvestorMetric label="Estimated AUM" value={`${compactCny(etf.estimated_aum_cny)} 元`} />
          <InvestorMetric label="日度总份额" value={`${fmt(etf.total_shares)} 亿份`} note={etf.shares_date ?? "—"} />
          <InvestorMetric label="5D / 60D份额" value={`${pct(etf.shares_change_windows_pct["5D"])} / ${pct(etf.shares_change_windows_pct["60D"])}`} />
          <InvestorMetric label="60D 跟踪偏离" value={pp(tracking60?.tracking_difference_pp)} />
          <InvestorMetric label="5D 跟踪偏离" value={pp(tracking5?.tracking_difference_pp)} />
          <InvestorMetric label="MarketEffect" value={`${compactCny(etf.estimated_market_effect_cny)} 元`} />
          <InvestorMetric label="ShareEffect" value={`${compactCny(etf.estimated_share_flow_cny)} 元`} />
          <InvestorMetric label="分解闭合残差" value={`${fmt(etf.decomposition_closure_residual_cny, 2)} 元`} />
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-[#a8a193]">跟踪偏离使用官方 NAV 收益减去 Au99.99 收益；Au99.99 为中国黄金现货代理基准（benchmark_is_proxy = true）。所有数值直接来自 DesignData，不在组件内重算。</p>
      </ResponsiveDisclosure>
    </Card>
  );
}

function InvestorMetric({ label, value, note, valueColor = T.text }: { label: string; value: string; note?: string; valueColor?: string }) {
  return <div className="min-w-0 rounded-lg bg-[#faf8f2] px-3 py-2"><div className="text-[#a8a193]">{label}</div><div className="break-words font-mono text-sm font-bold" style={{ color: valueColor }}>{value}</div>{note && <div className="mt-0.5 text-[11px] text-[#a8a193]">{note}</div>}</div>;
}

function CnyTransmissionCard({ data: d }: { data: DesignData }) {
  const r20 = d.china.usdcny.returns.find((row) => row.window === "20D")?.changePct;
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-sm font-semibold">USD/CNY</div><div className="text-[12px] text-[#a8a193]">人民币黄金传导辅助指标</div></div><div className="text-right"><div className="font-mono text-xl font-bold" style={{ color: T.usd }}>{fmt(d.china.usdcny.value, 4)}</div><div className="text-[12px] text-[#a8a193]">20D {pct(r20)} · 上升=人民币走弱</div></div></div>
    </Card>
  );
}

function MobileIntlComparison({ data: d }: { data: DesignData }) {
  const rows = [
    { label: "国际黄金 XAU/USD", values: d.comparison.gold },
    { label: "Au99.99", values: d.comparison.au99 },
    { label: "USD/CNY", values: d.comparison.usdcny },
  ];
  const valueFor = (values: typeof d.comparison.gold, window: string) => values.find((item) => item.label === window)?.changePct;
  return (
    <Card className="p-4 md:hidden">
      <div className="flex items-baseline justify-between gap-2"><div className="text-sm font-semibold">国际黄金 vs 国内黄金摘要</div><span className="text-[12px] text-[#a8a193]">默认 · 20D</span></div>
      <div className="mt-3 space-y-1">
        {rows.map((row) => <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg bg-[#faf8f2] px-3 py-2"><span className="min-w-0 text-[13px] text-[#575249]">{row.label}</span><span className="shrink-0 font-mono text-sm font-bold" style={{ color: upDown(valueFor(row.values, "20D")) }}>{pct(valueFor(row.values, "20D"))}</span></div>)}
        <div className="flex items-center justify-between gap-3 rounded-lg bg-[#faf8f2] px-3 py-2"><span className="text-[13px] text-[#575249]">国内溢价 / 折价</span><span className="shrink-0 font-mono text-sm font-bold" style={{ color: upDown(d.theoretical.latest?.premiumPct) }}>{pct(d.theoretical.latest?.premiumPct)}</span></div>
      </div>
      <p className="mt-3 rounded-lg border-l-2 bg-[#faf8f2] px-3 py-2 text-[12px] leading-relaxed text-[#5c564b]" style={{ borderColor: T.gold }}>{d.comparison.explanation}</p>
      <ResponsiveDisclosure label="查看5D / 60D完整对比">
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="rounded-lg border p-2.5" style={{ borderColor: T.border }}>
              <div className="text-[12px] font-semibold">{row.label}</div>
              <div className="mt-1 grid grid-cols-3 gap-1 text-center">
                {(["5D", "20D", "60D"] as const).map((window) => <div key={window}><div className="text-[11px] text-[#a8a193]">{window}</div><div className="font-mono text-[12px] font-bold" style={{ color: upDown(valueFor(row.values, window)) }}>{pct(valueFor(row.values, window))}</div></div>)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-lg bg-[#faf8f2] p-2.5 text-[12px] leading-relaxed text-[#7d766a]">
          国际折算参考 {d.theoretical.latest ? `${fmt(d.theoretical.latest.theoretical)} 元/克` : "—"}；Au99.99 {d.theoretical.latest?.au99 == null ? "—" : `${fmt(d.theoretical.latest.au99)} 元/克`}。{d.comparison.ruleText}
        </div>
      </ResponsiveDisclosure>
    </Card>
  );
}

function MobileDataProvenance({ data: d }: { data: DesignData }) {
  const latest = [...d.series].sort((a, b) => a.lastFetchedAt.localeCompare(b.lastFetchedAt)).at(-1)?.lastFetchedAt;
  return (
    <Card className="p-4 md:hidden">
      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <InvestorMetric label="数据状态" value="正常" valueColor={T.fav} />
        <InvestorMetric label="数据系列" value={`${d.series.length} 条`} />
      </div>
      <div className="mt-2 rounded-lg bg-[#faf8f2] px-3 py-2 text-[12px]"><span className="text-[#a8a193]">最近抓取</span><div className="mt-0.5 font-mono font-semibold text-[#575249]">{latest ? new Date(latest).toLocaleString("zh-CN", { hour12: false }) : "—"}</div></div>
      <ResponsiveDisclosure label="查看全部数据源">
        <div className="space-y-2">
          {d.series.map((series) => (
            <div key={series.name} className="rounded-lg border p-3" style={{ borderColor: T.border }}>
              <div className="font-medium text-[#2b2a26]">{series.name}{series.isProxy ? "（代理）" : ""}</div>
              <div className="mt-1 text-[12px] leading-relaxed text-[#7d766a]">{series.source}</div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[#a8a193]"><span>频率: {series.frequency}</span><span>最新: {series.lastObservationDate ?? "—"}</span><span className="col-span-2">抓取: {series.lastFetchedAt ? new Date(series.lastFetchedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}</span>{series.frequency === "quarterly" && <span className="col-span-2">低频数据，非日度</span>}</div>
            </div>
          ))}
        </div>
      </ResponsiveDisclosure>
      <p className="mt-2 text-[11px] leading-relaxed text-[#a8a193]">数据日期与抓取时间严格区分；全部为真实数据快照，无 Mock。</p>
    </Card>
  );
}

export default function RefinedV4Preview({ data: d, iconExists }: { data: DesignData; iconExists: boolean }) {
  const [openRules, setOpenRules] = useState<string | null>(null);
  const [showIntlDetail, setShowIntlDetail] = useState(false);
  const [showTempDetail, setShowTempDetail] = useState(false);
  const [chartTab, setChartTab] = useState("cn");

  const byId = (id: string) => (d.charts.find((c) => c.seriesId === id)?.points ?? []) as VPoint[];

  const macroReal = d.macros.find((m) => m.seriesId === "us10y_real");
  const macroDxy = d.macros.find((m) => m.seriesId === "dxy_proxy");
  const macroNominal = d.macros.find((m) => m.seriesId === "us10y_nominal");

  const tabs = [
    { id: "cn", label: "黄金与中国市场", charts: [
      { title: "黄金 XAU/USD", sub: "LBMA 定盘 · USD/oz", id: "gold_price", color: T.gold },
      { title: "Au99.99", sub: "上海黄金交易所 · 元/克", id: "au99_99", color: T.au99 },
      { title: "USD/CNY", sub: "人民币/美元", id: "usd_cny", color: T.usd },
      { title: "黄金ETF 518880", sub: "元/份", id: "cn_gold_etf_price", color: T.gold },
    ] },
    { id: "macro", label: "宏观环境", charts: [
      { title: "美元指数(代理)", sub: "FRED 广义美元指数", id: "dxy_proxy", color: T.usd },
      { title: "10Y 实际利率", sub: "核心指标 · %", id: "us10y_real", color: T.real },
      { title: "10Y 名义收益率", sub: "辅助确认 · %", id: "us10y_nominal", color: T.nominal },
      { title: "10Y 通胀预期", sub: "%", id: "us10y_breakeven", color: T.nominal },
    ] },
    { id: "flow", label: "资金与长期结构", charts: [
      { title: "全球黄金ETF持仓", sub: "吨 · 周频", id: "gold_etf_holdings", color: T.gold },
      { title: "全球ETF周度资金流", sub: "吨 · 正=流入", id: "gold_etf_flows", color: T.flow, bar: true },
      { title: "全球央行季度购金", sub: "吨 · 季度", id: "cb_gold_purchases", color: T.real, bar: true },
      { title: "中国央行黄金储备", sub: "吨 · 季度", id: "china_gold_reserves", color: T.au99 },
    ] },
  ];

  const compositeColor = d.temperature.composite.emoji === "🟢" ? T.fav : d.temperature.composite.emoji === "🔴" ? T.unfav : "#c98a2b";

  return (
    <div className="relative left-1/2 w-screen min-h-screen -translate-x-1/2 text-[#2b2a26]" style={{ background: T.bg }}>
      {/* ===== Header(品牌图标 + 站名 + 副标题 + 右侧状态) ===== */}
      <header className="border-b" style={{ borderColor: T.border, background: T.card }}>
        <div className="mx-auto max-w-[1700px] px-4 py-3 sm:px-5 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <div className="flex items-center gap-3">
              {iconExists ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/branding/gold-favicon.png" alt="黄金市场观察站" className="h-7 w-7 rounded-lg sm:h-8 sm:w-8" />
              ) : (
                <span className="text-xl font-bold" style={{ color: T.gold }}>◆</span>
              )}
              <div>
                <div className="flex items-baseline gap-2">
                  <h1 className="text-base font-bold tracking-wide text-[#2b2a26] sm:text-lg">黄金市场观察站</h1>
                  <span className="hidden text-[13px] tracking-wide text-[#a8a193] sm:inline">Gold Market Observatory</span>
                </div>
                {/* 副标题说明(用户指定保留) */}
                <p className="mt-0.5 hidden text-[13px] leading-relaxed text-[#7d766a] md:block">
                  黄金价格 · 美元 · 实际利率 · 美债收益率 · ETF资金流 · 央行购金 —— 真实数据，可解释，可运行
                </p>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 text-left text-[12px] text-[#7d766a] sm:w-auto sm:justify-end sm:text-right sm:text-[13px]">
              <span className="hidden sm:inline">
                当前 <span className="font-mono font-semibold text-[#2b2a26]">{new Date().toLocaleDateString("zh-CN")}</span>
              </span>
              <span>
                最近更新 <span className="font-mono font-semibold text-[#2b2a26]">{d.manifestGeneratedAt ? new Date(d.manifestGeneratedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5" style={{ background: "#e6f4ec", color: "#1e8e5a" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-[#1e8e5a]" /> 数据正常
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1700px] space-y-8 px-4 py-5 sm:px-5 lg:space-y-9 lg:px-10 lg:py-6">
        {/* ===== 第一屏: 左国际黄金(60%) / 右中国黄金(40%) ===== */}
        <section className="space-y-4">
          <SectionTitle k="01 · TODAY" t="今日黄金状态" sub="GLOBAL → CHINA → INVEST" />

          {/* 今日状态摘要在所有尺寸都先于三层市场信息 */}
          <div className="rounded-xl border px-4 py-3" style={{ background: "#f2eee3", borderColor: T.border }}>
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-semibold text-[#7d766a]">状态摘要:</span>
              <VerdictChip label="宏观环境" verdict={d.temperature.macro.verdict} />
              <VerdictChip label="资金环境" verdict={d.temperature.flow.verdict} />
              <VerdictChip label="长期结构" verdict={d.temperature.structure.verdict} />
              <VerdictChip label="黄金趋势" verdict={d.temperature.trend.verdict} trend />
              <span className="ml-1 text-[15px] font-bold" style={{ color: compositeColor }}>{d.temperature.composite.emoji} {d.temperature.composite.label}</span>
            </div>
            <p className="mt-1.5 text-[14px] leading-relaxed text-[#575249]">{d.temperature.composite.summary}</p>
            <p className="mt-1 text-[13px] text-[#7d766a]">判定来自明确规则(近5日/近4周/季度)，详见下方驱动面板；黄金趋势为结果变量，单独展示。</p>
          </div>

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5 lg:gap-5">
            {/* Mobile 用 contents 让两列子组件统一参与 order；Desktop 恢复 60/40 两列 */}
            <div className="contents lg:col-span-3 lg:flex lg:flex-col lg:gap-4">
              <div className="order-1 lg:order-1"><InternationalGoldSummary data={d} /></div>
              <div className="order-5 lg:order-2"><CoreGoldTrendChart data={d} /></div>
              <div className="order-6 lg:order-3">
                <MacroEnvironmentStrip dxy={macroDxy} real={macroReal} nominal={macroNominal} />
              </div>
            </div>

            <div className="contents lg:col-span-2 lg:flex lg:flex-col lg:gap-4">
              <div className="order-2 lg:order-1"><Au9999BenchmarkCard data={d} /></div>
              <div className="order-4 lg:order-2"><ChinaGoldAttributionCard data={d} /></div>
              <div className="order-3 lg:order-3"><CnEtfInvestorCard data={d} /></div>
              <div className="order-7 lg:order-4"><CnyTransmissionCard data={d} /></div>
            </div>
          </div>
        </section>

        {/* ===== 第二屏: 全球黄金 ETF / 资金环境 ===== */}
        <section>
          <SectionTitle k="02 · FLOW" t="全球黄金 ETF / 资金环境" sub="全球ETF为核心 · GLD为辅助确认" />
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            <div className="space-y-4">
              <Card className="p-4">
                <div className="text-[13px] font-semibold uppercase tracking-wider text-[#a8a193]">全球黄金ETF持仓<span className="ml-1.5 rounded px-1 py-px text-[13px]" style={{ background: T.goldSoft, color: T.gold }}>核心</span></div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="font-mono text-3xl font-bold text-[#2b2a26]">{fmt(d.etf.holdingsValue, 1)}</span>
                  <span className="text-[13px] text-[#7d766a]">吨</span>
                  {d.etf.holdingsChange4w !== null && (
                    <span className="font-mono text-sm" style={{ color: upDown(d.etf.holdingsChange4w) }}>
                      {d.etf.holdingsChange4w >= 0 ? "+" : ""}{fmt(d.etf.holdingsChange4w, 1)} 吨(近4周)
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[13px] text-[#a8a193]">{d.etf.holdingsDate} · 周频 · WGC</div>
              </Card>
              <Card className="p-4 opacity-90">
                <div className="text-[13px] font-semibold uppercase tracking-wider text-[#a8a193]">SPDR GLD 持仓<span className="ml-1.5 rounded px-1 py-px text-[13px]" style={{ background: "#e8f1fa", color: T.confirm }}>辅助确认</span></div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-bold text-[#2b2a26]">{fmt(d.etf.gldValue, 1)}</span>
                  <span className="text-[13px] text-[#7d766a]">吨</span>
                  {d.etf.gldChange20d !== null && (
                    <span className="font-mono text-sm" style={{ color: upDown(d.etf.gldChange20d) }}>
                      {d.etf.gldChange20d >= 0 ? "+" : ""}{fmt(d.etf.gldChange20d, 1)} 吨(近20日)
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[13px] text-[#a8a193]">{d.etf.gldDate} · 日频 · SPDR 官方(不代表全球总量)</div>
              </Card>
              <Card className="p-4">
                <div className="text-[13px] font-semibold uppercase tracking-wider text-[#a8a193]">全球ETF周度资金流</div>
                <div className="mt-1.5 flex gap-5 text-[13px]">
                  <span className="text-[#7d766a]">近4周 <b className="font-mono text-[#2b2a26]" style={{ color: upDown(d.etf.flowsSum4w) }}>{d.etf.flowsSum4w === null ? "—" : `${d.etf.flowsSum4w >= 0 ? "+" : ""}${fmt(d.etf.flowsSum4w, 1)} 吨`}</b></span>
                  <span className="text-[#7d766a]">近12周 <b className="font-mono text-[#2b2a26]" style={{ color: upDown(d.etf.flowsSum12w) }}>{d.etf.flowsSum12w === null ? "—" : `${d.etf.flowsSum12w >= 0 ? "+" : ""}${fmt(d.etf.flowsSum12w, 1)} 吨`}</b></span>
                </div>
                <div className="mt-2">
                  <V4AreaChart points={byId("gold_etf_flows")} color={T.flow} unit="吨" height={125} ranges={["3M", "6M", "1Y"]} bar />
                </div>
              </Card>
            </div>

            <div className="lg:hidden">
              <ResponsiveDisclosure label="查看全球ETF地区结构">
                <div className="space-y-3">
                  <Card className="p-3.5">
                    <div className="text-[13px] font-semibold uppercase tracking-wider text-[#a8a193]">当前结构 · 全球黄金ETF持仓分布</div>
                    <div className="mt-2"><V4Donut rows={d.etfRegional} /></div>
                  </Card>
                  <Card className="p-3.5">
                    <div className="text-[13px] font-semibold uppercase tracking-wider text-[#a8a193]">历史结构 · 各地区份额占比变化</div>
                    <div className="mt-2"><V4ShareStack rows={d.etfRegional} /></div>
                  </Card>
                </div>
              </ResponsiveDisclosure>
            </div>
            <div className="hidden grid-cols-2 gap-4 lg:col-span-2 lg:grid">
              <Card className="p-3.5">
                <div className="text-[13px] font-semibold uppercase tracking-wider text-[#a8a193]">当前结构 · 全球黄金ETF持仓分布</div>
                <div className="mt-2"><V4Donut rows={d.etfRegional} /></div>
              </Card>
              <Card className="p-3.5">
                <div className="text-[13px] font-semibold uppercase tracking-wider text-[#a8a193]">历史结构 · 各地区份额占比变化</div>
                <div className="mt-2"><V4ShareStack rows={d.etfRegional} /></div>
              </Card>
            </div>
          </div>
        </section>

        {/* ===== 第三屏: 长期结构(央行卡片: 名称/当前值+变化/日期来源 紧凑聚拢) ===== */}
        <section>
          <SectionTitle k="03 · CENTRAL BANKS" t="长期结构 · 央行购金" sub="季度数据 · 中长期需求观察" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Card className="p-4">
              <div className="max-w-md">
                <div className="text-base font-semibold text-[#2b2a26]">全球央行季度购金</div>
                <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-3xl font-bold text-[#2b2a26]">{fmt(d.structure.cbLatest, 1)} <span className="text-sm font-normal text-[#7d766a]">吨</span></span>
                  {d.structure.cbLatest !== null && d.structure.cbPrev !== null && (() => {
                    const qoq = d.structure.cbLatest! - d.structure.cbPrev!;
                    return (
                      <span className="font-mono text-sm font-semibold" style={{ color: qoq >= 0 ? T.fav : "#8a857a" }}>
                        较上一季度 {qoq >= 0 ? "+" : ""}{fmt(qoq, 1)} 吨
                      </span>
                    );
                  })()}
                </div>
                <div className="mt-1 text-[13px] text-[#7d766a]">{d.structure.cbDate} · 季度末 · 来源: WGC Gold Demand Trends</div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="max-w-md">
                <div className="text-base font-semibold text-[#2b2a26]">中国央行黄金储备</div>
                <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-3xl font-bold text-[#2b2a26]">{fmt(d.structure.chinaTonnes, 1)} <span className="text-sm font-normal text-[#7d766a]">吨</span></span>
                  {d.structure.chinaChange !== null && (
                    <span className="font-mono text-sm font-semibold" style={{ color: d.structure.chinaChange >= 0 ? T.fav : "#8a857a" }}>
                      较上一期 {d.structure.chinaChange >= 0 ? "+" : ""}{fmt(d.structure.chinaChange, 1)} 吨
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[13px] text-[#7d766a]">{d.structure.chinaDate} · 季度末 · 来源: WGC / IMF IFS</div>
              </div>
            </Card>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-[#a8a193]">
            央行购金增加/减少表示需求方向, 不使用证券"红涨绿跌"配色(增加=深绿强调, 减少=中性灰)。中国央行黄金储备(美元估值)已从首页降级隐藏——美元口径同时受持有量变化与金价变化影响, 判断央行是否继续买黄金以吨数为准; 底层数据仍保留在底部"数据来源与状态"表中。
          </p>
        </section>

        {/* ===== 第四屏: 驱动面板 & 市场温度(旧版盒状风格) ===== */}
        <section>
          <SectionTitle k="04 · DRIVERS" t="黄金驱动面板 & 市场温度" />
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-5">
            {/* 驱动面板(左3/5 ≈ 60%, 盒状条目) */}
            <div className="order-2 space-y-4 lg:order-1 lg:col-span-3 lg:space-y-5">
              {(["macro", "flow", "structure", "trend"] as const).map((layer) => {
                const rows = d.drivers.filter((r) => r.layer === layer);
                const label = rows[0]?.layerLabel ?? layer;
                return (
                  <div key={layer}>
                    <div className="mb-2 text-[13px] font-bold uppercase tracking-wider" style={{ color: T.gold }}>
                      {label}
                      {layer === "trend" && <span className="ml-2 font-normal normal-case text-[#a8a193]">(结果变量, 不参与驱动计分)</span>}
                    </div>
                    <div className="space-y-1.5 lg:space-y-2">
                      {rows.map((r) => {
                        const badge = stanceBadge(r.stance);
                        const open = openRules === r.layer + r.title;
                        return (
                          <div key={r.layer + r.title} className="rounded-lg border px-3 py-2.5 lg:px-4 lg:py-3" style={{ background: T.card, borderColor: T.border }}>
                            <div className="flex items-start gap-2.5 lg:gap-3">
                              <span className={`mt-0.5 inline-flex w-14 shrink-0 justify-center rounded px-1 py-0.5 text-[12px] font-bold lg:w-16 lg:text-[13px] ${badge.cls}`}>{badge.text}</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                                  <span className="text-sm font-semibold text-[#2b2a26] lg:text-base">{r.title}</span>
                                  <span className="text-[13px] text-[#4a463d] lg:text-[15px]">{r.behavior}</span>
                                  {r.isConfirmation && <span className="rounded px-1.5 py-px text-[13px]" style={{ background: "#e8f1fa", color: T.confirm }}>辅助确认</span>}
                                </div>
                                <div className="mt-1 text-[13px] text-[#5c564b] lg:text-sm">→ {r.implication}</div>
                                <div className="mt-1.5 hidden font-mono text-[13px] text-[#6b6459] lg:block">依据: {r.detail}</div>
                                <button type="button" onClick={() => setOpenRules(open ? null : r.layer + r.title)} className="mt-1 text-[13px] font-medium text-[#2f7fb8] hover:underline">
                                  {open ? "收起详细依据 ▲" : "查看详细依据 ▼"}
                                </button>
                                {open && <div className="mt-1.5 space-y-1.5 border-t pt-2 text-[13px] leading-relaxed text-[#6b6459]" style={{ borderColor: T.border }}><div className="font-mono lg:hidden">依据: {r.detail}</div><div>{ruleDescription(r)}</div></div>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 市场温度(右2/5 ≈ 40%, 摘要总览卡) */}
            <div className="order-1 space-y-4 lg:order-2 lg:col-span-2">
              <Card className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-semibold uppercase tracking-wider text-[#a8a193]">黄金市场温度</div>
                  <button type="button" onClick={() => setShowTempDetail((v) => !v)} className="shrink-0 text-[13px] font-medium text-[#2f7fb8] hover:underline">
                    {showTempDetail ? "收起判定依据 ▲" : "查看为什么得到这个判定 ▼"}
                  </button>
                </div>
                <div className="mt-2 text-2xl font-bold" style={{ color: compositeColor }}>
                  ● {d.temperature.composite.label}
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#575249]">{d.temperature.composite.summary}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    { l: "宏观环境", v: d.temperature.macro.verdict, c: verdictColor(d.temperature.macro.verdict) },
                    { l: "资金环境", v: d.temperature.flow.verdict, c: verdictColor(d.temperature.flow.verdict) },
                    { l: "长期结构", v: d.temperature.structure.verdict, c: verdictColor(d.temperature.structure.verdict) },
                    { l: "黄金趋势", v: d.temperature.trend.verdict, c: trendVerdictColor(d.temperature.trend.verdict) },
                  ].map((x) => (
                    <div key={x.l} className="rounded-lg border px-2.5 py-2" style={{ borderColor: T.border, background: "#faf8f2" }}>
                      <div className="text-[13px] text-[#a8a193]">{x.l}</div>
                      <div className="text-sm font-bold" style={{ color: x.c }}>{x.v}</div>
                    </div>
                  ))}
                </div>

                {showTempDetail && (
                  <div className="mt-4 space-y-4 border-t pt-3" style={{ borderColor: T.border }}>
                    <TempDim
                      title="宏观环境"
                      verdict={d.temperature.macro.verdict}
                      color={verdictColor(d.temperature.macro.verdict)}
                      timeScale={d.temperature.macro.timeScale}
                      ruleText={d.temperature.macro.ruleText}
                      core={d.temperature.macro.core}
                      confirmations={d.temperature.macro.confirmations}
                      note="实际利率是核心黄金指标；名义收益率仅作为辅助确认，不独立投票。"
                    />
                    <TempDim
                      title="资金环境"
                      verdict={d.temperature.flow.verdict}
                      color={verdictColor(d.temperature.flow.verdict)}
                      timeScale={d.temperature.flow.timeScale}
                      ruleText={d.temperature.flow.ruleText}
                      core={d.temperature.flow.core}
                      confirmations={d.temperature.flow.confirmations}
                      note="全球黄金ETF为资金核心；GLD作为代表性ETF辅助确认，不独立投票。"
                    />
                    <TempDim
                      title="长期结构"
                      verdict={d.temperature.structure.verdict}
                      color={verdictColor(d.temperature.structure.verdict)}
                      timeScale={d.temperature.structure.timeScale}
                      ruleText={d.temperature.structure.ruleText}
                      core={d.temperature.structure.core}
                      confirmations={d.temperature.structure.confirmations}
                      note="央行购金为季度低频数据，仅用于中长期需求观察，不解释当日行情。"
                    />
                    <TempDim
                      title="黄金趋势"
                      verdict={d.temperature.trend.verdict}
                      color={trendVerdictColor(d.temperature.trend.verdict)}
                      timeScale="近20个交易日"
                      ruleText={d.temperature.trend.ruleText}
                      core={[{ id: "trend", label: "黄金价格（近20日）", detail: d.temperature.trend.detail, favorable: d.temperature.trend.verdict === "上行" ? true : d.temperature.trend.verdict === "下行" ? false : null }]}
                      confirmations={[]}
                      note="黄金趋势是结果变量，只单独展示，不参与前三个驱动维度的评分。"
                    />
                    <div className="rounded-lg px-3 py-2.5" style={{ background: "#faf8f2", border: `1px solid ${T.border}` }}>
                      <div className="text-[13px] font-semibold text-[#2b2a26]">综合规则</div>
                      <p className="mt-1 text-[13px] leading-relaxed text-[#575249]">{d.temperature.composite.ruleText}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-[#7d766a]">
                        该评估仅用于观察驱动因素方向与共振情况，不构成投资建议。全部判定来自明确规则（lib/scoring/rules.ts），非 AI 判断。
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </section>

        {/* ===== 第五屏: 走势图 Tab 分组 ===== */}
        <section>
          <SectionTitle k="05 · CHARTS" t="走势图" sub="Tab 分组, 默认「黄金与中国市场」" />
          <div className="mb-3 flex flex-wrap gap-1.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setChartTab(t.id)}
                className={`rounded-full px-3.5 py-1 text-[13px] font-medium transition ${chartTab === t.id ? "bg-[#b07d2b] text-white" : "bg-white text-[#7d766a] hover:bg-[#f3ead8]"}`}
                style={{ border: `1px solid ${T.border}` }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {tabs.find((t) => t.id === chartTab)?.charts.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold text-[#2b2a26]">{c.title}</span>
                  <span className="text-[13px] text-[#a8a193]">{c.sub}</span>
                </div>
                <V4AreaChart points={byId(c.id)} color={c.color} unit="" height={180} defaultRange="6M" bar={c.bar} />
              </Card>
            ))}
          </div>
        </section>

        {/* ===== 第六屏: 国际 vs 国内黄金 ===== */}
        <section>
          <SectionTitle k="06 · INTL vs CN" t="国际黄金 vs 国内黄金" sub="国际金价 + 人民币汇率 → 国内人民币黄金表现" />
          <MobileIntlComparison data={d} />
          <div className="hidden grid-cols-1 items-start gap-5 md:grid lg:grid-cols-5">
            <Card className="p-5 lg:col-span-3">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b text-[13px] uppercase tracking-wider text-[#a8a193]" style={{ borderColor: T.border }}>
                    <th className="py-2 pr-3 font-normal">指标</th>
                    <th className="py-2 pr-3 text-right font-normal">近5日</th>
                    <th className="py-2 pr-3 text-right font-normal">近20日</th>
                    <th className="py-2 text-right font-normal">近60日</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "国际黄金 XAU/USD", sub: "LBMA 定盘 · USD/oz", r: d.comparison.gold },
                    { label: "Au99.99", sub: "上海黄金交易所 · 元/克", r: d.comparison.au99 },
                    { label: "USD/CNY", sub: "上升=人民币走弱", r: d.comparison.usdcny },
                  ].map((row) => (
                    <tr key={row.label} className="border-b" style={{ borderColor: "#f0ebe0" }}>
                      <td className="py-2 pr-3">
                        <div className="font-medium text-[#2b2a26]">{row.label}</div>
                        <div className="text-[13px] text-[#a8a193]">{row.sub}</div>
                      </td>
                      {[0, 1, 2].map((i) => (
                        <td key={i} className="py-2 pr-3 text-right font-mono text-[15px] font-bold" style={{ color: upDown(row.r[i]?.changePct) }}>
                          {pct(row.r[i]?.changePct)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 rounded-lg border-l-[3px] px-3 py-2.5 text-[13px] leading-relaxed" style={{ background: "#faf8f2", borderColor: T.gold, color: "#5c564b" }}>
                {d.comparison.explanation}
              </div>
              <button type="button" onClick={() => setShowIntlDetail((v) => !v)} className="mt-2 text-[13px] text-[#2f7fb8] hover:underline">
                {showIntlDetail ? "收起详细说明 ▲" : "展开详细说明 ▼"}
              </button>
              {showIntlDetail && (
                <div className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-[#a8a193]">
                  <p>{d.comparison.ruleText}</p>
                  <p>⚠️ 该模块用于理解"国际→汇率→国内"的传导关系，国内溢价/折价为研究观察，不构成套利信号、买卖信号或合理价格判断。</p>
                </div>
              )}
            </Card>
            <Card className="p-5 lg:col-span-2">
              <div className="text-[13px] font-semibold uppercase tracking-wider text-[#a8a193]">人民币理论折算参考值</div>
              {(() => {
                const l = d.theoretical.latest;
                return (
                  <div className="mt-3 space-y-2.5">
                    <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: T.border }}>
                      <span className="text-[13px] text-[#7d766a]">国际折算参考</span>
                      <span className="font-mono text-lg font-bold" style={{ color: T.usd }}>{l ? fmt(l.theoretical) : "—"} <span className="text-[13px] font-normal text-[#a8a193]">元/克</span></span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: T.border }}>
                      <span className="text-[13px] text-[#7d766a]">Au99.99 当日</span>
                      <span className="font-mono text-lg font-bold" style={{ color: T.au99 }}>{l?.au99 !== null && l?.au99 !== undefined ? fmt(l.au99) : "—"} <span className="text-[13px] font-normal text-[#a8a193]">元/克</span></span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-[#7d766a]">国内溢价 / 折价</span>
                      <span className="font-mono text-lg font-bold" style={{ color: upDown(l?.premiumPct ?? null) }}>{l?.premiumPct !== null && l?.premiumPct !== undefined ? pct(l.premiumPct) : "—"}</span>
                    </div>
                  </div>
                );
              })()}
              <p className="mt-3 border-t pt-2 text-[13px] leading-relaxed text-[#a8a193]" style={{ borderColor: T.border }}>
                理论折算参考值 = XAU/USD × USD/CNY ÷ 31.1035（元/克）。日度对齐、交易时段不同，仅作研究参考，不代表 Au99.99 合理价格。{d.theoretical.latest ? `对齐日 ${d.theoretical.latest.date}` : ""}
              </p>
            </Card>
          </div>
        </section>

        {/* ===== 底部: 数据来源与状态 ===== */}
        <section>
          <SectionTitle k="07 · DATA" t="数据来源与状态" />
          <MobileDataProvenance data={d} />
          <Card className="hidden overflow-x-auto p-4 md:block">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b text-[13px] uppercase tracking-wider text-[#a8a193]" style={{ borderColor: T.border }}>
                  <th className="py-2 pr-3 font-normal">数据系列</th>
                  <th className="py-2 pr-3 font-normal">来源</th>
                  <th className="py-2 pr-3 font-normal">频率</th>
                  <th className="py-2 pr-3 font-normal">最新数据日期</th>
                  <th className="py-2 pr-3 font-normal">最近抓取</th>
                  <th className="py-2 font-normal">备注</th>
                </tr>
              </thead>
              <tbody>
                {d.series.map((s) => (
                  <tr key={s.name} className="border-b" style={{ borderColor: "#f0ebe0" }}>
                    <td className="py-2 pr-3 font-medium text-[#2b2a26]">{s.name}{s.isProxy ? "（代理）" : ""}</td>
                    <td className="py-2 pr-3 text-[#7d766a]">{s.source}</td>
                    <td className="py-2 pr-3 text-[#7d766a]">{s.frequency}</td>
                    <td className="py-2 pr-3 font-mono text-[#7d766a]">{s.lastObservationDate}</td>
                    <td className="py-2 pr-3 font-mono text-[#7d766a]">{new Date(s.lastFetchedAt).toLocaleString("zh-CN", { hour12: false })}</td>
                    <td className="py-2 text-[#a8a193]">{s.frequency === "quarterly" ? "低频, 非日度" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[13px] leading-relaxed text-[#a8a193]">
              数据日期(observation_date)与程序抓取时间(fetched_at)严格区分；低频数据(季度)不会显示为日度。全部为真实数据快照，无 Mock。
            </p>
          </Card>
        </section>

        <footer className="border-t pt-3 text-[13px] leading-relaxed text-[#a8a193]" style={{ borderColor: T.border }}>
          黄金市场观察站 · Gold Market Observatory · 设计预览 refined-v4（独立于正式首页）。所有数据、评分仅用于观察黄金驱动因素，不构成投资建议。
        </footer>
      </main>
    </div>
  );
}

/* ---------- 小组件 ---------- */

function VerdictChip({ label, verdict, trend }: { label: string; verdict: string; trend?: boolean }) {
  const favorable = ["偏利多", "偏流入", "偏支持"].includes(verdict);
  const unfavorable = ["偏利空", "偏流出", "偏弱"].includes(verdict);
  let c = T.faint;
  if (trend) c = verdict === "上行" ? T.up : verdict === "下行" ? T.down : T.faint;
  else if (favorable) c = T.fav;
  else if (unfavorable) c = T.unfav;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5" style={{ background: T.card, borderColor: T.border }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      <span style={{ color: c }}>{label} {verdict}</span>
    </span>
  );
}

function stanceBadge(stance: string): { text: string; cls: string } {
  switch (stance) {
    case "favorable":
      return { text: "利多", cls: "bg-[#e6f4ec] text-[#1e8e5a]" };
    case "unfavorable":
      return { text: "利空", cls: "bg-[#fbe9e9] text-[#d64545]" };
    case "confirm":
      return { text: "确认", cls: "bg-[#e8f1fa] text-[#2f7fb8]" };
    case "neutral":
      return { text: "中性", cls: "bg-[#f0ede6] text-[#7d766a]" };
    default:
      return { text: "数据不足", cls: "bg-[#f0ede6] text-[#a8a193]" };
  }
}

function verdictColor(v: string): string {
  if (["偏利多", "偏流入", "偏支持"].includes(v)) return T.fav;
  if (["偏利空", "偏流出", "偏弱"].includes(v)) return T.unfav;
  return T.muted;
}

function trendVerdictColor(v: string): string {
  if (v === "上行") return T.up;
  if (v === "下行") return T.down;
  return T.muted;
}

/** 温度展开: 单个维度的完整判定依据 */
function TempDim({ title, verdict, color, timeScale, ruleText, core, confirmations, note }: {
  title: string;
  verdict: string;
  color: string;
  timeScale: string;
  ruleText: string;
  core: Array<{ id: string; label: string; detail: string; favorable: boolean | null }>;
  confirmations: Array<{ id: string; label: string; detail: string; agrees: boolean | null; note: string }>;
  note?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-bold text-[#2b2a26]">{title}：<span style={{ color }}>{verdict}</span></span>
        <span className="text-[13px] text-[#8a857a]">（观察: {timeScale}）</span>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-[#6b6459]">{ruleText}</p>
      <div className="mt-1.5 space-y-1">
        {core.map((c) => (
          <div key={c.id} className="flex items-start gap-2 text-[13px]">
            <span className="mt-px shrink-0 font-bold" style={{ color: c.favorable === true ? T.fav : c.favorable === false ? T.unfav : "#a8a193" }}>
              {c.favorable === true ? "✓" : c.favorable === false ? "✗" : "·"}
            </span>
            <div>
              <span className="font-medium text-[#2b2a26]">{c.label}</span>
              <span className="ml-2 font-mono text-[#575249]">{c.detail}</span>
            </div>
          </div>
        ))}
        {confirmations.map((cf) => (
          <div key={cf.id} className="flex items-start gap-2 text-[13px]">
            <span className="mt-px shrink-0" style={{ color: cf.agrees === true ? T.confirm : cf.agrees === false ? "#d98e3f" : "#a8a193" }}>
              {cf.agrees === true ? "◉" : cf.agrees === false ? "◌" : "·"}
            </span>
            <div>
              <span className="font-medium text-[#575249]">{cf.label}</span>
              <span className="ml-1 rounded px-1 py-px text-[13px]" style={{ background: "#e8f1fa", color: T.confirm }}>辅助确认, 不投票</span>
              <span className="ml-2 font-mono text-[#575249]">{cf.detail}</span>
              <span className="ml-2 text-[13px] text-[#8a857a]">{cf.note}</span>
            </div>
          </div>
        ))}
      </div>
      {note && <p className="mt-1.5 text-[13px] leading-relaxed text-[#7d766a]">{note}</p>}
    </div>
  );
}

/** 驱动项展开时的规则说明(refined-v4 本地生成, 不改共享数据层) */
function ruleDescription(r: { layer: string; title: string; isConfirmation: boolean }): string {
  if (r.isConfirmation) {
    return "本行为辅助确认指标, 不独立投票, 仅用于与核心指标交叉验证方向。";
  }
  switch (r.layer) {
    case "macro":
      return r.title.includes("美元")
        ? "观察时间尺度: 近5个交易日(美元指数代理)。美元走弱通常会降低非美货币投资者购买美元计价黄金的成本, 对黄金环境相对有利。注意: 这仅是相关市场因素观察, 不是因果断言。"
        : "观察时间尺度: 近5个交易日。黄金本身不产生利息, 实际利率下降通常意味着持有黄金的机会成本下降, 对黄金环境相对有利。注意: 这仅是相关市场因素观察, 不是因果断言。";
    case "flow":
      return r.title.includes("GLD")
        ? "观察时间尺度: 近20个交易日。GLD 是全球黄金ETF的重要组成部分, 故本行为辅助确认指标, 不独立投票; 注意 GLD 为代表性ETF, 不等于全球ETF总量。"
        : "观察时间尺度: 近4周(全球黄金ETF周度资金流合计, WGC)。投资资金进入黄金, 说明资金面对黄金偏有利; 资金流为周频数据, 不与日频指标直接比较。";
    case "structure":
      return r.title.includes("中国")
        ? "观察时间尺度: 季度(WGC/IMF IFS, 依据人民银行官方储备资产)。中国央行增持是亚太央行购金趋势的重要观察点。"
        : "观察时间尺度: 季度(WGC Gold Demand Trends)。央行购金是黄金中长期结构性需求, 不应用来解释当日行情。";
    default:
      return "观察时间尺度: 近20个有效观测。黄金趋势为结果变量, 单独展示, 不参与驱动计分(避免'因为黄金涨所以环境强'的循环解释)。";
  }
}
