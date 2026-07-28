import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.REDSA_BASE_URL || "http://127.0.0.1:4173/docs/index.html";
const OUTPUT_DIR = path.resolve(".codex_build/ant_integracion/fase3_sensibilidad");
const PROFILES = ["focused", "balanced_provisional", "broad"];
const SCALES = [
  { id: "nacional", prepare: () => window.__redsaAudit.setMapView(-1.45, -78.4, 6) },
  { id: "cantonal", prepare: () => window.__redsaAudit.setMapView(-0.22, -78.5, 9) },
  { id: "urbana", prepare: () => window.__redsaAudit.setMapView(-0.22, -78.5, 14) }
];

await mkdir(OUTPUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
await page.addInitScript(() => {
  localStorage.setItem("redsa_tour_v2_visto", "true");
  localStorage.setItem("redsa_tour_seen", "true");
  localStorage.setItem("has_seen_geoportal_tour", "true");
});
await page.goto(BASE_URL);
await page.waitForFunction(() => Boolean(window.__redsaAudit));
await page.locator("#loader").waitFor({ state: "hidden", timeout: 90_000 });
await page.locator("#event-layer-disclosure summary").click();
await page.locator("#ant-layer-toggle").check();
await page.waitForFunction(() => window.REDSAAntLayer?.getAuditState().status === "ready", null, { timeout: 90_000 });

const results = [];
for (const profile of PROFILES) {
  await page.evaluate(name => window.REDSAAntLayer.setHeatBandwidthProfile(name), profile);
  for (const scale of SCALES) {
    await page.evaluate(scale.prepare);
    await page.waitForTimeout(700);
    const metrics = await page.evaluate(() => {
      const canvas = document.querySelector(".leaflet-heatmap-layer");
      if (!canvas) return { canvasFound: false };
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let visible = 0;
      let alphaSum = 0;
      let maxAlpha = 0;
      const alphaValues = [];
      for (let index = 3; index < pixels.length; index += 4) {
        const alpha = pixels[index];
        if (alpha > 0) {
          visible += 1;
          alphaSum += alpha;
          maxAlpha = Math.max(maxAlpha, alpha);
          alphaValues.push(alpha);
        }
      }
      alphaValues.sort((left, right) => left - right);
      const p95 = alphaValues.length ? alphaValues[Math.floor(alphaValues.length * 0.95)] : 0;
      return {
        canvasFound: true,
        width: canvas.width,
        height: canvas.height,
        visiblePixelRatio: visible / Math.max(1, canvas.width * canvas.height),
        meanVisibleAlpha: visible ? alphaSum / visible : 0,
        p95Alpha: p95,
        maxAlpha,
        render: window.REDSAAntLayer.getAuditState().renderMetrics.heat
      };
    });
    const row = { profile, scale: scale.id, ...metrics };
    results.push(row);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `${profile}_${scale.id}.png`),
      fullPage: false
    });
  }
}

await writeFile(
  path.join(OUTPUT_DIR, "resultados.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2),
  "utf8"
);
console.log(JSON.stringify(results, null, 2));
await browser.close();
