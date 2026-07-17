import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const outputDir = new URL("../documentacion/evidencia_visual/ranking_institucional/", import.meta.url);
const baseURL = "http://127.0.0.1:4180/docs/";

async function load(page, suffix) {
  await page.goto(`${baseURL}?capture=${suffix}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__redsaAudit && window.__redsaInstitutionalAudit), null, { timeout: 90_000 });
  await page.locator("#loader").waitFor({ state: "hidden", timeout: 90_000 });
}

async function measure(page) {
  return page.evaluate(() => {
    const box = selector => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height } : null;
    };
    const ranking = window.__redsaInstitutionalAudit.state();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      dialog: box(".institutional-dialog"),
      table: box(".ranking-table-wrap"),
      activeTab: ranking.activeTab,
      variable: ranking.variable,
      year: ranking.year,
      totalCount: ranking.totalCount,
      validCount: ranking.validCount,
      excludedCount: ranking.excludedCount,
      displayedCount: ranking.displayedRows.length
    };
  });
}

await mkdir(outputDir, { recursive: true });
const server = spawn("python", ["-m", "http.server", "4180"], { stdio: "ignore" });
const browser = await chromium.launch({ headless: true });
const report = { generatedAt: new Date().toISOString(), captures: {} };

try {
  await new Promise(resolve => setTimeout(resolve, 1200));

  const desktop = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await load(desktop, "institutional-desktop");
  await desktop.locator("#open-institutional-button").click();
  await desktop.screenshot({ path: fileURLToPath(new URL("ranking_desktop_1366x768.png", outputDir)) });
  report.captures.rankingDesktop = await measure(desktop);
  await desktop.locator("#institutional-tab-trust").click();
  await desktop.screenshot({ path: fileURLToPath(new URL("confianza_desktop_1366x768.png", outputDir)) });
  report.captures.trustDesktop = await measure(desktop);
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await load(mobile, "institutional-mobile");
  await mobile.locator("#open-institutional-button").tap();
  await mobile.locator("#ranking-search-input").fill("Distrito Metropolitano de Quito");
  await mobile.screenshot({ path: fileURLToPath(new URL("ranking_mobile_390x844.png", outputDir)) });
  report.captures.rankingMobile = await measure(mobile);
  await mobile.locator("#institutional-tab-citation").tap();
  await mobile.screenshot({ path: fileURLToPath(new URL("citacion_mobile_390x844.png", outputDir)) });
  report.captures.citationMobile = await measure(mobile);
  await mobile.close();

  await writeFile(new URL("mediciones.json", outputDir), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Evidencia institucional escrita en ${fileURLToPath(outputDir)}`);
} finally {
  await browser.close();
  server.kill();
}
