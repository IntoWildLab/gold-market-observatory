// Probe 7: SPDR APIs, WGC JSON structure, PBoC monthly page, FRED retry cadence.
import { writeFileSync, readFileSync } from 'node:fs';
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
function show(name, res, n = 8) {
  const lines = res.txt.split(/\r?\n/).filter((l) => l.trim());
  console.log(`\n### ${name}: status=${res.status} ${res.err || ''} bytes=${res.txt.length}`);
  for (const l of lines.slice(0, n)) console.log('  ' + l.slice(0, 400));
  if (res.txt.length > 100 && res.txt.length < 3000000) writeFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/${name}.txt`, res.txt);
}

// 1. SPDR historical archive + barlist
show('spdr-hist-archive', await get('https://api.spdrgoldshares.com/api/v1/historical-archive?product=gld&exchange=NYSE&lang=en'));
show('spdr-barlist', await get('https://api.spdrgoldshares.com/api/v1/barlist?underlying=gld'), 4);

// 2. Grep saved WGC reserves page for fsapi
const wgcRes = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-gold-reserves.txt', 'utf8');
const fsapiHits = [...wgcRes.matchAll(/https?:\/\/fsapi\.gold\.org\/api\/v\d+[^"'\s<>]+/g)].map((m) => m[0]);
console.log('\nWGC reserves fsapi URLs:', [...new Set(fsapiHits)].slice(0, 20));
const wgcEtfPage = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-gold-etfs.txt', 'utf8');
const fsapiHits2 = [...wgcEtfPage.matchAll(/https?:\/\/fsapi\.gold\.org\/api\/v\d+[^"'\s<>]+/g)].map((m) => m[0]);
console.log('WGC ETF page fsapi URLs:', [...new Set(fsapiHits2)].slice(0, 20));

// 3. PBoC EN monthly official reserve assets page
const pbc = await get('https://www.pbc.gov.cn/en/3688110/3688259/3689026/3706088/3706100/index.html');
show('pbc-en-monthly', pbc, 5);
const goldMentions = pbc.txt.match(/gold|Gold|Gold reserves|gold reserves/g);
console.log('gold mentions count:', goldMentions ? goldMentions.length : 0);

// 4. Inspect WGC ETF JSON structures
for (const f of ['wgc-etf-flows', 'wgc-etf-holdings', 'wgc-etf-archive']) {
  try {
    const j = JSON.parse(readFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/${f}.txt`, 'utf8'));
    console.log(`\n### JSON ${f}: top keys =`, Object.keys(j).slice(0, 12));
    // dig one level
    for (const k of Object.keys(j).slice(0, 6)) {
      const v = j[k];
      if (v && typeof v === 'object') {
        const sample = JSON.stringify(v).slice(0, 500);
        console.log(`  [${k}] type=${Array.isArray(v) ? 'array(' + v.length + ')' : typeof v} sample=${sample}`);
      }
    }
  } catch (e) { console.log(`\n### JSON ${f}: parse error ${e.message}`); }
}

console.log('\nDONE');
