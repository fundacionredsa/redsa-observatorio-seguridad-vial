import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("redsa_tour_visto", "true"));
});

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

test("abre como observatorio nacional con siniestros y sin infraestructura", async ({ page }) => {
  await loadPortal(page);
  const state = await page.evaluate(() => window.__redsaAudit.state());
  expect(state.level).toBe("province");
  expect(state.selectedVariable).toBe("siniestros_inec_2019");
  expect(state.selectedYear).toBe(2024);
  expect(state.variableCount).toBeGreaterThanOrEqual(10);
  expect(state.infrastructureLayerCount).toBe(8);
  expect(Object.values(state.osmLayers).every(layer => !layer.visible)).toBeTruthy();
  await expect(page.locator("#citizen-panel")).toContainText("Observatorio Nacional");
  await expect(page.locator("#citizen-panel")).toContainText("¿Qué tan seguras son las vías donde vives?");

  await page.evaluate(() => window.__redsaAudit.selectVariable("normal"));
  await expect(page.locator(".legend-panel")).not.toContainText("Pichincha");
  await expect(page.locator(".legend-panel")).not.toContainText("Resto del país");
});

test("encuentra un canton y muestra tendencia ciudadana en dos acciones", async ({ page }) => {
  await loadPortal(page);
  const search = page.locator("#territory-search-input");
  await search.fill("Quito — Pichincha");
  await search.press("Enter");
  await expect(page.locator("#citizen-summary")).toContainText("DISTRITO METROPOLITANO DE QUITO", { timeout: 20_000 });
  await expect(page.locator("#citizen-summary")).toContainText("accidentes reportados");
  await expect(page.locator("#citizen-summary")).toContainText("mediana de los cantones");
  const experience = await page.evaluate(() => window.__redsaExperienceAudit.state());
  expect(experience.selectedCanton).toBe("1701");
  await expect(page.locator("#share-view-button")).toBeEnabled();
  await expect(page.locator("#download-summary-button")).toBeEnabled();
});

test("modo tecnico conserva variables, capas, metodologia y estado todo apagado", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "El drawer movil se valida en la prueba responsive.");
  await loadPortal(page);
  await expect(page.locator("#technical-drawer")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("body")).toHaveClass(/technical-drawer-open/);
  await expect(page.locator("#technical-panel-toggle")).toBeHidden();
  await expect(page.locator("#technical-drawer-close")).toBeHidden();
  await expect(page.locator("#citizen-panel")).toBeVisible();
  await expect(page.locator(".legend-panel")).toBeVisible();
  await expect(page.locator("#map-variable-select option")).toHaveCount(10);
  await expect(page.locator(".leaflet-control-layers-overlays label")).toHaveCount(8);
  await expect(page.locator("#technical-drawer")).not.toContainText("CartoDB Positron");
  await expect(page.locator(".basemap-control .leaflet-control-layers-base label")).toHaveCount(4);
  await expect(page.locator(".basemap-control .leaflet-control-layers-base label", { hasText: "Esri World Imagery" })).toHaveCount(1);
  await expect(page.locator("#infrastructure-disclosure")).not.toHaveAttribute("open", "");
  await expect(page.locator("#clear-infrastructure-button")).toHaveCount(0);
  await expect(page.locator("#clean-map-button")).toHaveCount(0);
  await expect(page.locator("#technical-drawer")).not.toContainText("Corredores priorizados por REDSA");
  await expect(page.locator("#technical-drawer")).not.toContainText("Mapillary");
  await expect(page.locator("#technical-drawer")).toContainText("Metodología");
  await expect(page.locator("#technical-drawer")).not.toContainText("Descargar datos cantonales");

  const persistentLayout = await page.evaluate(() => {
    const rect = selector => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    };
    const intersects = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    const drawer = rect("#technical-drawer");
    const legend = rect(".legend-panel");
    return { drawer, legend, intersects: intersects(drawer, legend) };
  });
  expect(persistentLayout.intersects).toBeFalsy();

  await page.locator("#map-variable-select").selectOption("fallecidos_inec_2019");
  await expect(page.locator("#technical-drawer")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#citizen-panel")).toBeVisible();
  await expect(page.locator(".legend-panel")).toContainText("Personas fallecidas");

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

test("leyenda declara cuando la variable no existe en el nivel territorial", async ({ page }) => {
  await loadPortal(page);
  await page.evaluate(() => {
    window.__redsaAudit.selectVariable("siniestros_inec_2019");
    window.__redsaAudit.setTerritoryLevelMode("parish");
  });

  await expect(page.locator(".legend-panel")).toContainText("Sin datos disponibles en este nivel territorial");
  await expect(page.locator(".legend-panel")).toContainText("Accidentes de tránsito reportados");
  await expect(page.locator(".legend-panel")).toContainText("Límites administrativos");
});

test("selector de periodo permanece accesible al desplazar el panel de analisis", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Comportamiento sticky del panel de escritorio.");
  await loadPortal(page);
  const sidebar = page.locator("#territory-sidebar");

  await sidebar.evaluate(element => { element.scrollTop = element.scrollHeight; });
  const layout = await page.evaluate(() => {
    const sidebarRect = document.querySelector("#territory-sidebar").getBoundingClientRect();
    const control = document.querySelector("#territory-sidebar .detail-period-control");
    const controlRect = control.getBoundingClientRect();
    return {
      position: getComputedStyle(control).position,
      sidebarTop: sidebarRect.top,
      controlTop: controlRect.top,
      visible: controlRect.bottom > sidebarRect.top && controlRect.top < sidebarRect.bottom
    };
  });

  expect(layout.position).toBe("sticky");
  expect(layout.visible).toBeTruthy();
  expect(Math.abs(layout.controlTop - layout.sidebarTop)).toBeLessThanOrEqual(28);
});

test("paneles alternan entre anio y acumulados con cobertura explicita", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "La lectura detallada se valida una vez en desktop.");
  await loadPortal(page);
  await page.evaluate(() => {
    window.__redsaAudit.setTerritoryLevelMode("canton");
    window.__redsaAudit.showTerritory("canton", "1701");
  });
  await expect(page.locator("#demographic-hover-card")).toBeVisible();
  await page.locator(".profile-period-segments [data-detail-period-mode='accumulated']").click();

  await expect(page.locator("#edg-sidebar-year")).toHaveText("2020–2024");
  await expect(page.locator("#sppat-sidebar-year")).toHaveText("2016–2021");
  await expect(page.locator("#siniestros-section-year")).toContainText("2017–2024");
  await expect(page.locator("#info-tasa-fallecidos")).toHaveText("No aplica al acumulado");
  await expect(page.locator("#hover-card-period")).toHaveText("Histórico");
  await expect(page.locator("#hover-card-body")).toContainText("(2020–2024)");
  await expect(page.locator("#hover-card-body")).toContainText("(2016–2021)");

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
  expect(parish.layers.parish.features).toBe(1040);
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
  await page.evaluate(() => {
    window.__redsaAudit.setZoom(9);
    window.__redsaAudit.fireTerritoryEvent("canton", "1701", "click");
  });
  const card = page.locator("#demographic-hover-card");
  await expect(card).toBeVisible();
  const selectedTitle = await page.locator("#hover-card-title").textContent();

  await page.evaluate(() => {
    window.__redsaAudit.fireTerritoryEvent("canton", "1702", "mouseover");
    window.__redsaAudit.fireTerritoryEvent("canton", "1702", "mouseout");
  });
  await expect(page.locator("#hover-card-title")).toHaveText(selectedTitle || "");

  const scrollState = await card.evaluate(element => {
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
  await page.evaluate(() => {
    window.__redsaAudit.setZoom(9);
    window.__redsaAudit.showTerritory("canton", "1701");
  });
  const firstSelectedStyle = await page.evaluate(() => window.__redsaAudit.territoryStyle("canton", "1701"));

  await page.evaluate(() => window.__redsaAudit.showTerritory("canton", "1702"));
  const result = await page.evaluate(() => ({
    state: window.__redsaAudit.state(),
    first: window.__redsaAudit.territoryStyle("canton", "1701"),
    second: window.__redsaAudit.territoryStyle("canton", "1702")
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
  await expect(page.locator('[data-level-mode="canton"]')).toHaveAttribute("aria-pressed", "true");

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
  await expect(page.locator('[data-level-mode="auto"]')).toHaveAttribute("aria-pressed", "true");
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
  await page.evaluate(() => {
    window.__redsaAudit.setZoom(9);
    window.__redsaAudit.selectVariable("siniestros_inec_2019");
    window.__redsaAudit.selectYear(2021);
    window.__redsaAudit.showTerritory("canton", "1701");
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
  await expect(page.locator("#timeline-marks .timeline-mark.gap")).toHaveCount(6);
});

test("explica variables y perfiles en lenguaje ciudadano", async ({ page }) => {
  await loadPortal(page);
  const description = page.locator("#map-variable-description");
  await expect(description).toHaveText("Número de accidentes de tránsito reportados oficialmente en esta zona.");

  const descriptions = {
    siniestros_inec_2019: "Número de accidentes de tránsito reportados oficialmente en esta zona.",
    tasa_fallecidos_100k: "Fallecidos por cada 100.000 habitantes: permite comparar zonas con poblaciones de distinto tamaño.",
    cobertura_mapeo_osm: "Qué tanto se ha registrado la infraestructura de seguridad vial (semáforos, cruces y aceras) en el mapa colaborativo OpenStreetMap. No mide si la infraestructura existe o no; solo si alguien ya la mapeó."
  };
  for (const [variable, text] of Object.entries(descriptions)) {
    await page.evaluate(selected => window.__redsaAudit.selectVariable(selected), variable);
    await expect(description).toHaveText(text);
  }

  await page.evaluate(() => {
    window.__redsaAudit.setZoom(9);
    window.__redsaAudit.selectVariable("fallecidos_inec_2019");
    window.__redsaAudit.selectYear(2024);
    window.__redsaAudit.showTerritory("canton", "1701");
  });
  await expect(page.locator(".profile-card-citizen-title").first()).toHaveText("¿Quiénes fallecieron en siniestros de tránsito aquí? (2024)");
  await expect(page.locator(".profile-card-source-detail").first()).toContainText("según registro civil");
  await expect(page.locator(".profile-card-source-detail").first()).toContainText("Los iconos ⓘ explican los códigos técnicos");
  await expect(page.locator(".perfil-card-section").locator("text=Otros / veh. no especificado (V80-V89)")).toBeVisible();
});

test("ranking nacional ordena, excluye sin dato y busca la posicion cantonal", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "La logica completa del ranking se valida una vez en desktop.");
  await loadPortal(page);
  await page.locator("#open-institutional-button").click();
  await expect(page.locator("#institutional-modal")).toBeVisible();

  const assertDescendingRanking = async expectedVariable => {
    const ranking = await page.evaluate(() => window.__redsaInstitutionalAudit.state());
    expect(ranking.variable).toBe(expectedVariable);
    expect(ranking.totalCount).toBe(224);
    expect(ranking.validCount + ranking.excludedCount).toBe(224);
    expect(ranking.validCount).toBeGreaterThan(0);
    expect(ranking.excludedCount).toBeGreaterThan(0);
    expect(ranking.rows.every(row => Number.isFinite(row.value))).toBeTruthy();
    expect(ranking.rows.every((row, index) => index === 0 || ranking.rows[index - 1].value >= row.value)).toBeTruthy();
    await expect(page.locator("#ranking-table-body tr")).toHaveCount(ranking.validCount);
    await expect(page.locator("#ranking-table-body")).not.toContainText("Sin dato");
    await expect(page.locator("#ranking-variable-description")).toHaveText(await page.locator("#map-variable-description").textContent());
    return ranking;
  };

  const accidents = await assertDescendingRanking("siniestros_inec_2019");
  expect(accidents.year).toBe(2024);
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
  await expect(page.locator("#institutional-panel-trust a")).toHaveAttribute("href", "https://github.com/fundacionredsa/redsa-observatorio-seguridad-vial");

  await page.locator("#institutional-tab-citation").tap();
  await expect(page.locator("#institutional-panel-citation")).toContainText("Fundación REDSA (2026)");
  await expect(page.locator("#citation-current-date")).toHaveText(/^\d{1,2} de \p{L}+ de 20\d{2}$/u);
  await page.keyboard.press("Escape");
  await expect(page.locator("#institutional-modal")).toBeHidden();
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
  const stableTarget = (page.viewportSize()?.width || 0) > 768
    ? page.locator("#citizen-panel")
    : page.locator("#mobile-sidebar-toggle");
  await stableTarget.hover();
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
  if ((page.viewportSize()?.width || 0) > 768) {
    expect(boxes.card.bottom - boxes.card.top).toBeGreaterThan(280);
  }

  await page.evaluate(() => window.__redsaAudit.showTerritory("canton", "1702"));
  await expect(card.locator("#hover-card-title")).not.toHaveText(before || "");
});

test("panel demografico evita sidebar, drawer tecnico y leyenda", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Geometria de drawers desktop.");
  await loadPortal(page);
  await page.evaluate(() => {
    window.__redsaAudit.setZoom(9);
    window.__redsaAudit.showTerritory("canton", "1701");
  });

  async function assertNoOverlap(obstacleSelector) {
    await page.waitForTimeout(280);
    const geometry = await page.evaluate(selector => {
      const box = element => {
        const rect = document.querySelector(element).getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      const card = box("#demographic-hover-card");
      const obstacle = box(selector);
      const legend = box(".legend-panel");
      const intersects = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      return { card, obstacle, legend, obstacleIntersection: intersects(card, obstacle), legendIntersection: intersects(card, legend), viewport: { width: innerWidth, height: innerHeight } };
    }, obstacleSelector);
    expect(geometry.obstacleIntersection, JSON.stringify(geometry)).toBeFalsy();
    expect(geometry.legendIntersection, JSON.stringify(geometry)).toBeFalsy();
    expect(geometry.card.left).toBeGreaterThanOrEqual(0);
    expect(geometry.card.right).toBeLessThanOrEqual(geometry.viewport.width);
    expect(geometry.card.bottom).toBeLessThanOrEqual(geometry.viewport.height - 10);
  }

  await page.locator("#open-analysis-button").click();
  await expect(page.locator("#territory-sidebar")).toHaveAttribute("aria-hidden", "false");
  await assertNoOverlap("#territory-sidebar");
  await page.locator("#mobile-sidebar-close").click();

  await expect(page.locator("#technical-drawer")).toHaveAttribute("aria-hidden", "false");
  await assertNoOverlap("#technical-drawer");
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

    const geometry = await page.evaluate(() => {
      const box = selector => {
        const element = document.querySelector(selector);
        const rect = element.getBoundingClientRect();
        const styles = getComputedStyle(element);
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          display: styles.display,
          pointerEvents: styles.pointerEvents,
          inViewport: rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight
        };
      };
      const citizen = box("#citizen-panel");
      const legend = box(".legend-panel");
      return {
        viewport: { width: innerWidth, height: innerHeight },
        map: box("#map"),
        citizen,
        legend,
        freeMapBand: legend.top - citizen.bottom,
        sidebar: box("#territory-sidebar"),
        layers: box("#technical-drawer"),
        sidebarButton: box("#mobile-sidebar-toggle"),
        layersButton: box("#mobile-layers-toggle"),
        legendButton: box("#mobile-legend-toggle")
      };
    });

    expect(geometry.map.width).toBe(viewport.width);
    expect(geometry.map.height).toBe(viewport.height);
    const minimumUsableMapBand = Math.min(220, Math.max(120, viewport.height * 0.175));
    expect(geometry.freeMapBand).toBeGreaterThanOrEqual(minimumUsableMapBand);
    expect(geometry.legend.height).toBeLessThanOrEqual(52);
    expect(geometry.sidebar.inViewport).toBeFalsy();
    expect(geometry.layers.inViewport).toBeFalsy();
    expect(geometry.layers.pointerEvents).toBe("none");
    expect(geometry.sidebarButton.height).toBeGreaterThanOrEqual(44);
    expect(geometry.layersButton.height).toBeGreaterThanOrEqual(44);
    expect(geometry.legendButton.height).toBeGreaterThanOrEqual(44);
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

  await page.locator("#mobile-overlay-backdrop").tap({ position: { x: width - 6, y: height - 6 } });
  await expect(page.locator("body")).not.toHaveClass(/mobile-sidebar-open/);

  await page.locator("#mobile-layers-toggle").tap();
  await expect(page.locator("body")).toHaveClass(/mobile-layers-open/);
  await expect.poll(() => page.locator("#technical-drawer").evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(width);
  const technical = await page.evaluate(() => {
    const box = selector => {
      const element = document.querySelector(selector);
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    return {
      drawer: box("#technical-drawer"),
      selector: box(".map-selector-control"),
      slider: box("#map-year-slider"),
      level: box("#territory-level-control")
    };
  });
  expect(technical.drawer.left).toBeGreaterThanOrEqual(0);
  expect(technical.drawer.right).toBeLessThanOrEqual(width);
  expect(technical.drawer.bottom).toBeLessThanOrEqual(height);
  expect(technical.selector.bottom).toBeLessThanOrEqual(height);
  expect(technical.slider.height).toBeGreaterThanOrEqual(44);
  expect(technical.slider.bottom).toBeLessThanOrEqual(height);
  expect(technical.level.bottom).toBeLessThanOrEqual(height);

  const tooSmall = await page.evaluate(() => {
    const selectors = [
      ".mobile-nav-toggle",
      ".mobile-sidebar-close",
      "#technical-drawer-close",
      ".leaflet-control-layers-list label",
      "#map-variable-select",
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

  await page.locator("#technical-drawer-close").tap();
  await expect(page.locator("body")).not.toHaveClass(/mobile-layers-open/);
  await page.waitForFunction(() => document.querySelector("#technical-drawer").getBoundingClientRect().left >= innerWidth - 1);

  const tapPoint = await page.evaluate(() => window.__redsaAudit.prepareTerritoryTap("canton", "1701"));
  expect(tapPoint).not.toBeNull();
  await page.touchscreen.tap(tapPoint.x, tapPoint.y);
  await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().selectedTerritory)).toEqual({ level: "canton", code: "1701" });
  await expect(page.locator("#demographic-hover-card")).toBeVisible();
  await expect(page.locator("#hover-card-period")).toHaveText("2022");

  const selected = await page.evaluate(() => {
    const box = selector => {
      const element = document.querySelector(selector);
      const rect = element.getBoundingClientRect();
      const styles = getComputedStyle(element);
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, visibility: styles.visibility };
    };
    const card = box("#demographic-hover-card");
    const legend = box(".legend-panel");
    const intersects = !(card.right <= legend.left || card.left >= legend.right || card.bottom <= legend.top || card.top >= legend.bottom);
    return { card, legend, intersects };
  });
  expect(selected.card.top).toBeGreaterThanOrEqual(0);
  expect(selected.card.bottom).toBeLessThanOrEqual(height - 10);
  expect(selected.intersects).toBeFalsy();

  await page.locator("#mobile-legend-toggle").tap();
  await expect(page.locator("#mobile-legend-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#legend-content")).toBeVisible();
  await expect(page.locator("#demographic-hover-card")).toHaveCSS("visibility", "hidden");
  const openLegend = await page.locator(".legend-panel").boundingBox();
  expect(openLegend).not.toBeNull();
  expect(openLegend.y).toBeGreaterThanOrEqual(0);
  expect(openLegend.y + openLegend.height).toBeLessThanOrEqual(height);

  await page.locator("#mobile-legend-toggle").tap();
  await expect(page.locator("#mobile-legend-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#demographic-hover-card")).toHaveCSS("visibility", "visible");
});


test("Legend classification tooltips and adaptive color palettes verify correctly", async ({ page }) => {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__redsaAudit !== undefined);

  await page.evaluate(() => window.__redsaAudit.setTerritoryLevelMode("parish"));
  await page.locator("#map-variable-select").selectOption("fallecidos_parroquial");
  await page.waitForFunction(() => window.__redsaActiveBins && window.__redsaActiveBins.variable === "fallecidos_parroquial");

  const mobileLegendToggle = page.locator("#mobile-legend-toggle");
  if (await mobileLegendToggle.isVisible()) {
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
  await page.locator("#map-variable-select").selectOption("fallecidos_parroquial");

  for (const level of ["province", "canton", "parish"]) {
    await page.evaluate(value => window.__redsaAudit.setTerritoryLevelMode(value), level);
    await page.waitForFunction(
      expected => window.__redsaActiveBins?.variable === "fallecidos_parroquial"
        && window.__redsaActiveBins?.level === expected,
      level
    );
    await expect(page.locator("#map-level-note")).toBeHidden();
    await expect(page.locator(".legend-panel")).toContainText("Personas fallecidas (EDG)");
  }

  await page.evaluate(() => window.__redsaAudit.setTerritoryLevelMode("canton"));
  await page.evaluate(() => window.__redsaAudit.fireTerritoryEvent("canton", "1413", "click"));
  await expect(page.locator("#cabecera-warning-box")).toContainText("Sin cobertura parroquial para 2024");
});

