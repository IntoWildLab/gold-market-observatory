export type EventFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type EventSourceErrorCode =
  | "network_error"
  | "timeout"
  | `http_${number}`
  | "empty_response"
  | "unexpected_content_type"
  | "unexpected_content";

export class EventSourceFetchError extends Error {
  constructor(
    public readonly code: EventSourceErrorCode,
    message: string,
    public readonly url: string,
  ) {
    super(message);
    this.name = "EventSourceFetchError";
  }
}

export interface FetchOfficialTextOptions {
  url: string;
  acceptedContentTypes: readonly string[];
  requiredMarkers: readonly RegExp[];
  fetchImpl?: EventFetch;
  timeoutMs?: number;
  maxAttempts?: number;
  backoffMs?: number;
  wait?: (ms: number) => Promise<void>;
  requestHeaders?: Readonly<Record<string, string>>;
}

export const EVENT_RISK_USER_AGENT = "GoldMarketObservatory/0.1 (+https://github.com/IntoWildLab/gold-market-observatory)";

export async function fetchOfficialText(options: FetchOfficialTextOptions): Promise<string> {
  const {
    url,
    acceptedContentTypes,
    requiredMarkers,
    fetchImpl = fetch,
    timeoutMs = 20_000,
    maxAttempts = 3,
    backoffMs = 500,
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    requestHeaders = {},
  } = options;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) {
    throw new Error("Event source maxAttempts must be between 1 and 3");
  }

  let lastError: EventSourceFetchError | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) await wait(backoffMs * 2 ** (attempt - 2));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          accept: acceptedContentTypes.join(", "),
          ...requestHeaders,
          "user-agent": EVENT_RISK_USER_AGENT,
        },
      });
      if (!response.ok) {
        const error = new EventSourceFetchError(`http_${response.status}`, `HTTP ${response.status}`, url);
        if (isRetryableStatus(response.status) && attempt < maxAttempts) {
          lastError = error;
          continue;
        }
        throw error;
      }
      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      if (!acceptedContentTypes.some((allowed) => contentType.includes(allowed.toLowerCase()))) {
        throw new EventSourceFetchError("unexpected_content_type", `Unexpected content-type: ${contentType || "missing"}`, url);
      }
      const text = await response.text();
      if (!text.trim()) throw new EventSourceFetchError("empty_response", "Official response is empty", url);
      if (!requiredMarkers.every((marker) => marker.test(text))) {
        throw new EventSourceFetchError("unexpected_content", "Official response is missing required structure markers", url);
      }
      return text;
    } catch (error) {
      if (error instanceof EventSourceFetchError) throw error;
      const aborted = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
      const wrapped = new EventSourceFetchError(aborted ? "timeout" : "network_error", aborted ? `Timeout after ${timeoutMs}ms` : "Network request failed", url);
      if (attempt < maxAttempts) {
        lastError = wrapped;
        continue;
      }
      throw wrapped;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new EventSourceFetchError("network_error", "Network request failed", url);
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
