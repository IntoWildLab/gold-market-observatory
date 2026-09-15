"use client";

import type { DesignData, WhatChangedView } from "@/lib/design-data";
import { formatShanghaiDateTime } from "@/lib/date-format";
import CosmicCoreChart from "./CosmicCoreChart";

const C = {
  canvas: "#060c18",
  plane: "#091222",
  primary: "#0d182b",
  elevated: "#101d32",
  chart: "#08111f",
  line: "#1b2941",
  lineStrong: "#2b3b59",
  text: "#edf2fb",
  textSoft: "#bac6d9",
  muted: "#8291aa",
  faint: "#5f708d",
  blue: "#69a7ff",
  violet: "#8175c9",
  gold: "#d7ad58",
  up: "#f06469",
  down: "#43bd83",
  caution: "#d2a75c",
};

const fmt = (value: number | null | undefined, digits = 2) => value == null
  ? "—"
  : value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const pct = (value: number | null | undefined) => value == null
  ? "—"
  : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

const directionColor = (value: number | null | undefined) => value == null
  ? C.muted
  : value > 0
    ? C.up
    : value < 0
      ? C.down
      : C.muted;

const changeArrow = (direction: WhatChangedView["goldMove"]["direction"]) => direction === "up" ? "↑" : direction === "down" ? "↓" : "→";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-medium text-[#7f91ae]">{children}</div>;
}

function AvailabilityMark({ data }: { data: DesignData }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1 border-t border-[#18253c] pt-3 text-xs text-[#71819d] sm:border-0 sm:pt-0 sm:text-right">
      <span>数据更新</span>
      <span className="font-mono text-[#bdc9dc]">{formatShanghaiDateTime(data.manifestGeneratedAt)}</span>
      <span className="inline-flex items-center gap-2 text-[#73c49d]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#43bd83]" aria-hidden="true" />
        数据正常
      </span>
    </div>
  );
}

function TodayObservation({ data }: { data: DesignData }) {
  const return20 = data.gold.periodReturns.find((item) => item.window === "20D")?.changePct ?? null;
  const price = data.gold.latestSpot?.price_usd ?? data.gold.fixValue;
  const priceDate = data.gold.latestSpot?.as_of_date ?? data.gold.fixDate;
  const composite = data.temperature.composite;

  return (
    <section aria-labelledby="today-heading" className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(19rem,0.6fr)] lg:items-stretch">
      <div className="relative overflow-hidden rounded-[18px] border border-[#263754] bg-[#0d182b] px-5 py-5 sm:px-7 sm:py-6 lg:px-8 lg:py-7">
        <div className="pointer-events-none absolute -right-20 -top-32 h-72 w-72 rounded-full bg-[#284d83]/[0.14] blur-3xl" aria-hidden="true" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[#d7ad58]" aria-hidden="true" />
              <SectionLabel>当前黄金观察</SectionLabel>
            </div>
            <span className="font-mono text-xs text-[#71819d]">数据日 {priceDate ?? "—"}</span>
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-2">
            <div>
              <h2 id="today-heading" className="text-base font-medium text-[#dce5f3]">国际黄金 XAU/USD</h2>
              <div className="mt-2 font-mono text-[2.7rem] font-semibold leading-none tracking-[-0.035em] text-[#f0d28c] sm:text-[3.35rem] lg:text-[4rem]">
                {fmt(price)}
              </div>
            </div>
            <div className="mb-1 flex items-baseline gap-2 font-mono text-base font-semibold sm:text-lg" style={{ color: directionColor(data.gold.dailyChangePct) }}>
              <span>{data.gold.dailyChangePct == null ? "" : data.gold.dailyChangePct >= 0 ? "▲" : "▼"}</span>
              <span>{pct(data.gold.dailyChangePct)}</span>
              <span className="text-xs font-normal text-[#667791]">USD/oz</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 border-t border-[#25344e] pt-4">
            <Metric label="近20日" value={pct(return20)} color={directionColor(return20)} />
            <Metric label="趋势" value={data.gold.trend.label} />
            <Metric label="一年位置" value={`${data.gold.yearPos.label}${data.gold.yearPos.percentile == null ? "" : ` ${data.gold.yearPos.percentile.toFixed(0)}%`}`} />
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-[18px] bg-[#0a1425] px-5 py-5 ring-1 ring-inset ring-[#1b2941] sm:px-6 sm:py-6">
        <div>
          <SectionLabel>今日状态</SectionLabel>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-[#e9eef8]">{composite.label}</span>
            <span className="text-xs text-[#72839f]">规则判定</span>
          </div>
          <p className="mt-3 max-w-[46ch] text-sm leading-6 text-[#9dacc2]">{composite.summary}</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-[#1a2840] pt-4 text-xs">
          <StatusLine label="宏观" value={data.temperature.macro.verdict} />
          <StatusLine label="资金" value={data.temperature.flow.verdict} />
          <StatusLine label="结构" value={data.temperature.structure.verdict} />
          <StatusLine label="趋势" value={data.temperature.trend.verdict} />
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, color = C.textSoft }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0 px-2 first:pl-0 last:pr-0 sm:px-4">
      <div className="text-[11px] text-[#687994]">{label}</div>
      <div className="mt-1 truncate font-mono text-sm font-medium" style={{ color }}>{value}</div>
    </div>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[#687994]">{label}</span>
      <span className="font-medium text-[#bdc8d9]">{value}</span>
    </div>
  );
}

function WhatChanged({ view }: { view: DesignData["whatChanged"] }) {
  const moveColor = view.goldMove.direction === "up" ? C.up : view.goldMove.direction === "down" ? C.down : C.textSoft;
  const evidenceValue = (item: typeof view.evidence[number]) => `${item.change >= 0 ? "+" : ""}${item.change.toFixed(item.unit === "bp" ? 0 : 2)}${item.unit}`;

  return (
    <section aria-labelledby="what-changed-heading" className="overflow-hidden rounded-[18px] border border-[#1e2d47] bg-[#091424]/90">
      <div className="grid lg:grid-cols-[minmax(15rem,0.86fr)_minmax(20rem,1.35fr)_minmax(15rem,0.79fr)]">
        <div className="px-5 py-5 sm:px-6 sm:py-6 lg:border-r lg:border-[#1b2941] lg:px-7">
          <div className="flex items-center gap-3">
            <SectionLabel>What Changed</SectionLabel>
            {view.availability === "partial" && <span className="rounded bg-[#2a2419] px-2 py-0.5 text-[10px] text-[#d2a75c]">部分证据</span>}
          </div>
          <h2 id="what-changed-heading" className="mt-4 text-2xl font-semibold leading-tight text-[#eef3fb]">{view.goldMove.description}</h2>
          <div className="mt-2 font-mono text-base font-semibold" style={{ color: moveColor }}>
            {view.goldMove.changePct == null ? "近1日 —" : `${view.goldMove.window} ${changeArrow(view.goldMove.direction)} ${pct(view.goldMove.changePct)}`}
          </div>
          <div className="mt-2 font-mono text-xs text-[#667792]">数据日 {view.goldMove.endDate ?? "—"}</div>
        </div>

        <div className="border-t border-[#1b2941] px-5 py-5 sm:px-6 lg:border-t-0 lg:px-7 lg:py-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-medium text-[#c7d1e1]">直接证据</div>
            <div className="text-[11px] text-[#657691]">近5个有效观测</div>
          </div>
          <div className="mt-4 divide-y divide-[#18263d]">
            {view.evidence.length ? view.evidence.map((item) => (
              <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <span className="text-sm text-[#b8c4d6]">{item.label}</span>
                  <span className="ml-2 text-[11px] text-[#60718c]">{item.auxiliary ? "辅助确认" : "核心"}</span>
                  {item.stale && <span className="ml-2 text-[11px] text-[#d2a75c]">更新较慢</span>}
                </div>
                <div className="font-mono text-sm font-semibold text-[#e1e8f3]">
                  {changeArrow(item.direction)} {evidenceValue(item)}
                </div>
              </div>
            )) : <p className="text-sm text-[#8291aa]">宏观变化数据不足</p>}
          </div>
        </div>

        <div className="grid border-t border-[#1b2941] lg:border-t-0">
          <div className="px-5 py-5 sm:px-6 lg:px-7 lg:py-6">
            <div className="text-xs text-[#687994]">当前环境</div>
            <div className="mt-2 text-base font-medium text-[#d8e0ec]">{view.environment.label}</div>
            <p className="mt-2 max-w-[48ch] text-[13px] leading-5 text-[#8fa0b9]">{view.environment.explanation}</p>
          </div>
          <div className="border-t border-[#1b2941] bg-[#0b1628] px-5 py-4 sm:px-6 lg:px-7">
            <div className="text-[11px] text-[#687994]">下一观察点</div>
            <div className="mt-1 text-[13px] leading-5 text-[#aebbd0]">{view.nextWatch.label}</div>
          </div>
        </div>
      </div>
      <p className="border-t border-[#17243a] px-5 py-3 text-[10px] text-[#5f708b] sm:px-6 lg:px-7">{view.disclaimer}</p>
    </section>
  );
}

function Transmission({ data }: { data: DesignData }) {
  const auDaily = data.china.au99.returns.find((item) => item.window === "1D")?.changePct ?? null;
  const assets = [
    {
      stage: "GLOBAL",
      title: "XAU/USD",
      role: "全球黄金价格锚",
      value: fmt(data.gold.latestSpot?.price_usd ?? data.gold.fixValue),
      unit: "USD/oz",
      change: data.gold.dailyChangePct,
      date: data.gold.latestSpot?.as_of_date ?? data.gold.fixDate,
      primary: true,
    },
    {
      stage: "CHINA",
      title: "Au99.99",
      role: "人民币黄金基准",
      value: fmt(data.china.au99.value),
      unit: "元/克",
      change: auDaily,
      date: data.china.au99.date,
      primary: false,
    },
    {
      stage: "INVEST",
      title: "518880",
      role: "中国投资工具窗口",
      value: fmt(data.invest.chinaGoldEtf.market_close, 3),
      unit: "元/份",
      change: data.invest.chinaGoldEtf.daily_return_pct,
      date: data.invest.chinaGoldEtf.market_close_date,
      primary: false,
    },
  ];

  return (
    <section aria-labelledby="transmission-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <SectionLabel>市场传导</SectionLabel>
          <h2 id="transmission-heading" className="mt-1 text-xl font-semibold text-[#e7edf7]">Global → China → Invest</h2>
        </div>
        <p className="max-w-[54ch] text-right text-xs leading-5 text-[#6f809c]">不同市场的日期、交易时段与角色不同；本链用于观察传导，不构成套利或买卖信号。</p>
      </div>

      <div className="overflow-hidden rounded-[18px] bg-[#091323] ring-1 ring-inset ring-[#1b2941] lg:grid lg:grid-cols-[1.2fr_1fr_1fr]">
        {assets.map((asset, index) => (
          <div key={asset.stage} className={`relative px-5 py-5 sm:px-6 lg:px-7 lg:py-6 ${index ? "border-t border-[#1b2941] lg:border-l lg:border-t-0" : ""}`}>
            {index > 0 && <span className="absolute -left-2.5 top-7 hidden h-5 w-5 items-center justify-center rounded-full bg-[#101e33] font-mono text-xs text-[#69a7ff] ring-1 ring-inset ring-[#2b4165] lg:flex" aria-hidden="true">›</span>}
            <div className="flex items-center justify-between gap-3">
              <span className={`text-[11px] font-medium ${asset.primary ? "text-[#d7ad58]" : "text-[#69a7ff]"}`}>{asset.stage}</span>
              <span className="font-mono text-[11px] text-[#60718c]">{asset.date ?? "—"}</span>
            </div>
            <div className="mt-4 flex items-baseline justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-[#e6edf7]">{asset.title}</div>
                <div className="mt-1 text-xs text-[#73849f]">{asset.role}</div>
              </div>
              <span className="font-mono text-sm font-semibold" style={{ color: directionColor(asset.change) }}>{pct(asset.change)}</span>
            </div>
            <div className="mt-5 flex items-baseline gap-2">
              <span className={`font-mono text-2xl font-semibold ${asset.primary ? "text-[#f0d28c]" : "text-[#d9e2ef]"}`}>{asset.value}</span>
              <span className="text-xs text-[#657691]">{asset.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatEventTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "时间待确认";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${get("month")} ${get("day")} · ${get("hour")}:${get("minute")} ET`;
}

function eventDistance(scheduledAt: string, now: string) {
  const minutes = Math.max(0, Math.ceil((Date.parse(scheduledAt) - Date.parse(now)) / 60_000));
  if (!Number.isFinite(minutes) || minutes <= 0) return "NOW";
  if (minutes < 120) return `${minutes}M`;
  const hours = Math.ceil(minutes / 60);
  return hours < 48 ? `${hours}H` : `${Math.round(hours / 24)}D`;
}

function EventRisk({ data }: { data: DesignData }) {
  const risk = data.eventRisk;
  const event = risk.nearestEvent;

  return (
    <aside aria-labelledby="event-risk-heading" className="border-l-2 border-[#4f82c8] bg-[#091526] px-5 py-4 sm:px-6 lg:grid lg:grid-cols-[10rem_minmax(0,1fr)_auto] lg:items-center lg:gap-6 lg:px-7">
      <div>
        <div id="event-risk-heading" className="text-xs font-medium text-[#81aff0]">Event Risk · 72H</div>
        <div className="mt-1 text-[11px] text-[#647590]">独立风险观察</div>
      </div>
      {event ? (
        <>
          <div className="mt-3 min-w-0 lg:mt-0">
            <div className="text-sm font-medium text-[#dce5f2] sm:text-base">{event.title}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#73849e]">
              <span className="font-mono">{formatEventTime(event.scheduledAt)}</span>
              <span>{event.impact.toUpperCase()} IMPACT</span>
              <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="text-[#7eb0f5] underline decoration-[#35547d] underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#69a7ff]">{event.sourceName}</a>
              {risk.provenance.usesVerifiedCache && <span>Official schedule · verified</span>}
              {risk.stale && <span className="text-[#d2a75c]">Schedule may be stale</span>}
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-[#1a2941] pt-3 lg:mt-0 lg:block lg:border-0 lg:pt-0 lg:text-right">
            <span className="text-[10px] text-[#657691]">TIME TO EVENT</span>
            <span className="block font-mono text-xl font-semibold text-[#b8d4fa]">{eventDistance(event.scheduledAt, data.generatedAt)}</span>
          </div>
        </>
      ) : (
        <div className="mt-3 text-sm text-[#9ba9bd] lg:col-span-2 lg:mt-0">
          {risk.availability === "unavailable" ? "Schedule unavailable" : risk.stale ? "Schedule may be stale" : "No major event within 72h"}
        </div>
      )}
    </aside>
  );
}

export default function CosmicV5Preview({ data }: { data: DesignData }) {
  const goldPoints = data.charts.find((chart) => chart.seriesId === "gold_price")?.points ?? [];

  return (
    <div className="relative left-1/2 min-h-screen w-screen -translate-x-1/2 overflow-hidden bg-[#060c18] text-[#edf2fb]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[760px] opacity-70"
        style={{ background: "radial-gradient(ellipse 72% 54% at 50% -4%, rgba(53,91,148,0.22), rgba(73,59,130,0.055) 46%, transparent 72%)" }}
        aria-hidden="true"
      />

      <header className="relative border-b border-[#17243a] bg-[#07101d]/95">
        <div className="mx-auto flex max-w-[1560px] flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-base font-semibold tracking-[0.01em] text-[#edf2fb] sm:text-lg">黄金市场观察站</h1>
              <span className="text-xs text-[#71829e] sm:text-sm">Gold Market Observatory</span>
            </div>
            <p className="mt-1 text-xs text-[#60718c]">黄金市场运行状态的数字观测站 · refined-v5 cosmic prototype</p>
          </div>
          <AvailabilityMark data={data} />
        </div>
      </header>

      <main className="relative mx-auto max-w-[1560px] space-y-7 px-4 py-6 sm:px-6 sm:py-8 lg:space-y-9 lg:px-10 lg:py-9">
        <TodayObservation data={data} />
        <WhatChanged view={data.whatChanged} />
        <Transmission data={data} />
        <EventRisk data={data} />

        <section className="rounded-[18px] bg-[#08111f] p-4 ring-1 ring-inset ring-[#1a2941] sm:p-6 lg:p-7">
          <CosmicCoreChart points={goldPoints} />
        </section>

        <section className="border-t border-[#17243a] py-5">
          <div className="grid gap-3 text-xs leading-5 text-[#657691] md:grid-cols-[1fr_auto] md:items-start">
            <p className="max-w-[72ch]">Prototype boundary：本轮只验证 Header、Today、What Changed、市场传导、Event Risk 与核心走势。ETF、央行、Driver、完整图表和数据来源将在后续阶段评估。</p>
            <p className="md:text-right">所有数据仅用于市场观察，不构成投资建议。</p>
          </div>
        </section>
      </main>
    </div>
  );
}
