import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const outputDir = new URL("../artifacts/fallecidos-territorial/", import.meta.url);
const baseURL = "http://127.0.0.1:4175/docs/";
const levels = ["province", "canton", "parish"];

await mkdir(outputDir, { recursive: true });
const server = spawn("python", ["-m", "http.server", "4175"], { stdio: "ignore" });
const browser = await chromium.launch({ headless: true });
const report = [];

try {
  await new Promise(resolve => setTimeout(resolve, 1200));
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await context.addInitScript(() => localStorage.setItem("redsa_tour_visto", "true"));
  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
  await page.locator("#loader").waitFor({ state: "hidden", timeout: 90_000 });

  for (const level of levels) {
    await page.evaluate(value => {
      window.__redsaAudit.selectVariable("fallecidos_parroquial");
      window.__redsaAudit.selectYear(2024);
      window.__redsaAudit.setTerritoryLevelMode(value);
    }, level);
    await page.waitForFunction(
      expected => window.__redsaActiveBins?.variable === "fallecidos_parroquial"
        && window.__redsaActiveBins?.level === expected,
      level,
      { timeout: 90_000 }
    );
    await page.waitForTimeout(300);
    const filename = `${level}_fallecidos_edg_2024.png`;
    await page.screenshot({ path: fileURLToPath(new URL(filename, outputDir)) });
    report.push({
      level,
      filename,
      state: await page.evaluate(() => window.__redsaAudit.state()),
      legend: await page.locator(".legend-panel").innerText(),
    });
  }

  await page.evaluate(() => {
    window.__redsaAudit.setTerritoryLevelMode("canton");
    window.__redsaAudit.showTerritory("canton", "1413");
  });
  await page.waitForFunction(() => document.querySelector("#cabecera-warning-box")?.textContent.includes("Sin cobertura parroquial"));
  const filename = "canton_1413_sin_cobertura.png";
  await page.screenshot({ path: fileURLToPath(new URL(filename, outputDir)) });
  report.push({
    level: "canton",
    code: "1413",
    filename,
    warning: await page.locator("#cabecera-warning-box").innerText(),
  });

  await writeFile(new URL("reporte.json", outputDir), JSON.stringify(report, null, 2), "utf8");
  await context.close();
} finally {
  await browser.close();
  server.kill();
}

console.log(`Generadas ${report.length} evidencias en ${outputDir.pathname}`);
