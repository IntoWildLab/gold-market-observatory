// Extract the full getPage query-building code from the CBD bundle.
import { readFileSync } from 'node:fs';
const cbd = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-cbd-app.txt', 'utf8');
const idx = cbd.indexOf('"/api/cbd/v11/charts/getPage"');
if (idx >= 0) {
  const start = Math.max(0, idx - 1200);
  console.log(cbd.slice(start, idx + 200).replace(/\s+/g, ' ').slice(0, 2200));
}
