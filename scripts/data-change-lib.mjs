const auditOnlyKeys = new Set(["fetched_at", "last_fetched_at", "generated_at"]);

export function normalizeForSubstantiveChange(value) {
  if (Array.isArray(value)) return value.map(normalizeForSubstantiveChange);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !auditOnlyKeys.has(key))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, normalizeForSubstantiveChange(child)]),
    );
  }
  return value;
}

export function isSubstantiveDataChange(previous, current) {
  return JSON.stringify(normalizeForSubstantiveChange(previous)) !== JSON.stringify(normalizeForSubstantiveChange(current));
}
