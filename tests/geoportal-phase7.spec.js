import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("redsa_tour_v2_visto", "true"));
});

async function loadPortal(page) {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
  await expect(page.locator("#loader")).toBeHidden({ timeout: 90_000 });
}

function intersects(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function rect(page, selector) {
  return page.locator(selector).evaluate(element => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
  });
}

test("Fase 9 conserva Nivel y Año visibles sin saturar el topbar", async ({ page }, testInfo) => {
  await loadPortal(page);
  if (testInfo.project.name === "mobile") {
    await expect(page.locator(".site-topbar-center-controls")).toBeHidden();
    await expect(page.locator("#mobile-level-bar [data-level-mode]")).toHaveCount(4);
    await expect(page.locator("#mobile-year-bar")).toBeVisible();
    return;
  }
  await expect(page.locator("#territory-level-select option")).toHaveCount(4);
  await page.locator("#territory-level-select").selectOption("canton");
  await expect(page.locator("#territory-level-select")).toHaveValue("canton");
  await expect(page.locator("#map-year-slider")).toBeVisible();
  await expect(page.locator("#timeline-play-button")).toBeVisible();
  const topbar = await rect(page, ".site-topbar");
  expect(topbar.height).toBeLessThanOrEqual(48);
});

test("IA fija la leyenda a la izquierda sin intersecciones en todas las combinaciones", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "La leyenda fija a la izquierda sin solapamiento con paneles se valida en desktop y medium.");
  await loadPortal(page);
  const search = await rect(page, ".map-search-card");
  const legend = await rect(page, "#map-legend-card");
  const rail = await rect(page, "#right-tools-rail");
  expect(intersects(search, legend), JSON.stringify({ search, legend })).toBeFalsy();
  expect(intersects(legend, rail), JSON.stringify({ legend, rail })).toBeFalsy();

  for (const panel of ["analysis", "layers"]) {
    await page.locator(`[data-right-panel="${panel}"]`).click();
    await expect(page.locator("#right-context-host")).toHaveAttribute("data-active-panel", panel);
    const fixedLegend = await rect(page, "#map-legend-card");
    const host = await rect(page, "#right-context-host");
    expect(fixedLegend.left).toBe(legend.left);
    expect(fixedLegend.width).toBeLessThanOrEqual(legend.width);
    expect(intersects(fixedLegend, host), JSON.stringify({ fixedLegend, host, panel })).toBeFalsy();
  }
});

test("IB ofrece dos pestañas ARIA y análisis con ancho propio", async ({ page }, testInfo) => {
  await loadPortal(page);
  await expect(page.locator("[role=tab][data-right-panel]")).toHaveCount(2);
  await page.locator("#right-tab-analysis").click();
  await expect(page.locator("#territory-sidebar")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#right-tab-analysis")).toHaveAttribute("aria-selected", "true");
  if (testInfo.project.name !== "mobile") {
    const analysis = await rect(page, "#territory-sidebar");
    expect(analysis.width).toBeGreaterThan(400);
  }
  if (testInfo.project.name === "mobile") {
    await page.locator("#mobile-sidebar-close").click();
  } else {
    await page.locator("#right-tab-analysis").click();
  }
  await expect(page.locator("#right-context-host")).toBeHidden();
});

test("IC mantiene Periodo e Intensidad en CAPAS y la visibilidad parroquial", async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === "mobile";
  await loadPortal(page);
  if (isMobile) {
    await expect(page.locator("#mobile-period-control-slot .period-mode-control")).toBeVisible();
    await expect(page.locator("#mobile-opacity-control-slot #territory-opacity-control")).toBeVisible();
    await page.evaluate(() => window.hideUnifiedLegend?.());
  } else {
    await page.locator("#right-tab-layers").click();
    await page.locator("#view-settings-disclosure summary").click();
    await expect(page.locator("#view-settings-disclosure")).toHaveAttribute("open", "");
    await expect(page.locator("#view-settings-period-slot .period-mode-control")).toBeVisible();
    await expect(page.locator("#view-settings-opacity-slot #territory-opacity-control")).toBeVisible();
  }
  const accumulatedBtn = isMobile
    ? page.locator("#mobile-period-control-slot [data-period-mode='accumulated']")
    : page.locator("#view-settings-period-slot [data-period-mode='accumulated']");
  await accumulatedBtn.click();
  await expect(accumulatedBtn).toHaveAttribute("aria-pressed", "true");

  await expect(page.locator("#parroquia-row")).toBeHidden();
  await page.evaluate(async () => {
    await window.__redsaAudit.setTerritoryLevelMode("parish");
    await window.__redsaAudit.showTerritory("parish", "170151");
  });
  if (isMobile) {
    await page.evaluate(() => window.setMobilePanel?.("sidebar", true));
  } else {
    await page.locator("#right-tab-analysis").click();
  }
  await expect(page.locator("#parroquia-row")).toBeVisible();
  await expect(page.locator("#parroquia-row")).toHaveCSS("display", "grid");
  await expect(page.locator("#parish-population-note")).toBeVisible();
});
