// CBD date_range + MONTHLY for China (ISO3 = CHN)
const base = 'https://fsapi.gold.org/api/cbd/v11/charts/getPage';
const variants = [
  '?page=date_range&periodicity=MONTHLY&countries=CHN&startDate=2024-01-31&endDate=2026-07-31',
  '?page=snapshot&periodicity=MONTHLY&countries=CHN',
  '?page=date_range&periodicity=MONTHLY&countries=CHN&startDate=2026-01-31&endDate=2026-07-31',
];
for (const q of variants) {
  try {
    const r = await fetch(base + q, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const j = await r.json();
    const cd = j.chartData || {};
    console.log(`\n### ${q}\n  status=${r.status} options.periodicity=${cd.options?.selectedPeriodicity} start=${cd.options?.selectedFrom} end=${cd.options?.selectedTo}`);
    console.log('  columnChart keys:', Object.keys(cd.columnChart || {}));
    for (const k of Object.keys(cd.columnChart || {})) {
      const v = cd.columnChart[k];
      console.log(`  columnChart[${k}] type=${Array.isArray(v) ? 'array' : typeof v} keys=${v && typeof v === 'object' ? Object.keys(v).slice(0, 10) : ''}`);
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const c of Object.keys(v).slice(0, 3)) {
          const m = v[c];
          console.log(`    [${c}] keys=${m && typeof m === 'object' ? Object.keys(m).slice(0, 8) : typeof m}`);
          if (m && typeof m === 'object') {
            for (const mk of Object.keys(m).slice(0, 3)) {
              const mm = m[mk];
              console.log(`      [${mk}]:`, JSON.stringify(mm).slice(0, 400));
            }
          }
        }
      }
    }
    console.log('  table keys:', Object.keys(cd.table || {}));
  } catch (e) { console.log(`\n### ${q}\n  ERR ${e.message}`); }
}
