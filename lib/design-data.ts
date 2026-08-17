/**
 * 设计探索专用数据切片: 只传预览页需要的最小字段, 避免把全量快照序列化到客户端。
 * 仅用于 /design-v1..v3 预览, 不改动正式页数据装配。
 */

import "server-only";
import type { PageData } from "./page-data";

export interface DesignData {
  manifestGeneratedAt: string | null;
  gold: PageData["gold"];
  macros: PageData["macros"];
  china: PageData["china"];
  comparison: PageData["comparison"];
  theoretical: PageData["theoretical"];
  etf: PageData["etf"];
  structure: PageData["structure"];
  temperature: PageData["temperature"];
  drivers: PageData["drivers"];
  charts: Array<Pick<PageData["charts"][number], "seriesId" | "label" | "unit" | "frequency" | "source"> & { points: Array<{ date: string; value: number | null }> }>;
  /** ETF 区域持仓(用于 donut 与 100% 份额堆叠) */
  etfRegional: Array<{ date: string; northAmerica: number | null; europe: number | null; asia: number | null; other: number | null; total: number | null }>;
  /** 全球ETF资金流(美元) */
  etfFlowsUsd: Array<{ date: string; totalUsd: number }>;
  series: Array<{
    name: string;
    isProxy: boolean;
    source: string;
    frequency: string;
    lastObservationDate: string | null;
    lastFetchedAt: string;
  }>;
}

const MAX_POINTS = 260;

export function buildDesignData(d: PageData): DesignData {
  return {
    manifestGeneratedAt: d.manifestGeneratedAt,
    gold: d.gold,
    macros: d.macros,
    china: d.china,
    comparison: d.comparison,
    theoretical: d.theoretical,
    etf: d.etf,
    structure: d.structure,
    temperature: d.temperature,
    drivers: d.drivers,
    charts: d.charts.map((c) => ({
      seriesId: c.seriesId,
      label: c.label,
      unit: c.unit,
      frequency: c.frequency,
      source: c.source,
      points: c.points.slice(-MAX_POINTS),
    })),
    etfRegional: (d.etfRegional ?? []).slice(-130),
    etfFlowsUsd: (d.etfFlowsUsd ?? []).slice(-130),
    series: Object.values(d.series)
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .map((s) => ({
        name: s.meta.name,
        isProxy: Boolean(s.meta.source.is_proxy_of),
        source: s.meta.source.name,
        frequency: s.meta.frequency,
        lastObservationDate: s.last_observation_date,
        lastFetchedAt: s.last_fetched_at,
      })),
  };
}
