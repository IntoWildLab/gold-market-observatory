// Search CBD bundle for line chart endpoints.
import { readFileSync } from 'node:fs';
const cbd = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-cbd-app.txt', 'utf8');
const hits = [...cbd.matchAll(/["'`](\/api\/cbd\/v\d+[^"'`]*)["'`]/g)].map((m) => m[1]);
console.log('all /api/cbd endpoints:', [...new Set(hits)]);
const line = [...cbd.matchAll(/.{100}lineChart.{100}/gi)].map((m) => m[0].replace(/\s+/g, ' '));
console.log('\nlineChart contexts:', line.slice(0, 6));
