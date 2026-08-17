// Probe 10: gold-api.com, LBMA data, WGC xlsx with referer, FRED alternate endpoints, SPDR xlsx parse prep.
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

// 1. gold-api.com
show('gold-api-xau', await get('https://api.gold-api.com/price/XAU'));
show('gold-api-all', await get('https://api.gold-api.com/price'), 3);

// 2. LBMA gold price data page
const lbma = await get('https://www.lbma.org.uk/prices-and-data/lbma-gold-price');
show('lbma-gold-price', lbma, 3);
const hrefs = [...lbma.txt.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
console.log('LBMA gold price hrefs:', [...new Set(hrefs)].filter((h) => /csv|xlsx|download|data|api|json/i.test(h)).slice(0, 25));

// 3. WGC xlsx with Referer
for (const [n, p] of [['wgc-world-holdings2', 'https://www.gold.org/download/file/7739/World_official_gold_holdings_as_of_Aug2026_IFS.xlsx'],
                      ['wgc-changes2', 'https://www.gold.org/download/file/7741/Changes_latest_as_of_Aug2026_IFS.xlsx']]) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(p, { signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0', 'referer': 'https://www.gold.org/goldhub/data/gold-reserves-by-country', 'accept': 'application/octet-stream,*/*' } });
    const buf = Buffer.from(await r.arrayBuffer());
    console.log(`\n### ${n}: status=${r.status} bytes=${buf.length} head=${buf.slice(0, 4).toString()}`);
    if (buf.length > 5000 && buf[0] === 0x50) { writeFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/${n}.xlsx`, buf); console.log('  saved'); }
  } catch (e) { console.log(`\n### ${n}: ERR ${e.message}`); }
  finally { clearTimeout(t); }
}

// 4. FRED alternate per-series CSV endpoint
show('fred-data-dgs10', await get('https://fred.stlouisfed.org/data/DGS10.csv'), 3);
show('fred-data-gold', await get('https://fred.stlouisfed.org/data/GOLDAMGBD228NLBM.csv'), 3);

// 5. WGC gold-prices page download links
const gp = await get('https://www.gold.org/goldhub/data/gold-prices');
const gpHrefs = [...gp.txt.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
console.log('\nWGC gold-prices hrefs:', [...new Set(gpHrefs)].filter((h) => /xlsx|csv|download|file/i.test(h)).slice(0, 15));

// 6. WGC reserves page: grep for api patterns
const wgc = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-gold-reserves.txt', 'utf8');
console.log('\nWGC reserves page "api" mentions:', (wgc.match(/api/g) || []).length);
const apiIdx = wgc.indexOf('api');
if (apiIdx >= 0) console.log('context:', wgc.slice(apiIdx - 150, apiIdx + 300).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300));

console.log('\nDONE');
