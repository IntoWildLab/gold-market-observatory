// Net probe: test which candidate data-source hosts are reachable from this machine.
const urls = [
  'https://registry.npmjs.org/-/ping',
  'https://stooq.com/q/d/l/?s=xauusd&i=d',
  'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=5d&interval=1d',
  'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10',
  'https://api.stlouisfed.org/fred/series?series_id=DGS10',
  'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/all/2024',
  'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
  'https://www.gold.org/',
  'https://api.github.com/',
  'https://raw.githubusercontent.com/',
  'https://www.google.com/',
  'https://www.pbc.gov.cn/',
  'https://www.safe.gov.cn/',
  'http://dataservices.imf.org/REST/SDMX_JSON.svc/',
];

for (const u of urls) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(u, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0' } });
    const len = (r.headers.get('content-length') || '?');
    console.log(`OK   ${r.status}  ${u}  len=${len}`);
  } catch (e) {
    console.log(`ERR  ${u}  ${e.name}: ${e.message}`);
  } finally {
    clearTimeout(t);
  }
}
