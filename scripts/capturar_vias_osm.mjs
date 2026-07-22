import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const CONFIG = {
  baseURL: "http://127.0.0.1:4176/docs/",
  outputDir: new URL("../documentacion/evidencia_visual/vias_osm/", import.meta.url),
  viewport: { width: 1366, height: 768 }
};

async function loadPortal(page) {
  await page.addInitScript(() => localStorage.setItem("redsa_tour_v2_visto", "true"));
  await page.goto(CONFIG.baseURL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
  await page.locator("#loader").waitFor({ state: "hidden", timeout: 90_000 });
}

async function setRoadLayer(page, name, visible) {
  await page.evaluate(([layerName, layerVisible]) => {
    window.__redsaAudit.setOverlay(layerName, layerVisible);
  }, [name, visible]);
  if (visible) {
    await page.waitForFunction(
      layerName => window.__redsaAudit.state().osmLayers[layerName].loaded,
      name,
      { timeout: 90_000 }
    );
  }
}

await mkdir(CONFIG.outputDir, { recursive: true });
const server = spawn("python", ["-m", "http.server", "4176"], { stdio: "ignore" });
const browser = await chromium.launch({ headless: true });
const report = {};

try {
  await new Promise(resolve => setTimeout(resolve, 1200));
  const page = await browser.newPage({ viewport: CONFIG.viewport });
  await loadPortal(page);
  await page.evaluate(() => window.__redsaAudit.selectVariable("limites"));

  await setRoadLayer(page, "Vías principales", true);
  await page.screenshot({ path: fileURLToPath(new URL("01_vias_principales.png", CONFIG.outputDir)) });
  report.principales = await page.evaluate(() => window.__redsaAudit.state().osmLayers["Vías principales"]);

  await setRoadLayer(page, "Vías principales", false);
  await setRoadLayer(page, "Vías secundarias", true);
  await page.screenshot({ path: fileURLToPath(new URL("02_vias_secundarias.png", CONFIG.outputDir)) });
  report.secundarias = await page.evaluate(() => window.__redsaAudit.state().osmLayers["Vías secundarias"]);

  await setRoadLayer(page, "Vías principales", true);
  await page.screenshot({ path: fileURLToPath(new URL("03_ambas_capas.png", CONFIG.outputDir)) });
  report.ambas = await page.evaluate(() => ({
    principales: window.__redsaAudit.state().osmLayers["Vías principales"].visible,
    secundarias: window.__redsaAudit.state().osmLayers["Vías secundarias"].visible
  }));

  await setRoadLayer(page, "Vías principales", false);
  await setRoadLayer(page, "Vías secundarias", false);
  await page.evaluate(() => window.__redsaAudit.selectVariable("densidad_vial_osm"));
  await page.screenshot({ path: fileURLToPath(new URL("04_densidad_vial.png", CONFIG.outputDir)) });
  report.densidad = await page.evaluate(() => ({
    layer: window.__redsaAudit.state().layers.roadDensity,
    bins: window.__redsaAudit.state().bins,
    validValueCount: window.__redsaAudit.state().validValueCount,
    legend: document.querySelector(".legend-panel")?.innerText
  }));

  await page.close();
  await writeFile(
    new URL("mediciones.json", CONFIG.outputDir),
    JSON.stringify(report, null, 2),
    "utf8"
  );
} finally {
  await browser.close();
  server.kill();
}

console.log(`Evidencia escrita en ${fileURLToPath(CONFIG.outputDir)}`);
