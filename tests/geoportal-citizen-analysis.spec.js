import { test, expect } from "@playwright/test";

const INSTITUTIONAL_COPY = "Este es el geoportal del Observatorio Ciudadano de Seguridad Vial y Movilidad Sostenible, una iniciativa independiente de la sociedad civil impulsada por Fundación REDSA. Reúne y explica datos oficiales para que cualquier persona pueda conocer y comparar la seguridad vial de su territorio.";

async function loadPortal(page) {
  await page.addInitScript(() => {
    localStorage.setItem("redsa_tour_v2_visto", "true");
    localStorage.setItem("redsa_tour_seen", "true");
    localStorage.setItem("redsa_light_theme", "true");
  });
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
  await expect(page.locator("#loader")).toBeHidden({ timeout: 90_000 });
}

async function exposeTopbarAction(page, selector) {
  const action = page.locator(selector);
  if (!(await action.isVisible())) {
    await page.locator("#site-topbar-menu-toggle").click();
  }
  await expect(action).toBeVisible();
  return action;
}

test("buscador y leyenda comparten la paleta oscura y conservan el tema claro", async ({ page }) => {
  await loadPortal(page);
  await expect(page.locator(".citizen-national-reference")).toBeVisible();

  const readCitizenTheme = () => page.evaluate(() => {
    const styleOf = selector => {
      const el = document.querySelector(selector);
      if (!el) return { background: "", border: "", color: "" };
      const styles = getComputedStyle(el);
      return {
        background: styles.backgroundColor,
        border: styles.borderColor,
        color: styles.color
      };
    };
    const panelStyles = getComputedStyle(document.querySelector(".map-search-card"));
    const bodyStyles = getComputedStyle(document.body);
    return {
      isLight: document.body.classList.contains("light-theme"),
      outsidePanelPublicInk: getComputedStyle(document.querySelector(".institutional-dialog"))
        .getPropertyValue("--public-ink").trim(),
      variables: {
        surface: panelStyles.backgroundColor,
        ink: bodyStyles.getPropertyValue("--text-primary").trim(),
        line: bodyStyles.getPropertyValue("--border-glass").trim(),
        action: bodyStyles.getPropertyValue("--accent").trim(),
        bgGlass: bodyStyles.getPropertyValue("--bg-glass").trim(),
        textPrimary: bodyStyles.getPropertyValue("--text-primary").trim(),
        borderGlass: bodyStyles.getPropertyValue("--border-glass").trim(),
        accent: bodyStyles.getPropertyValue("--accent").trim()
      },
      panel: styleOf(".map-search-card"),
      badge: styleOf(".citizen-national-reference"),
      input: styleOf(".citizen-search-input"),
      legend: styleOf(".map-legend-card")
    };
  });

  const lightTheme = await readCitizenTheme();
  expect(lightTheme.isLight).toBeTruthy();

  await (await exposeTopbarAction(page, "#btn-theme-toggle")).click();
  await expect(page.locator("body")).not.toHaveClass(/light-theme/);
  const darkTheme = await readCitizenTheme();
  expect(darkTheme.variables.ink).toBe(darkTheme.variables.textPrimary);
  expect(darkTheme.variables.line).toBe(darkTheme.variables.borderGlass);
  expect(darkTheme.variables.action).toBe(darkTheme.variables.accent);
  expect(darkTheme.legend.background).not.toBe(lightTheme.legend.background);

  await (await exposeTopbarAction(page, "#btn-theme-toggle")).click();
  await expect(page.locator("body")).toHaveClass(/light-theme/);
  const restoredLightTheme = await readCitizenTheme();
  expect(restoredLightTheme.isLight).toBeTruthy();
  expect(restoredLightTheme.variables).toEqual(lightTheme.variables);
  expect(restoredLightTheme.panel).toEqual(lightTheme.panel);
  expect(restoredLightTheme.badge).toEqual(lightTheme.badge);
  expect(restoredLightTheme.input).toEqual(lightTheme.input);
  expect(restoredLightTheme.legend).toEqual(lightTheme.legend);
});

test("Ranking y Catálogo comparten el tema oscuro y restauran su apariencia clara", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "La paleta completa de ambos modales se valida una vez en desktop.");
  await loadPortal(page);

  const readStyle = selector => page.locator(selector).first().evaluate(element => {
    const styles = getComputedStyle(element);
    return { background: styles.backgroundColor, color: styles.color, border: styles.borderColor };
  });
  const open = async selector => {
    await page.evaluate(buttonSelector => document.querySelector(buttonSelector)?.click(), selector);
  };

  await open("#open-institutional-button");
  await expect(page.locator("#institutional-modal")).toBeVisible();
  const rankingLight = await readStyle("#institutional-modal .institutional-dialog");
  await page.locator("#institutional-modal-close").click();

  await open("#btn-catalog");
  await expect(page.locator("#catalog-modal")).toBeVisible();
  await expect(page.locator("#catalog-modal .catalog-item").first()).toBeVisible();
  const catalogLight = await readStyle("#catalog-modal .institutional-dialog");
  await page.locator("#catalog-modal-close").click();

  await page.evaluate(() => document.querySelector("#btn-theme-toggle")?.click());
  await expect(page.locator("body")).not.toHaveClass(/light-theme/);

  await open("#open-institutional-button");
  const rankingDark = await readStyle("#institutional-modal .institutional-dialog");
  expect(rankingDark.color).not.toBe(rankingLight.color);
  await page.locator("#institutional-modal-close").click();

  await open("#btn-catalog");
  const catalogDark = await readStyle("#catalog-modal .institutional-dialog");
  const catalogCardDark = await readStyle("#catalog-modal .catalog-item");
  expect(catalogDark.background).not.toBe(catalogLight.background);
  expect(catalogDark.color).not.toBe(catalogLight.color);
  expect(catalogCardDark.color).toBe(catalogDark.color);
  await page.locator("#catalog-modal-close").click();

  await page.evaluate(() => document.querySelector("#btn-theme-toggle")?.click());
  await open("#btn-catalog");
  expect(await readStyle("#catalog-modal .institutional-dialog")).toEqual(catalogLight);
});

async function selectQuito(page) {
  const input = page.locator("#territory-search-input");
  await input.fill("Quito — Pichincha");
  await input.press("Enter");
  await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().selectedTerritory)).toEqual({
    level: "canton",
    code: "1701"
  });
}

test("la identidad, introducción y resumen territorial permanecen accesibles sin duplicarse", async ({ page }, testInfo) => {
  await loadPortal(page);
  await expect(page.locator(".site-topbar-brand")).toContainText("Observatorio de Seguridad Vial");
  await (await exposeTopbarAction(page, "#open-institutional-button")).click();
  await page.locator("#institutional-tab-trust").click();
  await expect(page.locator(".institutional-intro")).toHaveText(INSTITUTIONAL_COPY);
  await page.locator("#institutional-modal-close").click();
  await selectQuito(page);
  const summary = page.locator("#legend-summary");
  await expect(page.locator("#territory-sidebar")).toHaveAttribute("aria-hidden", "true");
  await expect(summary).toContainText("DISTRITO METROPOLITANO DE QUITO");
  await expect(summary).toContainText("Siniestros de tránsito reportados");
  await expect(summary).toContainText("Referencia nacional");
  await expect(summary).not.toContainText("Tendencia histórica");
});

test("análisis tiene volver independiente, tema completo y scroll hasta el final", async ({ page }, testInfo) => {
  await loadPortal(page);
  await selectQuito(page);

  const body = page.locator("body");
  await page.evaluate(() => document.querySelector("#right-tab-analysis")?.click());
  await expect(page.locator("#territory-sidebar")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#mobile-sidebar-close")).toContainText("Volver");
  await expect(page.locator("#inec-detailed-stats")).not.toHaveAttribute("open", "");
  await expect(page.locator("#complementary-indicators-disclosure")).not.toHaveAttribute("open", "");

  const scrollState = await page.locator("#territory-sidebar").evaluate(element => {
    element.scrollTop = element.scrollHeight;
    return {
      top: element.scrollTop,
      client: element.clientHeight,
      height: element.scrollHeight,
      horizontalOverflow: element.scrollWidth - element.clientWidth
    };
  });
  expect(scrollState.top + scrollState.client).toBeGreaterThanOrEqual(scrollState.height - 2);
  expect(scrollState.horizontalOverflow).toBeLessThanOrEqual(1);
  await page.locator("#glossary-accordion-btn").scrollIntoViewIfNeeded();
  await expect(page.locator("#glossary-accordion-btn")).toBeInViewport();

  const lightColors = await page.locator("#territory-sidebar").evaluate(element => {
    const styles = getComputedStyle(element);
    return { background: styles.backgroundColor, color: styles.color };
  });

  await testInfo.attach(`analisis-claro-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: "image/png"
  });

  if (testInfo.project.name === "mobile") {
    await page.locator("#mobile-sidebar-close").click();
  } else {
    await page.locator("#right-tab-analysis").click();
  }
  await expect(page.locator("#right-context-host")).toBeHidden();
  await page.evaluate(() => document.querySelector("#btn-theme-toggle")?.click());
  await expect(body).not.toHaveClass(/light-theme/);
  await page.locator("#right-tab-analysis").click();
  const darkColors = await page.locator("#territory-sidebar").evaluate(element => {
    const styles = getComputedStyle(element);
    return { background: styles.backgroundColor, color: styles.color };
  });
  expect(darkColors.background).not.toBe(lightColors.background);
  expect(darkColors.color).not.toBe(lightColors.color);

  await testInfo.attach(`analisis-oscuro-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: "image/png"
  });

  if (testInfo.project.name === "mobile") {
    await page.locator("#mobile-sidebar-close").click();
  } else {
    await page.locator("#right-tab-analysis").click();
  }
  await expect(page.locator("#right-context-host")).toBeHidden();
});

test("Datos y capas no conserva el contenedor Leaflet vacío que parecía un buscador", async ({ page }, testInfo) => {
  await loadPortal(page);
  await page.locator('[data-right-panel="layers"]').click();
  await expect(page.locator("#technical-drawer")).toBeVisible();
  await expect(page.locator("#variable-controls-slot")).toHaveCount(0);
  await expect(page.locator(".map-selector-control")).toHaveCount(0);
  await expect(page.locator('#technical-drawer input[type="search"], #technical-drawer input[type="text"]')).toHaveCount(0);
  await expect(page.locator("#layers-card")).toBeVisible();
});

test("fase 4 usa la marca real y presenta análisis, callouts y serie por tipo", async ({ page }, testInfo) => {
  await loadPortal(page);
  const logo = page.locator(".site-topbar-brand-mark");
  await expect(logo).toHaveAttribute("src", "assets/img/redsa-isotipo-oficial.png");
  await expect(logo).toHaveAttribute("alt", "Isotipo de Fundación REDSA");
  await expect(page.locator(".site-topbar-brand-mark:not(img)")).toHaveCount(0);
  const logoState = await logo.evaluate(element => ({
    naturalWidth: element.naturalWidth,
    naturalHeight: element.naturalHeight,
    background: getComputedStyle(element).backgroundColor
  }));
  expect(logoState.naturalWidth).toBe(1222);
  expect(logoState.naturalHeight).toBe(1280);
  expect(logoState.background).toBe("rgba(0, 0, 0, 0)");

  await selectQuito(page);
  await page.evaluate(() => document.querySelector("#right-tab-analysis")?.click());
  await expect(page.locator("#territory-breadcrumb")).toContainText("PICHINCHA");
  await expect(page.locator("#territory-breadcrumb")).toContainText("DISTRITO METROPOLITANO DE QUITO");
  await expect(page.locator("#siniestros-rate-detail-row")).toHaveClass(/analysis-hero-stat/);
  await expect(page.locator("#info-fallecidos-sppat").locator("xpath=..")).toHaveClass(/analysis-hero-stat/);
  await expect(page.locator("#info-fallecidos-inec").locator("xpath=..")).toHaveClass(/analysis-hero-stat/);

  const chartViews = page.locator("#historical-chart-view-controls");
  await expect(chartViews).toBeVisible();
  await expect(chartViews.locator("button")).toHaveText(["Totales", "Por tipo"]);
  await chartViews.locator('[data-historical-chart-view="types"]').click();
  await expect(chartViews.locator('[data-historical-chart-view="types"]')).toHaveAttribute("aria-pressed", "true");
  const typeSeriesAudit = await page.evaluate(() => {
    const yearIndex = historicoChart.data.labels.indexOf("2024");
    const dataset = historicoChart.data.datasets.find(entry => entry.label !== "Resto de tipos");
    return {
      canvasCount: document.querySelectorAll("#chart-historico").length,
      datasetCount: historicoChart.data.datasets.length,
      label: dataset.label,
      rendered: dataset.data[yearIndex],
      source: selectedTerritory.props.inec_por_clase["2024"][dataset.label]
    };
  });
  expect(typeSeriesAudit.canvasCount).toBe(1);
  expect(typeSeriesAudit.datasetCount).toBeGreaterThan(1);
  expect(typeSeriesAudit.rendered).toBe(typeSeriesAudit.source);

  const methodButton = page.locator(".analysis-method-info").first();
  const expectedCalloutText = await methodButton.evaluate(element =>
    `${element.dataset.sigla}: ${element.dataset.customText}`
  );
  await methodButton.click();
  const popover = page.locator("#sigla-popover");
  await expect(popover).toBeVisible();
  await expect(popover.locator(".sigla-popover-copy")).toHaveText(expectedCalloutText);
  await expect(popover.locator(".sigla-popover-icon")).toHaveAttribute("aria-hidden", "true");
  const calloutStyle = await popover.evaluate(element => ({
    display: getComputedStyle(element).display,
    borderLeftWidth: parseFloat(getComputedStyle(element).borderLeftWidth)
  }));
  expect(calloutStyle.display).toBe("grid");
  expect(calloutStyle.borderLeftWidth).toBeGreaterThanOrEqual(1);

  const isMobile = (page.viewportSize()?.width || 0) <= 768;
  const handle = page.locator(".mobile-sidebar-drag-handle");
  if (isMobile) {
    await expect(handle).toBeVisible();
    await expect(handle).toHaveAttribute("aria-hidden", "true");
    const sheet = await page.locator("#territory-sidebar").evaluate(element => {
      const rect = element.getBoundingClientRect();
      const handleStyles = getComputedStyle(document.querySelector(".mobile-sidebar-drag-handle"));
      return { left: rect.left, right: rect.right, bottom: rect.bottom, handlePointerEvents: handleStyles.pointerEvents };
    });
    expect(sheet.left).toBeGreaterThanOrEqual(0);
    expect(sheet.right).toBeLessThanOrEqual(page.viewportSize().width);
    expect(sheet.bottom).toBeLessThanOrEqual(page.viewportSize().height);
    expect(sheet.handlePointerEvents).toBe("none");
  } else {
    await expect(handle).toBeHidden();
  }
  await expect(page.locator("#mobile-sidebar-close")).toHaveCount(1);
  await expect(page.locator("#citizen-panel-visibility-toggle")).toHaveCount(0);
});

test("breadcrumb usa exactamente provincia, cantón y parroquia seleccionados", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "La ruta territorial completa se valida una vez en desktop.");
  await loadPortal(page);

  await page.evaluate(async () => {
    await window.__redsaAudit.setTerritoryLevelMode("province");
    await window.__redsaAudit.showTerritory("province", "17");
  });
  await page.locator("#right-tab-analysis").click();
  await expect(page.locator("#territory-breadcrumb")).toHaveText("PICHINCHA");
  await expect(page.locator("#cabecera-warning-box")).toHaveText("Este dato se calcula sumando los cantones de la provincia; algunos años pueden tener información incompleta.");
  await expect(page.locator("#cabecera-warning-box")).not.toContainText(".geojson");

  await page.evaluate(async () => {
    await window.__redsaAudit.setTerritoryLevelMode("canton");
    await window.__redsaAudit.showTerritory("canton", "1701");
  });
  await expect(page.locator("#territory-breadcrumb")).toHaveText("PICHINCHA›DISTRITO METROPOLITANO DE QUITO");

  await page.evaluate(async () => {
    await window.__redsaAudit.setTerritoryLevelMode("parish");
    await window.__redsaAudit.showTerritory("parish", "170151");
  });
  await expect(page.locator("#territory-breadcrumb")).toHaveText("PICHINCHA›DISTRITO METROPOLITANO DE QUITO›ALANGASÍ");
});
