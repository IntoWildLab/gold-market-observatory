// Probe 19: CBD getPage on fsapi host.
import { writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
await mkdir('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out', { recursive: true });

async function get(u, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(u, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'accept': 'application/json, */*', ...headers } });
    return { status: r.status, txt: await r.text() };
  } catch (e) { return { status: -1, txt: '', err: `${e.name}: ${e.message}` }; }
  finally { clearTimeout(t); }
}

const candidates = [
  'https://fsapi.gold.org/api/cbd/v11/charts/getFilters',
  'https://fsapi.gold.org/api/cbd/v11/charts/getPage?page=1&countries=CN',
  'https://apps.gold.org/cbd-app/api/cbd/v11/charts/getFilters',
  'https://apps.gold.org/cbd-app/latest/api/cbd/v11/charts/getFilters?lang=en',
  'https://cbd-app.gold.org/api/cbd/v11/charts/getFilters',
];
for (const u of candidates) {
  const r = await get(u);
  const head = r.txt.slice(0, 250).replace(/\s+/g, ' ');
  console.log(`### ${u}\n    status=${r.status} ${r.err || ''} bytes=${r.txt.length} head=${head}`);
  if (r.status === 200 && r.txt.length > 500) writeFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/cbd-${u.split('/').slice(3, 5).join('-')}.txt`, r.txt);
}
console.log('\nDONE');
