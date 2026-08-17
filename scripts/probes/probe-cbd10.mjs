// Try many periodicity spellings with snapshot page.
const base = 'https://fsapi.gold.org/api/cbd/v11/charts/getPage';
const perio = ['MONTHLY', 'MONTH', 'M', 'QUARTERLY', 'QUARTER', 'Q', 'ANNUALLY', 'ANNUAL', 'YEARLY', 'YEAR', 'Y', 'LAST_YEAR_END', 'SEMI', 'WEEKLY', 'monthly', 'MONTH_END', 'LAST_MONTH_END'];
for (const p of perio) {
  const q = `?page=snapshot&periodicity=${encodeURIComponent(p)}&countries=CHN`;
  const r = await fetch(base + q, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const j = await r.json();
  const cd = j.chartData || {};
  const keys = Object.keys(cd.columnChart || {});
  console.log(`${p.padEnd(14)} -> columnChart keys: ${JSON.stringify(keys)} options.periodicity=${cd.options?.selectedPeriodicity}`);
}
