// Inspect CBD getFilters chartData.data structure.
const r = await fetch('https://fsapi.gold.org/api/cbd/v11/charts/getFilters', { headers: { 'user-agent': 'Mozilla/5.0' } });
const j = await r.json();
const data = j.chartData?.data;
console.log('data type:', typeof data, Array.isArray(data) ? 'array ' + data.length : '');
console.log('data:', JSON.stringify(data).slice(0, 2500));
