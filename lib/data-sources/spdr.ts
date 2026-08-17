/**
 * SPDR Gold Shares (GLD) 官方数据源
 *
 * 端点: https://api.spdrgoldshares.com/api/v1/historical-archive?product=gld&exchange=NYSE&lang=en
 * 返回 xlsx(日频: 日期/价格/份额/持仓等)。
 *
 * 注意: GLD 持仓 ≠ 全球黄金 ETF 总持仓。页面必须标注
 * "该数据为代表性黄金 ETF, 并不等于全球黄金 ETF 总资金流/总持仓"。
 */

import { httpGetBuffer } from "./http";

const ARCHIVE_URL =
  "https://api.spdrgoldshares.com/api/v1/historical-archive?product=gld&exchange=NYSE&lang=en";

export async function downloadGldArchive(): Promise<Buffer> {
  return httpGetBuffer(ARCHIVE_URL, { timeoutMs: 60000, retries: 2 });
}

export interface GldHoldingRow {
  date: string; // YYYY-MM-DD
  sharesOutstanding: number | null;
  holdingsTonnes: number | null;
  priceUsd: number | null;
}

/**
 * 解析 GLD xlsx。xlsx 依赖为可选: 当无法解析时返回 null, 由上层决定回退。
 * 动态 import 以便在未安装 xlsx 时优雅降级。
 *
 * 实际文件结构 (2026-08 实测):
 *   sheet "US GLD Historical Archive" (注意: 第一张表是 Disclaimer, 必须跳过)
 *   列: Date | Closing Price | Ounces of Gold per Share | NAV/Share | Indicative Price |
 *       Mid point | Premium/Discount | Daily Share Volume | Total Ounces of Gold in the Trust |
 *       Total Gold (tonnes) | Total Value ...
 *   日期格式: "18-Nov-2004"
 */
export async function parseGldArchive(buf: Buffer): Promise<GldHoldingRow[] | null> {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "buffer" });
    // 找到包含日期表头的表(跳过 Disclaimer)
    let sheetName: string | null = null;
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: null });
      if (rows.length && Object.keys(rows[0]).some((k) => /date/i.test(k))) {
        sheetName = name;
        break;
      }
    }
    if (!sheetName) return null;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: null });
    if (!rows.length) return null;
    const headers = Object.keys(rows[0]);
    const findCol = (patterns: RegExp[]): string | null =>
      headers.find((h) => patterns.some((p) => p.test(h))) || null;
    const dateCol = findCol([/^date$/i, /^date of/i]);
    const tonnesCol = findCol([/total gold.*tonne/i, /^tonnes/i, /total.*tonnes/i]);
    const ozCol = findCol([/total ounces.*trust/i, /total ounces of gold/i]);
    const sharesCol = findCol([/shares/i]);
    const priceCol = findCol([/^closing price/i, /^price/i, /^nav/i]);
    if (!dateCol) return null;
    const OZ_PER_TONNE = 32150.7466;
    const out: GldHoldingRow[] = [];
    for (const r of rows) {
      const d = parseDateCell(r[dateCol]);
      if (!d) continue;
      let tonnes: number | null = null;
      if (tonnesCol) {
        const v = Number(r[tonnesCol]);
        if (Number.isFinite(v) && v > 0) tonnes = v;
      }
      if (tonnes === null && ozCol) {
        const v = Number(r[ozCol]);
        if (Number.isFinite(v) && v > 0) tonnes = v / OZ_PER_TONNE;
      }
      if (tonnes === null) continue;
      const shares = sharesCol ? Number(r[sharesCol]) || null : null;
      const price = priceCol ? Number(r[priceCol]) || null : null;
      out.push({ date: d, sharesOutstanding: shares, holdingsTonnes: tonnes, priceUsd: price });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

/** 解析 xlsx 日期单元格: 支持 "18-Nov-2004"、Excel 序列号、ISO 字符串 */
function parseDateCell(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    // Excel 序列号
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const mm = months[m[2].toLowerCase()];
    if (mm) return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return s.slice(0, 10);
  return null;
}
