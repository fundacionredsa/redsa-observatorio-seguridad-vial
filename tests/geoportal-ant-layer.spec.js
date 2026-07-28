import { test, expect } from "@playwright/test";

async function waitForPortal(page) {
  await page.addInitScript(() => {
    localStorage.setItem("redsa_tour_v2_visto", "true");
    localStorage.setItem("redsa_tour_seen", "true");
    localStorage.setItem("has_seen_geoportal_tour", "true");
  });
  await page.goto("index.html");
  await page.waitForFunction(() => Boolean(window.__redsaAudit));
  await page.locator("#loader").waitFor({ state: "hidden", timeout: 90_000 });
}

async function openTechnicalPanel(page, isMobile) {
  const drawer = page.locator("#technical-drawer");
  if (await drawer.getAttribute("aria-hidden") === "false") return;
  const button = isMobile ? page.locator("#mobile-layers-toggle") : page.locator("#technical-panel-toggle");
  await button.click();
  await expect(drawer).toHaveAttribute("aria-hidden", "false");
}

test("no descarga puntos ANT antes de activar la capa", async ({ page }) => {
  const requests = [];
  page.on("request", request => {
    if (/siniestros_ant_20(24|25|26)\.geojson/.test(request.url())) requests.push(request.url());
  });
  await waitForPortal(page);
  expect(requests).toHaveLength(0);
  const state = await page.evaluate(() => window.REDSAAntLayer.getAuditState());
  expect(state.downloaded).toBe(false);
  expect(state.active).toBe(false);
});

test("aviso accesible conserva el año y permite ir al último disponible", async ({ page }, testInfo) => {
  await waitForPortal(page);
  await openTechnicalPanel(page, testInfo.project.name === "mobile");
  await page.locator("#map-variable-select").selectOption("fallecidos_inec_2019");
  await expect(page.locator("#timeline-badge")).toHaveText("2025");
  const action = page.locator("[data-jump-latest-year='2024']");
  await expect(action).toBeVisible();
  await expect(action).toHaveAccessibleName(/Mostrar 2024, último año disponible/);
  await action.focus();
  await expect(action).toBeFocused();
  await action.press("Enter");
  await expect(page.locator("#timeline-badge")).toHaveText("2024");
});

test("capa ANT carga una vez y conmuta manualmente sus tres modos", async ({ page }, testInfo) => {
  await waitForPortal(page);
  await openTechnicalPanel(page, testInfo.project.name === "mobile");
  await page.locator("#event-layer-disclosure summary").click();
  await page.locator("#ant-layer-toggle").check();
  await page.waitForFunction(() => window.REDSAAntLayer.getAuditState().status === "ready", null, { timeout: 90_000 });

  let state = await page.evaluate(() => window.REDSAAntLayer.getAuditState());
  expect(state.metrics.transferBytes).toBeGreaterThan(3_000_000);
  expect(state.metrics.parseMs).toBeGreaterThanOrEqual(0);
  expect(state.metrics.indexMs).toBeGreaterThanOrEqual(0);
  expect(state.renderMetrics.heat.renderMs).toBeGreaterThanOrEqual(0);
  let paneAudit = await page.evaluate(() => {
    const territory = document.querySelector(".leaflet-territorio-pane");
    const events = document.querySelector(".leaflet-event-pane");
    return {
      heatParent: document.querySelector(".leaflet-heatmap-layer")?.parentElement?.className || "",
      territoryIndex: territory ? Array.from(territory.parentElement.children).indexOf(territory) : -1,
      eventIndex: events ? Array.from(events.parentElement.children).indexOf(events) : -1
    };
  });
  expect(paneAudit.heatParent).toContain("leaflet-event-pane");
  expect(paneAudit.eventIndex).toBeGreaterThan(paneAudit.territoryIndex);

  await page.locator("[data-ant-mode='clusters']").click();
  await page.waitForFunction(() => Boolean(window.REDSAAntLayer.getAuditState().renderMetrics.clusters));
  await expect(page.locator(".ant-cluster-label").first()).toBeVisible();
  await expect(page.locator(".ant-cluster-label").first()).toHaveText(/^\d+(?:[,.]\d+)?\s*(?:mil|k)?$/i);
  paneAudit = await page.evaluate(() => ({
    clusterCanvasParent: document.querySelector(".leaflet-event-pane canvas")?.parentElement?.className || ""
  }));
  expect(paneAudit.clusterCanvasParent).toContain("leaflet-event-pane");
  await page.locator("[data-ant-mode='cases']").click();
  await page.waitForFunction(() => Boolean(window.REDSAAntLayer.getAuditState().renderMetrics.cases));
  paneAudit = await page.evaluate(() => ({
    caseCanvasParent: document.querySelector(".leaflet-event-pane canvas")?.parentElement?.className || ""
  }));
  expect(paneAudit.caseCanvasParent).toContain("leaflet-event-pane");
  state = await page.evaluate(() => window.REDSAAntLayer.getAuditState());
  expect(state.mode).toBe("cases");
  expect(state.renderMetrics.clusters.visibleObjects).toBeGreaterThan(0);
  expect(state.renderMetrics.cases.visibleCases).toBeGreaterThan(0);

  await page.evaluate(() => window.setMobileLegend?.(true));
  const legend = page.locator("#legend-items");
  await expect(legend).toContainText("Siniestros (ANT)");
  await expect(legend).toContainText("20.156 de 20.346");
  await expect(legend).toContainText("no mide riesgo individual");
});

test("la capa sigue el año global, cancela cargas obsoletas y conserva un solo año en caché", async ({ page }, testInfo) => {
  await page.route("**/siniestros_ant_2025.geojson", async route => {
    await new Promise(resolve => setTimeout(resolve, 1200));
    await route.continue();
  });
  await waitForPortal(page);
  await openTechnicalPanel(page, testInfo.project.name === "mobile");
  await page.locator("#event-layer-disclosure summary").click();
  await page.locator("#ant-layer-toggle").check();
  const before = await page.evaluate(() => window.__redsaAudit.state().selectedVariable);
  await page.evaluate(() => window.__redsaAudit.selectYear(2024));
  await page.waitForFunction(() => {
    const state = window.REDSAAntLayer.getAuditState();
    return state.status === "ready" && state.loadedYear === 2024;
  }, null, { timeout: 90_000 });
  let state = await page.evaluate(() => window.REDSAAntLayer.getAuditState());
  expect(state.active).toBe(true);
  expect(state.loadedYear).toBe(2024);
  expect(state.cacheYears).toEqual([2024]);
  expect(state.metrics.transferBytes).toBeGreaterThan(4_000_000);

  await page.evaluate(() => window.__redsaAudit.selectYear(2026));
  await page.waitForFunction(() => {
    const state = window.REDSAAntLayer.getAuditState();
    return state.status === "ready" && state.loadedYear === 2026;
  }, null, { timeout: 90_000 });
  state = await page.evaluate(() => window.REDSAAntLayer.getAuditState());
  expect(state.cacheYears).toEqual([2026]);
  expect(state.cacheYears).toHaveLength(1);
  await page.evaluate(() => window.setMobileLegend?.(true));
  await expect(page.locator("#legend-items")).toContainText("parcial enero-junio");
  await expect(page.locator("#legend-items")).toContainText("10.748 de 10.752");
  expect(await page.evaluate(() => window.__redsaAudit.state().selectedVariable)).toBe(before);
});

test("el análisis territorial ANT usa el punto seleccionado y lenguaje metodológico", async ({ page }, testInfo) => {
  await waitForPortal(page);
  await openTechnicalPanel(page, testInfo.project.name === "mobile");
  await page.locator("#event-layer-disclosure summary").click();
  await page.locator("#ant-layer-toggle").check();
  await page.waitForFunction(() => window.REDSAAntLayer.getAuditState().status === "ready", null, { timeout: 90_000 });
  await page.evaluate(async () => {
    window.__redsaAudit.setTerritoryLevelMode("canton");
    await window.__redsaAudit.showTerritory("canton", "1701");
  });
  await expect(page.locator("#ant-territory-analysis-status")).toContainText("3.990 siniestros");
  await expect(page.locator("#ant-territory-analysis-content")).toContainText("Causas probables registradas");
  await expect(page.locator("#ant-territory-analysis-content")).toContainText("no establece responsabilidad");
  await expect(page.locator("#ant-territory-analysis-content")).toContainText("umbral mínimo de 5 casos");
});

test("la leyenda usa cero explícito y nunca muestra el rango confuso menor o igual a cero", async ({ page }) => {
  await waitForPortal(page);
  await page.evaluate(() => {
    window.__redsaAudit.setTerritoryLevelMode("parish");
    window.__redsaAudit.selectYear(2025);
    window.setMobileLegend?.(true);
  });
  const legendItems = page.locator("#legend-items");
  await expect(legendItems).toBeAttached();
  await expect(legendItems).not.toContainText("<= 0");
  await expect(legendItems).toContainText("0");
});

test("controles ANT caben en el drawer móvil y tienen objetivos táctiles", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Validación específica móvil");
  await waitForPortal(page);
  await openTechnicalPanel(page, true);
  await page.locator("#event-layer-disclosure summary").click();
  await page.locator("#ant-layer-toggle").check();
  await page.waitForFunction(() => window.REDSAAntLayer.getAuditState().status === "ready", null, { timeout: 90_000 });
  const drawerBox = await page.locator("#technical-drawer").boundingBox();
  const disclosureBox = await page.locator("#event-layer-disclosure").boundingBox();
  expect(disclosureBox.x).toBeGreaterThanOrEqual(drawerBox.x);
  expect(disclosureBox.x + disclosureBox.width).toBeLessThanOrEqual(drawerBox.x + drawerBox.width + 1);
  for (const selector of [".event-layer-toggle", "[data-ant-mode='heat']", "[data-ant-mode='clusters']", "[data-ant-mode='cases']"]) {
    const box = await page.locator(selector).boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});
