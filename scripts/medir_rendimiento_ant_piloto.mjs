import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const PORT = 4174;
const ROOT = path.resolve(".");
const OUTPUT_DIR = path.resolve(".codex_build/ant_integracion/fase3_rendimiento");
const VIEWPORT = { width: 390, height: 844 };
const NETWORK = Object.freeze({
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (0.75 * 1024 * 1024) / 8,
  connectionType: "cellular3g"
});
const CPU_THROTTLE_RATE = 4;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function serveStatic() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
      const requested = url.pathname === "/" ? "/docs/index.html" : url.pathname;
      const filePath = path.resolve(ROOT, `.${decodeURIComponent(requested)}`);
      if (!filePath.startsWith(ROOT)) throw new Error("Ruta no permitida");
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error("No es archivo");
      const body = await readFile(filePath);
      const extension = path.extname(filePath).toLowerCase();
      const compressible = [".html", ".js", ".css", ".json", ".geojson"].includes(extension);
      const acceptsGzip = /\bgzip\b/.test(request.headers["accept-encoding"] || "");
      const payload = compressible && acceptsGzip ? gzipSync(body, { level: 9 }) : body;
      response.writeHead(200, {
        "Content-Type": MIME[extension] || "application/octet-stream",
        "Content-Length": payload.length,
        ...(compressible && acceptsGzip ? { "Content-Encoding": "gzip" } : {}),
        "Cache-Control": "no-store"
      });
      response.end(payload);
    } catch {
      response.writeHead(404);
      response.end("No encontrado");
    }
  });
}

await mkdir(OUTPUT_DIR, { recursive: true });
const server = serveStatic();
await new Promise(resolve => server.listen(PORT, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", NETWORK);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE_RATE });
await page.addInitScript(() => {
  localStorage.setItem("redsa_tour_v2_visto", "true");
  localStorage.setItem("redsa_tour_seen", "true");
  localStorage.setItem("has_seen_geoportal_tour", "true");
});

await page.goto(`http://127.0.0.1:${PORT}/docs/index.html`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 120_000 });
await page.locator("#loader").waitFor({ state: "hidden", timeout: 120_000 });
await page.locator("#mobile-layers-toggle").click();
await page.locator("#event-layer-disclosure summary").click();

const activationStarted = Date.now();
await page.locator("#ant-layer-toggle").check();
await page.waitForFunction(
  () => Boolean(window.REDSAAntLayer?.getAuditState().renderMetrics.heat),
  null,
  { timeout: 120_000 }
);
const usableMs = Date.now() - activationStarted;

await page.locator("[data-ant-mode='clusters']").click();
await page.waitForFunction(
  () => Boolean(window.REDSAAntLayer?.getAuditState().renderMetrics.clusters),
  null,
  { timeout: 60_000 }
);
await page.locator("[data-ant-mode='cases']").click();
await page.waitForFunction(
  () => Boolean(window.REDSAAntLayer?.getAuditState().renderMetrics.cases),
  null,
  { timeout: 60_000 }
);

const state = await page.evaluate(() => window.REDSAAntLayer.getAuditState());
const result = {
  generatedAt: new Date().toISOString(),
  scenario: {
    viewport: VIEWPORT,
    network: "1.6 Mbps descarga, 150 ms latencia",
    cpuThrottle: CPU_THROTTLE_RATE
  },
  activationToUsableMs: usableMs,
  worker: state.metrics,
  firstRender: state.renderMetrics
};
await page.screenshot({ path: path.join(OUTPUT_DIR, "piloto_2025_mobile_cases.png"), fullPage: false });
await writeFile(path.join(OUTPUT_DIR, "resultado.json"), JSON.stringify(result, null, 2), "utf8");
console.log(JSON.stringify(result, null, 2));

await browser.close();
await new Promise(resolve => server.close(resolve));
