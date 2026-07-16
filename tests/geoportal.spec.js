import { expect, test } from "@playwright/test";

async function loadPortal(page) {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
  await expect(page.locator("#loader")).toBeHidden({ timeout: 90_000 });
}

test("carga contratos territoriales y atribuciones", async ({ page }) => {
  await loadPortal(page);
  const metrics = await page.evaluate(() => window.__redsaGeojsonLoadMetrics);
  expect(metrics.provinceFeatures).toBe(24);
  expect(metrics.cantonFeatures).toBe(224);
  await expect(page.locator(".leaflet-control-attribution")).toContainText("INEC/CONALI");
  await expect(page.locator(".leaflet-control-attribution")).toContainText("INEC 2014");
});

test("cambia una sola capa territorial por zoom", async ({ page }) => {
  await loadPortal(page);
  const province = await page.evaluate(() => window.__redsaAudit.setZoom(6));
  expect(province.level).toBe("province");
  expect(province.layers.province.visible).toBeTruthy();
  expect(province.layers.canton.visible).toBeFalsy();

  const canton = await page.evaluate(() => window.__redsaAudit.setZoom(9));
  expect(canton.level).toBe("canton");
  expect(canton.layers.canton.visible).toBeTruthy();
  expect(canton.layers.province.visible).toBeFalsy();

  await page.evaluate(() => window.__redsaAudit.setZoom(12));
  await page.waitForFunction(() => window.__redsaAudit.state().layers.parish.ready, null, { timeout: 90_000 });
  const parish = await page.evaluate(() => window.__redsaAudit.state());
  expect(parish.level).toBe("parish");
  expect(parish.layers.parish.visible).toBeTruthy();
  expect(parish.layers.parish.features).toBe(1040);
  expect(parish.layers.canton.visible).toBeFalsy();
});

test("recalcula bins por nivel y cae a limites cuando no aplica", async ({ page }) => {
  await loadPortal(page);
  await page.evaluate(() => window.__redsaAudit.selectVariable("fallecidos_sppat_2016_2021"));
  const province = await page.evaluate(() => window.__redsaAudit.setZoom(6));
  const canton = await page.evaluate(() => window.__redsaAudit.setZoom(9));
  expect(province.bins.length).toBeGreaterThan(1);
  expect(canton.bins.length).toBeGreaterThan(1);
  expect(province.bins).not.toEqual(canton.bins);

  await page.evaluate(() => window.__redsaAudit.setZoom(12));
  await page.waitForFunction(() => {
    const state = window.__redsaAudit.state();
    return state.level === "parish" && state.layers.parish.ready;
  }, null, { timeout: 90_000 });
  const parish = await page.evaluate(() => window.__redsaAudit.state());
  expect(parish.effectiveVariable).toBe("normal");
  await expect(page.locator("#map-level-note")).toContainText("disponible");
});

test("panel demografico permanece visible y dentro del viewport", async ({ page }) => {
  await loadPortal(page);
  await page.evaluate(() => {
    window.__redsaAudit.setZoom(9);
    window.__redsaAudit.showTerritory("canton", "1701");
  });
  const card = page.locator(".perfil-fallecidos-card");
  await expect(card).toBeVisible();
  const before = await card.locator("#hover-card-title").textContent();
  await page.mouse.move(10, 10);
  await page.waitForTimeout(400);
  await expect(card).toBeVisible();
  expect(await card.locator("#hover-card-title").textContent()).toBe(before);

  const boxes = await page.evaluate(() => {
    const cardRect = document.querySelector(".perfil-fallecidos-card").getBoundingClientRect();
    const legendRect = document.querySelector(".legend-panel").getBoundingClientRect();
    const intersects = !(cardRect.right <= legendRect.left || cardRect.left >= legendRect.right || cardRect.bottom <= legendRect.top || cardRect.top >= legendRect.bottom);
    return { card: { top: cardRect.top, bottom: cardRect.bottom, left: cardRect.left, right: cardRect.right }, legend: { top: legendRect.top, bottom: legendRect.bottom, left: legendRect.left, right: legendRect.right }, intersects, innerHeight };
  });
  expect(boxes.card.bottom).toBeLessThanOrEqual(boxes.innerHeight - 10);
  expect(boxes.intersects).toBeFalsy();

  await page.evaluate(() => window.__redsaAudit.showTerritory("canton", "1702"));
  await expect(card.locator("#hover-card-title")).not.toHaveText(before || "");
});
