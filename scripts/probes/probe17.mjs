// Probe 17: gold series date ranges, CBD bundle API strings, PBoC 2025 page table.
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

// 1. date ranges
const price = JSON.parse(readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-goldprice-chart.txt', 'utf8')).chartData;
const main = JSON.parse(readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-goldprice-main.txt', 'utf8')).chartData;
const fmt = (ts) => new Date(ts).toISOString().slice(0, 10);
console.log('chart/price USD points:', price.USD.length);
console.log('  first:', JSON.stringify(price.USD[0]), ' second:', JSON.stringify(price.USD[1]), ' last:', JSON.stringify(price.USD[price.USD.length - 1]));
console.log('  timestamps: first2', fmt(price.USD[1][0]), 'last', fmt(price.USD[price.USD.length - 1][0]));
console.log('lbma_pm_usd points:', main.lbma_pm_usd.length, 'first', fmt(main.lbma_pm_usd[0][0]), 'last', fmt(main.lbma_pm_usd[main.lbma_pm_usd.length - 1][0]), 'last val', main.lbma_pm_usd[main.lbma_pm_usd.length - 1]);
console.log('lbma_am_usd points:', main.lbma_am_usd.length, 'first', fmt(main.lbma_am_usd[0][0]), 'last', fmt(main.lbma_am_usd[main.lbma_am_usd.length - 1][0]));

// 2. CBD bundle API strings
const cbd = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-cbd-app.txt', 'utf8');
const apiStrs = [...cbd.matchAll(/["'`](\/api\/[^"'`]{0,80})["'`]/g)].map((m) => m[1]);
console.log('\nCBD bundle /api/ strings:', [...new Set(apiStrs)].slice(0, 30));
const chartStrs = [...cbd.matchAll(/["'`]([^"'`]*(?:charts|holdings|official|reserve)[^"'`]{0,60})["'`]/gi)].map((m) => m[1]);
console.log('CBD chart-ish strings:', [...new Set(chartStrs)].filter((s) => s.length > 5 && s.length < 80).slice(0, 25));

// 3. PBoC 2025 year page content
const pbc = await get('https://www.pbc.gov.cn/en/3688110/3688259/3689026/3706088/5624524/index.html');
writeFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/pbc-en-2025.txt', pbc.txt);
const goldCtx = [...pbc.txt.matchAll(/.{150}[Gg]old.{150}/g)].map((m) => m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
console.log('\nPBoC 2025 page gold contexts:', goldCtx.slice(0, 4));
const tbl = pbc.txt.match(/<table[\s\S]{0,2000}?<\/table>/);
console.log('PBoC 2025 first table found:', !!tbl, tbl ? tbl[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300) : '');

console.log('\nDONE');
