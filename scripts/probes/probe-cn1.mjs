// Phase 1 probe: China gold layer data sources.
// 1) WGC sge series (already saved) 2) SGE official 3) FRED DEXCHUS 4) ECB CNY 5) open.er-api CNY
// 6) EastMoney 518880 7) fundf10 gmbd 8) Tencent kline 9) Sina quote
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
await mkdir('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out2', { recursive: true });

async function get(u, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(u, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'accept': '*/*', 'referer': 'https://www.gold.org/', ...headers } });
    return { status: r.status, txt: await r.text() };
  } catch (e) { return { status: -1, txt: '', err: `${e.name}: ${e.message}` }; }
  finally { clearTimeout(t); }
}
function show(name, res, n = 4) {
  const lines = res.txt.split(/\r?\n/).filter((l) => l.trim());
  console.log(`\n### ${name}: status=${res.status} ${res.err || ''} bytes=${res.txt.length}`);
  for (const l of lines.slice(0, n)) console.log('  ' + l.slice(0, 250));
  if (res.txt.length > 100 && res.txt.length < 3000000) writeFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out2/${name}.txt`, res.txt);
}

// 1. WGC sge series (from saved probe-out file)
try {
  const main = JSON.parse(readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probes/probe-out/wgc-goldprice-main.txt', 'utf8'));
  const cd = main.chartData;
  console.log('### WGC chart/main sge series:');
  for (const k of ['sge_am_cny', 'sge_pm_cny']) {
    const arr = cd[k] || [];
    if (arr.length) {
      const first = arr[0];
      const last = arr[arr.length - 1];
      console.log(`  ${k}: ${arr.length} pts, first ${new Date(first[0]).toISOString().slice(0, 10)} = ${first[1]}, last ${new Date(last[0]).toISOString().slice(0, 10)} = ${last[1]}`);
    }
  }
} catch (e) { console.log('wgc main read err', e.message); }

// 2. SGE official
show('sge-mrhqsj', await get('https://www.sge.com.cn/sjzx/mrhqsj', {}));
show('sge-en', await get('https://en.sge.com.cn/', {}), 2);

// 3. FRED DEXCHUS (single, throttled)
show('fred-dexchus', await get('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXCHUS&cosd=2026-07-01&coed=2026-08-16'), 6);

// 4. ECB CNY
const ecb = await get('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml');
const cny = ecb.txt.match(/currency='CNY' rate='([^']+)'/);
const usd = ecb.txt.match(/currency='USD' rate='([^']+)'/);
const dt = ecb.txt.match(/time='([^']+)'/);
console.log(`\n### ECB: ${dt?.[1]} EUR/CNY=${cny?.[1]} EUR/USD=${usd?.[1]} -> implied USD/CNY=${cny && usd ? (parseFloat(cny[1]) / parseFloat(usd[1])).toFixed(4) : 'n/a'}`);

// 5. open.er-api CNY
const era = await get('https://open.er-api.com/v6/latest/USD');
try { const j = JSON.parse(era.txt); console.log('\n### open.er-api USD/CNY =', j.rates?.CNY, 'date', j.date || j.time_last_update_utc); } catch { console.log('er-api parse fail'); }

// 6. EastMoney pingzhongdata 518880
show('em-518880', await get('http://fund.eastmoney.com/pingzhongdata/518880.js?v=20260816', { referer: 'http://fund.eastmoney.com/518880.html' }), 3);

// 7. fundf10 gmbd (规模变动)
show('em-gmbd', await get('https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=gmbd&code=518880', { referer: 'https://fundf10.eastmoney.com/gmbd_518880.html' }), 3);

// 8. Tencent kline sh518880
show('tx-kline', await get('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh518880,day,,,20,qfq', { referer: 'https://gu.qq.com/' }), 2);

// 9. Sina quote
show('sina-quote', await get('https://hq.sinajs.cn/list=sh518880', { referer: 'https://finance.sina.com.cn/' }), 2);

console.log('\nDONE');
