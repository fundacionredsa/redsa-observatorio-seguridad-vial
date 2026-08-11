import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";

const boxesIntersect = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

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

test("carga contratos territoriales y atribuciones", async ({ page }) => {
  await loadPortal(page);
  const metrics = await page.evaluate(() => window.__redsaGeojsonLoadMetrics);
  expect(metrics.provinceFeatures).toBe(26);
  expect(metrics.cantonFeatures).toBe(0);
  expect(metrics.cantonIndexFeatures).toBe(224);
  expect(metrics.cantonDeferred).toBeTruthy();
  await expect(page.locator(".leaflet-control-attribution")).toContainText("INEC/CONALI");
  await expect(page.locator(".leaflet-control-attribution")).toContainText("CONALI");
  await expect(page.locator(".leaflet-control-attribution")).toContainText("2026-02-03");
});

test("abre como observatorio nacional con siniestros y sin infraestructura", async ({ page }) => {
  await loadPortal(page);
  const state = await page.evaluate(() => window.__redsaAudit.state());
  expect(state.level).toBe("province");
  expect(state.selectedVariable).toBe("siniestros_inec_2019");
  expect(state.selectedYear).toBe(2025);
  expect(state.variableCount).toBeGreaterThanOrEqual(10);
  expect(state.infrastructureLayerCount).toBe(10);
  expect(Object.values(state.osmLayers).every(layer => !layer.visible)).toBeTruthy();
  await expect(page.locator("#citizen-panel")).toContainText("Observatorio de Seguridad Vial");
  await expect(page.locator("#citizen-panel")).toContainText(
    "Este es el geoportal del Observatorio Ciudadano de Seguridad Vial y Movilidad Sostenible"
  );
  await expect(page.locator("#citizen-panel")).toContainText(
    "una iniciativa independiente de la sociedad civil impulsada por Fundación REDSA"
  );
  await expect(page.locator("#citizen-panel .citizen-contact")).toHaveAttribute("href", "mailto:info@fundacionredsa.org");
  await expect(page.locator("#citizen-map-variable")).toHaveText("Siniestros de tránsito reportados");
  await expect(page.locator("#citizen-map-meta")).toContainText("Nivel: provincias");
  await expect(page.locator("#citizen-map-meta")).toContainText("Periodo: 2025");
  await expect(page.locator("#citizen-map-meta")).toContainText("Fuente: ANT");
  await expect(page.locator("#open-analysis-button")).toHaveClass(/citizen-action-primary/);
  const actionStyles = await page.evaluate(() => {
    const primary = getComputedStyle(document.getElementById("open-analysis-button"));
    const secondary = getComputedStyle(document.getElementById("btn-tour"));
    return {
      primaryBackground: primary.backgroundColor,
      primaryColor: primary.color,
      secondaryBackground: secondary.backgroundColor,
      secondaryColor: secondary.color
    };
  });
  expect(actionStyles.primaryBackground).not.toBe(actionStyles.secondaryBackground);
  expect(actionStyles.primaryColor).not.toBe(actionStyles.secondaryColor);
  await expect(page.locator(".legend-heading-title")).toHaveText("Siniestros de tránsito reportados");
  await expect(page.locator(".legend-heading-meta")).toContainText("Nivel: provincias");
  await expect(page.locator(".legend-heading-meta")).toContainText("Periodo: 2025");
  await expect(page.locator(".legend-heading-meta")).toContainText("Fuente: ANT");
  const versionedAssets = await page.evaluate(() => [
    ...Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(node => node.href),
    ...Array.from(document.scripts).map(node => node.src).filter(Boolean)
  ].filter(url => url.includes("/assets/css/geoportal-") || url.includes("/assets/js/geoportal-")));
  expect(versionedAssets.length).toBeGreaterThan(5);
  const assetVersions = versionedAssets.map(url => new URL(url).searchParams.get("v"));
  expect(assetVersions.every(Boolean)).toBeTruthy();
  expect(new Set(assetVersions).size).toBe(1);
  expect(assetVersions[0]).toMatch(/^\d+\.\d+\.\d+$/);

  await page.evaluate(() => window.__redsaAudit.selectVariable("normal"));
  await expect(page.locator(".legend-heading-title")).toHaveText("Sin variable seleccionada");
  await expect(page.locator(".legend-heading-meta")).toContainText("Vista: límites administrativos");
  await expect(page.locator(".legend-panel")).not.toContainText("Pichincha");
  await expect(page.locator(".legend-panel")).not.toContainText("Resto del país");
});

test("encuentra un canton y mantiene el resumen ciudadano breve", async ({ page }) => {
  await loadPortal(page);
  const search = page.locator("#territory-search-input");
  await search.fill("Quito — Pichincha");
  await search.press("Enter");
  await expect(page.locator("#citizen-summary")).toContainText("DISTRITO METROPOLITANO DE QUITO", { timeout: 20_000 });
  await expect(page.locator("#citizen-summary")).toContainText("Siniestros de tránsito reportados");
  await expect(page.locator("#citizen-summary")).toContainText("Referencia nacional");
  await expect(page.locator("#citizen-summary")).not.toContainText("mediana de los cantones");
  await expect(page.locator("#citizen-summary")).not.toContainText("Histórico de años completos");
  await expect(page.locator("#territory-sidebar")).toHaveAttribute("aria-hidden", "true");
  const experience = await page.evaluate(() => window.__redsaExperienceAudit.state());
  expect(experience.selectedCanton).toBe("1701");
  await expect(page.locator("#demographic-hover-card")).toBeHidden();
  await expect(page.locator("#share-view-button")).toHaveCount(0);
  await expect(page.locator("#download-summary-button")).toBeEnabled();
});

test("busqueda cantonal encuadra el territorio entre los paneles en pantalla mediana", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "medium", "El caso reproduce el viewport mediano reportado.");
  await loadPortal(page);
  await expect(page.locator("body")).toHaveClass(/citizen-panel-open/);

  const search = page.locator("#territory-search-input");
  await search.fill("Quito — Pichincha");
  await search.press("Enter");
  await expect(page.locator("#citizen-summary")).toContainText("DISTRITO METROPOLITANO DE QUITO", { timeout: 20_000 });
  await expect(page.locator("#demographic-hover-card")).toBeHidden();
  await page.waitForTimeout(700);

  const geometry = await page.evaluate(() => {
    const territory = window.__redsaAudit.selectedTerritoryScreenBounds();
    const map = document.getElementById("map").getBoundingClientRect();
    const sidebar = document.getElementById("territory-sidebar").getBoundingClientRect();
    const host = document.getElementById("right-context-host");
    const rail = document.getElementById("right-tools-rail").getBoundingClientRect();
    const hostRect = host.hidden ? null : host.getBoundingClientRect();
    return {
      territory,
      visible: {
        left: Math.max(map.left, sidebar.right),
        right: Math.min(map.right, hostRect?.left ?? rail.left),
        top: map.top,
        bottom: map.bottom
      }
    };
  });

  expect(geometry.territory.left).toBeGreaterThanOrEqual(geometry.visible.left - 2);
  expect(geometry.territory.right).toBeLessThanOrEqual(geometry.visible.right + 2);
  expect(geometry.territory.top).toBeGreaterThanOrEqual(geometry.visible.top - 2);
  expect(geometry.territory.bottom).toBeLessThanOrEqual(geometry.visible.bottom + 2);

  await page.evaluate(() => window.__redsaAudit.fireTerritoryEvent("canton", "1701", "click"));
  await expect(page.locator("#demographic-hover-card")).toBeVisible();
  await page.waitForTimeout(700);
  const withProfile = await page.evaluate(() => {
    const profile = document.getElementById("demographic-hover-card").getBoundingClientRect();
    const sidebar = document.getElementById("territory-sidebar").getBoundingClientRect();
    const rail = document.getElementById("right-tools-rail").getBoundingClientRect();
    const scale = document.querySelector(".road-scale-control").getBoundingClientRect();
    const box = rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
    return { profile: box(profile), sidebar: box(sidebar), rail: box(rail), scale: box(scale) };
  });
  expect(boxesIntersect(withProfile.profile, withProfile.sidebar)).toBeFalsy();
  expect(boxesIntersect(withProfile.profile, withProfile.rail)).toBeFalsy();
  expect(boxesIntersect(withProfile.profile, withProfile.scale)).toBeFalsy();
});

test("genera una ficha PDF territorial en memoria", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "La generación binaria se prueba una vez.");
  await loadPortal(page);
  await page.evaluate(() => window.__redsaAudit.showTerritory("canton", "1701"));
  await page.evaluate(() => window.__redsaAudit.selectYear(2026));
  await expect(page.locator("#download-summary-button")).toBeEnabled();
  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await page.locator("#download-summary-button").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^redsa_ficha_.+\.pdf$/);
  const savedPath = testInfo.outputPath("ficha-territorial.pdf");
  await download.saveAs(savedPath);
  const bytes = await fs.readFile(savedPath);
  expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(20_000);
  const pdfAudit = await page.evaluate(() => window.__redsaLastPdfAudit);
  expect(pdfAudit).toMatchObject({
    vectorTrend: true,
    structuredProfile: true,
    contactIncluded: true,
    selectedYear: 2026,
    timelineEndYear: 2026,
    sourcesBySection: true,
    historicalComparison: true,
    latestOfficialFallbacks: {
      accidents: 2026,
      deaths: 2024,
      demographicProfile: 2024,
      sppat: 2021
    },
    territorialReferenceCount: 2
  });
  expect(pdfAudit.pageCount).toBeGreaterThanOrEqual(2);
  await expect(page.locator("#territory-search-status")).toContainText("no se almacenó en el portal");
});

test("la ficha PDF parroquial omite el contexto de población y tasas", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "La generación binaria se prueba una vez.");
  await loadPortal(page);
  await page.evaluate(() => window.__redsaAudit.setTerritoryLevelMode("parish"));
  await page.waitForFunction(() => Boolean(window.__redsaAudit.findTerritoryLayer("parish", "010150")));
  await page.evaluate(() => window.__redsaAudit.fireTerritoryEvent("parish", "010150", "click"));
  await expect(page.locator("#download-summary-button")).toBeEnabled();

  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await page.locator("#download-summary-button").click();
  const download = await downloadPromise;
  const savedPath = testInfo.outputPath("ficha-parroquial.pdf");
  await download.saveAs(savedPath);
  const bytes = await fs.readFile(savedPath);
  expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(20_000);
  expect(await page.evaluate(() => window.__redsaLastPdfAudit)).toMatchObject({
    territoryLevel: "Parroquia",
    populationContextIncluded: false
  });
});

test("modo tecnico conserva variables, capas, metodologia y estado todo apagado", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "El drawer movil se valida en la prueba responsive.");
  await loadPortal(page);
  await page.locator('[data-right-panel="layers"]').click();
  await expect(page.locator("#technical-drawer")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("body")).toHaveClass(/technical-drawer-open/);
  await expect(page.locator('[data-right-panel="layers"]')).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#technical-drawer-close")).toBeVisible();
  await expect(page.locator("#citizen-panel")).toBeVisible();
  await expect(page.locator(".legend-panel")).toBeHidden();
  await expect(page.locator("[data-right-context-view]:visible")).toHaveCount(1);
  await expect(page.locator("#variable-disclosure input[name='map-variable']")).toHaveCount(9);
  await expect(page.locator("#variable-disclosure input[value='normal']")).toHaveCount(0);
  await expect(page.locator(".leaflet-control-layers-overlays label")).toHaveCount(10);
  await expect(page.locator("#technical-drawer")).not.toContainText("CartoDB Positron");
  await expect(page.locator(".basemap-control .leaflet-control-layers-base label")).toHaveCount(5);
  await expect(page.locator(".basemap-control .leaflet-control-layers-base label", { hasText: "Esri World Imagery" })).toHaveCount(0);
  await expect(page.locator(".basemap-control .leaflet-control-layers-base label", { hasText: "CyclOSM" })).toHaveCount(1);
  await expect(page.locator(".basemap-control .leaflet-control-layers-base label", { hasText: "OpenTopoMap" })).toHaveCount(1);
  await expect(page.locator("#infrastructure-disclosure")).not.toHaveAttribute("open", "");
  await expect(page.locator("#clear-infrastructure-button")).toHaveCount(0);
  await expect(page.locator("#clean-map-button")).toHaveCount(0);
  await expect(page.locator("#technical-drawer")).not.toContainText("Corredores priorizados por REDSA");
  await expect(page.locator("#technical-drawer")).not.toContainText("Mapillary");
  await expect(page.locator("#technical-drawer")).not.toContainText("Metodología");
  await expect(page.locator("#technical-drawer")).not.toContainText("Descargar datos cantonales");

  await page.evaluate(() => window.__redsaAudit.selectVariable("fallecidos_inec_2019"));
  await expect(page.locator("#technical-drawer")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#right-context-host")).toHaveAttribute("data-active-panel", "layers");
  await expect(page.locator("#citizen-panel")).toBeVisible();
  await expect(page.locator("#legend-active-layers-card")).toContainText("Personas fallecidas");
  await page.locator('[data-right-panel="legend"]').click();
  await expect(page.locator(".legend-panel")).toContainText("Personas fallecidas");
  await page.locator("#site-methodology-toggle").click();
  await expect(page.locator("#site-methodology-menu")).toBeVisible();
  await expect(page.locator("#site-methodology-menu")).toContainText("Metodología");

  await page.evaluate(() => {
    window.__redsaAudit.setOverlay("Ciclovías", true);
    window.__redsaAudit.setOverlay("Aceras", true);
  });
  let state = await page.evaluate(() => window.__redsaAudit.state());
  expect(Object.values(state.osmLayers).filter(layer => layer.visible)).toHaveLength(2);

  await page.evaluate(() => {
    window.__redsaAudit.clearInfrastructure();
    window.__redsaAudit.selectVariable("normal");
  });
  state = await page.evaluate(() => window.__redsaAudit.state());
  expect(state.selectedVariable).toBe("normal");
  expect(Object.values(state.osmLayers).every(layer => !layer.visible)).toBeTruthy();
});

test("selector de variables permite selección única y deselección accesible", async ({ page }, testInfo) => {
  await loadPortal(page);
  await page.locator('[data-right-panel="layers"]').click();
  await expect(page.locator("#technical-drawer")).toHaveAttribute("aria-hidden", "false");

  const disclosure = page.locator("#variable-disclosure");
  const accidents = page.locator("#variable-disclosure input[value='siniestros_inec_2019']");
  const fatalities = page.locator("#variable-disclosure input[value='fallecidos_inec_2019']");
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(accidents).toBeChecked();
  await expect(fatalities).not.toBeChecked();
  await disclosure.locator("summary").click();
  await expect(disclosure).toHaveAttribute("open", "");

  const choroplethStyle = await page.evaluate(() => window.__redsaAudit.territoryStyle("province", "17"));
  await accidents.click();
  await expect(accidents).not.toBeChecked();
  await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().selectedVariable)).toBe("normal");
  await expect(page.locator(".legend-panel")).toContainText("Sin variable seleccionada");
  const boundaryStyle = await page.evaluate(() => window.__redsaAudit.territoryStyle("province", "17"));
  expect(boundaryStyle.fillOpacity).toBeLessThan(choroplethStyle.fillOpacity);

  await fatalities.click();
  await expect(fatalities).toBeChecked();
  await expect(accidents).not.toBeChecked();
  await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().selectedVariable)).toBe("fallecidos_inec_2019");

  await fatalities.focus();
  await fatalities.press("Space");
  await expect(fatalities).not.toBeChecked();
  await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().selectedVariable)).toBe("normal");

  await accidents.focus();
  await accidents.press("Enter");
  await expect(accidents).toBeChecked();
  await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().selectedVariable)).toBe("siniestros_inec_2019");
  await accidents.press("Enter");
  await expect(accidents).not.toBeChecked();
  await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().selectedVariable)).toBe("normal");
});

test("carga vias OSM independientes y conserva la escala grafica", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Las capas viales nacionales se renderizan una vez.");
  let roadRequests = 0;
  page.on("request", request => {
    if (request.url().endsWith("/data/vias_ecuador.geojson")) roadRequests += 1;
  });
  await loadPortal(page);
  await expect(page.locator("#variable-disclosure input[value='densidad_vial_osm']")).toHaveCount(0);
  const scaleNational = await page.locator(".road-scale-control .leaflet-control-scale-line").innerText();
  await page.evaluate(() => window.__redsaAudit.setZoom(11));
  await page.waitForTimeout(200);
  const scaleLocal = await page.locator(".road-scale-control .leaflet-control-scale-line").innerText();
  expect(scaleLocal).not.toBe(scaleNational);

  await page.evaluate(() => window.__redsaAudit.setOverlay("Vías principales", true));
  await page.waitForFunction(() => window.__redsaAudit.state().osmLayers["Vías principales"].loaded, null, { timeout: 90_000 });
  let state = await page.evaluate(() => window.__redsaAudit.state());
  expect(state.osmLayers["Vías principales"].features).toBe(14687);
  expect(state.osmLayers["Vías secundarias"].visible).toBeFalsy();

  await page.evaluate(() => window.__redsaAudit.setOverlay("Vías secundarias", true));
  await page.waitForFunction(() => window.__redsaAudit.state().osmLayers["Vías secundarias"].loaded, null, { timeout: 90_000 });
  state = await page.evaluate(() => window.__redsaAudit.state());
  expect(state.osmLayers["Vías principales"].visible).toBeTruthy();
  expect(state.osmLayers["Vías secundarias"].visible).toBeTruthy();
  expect(state.osmLayers["Vías secundarias"].features).toBe(26353);
  expect(roadRequests).toBe(1);

  const paneOrder = await page.evaluate(() => ({
    territory: Number(getComputedStyle(window.geoportalMap.getPane("territorioPane")).zIndex),
    infrastructure: Number(getComputedStyle(window.geoportalMap.getPane("infraestructuraPane")).zIndex)
  }));
  expect(paneOrder.infrastructure).toBeGreaterThan(paneOrder.territory);
  await page.evaluate(() => {
    window.__redsaAudit.selectVariable("fallecidos_inec_2019");
    window.__redsaAudit.selectVariable("tasa_fallecidos_100k");
    window.__redsaAudit.selectVariable("siniestros_inec_2019");
  });
  state = await page.evaluate(() => window.__redsaAudit.state());
  expect(state.osmLayers["Vías principales"].visible).toBeTruthy();
  expect(state.osmLayers["Vías secundarias"].visible).toBeTruthy();
  expect(await page.evaluate(() => window.__redsaAudit.fireOverlayClick("Vías principales"))).toBeTruthy();
  expect((await page.evaluate(() => window.__redsaAudit.state())).selectedTerritory).not.toBeNull();

  await page.evaluate(() => window.__redsaAudit.setOverlay("Vías principales", false));
  state = await page.evaluate(() => window.__redsaAudit.state());
  expect(state.osmLayers["Vías principales"].visible).toBeFalsy();
  expect(state.osmLayers["Vías secundarias"].visible).toBeTruthy();
});

test("leyenda declara cuando la variable no existe en el nivel territorial", async ({ page }) => {
  await loadPortal(page);
  await page.evaluate(() => {
    window.__redsaAudit.selectVariable("siniestros_inec_2019");
    window.__redsaAudit.selectYear(2023);
    window.__redsaAudit.setTerritoryLevelMode("parish");
  });

  await expect(page.locator(".legend-panel")).toContainText("Sin datos disponibles en este nivel territorial");
  await expect(page.locator(".legend-heading-title")).toHaveText("Siniestros de tránsito reportados");
  await expect(page.locator(".legend-heading-meta")).toContainText("Nivel: parroquias");
  await expect(page.locator(".legend-heading-meta")).toContainText("Periodo: 2023");
  await expect(page.locator(".legend-heading-meta")).toContainText("Fuente: ANT");
  await expect(page.locator(".legend-panel")).toContainText("Límites administrativos");
});

test("el encabezado del analisis permanece accesible y el contenido llega hasta el final", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Comportamiento del panel de escritorio.");
  await loadPortal(page);
  const sidebar = page.locator("#territory-sidebar");

  await page.locator("#open-analysis-button").click();
  await expect(sidebar).toHaveAttribute("aria-hidden", "false");

  await sidebar.evaluate(element => { element.scrollTop = element.scrollHeight; });
  const layout = await page.evaluate(() => {
    const sidebar = document.querySelector("#territory-sidebar");
    const sidebarRect = sidebar.getBoundingClientRect();
    const topbar = document.querySelector("#territory-sidebar .mobile-sidebar-topbar");
    const topbarRect = topbar.getBoundingClientRect();
    return {
      position: getComputedStyle(topbar).position,
      sidebarTop: sidebarRect.top,
      topbarTop: topbarRect.top,
      visible: topbarRect.bottom > sidebarRect.top && topbarRect.top < sidebarRect.bottom,
      reachedBottom: Math.abs(sidebar.scrollHeight - sidebar.clientHeight - sidebar.scrollTop) <= 2
    };
  });

  expect(layout.position).toBe("sticky");
  expect(layout.visible).toBeTruthy();
  expect(layout.reachedBottom).toBeTruthy();
  expect(Math.abs(layout.topbarTop - layout.sidebarTop)).toBeLessThanOrEqual(2);
});

test("paneles alternan entre anio y acumulados con cobertura explicita", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "La lectura detallada se valida una vez en desktop.");
  await loadPortal(page);
  await page.evaluate(async () => {
    await window.__redsaAudit.setTerritoryLevelMode("canton");
    await window.__redsaAudit.showTerritory("canton", "1701");
  });
  await expect(page.locator("#demographic-hover-card")).toBeVisible();
  await page.evaluate(() => document.querySelector("#territory-sidebar [data-detail-period-mode='accumulated']")?.click());

  await expect(page.locator("#edg-sidebar-year")).toHaveText("2020–2024");
  await expect(page.locator("#sppat-sidebar-year")).toHaveText("2016–2021");
  await expect(page.locator("#siniestros-section-year")).toContainText("2017–2025");
  await expect(page.locator("#info-tasa-fallecidos")).toHaveText("No aplica al acumulado");
  await expect(page.locator("#demographic-hover-card")).toContainText("Ver análisis completo");
  await expect(page.locator("#demographic-hover-card")).not.toContainText("2020–2024");

  const controls = await page.locator("[data-detail-period-mode='accumulated']").evaluateAll(buttons =>
    buttons.map(button => button.getAttribute("aria-pressed"))
  );
  expect(controls.every(value => value === "true")).toBeTruthy();
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
  expect(parish.layers.parish.features).toBe(1050);
  expect(parish.layers.canton.visible).toBeFalsy();
});

test("clic en canton fija la seleccion sin saltar a parroquias", async ({ page }) => {
  await loadPortal(page);
  await page.evaluate(() => window.__redsaAudit.setZoom(9));
  const afterClick = await page.evaluate(() => window.__redsaAudit.fireTerritoryEvent("canton", "1701", "click"));
  expect(afterClick).toBeTruthy();
  await page.waitForTimeout(450);

  const state = await page.evaluate(() => window.__redsaAudit.state());
  expect(state.territoryLevelMode).toBe("auto");
  expect(state.level).toBe("canton");
  expect(state.zoom).toBeLessThanOrEqual(10);
  expect(state.selectedTerritory).toEqual({ level: "canton", code: "1701" });
  await expect(page.locator("#hover-card-title")).toContainText("QUITO");
  await expect(page.locator(".leaflet-popup")).toHaveCount(0);

  await page.evaluate(() => window.__redsaAudit.fireTerritoryEvent("canton", "1701", "click"));
  await expect(page.locator(".leaflet-popup")).toBeVisible();
});

test("hover no cambia panel y la seleccion persiste al hacer scroll", async ({ page }) => {
  await loadPortal(page);
  await page.evaluate(async () => {
    window.__redsaAudit.selectYear(2024);
    await window.__redsaAudit.setZoom(9);
    await window.__redsaAudit.fireTerritoryEvent("canton", "1701", "click");
  });
  const card = page.locator("#demographic-hover-card");
  await expect(card).toBeVisible();
  const selectedTitle = await page.locator("#hover-card-title").textContent();

  await page.evaluate(() => {
    window.__redsaAudit.fireTerritoryEvent("canton", "1702", "mouseover");
    window.__redsaAudit.fireTerritoryEvent("canton", "1702", "mouseout");
  });
  await expect(page.locator("#hover-card-title")).toHaveText(selectedTitle || "");

  const legendScroll = page.locator(".legend-context-scroll");
  const scrollState = await legendScroll.evaluate(element => {
    element.scrollTop = Math.max(1, element.scrollHeight - element.clientHeight);
    return { top: element.scrollTop, height: element.clientHeight, scrollHeight: element.scrollHeight };
  });
  expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.height);
  expect(scrollState.top).toBeGreaterThan(0);

  await page.evaluate(() => window.__redsaAudit.fireTerritoryEvent("canton", "1703", "mouseover"));
  await expect(page.locator("#hover-card-title")).toHaveText(selectedTitle || "");
  expect((await page.evaluate(() => window.__redsaAudit.state())).selectedTerritory.code).toBe("1701");

  await page.locator("#profile-card-close").click();
  await expect(card).toBeHidden();
  expect((await page.evaluate(() => window.__redsaAudit.state())).selectedTerritory).toBeNull();
});

test("solo conserva resaltada la unidad territorial seleccionada", async ({ page }) => {
  await loadPortal(page);
  await page.evaluate(async () => {
    await window.__redsaAudit.setZoom(9);
    await window.__redsaAudit.showTerritory("canton", "1701");
  });
  const firstSelectedStyle = await page.evaluate(() => window.__redsaAudit.territoryStyle("canton", "1701"));

  await page.evaluate(() => window.__redsaAudit.showTerritory("canton", "1702"));
  const result = await page.evaluate(async () => ({
    state: window.__redsaAudit.state(),
    first: await window.__redsaAudit.territoryStyle("canton", "1701"),
    second: await window.__redsaAudit.territoryStyle("canton", "1702")
  }));

  expect(result.state.selectedTerritory).toEqual({ level: "canton", code: "1702" });
  expect(result.state.selectedLayerReferenceCount).toBe(1);
  expect(result.second.color).toBe(firstSelectedStyle.color);
  expect(result.second.weight).toBe(firstSelectedStyle.weight);
  expect(result.first.color).not.toBe(result.second.color);
});

test("control territorial permite fijar nivel y volver a modo automatico", async ({ page }) => {
  await loadPortal(page);
  const fixed = await page.evaluate(() => window.__redsaAudit.setTerritoryLevelMode("canton"));
  expect(fixed.territoryLevelMode).toBe("canton");
  expect(fixed.level).toBe("canton");
  await expect(page.locator('[data-level-mode="canton"]').first()).toHaveAttribute("aria-pressed", "true");

  const afterZoom = await page.evaluate(() => window.__redsaAudit.setZoom(12));
  expect(afterZoom.level).toBe("canton");
  expect(afterZoom.territoryLevelMode).toBe("canton");

  await page.evaluate(() => window.__redsaAudit.setTerritoryLevelMode("auto"));
  await page.waitForFunction(() => {
    const state = window.__redsaAudit.state();
    return state.level === "parish" && state.layers.parish.ready;
  }, null, { timeout: 90_000 });
  const automatic = await page.evaluate(() => window.__redsaAudit.state());
  expect(automatic.level).toBe("parish");
  expect(automatic.territoryLevelMode).toBe("auto");
  await expect(page.locator('[data-level-mode="auto"]').first()).toHaveAttribute("aria-pressed", "true");
});

test("recalcula bins por nivel y cae a limites cuando no aplica", async ({ page }) => {
  await loadPortal(page);
  await page.evaluate(() => window.__redsaAudit.selectVariable("fallecidos_sppat_2016_2021"));
  await page.evaluate(() => window.__redsaAudit.selectYear(2021));
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

test("slider global cambia dos variables anuales sin consolidar", async ({ page }) => {
  await loadPortal(page);
  await page.evaluate(async () => {
    await window.__redsaAudit.setZoom(9);
    window.__redsaAudit.selectVariable("siniestros_inec_2019");
    window.__redsaAudit.selectYear(2021);
    await window.__redsaAudit.showTerritory("canton", "1701");
  });
  await expect(page.locator("#info-siniestros-inec")).toHaveText("3.411");
  const siniestros2021 = await page.evaluate(() => window.__redsaAudit.state().bins);
  await page.evaluate(() => window.__redsaAudit.selectYear(2024));
  await expect(page.locator("#info-siniestros-inec")).toHaveText("3.889");
  const siniestros2024 = await page.evaluate(() => window.__redsaAudit.state().bins);
  expect(siniestros2021).not.toEqual(siniestros2024);

  await page.evaluate(() => {
    window.__redsaAudit.selectVariable("fallecidos_inec_2019");
    window.__redsaAudit.selectYear(2021);
  });
  await expect(page.locator("#info-fallecidos-inec")).toHaveText("430");
  await page.evaluate(() => window.__redsaAudit.selectYear(2024));
  await expect(page.locator("#info-fallecidos-inec")).toHaveText("504");
});

test("variables de foto unica deshabilitan slider y muestran badge", async ({ page }) => {
  await loadPortal(page);
  await page.evaluate(() => window.__redsaAudit.selectVariable("porcentaje_motos_flota_2024"));
  const state = await page.evaluate(() => window.__redsaAudit.state());
  expect(state.timelineDisabled).toBeTruthy();
  expect(state.timelineBadge).toContain("Dato fijo");
  expect(state.timelineBadge).toContain("2024");
  await expect(page.locator("#map-year-slider")).toBeDisabled();
  await expect(page.locator("#map-year-slider")).toHaveAttribute("min", "2016");
  await expect(page.locator("#map-year-slider")).toHaveAttribute("max", "2026");

  await page.evaluate(() => window.__redsaAudit.selectVariable("siniestros_inec_2019"));
  await expect(page.locator("#timeline-marks .timeline-mark")).toHaveCount(11);
  await expect(page.locator("#timeline-marks .timeline-mark.tm-unavailable")).toHaveCount(1);
});

test("cambio de variable ajusta el año a su cobertura sin dejar el mapa vacío", async ({ page }) => {
  await loadPortal(page);

  await page.locator('[data-right-panel="layers"]').click();
  const initial = await page.evaluate(() => window.__redsaAudit.state());
  expect(initial.selectedVariable).toBe("siniestros_inec_2019");
  expect(initial.selectedYear).toBe(2025);

  await page.evaluate(() => window.__redsaAudit.selectVariable("fallecidos_inec_2019"));
  let state = await page.evaluate(() => window.__redsaAudit.state());
  expect(state.selectedYear).toBe(2024);
  expect(state.validValueCount).toBeGreaterThan(0);
  expect(state.timelineYearAdjustment).toContain("cambió a 2024");
  expect(state.timelineYearAdjustment).toContain("2020–2024");
  await expect(page.locator("#legend-year-adjustment-note")).not.toHaveAttribute("hidden", "");
  expect(await page.evaluate(() => window.REDSAAntLayer.getAuditState().year)).toBe(2024);

  await page.evaluate(() => window.__redsaAudit.selectVariable("fallecidos_sppat_2016_2021"));
  state = await page.evaluate(() => window.__redsaAudit.state());
  expect(state.selectedYear).toBe(2021);
  expect(state.validValueCount).toBeGreaterThan(0);
  expect(state.timelineYearAdjustment).toContain("cambió a 2021");
  expect(state.timelineYearAdjustment).toContain("2016–2021");
  expect(await page.evaluate(() => window.REDSAAntLayer.getAuditState().year)).toBe(2021);

  await page.evaluate(() => window.__redsaAudit.selectVariable("tasa_siniestros_1000_vehiculos_2024"));
  state = await page.evaluate(() => window.__redsaAudit.state());
  expect(state.selectedYear).toBe(2024);
  expect(state.validValueCount).toBeGreaterThan(0);
  expect(state.timelineBadge).toContain("Dato fijo");
  expect(state.timelineYearAdjustment).toContain("solo tiene datos de 2024");

  await page.evaluate(() => window.__redsaAudit.selectVariable("siniestros_inec_2019"));
  state = await page.evaluate(() => window.__redsaAudit.state());
  expect(state.selectedYear).toBe(2024);
  expect(state.validValueCount).toBeGreaterThan(0);
  expect(state.timelineYearAdjustment).toBe("");
  await expect(page.locator("#legend-year-adjustment-note")).toBeHidden();
});

test("cambio de nivel resuelve el año de la variable efectiva", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "La resolución temporal por nivel se valida una vez.");
  await loadPortal(page);
  await page.evaluate(() => window.__redsaAudit.selectVariable("fallecidos_inec_2019"));
  await page.evaluate(() => window.__redsaAudit.setTerritoryLevelMode("parish"));
  await page.waitForFunction(() => window.__redsaAudit.state().level === "parish", null, { timeout: 90_000 });

  expect(await page.evaluate(() => window.__redsaAudit.selectYear(2025))).toBeTruthy();
  expect((await page.evaluate(() => window.__redsaAudit.state())).effectiveVariable).toBe("normal");

  await page.evaluate(() => window.__redsaAudit.setTerritoryLevelMode("canton"));
  await page.waitForFunction(() => window.__redsaAudit.state().level === "canton", null, { timeout: 90_000 });
  const state = await page.evaluate(() => window.__redsaAudit.state());
  expect(state.effectiveVariable).toBe("fallecidos_inec_2019");
  expect(state.selectedYear).toBe(2024);
  expect(state.validValueCount).toBeGreaterThan(0);
  expect(state.timelineYearAdjustment).toContain("cambió a 2024");
});

test("explica variables y perfiles en lenguaje ciudadano", async ({ page }) => {
  await loadPortal(page);
  const description = page.locator("#map-variable-description");
  await expect(description).toContainText("Número de siniestros de tránsito registrados oficialmente.");

  const descriptions = {
    siniestros_inec_2019: "Número de siniestros de tránsito registrados oficialmente. ANT e INEC/ESTRA forman una sola cadena estadística y sus cifras no deben sumarse entre sí. Entre 2021 y 2024, 72 registros corresponden a zonas en estudio y permanecen en el total nacional sin asignarse a un cantón.",
    tasa_fallecidos_100k: "Fallecidos por cada 100.000 habitantes: permite comparar zonas con poblaciones de distinto tamaño.",
    cobertura_mapeo_osm: "Qué tanto se ha registrado la infraestructura de seguridad vial (semáforos, cruces y aceras) en el mapa colaborativo OpenStreetMap. No mide si la infraestructura existe o no; solo si alguien ya la mapeó."
  };
  for (const [variable, text] of Object.entries(descriptions)) {
    await page.evaluate(selected => window.__redsaAudit.selectVariable(selected), variable);
    await expect(description).toHaveText(text);
  }

  await page.evaluate(async () => {
    await window.__redsaAudit.setZoom(9);
    window.__redsaAudit.selectVariable("fallecidos_inec_2019");
    window.__redsaAudit.selectYear(2024);
    await window.__redsaAudit.showTerritory("canton", "1701");
  });
  const shortcut = page.locator("#demographic-hover-card");
  await expect(shortcut).toContainText("QUITO");
  await expect(shortcut).toContainText("Código DPA 1701");
  await expect(shortcut).toContainText("Ver análisis completo");
  await expect(shortcut.locator(".profile-card-citizen-title, .profile-card-source-detail, .perfil-card-section")).toHaveCount(0);

  await shortcut.locator("#legend-open-analysis-button").click();
  await expect(page.locator("#territory-sidebar")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#info-fallecidos-inec")).toHaveText("504");
  await expect(page.locator("#info-fallecidos-sppat")).not.toBeEmpty();

  const edgInfo = page.locator('#territory-sidebar [data-sigla="EDG"]');
  await edgInfo.click();
  await expect(page.locator("#sigla-popover")).toContainText("Registro Estadístico de Defunciones Generales");
  const sppatInfo = page.locator('#territory-sidebar [data-sigla="SPPAT"]');
  await sppatInfo.click();
  await expect(page.locator("#sigla-popover")).toContainText("Servicio Público para Pago de Accidentes de Tránsito");
});

test("perfil distingue ausencia de desglose de un conteo de cero fallecidos", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "La rama de disponibilidad se valida una vez.");
  await loadPortal(page);
  await page.evaluate(async () => {
    await window.__redsaAudit.setZoom(9);
    window.__redsaAudit.selectVariable("fallecidos_inec_2019");
    window.__redsaAudit.selectYear(2025);
    await window.__redsaAudit.showTerritory("canton", "1701");
  });

  const shortcut = page.locator("#demographic-hover-card");
  await expect(shortcut).toContainText("Ver análisis completo");
  await expect(shortcut).not.toContainText("No hay datos de edad");
  await expect(shortcut).not.toContainText("No hay detalle por sexo");
});

test("ranking nacional ordena, excluye sin dato y busca la posicion cantonal", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "La logica completa del ranking se valida una vez en desktop.");
  await loadPortal(page);
  await page.locator("#open-institutional-button").click();
  await expect(page.locator("#institutional-modal")).toBeVisible();

  const assertDescendingRanking = async expectedVariable => {
    await expect(page.locator("#ranking-table-body tr").first()).toBeVisible({ timeout: 15_000 });
    const ranking = await page.evaluate(() => window.__redsaInstitutionalAudit.state());
    expect(ranking.variable).toBe(expectedVariable);
    expect(ranking.totalCount).toBe(224);
    expect(ranking.validCount + ranking.excludedCount).toBe(224);
    expect(ranking.validCount).toBeGreaterThan(0);
    expect(ranking.excludedCount).toBeGreaterThanOrEqual(0);
    expect(ranking.rows.every(row => Number.isFinite(row.value))).toBeTruthy();
    expect(ranking.rows.every((row, index) => index === 0 || ranking.rows[index - 1].value >= row.value)).toBeTruthy();
    await expect(page.locator("#ranking-table-body tr")).toHaveCount(ranking.validCount);
    await expect(page.locator("#ranking-table-body")).not.toContainText("Sin dato");
    await expect(page.locator("#ranking-variable-description")).toHaveText(await page.locator("#map-variable-description").textContent());
    return ranking;
  };

  const accidents = await assertDescendingRanking("siniestros_inec_2019");
  expect(accidents.year).toBe(2025);
  await expect(page.locator("#ranking-coverage")).toContainText(`${accidents.excludedCount} cantones sin dato`);

  await page.locator("#ranking-search-input").fill("Distrito Metropolitano de Quito");
  await expect(page.locator("#ranking-table-body tr")).toHaveCount(1);
  await expect(page.locator("#ranking-table-body tr")).toHaveClass(/is-highlighted/);
  await expect(page.locator("#ranking-table-body")).toContainText("DISTRITO METROPOLITANO DE QUITO");
  await expect(page.locator("#ranking-search-status")).toContainText("posición nacional");

  await page.locator("#ranking-search-input").fill("");
  await page.locator('[data-ranking-sort="canton"]').click();
  const alphabetical = await page.evaluate(() => window.__redsaInstitutionalAudit.state().displayedRows.map(row => row.canton));
  expect(alphabetical).toEqual([...alphabetical].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })));

  await page.locator('[data-ranking-sort="value"]').click();
  await page.evaluate(() => {
    window.__redsaAudit.selectVariable("tasa_fallecidos_100k");
    window.__redsaAudit.selectYear(2021);
  });
  await expect(page.locator("#ranking-period")).toHaveText("Año 2021");
  const fatalityRate = await assertDescendingRanking("tasa_fallecidos_100k");
  expect(fatalityRate.year).toBe(2021);
});

test("modal institucional es usable en movil y publica confianza y cita dinamica", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Geometria y lectura movil del modal institucional.");
  await page.setViewportSize({ width: 390, height: 844 });
  await loadPortal(page);
  await page.locator("#site-topbar-menu-toggle").tap();
  await expect(page.locator("#site-topbar-actions")).toBeVisible();
  await page.locator("#open-institutional-button").tap();

  const geometry = await page.locator("#institutional-modal .institutional-dialog").boundingBox();
  expect(geometry).not.toBeNull();
  expect(geometry.x).toBeGreaterThanOrEqual(0);
  expect(geometry.y).toBeGreaterThanOrEqual(0);
  expect(geometry.x + geometry.width).toBeLessThanOrEqual(390);
  expect(geometry.y + geometry.height).toBeLessThanOrEqual(844);
  await expect(page.locator("#ranking-table-body tr")).not.toHaveCount(0);

  for (const selector of ["#institutional-modal-close", "#institutional-tab-ranking", "#institutional-tab-trust", "#institutional-tab-citation", "#ranking-search-input"]) {
    const box = await page.locator(selector).boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  await page.locator("#institutional-tab-trust").tap();
  await expect(page.locator("#institutional-panel-trust")).toContainText("Independencia institucional");
  await expect(page.locator("#institutional-panel-trust")).toContainText("224 cantones");
  await expect(page.locator("#institutional-panel-trust .institutional-open-note a")).toHaveAttribute("href", "https://github.com/fundacionredsa/redsa-observatorio-seguridad-vial");

  await page.locator("#institutional-tab-citation").tap();
  await expect(page.locator("#institutional-panel-citation")).toContainText("Fundación REDSA (2026)");
  await expect(page.locator("#citation-current-date")).toHaveText(/^\d{1,2} de \p{L}+ de 20\d{2}$/u);
  await page.keyboard.press("Escape");
  await expect(page.locator("#institutional-modal")).toBeHidden();
});

test("ficha territorial permanece visible dentro del panel Leyenda", async ({ page }) => {
  await loadPortal(page);
  await page.evaluate(async () => {
    await window.__redsaAudit.setZoom(9);
    await window.__redsaAudit.showTerritory("canton", "1701");
  });
  const card = page.locator(".perfil-fallecidos-card");
  await expect(card).toBeVisible();
  const before = await card.locator("#hover-card-title").textContent();
  const stableTarget = (page.viewportSize()?.width || 0) > 768
    ? page.locator("#citizen-panel-visibility-toggle")
    : page.locator("#mobile-sidebar-toggle");
  await stableTarget.hover();
  await page.waitForTimeout(400);
  await expect(card).toBeVisible();
  expect(await card.locator("#hover-card-title").textContent()).toBe(before);

  const boxes = await page.evaluate(() => {
    const cardRect = document.querySelector(".perfil-fallecidos-card").getBoundingClientRect();
    const hostRect = document.querySelector("#right-context-host").getBoundingClientRect();
    return { card: { top: cardRect.top, bottom: cardRect.bottom, left: cardRect.left, right: cardRect.right }, host: { top: hostRect.top, bottom: hostRect.bottom, left: hostRect.left, right: hostRect.right }, parent: document.querySelector(".perfil-fallecidos-card").parentElement?.className, innerHeight };
  });
  expect(boxes.parent).toContain("legend-context-scroll");
  expect(boxes.card.left).toBeGreaterThanOrEqual(boxes.host.left);
  expect(boxes.card.right).toBeLessThanOrEqual(boxes.host.right);
  expect(boxes.host.bottom).toBeLessThanOrEqual(boxes.innerHeight);

  await page.evaluate(() => window.__redsaAudit.showTerritory("canton", "1702"));
  await expect(card.locator("#hover-card-title")).not.toHaveText(before || "");
});

test("ficha territorial comparte solo el panel Leyenda y no crea otra región flotante", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Geometría del panel unificado desktop.");
  await loadPortal(page);
  await page.evaluate(async () => {
    await window.__redsaAudit.setZoom(9);
    await window.__redsaAudit.showTerritory("canton", "1701");
  });

  await expect(page.locator("#right-context-host")).toHaveAttribute("data-active-panel", "legend");
  await expect(page.locator("[data-right-context-view]:visible")).toHaveCount(1);
  expect(await page.locator("#demographic-hover-card").evaluate(element => element.closest("[data-right-context-view]")?.id)).toBe("legend-context-panel");

  await page.locator("#open-analysis-button").click();
  await expect(page.locator("#territory-sidebar")).toHaveAttribute("aria-hidden", "false");
  const separated = await page.evaluate(() => {
    const sidebar = document.querySelector("#territory-sidebar").getBoundingClientRect();
    const host = document.querySelector("#right-context-host").getBoundingClientRect();
    return sidebar.right <= host.left;
  });
  expect(separated).toBeTruthy();
  await page.locator("#mobile-sidebar-close").click();

  await page.locator('[data-right-panel="layers"]').click();
  await expect(page.locator("#technical-drawer")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#demographic-hover-card")).toBeHidden();
  await expect(page.locator("[data-right-context-view]:visible")).toHaveCount(1);
});

test("capa OSM nacional carga bajo demanda y explicita cantones sin mapeo", async ({ page }) => {
  await loadPortal(page);
  expect(await page.evaluate(() => window.__redsaAudit.setOverlay("Ciclovías", true))).toBeTruthy();
  await page.waitForFunction(() => {
    const state = window.__redsaAudit.state().osmLayers["Ciclovías"];
    return state?.loaded || state?.error;
  }, null, { timeout: 120_000 });
  const state = await page.evaluate(() => window.__redsaAudit.state().osmLayers["Ciclovías"]);
  expect(state.error).toBeNull();
  expect(state.features).toBeGreaterThan(0);
  expect(state.rejectedGeometries).toBe(34);
  expect(state.unmappedCantons).not.toBeNull();
  await expect(page.locator(".legend-panel")).toContainText("tramado");
  await expect(page.locator(".legend-panel")).toContainText("no que la infraestructura no exista");
});

test("mobile conserva una superficie de mapa util en telefono y tablet", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Validacion especifica del breakpoint movil.");

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 360, height: 740 },
    { width: 768, height: 1024 }
  ]) {
    await page.setViewportSize(viewport);
    await loadPortal(page);
    await expect(page.locator('[data-right-panel="legend"]')).toBeVisible();
    await expect(page.locator(".legend-panel")).toBeVisible();
    const geometry = await page.evaluate(() => {
      const box = selector => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      return { map: box("#map"), host: box("#right-context-host"), rail: box("#right-tools-rail") };
    });
    expect(geometry.map.width).toBe(viewport.width);
    expect(geometry.map.height).toBe(viewport.height);
    for (const element of [geometry.host, geometry.rail]) {
      expect(element.left).toBeGreaterThanOrEqual(0);
      expect(element.right).toBeLessThanOrEqual(viewport.width);
      expect(element.top).toBeGreaterThanOrEqual(0);
      expect(element.bottom).toBeLessThanOrEqual(viewport.height);
    }
    expect(boxesIntersect(geometry.host, geometry.rail)).toBeFalsy();
    await expect(page.locator("#right-context-host")).toBeVisible();
    await expect(page.locator("#right-context-host")).toHaveAttribute("data-active-panel", "legend");
  }
});

test("mobile completa el flujo tactil sin paneles fuera del viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Flujo tactil real del proyecto movil.");
  const width = 390;
  const height = 844;
  await page.setViewportSize({ width, height });
  await loadPortal(page);

  await page.locator("#mobile-sidebar-toggle").tap();
  await expect(page.locator("body")).toHaveClass(/mobile-sidebar-open/);
  await expect.poll(() => page.locator("#territory-sidebar").evaluate(element => element.getBoundingClientRect().left)).toBeGreaterThanOrEqual(0);
  await expect.poll(() => page.locator("#territory-sidebar").evaluate(element => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(height);
  const sidebar = await page.evaluate(() => {
    const element = document.querySelector("#territory-sidebar");
    const rect = element.getBoundingClientRect();
    const close = document.querySelector("#mobile-sidebar-close").getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      close: { width: close.width, height: close.height }
    };
  });
  expect(sidebar.left).toBeGreaterThanOrEqual(0);
  expect(sidebar.right).toBeLessThanOrEqual(width);
  expect(sidebar.bottom).toBeLessThanOrEqual(height);
  expect(sidebar.scrollWidth).toBeLessThanOrEqual(sidebar.clientWidth + 1);
  expect(sidebar.close.width).toBeGreaterThanOrEqual(44);
  expect(sidebar.close.height).toBeGreaterThanOrEqual(44);

  await page.locator("#territory-sidebar").evaluate(element => { element.scrollTop = 420; });
  await page.waitForTimeout(100);
  const sticky = await page.evaluate(() => {
    const topbar = document.querySelector(".mobile-sidebar-topbar").getBoundingClientRect();
    const period = document.querySelector(".sidebar .detail-period-control").getBoundingClientRect();
    return {
      topbar: { top: topbar.top, bottom: topbar.bottom },
      period: { top: period.top, bottom: period.bottom },
      viewportHeight: innerHeight
    };
  });
  expect(sticky.topbar.top, JSON.stringify(sticky)).toBeGreaterThanOrEqual(-1);
  const periodDoesNotOverlapHeader = sticky.period.bottom <= sticky.topbar.top + 1
    || sticky.period.top >= sticky.topbar.bottom - 1;
  expect(periodDoesNotOverlapHeader, JSON.stringify(sticky)).toBeTruthy();

  await page.locator("#mobile-sidebar-close").tap();
  await expect(page.locator("body")).not.toHaveClass(/mobile-sidebar-open/);

  await page.locator('[data-right-panel="layers"]').tap();
  await expect(page.locator("body")).toHaveClass(/mobile-layers-open/);
  await expect.poll(() => page.locator("#technical-drawer").evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(width);
  const technical = await page.evaluate(() => {
    const box = selector => {
      const element = document.querySelector(selector);
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    return { drawer: box("#technical-drawer") };
  });
  expect(technical.drawer.left).toBeGreaterThanOrEqual(0);
  expect(technical.drawer.right).toBeLessThanOrEqual(width);
  expect(technical.drawer.bottom).toBeLessThanOrEqual(height);
  await expect(page.locator(".map-selector-control")).toHaveCount(0);
  await expect(page.locator("#technical-drawer #map-year-slider")).toHaveCount(0);
  await expect(page.locator("#technical-drawer #territory-level-control")).toHaveCount(0);

  await page.locator('[data-right-panel="legend"]').tap();
  await expect(page.locator("#legend-context-panel")).toBeVisible();
  const legendControls = await page.evaluate(() => {
    const box = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    return { slider: box("#map-year-slider"), level: box("#territory-level-control") };
  });
  expect(legendControls.slider.height).toBeGreaterThanOrEqual(44);
  expect(legendControls.slider.bottom).toBeLessThanOrEqual(height);
  expect(legendControls.level.bottom).toBeLessThanOrEqual(height);

  const tooSmall = await page.evaluate(() => {
    const selectors = [
      ".mobile-nav-toggle",
      ".right-tool-button:not(:disabled)",
      ".mobile-sidebar-close",
      "#technical-drawer-close",
      ".leaflet-control-layers-list label",
      ".variable-option",
      "#map-year-slider",
      ".territory-level-segments button",
      "#mobile-legend-toggle"
    ];
    return selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)).map(element => {
      const rect = element.getBoundingClientRect();
      const styles = getComputedStyle(element);
      const visible = styles.display !== "none" && styles.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      return visible && (rect.width < 44 || rect.height < 44)
        ? { selector, width: rect.width, height: rect.height }
        : null;
    }).filter(Boolean));
  });
  expect(tooSmall).toEqual([]);

  const sliderBox = await page.locator("#map-year-slider").boundingBox();
  expect(sliderBox).not.toBeNull();
  await page.touchscreen.tap(sliderBox.x + sliderBox.width * 0.6, sliderBox.y + sliderBox.height / 2);
  await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().selectedYear)).toBe(2022);

  await expect(page.locator("#right-context-host")).toHaveAttribute("data-active-panel", "legend");
  await page.locator("#mobile-legend-toggle").tap();
  await expect(page.locator("body")).not.toHaveClass(/mobile-layers-open/);
  await expect(page.locator("#right-context-host")).toBeHidden();

  const tapPoint = await page.evaluate(() => window.__redsaAudit.prepareTerritoryTap("canton", "1701"));
  expect(tapPoint).not.toBeNull();
  if (await page.locator("#right-context-host").isVisible()) {
    await page.locator("#mobile-legend-toggle").tap();
    await expect(page.locator("#right-context-host")).toBeHidden();
  }
  await page.touchscreen.tap(tapPoint.x, tapPoint.y);
  await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().selectedTerritory)).toEqual({ level: "canton", code: "1701" });
  await expect(page.locator("#right-context-host")).toBeHidden();
  await expect(page.locator("#demographic-hover-card")).not.toHaveAttribute("hidden", "");

  await page.locator('[data-right-panel="legend"]').tap();
  await expect(page.locator("#right-context-host")).toBeVisible();
  await expect(page.locator("#demographic-hover-card")).toBeVisible();
  await expect(page.locator("#demographic-hover-card")).toContainText("Ver análisis completo");
});


test("Legend classification tooltips and adaptive color palettes verify correctly", async ({ page }) => {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__redsaAudit !== undefined);

  await page.evaluate(() => window.__redsaAudit.selectYear(2024));
  await page.evaluate(() => window.__redsaAudit.setTerritoryLevelMode("parish"));
  await page.evaluate(() => window.__redsaAudit.selectVariable("fallecidos_parroquial"));
  await page.waitForFunction(() => window.__redsaActiveBins && window.__redsaActiveBins.variable === "fallecidos_parroquial");

  const mobileLegendToggle = page.locator("#mobile-legend-toggle");
  if (await mobileLegendToggle.isVisible() && await mobileLegendToggle.getAttribute("aria-expanded") === "false") {
      await mobileLegendToggle.click();
  }

  await expect(page.locator('.legend-panel')).not.toContainText(/escala logar.tmica/i);
  const infoIcon = page.locator('.legend-panel .sigla-tooltip-trigger[data-sigla="INFO"]');
  await expect(infoIcon).toBeVisible();

  await infoIcon.click();

  const popover = page.locator('.sigla-popover');
  await expect(popover).toBeVisible();
  
  const popoverText = await popover.textContent();
  expect(popoverText).toMatch(/Clasificaci.n:/);
  expect(popoverText).toMatch(/GVF:/);
  if ((await page.evaluate(() => window.__redsaActiveBins)).logScaled) {
    expect(popoverText).toMatch(/escala logar.tmica/i);
  }

  await page.mouse.click(10, 10);
  await expect(popover).not.toBeVisible();
  
  const activeBins = await page.evaluate(() => window.__redsaActiveBins);
  expect(activeBins.colors.length).toBeGreaterThanOrEqual(3);
  expect(activeBins.logScaled).toBeDefined();
});

test("EDG parish-derived fatalities are available at province, canton and parish levels", async ({ page }) => {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__redsaAudit !== undefined);
  await page.evaluate(() => window.__redsaAudit.selectYear(2024));
  await page.evaluate(() => window.__redsaAudit.selectVariable("fallecidos_parroquial"));

  for (const level of ["province", "canton", "parish"]) {
    await page.evaluate(value => window.__redsaAudit.setTerritoryLevelMode(value), level);
    await page.waitForFunction(
      expected => window.__redsaActiveBins?.variable === "fallecidos_parroquial"
        && window.__redsaActiveBins?.level === expected,
      level
    );
    await expect(page.locator("#map-level-note")).toBeHidden();
    await expect(page.locator(".legend-heading-title")).toHaveText("Personas fallecidas");
    await expect(page.locator(".legend-heading-meta")).toContainText("Registro Estadístico de Defunciones Generales (EDG)");
  }

  await page.evaluate(() => window.__redsaAudit.setTerritoryLevelMode("canton"));
  await page.evaluate(() => window.__redsaAudit.fireTerritoryEvent("canton", "1413", "click"));
  await expect(page.locator("#cabecera-warning-box")).toBeEmpty();
  const sevillaDonBosco2024 = await page.evaluate(
    () => window.__redsaAudit
      .findTerritoryLayer("canton", "1413")
      .feature.properties.fallecidos_parroquial["2024"]
  );
  expect(sevillaDonBosco2024).toBe(7);
});

test("Territory tooltip displays Siniestros and Fallecidos in dedicated lines without cross-fallbacks", async ({ page }) => {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__redsaAudit !== undefined);
  await page.evaluate(() => window.__redsaAudit.selectYear(2024));
  await page.evaluate(() => window.__redsaAudit.selectVariable("normal"));
  await page.evaluate(() => window.__redsaAudit.setTerritoryLevelMode("canton"));

  // 1. Territorio con siniestros_historico disponible (Quito cantón)
  const quitoTooltip = await page.evaluate(() => {
    const layer = window.__redsaAudit.findTerritoryLayer("canton", "1701");
    return window.getTerritoryTooltipContent ? window.getTerritoryTooltipContent(layer.feature, "canton") : null;
  });
  expect(quitoTooltip).toContain("Población (2024):");
  expect(quitoTooltip).toContain("Siniestros (2024):");
  expect(quitoTooltip).toContain("Fallecidos (2024):");
  expect(quitoTooltip).not.toContain("Siniestros (2024): Sin dato");

  // 2. Territorio sin siniestros_historico pero con fallecidos (parroquia Cuenca con fallecidos en 2021)
  await page.evaluate(() => window.__redsaAudit.selectVariable("siniestros_inec_2019"));
  await page.evaluate(() => window.__redsaAudit.selectYear(2021));
  await page.evaluate(() => window.__redsaAudit.selectVariable("normal"));
  await page.evaluate(() => window.__redsaAudit.setTerritoryLevelMode("parish"));
  await page.waitForFunction(() => Boolean(window.__redsaAudit.findTerritoryLayer("parish", "010150")));

  const parishTooltip = await page.evaluate(() => {
    const layer = window.__redsaAudit.findTerritoryLayer("parish", "010150");
    return window.getTerritoryTooltipContent ? window.getTerritoryTooltipContent(layer.feature, "parish") : null;
  });
  expect(parishTooltip).not.toContain("Población");
  expect(parishTooltip).toContain("Siniestros (2021): Sin dato");
  expect(parishTooltip).toContain("Fallecidos (2021): 59");
  expect(parishTooltip).not.toContain("Siniestros (2021): 59");
});

test("la ficha parroquial omite población y tasas y explica el criterio", async ({ page }) => {
  await loadPortal(page);
  await page.evaluate(() => window.__redsaAudit.setTerritoryLevelMode("parish"));
  await page.waitForFunction(() => Boolean(window.__redsaAudit.findTerritoryLayer("parish", "010150")));
  await expect(page.locator("#population-detail-row")).toBeHidden();
  await expect(page.locator("#siniestros-rate-detail-row")).toBeHidden();
  await expect(page.locator("#fallecidos-rate-detail-row")).toBeHidden();
  await page.evaluate(() => window.__redsaAudit.fireTerritoryEvent("parish", "010150", "mouseover"));
  const renderedParishTooltip = page.locator(".territory-hover-tooltip").last();
  await expect(renderedParishTooltip).toBeVisible();
  await expect(renderedParishTooltip).not.toContainText("Población");
  await page.evaluate(() => window.__redsaAudit.fireTerritoryEvent("parish", "010150", "click"));

  if ((page.viewportSize()?.width || 0) <= 768) {
    await page.locator("#mobile-sidebar-toggle").click();
  } else {
    await page.locator("#open-analysis-button").click();
  }
  await expect(page.locator("#territory-sidebar")).toHaveAttribute("aria-hidden", "false");

  await expect(page.locator("#population-detail-row")).toBeHidden();
  await expect(page.locator("#siniestros-rate-detail-row")).toBeHidden();
  await expect(page.locator("#fallecidos-rate-detail-row")).toBeHidden();
  const parishNote = page.locator("#parish-population-note");
  await expect(parishNote).toBeVisible();
  await expect(parishNote).toContainText("Sobre población y tasas por habitante en parroquias");

  const infoButton = parishNote.getByRole("button", {
    name: "Por qué no se muestran población ni tasas parroquiales"
  });
  await expect(infoButton).toBeVisible();
  await infoButton.focus();
  await infoButton.press("Enter");
  await expect(page.locator("#sigla-popover")).toContainText(
    "El INEC no publica proyecciones de población a nivel parroquial."
  );
  await expect(page.locator("#citizen-summary")).not.toContainText("por cada 100.000 habitantes");

  await page.evaluate(() => window.__redsaAudit.clearSelection());
  await expect(page.locator("#population-detail-row")).toBeHidden();
  await expect(page.locator("#siniestros-rate-detail-row")).toBeHidden();
  await expect(page.locator("#fallecidos-rate-detail-row")).toBeHidden();
  await expect(parishNote).toBeVisible();

  await page.evaluate(() => window.__redsaAudit.setTerritoryLevelMode("canton"));
  await page.evaluate(() => window.__redsaAudit.fireTerritoryEvent("canton", "0101", "mouseover"));
  const renderedCantonTooltip = page.locator(".territory-hover-tooltip").last();
  await expect(renderedCantonTooltip).toBeVisible();
  await expect(renderedCantonTooltip).toContainText("Población");
  await page.evaluate(() => window.__redsaAudit.fireTerritoryEvent("canton", "0101", "click"));
  await expect(page.locator("#population-detail-row")).toBeVisible();
  await expect(page.locator("#siniestros-rate-detail-row")).toBeVisible();
  await page.locator("#complementary-indicators-disclosure").evaluate(element => { element.open = true; });
  await expect(page.locator("#fallecidos-rate-detail-row")).toBeVisible();
  await expect(parishNote).toBeHidden();

  const cantonTooltip = await page.evaluate(() => {
    const layer = window.__redsaAudit.findTerritoryLayer("canton", "0101");
    return window.getTerritoryTooltipContent(layer.feature, "canton");
  });
  expect(cantonTooltip).toContain("Población (2025):");
});

test("Territory tooltip deduplicates fixed lines by source field", async ({ page }) => {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__redsaAudit !== undefined);
  await page.evaluate(() => window.__redsaAudit.selectYear(2024));
  await page.evaluate(() => window.__redsaAudit.setTerritoryLevelMode("province"));

  await page.evaluate(() => window.__redsaAudit.selectVariable("siniestros_inec_2019"));
  const siniestrosTooltip = await page.evaluate(() => {
    const layer = window.__redsaAudit.findTerritoryLayer("province", "17");
    return window.getTerritoryTooltipContent(layer.feature, "province");
  });
  expect(siniestrosTooltip).toContain("Siniestros de tránsito reportados (ANT/INEC):");
  expect(siniestrosTooltip).not.toContain("Siniestros (2024):");
  expect((siniestrosTooltip.match(/Siniestros/gu) || []).length).toBe(1);

  await page.evaluate(() => window.__redsaAudit.fireTerritoryEvent("province", "17", "mouseover"));
  const renderedSiniestrosTooltip = page.locator(".territory-hover-tooltip").last();
  await expect(renderedSiniestrosTooltip).toBeVisible();
  const renderedText = await renderedSiniestrosTooltip.textContent();
  expect((renderedText.match(/Siniestros/gu) || []).length).toBe(1);

  await page.evaluate(() => window.__redsaAudit.selectVariable("tasa_fallecidos_100k"));
  const rateTooltip = await page.evaluate(() => {
    const layer = window.__redsaAudit.findTerritoryLayer("province", "17");
    return window.getTerritoryTooltipContent(layer.feature, "province");
  });
  expect(rateTooltip).toContain("Población (2024):");
  expect(rateTooltip).toContain("Siniestros (2024):");
  expect(rateTooltip).toContain("Fallecidos (2024):");
  expect(rateTooltip).toContain("Fallecidos por cada 100.000 habitantes:");
});


