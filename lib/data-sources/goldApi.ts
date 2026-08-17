/**
 * gold-api.com —— 免费实时黄金价格(备用/交叉验证)
 * 仅提供"当前价", 无历史。用于与 WGC 现货报价互相校验。
 */

import { httpGetJson } from "./http";

export interface GoldApiSnapshot {
  price: number;
  updatedAt: string;
}

export async function fetchGoldApiSpot(): Promise<GoldApiSnapshot> {
  const json = await httpGetJson<{ price: number; updatedAt: string }>("https://api.gold-api.com/price/XAU");
  return { price: json.price, updatedAt: json.updatedAt };
}
