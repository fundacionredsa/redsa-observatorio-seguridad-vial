import { test, expect } from "@playwright/test";

const INSTITUTIONAL_COPY = "Este es el geoportal del Observatorio Ciudadano de Seguridad Vial y Movilidad Sostenible, una iniciativa independiente de la sociedad civil impulsada por Fundación REDSA. Reúne y explica datos oficiales para que cualquier persona pueda conocer y comparar la seguridad vial de su territorio.";

async function loadPortal(page) {
  await page.addInitScript(() => {
    localStorage.setItem("redsa_tour_v2_visto", "true");
    localStorage.setItem("redsa_tour_seen", "true");
    localStorage.setItem("redsa_light_theme", "true");
  });
  await page.goto("index.html");
  await page.waitForFunction(() => Boolean(window.__redsaAudit && window.__redsaExperienceAudit));
}

async function openCitizen(page) {
  await page.evaluate(() => window.setMobilePanel("citizen", true));
  await expect(page.locator("#citizen-panel")).toHaveAttribute("aria-hidden", "false");
}

test("panel ciudadano comparte la paleta oscura y conserva intacto el tema claro", async ({ page }) => {
  await loadPortal(page);
  await openCitizen(page);

  const readCitizenTheme = () => page.evaluate(() => {
    const styleOf = selector => {
      const styles = getComputedStyle(document.querySelector(selector));
      return {
        background: styles.backgroundColor,
        border: styles.borderColor,
        color: styles.color
      };
    };
    const panelStyles = getComputedStyle(document.querySelector(".citizen-panel"));
    return {
      isLight: document.body.classList.contains("light-theme"),
      outsidePanelPublicInk: getComputedStyle(document.querySelector(".institutional-dialog"))
        .getPropertyValue("--public-ink").trim(),
      variables: {
        surface: panelStyles.getPropertyValue("--public-surface").trim(),
        ink: panelStyles.getPropertyValue("--public-ink").trim(),
        line: panelStyles.getPropertyValue("--public-line").trim(),
        action: panelStyles.getPropertyValue("--public-action").trim(),
        bgGlass: panelStyles.getPropertyValue("--bg-glass").trim(),
        textPrimary: panelStyles.getPropertyValue("--text-primary").trim(),
        borderGlass: panelStyles.getPropertyValue("--border-glass").trim(),
        accent: panelStyles.getPropertyValue("--accent").trim()
      },
      panel: styleOf(".citizen-panel"),
      badge: styleOf(".citizen-national-badge"),
      input: styleOf(".citizen-search-input"),
      action: styleOf(".citizen-action:not(.citizen-action-primary)"),
      primaryAction: styleOf(".citizen-action-primary")
    };
  });

  const lightTheme = await readCitizenTheme();
  expect(lightTheme.isLight).toBeTruthy();

  await page.locator("#btn-theme-toggle").click();
  await expect(page.locator("body")).not.toHaveClass(/light-theme/);
  const darkTheme = await readCitizenTheme();
  expect(darkTheme.variables.surface).toBe(darkTheme.variables.bgGlass);
  expect(darkTheme.variables.ink).toBe(darkTheme.variables.textPrimary);
  expect(darkTheme.variables.line).toBe(darkTheme.variables.borderGlass);
  expect(darkTheme.variables.action).toBe(darkTheme.variables.accent);
  expect(darkTheme.outsidePanelPublicInk).toBe(darkTheme.variables.textPrimary);
  expect(darkTheme.outsidePanelPublicInk).not.toBe(lightTheme.outsidePanelPublicInk);
  expect(darkTheme.panel.background).not.toBe(lightTheme.panel.background);
  expect(darkTheme.panel.color).not.toBe(lightTheme.panel.color);
  expect(darkTheme.badge.background).not.toBe(lightTheme.badge.background);
  expect(darkTheme.input.background).not.toBe(lightTheme.input.background);
  expect(darkTheme.action.background).not.toBe(lightTheme.action.background);
  expect(darkTheme.primaryAction.background).not.toBe(lightTheme.primaryAction.background);

  await page.locator("#btn-theme-toggle").click();
  await expect(page.locator("body")).toHaveClass(/light-theme/);
  const restoredLightTheme = await readCitizenTheme();
  expect(restoredLightTheme.isLight).toBeTruthy();
  expect(restoredLightTheme.variables).toEqual(lightTheme.variables);
  expect(restoredLightTheme.panel).toEqual(lightTheme.panel);
  expect(restoredLightTheme.badge).toEqual(lightTheme.badge);
  expect(restoredLightTheme.input).toEqual(lightTheme.input);
  expect(restoredLightTheme.action.background).toBe(lightTheme.action.background);
  expect(restoredLightTheme.primaryAction).toEqual(lightTheme.primaryAction);
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
  const rankingTableDark = await readStyle("#institutional-modal .ranking-table-wrap");
  expect(rankingDark.background).not.toBe(rankingLight.background);
  expect(rankingDark.color).not.toBe(rankingLight.color);
  expect(rankingTableDark.background).toBe(rankingDark.background);
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
  await openCitizen(page);
  const input = page.locator("#territory-search-input");
  await input.fill("Quito — Pichincha");
  await input.press("Enter");
  await expect.poll(() => page.evaluate(() => window.__redsaAudit.state().selectedTerritory)).toEqual({
    level: "canton",
    code: "1701"
  });
}

test("panel ciudadano conserva identidad completa y un resumen breve", async ({ page }, testInfo) => {
  await loadPortal(page);
  await openCitizen(page);

  await expect(page.locator(".citizen-brand h1")).toHaveText("Observatorio de Seguridad Vial y Movilidad Sostenible");
  await expect(page.locator(".citizen-intro-prompt")).toHaveText(INSTITUTIONAL_COPY);

  await selectQuito(page);
  const summary = page.locator("#citizen-summary");
  await expect(page.locator("#territory-sidebar")).toHaveAttribute("aria-hidden", "true");
  await expect(summary).toContainText("DISTRITO METROPOLITANO DE QUITO");
  await expect(summary).toContainText("Siniestros de tránsito reportados");
  await expect(summary).toContainText("Referencia nacional");
  await expect(summary).not.toContainText("Tendencia histórica");
  await expect(summary).not.toContainText("Códigos territoriales");
  await expect(summary).not.toContainText("Histórico de años completos");

  await testInfo.attach(`panel-ciudadano-simple-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: "image/png"
  });
});

test("análisis tiene volver independiente, tema completo y scroll hasta el final", async ({ page }, testInfo) => {
  await loadPortal(page);
  await selectQuito(page);

  const body = page.locator("body");
  const citizenWasOpen = await body.evaluate(element => element.classList.contains("citizen-panel-open"));
  await page.locator("#open-analysis-button").click();
  await expect(body).toHaveClass(/mobile-sidebar-open/);
  await expect(page.locator("#territory-sidebar")).toHaveAttribute("aria-hidden", "false");
  expect(await body.evaluate(element => element.classList.contains("citizen-panel-open"))).toBe(citizenWasOpen);
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

  await page.locator("#mobile-sidebar-close").click();
  await expect(body).not.toHaveClass(/mobile-sidebar-open/);
  await openCitizen(page);
  await page.locator("#btn-theme-toggle").click();
  await expect(body).not.toHaveClass(/light-theme/);
  await page.locator("#open-analysis-button").click();
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

  await page.locator("#mobile-sidebar-close").click();
  await expect(body).not.toHaveClass(/mobile-sidebar-open/);
  expect(await body.evaluate(element => element.classList.contains("citizen-panel-open"))).toBe(citizenWasOpen);
});

test("Datos y capas no conserva el contenedor Leaflet vacío que parecía un buscador", async ({ page }) => {
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
  await page.locator("#open-analysis-button").click();
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

  const methodButton = page.locator(".analysis-method-info");
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
  expect(calloutStyle.borderLeftWidth).toBeGreaterThanOrEqual(4);

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
    expect(Math.abs(sheet.bottom - page.viewportSize().height)).toBeLessThanOrEqual(1);
    expect(sheet.handlePointerEvents).toBe("none");
  } else {
    await expect(handle).toBeHidden();
  }
  await expect(page.locator("#mobile-sidebar-close")).toHaveCount(1);
  await expect(page.locator("#citizen-panel-visibility-toggle")).toHaveCount(1);
});

test("breadcrumb usa exactamente provincia, cantón y parroquia seleccionados", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "La ruta territorial completa se valida una vez en desktop.");
  await loadPortal(page);

  await page.evaluate(async () => {
    await window.__redsaAudit.setTerritoryLevelMode("province");
    await window.__redsaAudit.showTerritory("province", "17");
  });
  await page.locator("#open-analysis-button").click();
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
