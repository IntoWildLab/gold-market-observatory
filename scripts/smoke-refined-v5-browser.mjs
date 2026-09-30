import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const targetUrl = process.argv[2] ?? "http://127.0.0.1:3000/design/refined-v5";
const viewportWidth = Number(process.argv[3] ?? 1440);
const viewportHeight = Number(process.argv[4] ?? (viewportWidth <= 650 ? 844 : 1000));
const screenshotPath = process.argv[5];

function chromeCandidates() {
  return [
    process.env.CHROME_PATH,
    process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : "google-chrome",
    process.platform === "win32" ? "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" : "google-chrome-stable",
    process.platform === "win32" ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : "chromium",
    process.platform === "win32" ? "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe" : "chromium-browser",
  ].filter(Boolean);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForJson(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Chrome DevTools did not become ready: ${lastError?.message ?? "timeout"}`);
}

function launchChrome(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("spawn", () => resolve({ child, stderr: () => stderr }));
    child.once("error", reject);
  });
}

async function startChrome(port, profile) {
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--window-size=1440,1000",
    "about:blank",
  ];
  let lastError;
  for (const candidate of chromeCandidates()) {
    if (candidate.includes(path.sep) && !existsSync(candidate)) continue;
    try {
      return await launchChrome(candidate, args);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Chrome or Edge is required for the refined-v5 browser smoke: ${lastError?.message ?? "executable not found"}`);
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
    });
  }

  on(method, listener) {
    this.listeners.set(method, [...(this.listeners.get(method) ?? []), listener]);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
  return result.result.value;
}

async function waitFor(client, expression, label, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(client, expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const profile = await mkdtemp(path.join(os.tmpdir(), "gmo-v5-chrome-"));
const port = await freePort();
let browser;
let client;

try {
  browser = await startChrome(port, profile);
  await waitForJson(`http://127.0.0.1:${port}/json/version`);
  const pages = await waitForJson(`http://127.0.0.1:${port}/json/list`);
  const page = pages.find((item) => item.type === "page");
  if (!page?.webSocketDebuggerUrl) throw new Error("Chrome did not expose a page target");

  client = new CdpClient(page.webSocketDebuggerUrl);
  await client.connect();
  const browserErrors = [];
  client.on("Runtime.consoleAPICalled", ({ type, args }) => {
    if (type === "error") browserErrors.push(args.map((arg) => arg.value ?? arg.description ?? "console error").join(" "));
  });
  client.on("Runtime.exceptionThrown", ({ exceptionDetails }) => browserErrors.push(exceptionDetails?.text ?? "uncaught exception"));
  client.on("Log.entryAdded", ({ entry }) => {
    if (entry?.level === "error") browserErrors.push(`${entry.text}${entry.url ? ` (${entry.url})` : ""}`);
  });
  await Promise.all([client.send("Page.enable"), client.send("Runtime.enable"), client.send("Log.enable")]);
  await client.send("Emulation.setDeviceMetricsOverride", { width: viewportWidth, height: viewportHeight, deviceScaleFactor: 1, mobile: viewportWidth <= 650 });
  await client.send("Page.navigate", { url: targetUrl });
  await waitFor(client, "document.readyState === 'complete'", "document load");
  await waitFor(client, "Boolean(document.querySelector('[data-v5-page=\"refined-v5\"]'))", "refined-v5 route marker");
  await waitFor(client, "document.querySelectorAll('.recharts-surface path').length > 0", "hydrated chart SVG paths");

  const markers = await evaluate(client, `(() => {
    const text = document.body.innerText;
    return {
      eventRisk: Boolean(document.querySelector('[data-v5-event-risk]')),
      eventAvailability: document.querySelector('[data-v5-event-risk]')?.getAttribute('data-availability'),
      marketBrief: text.includes('市场简报'),
      research: text.includes('国际与人民币黄金'),
      evidence: text.includes('驱动证据记录'),
      capital: text.includes('全球黄金资金流'),
      structure: text.includes('长期结构背景'),
      navigation: Boolean(document.querySelector('.v5-nav a[href="#top"]') && document.querySelector('.v5-nav a[href="#v5-footer"]')),
      footer: Boolean(document.querySelector('#v5-footer')),
      fakeSearch: text.includes('搜索问题、数据或观点'),
      chartPaths: document.querySelectorAll('.recharts-surface path').length,
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
    };
  })()`);
  for (const key of ["eventRisk", "marketBrief", "research", "evidence", "capital", "structure", "navigation", "footer"]) {
    if (!markers[key]) throw new Error(`Missing refined-v5 marker: ${key}`);
  }
  if (markers.fakeSearch) throw new Error("Fake search affordance is still visible");
  if (!markers.noHorizontalOverflow) throw new Error(`Horizontal overflow at ${viewportWidth}px`);
  if (process.env.EXPECTED_EVENT_RISK_AVAILABILITY
    && markers.eventAvailability !== process.env.EXPECTED_EVENT_RISK_AVAILABILITY) {
    throw new Error(`Expected Event Risk ${process.env.EXPECTED_EVENT_RISK_AVAILABILITY}, received ${markers.eventAvailability}`);
  }

  const switchRequested = await evaluate(client, `(() => {
    const buttons = [...document.querySelectorAll('[aria-label="研究序列"] button')];
    const target = buttons.find((button) => button.textContent.includes('USD/CNY'));
    if (!target) return false;
    target.click();
    return true;
  })()`);
  if (!switchRequested) throw new Error("Research chart selector was not found");
  await waitFor(client, "[...document.querySelectorAll('[aria-label=\"研究序列\"] button')].some((button) => button.textContent.includes('USD/CNY') && button.getAttribute('aria-pressed') === 'true')", "research chart selector change");

  const expanded = await evaluate(client, `(() => {
    const disclosure = document.querySelector('.v5-lower-disclosure');
    if (!disclosure) return false;
    disclosure.querySelector('summary')?.click();
    return disclosure.open === true;
  })()`);
  if (!expanded) throw new Error("Research disclosure did not expand after hydration");

  await new Promise((resolve) => setTimeout(resolve, 500));
  if (browserErrors.length) throw new Error(`Browser console errors: ${browserErrors.join(" | ")}`);
  if (screenshotPath) {
    const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
  }
  console.log(`refined-v5 browser smoke passed at ${viewportWidth}x${viewportHeight}: ${markers.chartPaths} chart paths, selector switched, disclosure expanded, no overflow or console errors.`);
} finally {
  if (client) {
    await client.send("Browser.close").catch(() => undefined);
    client.close();
  }
  if (browser?.child) {
    if (!browser.child.killed) browser.child.kill();
    if (browser.child.exitCode === null) {
      await Promise.race([
        new Promise((resolve) => browser.child.once("exit", resolve)),
        new Promise((resolve) => setTimeout(resolve, 2_000)),
      ]);
    }
  }
  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      await rm(profile, { recursive: true, force: true });
      break;
    } catch (error) {
      if (attempt === 20 || error?.code !== "EBUSY") throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
