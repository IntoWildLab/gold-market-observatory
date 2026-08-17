// CBD date_range with QTD_FULL for China.
const base = 'https://fsapi.gold.org/api/cbd/v11/charts/getPage';
const q = '?page=date_range&periodicity=QTD_FULL&countries=CHN&startDate=2024-03-31&endDate=2026-06-30';
const r = await fetch(base + q, { headers: { 'user-agent': 'Mozilla/5.0' } });
const j = await r.json();
const cd = j.chartData || {};
console.log('options.periodicity=', cd.options?.selectedPeriodicity, 'from=', cd.options?.selectedFrom, 'to=', cd.options?.selectedTo);
console.log('columnChart keys:', Object.keys(cd.columnChart || {}));
const cc = cd.columnChart || {};
for (const k of Object.keys(cc)) {
  const v = cc[k];
  console.log(`columnChart[${k}] type=${Array.isArray(v) ? 'array' : typeof v} keys=${v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).slice(0, 12) : ''}`);
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const sampleKey = Object.keys(v)[0];
    console.log('  sample[', sampleKey, ']:', JSON.stringify(v[sampleKey]).slice(0, 600));
  }
}
const tbl = cd.table || {};
console.log('table keys:', Object.keys(tbl));
for (const k of Object.keys(tbl)) {
  const v = tbl[k];
  console.log(`table[${k}] keys=${v && typeof v === 'object' ? Object.keys(v).slice(0, 8) : typeof v}`);
  const firstKey = v && typeof v === 'object' ? Object.keys(v)[0] : null;
  if (firstKey) console.log('  table[', firstKey, ']:', JSON.stringify(v[firstKey]).slice(0, 800));
}
