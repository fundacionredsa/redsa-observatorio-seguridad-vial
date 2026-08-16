import { chromium, devices } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { gzipSync } from "node:zlib";

const port = 4182;
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
    const relative = pathname === "/" ? "docs/index.html" : pathname.replace(/^\/+/, "");
    const filePath = join(process.cwd(), relative);
    const body = await readFile(filePath);
    const shouldGzip = /siniestros_ant_2025_heat\.json$/.test(filePath);
    const output = shouldGzip ? gzipSync(body, { level: 9 }) : body;
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
      "Content-Length": output.byteLength,
      ...(shouldGzip ? { "Content-Encoding": "gzip" } : {})
    });
    response.end(output);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});
await new Promise(resolve => server.listen(port, "127.0.0.1", resolve));

try {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("redsa_tour_v2_visto", "true");
    localStorage.setItem("redsa_tour_seen", "true");
    localStorage.setItem("has_seen_geoportal_tour", "true");
  });
  await page.goto(`http://127.0.0.1:${port}/docs/index.html`);
  await page.waitForFunction(() => Boolean(window.__redsaAudit));
  await page.locator("#loader").waitFor({ state: "hidden", timeout: 90_000 });
  await page.locator("#mobile-layers-toggle").click();
  await page.locator("#event-layer-disclosure summary").click();

  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 200_000,
    uploadThroughput: 100_000,
    connectionType: "cellular3g"
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const started = performance.now();
  await page.locator("#ant-layer-toggle").check();
  await page.waitForFunction(
    () => window.REDSAAntLayer.getAuditState().status === "ready",
    null,
    { timeout: 90_000 }
  );
  const wallMs = performance.now() - started;
  const audit = await page.evaluate(() => window.REDSAAntLayer.getAuditState());
  console.log(JSON.stringify({
    wallMs,
    metrics: audit.metrics,
    heatRender: audit.renderMetrics.heat,
    dataSource: audit.dataSource,
    pointCount: audit.pointCount
  }, null, 2));
  await browser.close();
} finally {
  server.close();
}
