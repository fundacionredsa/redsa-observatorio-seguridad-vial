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

async function box(page, selector) {
  return page.locator(selector).evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    };
  });
}

function intersects(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

test("la barra derecha conserva solo Datos y capas y Mapas base", async ({ page }) => {
  await loadPortal(page);

  const rail = page.locator("#right-tools-rail");
  const layersButton = page.locator('[data-right-panel="layers"]');
  const analysisButton = page.locator('[data-right-panel="analysis"]');
  const settingsButton = page.locator('[data-right-panel="settings"]');
  const isMobile = (page.viewportSize()?.width || 0) <= 768;

  await expect(rail).toBeVisible();
  await expect(page.locator("#right-tools-rail [role='tab']")).toHaveCount(3);
  await expect(page.locator("#right-tools-rail [role='tab']")).toHaveText([
    "CAPAS",
    "ANÁLISIS",
    "AJUSTES"
  ]);
  await expect(page.locator('[data-right-panel="legend"]')).toHaveCount(0);
  await expect(layersButton).toHaveAttribute("aria-expanded", "false");
  await expect(analysisButton).toHaveAttribute("aria-expanded", "false");
  await expect(settingsButton).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#right-context-host")).toBeHidden();
  await expect(page.locator("#right-context-host")).toHaveAttribute("data-active-panel", "none");
  await expect(page.locator("#map-legend-card")).toBeVisible();
  await expect(page.locator("#map-legend-card")).toHaveAttribute("data-has-legend", "true");
  await expect(page.locator("#map-legend-card")).toHaveAttribute("data-layer-count", "1");
  await expect(page.locator("#demographic-hover-card")).toBeHidden();
  await expect(page.locator("#technical-drawer")).toBeHidden();
  await expect(page.locator("#basemap-context-panel")).toBeHidden();
  await expect(page.locator("#map-legend-card #legend-active-layers-list")).toHaveCount(1);

  await layersButton.click();
  await expect(page.locator("#technical-drawer")).toBeVisible();
  if (isMobile) {
    await expect(page.locator("#map-legend-card")).toBeHidden();
  } else {
    await expect(page.locator("#map-legend-card")).toBeVisible();
  }
  await expect(page.locator("[data-right-context-view]:visible")).toHaveCount(1);
  await settingsButton.click();
  await expect(page.locator("#view-settings-panel")).toBeVisible();
  await expect(page.locator("#technical-drawer")).toBeHidden();
  await settingsButton.press("ArrowUp");
  await expect(analysisButton).toBeFocused();
  await expect(page.locator("#territory-sidebar")).toBeVisible();

  if (isMobile) {
    await page.locator("#mobile-sidebar-close").click();
  } else {
    await analysisButton.click();
  }
  await expect(page.locator("#map-legend-card")).toBeVisible();
  await page.locator("#legend-close-toggle").click();
  await expect(page.locator("#map-legend-card")).toBeHidden();
  await expect(page.locator("#legend-visibility-toggle")).toBeVisible();
  await page.locator("#legend-visibility-toggle").click();
  await expect(page.locator("#map-legend-card")).toBeVisible();
  await page.evaluate(() => window.__redsaAudit.selectVariable("normal"));
  await expect(page.locator("#map-legend-card")).toHaveAttribute("data-layer-count", "0");
  await expect(page.locator("#map-legend-card")).toHaveAttribute("data-has-legend", "false");
  await expect(page.locator("#map-legend-card")).toBeHidden();
});

test("la barra superior concentra accesos y el buscador refleja capas extra en vivo", async ({ page }) => {
  await loadPortal(page);
  const isMobile = (page.viewportSize()?.width || 0) <= 768;

  await expect(page.locator("#site-topbar #open-institutional-button")).toHaveCount(1);
  await expect(page.locator("#site-topbar #btn-catalog")).toHaveCount(1);
  await expect(page.locator("#site-topbar #site-methodology-toggle")).toHaveCount(1);
  await expect(page.locator("#site-topbar #btn-tour")).toHaveCount(1);
  await expect(page.locator("#citizen-panel #open-institutional-button, #citizen-panel #btn-tour")).toHaveCount(0);
  await expect(page.locator("#right-tools-rail #btn-catalog, #right-tab-methodology, #methodology-context-panel")).toHaveCount(0);

  await page.locator("#site-topbar-menu-toggle").click();
  await expect(page.locator("#site-topbar-actions")).toBeVisible();
  await page.locator("#site-methodology-toggle").click();
  await expect(page.locator("#site-methodology-menu a")).toHaveCount(4);
  await expect(page.locator("#site-methodology-menu")).toBeVisible();
  await page.locator("#site-methodology-toggle").click();
  await page.locator("#site-topbar-menu-toggle").click();

  const shortcut = page.locator("#active-layers-shortcut");
  await expect(shortcut).toHaveAttribute("data-active-layer-count", "1");
  await expect(shortcut).not.toHaveClass(/has-extra-layers/);
  await page.evaluate(() => window.__redsaAudit.setOverlay("Ciclovías", true));
  await expect(shortcut).toHaveAttribute("data-active-layer-count", "2");
  await expect(shortcut).toHaveClass(/has-extra-layers/);
  await expect(shortcut).toHaveAttribute("aria-label", /2 capas activas/);
  await page.evaluate(() => window.__redsaAudit.setOverlay("Ciclovías", false));
  await expect(shortcut).toHaveAttribute("data-active-layer-count", "1");
  await expect(shortcut).not.toHaveClass(/has-extra-layers/);

  await shortcut.click();
  await expect(page.locator("#technical-drawer")).toBeVisible();
  await expect(shortcut).toHaveAttribute("aria-expanded", "true");
});

test("los cambios cartográficos conservan la pestaña elegida por la persona", async ({ page }) => {
  await loadPortal(page);
  const host = page.locator("#right-context-host");
  const settingsTab = page.locator('[data-right-panel="settings"]');
  const layersTab = page.locator('[data-right-panel="layers"]');
  const expectPanel = async panel => {
    await expect(host).toBeVisible();
    await expect(host).toHaveAttribute("data-active-panel", panel);
  };

  await settingsTab.click();
  await page.evaluate(() => window.__redsaAudit.selectVariable("fallecidos_inec_2019"));
  await expectPanel("settings");

  await page.evaluate(() => window.__redsaAudit.selectYear(2024));
  await expectPanel("settings");

  await page.evaluate(() => window.__redsaAudit.setTerritoryLevelMode("canton"));
  await expectPanel("settings");

  await layersTab.click();
  await page.evaluate(() => window.__redsaAudit.showTerritory("province", "17"));
  await expectPanel("layers");
  await expect(page.locator("#demographic-hover-card")).not.toHaveAttribute("hidden", "");

  await page.evaluate(() => window.__redsaAudit.setOverlay("Ciclovías", true));
  await expectPanel("layers");
  await expect(page.locator("#map-legend-card")).toHaveAttribute("data-layer-count", "2");
  if ((page.viewportSize()?.width || 0) <= 768) {
    await expect(page.locator("#map-legend-card")).toBeHidden();
  } else {
    await expect(page.locator("#map-legend-card")).toHaveClass(/is-visible/);
    await expect(page.locator("#demographic-hover-card")).toBeVisible();
  }
});

test("las tres capas del mapa comparten una sola tarjeta y conservan controles independientes", async ({ page }, testInfo) => {
  await loadPortal(page);
  await page.locator('[data-right-panel="layers"]').click();

  const card = page.locator("#layers-card");
  const variables = page.locator("#variable-disclosure");
  const events = page.locator("#event-layer-disclosure");
  const infrastructure = page.locator("#infrastructure-disclosure");

  await expect(card).toBeVisible();
  await expect(card.locator("#variable-disclosure")).toHaveCount(1);
  await expect(card.locator("#event-layer-disclosure")).toHaveCount(1);
  await expect(card.locator("#infrastructure-disclosure")).toHaveCount(1);
  await expect(card.locator(".layers-card-section")).toHaveCount(4);
  await expect(card).toContainText("Capas disponibles");
  await expect(card.locator("#map-variable-count")).toHaveText("9");
  await expect(card.locator("#infrastructure-layer-count")).toHaveText("10");
  await expect(card.locator(".infrastructure-toggle-row")).toHaveCount(10);
  await expect(card.locator(".infrastructure-toggle-input")).toHaveCount(10);
  await expect(card.locator(".infrastructure-switch-visual")).toHaveCount(10);

  for (const disclosure of [variables, events, infrastructure]) {
    await expect(disclosure).not.toHaveAttribute("open", "");
  }

  await variables.locator("summary").click();
  await expect(variables).toHaveAttribute("open", "");
  await expect(card.locator("#territory-opacity-control")).toHaveCount(0);
  await expect(page.locator("#territory-opacity-control")).toHaveCount(1);
  expect(await page.locator("#territory-opacity-control").evaluate(element => element.parentElement?.id)).toBe(
    testInfo.project.name === "mobile" ? "mobile-opacity-control-slot" : "view-settings-opacity-slot"
  );
  await expect(page.locator(".opacity-control")).toHaveCount(0);
  await expect(events).not.toHaveAttribute("open", "");
  await expect(infrastructure).not.toHaveAttribute("open", "");

  await events.locator("summary").click();
  await expect(variables).toHaveAttribute("open", "");
  await expect(events).toHaveAttribute("open", "");
  await expect(infrastructure).not.toHaveAttribute("open", "");

  await infrastructure.locator("summary").click();
  await expect(variables).toHaveAttribute("open", "");
  await expect(events).toHaveAttribute("open", "");
  await expect(infrastructure).toHaveAttribute("open", "");
  await expect(infrastructure.locator("input[type='range']")).toHaveCount(0);
  await expect(infrastructure.locator("input[type='checkbox']").first()).toHaveClass(/leaflet-control-layers-selector/);
  const infrastructureInputs = infrastructure.locator(".infrastructure-toggle-input");
  await infrastructureInputs.nth(0).check();
  await infrastructureInputs.nth(1).check();
  await expect(infrastructureInputs.nth(0)).toBeChecked();
  await expect(infrastructureInputs.nth(1)).toBeChecked();
  const switchGeometry = await infrastructure.locator(".infrastructure-toggle-row").first().evaluate(label => {
    const input = label.querySelector("input").getBoundingClientRect();
    const visual = label.querySelector(".infrastructure-switch-visual").getBoundingClientRect();
    return { display: getComputedStyle(label).display, inputWidth: input.width, visualWidth: visual.width };
  });
  expect(switchGeometry.display).toBe("grid");
  expect(switchGeometry.inputWidth).toBeGreaterThanOrEqual(36);
  expect(switchGeometry.visualWidth).toBeGreaterThanOrEqual(36);

  const styles = await card.evaluate(element => {
    const details = [...element.querySelectorAll("details")];
    return {
      cardBorder: getComputedStyle(element).borderTopWidth,
      detailBorders: details.map(detail => getComputedStyle(detail).borderTopWidth),
      detailBackgrounds: details.map(detail => getComputedStyle(detail).backgroundColor)
    };
  });
  expect(styles.cardBorder).toBe("1px");
  expect(styles.detailBorders).toEqual(["0px", "0px", "0px"]);
  expect(styles.detailBackgrounds).toEqual(["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"]);
});

async function assertBasemapControlHasDedicatedSpace(page) {
  const viewport = page.viewportSize();
  await page.locator('[data-right-panel="layers"]').click();
  const host = page.locator("#right-context-host");
  const rail = page.locator("#right-tools-rail");
  const basemap = page.locator(".basemap-control");

  await expect(host).toBeVisible();
  await expect(basemap).toBeVisible();
  await expect(basemap).toHaveAttribute("aria-label", "Seleccionar mapa base");
  expect(await basemap.evaluate(element => element.parentElement?.id)).toBe("basemap-context-slot");

  const panel = await box(page, "#right-context-host");
  const railBox = await box(page, "#right-tools-rail");
  const zoom = await box(page, "#map-zoom-in");
  expect(panel.left).toBeGreaterThanOrEqual(0);
  expect(panel.right).toBeLessThanOrEqual(viewport.width);
  expect(intersects(panel, railBox)).toBeFalsy();
  expect(intersects(panel, zoom)).toBeFalsy();
  expect(Math.abs(panel.right - railBox.left)).toBeLessThanOrEqual(1);
  expect(zoom.left).toBeGreaterThanOrEqual(railBox.left);
  expect(zoom.right).toBeLessThanOrEqual(railBox.right);
  const basemapOptions = basemap.locator(".leaflet-control-layers-base label");
  await expect(basemapOptions).toHaveCount(5);
  await expect(basemapOptions.first()).toBeVisible();

  await expect(basemapOptions.filter({ hasText: "Esri World Imagery" })).toHaveCount(0);
  const cyclOSMOption = basemapOptions.filter({ hasText: "CyclOSM" });
  const reliefOption = basemapOptions.filter({ hasText: "OpenTopoMap" });
  await expect(cyclOSMOption).toHaveCount(1);
  await expect(reliefOption).toHaveCount(1);
  await cyclOSMOption.click();
  await expect(cyclOSMOption.locator("input")).toBeChecked();

  return { panel, rail: railBox, zoom };
}

test("panel ciudadano web conserva estado y separa selección de análisis", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "La experiencia off-canvas móvil se cubre por separado.");
  await loadPortal(page);

  const body = page.locator("body");
  const sidebar = page.locator("#territory-sidebar");
  const search = page.locator("#territory-search-input");
  const analysisTab = page.locator("#right-tab-analysis");

  await expect(page.locator("#map-search-card")).toBeVisible();
  await expect(page.locator("#map-legend-card")).toBeVisible();

  await search.fill("Cayambe");
  await search.press("Enter");
  await expect.poll(async () => page.evaluate(() => window.__redsaAudit.state().selectedTerritory)).toEqual({
    level: "canton",
    code: "1702"
  });

  await analysisTab.click();
  await expect(body).toHaveClass(/right-context-open/);
  await expect(page.locator("#right-context-host")).toHaveAttribute("data-active-panel", "analysis");
  await expect(sidebar).toHaveAttribute("aria-hidden", "false");
  await expect.poll(async () => (await box(page, "#territory-sidebar")).left).toBeGreaterThanOrEqual(0);

  await analysisTab.click();
  await expect(body).not.toHaveClass(/right-context-open/);
  await expect(sidebar).toHaveAttribute("aria-hidden", "true");
});

test("ficha territorial vive dentro de la tarjeta única y desaparece al limpiar la selección", async ({ page }, testInfo) => {
  await loadPortal(page);
  await page.evaluate(async () => {
    await window.__redsaAudit.setZoom(9);
    await window.__redsaAudit.showTerritory("canton", "1701");
  });

  const card = page.locator("#demographic-hover-card");
  const legendCard = page.locator("#map-legend-card");
  await expect(legendCard).toBeVisible();
  await expect(card).toBeVisible();
  const viewport = page.viewportSize();

  const measure = async () => {
    const cardBox = await box(page, "#demographic-hover-card");
    const scaleBox = await box(page, ".road-scale-control");
    const attributionBox = await box(page, ".leaflet-control-attribution");
    const hostBox = await box(page, "#map-legend-card");
    return { cardBox, scaleBox, attributionBox, hostBox };
  };

  await expect(page.locator("#right-context-host")).toHaveAttribute("data-active-panel", "none");
  expect(await card.evaluate(element => element.parentElement?.classList.contains("map-legend-card-scroll"))).toBeTruthy();
  expect(await card.evaluate(element => getComputedStyle(element).position)).toBe("relative");
  const legendFlow = await page.evaluate(() => {
    const readingGroup = document.querySelector(".legend-reading-group");
    const card = document.getElementById("demographic-hover-card");
    const groupBox = readingGroup?.getBoundingClientRect();
    const cardBox = card?.getBoundingClientRect();
    return {
      groupHeight: groupBox?.height || 0,
      cardTop: cardBox?.top || 0,
      groupBottom: groupBox?.bottom || 0
    };
  });
  expect(legendFlow.groupHeight).toBeGreaterThan(0);
  expect(legendFlow.cardTop).toBeGreaterThanOrEqual(legendFlow.groupBottom);
  await expect(card).toContainText("pestaña ANÁLISIS");
  await expect(card.locator(".profile-shortcut-value")).toHaveCount(0);
  const geometry = await measure();
  expect(geometry.cardBox.left).toBeGreaterThanOrEqual(geometry.hostBox.left);
  expect(geometry.cardBox.right).toBeLessThanOrEqual(geometry.hostBox.right);
  expect(geometry.cardBox.top).toBeGreaterThanOrEqual(geometry.hostBox.top);
  const headerGeometry = await page.evaluate(() => {
    const title = document.getElementById("hover-card-title")?.getBoundingClientRect();
    const actions = document.querySelector(".profile-card-header-actions")?.getBoundingClientRect();
    const compact = rect => rect && ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
    return { title: compact(title), actions: compact(actions) };
  });
  expect(intersects(headerGeometry.title, headerGeometry.actions), JSON.stringify(headerGeometry)).toBeFalsy();

  await testInfo.attach(`leyenda-ficha-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: "image/png"
  });

  if (testInfo.project.name !== "mobile") {
    const scaleCenter = (geometry.scaleBox.left + geometry.scaleBox.right) / 2;
    expect(Math.abs(scaleCenter - viewport.width / 2)).toBeLessThanOrEqual(1);
    await expect(page.locator(".road-scale-control").locator("xpath=..")).toHaveClass(/leaflet-center/);
  }
  expect(intersects(geometry.hostBox, geometry.scaleBox)).toBeFalsy();
  expect(intersects(geometry.scaleBox, geometry.attributionBox)).toBeFalsy();

  await page.evaluate(() => window.__redsaAudit.clearSelection());
  await expect(card).toBeHidden();
  await expect(page.locator("#hover-card-body")).toBeEmpty();
  await expect(legendCard).toBeVisible();
});

test("la tarjeta informa y el topbar conserva todos los controles", async ({ page }, testInfo) => {
  await loadPortal(page);
  const isMobile = testInfo.project.name === "mobile";

  await expect(page.locator("#map-legend-card")).toBeVisible();
  await expect(page.locator("#map-legend-card .legend-content-group")).toHaveCount(1);
  await expect(page.locator("#territory-opacity-label")).toHaveText("Intensidad");
  await expect(page.locator("#territory-opacity-slider")).toHaveAttribute("aria-label", /Intensidad del color de .+ en el mapa/);
  await expect(page.locator(".legend-ordinal-scale")).toHaveCount(1);
  await expect(page.locator(".legend-ordinal-labels span")).toHaveCount(5);
  await expect(page.locator(".legend-ordinal-labels")).toContainText("≤ 160");
  await expect(page.locator(".legend-ordinal-labels")).toContainText("> 4500");
  await expect(page.locator("#territory-level-select option")).toHaveCount(4);
  await expect(page.locator('#territory-level-select option[value="parish"]')).toHaveCount(1);
  expect(await page.locator("#territory-level-control").evaluate(element => element.parentElement?.id)).toBe("map-toolbar-level-slot");
  expect(await page.locator(".timeline-control").evaluate(element => element.parentElement?.id)).toBe("map-toolbar-year-slot");
  expect(await page.locator(".period-mode-control").evaluate(element => element.parentElement?.id)).toBe(
    isMobile ? "mobile-period-control-slot" : "view-settings-period-slot"
  );
  expect(await page.locator("#territory-opacity-control").evaluate(element => element.parentElement?.id)).toBe(
    isMobile ? "mobile-opacity-control-slot" : "view-settings-opacity-slot"
  );
  if (isMobile) {
    await expect(page.locator(".site-topbar-center-controls")).toBeHidden();
    await expect(page.locator("#mobile-level-bar")).toBeVisible();
    await expect(page.locator("#mobile-year-bar")).toBeVisible();
  } else {
    await expect(page.locator(".site-topbar-center-controls")).toBeVisible();
    await expect(page.locator("#site-topbar")).toHaveCSS("height", "44px");
  }
  const coverage = await page.evaluate(() => window.__redsaAudit.state().temporalCoverage);
  await expect(page.locator("#timeline-marks .tm-available")).toHaveCount(coverage.anios_disponibles.length);
  await expect(page.locator("#timeline-marks .tm-unavailable")).toHaveCount(11 - coverage.anios_disponibles.length);
  await expect(page.locator("#timeline-marks .timeline-mark").first()).toHaveText(/^20\d{2}$/);
  await page.evaluate(() => window.__redsaAudit.selectYear(2024));
  await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().selectedYear)).toBe(2024);
  await expect(page.locator(".timeline-badge")).toHaveText("2024");
  await expect(page.locator('#mobile-year-bar [data-year="2024"]')).toHaveClass(/my-selected/);

  await page.locator('[data-right-panel="layers"]').click();
  const layerOrder = await page.evaluate(() => {
    const top = selector => document.querySelector(selector).getBoundingClientRect().top;
    return {
      variables: top("#variable-disclosure"),
      events: top("#event-layer-disclosure"),
      infrastructure: top("#infrastructure-disclosure")
    };
  });
  expect(layerOrder.variables, JSON.stringify(layerOrder)).toBeLessThan(layerOrder.events);
  expect(layerOrder.events, JSON.stringify(layerOrder)).toBeLessThan(layerOrder.infrastructure);
  await expect(page.locator("#technical-drawer #territory-level-control")).toHaveCount(0);
  await expect(page.locator("#technical-drawer #map-year-slider")).toHaveCount(0);
  await expect(page.locator("#technical-drawer #territory-opacity-control")).toHaveCount(0);
  await expect(page.locator(".timeline-control")).toContainText("Año");
  await expect(page.locator(".timeline-help")).toHaveCount(0);
  await expect(page.locator("#map-year-slider")).toHaveAttribute("aria-label", "Año de los datos mostrados");
});

test("Leyenda distingue representaciones principales de controles secundarios", async ({ page }, testInfo) => {
  await loadPortal(page);
  await expect(page.locator('label[for="territory-level-select"]')).toHaveClass(/sr-only/);
  await expect(page.locator("#period-mode-note")).toHaveClass(/sr-only/);
  await expect(page.locator(".timeline-help")).toHaveCount(0);
  await expect(page.locator("#period-mode-info")).toHaveAttribute("data-custom-text", /Muestra únicamente/);

  await page.evaluate(() => window.__redsaAudit.setOverlay("Ciclovías", true));
  await page.waitForFunction(() => window.__redsaAudit.state().osmLayers["Ciclovías"].loaded, null, { timeout: 90_000 });
  const infrastructureLegend = page.locator('[data-legend-layer-id="infra-ciclovias"]');
  await expect(infrastructureLegend).toBeVisible();
  await expect(infrastructureLegend.locator(".legend-overlay-title .sigla-tooltip-trigger")).toHaveAttribute(
    "data-custom-text",
    /No constituye una serie anual/
  );

  const typography = await page.evaluate(() => {
    const style = element => {
      const computed = getComputedStyle(element);
      return { size: parseFloat(computed.fontSize), weight: Number(computed.fontWeight) };
    };
    const activeLayerNames = [...document.querySelectorAll("#legend-active-layers-list .legend-active-layer-name")];
    return {
      territory: style(activeLayerNames[0]),
      infrastructure: style(activeLayerNames.at(-1)),
      control: style(document.querySelector("#territory-level-control"))
    };
  });
  expect(Math.abs(typography.territory.size - typography.infrastructure.size)).toBeLessThanOrEqual(0.5);
  expect(typography.territory.weight).toBe(typography.infrastructure.weight);
  expect(typography.control.size).toBeLessThan(typography.territory.size);

  await testInfo.attach(`jerarquia-leyenda-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: "image/png"
  });
});

test("panel ciudadano prioriza cifras y conserva la metodología en ayudas accesibles", async ({ page }) => {
  await loadPortal(page);

  await expect(page.locator(".site-topbar-brand strong")).toHaveText("Fundación REDSA");
  await expect(page.locator(".site-topbar-brand small")).toHaveText("Observatorio de Seguridad Vial");
  await expect(page.locator(".citizen-national-info")).toHaveAttribute("data-custom-text", /Fuente:/);
  await expect(page.locator(".citizen-national-meta")).not.toContainText("Fuente:");

  const hierarchy = await page.evaluate(() => {
    const main = getComputedStyle(document.querySelector(".citizen-national-value"));
    const support = getComputedStyle(document.querySelector(".citizen-national-meta"));
    return {
      mainSize: Number.parseFloat(main.fontSize),
      supportSize: Number.parseFloat(support.fontSize),
      supportColor: support.color
    };
  });
  expect(hierarchy.mainSize).toBeGreaterThan(hierarchy.supportSize);
  expect(hierarchy.supportColor).toBeTruthy();
});

test("variable territorial y Siniestros ANT explican los periodos no disponibles", async ({ page }) => {
  await loadPortal(page);
  await page.evaluate(() => {
    window.__redsaAudit.selectVariable("fallecidos_inec_2019");
    window.__redsaAudit.selectYear(2025);
  });
  await expect(page.locator("#legend-territory-items .legend-period-unavailable")).toContainText("No disponible para este periodo");

  await page.evaluate(() => {
    window.__redsaAudit.selectVariable("siniestros_inec_2019");
    window.__redsaAudit.selectYear(2023);
    window.REDSAAntLayer.setActive(true);
  });
  const antLegend = page.locator('[data-legend-layer-id="siniestros_ant"]');
  await expect(antLegend).toContainText("No disponible para este periodo");
  await expect(page.locator("#ant-layer-status")).toContainText("No disponible para este periodo");
});

test("infraestructura usa SVG compartido y conserva la interacción territorial", async ({ page }, testInfo) => {
  await loadPortal(page);
  await page.evaluate(() => window.__redsaAudit.setOverlay("Ciclovías", true));
  await page.waitForFunction(() => window.__redsaAudit.state().osmLayers["Ciclovías"].loaded, null, { timeout: 90_000 });

  const renderer = await page.evaluate(() => {
    const pane = window.geoportalMap.getPane("infraestructuraPane");
    return {
      svgCount: pane.querySelectorAll("svg").length,
      canvasCount: pane.querySelectorAll("canvas").length,
      interactivePaths: pane.querySelectorAll("path.leaflet-interactive").length
    };
  });
  expect(renderer.svgCount).toBe(1);
  expect(renderer.canvasCount).toBe(0);
  expect(renderer.interactivePaths).toBeGreaterThan(0);

  const point = await page.evaluate(() => {
    const layer = window.__redsaAudit.findTerritoryLayer("province", "17");
    const center = layer.getCenter();
    return window.geoportalMap.latLngToContainerPoint(center);
  });
  await page.locator("#legend-close-toggle").click();
  if (testInfo.project.name === "mobile") {
    await expect(page.locator("#right-context-host")).toBeHidden();
    await page.touchscreen.tap(point.x, point.y);
    await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().selectedTerritory)).not.toBeNull();
  } else {
    await page.mouse.move(point.x, point.y);
    await expect(page.locator(".territory-hover-tooltip").last()).toBeVisible();
  }

  expect(await page.evaluate(() => window.__redsaAudit.fireOverlayClick("Ciclovías"))).toBeTruthy();
  await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().selectedTerritory)).not.toBeNull();

  await testInfo.attach(`infraestructura-svg-hover-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: "image/png"
  });
});

test("pantalla grande mantiene el buscador y la leyenda compacta visible", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "La comprobación 1920 px se ejecuta una vez.");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await loadPortal(page);

  await expect(page.locator(".map-search-card")).toBeVisible();
  await expect(page.locator("#map-legend-card")).toBeVisible();
  await expect(page.locator("#right-context-host")).toHaveAttribute("data-active-panel", "none");
  await expect(page.locator("#technical-drawer")).toBeHidden();
  const searchBox = await box(page, ".map-search-card");
  const railBox = await box(page, "#right-tools-rail");
  expect(searchBox.right).toBeLessThan(railBox.left);
  expect(railBox.right).toBeLessThanOrEqual(1920);
});

test("mobile conserva sus paneles off-canvas y barra inferior", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Validación exclusiva del breakpoint móvil.");
  await loadPortal(page);

  await expect(page.locator("#right-tools-rail")).toBeVisible();
  await expect(page.locator("#map-legend-card")).toBeVisible();
  await expect(page.locator("#mobile-year-bar")).toBeVisible();
  await expect(page.locator("#mobile-level-bar")).toBeVisible();
  await expect(page.locator('[data-right-panel="legend"]')).toHaveCount(0);
});

test("mapas base ocupa el panel contextual sin superponerse", async ({ page }, testInfo) => {
  if (testInfo.project.name === "desktop") {
    await page.setViewportSize({ width: 1920, height: 1080 });
  }
  await loadPortal(page);
  await assertBasemapControlHasDedicatedSpace(page);
});

test("mapas base no se superpone en una ventana web angosta", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "La ventana angosta se valida una vez.");
  await page.setViewportSize({ width: 820, height: 800 });
  await loadPortal(page);
  await assertBasemapControlHasDedicatedSpace(page);
});

test("zoom, ubicación y grupos de herramientas son operables en la barra", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const position = {
      coords: {
        latitude: -0.19951,
        longitude: -78.480277,
        accuracy: 12,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: Date.now()
    };
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(success) { setTimeout(() => success(position), 0); },
        watchPosition(success) { setTimeout(() => success(position), 0); return 1; },
        clearWatch() {}
      }
    });
  });
  await loadPortal(page);

  await expect(page.locator("#right-tools-rail .right-tool-group")).toHaveCount(2);
  await expect(page.locator("#right-tools-rail .right-tool-button")).toHaveCount(6);
  const originalZoom = await page.evaluate(() => window.__redsaAudit.state().zoom);
  await page.locator("#map-zoom-in").click();
  await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().zoom)).toBe(originalZoom + 1);
  await page.waitForTimeout(300);
  await page.locator("#map-zoom-out").click();
  await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().zoom)).toBe(originalZoom);

  await page.locator("#map-locate").click();
  await expect(page.locator("#right-tools-status")).toContainText("Ubicación encontrada");
  await expect.poll(() => page.evaluate(() => Math.abs(window.__redsaAudit.state().center.lat - (-0.19951)))).toBeLessThan(0.001);
  await expect.poll(() => page.evaluate(() => Math.abs(window.__redsaAudit.state().center.lng - (-78.480277)))).toBeLessThan(0.001);
  const location = await page.evaluate(() => window.__redsaAudit.state());
  expect(location.zoom).toBeGreaterThanOrEqual(originalZoom);

  const controls = await page.locator("#right-tools-rail .right-tool-button:not(:disabled)").evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height, label: element.getAttribute("aria-label") };
  }));
  expect(controls.every(control => control.width >= 44 && control.height >= 44 && control.label)).toBeTruthy();
  await testInfo.attach(`barra-derecha-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: "image/png"
  });
});

test("ubicación informa cuando el permiso es denegado", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "El manejo de error es común a los tres perfiles.");
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(_success, error) { setTimeout(() => error({ code: 1 }), 0); },
        watchPosition(_success, error) { setTimeout(() => error({ code: 1 }), 0); return 1; },
        clearWatch() {}
      }
    });
  });
  await loadPortal(page);
  await page.locator("#map-locate").click();
  await expect(page.locator("#right-tools-status")).toContainText("No se concedió permiso");
  await expect(page.locator("#map-locate")).toBeEnabled();
});

test("catálogo vive en la barra superior y la marca oficial se muestra legible", async ({ page }) => {
  await loadPortal(page);
  await expect(page.locator("#citizen-panel #btn-catalog")).toHaveCount(0);
  await expect(page.locator("#right-tools-rail #btn-catalog")).toHaveCount(0);
  await expect(page.locator("#site-topbar #btn-catalog")).toHaveCount(1);
  await expect(page.locator(".site-topbar-brand strong")).toHaveText("Fundación REDSA");
  expect(await page.locator("#download-summary-button").evaluate(element => element.hidden)).toBeTruthy();

  await page.locator("#site-topbar-menu-toggle").click();
  await page.locator("#site-topbar #btn-catalog").click();
  await expect(page.locator("#catalog-modal")).toBeVisible();
  await page.locator("#catalog-modal-close").click();
  await page.evaluate(() => window.__redsaAudit.showTerritory("province", "17"));
  expect(await page.locator("#download-summary-button").evaluate(element => element.hidden)).toBeFalsy();
  await expect(page.locator("#download-summary-button")).toBeEnabled();
});

test("Dark Matter activa realce cartográfico sin cambiar el tema de interfaz", async ({ page }, testInfo) => {
  await loadPortal(page);
  await page.locator('[data-right-panel="layers"]').click();
  const options = page.locator(".basemap-control .leaflet-control-layers-base label");
  const dark = options.filter({ hasText: "Dark Matter" });
  const positron = options.filter({ hasText: "Positron" });
  await dark.click();
  await expect(page.locator("body")).toHaveClass(/basemap-dark-matter/);
  await expect(page.locator("body")).toHaveClass(/light-theme/);
  const enhanced = await page.evaluate(() => ({
    territory: getComputedStyle(document.querySelector(".leaflet-territorio-pane")).filter,
    heat: getComputedStyle(document.querySelector(".leaflet-antHeat-pane")).filter,
    infrastructure: getComputedStyle(document.querySelector(".leaflet-infraestructura-pane")).filter,
    event: getComputedStyle(document.querySelector(".leaflet-event-pane")).filter
  }));
  expect(Object.values(enhanced).every(value => value && value !== "none"), JSON.stringify(enhanced)).toBeTruthy();
  await testInfo.attach(`dark-matter-realce-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: "image/png"
  });
  await positron.click();
  await expect(page.locator("body")).not.toHaveClass(/basemap-dark-matter/);
  await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().basemap)).toBe("positron");
});

test("la superficie territorial se oculta solo en zoom profundo y restaura la opacidad", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "La regla cartográfica es común; se valida una vez con capturas.");
  await loadPortal(page);
  await page.evaluate(async () => {
    await window.__redsaAudit.setTerritoryLevelMode("parish");
    await window.__redsaAudit.setZoom(15);
  });
  await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().level)).toBe("parish");
  const normalStyle = await page.evaluate(() => window.__redsaAudit.territoryStyle("parish", "170150"));
  expect(normalStyle).not.toBeNull();
  expect(normalStyle.fillOpacity).toBeGreaterThan(0);
  await expect(page.locator("#territory-surface-auto-hide-note")).toBeHidden();
  await page.locator('[data-right-panel="settings"]').click();
  await page.locator("#territory-opacity-slider").fill("55");
  await page.evaluate(() => window.__redsaAudit.setZoom(17));
  await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().territorySurfaceAutoHidden)).toBeTruthy();
  const deepStyle = await page.evaluate(() => window.__redsaAudit.territoryStyle("parish", "170150"));
  expect(deepStyle.fillOpacity).toBe(0);
  expect(deepStyle.weight).toBeGreaterThan(0);
  await expect(page.locator(".leaflet-territorio-pane")).toHaveCSS("opacity", "0.55");
  await expect(page.locator("#territory-surface-auto-hide-note")).toBeVisible();
  await testInfo.attach("barrio-zoom-17-sin-relleno", { body: await page.screenshot(), contentType: "image/png" });

  await page.evaluate(() => window.__redsaAudit.setZoom(15));
  await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().territorySurfaceAutoHidden)).toBeFalsy();
  const restoredStyle = await page.evaluate(() => window.__redsaAudit.territoryStyle("parish", "170150"));
  expect(restoredStyle.fillOpacity).toBeGreaterThan(0);
  await expect(page.locator(".leaflet-territorio-pane")).toHaveCSS("opacity", "0.55");
  await expect(page.locator("#territory-surface-auto-hide-note")).toBeHidden();
});
