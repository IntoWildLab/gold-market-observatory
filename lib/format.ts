/** 数字格式化与涨跌样式工具 */

export function fmtNumber(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPrice(v: number | null | undefined): string {
  return fmtNumber(v, 2);
}

export function fmtSigned(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const s = v > 0 ? "+" : "";
  return s + v.toFixed(digits);
}

/** 涨跌颜色 class: 中国习惯 红涨绿跌 */
export function pnlClass(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v) || v === 0) return "text-neutral-400";
  return v > 0 ? "text-up" : "text-down";
}

/** 涨跌箭头 */
export function pnlArrow(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v) || v === 0) return "–";
  return v > 0 ? "▲" : "▼";
}

/** 指数等保留 2-3 位小数 */
export function fmtIndex(v: number | null | undefined, digits = 2): string {
  return fmtNumber(v, digits);
}

/** 吨数 */
export function fmtTonnes(v: number | null | undefined, digits = 1): string {
  return fmtNumber(v, digits);
}

export function fmtDateCn(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso;
}
