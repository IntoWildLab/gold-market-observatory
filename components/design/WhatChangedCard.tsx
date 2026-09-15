import type { WhatChangedView } from "@/lib/design-data";

const COLORS = {
  border: "#e8e1d1",
  text: "#2b2a26",
  muted: "#7d766a",
  faint: "#a8a193",
  gold: "#b07d2b",
  goldSoft: "#f3ead8",
  up: "#d64545",
  down: "#1e8e5a",
  caution: "#9a6a20",
};

const arrow = (direction: WhatChangedView["goldMove"]["direction"]) => direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
const signed = (value: number, digits: number) => `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;

export function formatWhatChangedEvidence(item: WhatChangedView["evidence"][number]): string {
  return `${signed(item.change, item.unit === "bp" ? 0 : 2)}${item.unit}`;
}

function moveColor(direction: WhatChangedView["goldMove"]["direction"]) {
  return direction === "up" ? COLORS.up : direction === "down" ? COLORS.down : COLORS.muted;
}

export default function WhatChangedCard({ view }: { view: WhatChangedView }) {
  const incomplete = view.availability === "insufficient";
  return (
    <article
      aria-label="WHAT CHANGED 今日变化"
      className="rounded-xl border bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(80,70,40,0.06)] sm:px-5"
      style={{ borderColor: COLORS.border }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-b pb-2" style={{ borderColor: COLORS.border }}>
        <span className="font-mono text-[12px] font-semibold tracking-[0.18em]" style={{ color: COLORS.gold }}>WHAT CHANGED</span>
        <span className="text-[13px] font-semibold" style={{ color: COLORS.text }}>今日变化</span>
        {view.availability === "partial" && <span className="rounded px-1.5 py-0.5 text-[11px]" style={{ background: "#faf2df", color: COLORS.caution }}>部分证据</span>}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[0.9fr_1.45fr_1.5fr_1fr] lg:gap-5">
        <section className="min-w-0" aria-label="黄金发生了什么">
          <div className="text-[11px] font-semibold tracking-wide" style={{ color: COLORS.faint }}>黄金发生了什么</div>
          <div className="mt-1 text-xl font-bold leading-tight" style={{ color: incomplete ? COLORS.muted : COLORS.text }}>{view.goldMove.description}</div>
          <div className="mt-1 font-mono text-[15px] font-bold" style={{ color: moveColor(view.goldMove.direction) }}>
            {view.goldMove.changePct === null ? "近1日 —" : `${view.goldMove.window} ${arrow(view.goldMove.direction)} ${signed(view.goldMove.changePct, 2)}%`}
          </div>
          {view.goldMove.endDate && <div className="mt-0.5 text-[11px]" style={{ color: COLORS.faint }}>数据日 {view.goldMove.endDate}</div>}
        </section>

        <section className="min-w-0 border-t pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0" style={{ borderColor: COLORS.border }} aria-label="当前环境">
          <div className="text-[11px] font-semibold tracking-wide" style={{ color: COLORS.faint }}>当前数据更符合</div>
          <div className="mt-1 text-[16px] font-bold" style={{ color: view.environment.tone === "caution" ? COLORS.caution : COLORS.text }}>{view.environment.label}</div>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: COLORS.muted }}>{view.environment.explanation}</p>
        </section>

        <section className="min-w-0 border-t pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0" style={{ borderColor: COLORS.border }} aria-label="直接证据">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-semibold tracking-wide" style={{ color: COLORS.faint }}>直接证据</span>
            <span className="text-[10px]" style={{ color: COLORS.faint }}>驱动 · 近5个有效观测</span>
          </div>
          {view.evidence.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {view.evidence.map((item) => (
                <span
                  key={item.id}
                  title={`${item.label}：${item.startDate} 至 ${item.endDate}${item.stale ? "；更新较慢" : ""}`}
                  className="rounded-md border bg-[#faf8f2] px-2 py-1 text-[12px]"
                  style={{ borderColor: COLORS.border, color: COLORS.text }}
                >
                  {item.label} <b className="font-mono">{arrow(item.direction)} {formatWhatChangedEvidence(item)}</b>
                  {item.auxiliary && <span style={{ color: COLORS.faint }}> · 辅助</span>}
                  {item.stale && <span style={{ color: COLORS.caution }}> · 更新较慢</span>}
                  <span className="sr-only">，数据截至 {item.endDate}</span>
                </span>
              ))}
            </div>
          ) : <p className="mt-1.5 text-[13px]" style={{ color: COLORS.muted }}>宏观变化数据不足</p>}
        </section>

        <section className="min-w-0 border-t pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0" style={{ borderColor: COLORS.border }} aria-label="下一观察点">
          <div className="text-[11px] font-semibold tracking-wide" style={{ color: COLORS.faint }}>下一观察点</div>
          {view.nextWatch.kind === "event" ? (
            <>
              <div className="mt-1 break-words text-[14px] font-bold" style={{ color: COLORS.text }}>{view.nextWatch.label}</div>
              <div className="mt-1 text-[12px]" style={{ color: COLORS.gold }}>
                {view.nextWatch.hoursUntil === 0 ? "正在发生" : `约 ${view.nextWatch.hoursUntil} 小时后`} · 方向未知
              </div>
              <div className="mt-0.5 text-[11px]" style={{ color: COLORS.faint }}>已知重要事件，不预判影响</div>
            </>
          ) : <p className="mt-1 text-[13px] leading-relaxed" style={{ color: COLORS.muted }}>{view.nextWatch.label}</p>}
        </section>
      </div>

      <p className="mt-3 border-t pt-2 text-[10px]" style={{ borderColor: COLORS.border, color: COLORS.faint }}>{view.disclaimer}</p>
    </article>
  );
}
