import { chromium, devices } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
try {
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
  await page.goto("https://geoportal.observatorio.fundacionredsa.org/");
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
} finally {
  await browser.close();
}
