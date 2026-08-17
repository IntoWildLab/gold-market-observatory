"use client";

import type { DesignData } from "@/lib/design-data";
import DesignShell from "./DesignShell";
import { DAreaChart, DSpark, DeltaBars, type DPoint } from "./charts/DesignCharts";

const C = {
  bg: "#0a0e14",
  panel: "#10151d",
  panel2: "#0d1219",
  border: "#1c2430",
  text: "#d7dee8",
  muted: "#7d8794",
  gold: "#e3b45c",
  up: "#ff4d5e",
  down: "#23c185",
  info: "#4cc2ff",
};

function Led({ on, color }: { on: boolean; color?: string }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: on ? color ?? C.gold : "#2a3442", boxShadow: on ? `0 0 6px ${color ?? C.gold}` : "none" }}
    />
  );
}

export default function TerminalProPreview({ data: d }: { data: DesignData }) {
  const goldPoints = (d.charts.find((c) => c.seriesId === "gold_price")?.points ?? []) as DPoint[];
  const au99Points = (d.charts.find((c) => c.seriesId === "au99_99")?.points ?? []) as DPoint[];
  const usdcnyPoints = (d.charts.find((c) => c.seriesId === "usd_cny")?.points ?? []) as DPoint[];
  const etfPoints = (d.charts.find((c) => c.seriesId === "cn_gold_etf_price")?.points ?? []) as DPoint[];
  const realPoints = (d.charts.find((c) => c.seriesId === "us10y_real")?.points ?? []) as DPoint[];

  const sec = (n: string, t: string) => (
    <div className="mb-2 flex items-center gap-3">
      <span className="font-mono text-[10px] tracking-[0.25em]" style={{ color: C.gold }}>{n}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: C.muted }}>{t}</span>
      <span className="h-px flex-1" style={{ background: C.border }} />
    </div>
  );

  const ticker = [
    { k: "XAU", v: d.gold.latestSpot?.price_usd, u: "" },
    { k: "Au99.99", v: d.china.au99.value, u: "" },
    { k: "USDCNY", v: d.china.usdcny.value, u: "" },
    { k: "10YR", v: d.macros.find((m) => m.seriesId === "us10y_real")?.value, u: "%" },
    { k: "DXY*", v: d.macros.find((m) => m.seriesId === "dxy_proxy")?.value, u: "" },
  ];

  const upDown = (v: number | null) => (v === null ? C.muted : v >= 0 ? C.up : C.down);
  const fmt = (v: number | null | undefined, dg = 2) => (v === null || v === undefined ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: dg, maximumFractionDigits: dg }));
  const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);

  return (
    <DesignShell variant="v1" name="Terminal Pro" tagline="专业金融终端风格 · 信息密度高 · 图表优先 · 冷静研究工具感">
      <div className="rounded-lg border" style={{ background: C.bg, borderColor: C.border }}>
        {/* 终端顶栏 */}
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2" style={{ borderColor: C.border, background: "#0d1219" }}>
          <span className="font-mono text-[11px] font-bold tracking-wider" style={{ color: C.gold }}>GOLD-OBS // TERMINAL</span>
          <div className="flex flex-wrap gap-4 font-mono text-[10px]" style={{ color: C.muted }}>
            {ticker.map((t) => (
              <span key={t.k}>
                {t.k} <span className="text-[#d7dee8]">{fmt(t.v, t.k === "USDCNY" ? 4 : 2)}{t.u}</span>
              </span>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 font-mono text-[10px]" style={{ color: C.muted }}>
            <Led on color={C.down} /> <span>LIVE DATA</span>
            <span className="hidden sm:inline">| {d.manifestGeneratedAt ? new Date(d.manifestGeneratedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}</span>
          </div>
        </div>

        {/* 01 MARKET */}
        <div className="space-y-6 p-4">
          {sec("01", "Market · 黄金与宏观")}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* 金价 */}
            <div className="rounded border p-4" style={{ borderColor: C.border, background: C.panel2 }}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>XAU/USD 现货</span>
                <span className="font-mono text-[10px]" style={{ color: C.muted }}>{d.gold.latestSpot?.as_of_date ?? ""}</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-4xl font-bold" style={{ color: C.text }}>{fmt(d.gold.latestSpot?.price_usd)}</span>
                <span className="font-mono text-base" style={{ color: upDown(d.gold.dailyChangePct) }}>
                  {d.gold.dailyChangePct !== null && (d.gold.dailyChangePct >= 0 ? "▲" : "▼")} {pct(d.gold.dailyChangePct)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-1 font-mono text-center">
                {d.gold.periodReturns.map((r) => (
                  <div key={r.window} className="border-r last:border-0" style={{ borderColor: C.border }}>
                    <div className="text-[9px] uppercase" style={{ color: C.muted }}>{r.window === "1D" ? "D1" : r.label}</div>
                    <div className="text-xs" style={{ color: upDown(r.changePct) }}>{pct(r.changePct)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t pt-2 font-mono text-[10px]" style={{ borderColor: C.border, color: C.muted }}>
                一年位置: <span style={{ color: C.text }}>{d.gold.yearPos.label} ({d.gold.yearPos.percentile?.toFixed(0)}%)</span>
                <span className="ml-3">趋势: <span style={{ color: upDown(d.gold.trend.changePct) }}>{d.gold.trend.label}</span></span>
              </div>
            </div>

            {/* 金价图表 */}
            <div className="rounded border p-4 lg:col-span-1" style={{ borderColor: C.border, background: C.panel2 }}>
              <DAreaChart points={goldPoints} color={C.gold} unit="USD/oz" variant="terminal" height={230} ranges={["1M", "3M", "6M", "1Y"]} />
            </div>

            {/* 宏观侧栏 */}
            <div className="flex flex-col gap-3">
              {d.macros.map((m) => (
                <div key={m.seriesId} className="rounded border p-3" style={{ borderColor: C.border, background: C.panel2 }}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>
                      {m.label}{m.isProxy ? " *" : ""}
                    </span>
                    <span className="font-mono text-[9px]" style={{ color: C.muted }}>{m.date}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="font-mono text-xl font-bold" style={{ color: C.text }}>{fmt(m.value, m.seriesId.includes("us10y") ? 2 : 2)}</span>
                    <span className="font-mono text-xs" style={{ color: upDown(m.change) }}>{m.changeLabel ?? "—"}</span>
                  </div>
                </div>
              ))}
              <div className="rounded border p-3" style={{ borderColor: C.gold, background: "#121007" }}>
                <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: C.gold }}>Composite</div>
                <div className="mt-1 font-mono text-sm font-bold" style={{ color: C.text }}>
                  {d.temperature.composite.emoji} {d.temperature.composite.label}
                </div>
                <div className="mt-1 font-mono text-[10px] leading-relaxed" style={{ color: C.muted }}>{d.temperature.composite.summary}</div>
              </div>
            </div>
          </div>

          {/* 02 DRIVER BOARD */}
          {sec("02", "Driver Board · 四维度判定")}
          <div className="rounded border" style={{ borderColor: C.border, background: C.panel2 }}>
            <div className="grid grid-cols-1 md:grid-cols-4">
              {(["macro", "flow", "structure", "trend"] as const).map((layer, i) => {
                const rows = d.drivers.filter((r) => r.layer === layer);
                const layerLabel = rows[0]?.layerLabel ?? layer;
                const favCount = rows.filter((r) => r.stance === "favorable" || r.stance === "confirm").length;
                return (
                  <div key={layer} className={`p-3 ${i > 0 ? "md:border-l" : ""}`} style={{ borderColor: C.border }}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: C.gold }}>{layerLabel}</span>
                      <Led on={favCount > 0} color={favCount === rows.length ? C.down : C.gold} />
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {rows.map((r) => (
                        <div key={r.layer + r.title} className="border-l-2 pl-2" style={{ borderColor: r.stance === "favorable" || r.stance === "confirm" ? C.gold : C.border }}>
                          <div className="font-mono text-[10px]" style={{ color: C.text }}>{r.title}: <span style={{ color: r.stance === "favorable" || r.stance === "confirm" ? C.down : C.muted }}>{r.behavior}</span></div>
                          <div className="font-mono text-[9px]" style={{ color: C.muted }}>→ {r.implication}{r.isConfirmation ? " (确认)" : ""}</div>
                          <div className="font-mono text-[9px]" style={{ color: "#4a5566" }}>{r.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t px-3 py-2 font-mono text-[10px]" style={{ borderColor: C.border, color: C.muted }}>
              ▸ {d.temperature.composite.summary}
            </div>
          </div>

          {/* 03 国际 vs 国内 */}
          {sec("03", "Intl vs CN · 国际黄金 ↔ 国内黄金")}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded border p-4" style={{ borderColor: C.border, background: C.panel2 }}>
              <DeltaBars
                variant="terminal"
                rows={[
                  { label: "XAU/USD", sub: "LBMA 定盘", v5: d.comparison.gold[0]?.changePct, v20: d.comparison.gold[1]?.changePct, v60: d.comparison.gold[2]?.changePct },
                  { label: "Au99.99", sub: "SGE 元/克", v5: d.comparison.au99[0]?.changePct, v20: d.comparison.au99[1]?.changePct, v60: d.comparison.au99[2]?.changePct },
                  { label: "USD/CNY", sub: "上升=人民币走弱", v5: d.comparison.usdcny[0]?.changePct, v20: d.comparison.usdcny[1]?.changePct, v60: d.comparison.usdcny[2]?.changePct },
                ]}
              />
              <div className="mt-3 border-t pt-2 font-mono text-[10px] leading-relaxed" style={{ borderColor: C.border, color: C.muted }}>
                <span style={{ color: C.gold }}>RULE:</span> {d.comparison.explanation}
              </div>
            </div>
            <div className="rounded border p-4" style={{ borderColor: C.border, background: C.panel2 }}>
              <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>理论折算参考(日度对齐)</div>
              {(() => {
                const l = d.theoretical.latest;
                return (
                  <div className="mt-2 grid grid-cols-3 gap-2 font-mono">
                    <div className="rounded border p-2" style={{ borderColor: C.border }}>
                      <div className="text-[9px]" style={{ color: C.muted }}>折算参考</div>
                      <div className="text-base font-bold" style={{ color: C.info }}>{l ? fmt(l.theoretical) : "—"} <span className="text-[9px]" style={{ color: C.muted }}>元/克</span></div>
                      <div className="text-[9px]" style={{ color: C.muted }}>{l?.date}</div>
                    </div>
                    <div className="rounded border p-2" style={{ borderColor: C.border }}>
                      <div className="text-[9px]" style={{ color: C.muted }}>Au99.99</div>
                      <div className="text-base font-bold" style={{ color: C.text }}>{l?.au99 !== null && l?.au99 !== undefined ? fmt(l.au99) : "—"}</div>
                      <div className="text-[9px]" style={{ color: C.muted }}>{l?.date}</div>
                    </div>
                    <div className="rounded border p-2" style={{ borderColor: C.border }}>
                      <div className="text-[9px]" style={{ color: C.muted }}>溢价/折价</div>
                      <div className="text-base font-bold" style={{ color: upDown(l?.premiumPct ?? null) }}>{l?.premiumPct !== null && l?.premiumPct !== undefined ? pct(l.premiumPct) : "—"}</div>
                      <div className="text-[9px]" style={{ color: C.muted }}>研究参考</div>
                    </div>
                  </div>
                );
              })()}
              <div className="mt-3 border-t pt-2 font-mono text-[9px] leading-relaxed" style={{ borderColor: C.border, color: "#4a5566" }}>
                ⚠ {d.theoretical.caveat}
              </div>
            </div>
          </div>

          {/* 04 资金与央行 */}
          {sec("04", "Flow & Central Banks")}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniPanel label="全球ETF持仓" value={`${fmt(d.etf.holdingsValue, 1)} 吨`} sub={`${d.etf.holdingsDate} · 周频`} color={C.text} />
            <MiniPanel
              label="ETF近4周资金流"
              value={d.etf.flowsSum4w === null ? "—" : d.etf.flowsSum4w >= 0 ? `+${fmt(d.etf.flowsSum4w, 1)} 吨` : `${fmt(d.etf.flowsSum4w, 1)} 吨`}
              sub="正=流入"
              color={upDown(d.etf.flowsSum4w ?? null)}
            />
            <MiniPanel label="全球央行购金" value={`${fmt(d.structure.cbLatest, 1)} 吨`} sub={`${d.structure.cbDate ?? ""} · 季度`} color={C.text} />
            <MiniPanel label="中国央行储备" value={`${fmt(d.structure.chinaTonnes, 1)} 吨`} sub={`${d.structure.chinaDate ?? ""} · 季度`} color={C.text} />
          </div>

          {/* 05 中国与宏观图表 */}
          {sec("05", "Charts · 国内黄金 & 宏观")}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border p-3" style={{ borderColor: C.border, background: C.panel2 }}>
              <div className="font-mono text-[10px] uppercase" style={{ color: C.muted }}>Au99.99 元/克</div>
              <DAreaChart points={au99Points} color={C.up} variant="terminal" height={150} ranges={["3M", "6M", "1Y"]} />
            </div>
            <div className="rounded border p-3" style={{ borderColor: C.border, background: C.panel2 }}>
              <div className="font-mono text-[10px] uppercase" style={{ color: C.muted }}>USD/CNY</div>
              <DAreaChart points={usdcnyPoints} color={C.info} variant="terminal" height={150} ranges={["3M", "6M", "1Y"]} />
            </div>
            <div className="rounded border p-3" style={{ borderColor: C.border, background: C.panel2 }}>
              <div className="font-mono text-[10px] uppercase" style={{ color: C.muted }}>518880 元/份</div>
              <DAreaChart points={etfPoints} color={C.gold} variant="terminal" height={150} ranges={["3M", "6M", "1Y"]} />
            </div>
            <div className="rounded border p-3" style={{ borderColor: C.border, background: C.panel2 }}>
              <div className="font-mono text-[10px] uppercase" style={{ color: C.muted }}>10Y实际利率 %</div>
              <DAreaChart points={realPoints} color={C.info} variant="terminal" height={150} ranges={["3M", "6M", "1Y"]} />
            </div>
          </div>

          {/* 06 数据源 */}
          {sec("06", "Data Sources")}
          <div className="overflow-x-auto rounded border" style={{ borderColor: C.border, background: C.panel2 }}>
            <table className="w-full font-mono text-[10px]">
              <thead>
                <tr className="text-left uppercase tracking-wider" style={{ color: C.muted, borderBottom: `1px solid ${C.border}` }}>
                  <th className="px-3 py-2 font-normal">series</th>
                  <th className="px-3 py-2 font-normal">source</th>
                  <th className="px-3 py-2 font-normal">freq</th>
                  <th className="px-3 py-2 font-normal">obs_date</th>
                  <th className="px-3 py-2 font-normal">fetched</th>
                </tr>
              </thead>
              <tbody>
                {d.series.map((s) => (
                  <tr key={s.name} style={{ borderBottom: `1px solid #141b25` }}>
                    <td className="px-3 py-1.5" style={{ color: C.text }}>{s.name}{s.isProxy ? " *" : ""}</td>
                    <td className="px-3 py-1.5" style={{ color: C.muted }}>{s.source}</td>
                    <td className="px-3 py-1.5" style={{ color: C.muted }}>{s.frequency}</td>
                    <td className="px-3 py-1.5" style={{ color: C.muted }}>{s.lastObservationDate}</td>
                    <td className="px-3 py-1.5" style={{ color: C.muted }}>{new Date(s.lastFetchedAt).toLocaleString("zh-CN", { hour12: false })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DesignShell>
  );
}

function MiniPanel({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded border p-3" style={{ borderColor: "#1c2430", background: "#0d1219" }}>
      <div className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "#7d8794" }}>{label}</div>
      <div className="mt-1 font-mono text-lg font-bold" style={{ color }}>{value}</div>
      <div className="font-mono text-[9px]" style={{ color: "#4a5566" }}>{sub}</div>
    </div>
  );
}
