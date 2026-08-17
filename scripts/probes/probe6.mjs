// Probe 6: WGC fsapi JSON, WGC xlsx downloads, SPDR GLD page, FRED series existence.
import { writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
await mkdir('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out', { recursive: true });

async function get(u, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(u, {
      signal: ctrl.signal, redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'accept': '*/*', ...headers },
    });
    return { status: r.status, txt: await r.text() };
  } catch (e) { return { status: -1, txt: '', err: `${e.name}: ${e.message}` }; }
  finally { clearTimeout(t); }
}
function show(name, res, n = 6) {
  const lines = res.txt.split(/\r?\n/).filter((l) => l.trim());
  console.log(`\n### ${name}: status=${res.status} ${res.err || ''} bytes=${res.txt.length} lines=${lines.length}`);
  for (const l of lines.slice(0, n)) console.log('  ' + l.slice(0, 300));
  if (res.txt.length > 100) writeFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/${name}.txt`, res.txt.slice(0, 1500000));
}

// WGC ETF flows / holdings / archive APIs
const b = 'https://fsapi.gold.org/api/v11/charts/etfv2/revised/';
show('wgc-etf-flows', await get(b + 'flows-chart2?break-cache=0'));
show('wgc-etf-holdings', await get(b + 'holdings-chart2?break-cache=0'));
show('wgc-etf-archive', await get(b + 'archive-tablegroup/all?break-cache=0'));

// WGC xlsx downloads (holdings by country + changes) - save binary-ish via base64
for (const [name, path] of [
  ['wgc-world-holdings', 'https://www.gold.org/download/file/7739/World_official_gold_holdings_as_of_Aug2026_IFS.xlsx'],
  ['wgc-changes', 'https://www.gold.org/download/file/7741/Changes_latest_as_of_Aug2026_IFS.xlsx'],
  ['wgc-etf-xlsx', 'https://www.gold.org/download/file/21037/ETF_Flows_2026-08-04_1202.xlsx'],
]) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(path, { signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0' } });
    const buf = Buffer.from(await r.arrayBuffer());
    console.log(`\n### ${name}: status=${r.status} bytes=${buf.length}`);
    if (buf.length > 100 && buf.length < 2000000) {
      writeFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/${name}.xlsx`, buf);
      console.log('  saved xlsx');
    }
  } catch (e) { console.log(`\n### ${name}: ERR ${e.message}`); }
  finally { clearTimeout(t); }
}

// SPDR GLD product page
const spdrGld = await get('https://www.spdrgoldshares.com/usa/gld/');
show('spdr-gld', spdrGld, 2);
const urls = [...spdrGld.txt.matchAll(/https?:\/\/[^"'\s<>]+/g)].map((m) => m[0]);
console.log('\nSPDR GLD urls:', [...new Set(urls)].filter((h) => /api|json|holdings|data/i.test(h)).slice(0, 30));
const hrefs = [...spdrGld.txt.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
console.log('SPDR GLD hrefs:', [...new Set(hrefs)].filter((h) => /holdings|api|json/i.test(h)).slice(0, 30));

// FRED series pages existence
show('fred-series-dgs10', await get('https://fred.stlouisfed.org/series/DGS10'), 2);
show('fred-series-gold', await get('https://fred.stlouisfed.org/series/GOLDAMGBD228NLBM'), 2);

console.log('\nDONE');
