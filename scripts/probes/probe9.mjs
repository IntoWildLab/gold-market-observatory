// Probe 9: FRED error msg, ECB XAU, open.er-api gold, LBMA, PBoC monthly structure, IMF http, WGC reserves page.
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
function show(name, res, n = 6) {
  const lines = res.txt.split(/\r?\n/).filter((l) => l.trim());
  console.log(`\n### ${name}: status=${res.status} ${res.err || ''} bytes=${res.txt.length}`);
  for (const l of lines.slice(0, n)) console.log('  ' + l.slice(0, 300));
  if (res.txt.length > 100 && res.txt.length < 3000000) writeFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/${name}.txt`, res.txt);
}

// 1. FRED error page message
const fredErr = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/fred-DTWEXMGS.txt', 'utf8');
const m = fredErr.match(/<(?:h1|h2|p|div)[^>]*>([^<]*(?:error|Error|limit|denied|temporar)[^<]*)</g);
console.log('FRED error page messages:', m ? m.slice(0, 5) : 'none found');

// 2. ECB XAU presence
const ecb = await get('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml');
console.log('\nECB contains XAU:', ecb.txt.includes('XAU'));
console.log('ECB lines with XAU:', ecb.txt.split(/\r?\n/).filter((l) => l.includes('XAU')).join(' | ').slice(0, 300));
console.log('ECB lines with USD:', ecb.txt.split(/\r?\n/).filter((l) => l.includes("currency='USD'")).join(' | ').slice(0, 300));

// 3. open.er-api.com gold support
const era = await get('https://open.er-api.com/v6/latest/USD');
try {
  const j = JSON.parse(era.txt);
  console.log('\nopen.er-api keys sample:', Object.keys(j.rates || {}).slice(0, 10));
  console.log('open.er-api has XAU:', !!(j.rates && j.rates.XAU), 'XAU rate:', j.rates && j.rates.XAU);
  console.log('open.er-api date:', j.date, 'time_last_update:', j.time_last_update_utc);
} catch (e) { console.log('open.er-api parse err', e.message); }
const eraHist = await get('https://open.er-api.com/v6/historical/2026-08-01/USD');
console.log('open.er-api historical status:', eraHist.status, 'has XAU:', eraHist.txt.includes('XAU'), eraHist.txt.slice(0, 120));

// 4. LBMA prices page
const lbma = await get('https://www.lbma.org.uk/prices-and-data/precious-metal-prices');
show('lbma-prices', lbma, 3);
const lbmaHrefs = [...lbma.txt.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
console.log('LBMA hrefs:', [...new Set(lbmaHrefs)].filter((h) => /csv|xlsx|download|api|json|gold/i.test(h)).slice(0, 20));

// 5. PBoC year 2025 page: find monthly data links
const pbc = await get('https://www.pbc.gov.cn/en/3688110/3688259/3689026/3706088/5624524/index.html');
const allHrefs = [...pbc.txt.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
const unique = [...new Set(allHrefs)];
console.log('\nPBoC 2025 page total hrefs:', unique.length);
console.log('PBoC content hrefs (non-menu):', unique.filter((h) => !/3688066|3688080|3688110|3688172|3688175|3688178|3688181|3706088/.test(h) && /html/.test(h)).slice(0, 30));
const months = pbc.txt.match(/January|February|March|April|May|June|July|August|September|October|November|December/g);
console.log('PBoC month names found:', months ? [...new Set(months)] : 'none');
const janIdx = pbc.txt.indexOf('January');
if (janIdx >= 0) console.log('context around January:', pbc.txt.slice(janIdx - 200, janIdx + 400).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400));

// 6. IMF SDMX via http
const imf = await get('http://dataservices.imf.org/REST/SDMX_JSON.svc/CompactData/IFS/M.CN.1GD.BOG.Z?startPeriod=2024-01&endPeriod=2026-08');
show('imf-http-ifs', imf, 3);

// 7. WGC reserves page: does it embed monthly changes table?
const wgc = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-gold-reserves.txt', 'utf8');
console.log('\nWGC reserves page mentions "China":', (wgc.match(/China/g) || []).length, ' "Changes":', (wgc.match(/Changes/g) || []).length);
const chinaIdx = wgc.indexOf('China');
if (chinaIdx >= 0) console.log('context:', wgc.slice(chinaIdx - 150, chinaIdx + 250).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300));

console.log('\nDONE');
