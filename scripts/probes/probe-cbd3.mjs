// Try CBD getPage param variants to get China monthly gold reserves series.
const base = 'https://fsapi.gold.org/api/cbd/v11/charts/getPage';
const variants = [
  '?countries=CHN&page=1&selectedPeriodicity=MONTHLY&selectedStartDate=2024-01-31&selectedEndDate=2026-07-31',
  '?countries=CN&page=1&selectedPeriodicity=MONTHLY&selectedStartDate=2024-01-31&selectedEndDate=2026-07-31',
  '?countries=CN&page=1&selectedPeriodicity=ANNUALLY',
  '?countries=CN&page=1&selectedPeriodicity=QUARTERLY',
];
for (const q of variants) {
  const r = await fetch(base + q, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const j = await r.json();
  const cd = j.chartData || {};
  const colKeys = Object.keys(cd.columnChart || {});
  let chinaCol = null;
  for (const k of colKeys) {
    const v = cd.columnChart[k];
    if (v && typeof v === 'object') {
      const cnKey = Object.keys(v).find((c) => /CHN|CN/.test(c.toUpperCase()));
      if (cnKey) chinaCol = { periodicity: k, country: cnKey, data: v[cnKey] };
    }
  }
  console.log(`\n### ${q}`);
  console.log('  options.periodicity =', cd.options?.selectedPeriodicity, '| dates =', JSON.stringify(cd.options?.selectedDates));
  console.log('  columnChart keys:', colKeys, '| chinaCol:', chinaCol ? JSON.stringify(chinaCol).slice(0, 400) : 'none');
  const tbl = cd.table || {};
  console.log('  table keys:', Object.keys(tbl));
}
