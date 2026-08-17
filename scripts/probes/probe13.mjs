// Probe 13: WGC drupalSettings, gold-demand page, datahub xlsx links, central banks page, quick FRED batch.
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
await mkdir('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out', { recursive: true });

async function get(u, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(u, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'accept': '*/*', ...headers } });
    return { status: r.status, txt: await r.text() };
  } catch (e) { return { status: -1, txt: '', err: `${e.name}: ${e.message}` }; }
  finally { clearTimeout(t); }
}
function show(name, res, n = 4) {
  const lines = res.txt.split(/\r?\n/).filter((l) => l.trim());
  console.log(`\n### ${name}: status=${res.status} ${res.err || ''} bytes=${res.txt.length}`);
  for (const l of lines.slice(0, n)) console.log('  ' + l.slice(0, 300));
  if (res.txt.length > 100 && res.txt.length < 3000000) writeFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/${name}.txt`, res.txt);
}

// 1. drupalSettings from reserves page
const wgc = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-gold-reserves.txt', 'utf8');
const dsIdx = wgc.indexOf('drupalSettings');
if (dsIdx >= 0) {
  const chunk = wgc.slice(dsIdx, dsIdx + 6000);
  const urlHits = [...chunk.matchAll(/[a-z-]+":\s*"([^"]*(?:chart|data|url|api)[^"]*)"/gi)].map((m) => m[1]);
  console.log('\ndrupalSettings url-ish keys:', urlHits.slice(0, 15));
  const fs = [...chunk.matchAll(/fsapi[^"\\]+/g)].map((m) => m[0]);
  console.log('drupalSettings fsapi:', fs.slice(0, 10));
}

// 2. gold-demand-by-country page
const gd = await get('https://www.gold.org/goldhub/data/gold-demand-by-country');
show('wgc-gold-demand', gd, 2);
const gdFiles = [...gd.txt.matchAll(/href="([^"]+\.(?:xlsx|csv))"/g)].map((m) => m[1]);
console.log('gold-demand xlsx/csv:', [...new Set(gdFiles)].slice(0, 10));
const gdFsapi = [...gd.txt.matchAll(/fsapi\.gold\.org\/api\/v\d+[^"'\s<>]+/g)].map((m) => m[0]);
console.log('gold-demand fsapi:', [...new Set(gdFsapi)].slice(0, 10));

// 3. datahub saved page: all download links
const dh = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-datahub.txt', 'utf8');
const dhFiles = [...dh.matchAll(/href="([^"]+\.(?:xlsx|csv))"/g)].map((m) => m[1]);
console.log('\ndatahub xlsx/csv:', [...new Set(dhFiles)].slice(0, 15));

// 4. central banks research page
const cb = await get('https://www.gold.org/goldhub/research/central-banks');
show('wgc-central-banks', cb, 2);
const cbLinks = [...cb.txt.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
console.log('central-banks links (data):', [...new Set(cbLinks)].filter((h) => /data|xlsx|download|gold-demand/i.test(h)).slice(0, 15));

// 5. Quick FRED batch test (working now)
for (const id of ['GOLDAMGBD228NLBM', 'DTWEXBGS', 'DFII10']) {
  const f = await get(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=2025-08-01&coed=2026-08-16`);
  console.log(`\n### FRED quick ${id}:`, f.status, 'bytes=', f.txt.length, f.txt.slice(0, 60).replace(/\n/g, ' | '));
  await new Promise((r) => setTimeout(r, 5000));
}

console.log('\nDONE');
