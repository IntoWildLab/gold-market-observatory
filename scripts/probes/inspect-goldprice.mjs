// Inspect WGC goldprice chart + main JSON structures.
import { readFileSync } from 'node:fs';

function dig(label, obj, depth = 0) {
  const pad = '  '.repeat(depth);
  if (depth > 3) return;
  if (Array.isArray(obj)) {
    console.log(pad + label + ' = array[' + obj.length + '] first=', JSON.stringify(obj[0])?.slice(0, 150));
    return;
  }
  if (obj && typeof obj === 'object') {
    console.log(pad + label + ' = object keys:', Object.keys(obj).slice(0, 12));
    for (const k of Object.keys(obj).slice(0, 12)) dig(k, obj[k], depth + 1);
  } else {
    console.log(pad + label + ' = ' + JSON.stringify(obj)?.slice(0, 120));
  }
}

for (const f of ['wgc-goldprice-chart', 'wgc-goldprice-main']) {
  const j = JSON.parse(readFileSync(`D:/DeepSeek-Harness-Projects/gold-market-observatory/scripts/probe-out/${f}.txt`, 'utf8'));
  console.log(`\n===== ${f} =====`);
  dig('root', j);
}
