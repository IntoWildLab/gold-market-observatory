import type { DesignData } from "@/lib/design-data-builder";

export default function V5DataAvailability({ missing }: { missing: DesignData["missing"] }) {
  if (missing.length === 0) return null;
  return <aside className="v5-data-availability" aria-label="数据可用性提示" data-v5-missing-count={missing.length}>
    <strong>当前部分观察不可用</strong>
    <span>数据不完整，{missing.length} 项来源暂缺；对应位置保留空值，不作估算。</span>
  </aside>;
}
