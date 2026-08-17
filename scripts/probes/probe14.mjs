// Probe 14: 403 body inspection, reserves charts pattern, supply-demand JSON, GOLD PM fix, gold-api docs endpoints, LBMA api.
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
function show(name, res, n = 5) {
  const lines = res.txt.split(/\r?\n/).filter((l) => l.trim());
  console.log(`\n### ${name}: status=${res.status} ${res.err || ''} bytes=${res.txt.length}`);
  for (const l of lines.slice(0, n)) console.log('  ' + l.slice(0, 300));
  if (res.txt.length > 100 && res.txt.length < 3000000) writeFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/${name}.txt`, res.txt);
}

// 1. What does the 403 body say?
const r403 = await get('https://www.gold.org/download/file/7739/World_official_gold_holdings_as_of_Aug2026_IFS.xlsx');
console.log('### 403 body head:', r403.txt.slice(0, 700).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400));

// 2. reserves page charts patterns
const wgc = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-gold-reserves.txt', 'utf8');
const chartHits = [...wgc.matchAll(/"([^"]*(?:chart|holding|reserve)[^"]*)"/gi)].map((m) => m[1]);
console.log('\nreserves page chart-ish keys:', [...new Set(chartHits)].filter((h) => /api|url|feed|endpoint|data/i.test(h)).slice(0, 20));

// 3. supply-and-demand chart 43
show('wgc-sd43', await get('https://fsapi.gold.org/api/v11/charts/supply-and-demand/43?break-cache=0'));

// 4. gold-etfs page direct file paths
const etf = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-gold-etfs.txt', 'utf8');
const directFiles = [...etf.matchAll(/["']([^"']*sites\/default\/files[^"']*)["']/g)].map((m) => m[1]);
console.log('\ngold-etfs direct files:', [...new Set(directFiles)].slice(0, 10));

// 5. GOLDPMGBD228NLBM via fredgraph
const pm = await get('https://fred.stlouisfed.org/graph/fredgraph.csv?id=GOLDPMGBD228NLBM&cosd=2025-08-01&coed=2026-08-16');
console.log('\n### fred GOLDPMGBD228NLBM:', pm.status, 'bytes=', pm.txt.length, pm.txt.slice(0, 60).replace(/\n/g, ' | '));

// 6. gold-api docs: endpoint patterns
const doc = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/goldapi-doc.txt', 'utf8');
const apiHits = [...doc.matchAll(/\/price[^"'\s<>\\]*/g)].map((m) => m[0]);
console.log('\ngold-api endpoint patterns:', [...new Set(apiHits)].slice(0, 15));
const histIdx = doc.indexOf('historical');
if (histIdx >= 0) console.log('gold-api historical context:', doc.slice(histIdx - 100, histIdx + 400).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300));

// 7. LBMA api endpoints
const lbma = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/lbma-gold-price.txt', 'utf8');
const lbmaApis = [...lbma.matchAll(/https?:\/\/[^"'\s<>]*(?:api|price|json|download)[^"'\s<>]*/g)].map((m) => m[0]);
console.log('\nLBMA api-ish urls:', [...new Set(lbmaApis)].slice(0, 20));

console.log('\nDONE');
