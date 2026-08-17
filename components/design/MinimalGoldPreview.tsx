"use client";

import type { DesignData } from "@/lib/design-data";
import DesignShell from "./DesignShell";
import { DAreaChart, DeltaBars, type DPoint } from "./charts/DesignCharts";

const SERIF = '"Songti SC","STSong","SimSun",Georgia,serif';
const C = {
  bg: "#f6f4ef",
  panel: "#ffffff",
  border: "#e8e4da",
  text: "#1a1916",
  muted: "#8f897c",
  gold: "#a67c2e",
  up: "#b03a2e",
  down: "#2e7d5b",
  hairline: "#efece4",
};

function SectionNo({ n, t }: { n: string; t: string }) {
  return (
    <div className="mb-6 flex items-baseline gap-4">
      <span className="text-xs tracking-[0.3em]" style={{ color: C.gold }}>{n}</span>
      <h2 className="text-lg font-medium tracking-wide" style={{ color: C.text, fontFamily: SERIF }}>{t}</h2>
      <div className="h-px flex-1" style={{ background: C.hairline }} />
    </div>
  );
}

export default function MinimalGoldPreview({ data: d }: { data: DesignData }) {
  const goldPoints = (d.charts.find((c) => c.seriesId === "gold_price")?.points ?? []) as DPoint[];
  const au99Points = (d.charts.find((c) => c.seriesId === "au99_99")?.points ?? []) as DPoint[];
  const usdcnyPoints = (d.charts.find((c) => c.seriesId === "usd_cny")?.points ?? []) as DPoint[];

  const fmt = (v: number | null | undefined, dg = 2) => (v === null || v === undefined ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: dg, maximumFractionDigits: dg }));
  const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
  const upDown = (v: number | null) => (v === null ? C.muted : v >= 0 ? C.up : C.down);

  const verdictChip = (label: string, verdict: string, kind: "macro" | "flow" | "structure" | "trend") => {
    const favorable = ["偏利多", "偏流入", "偏支持"].includes(verdict);
    const unfavorable = ["偏利空", "偏流出", "偏弱"].includes(verdict);
    let color = C.muted;
    if (kind === "trend") color = verdict === "上行" ? C.up : verdict === "下行" ? C.down : C.muted;
    else if (favorable) color = C.down;
    else if (unfavorable) color = C.up;
    return (
      <div className="flex flex-col items-center rounded-2xl border bg-white px-5 py-3 text-center" style={{ borderColor: C.border }}>
        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>{label}</span>
        <span className="mt-1 text-sm font-semibold" style={{ color }}>{verdict}</span>
      </div>
    );
  };

  return (
    <DesignShell variant="v2" name="Minimal Gold" tagline="极简高端风格 · 大留白 · 精致排版 · 长时间浏览舒适">
      <div style={{ background: C.bg }}>
        {/* 报头 */}
        <div className="pt-10 pb-12">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.4em]" style={{ color: C.gold }}>Gold Market Observatory</div>
              <h1 className="mt-3 text-3xl font-medium" style={{ color: C.text, fontFamily: SERIF }}>黄金市场观察站</h1>
            </div>
            <div className="text-right text-xs" style={{ color: C.muted }}>
              <div>{new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</div>
              <div className="mt-0.5">最近刷新 {d.manifestGeneratedAt ? new Date(d.manifestGeneratedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}</div>
            </div>
          </div>

          {/* 主数字 */}
          <div className="mt-14 flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <div className="text-xs uppercase tracking-[0.25em]" style={{ color: C.muted }}>黄金现货 XAU/USD</div>
              <div className="mt-2 flex items-baseline gap-4">
                <span className="text-7xl font-medium leading-none tracking-tight" style={{ color: C.text, fontFamily: SERIF, fontVariantNumeric: "tabular-nums" }}>
                  {fmt(d.gold.latestSpot?.price_usd, 2)}
                </span>
                <span className="text-xl font-medium" style={{ color: upDown(d.gold.dailyChangePct) }}>
                  {d.gold.dailyChangePct !== null ? `${d.gold.dailyChangePct >= 0 ? "▲" : "▼"} ${pct(d.gold.dailyChangePct)}` : ""}
                </span>
              </div>
              <div className="mt-2 text-xs" style={{ color: C.muted }}>
                {d.gold.latestSpot?.as_of_date ?? ""} · {d.gold.latestSpot?.source.name ?? ""} · 日频基准(LBMA) {fmt(d.gold.fixValue)}（{d.gold.fixDate}）
              </div>
            </div>
            <div className="hidden h-20 w-px md:block" style={{ background: C.border }} />
            <div className="grid grid-cols-4 gap-6 sm:grid-cols-5">
              {d.gold.periodReturns.map((r) => (
                <div key={r.window} className="text-center">
                  <div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>{r.window === "1D" ? "当日" : r.label}</div>
                  <div className="mt-1 text-base font-medium tabular-nums" style={{ color: upDown(r.changePct) }}>{pct(r.changePct)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 四维度判定 */}
          <div className="mt-12 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {verdictChip("宏观环境", d.temperature.macro.verdict, "macro")}
            {verdictChip("资金环境", d.temperature.flow.verdict, "flow")}
            {verdictChip("长期结构", d.temperature.structure.verdict, "structure")}
            {verdictChip("黄金趋势", d.temperature.trend.verdict, "trend")}
          </div>
          <p className="mx-auto mt-6 max-w-3xl text-center text-base leading-relaxed" style={{ color: C.text, fontFamily: SERIF }}>
            “{d.temperature.composite.summary}”
          </p>
        </div>

        {/* 01 驱动判定 */}
        <div className="py-10">
          <SectionNo n="01" t="驱动判定 · 目前是什么在支撑黄金" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(["macro", "flow", "structure", "trend"] as const).map((layer) => {
              const rows = d.drivers.filter((r) => r.layer === layer);
              return (
                <div key={layer} className="rounded-2xl border bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]" style={{ borderColor: C.border }}>
                  <div className="text-[10px] uppercase tracking-[0.25em]" style={{ color: C.gold }}>{rows[0]?.layerLabel ?? layer}</div>
                  <div className="mt-4 space-y-4">
                    {rows.map((r) => (
                      <div key={r.layer + r.title} className="border-l pl-3" style={{ borderColor: r.stance === "favorable" || r.stance === "confirm" ? C.gold : C.hairline }}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm" style={{ color: C.text }}>{r.title}</span>
                          <span className="text-[10px]" style={{ color: r.stance === "favorable" || r.stance === "confirm" ? C.down : r.stance === "unfavorable" ? C.up : C.muted }}>
                            {r.stance === "favorable" ? "有利" : r.stance === "confirm" ? "确认" : r.stance === "unfavorable" ? "不利" : "中性"}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs leading-relaxed" style={{ color: C.muted }}>{r.behavior} → {r.implication}</div>
                        <div className="mt-0.5 text-[10px] tabular-nums" style={{ color: "#b3ad9f" }}>{r.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 02 国际 vs 国内 */}
        <div className="py-10">
          <SectionNo n="02" t="国际黄金 ↔ 国内黄金" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="rounded-2xl border bg-white p-6 lg:col-span-3" style={{ borderColor: C.border }}>
              <DeltaBars
                variant="minimal"
                rows={[
                  { label: "国际黄金 XAU/USD", sub: "LBMA 定盘 · 美元/盎司", v5: d.comparison.gold[0]?.changePct, v20: d.comparison.gold[1]?.changePct, v60: d.comparison.gold[2]?.changePct },
                  { label: "Au99.99", sub: "上海黄金交易所 · 元/克", v5: d.comparison.au99[0]?.changePct, v20: d.comparison.au99[1]?.changePct, v60: d.comparison.au99[2]?.changePct },
                  { label: "USD/CNY", sub: "上升=人民币走弱", v5: d.comparison.usdcny[0]?.changePct, v20: d.comparison.usdcny[1]?.changePct, v60: d.comparison.usdcny[2]?.changePct },
                ]}
              />
              <div className="mt-5 rounded-xl px-5 py-4" style={{ background: "#faf8f2", border: `1px solid ${C.hairline}` }}>
                <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.gold }}>观察解读 · 规则生成</div>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: C.text }}>{d.comparison.explanation}</p>
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-6 lg:col-span-2" style={{ borderColor: C.border }}>
              <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>人民币理论折算参考值</div>
              {(() => {
                const l = d.theoretical.latest;
                return (
                  <div className="mt-4 space-y-3">
                    <Row label="国际折算参考" value={l ? `${fmt(l.theoretical)} 元/克` : "—"} sub={l ? `${l.date} · 日度对齐` : ""} />
                    <div className="h-px" style={{ background: C.hairline }} />
                    <Row label="Au99.99 当日" value={l?.au99 !== null && l?.au99 !== undefined ? `${fmt(l.au99)} 元/克` : "—"} sub={l?.date ?? ""} />
                    <div className="h-px" style={{ background: C.hairline }} />
                    <Row label="国内溢价 / 折价" value={l?.premiumPct !== null && l?.premiumPct !== undefined ? pct(l.premiumPct) : "—"} sub="相对理论参考值 · 研究观察" valueColor={upDown(l?.premiumPct ?? null)} />
                  </div>
                );
              })()}
              <p className="mt-4 text-[10px] leading-relaxed" style={{ color: "#b3ad9f" }}>{d.theoretical.caveat}</p>
            </div>
          </div>
        </div>

        {/* 03 资金与央行 */}
        <div className="py-10">
          <SectionNo n="03" t="资金与央行 · 中长期需求" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "全球黄金 ETF 持仓", value: `${fmt(d.etf.holdingsValue, 1)} 吨`, sub: `${d.etf.holdingsDate} · 周频` },
              { label: "ETF 近4周资金流", value: d.etf.flowsSum4w === null ? "—" : `${d.etf.flowsSum4w >= 0 ? "+" : ""}${fmt(d.etf.flowsSum4w, 1)} 吨`, sub: "正=流入" },
              { label: "全球央行季度购金", value: `${fmt(d.structure.cbLatest, 1)} 吨`, sub: d.structure.cbDate ?? "—" },
              { label: "中国央行黄金储备", value: `${fmt(d.structure.chinaTonnes, 1)} 吨`, sub: `${d.structure.chinaDate ?? ""} · 季度` },
            ].map((x) => (
              <div key={x.label} className="rounded-2xl border bg-white p-5" style={{ borderColor: C.border }}>
                <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>{x.label}</div>
                <div className="mt-2 text-2xl font-medium tabular-nums" style={{ color: C.text, fontFamily: SERIF }}>{x.value}</div>
                <div className="mt-1 text-xs" style={{ color: C.muted }}>{x.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 04 中国黄金 */}
        <div className="py-10">
          <SectionNo n="04" t="中国黄金 · 传导至人民币计价" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { label: "Au99.99", value: `${fmt(d.china.au99.value)} 元/克`, sub: d.china.au99.date ?? "", pts: au99Points, color: C.up },
              { label: "USD/CNY", value: fmt(d.china.usdcny.value, 4), sub: d.china.usdcny.date ?? "", pts: usdcnyPoints, color: C.gold },
              { label: "黄金ETF 518880", value: `${fmt(d.china.etf.price, 3)} 元`, sub: `${d.china.etf.date ?? ""} · 份额 ${fmt(d.china.etf.sharesValue, 2)} 亿份`, pts: d.charts.find((c) => c.seriesId === "cn_gold_etf_price")?.points as DPoint[], color: C.down },
            ].map((x) => (
              <div key={x.label} className="rounded-2xl border bg-white p-5" style={{ borderColor: C.border }}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>{x.label}</span>
                  <span className="text-[10px]" style={{ color: C.muted }}>{x.sub}</span>
                </div>
                <div className="mt-2 text-2xl font-medium tabular-nums" style={{ color: C.text, fontFamily: SERIF }}>{x.value}</div>
                <div className="mt-3"><DAreaChart points={x.pts} color={x.color} variant="minimal" height={110} ranges={["3M", "6M"]} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* 05 数据来源 */}
        <div className="py-10">
          <SectionNo n="05" t="数据来源与状态" />
          <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: C.border }}>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest" style={{ color: C.muted, borderBottom: `1px solid ${C.hairline}` }}>
                  <th className="px-5 py-3 font-normal">系列</th>
                  <th className="px-5 py-3 font-normal">来源</th>
                  <th className="px-5 py-3 font-normal">频率</th>
                  <th className="px-5 py-3 font-normal">数据日期</th>
                  <th className="px-5 py-3 font-normal">最近抓取</th>
                </tr>
              </thead>
              <tbody>
                {d.series.map((s) => (
                  <tr key={s.name} className="hover:bg-[#faf8f2]" style={{ borderBottom: `1px solid ${C.hairline}` }}>
                    <td className="px-5 py-2.5" style={{ color: C.text }}>{s.name}{s.isProxy ? "（代理）" : ""}</td>
                    <td className="px-5 py-2.5" style={{ color: C.muted }}>{s.source}</td>
                    <td className="px-5 py-2.5" style={{ color: C.muted }}>{s.frequency}</td>
                    <td className="px-5 py-2.5 tabular-nums" style={{ color: C.muted }}>{s.lastObservationDate}</td>
                    <td className="px-5 py-2.5 tabular-nums" style={{ color: C.muted }}>{new Date(s.lastFetchedAt).toLocaleString("zh-CN", { hour12: false })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t py-6 text-center text-[10px] leading-relaxed" style={{ borderColor: C.hairline, color: C.muted }}>
          该评分为驱动因素方向观察, 不构成投资建议 · 设计预览 B · Minimal Gold
        </div>
      </div>
    </DesignShell>
  );
}

function Row({ label, value, sub, valueColor }: { label: string; value: string; sub: string; valueColor?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <div className="text-xs" style={{ color: C.muted }}>{label}</div>
        <div className="text-[10px]" style={{ color: "#b3ad9f" }}>{sub}</div>
      </div>
      <div className="text-lg font-medium tabular-nums" style={{ color: valueColor ?? C.text }}>{value}</div>
    </div>
  );
}
