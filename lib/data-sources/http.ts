/**
 * 轻量 HTTP 工具: 超时、重试、UA 头。
 * 所有外部数据源请求统一走这里, 便于审计与限流。
 */

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export interface HttpOptions {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: string;
  /** 重试前等待的基准毫秒数(指数退避) */
  backoffMs?: number;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function httpGetText(url: string, opts: HttpOptions = {}): Promise<string> {
  const { timeoutMs = 25000, retries = 2, headers = {}, method = "GET", body, backoffMs = 4000 } = opts;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(backoffMs * 2 ** (attempt - 1));
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        method,
        body,
        headers: { "user-agent": DEFAULT_UA, accept: "*/*", ...headers },
      });
      const text = await res.text();
      if (!res.ok) {
        // 429/403/404 不重试也大多无意义, 但 5xx 可重试
        if (res.status >= 500 && attempt < retries) {
          lastErr = new HttpError(`HTTP ${res.status}`, res.status, url);
          continue;
        }
        throw new HttpError(`HTTP ${res.status}: ${text.slice(0, 120)}`, res.status, url);
      }
      return text;
    } catch (e) {
      lastErr = e;
      if (e instanceof Error && e.name === "AbortError") {
        throw new HttpError(`timeout after ${timeoutMs}ms`, 0, url);
      }
      // 网络错误重试
      if (attempt >= retries) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function httpGetJson<T = unknown>(url: string, opts: HttpOptions = {}): Promise<T> {
  const text = await httpGetText(url, { ...opts, headers: { accept: "application/json", ...opts.headers } });
  return JSON.parse(text) as T;
}

/** 下载二进制并返回 Buffer */
export async function httpGetBuffer(url: string, opts: HttpOptions = {}): Promise<Buffer> {
  const { timeoutMs = 30000, retries = 1, headers = {}, backoffMs = 4000 } = opts;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(backoffMs * 2 ** attempt);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": DEFAULT_UA, ...headers } });
      const buf = Buffer.from(await res.arrayBuffer());
      if (!res.ok) throw new HttpError(`HTTP ${res.status}`, res.status, url);
      return buf;
    } catch (e) {
      lastErr = e;
      if (attempt >= retries) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** 抓取文本并按指定编码解码(部分国内行情接口为 GBK 编码) */
export async function httpGetTextEncoded(url: string, encoding: "utf-8" | "gbk", opts: HttpOptions = {}): Promise<string> {
  const buf = await httpGetBuffer(url, { timeoutMs: opts.timeoutMs ?? 20000, retries: opts.retries ?? 1, headers: opts.headers });
  try {
    return new TextDecoder(encoding).decode(buf);
  } catch {
    // TextDecoder 不支持 gbk 时回退 utf-8(通常不会发生, Node 带完整 ICU)
    return buf.toString("utf8");
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** WGC 返回的数值可能是带千分位逗号的字符串, 统一转 number */
export function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/,/g, "").trim();
  if (s === "" || s === "." || s === "NA" || s === "null") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 毫秒时间戳 → YYYY-MM-DD(UTC) */
export function msToDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
