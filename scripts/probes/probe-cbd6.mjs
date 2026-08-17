// Full getPage query building from bundle.
import { readFileSync } from 'node:fs';
const cbd = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-cbd-app.txt', 'utf8');
const idx = cbd.indexOf('"/api/cbd/v11/charts/getPage"');
const seg = cbd.slice(idx - 900, idx + 4200).replace(/\s+/g, ' ');
console.log(seg.slice(900, 4200));
