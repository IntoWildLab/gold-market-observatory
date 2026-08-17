"use client";

import { fmtDateCn } from "@/lib/format";

interface Props {
  today: string;
  lastRefresh: string | null;
  missingCount: number;
  hasProxyNote: boolean;
}

export default function Header({ today, lastRefresh, missingCount, hasProxyNote }: Props) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-wide text-[#e6edf3]">
            黄金市场观察站
            <span className="ml-3 text-sm font-normal text-[#8b949e]">Gold Market Observatory</span>
          </h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            黄金价格 · 美元 · 实际利率 · 美债收益率 · ETF资金流 · 央行购金 —— 真实数据，可解释，可运行
          </p>
        </div>
        <div className="text-right text-xs text-[#8b949e] space-y-1">
          <div>
            当前日期: <span className="num text-[#e6edf3]">{fmtDateCn(today)}</span>
          </div>
          <div>
            最近数据刷新:{" "}
            <span className="num text-[#e6edf3]">{lastRefresh ? new Date(lastRefresh).toLocaleString("zh-CN", { hour12: false }) : "—"}</span>
          </div>
          <div>
            数据源状态:{" "}
            {missingCount === 0 ? (
              <span className="text-emerald-400">全部系列已有数据</span>
            ) : (
              <span className="text-amber-400">存在 {missingCount} 个系列缺失</span>
            )}
            {hasProxyNote && <span className="ml-2 text-sky-400">含代理指标</span>}
          </div>
        </div>
      </div>
    </header>
  );
}
