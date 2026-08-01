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
  await page.locator('[data-right-panel="layers"]').click();
  await expect(drawer).toHaveAttribute("aria-hidden", "false");
}

function isFullAntGeoJson(url) {
  return new URL(url).pathname.endsWith(".geojson");
}

test("no descarga puntos ANT antes de activar la capa", async ({ page }) => {
  const requests = [];
  page.on("request", request => {
    if (/siniestros_ant_20(24|25|26)(?:_heat\.json|\.geojson)/.test(request.url())) requests.push(request.url());
  });
  await waitForPortal(page);
  expect(requests).toHaveLength(0);
  const state = await page.evaluate(() => window.REDSAAntLayer.getAuditState());
  expect(state.downloaded).toBe(false);
  expect(state.active).toBe(false);
});

test("el perfil focused conserva la vista macro y afina ciudad y calle", async ({ page }, testInfo) => {
  await waitForPortal(page);
  await openTechnicalPanel(page, testInfo.project.name === "mobile");
  await page.locator("#event-layer-disclosure summary").click();
  await page.locator("#ant-layer-toggle").check();
  await page.waitForFunction(() => window.REDSAAntLayer.getAuditState().status === "ready", null, { timeout: 90_000 });

  const profile = await page.evaluate(() => window.REDSAAntLayer.getAuditState().bandwidthProfiles.focused);
  expect(profile).toEqual([
    { maxZoom: 6, meters: 18000 },
    { maxZoom: 9, meters: 5500 },
    { maxZoom: 12, meters: 900 },
    { maxZoom: 13, meters: 450 },
    { maxZoom: 15, meters: 280 },
    { maxZoom: 99, meters: 180 }
  ]);

  const bandwidthByZoom = {};
  for (const zoom of [7, 13, 15, 17]) {
    await page.evaluate(value => window.__redsaAudit.setMapView(-0.2, -78.43, value), zoom);
    await page.waitForFunction(value => window.REDSAAntLayer.getAuditState().renderMetrics.heat?.zoom === value, zoom);
    bandwidthByZoom[zoom] = await page.evaluate(() => window.REDSAAntLayer.getAuditState().renderMetrics.heat.bandwidthMeters);
  }
  expect(bandwidthByZoom).toEqual({ 7: 5500, 13: 450, 15: 280, 17: 180 });
});

test("aviso accesible explica el ajuste al último año disponible", async ({ page }, testInfo) => {
  await waitForPortal(page);
  await openTechnicalPanel(page, testInfo.project.name === "mobile");
  await page.evaluate(() => window.__redsaAudit.selectVariable("fallecidos_inec_2019"));
  await expect(page.locator("#timeline-badge")).toHaveText("2024");
  await expect(page.locator("#timeline-year-adjustment-note")).toBeVisible();
  await expect(page.locator("#timeline-year-adjustment-note")).toContainText("El año cambió a 2024");
  await expect(page.locator("#timeline-year-adjustment-note")).toContainText("2020–2024");
});

test("Calor carga el compacto y los tres modos reutilizan datos sin descargas duplicadas", async ({ page }, testInfo) => {
  const requests = [];
  page.on("request", request => {
    if (/siniestros_ant_2025(?:_heat\.json|\.geojson)/.test(request.url())) requests.push(request.url());
  });
  await waitForPortal(page);
  await openTechnicalPanel(page, testInfo.project.name === "mobile");
  await page.locator("#event-layer-disclosure summary").click();
  await page.locator("#ant-layer-toggle").check();
  await page.waitForFunction(() => window.REDSAAntLayer.getAuditState().status === "ready", null, { timeout: 90_000 });

  let state = await page.evaluate(() => window.REDSAAntLayer.getAuditState());
  expect(state.dataSource).toBe("heat-compact");
  expect(state.heatLoadedYear).toBe(2025);
  expect(state.fullLoadedYear).toBeNull();
  expect(state.pointCount).toBe(20_148);
  expect(state.metrics.transferBytes).toBeGreaterThan(300_000);
  expect(state.metrics.transferBytes).toBeLessThan(500_000);
  expect(state.metrics.parseMs).toBeGreaterThanOrEqual(0);
  expect(state.metrics.indexMs).toBe(0);
  expect(state.renderMetrics.heat.renderMs).toBeGreaterThanOrEqual(0);
  expect(requests.filter(url => url.includes("_heat.json"))).toHaveLength(1);
  expect(requests.filter(isFullAntGeoJson)).toHaveLength(0);
  let paneAudit = await page.evaluate(() => {
    const territory = document.querySelector(".leaflet-territorio-pane");
    const heat = document.querySelector(".leaflet-antHeat-pane");
    const infrastructure = document.querySelector(".leaflet-infraestructura-pane");
    const events = document.querySelector(".leaflet-event-pane");
    return {
      heatParent: document.querySelector(".leaflet-heatmap-layer")?.parentElement?.className || "",
      territoryIndex: territory ? Array.from(territory.parentElement.children).indexOf(territory) : -1,
      heatIndex: heat ? Array.from(heat.parentElement.children).indexOf(heat) : -1,
      infrastructureIndex: infrastructure ? Array.from(infrastructure.parentElement.children).indexOf(infrastructure) : -1,
      eventIndex: events ? Array.from(events.parentElement.children).indexOf(events) : -1
    };
  });
  expect(paneAudit.heatParent).toContain("leaflet-antHeat-pane");
  expect(paneAudit.territoryIndex).toBeLessThan(paneAudit.heatIndex);
  expect(paneAudit.heatIndex).toBeLessThan(paneAudit.infrastructureIndex);
  expect(paneAudit.infrastructureIndex).toBeLessThan(paneAudit.eventIndex);
  await expect(page.locator("#ant-heat-opacity-control")).toBeVisible();
  await page.locator("#ant-heat-opacity-slider").fill("60");
  expect(await page.locator(".leaflet-antHeat-pane").evaluate(element => getComputedStyle(element).opacity)).toBe("0.6");
  expect(await page.locator(".leaflet-territorio-pane").evaluate(element => getComputedStyle(element).opacity)).toBe("1");

  await page.locator("[data-ant-mode='clusters']").click();
  await page.waitForFunction(() => {
    const audit = window.REDSAAntLayer.getAuditState();
    return audit.fullLoadedYear === 2025 && Boolean(audit.renderMetrics.clusters);
  }, null, { timeout: 90_000 });
  await expect(page.locator(".ant-cluster-label").first()).toBeVisible();
  await expect(page.locator("#ant-heat-opacity-control")).toBeHidden();
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
  expect(state.dataSource).toBe("full-geojson");
  expect(state.pointCount).toBe(20_148);
  expect(state.renderMetrics.clusters.visibleObjects).toBeGreaterThan(0);
  expect(state.renderMetrics.cases.visibleCases).toBeGreaterThan(0);
  await page.locator("[data-ant-mode='heat']").click();
  await page.waitForFunction(() => window.REDSAAntLayer.getAuditState().mode === "heat");
  expect(requests.filter(url => url.includes("_heat.json"))).toHaveLength(1);
  expect(requests.filter(isFullAntGeoJson)).toHaveLength(1);

  await page.evaluate(() => window.setMobileLegend?.(true));
  const legend = page.locator("#legend-items");
  await expect(legend).toContainText("Siniestros (ANT)");
  await expect(legend).toContainText("20.148 de 20.346");
  await expect(legend).toContainText("Ubicación no verificable: 8");
  await expect(legend).toContainText("no mide riesgo individual");
});

test("si el GeoJSON completo se cargó primero, Calor no solicita el compacto", async ({ page }, testInfo) => {
  const requests = [];
  page.on("request", request => {
    if (/siniestros_ant_2025(?:_heat\.json|\.geojson)/.test(request.url())) requests.push(request.url());
  });
  await waitForPortal(page);
  await openTechnicalPanel(page, testInfo.project.name === "mobile");
  await page.locator("#event-layer-disclosure summary").click();
  await page.evaluate(() => window.REDSAAntLayer.setMode("clusters"));
  await page.locator("#ant-layer-toggle").check();
  await page.waitForFunction(() => {
    const audit = window.REDSAAntLayer.getAuditState();
    return audit.status === "ready" && audit.fullLoadedYear === 2025;
  }, null, { timeout: 90_000 });
  await page.evaluate(() => window.REDSAAntLayer.setMode("heat"));
  await page.waitForFunction(() => window.REDSAAntLayer.getAuditState().mode === "heat");
  const state = await page.evaluate(() => window.REDSAAntLayer.getAuditState());
  expect(state.dataSource).toBe("full-geojson");
  expect(state.pointCount).toBe(20_148);
  expect(requests.filter(isFullAntGeoJson)).toHaveLength(1);
  expect(requests.filter(url => url.includes("_heat.json"))).toHaveLength(0);
});

test("la capa sigue el año global, cancela cargas obsoletas y conserva un solo año en caché", async ({ page }, testInfo) => {
  await page.route("**/siniestros_ant_2025_heat.json", async route => {
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
  expect(state.heatLoadedYear).toBe(2024);
  expect(state.fullLoadedYear).toBeNull();
  expect(state.cacheYears).toEqual([2024]);
  expect(state.metrics.transferBytes).toBeGreaterThan(300_000);

  await page.evaluate(() => window.__redsaAudit.selectYear(2026));
  await page.waitForFunction(() => {
    const state = window.REDSAAntLayer.getAuditState();
    return state.status === "ready" && state.loadedYear === 2026;
  }, null, { timeout: 90_000 });
  state = await page.evaluate(() => window.REDSAAntLayer.getAuditState());
  expect(state.cacheYears).toEqual([2026]);
  expect(state.cacheYears).toHaveLength(1);
  expect(state.pointCount).toBe(10_747);
  await page.evaluate(() => window.setMobileLegend?.(true));
  await expect(page.locator("#legend-items")).toContainText("parcial enero-junio");
  await expect(page.locator("#legend-items")).toContainText("10.747 de 10.752");
  expect(await page.evaluate(() => window.__redsaAudit.state().selectedVariable)).toBe(before);
});

test("modo histórico desactiva Siniestros ANT sin dejar un año individual visible", async ({ page }, testInfo) => {
  await waitForPortal(page);
  await openTechnicalPanel(page, testInfo.project.name === "mobile");
  await page.locator("#event-layer-disclosure summary").click();
  await page.locator("#ant-layer-toggle").check();
  await page.waitForFunction(() => window.REDSAAntLayer.getAuditState().status === "ready", null, { timeout: 90_000 });

  await page.locator("[data-period-mode='accumulated']").click();
  await expect(page.locator("[data-period-mode='accumulated']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#ant-layer-toggle")).toBeDisabled();
  await expect(page.locator("#ant-layer-toggle")).not.toBeChecked();
  await expect(page.locator("#ant-layer-status")).toContainText("solo por año");
  await expect(page.locator("#ant-layer-status")).toContainText("no está disponible en modo acumulado");

  let state = await page.evaluate(() => window.REDSAAntLayer.getAuditState());
  expect(state.periodMode).toBe("accumulated");
  expect(state.active).toBe(false);
  expect(state.status).toBe("period_unavailable");
  expect(await page.locator(".leaflet-event-pane canvas").count()).toBe(0);
  expect(await page.locator(".leaflet-antHeat-pane canvas").count()).toBe(0);

  await page.locator("[data-period-mode='year']").click();
  await expect(page.locator("#ant-layer-toggle")).toBeEnabled();
  await expect(page.locator("#ant-layer-status")).toContainText("Modo anual");
  state = await page.evaluate(() => window.REDSAAntLayer.getAuditState());
  expect(state.periodMode).toBe("year");
  expect(state.active).toBe(false);
});

test("el análisis territorial ANT usa el punto seleccionado y lenguaje metodológico", async ({ page }, testInfo) => {
  await waitForPortal(page);
  await openTechnicalPanel(page, testInfo.project.name === "mobile");
  await page.locator("#event-layer-disclosure summary").click();
  await page.locator("#ant-layer-toggle").check();
  await page.waitForFunction(() => window.REDSAAntLayer.getAuditState().status === "ready", null, { timeout: 90_000 });
  await page.locator("[data-ant-mode='clusters']").click();
  await page.waitForFunction(() => window.REDSAAntLayer.getAuditState().fullLoadedYear === 2025, null, { timeout: 90_000 });
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
