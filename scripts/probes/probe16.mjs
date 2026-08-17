// Probe 16: WGC gold price chart API, reference prices, CBD app bundle, sd43 demand quarterly full structure.
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
await mkdir('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out', { recursive: true });

async function get(u, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(u, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'accept': '*/*', ...headers } });
    return { status: r.status, txt: await r.text() };
  } catch (e) { return { status: -1, txt: '', err: `${e.name}: ${e.message}` }; }
  finally { clearTimeout(t); }
}
function show(name, res, n = 3) {
  const lines = res.txt.split(/\r?\n/).filter((l) => l.trim());
  console.log(`\n### ${name}: status=${res.status} ${res.err || ''} bytes=${res.txt.length}`);
  for (const l of lines.slice(0, n)) console.log('  ' + l.slice(0, 400));
  if (res.txt.length > 100 && res.txt.length < 5000000) writeFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/${name}.txt`, res.txt);
}

// 1. WGC gold price history chart
show('wgc-goldprice-chart', await get('https://fsapi.gold.org/api/goldprice/v13/chart/price/?cache09092024'));

// 2. WGC reference prices
show('wgc-goldprice-main', await get('https://fsapi.gold.org/api/goldprice/v13/chart/main?cache09092024'));

// 3. CBD app bundle
show('wgc-cbd-app', await get('https://apps.gold.org/cbd-app/latest/fs/index.js'), 2);
const cbd = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-cbd-app.txt', 'utf8');
const endp = [...cbd.matchAll(/["'](https?:)?\\?\/\\?\/[^"']*(?:api|chart|data|json)[^"']*["']/g)].map((m) => m[1]);
console.log('\nCBD app endpoints:', [...new Set(endp)].slice(0, 30));
const fsapiInCbd = [...cbd.matchAll(/fsapi[^"'\s]{0,120}/g)].map((m) => m[0]);
console.log('CBD fsapi refs:', [...new Set(fsapiInCbd)].slice(0, 20));

// 4. sd43 Demand_Quarterly full
const sd = JSON.parse(readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-sd43.txt', 'utf8'));
const dq = sd.chartData.Demand_Quarterly;
console.log('\nsd43 Demand_Quarterly categories count:', dq.categories.length, 'last cats:', dq.categories.slice(-6));
console.log('sd43 Demand_Quarterly series names:', dq.series.map((s) => s.name).join(', '));
const cb = dq.series.find((s) => s.name.includes('Central'));
console.log('Central banks quarterly data len:', cb ? cb.data.length : 'n/a', 'last 8:', cb ? cb.data.slice(-8) : '');
console.log('paired cats:', dq.categories.slice(-8).join(' | '));

console.log('\nDONE');
