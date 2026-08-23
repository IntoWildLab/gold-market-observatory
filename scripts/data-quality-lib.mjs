export function validateSeriesData(id, data, now = new Date()) {
  const errors = [];
  const warnings = [];
  const observations = Array.isArray(data?.observations) ? data.observations : [];
  const expected = {
    cn_gold_etf_nav: { unit: "cny_per_share", frequency: "daily" },
    cn_gold_etf_shares_daily: { unit: "hundred_million_shares", frequency: "daily" },
  }[id];
  if (!expected) return { errors, warnings };
  if (expected && (data?.meta?.unit !== expected.unit || data?.meta?.frequency !== expected.frequency)) {
    errors.push(`${id}: unit or frequency does not match the contract`);
  }
  const seen = new Set();
  let previous = null;
  for (const [index, item] of observations.entries()) {
    if (seen.has(item.observation_date)) errors.push(`${id}: duplicate date ${item.observation_date}`);
    seen.add(item.observation_date);
    if (typeof item.value !== "number" || !Number.isFinite(item.value) || item.value <= 0) {
      errors.push(`${id}: observation ${index} must be finite and positive`);
    }
    const date = new Date(`${item.observation_date}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.getTime() > now.getTime() + 2 * 86_400_000) {
      errors.push(`${id}: observation ${index} has an invalid or future date`);
    }
    if (id === "cn_gold_etf_nav") {
      if (item.nav_kind !== "official_unit_nav") errors.push(`${id}: observation ${index} lacks official_unit_nav lineage`);
      if (!Number.isFinite(new Date(item.published_at).getTime())) errors.push(`${id}: observation ${index} has invalid published_at`);
    }
    if (id === "cn_gold_etf_shares_daily") {
      if (item.security_code !== "518880" || item.raw_unit !== "万份" || !Number.isFinite(item.raw_value)) {
        errors.push(`${id}: observation ${index} lacks SSE raw lineage`);
      } else if (Math.abs(item.value - item.raw_value / 10000) > 1e-10) {
        errors.push(`${id}: observation ${index} has an incorrect 万份-to-亿份 conversion`);
      }
    }
    if (previous && previous.value > 0) {
      const move = Math.abs(item.value / previous.value - 1);
      if (id === "cn_gold_etf_nav" && move > 0.15) warnings.push(`${id}: unusual one-day NAV move on ${item.observation_date} (${(move * 100).toFixed(2)}%)`);
      if (id === "cn_gold_etf_shares_daily" && move > 0.20) warnings.push(`${id}: unusual one-day shares move on ${item.observation_date} (${(move * 100).toFixed(2)}%)`);
    }
    previous = item;
  }
  return { errors, warnings };
}
