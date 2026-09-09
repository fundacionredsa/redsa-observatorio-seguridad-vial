import { expect, test } from "@playwright/test";

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

async function expandLegendOnMobile(page) {
  if ((page.viewportSize()?.width || 0) <= 768) {
    const collapse = page.locator("#map-legend-card-collapse");
    if (await collapse.isVisible()) {
      await collapse.click();
      await expect(collapse).toHaveAttribute("aria-expanded", "true");
    }
  }
}

test("territory search input meets 44px minimum touch target height", async ({ page }) => {
  await loadPortal(page);

  const searchInput = page.locator("#territory-search-input");
  await expect(searchInput).toBeVisible();

  const rect = await searchInput.evaluate(el => el.getBoundingClientRect());
  expect(rect.height).toBeGreaterThanOrEqual(44);

  // Check search input does not overflow search card container
  const cardRect = await page.locator("#map-search-card").evaluate(el => el.getBoundingClientRect());
  expect(rect.bottom).toBeLessThanOrEqual(cardRect.bottom);
  expect(rect.top).toBeGreaterThanOrEqual(cardRect.top);
});

test("legend opacity slider meets 44px minimum touch target height with generic class selector", async ({ page }) => {
  await loadPortal(page);
  await page.waitForFunction(() => Boolean(window.REDSAAntLayer), null, { timeout: 90_000 });
  await expandLegendOnMobile(page);

  const opacitySlider = page.locator(".legend-opacity-slot input[type='range']");
  await expect(opacitySlider).toBeVisible();

  const rect = await opacitySlider.evaluate(el => el.getBoundingClientRect());
  expect(rect.height).toBeGreaterThanOrEqual(44);

  // Verify generic class selector matches
  const isGeneric = await opacitySlider.evaluate(el => el.matches(".legend-opacity-slot input[type='range']"));
  expect(isGeneric).toBe(true);
});
