// More CBD bundle context: full getPage param building.
import { readFileSync } from 'node:fs';
const cbd = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-cbd-app.txt', 'utf8');
const idx = cbd.indexOf('"/api/cbd/v11/charts/getPage"');
const seg = cbd.slice(idx - 200, idx + 3500).replace(/\s+/g, ' ');
console.log(seg.slice(600, 3600));
