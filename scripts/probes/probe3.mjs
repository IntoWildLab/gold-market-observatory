// Probe 3: gold price alternatives, DXY, GLD holdings, central bank sources.
import { writeFileSync } from 'node:fs';

async function get(u, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(u, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'accept': '*/*', ...headers },
    });
    const txt = await r.text();
    return { status: r.status, txt, url: r.url };
  } catch (e) {
    return { status: -1, txt: '', err: `${e.name}: ${e.message}` };
  } finally {
    clearTimeout(t);
  }
}

function brief(name, res, n = 4) {
  const lines = res.txt.split(/\r?\n/).filter((l) => l.trim());
  const head = lines.slice(0, n).map((l) => l.slice(0, 150));
  const tail = lines.slice(-n).map((l) => l.slice(0, 150));
  console.log(`\n### ${name}: status=${res.status} ${res.err || ''} bytes=${res.txt.length} lines=${lines.length}`);
  if (res.txt.length < 4000) { for (const l of head) console.log('  ' + l); }
  else { for (const l of head) console.log('H| ' + l); console.log('   ...'); for (const l of tail) console.log('T| ' + l); }
  if (res.txt.length > 100) writeFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/${name}.txt`, res.txt.slice(0, 500000));
}

const mkdir = await import('node:fs/promises').then((m) => m.mkdir);
await mkdir('D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out', { recursive: true });

// FRED gold fix series retry
brief('fred-gold-am', await get('https://fred.stlouisfed.org/graph/fredgraph.csv?id=GOLDAMGBD228NLBM&cosd=2025-08-01&coed=2026-08-16'));
brief('fred-gold-pm', await get('https://fred.stlouisfed.org/graph/fredgraph.csv?id=GOLDPMGBD228NLBM&cosd=2025-08-01&coed=2026-08-16'));
brief('fred-dtwexmgs', await get('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DTWEXMGS&cosd=2026-07-01&coed=2026-08-16'));

// Yahoo chart API with browser-ish headers
brief('yahoo-gcf', await get('https://query2.finance.yahoo.com/v8/finance/chart/GC=F?range=1mo&interval=1d', { 'accept': 'application/json' }));
brief('yahoo-dxy', await get('https://query2.finance.yahoo.com/v8/finance/chart/%5EDXY?range=1mo&interval=1d', { 'accept': 'application/json' }));

// SPDR GLD holdings page
const spdr = await get('https://www.spdrgoldshares.com/usa/gld/holdings/');
brief('spdr-gld-holdings', spdr);

// WGC central bank data hub
brief('wgc-cb-page', await get('https://www.gold.org/goldhub/data/central-bank-purchases'));
brief('wgc-cb-2', await get('https://www.gold.org/goldhub/data/central-bank-gold-purchases'));

// PBoC official reserve assets (English)
brief('pbc-reserves', await get('https://www.pbc.gov.cn/en/3688110/3688172/4157443/4157479/index.html'));

// IMF SDMX over https
brief('imf-ifs', await get('https://dataservices.imf.org/REST/SDMX_JSON.svc/CompactData/IFS/M.CN.1GD.BOG.Z?startPeriod=2025-01&endPeriod=2026-08'));

console.log('\nDONE');
