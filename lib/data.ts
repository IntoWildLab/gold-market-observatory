/**
 * 服务端数据加载器: 读取 data/ 下的快照文件。
 * 仅可在服务端使用 (依赖 fs)。
 */

import "server-only";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { SeriesFile, SeriesId } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const SERIES_DIR = path.join(DATA_DIR, "series");

export async function loadSeries(id: SeriesId): Promise<SeriesFile | null> {
  try {
    const raw = await readFile(path.join(SERIES_DIR, `${id}.json`), "utf8");
    return JSON.parse(raw) as SeriesFile;
  } catch {
    return null;
  }
}

export async function loadAllSeries(): Promise<SeriesFile[]> {
  const files = (await readdir(SERIES_DIR)).filter((f) => f.endsWith(".json"));
  const out: SeriesFile[] = [];
  for (const f of files) {
    try {
      const sf = JSON.parse(await readFile(path.join(SERIES_DIR, f), "utf8")) as SeriesFile;
      out.push(sf);
    } catch {
      /* skip */
    }
  }
  return out;
}

export async function loadManifest(): Promise<{ generated_at: string; series: Array<Record<string, unknown>> } | null> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, "manifest.json"), "utf8"));
  } catch {
    return null;
  }
}

export interface LatestSpot {
  price_usd: number;
  as_of_date: string;
  timestamp: string;
  fetched_at: string;
  source: { name: string; url: string; update_note: string };
  cross_check: { price_usd: number; updated_at: string; source: string } | null;
}

export async function loadLatestSpot(): Promise<LatestSpot | null> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, "latest-spot.json"), "utf8"));
  } catch {
    return null;
  }
}

export interface LatestCnEtf {
  code: string;
  name: string;
  price: number;
  prev_close: number;
  change_pct: number | null;
  volume_shares: number | null;
  amount: number | null;
  quote_date: string;
  quote_time: string;
  fetched_at: string;
  source: { name: string; url: string; note: string };
}

export async function loadLatestCnEtf(): Promise<LatestCnEtf | null> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, "latest-cn-etf.json"), "utf8"));
  } catch {
    return null;
  }
}

export async function loadDerived(name: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, "derived", name), "utf8"));
  } catch {
    return null;
  }
}
