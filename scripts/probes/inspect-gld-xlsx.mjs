// Inspect the SPDR GLD archive xlsx structure.
import XLSX from 'xlsx';
const wb = XLSX.readFile('D:/DeepSeek-Harness-Projects/gold-market-observatory/data/raw/spdr-gld-archive.xlsx');
console.log('sheets:', wb.SheetNames);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, header: 1 });
  console.log(`\n--- sheet ${name}: ${rows.length} rows ---`);
  for (const r of rows.slice(0, 5)) console.log(JSON.stringify(r).slice(0, 300));
  console.log('last rows:');
  for (const r of rows.slice(-3)) console.log(JSON.stringify(r).slice(0, 300));
}
