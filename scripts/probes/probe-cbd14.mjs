// Inspect the snapshot response TABLE structure (may hold monthly changes).
const q = '?page=snapshot&periodicity=LAST_YEAR_END&countries=CHN';
const r = await fetch('https://fsapi.gold.org/api/cbd/v11/charts/getPage' + q, { headers: { 'user-agent': 'Mozilla/5.0' } });
const j = await r.json();
const cd = j.chartData || {};
const tbl = cd.table || {};
console.log('table keys:', Object.keys(tbl));
for (const k of Object.keys(tbl)) {
  const v = tbl[k];
  console.log(`\ntable[${k}] type=${Array.isArray(v) ? 'array' : typeof v}`);
  console.log(JSON.stringify(v).slice(0, 3000));
}
