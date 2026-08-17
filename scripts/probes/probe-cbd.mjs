// Quick inspect: WGC CBD getPage structure for China.
const url = 'https://fsapi.gold.org/api/cbd/v11/charts/getPage?countries=CN&page=1';
const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
const j = await r.json();
console.log('status', r.status, 'top keys:', Object.keys(j));
const cd = j.chartData || j.data || {};
console.log('chartData keys:', Object.keys(cd));
console.log('chartData sample:', JSON.stringify(cd).slice(0, 3000));
