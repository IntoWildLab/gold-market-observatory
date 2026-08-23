/**
 * 设计探索专用数据切片: 只传预览页需要的最小字段, 避免把全量快照序列化到客户端。
 * 仅用于 /design-v1..v3 预览, 不改动正式页数据装配。
 */

import "server-only";
export { buildDesignData } from "./design-data-builder";
export type {
  DesignAvailability,
  DesignChinaBenchmark,
  DesignChinaGoldAttribution,
  DesignCnGoldEtf,
  DesignData,
  DesignWindow,
  DesignWindowSet,
} from "./design-data-builder";
