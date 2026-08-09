import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const CONFIG = Object.freeze({
  baseUrl: "http://127.0.0.1:4173/docs/",
  outputDir: path.resolve("outputs/fase2"),
  activeOverlay: "Ciclovías",
  appReadyTimeoutMs: 90_000,
  profiles: Object.freeze({
    desktop: Object.freeze({ width: 1366, height: 768 }),
    medium: Object.freeze({ width: 1180, height: 800 }),
    mobile: Object.freeze({ width: 390, height: 844, isMobile: true, hasTouch: true })
  })
});

await mkdir(CONFIG.outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

for (const [profile, viewport] of Object.entries(CONFIG.profiles)) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: Boolean(viewport.isMobile),
    hasTouch: Boolean(viewport.hasTouch)
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("redsa_tour_v2_visto", "true");
  });
  await page.goto(CONFIG.baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: CONFIG.appReadyTimeoutMs });
  await page.locator("#loader").waitFor({ state: "hidden", timeout: CONFIG.appReadyTimeoutMs });
  await page.evaluate(overlay => window.__redsaAudit.setOverlay(overlay, true), CONFIG.activeOverlay);
  await page.waitForFunction(() => document.getElementById("active-layers-shortcut")?.dataset.activeLayerCount === "2");
  await page.evaluate(isMobile => {
    window.setRightContextPanel?.(null, false);
    if (isMobile) window.setMobilePanel?.("citizen", true);
  }, Boolean(viewport.isMobile));

  for (const theme of ["claro", "oscuro"]) {
    const isLight = await page.locator("body").evaluate(element => element.classList.contains("light-theme"));
    if ((theme === "claro") !== isLight) await page.locator("#btn-theme-toggle").click();
    await page.locator("#citizen-panel").evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({
      path: path.join(CONFIG.outputDir, `topbar-indicador-${profile}-${theme}.png`),
      fullPage: false
    });
  }

  await context.close();
}

await browser.close();
