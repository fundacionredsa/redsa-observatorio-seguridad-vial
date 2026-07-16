import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const outputDir = new URL("../artifacts/screenshots/", import.meta.url);
const baseURL = "http://127.0.0.1:4174/docs/";
const variables = [
  "normal",
  "siniestros_inec_2019",
  "fallecidos_inec_2019",
  "tasa_fallecidos_100k",
  "tasa_siniestros_1000_vehiculos_2024",
  "tasa_motociclistas_1000_motos_2024",
  "fallecidos_sppat_2016_2021",
  "fallecidos_parroquial"
];
const levels = { province: 6, canton: 9, parish: 12 };
const viewports = { desktop: { width: 1366, height: 768 }, mobile: { width: 390, height: 844 } };

await mkdir(outputDir, { recursive: true });
const server = spawn("python", ["-m", "http.server", "4174"], { stdio: "ignore" });
const browser = await chromium.launch({ headless: true });
const report = [];
try {
  await new Promise(resolve => setTimeout(resolve, 1200));
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto(baseURL, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
    for (const [levelName, zoom] of Object.entries(levels)) {
      for (const variable of variables) {
        console.log(`Capturando ${viewportName}/${levelName}/${variable}`);
        await page.evaluate(({ zoom, variable }) => {
          window.__redsaAudit.setZoom(zoom);
          window.__redsaAudit.selectVariable(variable);
        }, { zoom, variable });
        await page.waitForFunction(
          expectedLevel => {
            const state = window.__redsaAudit.state();
            return state.level === expectedLevel
              && (expectedLevel !== "parish" || state.layers.parish.ready);
          },
          levelName,
          { timeout: 90_000 }
        );
        await page.waitForTimeout(250);
        const state = await page.evaluate(() => window.__redsaAudit.state());
        const filename = `${viewportName}_${levelName}_${variable}.png`;
        await page.screenshot({ path: fileURLToPath(new URL(filename, outputDir)), fullPage: false });
        report.push({ viewport: viewportName, level: levelName, variable, filename, state });
      }
    }
    await context.close();
  }
  await writeFile(new URL("reporte_capturas.json", outputDir), JSON.stringify(report, null, 2), "utf8");
} finally {
  await browser.close();
  server.kill();
}
console.log(`Generadas ${report.length} capturas en ${outputDir.pathname}`);
