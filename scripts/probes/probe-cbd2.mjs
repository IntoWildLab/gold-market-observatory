// Find CBD data endpoint usage in the bundle + try param variants.
import { readFileSync } from 'node:fs';

const cbd = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-cbd-app.txt', 'utf8');

// find all /api/cbd strings with context
const re = /.{120}\/api\/cbd\/v11\/charts\/[a-zA-Z]+.{80}/g;
const hits = [...cbd.matchAll(re)].map((m) => m[0].replace(/\s+/g, ' '));
console.log('cbd endpoint contexts:', hits.slice(0, 12));

// periodicity values
const per = [...cbd.matchAll(/selectedPeriodicity[^,;]{0,60}/g)].map((m) => m[0]);
console.log('\nselectedPeriodicity refs:', [...new Set(per)].slice(0, 10));

// look for "getData" or "getSeries" or "series" endpoints
const anyEndp = [...cbd.matchAll(/["'`]([^"'`]*api\/cbd[^"'`]*)["'`]/g)].map((m) => m[1]);
console.log('\nall /api/cbd strings:', [...new Set(anyEndp)].slice(0, 20));

// how is table data built? search "columnChart" usage
const col = [...cbd.matchAll(/.{80}columnChart.{120}/g)].map((m) => m[0].replace(/\s+/g, ' '));
console.log('\ncolumnChart contexts:', col.slice(0, 3));

// search for 'MONTHLY' / 'QUARTERLY' constants
const mo = [...cbd.matchAll(/["'](MONTHLY|QUARTERLY|ANNUAL|YEARLY|MONTH_END|LAST_MONTH)["']/g)].map((m) => m[1]);
console.log('\nperiodicity constants:', [...new Set(mo)]);
