import { chromium } from "@playwright/test";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const outputDir = new URL("../documentacion/evidencia_visual/interaccion_profesional/", import.meta.url);
const previousDir = new URL("../documentacion/evidencia_visual/redesign_nacional/", import.meta.url);
const baseURL = "http://127.0.0.1:4175/docs/";

function intersects(a, b) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

async function geometry(page, obstacleSelector = null) {
  return page.evaluate(selector => {
    const box = element => {
      const rect = document.querySelector(element).getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    return {
      card: box("#demographic-hover-card"),
      legend: box(".legend-panel"),
      obstacle: selector ? box(selector) : null,
      viewport: { width: innerWidth, height: innerHeight },
      state: window.__redsaAudit.state()
    };
  }, obstacleSelector);
}

async function load(page) {
  await page.addInitScript(() => localStorage.setItem("redsa_tour_visto", "true"));
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
  await page.locator("#loader").waitFor({ state: "hidden", timeout: 90_000 });
}

await mkdir(outputDir, { recursive: true });
await copyFile(new URL("despues_desktop_1366x768.png", previousDir), new URL("antes_desktop_1366x768.png", outputDir));
await copyFile(new URL("despues_mobile_390x844.png", previousDir), new URL("antes_mobile_390x844.png", outputDir));

const server = spawn("python", ["-m", "http.server", "4175"], { stdio: "ignore" });
const browser = await chromium.launch({ headless: true });
const report = {};

try {
  await new Promise(resolve => setTimeout(resolve, 1200));

  const desktop = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await load(desktop);
  await desktop.evaluate(() => {
    window.__redsaAudit.setZoom(9);
    window.__redsaAudit.fireTerritoryEvent("canton", "1701", "click");
  });
  await desktop.locator("#demographic-hover-card").waitFor({ state: "visible" });
  await desktop.screenshot({ path: fileURLToPath(new URL("despues_desktop_seleccion.png", outputDir)) });
  report.desktopSelection = await geometry(desktop);

  await desktop.locator("#open-analysis-button").click();
  await desktop.waitForTimeout(320);
  await desktop.screenshot({ path: fileURLToPath(new URL("despues_desktop_sidebar.png", outputDir)) });
  report.desktopSidebar = await geometry(desktop, "#territory-sidebar");
  report.desktopSidebar.intersects = intersects(report.desktopSidebar.card, report.desktopSidebar.obstacle);
  await desktop.locator("#mobile-sidebar-close").click();

  await desktop.locator("#technical-drawer").waitFor({ state: "visible" });
  await desktop.waitForTimeout(320);
  await desktop.screenshot({ path: fileURLToPath(new URL("despues_desktop_nivel_manual.png", outputDir)) });
  report.desktopTechnical = await geometry(desktop, "#technical-drawer");
  report.desktopTechnical.intersects = intersects(report.desktopTechnical.card, report.desktopTechnical.obstacle);
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await load(mobile);
  await mobile.evaluate(() => {
    window.__redsaAudit.setZoom(9);
    window.__redsaAudit.fireTerritoryEvent("canton", "1701", "click");
  });
  await mobile.locator("#demographic-hover-card").waitFor({ state: "visible" });
  await mobile.screenshot({ path: fileURLToPath(new URL("despues_mobile_seleccion.png", outputDir)) });
  report.mobileSelection = await geometry(mobile);
  report.mobileSelection.legendIntersects = intersects(report.mobileSelection.card, report.mobileSelection.legend);

  await mobile.locator("#profile-card-close").click();
  await mobile.locator("#mobile-layers-toggle").click();
  await mobile.waitForTimeout(320);
  await mobile.screenshot({ path: fileURLToPath(new URL("despues_mobile_nivel_manual.png", outputDir)) });
  await mobile.close();

  await writeFile(new URL("mediciones.json", outputDir), JSON.stringify(report, null, 2), "utf8");
} finally {
  await browser.close();
  server.kill();
}

console.log(`Evidencia escrita en ${fileURLToPath(outputDir)}`);
