// Grep the reserves page HTML for periodicity option labels.
import { readFileSync } from 'node:fs';
const wgc = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-gold-reserves.txt', 'utf8');
for (const pat of ['Year end', 'year end', 'Monthly', 'monthly', 'Quarterly', 'quarterly', 'periodicity', 'Periodicity', 'Annuall', 'Annual']) {
  const hits = [...wgc.matchAll(new RegExp('.{0,100}' + pat + '.{0,150}', 'g'))].slice(0, 3).map((m) => m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
  if (hits.length) { console.log(`--- ${pat} ---`); hits.forEach((h) => console.log(' ', h.slice(0, 250))); }
}
