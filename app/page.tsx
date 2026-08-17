import { buildPageData } from "@/lib/page-data";
import Header from "@/components/Header";
import SpotGoldCard from "@/components/SpotGoldCard";
import KpiCard from "@/components/KpiCard";
import DriverPanel from "@/components/DriverPanel";
import TemperatureCard from "@/components/TemperatureCard";
import ChinaGoldPanel from "@/components/ChinaGoldPanel";
import InternationalVsChinaPanel from "@/components/InternationalVsChinaPanel";
import SeriesChart from "@/components/charts/SeriesChart";
import MacroCompareChart, { type ComparePoint } from "@/components/charts/MacroCompareChart";
import RegionalEtfChart from "@/components/charts/RegionalEtfChart";
import { fmtNumber, fmtSigned, pnlClass } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const d = await buildPageData();

  // 宏观对比: 把四个日频序列对齐到同一日期轴并做基准日指数化
  const comparePoints = buildComparePoints(d);
  const todayLabel = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  const structureCards = [
    {
      label: "全球央行季度购金",
      value: d.structure.cbLatest,
      unit: "吨",
      change: d.structure.cbLatest !== null && d.structure.cbPrev !== null ? d.structure.cbLatest - d.structure.cbPrev : null,
      date: d.structure.cbDate ? `${d.structure.cbDate} (季度末)` : null,
      note: "WGC Gold Demand Trends 季度确认值",
      digits: 1,
    },
    {
      label: "中国央行黄金储备",
      value: d.structure.chinaTonnes,
      unit: "吨",
      change: d.structure.chinaChange,
      date: d.structure.chinaDate ? `${d.structure.chinaDate} (季度末)` : null,
      note: "WGC / IMF IFS (依据人民银行官方储备资产), 季度口径",
      digits: 1,
    },
    {
      label: "中国央行黄金储备(美元)",
      value: d.structure.chinaUsd,
      unit: "亿美元",
      change: null,
      date: d.structure.chinaDate ? `${d.structure.chinaDate} (季度末)` : null,
      note: "口径: IMF IFS 美元计价, 季度",
      digits: 1,
    },
  ];

  return (
    <main className="space-y-6">
      <Header
        today={todayLabel}
        lastRefresh={d.manifestGeneratedAt}
        missingCount={d.missing.length}
        hasProxyNote={d.macros.some((m) => m.isProxy)}
      />

      {d.missing.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-300">
          <strong>数据缺失提示:</strong> 以下系列暂无数据:{" "}
          {d.missing.map((m) => `${m.seriesId} (${m.reason})`).join("; ")}。运行{" "}
          <code className="rounded bg-[#2d333b] px-1.5 py-0.5">npm run data:fetch</code> 尝试抓取(FRED 系列可配置
          FRED_API_KEY 提高稳定性)。
        </div>
      )}

      {/* ===== 第一屏: 左全球 / 右中国 ===== */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8b949e]">第一屏 · 今天/最近发生了什么 (全球黄金 ←→ 中国黄金)</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* 左侧: 全球黄金 */}
          <div className="space-y-4 lg:col-span-2">
            <SpotGoldCard
              spotPrice={d.gold.latestSpot?.price_usd ?? null}
              spotAsOf={d.gold.latestSpot?.as_of_date ?? null}
              spotTimestamp={d.gold.latestSpot?.timestamp ?? null}
              spotSource={d.gold.latestSpot?.source.name ?? "—"}
              crossCheck={d.gold.latestSpot?.cross_check ?? null}
              fixValue={d.gold.fixValue}
              fixDate={d.gold.fixDate}
              dailyChangePct={d.gold.dailyChangePct}
              periodReturns={d.gold.periodReturns}
              trendLabel={d.gold.trend.label}
              trendExplanation={d.gold.trend.explanation}
              yearPosLabel={d.gold.yearPos.label}
              yearPosPercentile={d.gold.yearPos.percentile}
              yearPosExplanation={d.gold.yearPos.explanation}
              source={d.gold.source}
              sourceUrl={d.gold.sourceUrl}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {d.macros.map((m) => (
                <KpiCard
                  key={m.seriesId}
                  label={m.label}
                  value={m.value}
                  unit={m.unit}
                  change={m.change}
                  changePct={m.changePct}
                  changeLabel={m.changeLabel}
                  date={m.date}
                  source={m.source}
                  sourceUrl={m.sourceUrl}
                  isProxy={m.isProxy}
                  proxyNote={m.proxyNote}
                  frequency={m.frequency}
                  note={m.note}
                  valueDigits={m.seriesId === "us10y_real" || m.seriesId === "us10y_nominal" ? 2 : 2}
                />
              ))}
            </div>
            <div className="panel p-3 text-[11px] leading-relaxed text-[#8b949e]">
              <div className="mb-1 font-semibold text-[#c9d1d9]">黄金—美元关系(相关观察)</div>
              当前: <span className="num text-[#e6edf3]">{macroRelationLabel(d)}</span>。
              美元走弱通常会降低其他货币投资者购买美元计价黄金的成本, 对黄金环境相对有利。注意: 这仅是相关市场因素观察, 不是"美元跌则黄金必涨"。
            </div>
          </div>

          {/* 右侧: 中国黄金 */}
          <ChinaGoldPanel au99={d.china.au99} usdcny={d.china.usdcny} etf={d.china.etf} />
        </div>

        {/* 黄金驱动概览(第一屏) */}
        <div className="mt-4 rounded-lg border border-[#2d333b] bg-[#161b22] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#8b949e]">黄金驱动概览:</span>
            <OverviewChip label="宏观环境" verdict={d.temperature.macro.verdict} kind="macro" />
            <OverviewChip label="资金环境" verdict={d.temperature.flow.verdict} kind="flow" />
            <OverviewChip label="长期结构" verdict={d.temperature.structure.verdict} kind="structure" />
            <OverviewChip label="黄金趋势" verdict={d.temperature.trend.verdict} kind="trend" />
            <span className={`ml-1 text-xs font-semibold ${d.temperature.composite.emoji === "🟢" ? "text-emerald-400" : d.temperature.composite.emoji === "🔴" ? "text-rose-400" : "text-amber-400"}`}>
              综合状态: {d.temperature.composite.emoji} {d.temperature.composite.label}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#c9d1d9]">{d.temperature.composite.summary}</p>
          <p className="mt-1 text-[10px] text-[#8b949e]">
            判定全部来自明确规则(近5日/近4周/季度), 见 lib/scoring/rules.ts; 黄金趋势为结果变量, 单独展示。
          </p>
        </div>
      </section>

      {/* ===== 第二层: 资金有没有进入黄金 ===== */}
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8b949e]">第二层 · 资金有没有进入黄金</h2>
          <span className="inline-block rounded border border-[#2d333b] bg-[#0d1117]/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
            资金环境: {d.temperature.flow.verdict}
          </span>
          <span className="text-[10px] text-[#8b949e]">
            依据: {d.temperature.flow.core[0]?.detail}
            {d.temperature.flow.confirmations[0] && `; ${d.temperature.flow.confirmations[0].label}: ${d.temperature.flow.confirmations[0].note}`}
          </span>
          <span className="text-[10px] text-[#8b949e]">· 时间尺度: 近4周(ETF) / 近20交易日(GLD), 不与日频直接比较</span>
          <span className="text-[10px] text-[#8b949e]">· 本层为国际(全球)黄金投资资金; 国内 518880 资金/份额见第一屏"中国黄金"面板, 两者分别观察</span>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4">
            <div className="panel p-4">
              <div className="panel-title">全球黄金 ETF 持仓</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="num text-2xl font-bold text-[#e6edf3]">
                  {d.etf.holdingsValue !== null ? fmtNumber(d.etf.holdingsValue, 1) : "—"}
                </span>
                <span className="text-xs text-[#8b949e]">吨</span>
                <span className={`num text-sm ${pnlClass(d.etf.holdingsChange4w)}`}>
                  {d.etf.holdingsChange4w !== null ? `${d.etf.holdingsChange4w >= 0 ? "+" : ""}${d.etf.holdingsChange4w.toFixed(1)} 吨(近4周)` : "—"}
                </span>
              </div>
              <div className="mt-1 text-xs text-[#8b949e]">数据月份/周: {d.etf.holdingsDate ?? "—"} · 周频</div>
              <div className="mt-2 border-t border-[#2d333b] pt-2 text-xs text-[#8b949e]">
                <div>
                  近4周资金流:{" "}
                  <span className={`num font-semibold ${pnlClass(d.etf.flowsSum4w)}`}>
                    {d.etf.flowsSum4w === null ? "—" : `${d.etf.flowsSum4w >= 0 ? "+" : ""}${d.etf.flowsSum4w.toFixed(1)} 吨`}
                  </span>
                </div>
                <div>
                  近12周资金流:{" "}
                  <span className={`num font-semibold ${pnlClass(d.etf.flowsSum12w)}`}>
                    {d.etf.flowsSum12w === null ? "—" : `${d.etf.flowsSum12w >= 0 ? "+" : ""}${d.etf.flowsSum12w.toFixed(1)} 吨`}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-[#8b949e]">
                  最新周度资金流:{" "}
                  <span className="num">
                    {d.etf.flowsLast === null ? "—" : `${d.etf.flowsLast >= 0 ? "+" : ""}${d.etf.flowsLast.toFixed(1)} 吨`}
                    {d.etf.flowsLastDate ? ` (${d.etf.flowsLastDate})` : ""}
                  </span>
                </div>
              </div>
            </div>
            <div className="panel p-4">
              <div className="panel-title">SPDR GLD 持仓(代表性 ETF)</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="num text-2xl font-bold text-[#e6edf3]">{d.etf.gldValue !== null ? fmtNumber(d.etf.gldValue, 1) : "—"}</span>
                <span className="text-xs text-[#8b949e]">吨</span>
              </div>
              <div className="mt-1 text-xs text-[#8b949e]">
                {d.etf.gldDate ?? "—"} · 日频
                {d.etf.gldChange20d !== null && (
                  <span className={`num ml-2 ${pnlClass(d.etf.gldChange20d)}`}>
                    {d.etf.gldChange20d >= 0 ? "+" : ""}
                    {d.etf.gldChange20d.toFixed(1)} 吨(近20日)
                  </span>
                )}
              </div>
              <div className="mt-2 border-t border-[#2d333b] pt-2 text-[11px] text-[#8b949e]">{d.etf.gldNote}</div>
              <div className="mt-1 text-[10px] text-[#8b949e]">
                来源:{" "}
                <a className="underline hover:text-[#d4a72c]" href="https://www.spdrgoldshares.com/usa/gld/" target="_blank" rel="noreferrer">
                  SPDR Gold Shares
                </a>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 space-y-4">
            <RegionalEtfChart rows={d.etfRegional ?? []} source="World Gold Council" />
            <SeriesChart
              title="全球黄金 ETF 周度资金流(吨, 正=流入)"
              unit="吨"
              frequency="weekly"
              points={(d.charts.find((c) => c.seriesId === "gold_etf_flows")?.points ?? []).map((p) => ({ ...p, value: p.value }))}
              source="World Gold Council"
              color="#38bdf8"
              bar
            />
          </div>
        </div>
      </section>

      {/* ===== 第三层: 长期需求是否发生改变 ===== */}
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8b949e]">第三层 · 长期需求是否发生改变</h2>
          <span className="inline-block rounded border border-[#2d333b] bg-[#0d1117]/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
            长期结构: {d.temperature.structure.verdict}
          </span>
          <span className="text-[10px] text-[#8b949e]">
            依据: {d.temperature.structure.core[0]?.detail}; {d.temperature.structure.core[1]?.detail}
          </span>
          <span className="text-[10px] text-[#8b949e]">· 时间尺度: 季度(最近公布), 仅用于中长期需求观察</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {structureCards.map((c) => (
            <KpiCard
              key={c.label}
              label={c.label}
              value={c.value}
              unit={c.unit}
              change={c.change}
              date={c.date}
              note={c.note}
              valueDigits={c.digits}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[#8b949e]">
          ⚠️ {d.structure.publishedNote} 央行购金是中长期结构性需求观察, 不应用来解释"为什么黄金今天涨/跌 1%"。
        </p>
      </section>

      {/* ===== 黄金驱动面板 & 市场温度 ===== */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8b949e]">黄金驱动面板 & 市场温度 (四维度结构)</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DriverPanel
            drivers={d.drivers}
            summary={d.temperature.composite.summary}
            compositeLabel={d.temperature.composite.label}
            compositeEmoji={d.temperature.composite.emoji}
          />
          <TemperatureCard temp={d.temperature} />
        </div>
      </section>

      {/* ===== 国际 vs 国内黄金 ===== */}
      <InternationalVsChinaPanel comparison={d.comparison} theoretical={d.theoretical} />

      {/* ===== 走势图 ===== */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8b949e]">走势图</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {d.charts.map((c) => {
            const colorMap: Record<string, string> = {
              gold_price: "#d4a72c",
              au99_99: "#f87171",
              usd_cny: "#fbbf24",
              cn_gold_etf_price: "#f87171",
              dxy_proxy: "#38bdf8",
              us10y_real: "#a78bfa",
              us10y_nominal: "#f472b6",
              gold_etf_holdings: "#fbbf24",
              gold_etf_flows: "#38bdf8",
              cb_gold_purchases: "#34d399",
              china_gold_reserves: "#f87171",
              cn_gold_etf_shares: "#fbbf24",
            };
            return (
              <SeriesChart
                key={c.seriesId}
                title={`${c.label}${c.isMock ? " (Mock/示例数据)" : ""}`}
                unit={c.unit}
                frequency={c.frequency as "daily" | "weekly" | "monthly" | "quarterly"}
                points={c.points}
                source={c.source}
                color={colorMap[c.seriesId] ?? "#d4a72c"}
                bar={c.seriesId === "gold_etf_flows" || c.seriesId === "cb_gold_purchases" || c.seriesId === "cn_gold_etf_shares"}
                note={c.frequency === "monthly" || c.frequency === "quarterly" ? "低频数据, 不支持日度曲线" : undefined}
              />
            );
          })}
        </div>
      </section>

      {/* ===== 宏观对比 ===== */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8b949e]">宏观对比 (多指标比较)</h2>
        <MacroCompareChart
          points={comparePoints}
          sourceNote="日频序列已按日期对齐; 缺失值跳过。"
        />
      </section>

      {/* ===== 数据来源总览 ===== */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8b949e]">数据来源与状态</h2>
        <div className="panel overflow-x-auto p-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#2d333b] text-[#8b949e]">
                <th className="py-1.5 pr-3 font-medium">系列</th>
                <th className="py-1.5 pr-3 font-medium">来源</th>
                <th className="py-1.5 pr-3 font-medium">频率</th>
                <th className="py-1.5 pr-3 font-medium">最新数据日期</th>
                <th className="py-1.5 pr-3 font-medium">最近抓取</th>
                <th className="py-1.5 font-medium">备注</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(d.series)
                .filter((s): s is NonNullable<typeof s> => s !== null)
                .map((s) => {
                  const lastObs = s.observations.length ? s.observations[s.observations.length - 1] : null;
                  return (
                    <tr key={s.meta.series} className="border-b border-[#2d333b]/50">
                      <td className="py-1.5 pr-3 text-[#c9d1d9]">
                        {s.meta.name}
                        {s.meta.source.is_proxy_of && <span className="proxy-tag ml-1.5">代理</span>}
                        {!s.all_real && <span className="mock-tag ml-1.5">Mock</span>}
                      </td>
                      <td className="py-1.5 pr-3">
                        <a className="underline hover:text-[#d4a72c]" href={s.meta.source.url} target="_blank" rel="noreferrer">
                          {s.meta.source.name}
                        </a>
                      </td>
                      <td className="py-1.5 pr-3">{s.meta.frequency}</td>
                      <td className="py-1.5 pr-3 num">
                        {s.last_observation_date ?? "—"}
                        {lastObs?.published_at && <span className="text-[#8b949e]"> (发布 {lastObs.published_at})</span>}
                      </td>
                      <td className="py-1.5 pr-3 num">{new Date(s.last_fetched_at).toLocaleString("zh-CN", { hour12: false })}</td>
                      <td className="py-1.5 text-[#8b949e]">
                        {s.meta.source.is_proxy_of && `代理: ${s.meta.source.is_proxy_of}`}
                        {s.meta.source.update_note}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {d.missing.length > 0 && (
            <div className="mt-3 text-[11px] text-amber-400">缺失系列: {d.missing.map((m) => m.seriesId).join(", ")}</div>
          )}
        </div>
      </section>

      {/* ===== 页脚 ===== */}
      <footer className="border-t border-[#2d333b] pt-4 text-[11px] leading-relaxed text-[#8b949e]">
        <p>
          <strong className="text-[#c9d1d9]">免责声明:</strong> 本站为个人研究 Prototype, 所有数据仅供观察黄金市场驱动因素是否共振, 不构成任何投资建议。趋势判断与评分为明确规则(见{" "}
          <code className="rounded bg-[#2d333b] px-1">lib/indicators/returns.ts</code>、<code className="rounded bg-[#2d333b] px-1">lib/scoring/rules.ts</code>), 非 AI 判断。
        </p>
        <p className="mt-1">
          数据均为真实数据快照(抓取时间见上方表格), 若数据源不可用则保留上次快照并标注。更新命令: <code className="rounded bg-[#2d333b] px-1">npm run data:fetch</code>。详细说明见 README。
        </p>
      </footer>
    </main>
  );
}

/** 第一屏驱动概览用的判定芯片 */
function OverviewChip({ label, verdict, kind }: { label: string; verdict: string; kind: "macro" | "flow" | "structure" | "trend" }) {
  const favorable = ["偏利多", "偏流入", "偏支持"].includes(verdict);
  const unfavorable = ["偏利空", "偏流出", "偏弱"].includes(verdict);
  let cls = "bg-neutral-500/15 text-neutral-300 border-neutral-500/40";
  if (kind === "trend") {
    if (verdict === "上行") cls = "bg-rose-500/15 text-rose-400 border-rose-500/40";
    else if (verdict === "下行") cls = "bg-emerald-500/15 text-emerald-400 border-emerald-500/40";
  } else if (favorable) cls = "bg-emerald-500/15 text-emerald-400 border-emerald-500/40";
  else if (unfavorable) cls = "bg-rose-500/15 text-rose-400 border-rose-500/40";
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {label}: {verdict}
    </span>
  );
}

/** 黄金—美元关系标签(克制表述) */
function macroRelationLabel(d: Awaited<ReturnType<typeof buildPageData>>): string {
  const gold5 = d.gold.periodReturns.find((r) => r.window === "5D")?.changePct ?? null;
  const dxy5 = d.macros.find((m) => m.seriesId === "dxy_proxy")?.change ?? null;
  if (gold5 === null || dxy5 === null) return "数据不足, 暂无法给出关系观察";
  const gUp = gold5 > 0;
  const gDown = gold5 < 0;
  const dUp = dxy5 > 0;
  const dDown = dxy5 < 0;
  if (gUp && dDown) return "黄金近5日上涨 / 美元走弱 —— 经典负相关方向";
  if (gUp && dUp) return "黄金近5日上涨 / 美元走强 —— 同涨, 说明美元并非当前主导因素";
  if (gDown && dUp) return "黄金近5日下跌 / 美元走强 —— 经典负相关方向";
  if (gDown && dDown) return "黄金近5日下跌 / 美元走弱 —— 同跌, 说明有其他因素(如实际利率/资金流)主导";
  return "黄金近5日基本持平, 美元变动方向请查看上方卡片";
}

/** 构建宏观对比: 把四个日频序列按日期对齐(原始值, 指数化在图表端按区间进行) */
function buildComparePoints(d: Awaited<ReturnType<typeof buildPageData>>): ComparePoint[] {
  const byDate = new Map<string, ComparePoint>();
  type NumericKey = "gold" | "dxy" | "real10y" | "nominal10y";
  const seriesMap: Array<[NumericKey, string]> = [
    ["gold", "gold_price"],
    ["dxy", "dxy_proxy"],
    ["real10y", "us10y_real"],
    ["nominal10y", "us10y_nominal"],
  ];
  for (const [key, seriesId] of seriesMap) {
    const obs = d.series[seriesId as keyof typeof d.series]?.observations ?? [];
    for (const o of obs) {
      const row = byDate.get(o.observation_date) ?? { date: o.observation_date, gold: null, dxy: null, real10y: null, nominal10y: null };
      row[key] = o.value;
      byDate.set(o.observation_date, row);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
