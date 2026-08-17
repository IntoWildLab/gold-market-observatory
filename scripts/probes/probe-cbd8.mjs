// Inspect CBD getFilters to find valid periodicity values.
const r = await fetch('https://fsapi.gold.org/api/cbd/v11/charts/getFilters', { headers: { 'user-agent': 'Mozilla/5.0' } });
const j = await r.json();
const cd = j.chartData || j.data || {};
console.log('chartData keys:', Object.keys(cd));
const s = JSON.stringify(cd);
const perIdx = s.search(/periodicit/i);
console.log('\nperiodicity context:', perIdx >= 0 ? s.slice(perIdx - 200, perIdx + 500) : 'none');
// find any MONTHLY-ish strings
for (const pat of ['MONTH', 'month', 'period', 'Period', 'frequency', 'Frequency', 'ANNUAL', 'QUARTER']) {
  const hits = [...s.matchAll(new RegExp('.{0,60}' + pat + '.{0,60}', 'g'))].slice(0, 3).map((m) => m[0]);
  if (hits.length) { console.log(`\n--- ${pat} ---`); hits.forEach((h) => console.log(h)); }
}
