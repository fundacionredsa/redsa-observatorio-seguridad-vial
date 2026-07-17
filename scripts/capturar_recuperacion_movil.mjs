import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const outputDir = new URL("../documentacion/evidencia_visual/recuperacion_movil/", import.meta.url);
const baseURL = "http://127.0.0.1:4179/docs/";

async function load(page, suffix = "") {
  await page.goto(`${baseURL}?capture=${encodeURIComponent(suffix)}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
  await page.locator("#loader").waitFor({ state: "hidden", timeout: 90_000 });
}

async function geometry(page) {
  return page.evaluate(() => {
    const box = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const styles = getComputedStyle(element);
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        display: styles.display,
        visibility: styles.visibility,
        pointerEvents: styles.pointerEvents
      };
    };
    const state = window.__redsaAudit.state();
    const citizen = box("#citizen-panel");
    const profile = box("#demographic-hover-card");
    const legend = box(".legend-panel");
    const intersects = (a, b) => Boolean(a && b && a.width && b.width
      && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom));
    return {
      viewport: { width: innerWidth, height: innerHeight },
      bodyClass: document.body.className,
      state: {
        zoom: state.zoom,
        level: state.level,
        territoryLevelMode: state.territoryLevelMode,
        selectedTerritory: state.selectedTerritory,
        selectedVariable: state.selectedVariable,
        selectedYear: state.selectedYear
      },
      map: box("#map"),
      citizen,
      sidebar: box("#territory-sidebar"),
      technical: box("#technical-drawer"),
      selector: box(".map-selector-control"),
      slider: box("#map-year-slider"),
      level: box("#territory-level-control"),
      profile,
      legend,
      attribution: box(".leaflet-control-attribution"),
      freeVerticalMapBand: citizen && legend ? legend.top - citizen.bottom : null,
      profileLegendIntersects: intersects(profile, legend)
    };
  });
}

await mkdir(outputDir, { recursive: true });
const server = spawn("python", ["-m", "http.server", "4179"], { stdio: "ignore" });
const browser = await chromium.launch({ headless: true });
const report = { generatedAt: new Date().toISOString(), after: {} };

try {
  await new Promise(resolve => setTimeout(resolve, 1200));

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await load(phone, "390-initial");
  await phone.screenshot({ path: fileURLToPath(new URL("despues_390x844_inicial.png", outputDir)) });
  report.after.phone390Initial = await geometry(phone);

  await phone.locator("#mobile-sidebar-toggle").tap();
  await phone.waitForFunction(() => document.querySelector("#territory-sidebar").getBoundingClientRect().left >= 0);
  await phone.screenshot({ path: fileURLToPath(new URL("despues_390x844_sidebar.png", outputDir)) });
  report.after.phone390Sidebar = await geometry(phone);
  await phone.locator("#mobile-sidebar-close").tap();

  await phone.locator("#mobile-layers-toggle").tap();
  await phone.waitForFunction(() => document.querySelector("#technical-drawer").getBoundingClientRect().right <= innerWidth);
  await phone.screenshot({ path: fileURLToPath(new URL("despues_390x844_capas.png", outputDir)) });
  report.after.phone390Layers = await geometry(phone);

  const slider = phone.locator("#map-year-slider");
  const sliderBox = await slider.boundingBox();
  await phone.touchscreen.tap(sliderBox.x + sliderBox.width * 0.6, sliderBox.y + sliderBox.height / 2);
  await phone.waitForFunction(() => window.__redsaAudit.state().selectedYear === 2022);
  await phone.locator("#technical-drawer-close").tap();
  await phone.waitForFunction(() => document.querySelector("#technical-drawer").getBoundingClientRect().left >= innerWidth - 1);

  const tapPoint = await phone.evaluate(() => window.__redsaAudit.prepareTerritoryTap("canton", "1701"));
  await phone.touchscreen.tap(tapPoint.x, tapPoint.y);
  await phone.waitForFunction(() => window.__redsaAudit.state().selectedTerritory?.code === "1701");
  await phone.screenshot({ path: fileURLToPath(new URL("despues_390x844_seleccion.png", outputDir)) });
  report.after.phone390Selection = await geometry(phone);

  await phone.locator("#mobile-legend-toggle").tap();
  await phone.screenshot({ path: fileURLToPath(new URL("despues_390x844_leyenda_abierta.png", outputDir)) });
  report.after.phone390Legend = await geometry(phone);
  await phone.close();

  for (const viewport of [
    { width: 360, height: 740, file: "despues_360x740_inicial.png", key: "phone360Initial" },
    { width: 768, height: 1024, file: "despues_768x1024_inicial.png", key: "tablet768Initial" }
  ]) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: true,
      isMobile: true
    });
    await load(page, viewport.key);
    await page.screenshot({ path: fileURLToPath(new URL(viewport.file, outputDir)) });
    report.after[viewport.key] = await geometry(page);
    await page.close();
  }

  const desktop = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await load(desktop, "desktop-initial");
  await desktop.screenshot({ path: fileURLToPath(new URL("despues_desktop_1366x768_inicial.png", outputDir)) });
  report.after.desktopInitial = await geometry(desktop);
  await desktop.goto(`${baseURL}?capture=desktop-selection#canton=DISTRITO%20METROPOLITANO%20DE%20QUITO`, { waitUntil: "domcontentloaded" });
  await desktop.locator("#loader").waitFor({ state: "hidden", timeout: 90_000 });
  await desktop.locator("#demographic-hover-card").waitFor({ state: "visible", timeout: 10_000 });
  await desktop.waitForTimeout(700);
  await desktop.screenshot({ path: fileURLToPath(new URL("despues_desktop_1366x768_seleccion.png", outputDir)) });
  report.after.desktopSelection = await geometry(desktop);
  await desktop.close();

  await writeFile(new URL("mediciones.json", outputDir), JSON.stringify(report, null, 2), "utf8");
} finally {
  await browser.close();
  server.kill();
}

console.log(`Evidencia movil escrita en ${fileURLToPath(outputDir)}`);
