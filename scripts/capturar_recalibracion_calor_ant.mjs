import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.REDSA_BASE_URL || "http://127.0.0.1:4173/docs/index.html";
const OUTPUT_DIR = path.resolve(
  process.env.REDSA_HEAT_OUTPUT || "artifacts/heat-bandwidth-20260730/current"
);
const YEAR = 2025;
const TARGETS = [
  { id: "nacional_z7", center: [-1.45, -78.4], zoom: 7 },
  { id: "ciudad_quito_z13", center: [-0.20, -78.43], zoom: 13 },
  { id: "calle_quito_z17", center: [-0.205, -78.43], zoom: 17 }
];

await mkdir(OUTPUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await context.newPage();

await page.addInitScript(() => {
  localStorage.setItem("redsa_tour_v2_visto", "true");
  localStorage.setItem("redsa_tour_seen", "true");
  localStorage.setItem("has_seen_geoportal_tour", "true");
});

await page.goto(BASE_URL);
await page.waitForFunction(() => Boolean(window.__redsaAudit));
await page.locator("#loader").waitFor({ state: "hidden", timeout: 90_000 });
await page.evaluate(year => window.__redsaAudit.selectYear(year), YEAR);
await page.locator("#event-layer-disclosure summary").click();
await page.locator("#ant-layer-toggle").check();
await page.waitForFunction(
  () => window.REDSAAntLayer?.getAuditState().status === "ready",
  null,
  { timeout: 90_000 }
);

await page.evaluate(() => {
  if (document.body.classList.contains("citizen-panel-open")) {
    document.getElementById("citizen-panel-visibility-toggle")?.click();
  }
  if (document.getElementById("technical-panel-toggle")?.getAttribute("aria-expanded") === "true") {
    document.getElementById("technical-panel-toggle")?.click();
  }
  if (document.getElementById("mobile-legend-toggle")?.getAttribute("aria-expanded") === "true") {
    document.getElementById("mobile-legend-toggle")?.click();
  }
});

const results = [];
for (const target of TARGETS) {
  await page.evaluate(
    ({ center, zoom }) => window.__redsaAudit.setMapView(center[0], center[1], zoom),
    target
  );
  await page.waitForFunction(
    zoom => window.REDSAAntLayer?.getAuditState().renderMetrics.heat?.zoom === zoom,
    target.zoom,
    { timeout: 30_000 }
  );
  await page.waitForTimeout(350);

  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector(".leaflet-heatmap-layer");
    const audit = window.REDSAAntLayer.getAuditState();
    if (!canvas) return { canvasFound: false, render: audit.renderMetrics.heat };
    const pixels = canvas
      .getContext("2d", { willReadFrequently: true })
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let visiblePixels = 0;
    let opaquePixels = 0;
    let warmPixels = 0;
    let alphaSum = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const alpha = pixels[index + 3];
      if (alpha > 0) {
        visiblePixels += 1;
        alphaSum += alpha;
      }
      if (alpha >= 180) opaquePixels += 1;
      if (alpha > 0 && red >= 180 && green >= 70) warmPixels += 1;
    }
    const total = Math.max(1, canvas.width * canvas.height);
    return {
      canvasFound: true,
      width: canvas.width,
      height: canvas.height,
      visiblePixelRatio: visiblePixels / total,
      opaquePixelRatio: opaquePixels / total,
      warmPixelRatio: warmPixels / total,
      meanVisibleAlpha: visiblePixels ? alphaSum / visiblePixels : 0,
      render: audit.renderMetrics.heat
    };
  });

  await page.locator("#map").screenshot({
    path: path.join(OUTPUT_DIR, `${target.id}.png`)
  });
  results.push({ ...target, year: YEAR, ...metrics });
}

await writeFile(
  path.join(OUTPUT_DIR, "metricas.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2),
  "utf8"
);
console.log(JSON.stringify(results, null, 2));

await context.close();
await browser.close();
