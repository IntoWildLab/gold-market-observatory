"use client";

import { useState } from "react";
import type { DesignData } from "@/lib/design-data";
import { V4AreaChart, V4Donut, V4ShareStack, V4Compare, type VPoint } from "./charts/V4Chart";
import { fmtNumber } from "@/lib/format";

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

export default function RefinedV4Preview({ data: d, iconExists }: { data: DesignData; iconExists: boolean }) {
  const [openRules, setOpenRules] = useState<string | null>(null);
  const [showIntlDetail, setShowIntlDetail] = useState(false);
  const [showTempDetail, setShowTempDetail] = useState(false);
  const [chartTab, setChartTab] = useState("cn");

  const goldPoints = (d.charts.find((c) => c.seriesId === "gold_price")?.points ?? []) as VPoint[];
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
        <div className="mx-auto max-w-[1700px] px-5 py-3.5 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <div className="flex items-center gap-3">
              {iconExists ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/branding/gold-favicon.png" alt="黄金市场观察站" className="h-8 w-8 rounded-lg" />
              ) : (
                <span className="text-xl font-bold" style={{ color: T.gold }}>◆</span>
              )}
              <div>
                <div className="flex items-baseline gap-2">
                  <h1 className="text-lg font-bold tracking-wide text-[#2b2a26]">黄金市场观察站</h1>
                  <span className="text-[13px] tracking-wide text-[#a8a193]">Gold Market Observatory</span>
                </div>
                {/* 副标题说明(用户指定保留) */}
                <p className="mt-0.5 text-[13px] leading-relaxed text-[#7d766a]">
                  黄金价格 · 美元 · 实际利率 · 美债收益率 · ETF资金流 · 央行购金 —— 真实数据，可解释，可运行
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 text-right text-[13px] text-[#7d766a]">
              <span>
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

      <main className="mx-auto max-w-[1700px] space-y-9 px-5 py-6 lg:px-10">
        {/* ===== 第一屏: 左国际黄金(60%) / 右中国黄金(40%) ===== */}
        <section className="space-y-4">
          <SectionTitle k="01 · TODAY" t="核心市场概览" sub="国际黄金 + 中国黄金" />

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-5">
            {/* 左: 国际黄金(略缩图, 让位右栏) */}
            <Card className="p-5 lg:col-span-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-[#2b2a26]">国际黄金 XAU/USD</span>
                    <span className="rounded px-1.5 py-px text-[13px]" style={{ background: T.goldSoft, color: T.gold }}>现货</span>
                    <span className="rounded px-1.5 py-px text-[13px]" style={{ background: "#f0ede6", color: T.muted }}>历史: LBMA 定盘</span>
                  </div>
                  <div className="mt-1 text-[13px] text-[#a8a193]">{d.gold.latestSpot?.as_of_date ?? ""} · {d.gold.latestSpot?.source.name ?? ""}</div>
                </div>
                <div className="text-right text-[13px] text-[#a8a193]">
                  <div>一年位置: <b className="font-mono text-[#2b2a26]">{d.gold.yearPos.label}</b> ({d.gold.yearPos.percentile?.toFixed(0)}%)</div>
                  <div>趋势: <b className="font-mono" style={{ color: d.gold.trend.changePct === null ? T.faint : d.gold.trend.changePct >= 0 ? T.up : T.down }}>{d.gold.trend.label}</b></div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-1">
                <span className="font-mono text-5xl font-bold leading-none" style={{ color: T.gold }}>{fmt(d.gold.latestSpot?.price_usd)}</span>
                <span className="mb-1 font-mono text-xl font-bold" style={{ color: upDown(d.gold.dailyChangePct) }}>
                  {d.gold.dailyChangePct !== null && `${d.gold.dailyChangePct >= 0 ? "▲" : "▼"} ${pct(d.gold.dailyChangePct)}`}
                </span>
                <div className="mb-1 ml-auto flex gap-4">
                  {d.gold.periodReturns.map((r) => (
                    <div key={r.window} className="text-center">
                      <div className="text-[13px] uppercase tracking-wider text-[#a8a193]">{r.window === "1D" ? "当日" : r.label}</div>
                      <div className="font-mono text-base font-bold" style={{ color: upDown(r.changePct) }}>{pct(r.changePct)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 宏观三指标(内联紧凑) */}
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t pt-2.5" style={{ borderColor: T.border }}>
                <span className="text-[13px] text-[#7d766a]">
                  美元指数 <b className="font-mono text-[#2b2a26]">{fmt(macroDxy?.value)}</b>
                  <span className="ml-1 font-mono" style={{ color: upDown(macroDxy?.change) }}>{macroDxy?.changeLabel ?? "—"}</span>
                  <span className="ml-1 text-[13px] text-[#a8a193]">(代理)</span>
                </span>
                <span className="text-[13px] text-[#7d766a]">
                  10Y实际利率 <b className="font-mono text-[#2b2a26]">{fmt(macroReal?.value)}%</b>
                  <span className="ml-1 font-mono" style={{ color: upDown(macroReal?.change) }}>{macroReal?.changeLabel ?? "—"}</span>
                  <span className="ml-1 rounded px-1 text-[13px]" style={{ background: "#efe9fb", color: T.real }}>核心</span>
                </span>
                <span className="text-[13px] text-[#7d766a]">
                  10Y名义 <b className="font-mono text-[#8a857a]">{fmt(macroNominal?.value)}%</b>
                  <span className="ml-1 rounded px-1 text-[13px]" style={{ background: "#f0ede6", color: T.muted }}>辅助确认</span>
                </span>
              </div>

              {/* 国际金价主图(略缩, 仍清晰) */}
              <div className="mt-3">
                <V4AreaChart points={goldPoints} color={T.gold} unit="USD/oz" height={230} defaultRange="1Y" />
              </div>
            </Card>

            {/* 右: 中国黄金(旧版三卡片风格) */}
            <div className="space-y-4 lg:col-span-2">
              <div className="text-[13px] font-semibold uppercase tracking-wider text-[#a8a193]">中国黄金 · 人民币计价</div>
              <ChinaCard
                title="Au99.99"
                tag="上海黄金交易所"
                value={fmt(d.china.au99.value, 2)}
                unit="元/克"
                daily={d.china.au99.returns[0]?.changePct ?? null}
                date={d.china.au99.date ?? ""}
                returns={d.china.au99.returns}
                source="WGC 汇编自 SGE"
                note="国内人民币金价参考, 非'国内版 XAU/USD'"
                color={T.au99}
              />
              <ChinaCard
                title="USD/CNY"
                tag="美联储 H.10"
                value={fmt(d.china.usdcny.value, 4)}
                unit="人民币/美元"
                daily={d.china.usdcny.changePct ?? null}
                date={d.china.usdcny.date ?? ""}
                returns={d.china.usdcny.returns}
                source="FRED DEXCHUS"
                note="上升 = 人民币相对美元走弱"
                color={T.usd}
              />
              <ChinaCard
                title="黄金ETF 518880"
                tag="华安"
                value={fmt(d.china.etf.price, 3)}
                unit="元/份"
                daily={d.china.etf.dailyChangePct ?? null}
                date={d.china.etf.date ?? ""}
                returns={d.china.etf.returns}
                source="腾讯行情(上交所)"
                note={`份额 ${fmt(d.china.etf.sharesValue, 2)} 亿份(${d.china.etf.sharesDate}, 季度披露) · 非推荐`}
                color={T.au99}
              />
            </div>
          </div>

          {/* 状态摘要(清爽) */}
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
        </section>

        {/* ===== 第二屏: 全球黄金 ETF / 资金环境 ===== */}
        <section>
          <SectionTitle k="02 · FLOW" t="全球黄金 ETF / 资金环境" sub="全球ETF为核心 · GLD为辅助确认" />
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
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
                  <V4AreaChart points={byId("gold_etf_flows")} color={T.flow} unit="吨" height={140} ranges={["3M", "6M", "1Y"]} bar />
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 lg:col-span-2">
              <Card className="p-4">
                <div className="text-[13px] font-semibold uppercase tracking-wider text-[#a8a193]">当前结构 · 全球黄金ETF持仓分布</div>
                <div className="mt-3"><V4Donut rows={d.etfRegional} /></div>
              </Card>
              <Card className="p-4">
                <div className="text-[13px] font-semibold uppercase tracking-wider text-[#a8a193]">历史结构 · 各地区份额占比变化</div>
                <div className="mt-3"><V4ShareStack rows={d.etfRegional} /></div>
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
            <div className="space-y-5 lg:col-span-3">
              {(["macro", "flow", "structure", "trend"] as const).map((layer) => {
                const rows = d.drivers.filter((r) => r.layer === layer);
                const label = rows[0]?.layerLabel ?? layer;
                return (
                  <div key={layer}>
                    <div className="mb-2 text-[13px] font-bold uppercase tracking-wider" style={{ color: T.gold }}>
                      {label}
                      {layer === "trend" && <span className="ml-2 font-normal normal-case text-[#a8a193]">(结果变量, 不参与驱动计分)</span>}
                    </div>
                    <div className="space-y-2">
                      {rows.map((r) => {
                        const badge = stanceBadge(r.stance);
                        const open = openRules === r.layer + r.title;
                        return (
                          <div key={r.layer + r.title} className="rounded-lg border px-4 py-3" style={{ background: T.card, borderColor: T.border }}>
                            <div className="flex items-start gap-3">
                              <span className={`mt-0.5 inline-flex w-16 shrink-0 justify-center rounded px-1 py-0.5 text-[13px] font-bold ${badge.cls}`}>{badge.text}</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                                  <span className="text-base font-semibold text-[#2b2a26]">{r.title}</span>
                                  <span className="text-[15px] text-[#4a463d]">{r.behavior}</span>
                                  {r.isConfirmation && <span className="rounded px-1.5 py-px text-[13px]" style={{ background: "#e8f1fa", color: T.confirm }}>辅助确认</span>}
                                </div>
                                <div className="mt-1 text-sm text-[#5c564b]">→ {r.implication}</div>
                                <div className="mt-1.5 font-mono text-[13px] text-[#6b6459]">依据: {r.detail}</div>
                                <button type="button" onClick={() => setOpenRules(open ? null : r.layer + r.title)} className="mt-1 text-[13px] font-medium text-[#2f7fb8] hover:underline">
                                  {open ? "收起说明 ▲" : "查看规则说明 ▼"}
                                </button>
                                {open && <div className="mt-1.5 border-t pt-2 text-[13px] leading-relaxed text-[#6b6459]" style={{ borderColor: T.border }}>{ruleDescription(r)}</div>}
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
            <div className="space-y-4 lg:col-span-2">
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
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-5">
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
          <Card className="overflow-x-auto p-4">
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

function ChinaCard({ title, tag, value, unit, daily, date, returns, source, note, color }: {
  title: string; tag: string; value: string; unit: string; daily: number | null; date: string;
  returns: Array<{ window: string; changePct: number | null }>; source: string; note?: string; color: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-[#2b2a26]">{title}</span>
          <span className="rounded px-1.5 py-px text-[13px]" style={{ background: "#f0ede6", color: T.muted }}>{tag}</span>
        </div>
        <span className="text-[13px] text-[#a8a193]">{date}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-bold" style={{ color }}>{value}</span>
        <span className="text-[13px] text-[#7d766a]">{unit}</span>
        <span className="ml-auto font-mono text-lg font-bold" style={{ color: upDown(daily) }}>{pct(daily)}</span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 border-t pt-2" style={{ borderColor: T.border }}>
        {returns.map((r) => (
          <div key={r.window} className="text-center">
            <div className="text-[13px] uppercase tracking-wider text-[#a8a193]">{r.window === "1D" ? "当日" : r.window === "5D" ? "5日" : r.window === "20D" ? "20日" : "60日"}</div>
            <div className="font-mono text-[15px] font-bold" style={{ color: upDown(r.changePct) }}>{pct(r.changePct)}</div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 text-[13px] text-[#a8a193]">
        {note && <span className="mr-2">{note}</span>}来源: {source}
      </div>
    </Card>
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
