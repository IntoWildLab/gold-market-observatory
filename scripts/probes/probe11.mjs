// Probe 11: gold-api.com history, WGC spotprice, WGC xlsx with cookie, WGC reserves page URL patterns.
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
await mkdir('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out', { recursive: true });

async function get(u, headers = {}, raw = false) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(u, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'accept': '*/*', ...headers } });
    const txt = raw ? await r.text() : await r.text();
    return { status: r.status, txt, headers: r.headers };
  } catch (e) { return { status: -1, txt: '', err: `${e.name}: ${e.message}` }; }
  finally { clearTimeout(t); }
}
function show(name, res, n = 5) {
  const lines = res.txt.split(/\r?\n/).filter((l) => l.trim());
  console.log(`\n### ${name}: status=${res.status} ${res.err || ''} bytes=${res.txt.length}`);
  for (const l of lines.slice(0, n)) console.log('  ' + l.slice(0, 350));
  if (res.txt.length > 100 && res.txt.length < 3000000) writeFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/${name}.txt`, res.txt);
}

// 1. gold-api.com history attempts
show('goldapi-hist1', await get('https://api.gold-api.com/price/XAU?date=2026-08-14'));
show('goldapi-hist2', await get('https://api.gold-api.com/price/XAU/2026-08-14'));
show('goldapi-doc', await get('https://gold-api.com/'), 8);

// 2. WGC spotprice v13
show('wgc-spotprice', await get('https://fsapi.gold.org/api/goldprice/v13/charts/spotprice?break-cache=0'));

// 3. WGC reserves page with session cookie -> xlsx
const page = await get('https://www.gold.org/goldhub/data/gold-reserves-by-country');
const cookie = (page.headers.get('set-cookie') || '').split(';')[0];
console.log('\nWGC reserves page set-cookie:', cookie || 'none');
for (const [n, p] of [['wgc-world-holdings3', 'https://www.gold.org/download/file/7739/World_official_gold_holdings_as_of_Aug2026_IFS.xlsx'],
                      ['wgc-changes3', 'https://www.gold.org/download/file/7741/Changes_latest_as_of_Aug2026_IFS.xlsx']]) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(p, { signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0', 'referer': 'https://www.gold.org/goldhub/data/gold-reserves-by-country', cookie: cookie || '', 'accept': '*/*' } });
    const buf = Buffer.from(await r.arrayBuffer());
    console.log(`### ${n}: status=${r.status} bytes=${buf.length} head=${buf.slice(0, 4).toString()}`);
    if (buf.length > 5000 && buf[0] === 0x50) { writeFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/${n}.xlsx`, buf); console.log('  saved'); }
  } catch (e) { console.log(`### ${n}: ERR ${e.message}`); }
  finally { clearTimeout(t); }
}

// 4. WGC reserves page: broader URL patterns
const wgc = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-gold-reserves.txt', 'utf8');
const allUrls = [...wgc.matchAll(/(?:href|src|data-[a-z-]*)=["']([^"']+)["']/g)].map((m) => m[1]);
console.log('\nWGC reserves page all urls (interesting):', [...new Set(allUrls)].filter((h) => /api|json|chart|download|file|xlsx|csv/i.test(h)).slice(0, 40));

// 5. WGC datahub page: gold demand / central bank links
const dh = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-datahub.txt', 'utf8');
const dhUrls = [...dh.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
console.log('\nWGC datahub hrefs (demand/cb):', [...new Set(dhUrls)].filter((h) => /demand|central|reserve|etf/i.test(h)).slice(0, 20));

console.log('\nDONE');
