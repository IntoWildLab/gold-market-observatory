import type { Observation } from "../types";

/** 合并新旧观测；内容未变时保留首次成功抓取时间，空抓取不会清空旧快照。 */
export function mergeObservations(existing: Observation[] | null | undefined, next: Observation[]): Observation[] {
  const map = new Map<string, Observation>();
  for (const item of existing ?? []) map.set(item.observation_date, item);
  for (const item of next) {
    const previous = map.get(item.observation_date);
    if (previous) {
      const { fetched_at: _previousFetchedAt, ...previousContent } = previous;
      const { fetched_at: _nextFetchedAt, ...nextContent } = item;
      if (JSON.stringify(previousContent) === JSON.stringify(nextContent)) continue;
    }
    map.set(item.observation_date, item);
  }
  return [...map.values()].sort((a, b) => a.observation_date.localeCompare(b.observation_date));
}
