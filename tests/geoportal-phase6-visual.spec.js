import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const CAPTURE_CONFIG = Object.freeze({
  outputDir: path.resolve("artifacts/fase6-ga-gd"),
  themes: Object.freeze([
    Object.freeze({ id: "claro", light: true }),
    Object.freeze({ id: "oscuro", light: false })
  ])
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("redsa_tour_v2_visto", "true");
    localStorage.setItem("redsa_tour_seen", "true");
    localStorage.setItem("has_seen_geoportal_tour", "true");
  });
});

async function loadPortal(page) {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
  await expect(page.locator("#loader")).toBeHidden({ timeout: 90_000 });
}

test("captura la barra de controles y la leyenda única en claro y oscuro", async ({ page }, testInfo) => {
  await loadPortal(page);
  await fs.mkdir(CAPTURE_CONFIG.outputDir, { recursive: true });

  await page.evaluate(() => {
    window.__redsaAudit.setOverlay("Ciclovías", true);
  });
  await page.waitForFunction(() => window.__redsaAudit.state().osmLayers["Ciclovías"].loaded, null, { timeout: 90_000 });

  for (const theme of CAPTURE_CONFIG.themes) {
    await page.evaluate(light => {
      document.body.classList.toggle("light-theme", light);
      localStorage.setItem("redsa_light_theme", String(light));
      document.dispatchEvent(new CustomEvent("redsa:themechange", { detail: { light } }));
    }, theme.light);

    await expect(page.locator("#map-legend-card")).toBeVisible();
    if (testInfo.project.name === "mobile") {
      await expect(page.locator(".site-topbar-center-controls")).toBeHidden();
      await expect(page.locator("#mobile-level-bar")).toBeVisible();
      await expect(page.locator("#mobile-year-bar")).toBeVisible();
    } else {
      await expect(page.locator(".site-topbar-center-controls")).toBeVisible();
    }

    const outputPath = path.join(CAPTURE_CONFIG.outputDir, `fase6-${testInfo.project.name}-${theme.id}.png`);
    await page.screenshot({ path: outputPath, fullPage: false });
  }
});
