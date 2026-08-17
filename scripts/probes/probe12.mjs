// Probe 12: WGC spotprice content, metals.live, Yahoo crumb flow, WGC escaped fsapi URLs, direct xlsx, FRED cooldown.
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
await mkdir('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out', { recursive: true });

async function get(u, headers = {}, cookie = '') {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(u, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'accept': '*/*', 'cookie': cookie, ...headers } });
    return { status: r.status, txt: await r.text(), hdrs: r.headers };
  } catch (e) { return { status: -1, txt: '', err: `${e.name}: ${e.message}` }; }
  finally { clearTimeout(t); }
}
function show(name, res, n = 8) {
  const lines = res.txt.split(/\r?\n/).filter((l) => l.trim());
  console.log(`\n### ${name}: status=${res.status} ${res.err || ''} bytes=${res.txt.length}`);
  for (const l of lines.slice(0, n)) console.log('  ' + l.slice(0, 400));
  if (res.txt.length > 100 && res.txt.length < 3000000) writeFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/${name}.txt`, res.txt);
}

// 1. WGC spotprice content
const sp = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-spotprice.txt', 'utf8');
console.log('### wgc-spotprice JSON:', sp.slice(0, 2000));

// 2. metals.live
show('metals-live', await get('https://api.metals.live/v1/spot'));

// 3. Yahoo crumb flow
const y1 = await get('https://fc.yahoo.com');
console.log('\n### yahoo fc.yahoo.com:', y1.status, 'set-cookie:', (y1.hdrs.get('set-cookie') || '').slice(0, 100));
const yc = y1.hdrs.get('set-cookie') || '';
const y2 = await get('https://query1.finance.yahoo.com/v1/test/getcrumb', {}, yc);
console.log('### yahoo getcrumb:', y2.status, 'crumb:', y2.txt.slice(0, 60), 'set-cookie2:', (y2.hdrs.get('set-cookie') || '').slice(0, 80));
const y3 = await get('https://query1.finance.yahoo.com/v8/finance/chart/%5EDXY?range=1mo&interval=1d', { 'accept': 'application/json', 'crumb': y2.txt.trim() }, yc + '; ' + (y2.hdrs.get('set-cookie') || ''));
show('yahoo-dxy-crumb', y3, 4);

// 4. WGC reserves page escaped fsapi contexts
const wgc = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-gold-reserves.txt', 'utf8');
const fsapiCtx = [...wgc.matchAll(/.{80}fsapi\.gold\.org.{120}/gs)].map((m) => m[0].replace(/\s+/g, ' '));
console.log('\nWGC reserves fsapi contexts:', fsapiCtx.slice(0, 8));

// 5. Direct sites/default/files xlsx
try {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  const r = await fetch('https://www.gold.org/sites/default/files/downloads/2026-01/template%20%282%29_0.xlsx', { signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0', 'referer': 'https://www.gold.org/goldhub/data/gold-etfs-holdings-and-flows' } });
  const buf = Buffer.from(await r.arrayBuffer());
  console.log(`\n### wgc-etf-template-xlsx: status=${r.status} bytes=${buf.length} head=${buf.slice(0, 4).toString()}`);
  if (buf.length > 5000 && buf[0] === 0x50) { writeFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-etf-template.xlsx', buf); console.log('  saved'); }
  clearTimeout(t);
} catch (e) { console.log('wgc-etf-template ERR', e.message); }

// 6. FRED single cooldown test
console.log('\n### FRED cooldown test...');
const f = await get('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10&cosd=2026-07-01&coed=2026-08-16');
console.log('fred DGS10:', f.status, 'bytes=', f.txt.length, 'head=', f.txt.slice(0, 60).replace(/\n/g, ' | '));

// 7. gold-api docs: grep history
const doc = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/goldapi-doc.txt', 'utf8');
const histHits = [...doc.matchAll(/.{60}(?:history|historical|date).{80}/gi)].map((m) => m[0].replace(/\s+/g, ' '));
console.log('\ngold-api docs history mentions:', [...new Set(histHits)].slice(0, 6));

console.log('\nDONE');
