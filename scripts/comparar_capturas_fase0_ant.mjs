import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const PORT = 4187;
const BASE_URL = `http://127.0.0.1:${PORT}/docs/index.html`;
const BASELINE_REPORT = path.resolve("../.codex_build/ant_integracion/fase0_2026-07-27/capturas/reporte_capturas.json");
const OUTPUT_DIR = path.resolve("../.codex_build/ant_integracion/fase3_regresion/capturas");
const report = JSON.parse(await readFile(BASELINE_REPORT, "utf8"));

await mkdir(OUTPUT_DIR, { recursive: true });
const server = spawn("python", ["-m", "http.server", String(PORT)], { cwd: path.resolve("."), stdio: "ignore" });
await new Promise(resolve => setTimeout(resolve, 1200));
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const [viewportName, viewport] of Object.entries(report.config.viewports)) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("redsa_tour_v2_visto", "true");
      localStorage.setItem("redsa_tour_seen", "true");
      localStorage.setItem("has_seen_geoportal_tour", "true");
    });
    await page.goto(BASE_URL);
    await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
    await page.locator("#loader").waitFor({ state: "hidden", timeout: 90_000 });

    const captures = report.captures.filter(item => item.viewport === viewportName || (!item.viewport && item.filename.startsWith(`${viewportName}_`)));
    for (const capture of captures) {
      const state = capture.state || {};
      await page.evaluate(async target => {
        window.closeMobilePanels?.();
        window.setMobileLegend?.(false);
        window.__redsaAudit.clearSelection();
        window.__redsaAudit.selectYear(target.selectedYear || 2024);
        if (target.selectedVariable) window.__redsaAudit.selectVariable(target.selectedVariable);
        if (target.center && target.zoom) {
          window.__redsaAudit.setMapView(target.center.lat, target.center.lng, target.zoom);
        }
      }, state);

      if (capture.kind === "ui") {
        if (capture.filename.includes("_ui_ciudadano")) await page.evaluate(() => window.setMobilePanel?.("citizen", true));
        if (capture.filename.includes("_ui_datos_capas")) await page.evaluate(() => window.setMobilePanel?.("layers", true));
        if (capture.filename.includes("_ui_analisis")) await page.evaluate(() => window.setMobilePanel?.("sidebar", true));
        if (capture.filename.includes("_ui_leyenda")) await page.evaluate(() => window.setMobileLegend?.(true));
        if (capture.filename.includes("_ui_dmq_perfil")) {
          await page.evaluate(async () => {
            window.__redsaAudit.setTerritoryLevelMode("canton");
            await window.__redsaAudit.showTerritory("canton", "1701");
          });
        }
      }
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(OUTPUT_DIR, capture.filename), fullPage: false });
      results.push({ filename: capture.filename, viewport: viewportName, kind: capture.kind });
    }
    await context.close();
  }
  await writeFile(
    path.join(OUTPUT_DIR, "reporte_capturas.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), captures: results }, null, 2),
    "utf8"
  );
  console.log(`Capturas comparables generadas: ${results.length}`);
} finally {
  await browser.close();
  server.kill();
}
