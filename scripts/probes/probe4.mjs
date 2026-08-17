// Probe 4: Frankfurter gold, goldprice.org, SPDR site structure, WGC links, SAFE/PBoC pages.
import { writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

await mkdir('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out', { recursive: true });

async function get(u, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(u, {
      signal: ctrl.signal, redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'accept': '*/*', ...headers },
    });
    const txt = await r.text();
    return { status: r.status, txt };
  } catch (e) {
    return { status: -1, txt: '', err: `${e.name}: ${e.message}` };
  } finally { clearTimeout(t); }
}

function show(name, res, n = 4) {
  const lines = res.txt.split(/\r?\n/).filter((l) => l.trim());
  console.log(`\n### ${name}: status=${res.status} ${res.err || ''} bytes=${res.txt.length} lines=${lines.length}`);
  for (const l of lines.slice(0, n)) console.log('  ' + l.slice(0, 180));
  if (res.txt.length > 100) writeFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/${name}.txt`, res.txt.slice(0, 800000));
}

// 1. Frankfurter (ECB-based) XAU/USD
show('frankfurter-xau-latest', await get('https://api.frankfurter.app/latest?from=XAU&to=USD'));
show('frankfurter-xau-hist', await get('https://api.frankfurter.app/2026-06-01..2026-08-16?from=XAU&to=USD'));

// 2. goldprice.org JSON
show('goldprice-org', await get('https://data-asg.goldprice.org/dbXRates/USD'));

// 3. FRED retries with delay (DTWEXMGS + gold)
for (const id of ['DTWEXMGS', 'GOLDAMGBD228NLBM']) {
  await new Promise((r) => setTimeout(r, 5000));
  show(`fred-${id}`, await get(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=2026-07-01&coed=2026-08-16`));
}

// 4. SPDR main site, grep for holdings/api
const spdrHome = await get('https://www.spdrgoldshares.com/');
show('spdr-home', spdrHome, 2);
const spdrTxt = spdrHome.txt;
const hits = [...spdrTxt.matchAll(/https?:\/\/[^"'\s<>]+/g)].map((m) => m[0]);
const interesting = hits.filter((h) => /api|holdings|json|data/i.test(h));
console.log('\nSPDR interesting URLs found:', [...new Set(interesting)].slice(0, 40));

// 5. WGC data hub pages
const wgcHome = await get('https://www.gold.org/goldhub/data');
show('wgc-datahub', wgcHome, 2);
const wgcHits = [...wgcHome.txt.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => /data|goldhub/i.test(h));
console.log('\nWGC datahub links:', [...new Set(wgcHits)].slice(0, 40));

// 6. SAFE statistics
show('safe-whjzdycx', await get('https://www.safe.gov.cn/safe/whjzdycx/index.html'), 3);

// 7. PBoC English statistics index
show('pbc-en-index', await get('https://www.pbc.gov.cn/en/3688110/3688172/index.html'), 3);
const pbcHits = [...(await get('https://www.pbc.gov.cn/en/3688110/3688172/index.html')).txt.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => /4157443|reserve|gold/i.test(h));
console.log('\nPBoC EN reserve links:', [...new Set(pbcHits)].slice(0, 20));

console.log('\nDONE');
