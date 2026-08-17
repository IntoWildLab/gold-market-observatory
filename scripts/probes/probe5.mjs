// Probe 5: PBoC reserves pages, WGC ETF + reserves data pages, SPDR product links.
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
    return { status: r.status, txt: await r.text() };
  } catch (e) { return { status: -1, txt: '', err: `${e.name}: ${e.message}` }; }
  finally { clearTimeout(t); }
}
function show(name, res, n = 4) {
  const lines = res.txt.split(/\r?\n/).filter((l) => l.trim());
  console.log(`\n### ${name}: status=${res.status} ${res.err || ''} bytes=${res.txt.length} lines=${lines.length}`);
  for (const l of lines.slice(0, n)) console.log('  ' + l.slice(0, 200));
  if (res.txt.length > 100) writeFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/${name}.txt`, res.txt.slice(0, 1000000));
}

// PBoC EN official reserve assets section index
const pbc = await get('https://www.pbc.gov.cn/en/3688110/3688172/4157443/index.html');
show('pbc-en-4157443', pbc, 3);
const pbcLinks = [...pbc.txt.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
console.log('\nPBoC 4157443 links:', [...new Set(pbcLinks)].filter((h) => /415744|html/i.test(h)).slice(0, 25));

// WGC gold ETF holdings & flows
const wgcEtf = await get('https://www.gold.org/goldhub/data/gold-etfs-holdings-and-flows');
show('wgc-gold-etfs', wgcEtf, 2);
const wgcEtfHits = [...wgcEtf.txt.matchAll(/https?:\/\/[^"'\s<>]+/g)].map((m) => m[0]);
console.log('\nWGC ETF URLs:', [...new Set(wgcEtfHits)].filter((h) => /api|json|csv|xlsx|download|statistic/i.test(h)).slice(0, 30));
const wgcEtfHrefs = [...wgcEtf.txt.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
console.log('WGC ETF hrefs:', [...new Set(wgcEtfHrefs)].filter((h) => /api|download|xlsx|csv/i.test(h)).slice(0, 30));

// WGC gold reserves by country
const wgcRes = await get('https://www.gold.org/goldhub/data/gold-reserves-by-country');
show('wgc-gold-reserves', wgcRes, 2);
const wgcResHrefs = [...wgcRes.txt.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
console.log('\nWGC reserves hrefs:', [...new Set(wgcResHrefs)].filter((h) => /api|download|xlsx|csv/i.test(h)).slice(0, 30));

// SPDR home product links
const spdr = await get('https://www.spdrgoldshares.com/');
const spdrHrefs = [...spdr.txt.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
console.log('\nSPDR hrefs:', [...new Set(spdrHrefs)].filter((h) => /gld|holdings/i.test(h)).slice(0, 30));

// Try FRED graph CSV on different subdomain
await new Promise((r) => setTimeout(r, 30000));
const fred2 = await get('https://fredgraph.stlouisfed.org/graph/fredgraph.csv?id=DGS10&cosd=2026-07-01&coed=2026-08-16');
show('fredgraph-subdomain', fred2, 5);

console.log('\nDONE');
