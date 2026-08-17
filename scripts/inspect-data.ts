/**
 * 数据快照检查: 打印每个系列的统计摘要(条数/起止日期/最新值/来源)。
 * 用法: npm run data:inspect
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { SeriesFile } from "../types";

async function main(): Promise<void> {
  const dir = path.join(process.cwd(), "data", "series");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  console.log(`共 ${files.length} 个系列\n`);
  const rows: string[][] = [];
  for (const f of files.sort()) {
    const sf = JSON.parse(await readFile(path.join(dir, f), "utf8")) as SeriesFile;
    const obs = sf.observations;
    const first = obs[0]?.observation_date ?? "—";
    const last = obs[obs.length - 1]?.observation_date ?? "—";
    const lastVal = obs.length ? obs[obs.length - 1].value : null;
    const mock = obs.some((o) => o.is_mock) ? " [含Mock]" : "";
    rows.push([sf.meta.series, String(obs.length), first, last, lastVal === null ? "—" : String(lastVal), sf.meta.source.name + mock]);
  }
  const w = [28, 6, 12, 12, 14, 40];
  const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
  console.log([pad("series", w[0]), pad("n", w[1]), pad("first", w[2]), pad("last", w[3]), pad("lastVal", w[4]), pad("source", w[5])].join(" "));
  console.log("-".repeat(w.reduce((a, b) => a + b, 0)));
  for (const r of rows) console.log(r.map((c, i) => pad(c, w[i])).join(" "));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
