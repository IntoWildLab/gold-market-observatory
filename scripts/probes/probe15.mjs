// Probe 15: inspect supply-demand 43, gold-prices page chart ids, chart-data-exporter usage.
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

// 1. supply-demand 43 structure
const sd = JSON.parse(readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-sd43.txt', 'utf8'));
const cd = sd.chartData || {};
console.log('### sd43 chartData keys:', Object.keys(cd));
const s = JSON.stringify(cd);
const cbIdx = s.search(/central|Central|bank|Bank/);
console.log('sd43 mentions central/bank at:', cbIdx, cbIdx >= 0 ? s.slice(cbIdx - 100, cbIdx + 300) : '');
const seriesKeys = Object.keys(cd);
for (const k of seriesKeys.slice(0, 4)) {
  const v = cd[k];
  console.log(`  [${k}]:`, JSON.stringify(v).slice(0, 400));
}

// 2. gold-prices page: chart ids / exporter
const gp = await get('https://www.gold.org/goldhub/data/gold-prices');
show('wgc-gold-prices', gp, 2);
const gpHits = [...gp.txt.matchAll(/data-chart-([a-z-]+)="([^"]+)"/g)].map((m) => m.slice(1, 3));
console.log('gold-prices data-chart attrs:', gpHits.slice(0, 15));
const exporter = [...gp.txt.matchAll(/.{0,120}chart-data-exporter.{0,200}/gs)].map((m) => m[0].replace(/\s+/g, ' '));
console.log('gold-prices exporter contexts:', exporter.slice(0, 5));

// 3. reserves page: chart-id / exporter contexts
const wgc = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-gold-reserves.txt', 'utf8');
const chartIds = [...wgc.matchAll(/data-chart-([a-z-]+)="([^"]+)"/g)].map((m) => m.slice(1, 3));
console.log('\nreserves data-chart attrs:', chartIds.slice(0, 15));
const expCtx = [...wgc.matchAll(/.{0,100}chart-data-exporter.{0,150}/gs)].map((m) => m[0].replace(/\s+/g, ' '));
console.log('reserves exporter contexts:', expCtx.slice(0, 5));
const chIdCtx = [...wgc.matchAll(/.{0,80}(?:chart-id|chartid|chart_id).{0,120}/gi)].map((m) => m[0].replace(/\s+/g, ' '));
console.log('reserves chart-id contexts:', chIdCtx.slice(0, 8));

// 4. Test exporter endpoint with guesses
for (const u of ['https://chart-data-exporter.gold.org/export?chart=1', 'https://chart-data-exporter.gold.org/export?id=1', 'https://chart-data-exporter.gold.org/']) {
  const r = await get(u);
  console.log(`\n### exporter ${u}:`, r.status, r.txt.slice(0, 200).replace(/\s+/g, ' '));
}

// 5. gold-etfs page: chart attrs
const etf = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-gold-etfs.txt', 'utf8');
const etfChart = [...etf.matchAll(/data-chart-([a-z-]+)="([^"]+)"/g)].map((m) => m.slice(1, 3));
console.log('\ngold-etfs data-chart attrs:', etfChart.slice(0, 15));

console.log('\nDONE');
