const SHANGHAI_TIME_ZONE = "Asia/Shanghai";

type DateInput = string | number | Date | null | undefined;

function shanghaiParts(value: DateInput): Record<string, string> | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: SHANGHAI_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

export function formatShanghaiDate(value: DateInput): string {
  const parts = shanghaiParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : "—";
}

export function formatShanghaiDateTime(value: DateInput): string {
  const parts = shanghaiParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}` : "—";
}
