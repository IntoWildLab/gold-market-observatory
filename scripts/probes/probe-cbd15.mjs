// Find periodicity option labels in the CBD bundle.
import { readFileSync } from 'node:fs';
const cbd = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-cbd-app.txt', 'utf8');
for (const pat of ['Year end', 'yearEnd', 'Year End', 'Monthly', 'monthly', 'Quarterly', 'quarterly', 'periodicities', 'Periodicity']) {
  const hits = [...cbd.matchAll(new RegExp('.{0,120}' + pat + '.{0,160}', 'g'))].slice(0, 4).map((m) => m[0].replace(/\s+/g, ' '));
  if (hits.length) { console.log(`--- ${pat} ---`); hits.forEach((h) => console.log(' ', h.slice(0, 300))); }
}
