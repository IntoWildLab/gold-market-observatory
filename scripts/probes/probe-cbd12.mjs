// Fetch CBD cbd-config for periodicity values.
const r = await fetch('https://fsapi.gold.org/api/cbd/v11/charts/cbd-config', { headers: { 'user-agent': 'Mozilla/5.0' } });
const j = await r.json();
console.log('keys:', Object.keys(j));
const s = JSON.stringify(j);
console.log(s.slice(0, 4000));
