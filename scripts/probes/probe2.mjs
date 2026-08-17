// Probe 2: verify content formats of candidate endpoints.
async function sample(u, n = 3) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(u, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0' } });
    const txt = await r.text();
    const lines = txt.split(/\r?\n/).filter((l) => l.trim().length > 0);
    console.log(`\n=== ${r.status} ${u} (${txt.length} chars, ${lines.length} lines)`);
    const head = lines.slice(0, n);
    const tail = lines.slice(-n);
    for (const l of head) console.log('H| ' + l.slice(0, 160));
    console.log('   ...');
    for (const l of tail) console.log('T| ' + l.slice(0, 160));
    return txt;
  } catch (e) {
    console.log(`\n=== ERR ${u} ${e.name}: ${e.message}`);
    return null;
  } finally {
    clearTimeout(t);
  }
}

console.log('--- FRED series via fredgraph.csv (no API key) ---');
await sample('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFII10&cosd=2025-08-01&coed=2026-08-16', 5);
await sample('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10&cosd=2026-07-01&coed=2026-08-16', 5);
await sample('https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10YIE&cosd=2026-07-01&coed=2026-08-16', 5);
await sample('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DTWEXBGS&cosd=2026-07-01&coed=2026-08-16', 5);
await sample('https://fred.stlouisfed.org/graph/fredgraph.csv?id=GOLDAMGBD228NLBM&cosd=2026-07-01&coed=2026-08-16', 5);

console.log('\n--- stooq ---');
await sample('https://stooq.com/q/d/l/?s=xauusd&i=d', 3);
await sample('https://stooq.com/q/d/l/?s=dx.f&i=d', 3);
await sample('https://stooq.com/q/d/l/?s=usdidx&i=d', 3);

console.log('\n--- ECB daily FX (gold in EUR) ---');
const ecb = await sample('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', 8);
