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

function validDate(date, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.getTime() <= now.getTime() + 2 * 86_400_000;
}

function finiteFields(row, fields) {
  return fields.every((field) => typeof row?.[field] === "number" && Number.isFinite(row[field]));
}

export function validateChinaAttributionData(data, now = new Date(), sourceDateSets = []) {
  const errors = [];
  if (JSON.stringify(data?.source_series) !== JSON.stringify(["gold_price", "usd_cny", "au99_99"])) {
    errors.push("china-gold-attribution: source_series contract is invalid");
  }
  if (data?.benchmark_role !== "china_gold_benchmark") errors.push("china-gold-attribution: Au99.99 benchmark role is missing");
  for (const row of data?.windows ?? []) {
    const window = Number.parseInt(row.window, 10);
    if (row.status === "insufficient_data") continue;
    if (!validDate(row.start_date, now) || !validDate(row.end_date, now) || row.start_date >= row.end_date) {
      errors.push(`china-gold-attribution: ${row.window} dates are invalid`);
    }
    if (row.sample_count !== window + 1) errors.push(`china-gold-attribution: ${row.window} sample_count is invalid`);
    const fields = [
      "actual_au99_return_pct", "gold_factor_return_pct", "fx_factor_return_pct",
      "deviation_factor_return_pct", "gold_contribution_pp", "fx_contribution_pp",
      "deviation_contribution_pp", "closure_error",
    ];
    if (!finiteFields(row, fields)) errors.push(`china-gold-attribution: ${row.window} has non-finite values`);
    if (Math.abs(row.closure_error) > 1e-8) errors.push(`china-gold-attribution: ${row.window} does not close`);
    if (row.interaction_method !== "shapley_equal_allocation") errors.push(`china-gold-attribution: ${row.window} interaction method is invalid`);
    if (sourceDateSets.length && !sourceDateSets.every((dates) => dates.has(row.start_date) && dates.has(row.end_date))) {
      errors.push(`china-gold-attribution: ${row.window} endpoints are not common to all three series`);
    }
  }
  return { errors, warnings: [] };
}

export function validateCnEtfTrackingData(data, now = new Date(), sourceDateSets = []) {
  const errors = [];
  if (data?.source_series_id !== "cn_gold_etf_nav") errors.push("cn-gold-etf-tracking: official NAV source is required");
  if (data?.source_series_id === "cn_gold_etf_price") errors.push("cn-gold-etf-tracking: market price cannot be used");
  if (data?.benchmark_id !== "au99_99" || data?.benchmark_is_proxy !== true) {
    errors.push("cn-gold-etf-tracking: benchmark proxy metadata is invalid");
  }
  for (const row of data?.windows ?? []) {
    const window = Number.parseInt(row.window, 10);
    if (row.status === "insufficient_data") continue;
    if (!validDate(row.start_date, now) || !validDate(row.end_date, now) || row.start_date >= row.end_date) {
      errors.push(`cn-gold-etf-tracking: ${row.window} dates are invalid`);
    }
    if (row.sample_count !== window + 1) errors.push(`cn-gold-etf-tracking: ${row.window} sample_count is invalid`);
    if (!finiteFields(row, ["nav_return_pct", "benchmark_return_pct", "tracking_difference_pp"])) {
      errors.push(`cn-gold-etf-tracking: ${row.window} has non-finite values`);
    } else if (Math.abs(row.nav_return_pct - row.benchmark_return_pct - row.tracking_difference_pp) > 1e-10) {
      errors.push(`cn-gold-etf-tracking: ${row.window} tracking difference does not close`);
    }
    if (sourceDateSets.length && !sourceDateSets.every((dates) => dates.has(row.start_date) && dates.has(row.end_date))) {
      errors.push(`cn-gold-etf-tracking: ${row.window} endpoints are not common to NAV and benchmark`);
    }
  }
  return { errors, warnings: [] };
}
