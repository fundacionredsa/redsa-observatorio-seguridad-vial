import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("Fase 10 - E1: Estructura de Barra Superior", () => {
  const viewports = [
    { name: "1920", width: 1920, height: 945, isMobile: false },
    { name: "1440", width: 1440, height: 900, isMobile: false },
    { name: "1180", width: 1180, height: 800, isMobile: false },
    { name: "390", width: 390, height: 844, isMobile: true }
  ];

  for (const vp of viewports) {
    test(`E1 medicion y comportamiento en ${vp.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript(() => {
        localStorage.setItem("redsa_tour_v2_visto", "true");
        localStorage.setItem("redsa_tour_seen", "true");
        localStorage.setItem("redsa_light_theme", "true");
      });
      await page.goto("./", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(window.__redsaAudit));
      await expect(page.locator("#loader")).toBeHidden({ timeout: 90_000 });

      const topbar = page.locator("#site-topbar");
      const topbarMain = page.locator(".site-topbar-main");
      const brand = page.locator(".site-topbar-brand");
      const brandMark = page.locator(".site-topbar-brand-mark");
      const centerControls = page.locator(".site-topbar-center-controls");
      const rightGroup = page.locator(".site-topbar-right");
      const menuToggle = page.locator("#site-topbar-menu-toggle");
      const themeBtn = page.locator("#btn-theme-toggle");
      const actionsMenu = page.locator("#site-topbar-actions");

      // 1. Measure positions and heights
      const topbarBox = await topbar.boundingBox();
      const mainBox = await topbarMain.boundingBox();
      const brandBox = await brand.boundingBox();
      const brandMarkBox = await brandMark.boundingBox();

      console.log(`\n=== Medición en ${vp.name}px ===`);
      console.log("Topbar:", topbarBox);
      console.log("Topbar Main:", mainBox);
      console.log("Brand:", brandBox);
      console.log("Brand Mark:", brandMarkBox);

      // Verify brand is visible and within viewport (y >= 0)
      expect(topbarBox.y).toBe(0);
      expect(brandBox.y).toBeGreaterThanOrEqual(0);
      expect(brandBox.y + brandBox.height).toBeLessThanOrEqual(topbarBox.height);
      expect(brandMarkBox.y).toBeGreaterThanOrEqual(0);
      expect(brandMarkBox.y + brandMarkBox.height).toBeLessThanOrEqual(topbarBox.height);

      if (!vp.isMobile) {
        const centerBox = await centerControls.boundingBox();
        const rightBox = await rightGroup.boundingBox();
        console.log("Center Controls:", centerBox);
        console.log("Right Group:", rightBox);

        expect(centerBox.y).toBeGreaterThanOrEqual(0);
        expect(centerBox.y + centerBox.height).toBeLessThanOrEqual(topbarBox.height);
        expect(rightBox.y).toBeGreaterThanOrEqual(0);
        expect(rightBox.y + rightBox.height).toBeLessThanOrEqual(topbarBox.height);
      }

      // Check that menu is closed by default
      await expect(actionsMenu).toBeHidden();
      await expect(menuToggle).toHaveAttribute("aria-expanded", "false");

      // Take screenshot with menu closed
      const outDir = path.resolve("outputs/fase10");
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      await page.screenshot({ path: path.join(outDir, `topbar-${vp.name}-cerrado.png`) });

      // 2. Open menu via toggle
      await menuToggle.click();
      await expect(actionsMenu).toBeVisible();
      await expect(menuToggle).toHaveAttribute("aria-expanded", "true");
      await page.screenshot({ path: path.join(outDir, `topbar-${vp.name}-abierto.png`) });

      // 3. Test Escape key closes menu and focuses toggle
      await page.keyboard.press("Escape");
      await expect(actionsMenu).toBeHidden();
      await expect(menuToggle).toHaveAttribute("aria-expanded", "false");
      expect(await page.evaluate(() => document.activeElement?.id)).toBe("site-topbar-menu-toggle");

      // 4. Test click outside closes menu
      await menuToggle.click();
      await expect(actionsMenu).toBeVisible();
      await page.mouse.click(vp.width / 2, vp.height / 2);
      await expect(actionsMenu).toBeHidden();
      await expect(menuToggle).toHaveAttribute("aria-expanded", "false");

      // 5. Test Dark Theme topbar
      await themeBtn.click();
      await expect(page.locator("body")).not.toHaveClass(/light-theme/);
      await page.screenshot({ path: path.join(outDir, `topbar-${vp.name}-oscuro.png`) });
    });
  }
});
