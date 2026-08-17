// Probe 18: CBD API endpoints discovery + test.
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
await mkdir('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out', { recursive: true });

async function get(u, headers = {}, method = 'GET', body = null) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(u, { signal: ctrl.signal, redirect: 'follow', method, body, headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'accept': 'application/json, */*', 'content-type': 'application/json', ...headers } });
    return { status: r.status, txt: await r.text() };
  } catch (e) { return { status: -1, txt: '', err: `${e.name}: ${e.message}` }; }
  finally { clearTimeout(t); }
}
function show(name, res, n = 4) {
  const lines = res.txt.split(/\r?\n/).filter((l) => l.trim());
  console.log(`\n### ${name}: status=${res.status} ${res.err || ''} bytes=${res.txt.length}`);
  for (const l of lines.slice(0, n)) console.log('  ' + l.slice(0, 400));
  if (res.txt.length > 100 && res.txt.length < 3000000) writeFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/${name}.txt`, res.txt);
}

// base URL discovery from bundle
const cbd = readFileSync('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/wgc-cbd-app.txt', 'utf8');
const baseHits = [...cbd.matchAll(/["'`]([^"'`]{0,60}(?:API_BASE|BASE_URL|baseUrl|apiBase|endpoint|host)[^"'`]{0,60})["'`]/gi)].map((m) => m[1]);
console.log('CBD base-url-ish strings:', [...new Set(baseHits)].slice(0, 15));
// find the apiUrl constant used with /api/cbd path
const idx = cbd.indexOf('/api/cbd/v11/charts/getPage');
console.log('\ncontext before getPage:', cbd.slice(Math.max(0, idx - 400), idx + 100).replace(/\s+/g, ' ').slice(-500));

// try endpoint on app host and api host
for (const u of [
  'https://apps.gold.org/cbd-app/latest/api/cbd/v11/charts/getFilters',
  'https://apps.gold.org/api/cbd/v11/charts/getFilters',
  'https://apps.gold.org/cbd-app/latest/api/cbd/v11/charts/cbd-config',
]) {
  const r = await get(u);
  show('cbd ' + u.split('/').slice(-2).join('/'), r, 2);
}

console.log('\nDONE');
