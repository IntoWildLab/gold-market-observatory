// Probe 8: WGC JSON granularity, SPDR xlsx binary, PBoC year page, WGC gold-prices API, FRED cadence.
import { writeFileSync, readFileSync } from 'node:fs';
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

// 1. WGC ETF JSON granularity
for (const f of ['wgc-etf-flows', 'wgc-etf-holdings']) {
  const j = JSON.parse(readFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/${f}.txt`, 'utf8'));
  const data = j.chartData?.data || {};
  console.log(`\n### ${f} chartData.data keys:`, Object.keys(data));
  for (const gran of Object.keys(data)) {
    const g = data[gran];
    console.log(`  granularity [${gran}]: keys=`, Object.keys(g));
    for (const k of Object.keys(g)) {
      const v = g[k];
      if (Array.isArray(v)) { console.log(`    [${k}] array len=${v.length} sample=`, JSON.stringify(v[0])?.slice(0, 200)); }
      else if (v && typeof v === 'object') {
        const sub = Object.keys(v);
        console.log(`    [${k}] object keys=`, sub.slice(0, 10));
        for (const s of sub.slice(0, 3)) {
          const sv = v[s];
          if (Array.isArray(sv)) console.log(`      [${s}] array len=${sv.length} first=`, JSON.stringify(sv[0])?.slice(0, 250));
          else console.log(`      [${s}] =`, JSON.stringify(sv)?.slice(0, 150));
        }
      } else console.log(`    [${k}] = ${v}`);
    }
  }
}

// 2. SPDR xlsx binary download
try {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 40000);
  const r = await fetch('https://api.spdrgoldshares.com/api/v1/historical-archive?product=gld&exchange=NYSE&lang=en', { signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0' } });
  const buf = Buffer.from(await r.arrayBuffer());
  console.log(`\n### spdr xlsx: status=${r.status} bytes=${buf.length} head=${buf.slice(0, 4).toString()}`);
  if (buf.length > 1000 && buf[0] === 0x50) writeFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/spdr-gld-archive.xlsx', buf);
  clearTimeout(t);
} catch (e) { console.log('spdr xlsx ERR', e.message); }

// 3. PBoC EN year pages
for (const id of ['5624524', '5188168']) {
  const p = await get(`https://www.pbc.gov.cn/en/3688110/3688259/3689026/3706088/${id}/index.html`);
  const title = (p.txt.match(/<title>([^<]*)<\/title>/) || [])[1];
  const goldN = (p.txt.match(/gold/gi) || []).length;
  console.log(`\n### pbc year ${id}: status=${p.status} title=${title} goldMentions=${goldN} bytes=${p.txt.length}`);
  const links = [...p.txt.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => /3706088|4157443/.test(h));
  console.log('  links:', [...new Set(links)].slice(0, 30));
}

// 4. WGC gold-prices page for fsapi endpoints
const gp = await get('https://www.gold.org/goldhub/data/gold-prices');
const fsapi = [...gp.txt.matchAll(/https?:\/\/fsapi\.gold\.org\/api\/v\d+[^"'\s<>]+/g)].map((m) => m[0]);
console.log('\nWGC gold-prices fsapi URLs:', [...new Set(fsapi)].slice(0, 20));

// 5. ECB current XAU + USD
const ecb = await get('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml');
const ecbTxt = ecb.txt;
const m = ecbTxt.match(/time='([^']+)'/);
const xau = ecbTxt.match(/currency='XAU' rate='([^']+)'/);
const usd = ecbTxt.match(/currency='USD' rate='([^']+)'/);
console.log(`\n### ECB: date=${m?.[1]} XAU/EUR=${xau?.[1]} EUR/USD=${usd?.[1]} -> implied XAU/USD=${xau && usd ? (parseFloat(xau[1]) * parseFloat(usd[1])).toFixed(2) : 'n/a'}`);

// 6. FRED cadence: one request now, then second after 30s
console.log('\n### FRED cadence test (request 1)...');
const f1 = await get('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DTWEXMGS&cosd=2026-07-01&coed=2026-08-16');
console.log('request1 status=', f1.status, 'bytes=', f1.txt.length, f1.txt.slice(0, 80).replace(/\n/g, ' | '));
await new Promise((r) => setTimeout(r, 30000));
console.log('### FRED request 2 after 30s...');
const f2 = await get('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DTWEXMGS&cosd=2026-07-01&coed=2026-08-16');
console.log('request2 status=', f2.status, 'bytes=', f2.txt.length, f2.txt.slice(0, 80).replace(/\n/g, ' | '));

console.log('\nDONE');
