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

test("la barra derecha abre una sola vista y la leyenda es el estado inicial", async ({ page }) => {
  await loadPortal(page);

  const citizenToggle = page.locator("#citizen-panel-visibility-toggle");
  await expect(citizenToggle.locator("span")).toHaveCount(0);
  expect((await citizenToggle.textContent()).trim()).toBe("");

  const rail = page.locator("#right-tools-rail");
  const legendButton = page.locator('[data-right-panel="legend"]');
  const layersButton = page.locator('[data-right-panel="layers"]');
  const basemapButton = page.locator('[data-right-panel="basemap"]');
  const viewport = page.viewportSize();

  await expect(rail).toBeVisible();
  await expect(legendButton).toHaveAttribute("aria-expanded", "true");
  await expect(layersButton).toHaveAttribute("aria-expanded", "false");
  await expect(basemapButton).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#legend-context-panel")).toBeVisible();
  await expect(page.locator("#technical-drawer")).toBeHidden();
  await expect(page.locator("#basemap-context-panel")).toBeHidden();

  const openLegend = await box(page, "#right-context-host");
  expect(openLegend.left).toBeGreaterThanOrEqual(0);
  expect(openLegend.right).toBeLessThanOrEqual(viewport.width);
  expect(openLegend.top).toBeGreaterThanOrEqual(0);
  expect(openLegend.bottom).toBeLessThanOrEqual(viewport.height);

  await layersButton.click();
  await expect(page.locator("#technical-drawer")).toBeVisible();
  await expect(page.locator("#legend-context-panel")).toBeHidden();
  await basemapButton.click();
  await expect(page.locator("#basemap-context-panel")).toBeVisible();
  await expect(page.locator("#technical-drawer")).toBeHidden();
  await basemapButton.press("ArrowUp");
  await expect(legendButton).toBeFocused();
  await legendButton.click();
  await expect(page.locator("#legend-context-panel")).toBeVisible();
  await legendButton.click();
  await expect(page.locator("#right-context-host")).toBeHidden();
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
  await expect(card.locator(".layers-card-section")).toHaveCount(3);
  await expect(card).toContainText("Capas del mapa");

  for (const disclosure of [variables, events, infrastructure]) {
    await expect(disclosure).not.toHaveAttribute("open", "");
  }

  await variables.locator("summary").click();
  await expect(variables).toHaveAttribute("open", "");
  await expect(page.locator("#territory-opacity-control")).toBeVisible();
  await expect(page.locator("#territory-opacity-label")).toContainText("Siniestros de tránsito reportados");
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
  await page.locator('[data-right-panel="basemap"]').click();
  const host = page.locator("#right-context-host");
  const rail = page.locator("#right-tools-rail");
  const basemap = page.locator(".basemap-control");

  await expect(host).toBeVisible();
  await expect(basemap).toBeVisible();
  await expect(basemap).toHaveAttribute("aria-label", "Seleccionar mapa base");
  expect(await basemap.evaluate(element => element.parentElement?.id)).toBe("basemap-context-slot");

  const panel = await box(page, "#right-context-host");
  const railBox = await box(page, "#right-tools-rail");
  const zoom = await box(page, ".leaflet-control-zoom");
  expect(panel.left).toBeGreaterThanOrEqual(0);
  expect(panel.right).toBeLessThanOrEqual(viewport.width);
  expect(intersects(panel, railBox)).toBeFalsy();
  expect(intersects(panel, zoom)).toBeFalsy();
  expect(intersects(railBox, zoom)).toBeFalsy();
  const basemapOptions = basemap.locator(".leaflet-control-layers-base label");
  await expect(basemapOptions).toHaveCount(4);
  await expect(basemapOptions.first()).toBeVisible();

  const satelliteOption = basemapOptions.filter({ hasText: "Esri World Imagery" });
  await expect(satelliteOption).toHaveCount(1);
  await satelliteOption.click();
  await expect(satelliteOption.locator("input")).toBeChecked();

  return { panel, rail: railBox, zoom };
}

test("panel ciudadano web conserva estado y no compite con la ficha territorial", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "La experiencia off-canvas móvil se cubre por separado.");
  await loadPortal(page);

  const viewport = page.viewportSize();
  const body = page.locator("body");
  const citizen = page.locator("#citizen-panel");
  const citizenToggle = page.locator("#citizen-panel-visibility-toggle");
  const sidebar = page.locator("#territory-sidebar");
  const search = page.locator("#territory-search-input");

  await expect(citizenToggle).toBeVisible();
  await expect(page.locator("#legend-context-panel")).toBeVisible();

  if (viewport.width < 1280) {
    await expect(body).not.toHaveClass(/citizen-panel-open/);
    await expect(citizen).toHaveAttribute("aria-hidden", "true");
  } else {
    await expect(body).toHaveClass(/citizen-panel-open/);
    await expect(citizen).toHaveAttribute("aria-hidden", "false");
    await citizenToggle.click();
  }

  await expect(body).not.toHaveClass(/citizen-panel-open/);
  await expect.poll(async () => (await box(page, "#citizen-panel")).right).toBeLessThan(0);
  await citizenToggle.click();
  await expect(body).toHaveClass(/citizen-panel-open/);
  await expect.poll(async () => (await box(page, "#citizen-panel")).left).toBeGreaterThanOrEqual(19);
  await expect.poll(async () => (await box(page, "#citizen-panel-visibility-toggle")).left).toBeGreaterThanOrEqual(409);

  await search.fill("Cayambe");
  await citizenToggle.click();
  await expect(body).not.toHaveClass(/citizen-panel-open/);
  await expect(search).toHaveValue("Cayambe");
  await citizenToggle.click();
  await expect(search).toHaveValue("Cayambe");

  await search.press("Tab");
  await expect(body).toHaveClass(/mobile-sidebar-open/);
  await expect(body).not.toHaveClass(/citizen-panel-open/);
  await expect(sidebar).toHaveAttribute("aria-hidden", "false");
  await expect(citizen).toHaveAttribute("aria-hidden", "true");
  await expect.poll(async () => page.evaluate(() => window.__redsaAudit.state().selectedTerritory)).toEqual({
    level: "canton",
    code: "1702"
  });
  const resolvedSearchValue = await search.inputValue();
  await expect.poll(async () => (await box(page, "#citizen-panel")).right).toBeLessThan(0);
  await expect.poll(async () => (await box(page, "#territory-sidebar")).left).toBeGreaterThanOrEqual(0);

  const toggleWhileSidebarOpen = await box(page, "#citizen-panel-visibility-toggle");
  const sidebarOpenBox = await box(page, "#territory-sidebar");
  expect(toggleWhileSidebarOpen.left).toBeGreaterThanOrEqual(sidebarOpenBox.right - 1);
  expect(toggleWhileSidebarOpen.right).toBeLessThanOrEqual(viewport.width);

  await citizenToggle.click();
  await expect(body).toHaveClass(/citizen-panel-open/);
  await expect(body).not.toHaveClass(/mobile-sidebar-open/);
  await expect(search).toHaveValue(resolvedSearchValue);

  await citizenToggle.focus();
  await citizenToggle.press("Enter");
  await expect(body).not.toHaveClass(/citizen-panel-open/);
  await citizenToggle.press("Enter");
  await expect(body).toHaveClass(/citizen-panel-open/);
});

test("ficha territorial conserva una medida legible y la escala ocupa el centro inferior", async ({ page }, testInfo) => {
  await loadPortal(page);
  await page.evaluate(async () => {
    await window.__redsaAudit.setZoom(9);
    await window.__redsaAudit.showTerritory("canton", "1701");
  });

  const card = page.locator("#demographic-hover-card");
  await expect(card).toBeVisible();
  const citizenToggle = page.locator("#citizen-panel-visibility-toggle");
  const viewport = page.viewportSize();

  const measure = async () => {
    const cardBox = await box(page, "#demographic-hover-card");
    const scaleBox = await box(page, ".road-scale-control");
    const attributionBox = await box(page, ".leaflet-control-attribution");
    const legendBox = await box(page, ".legend-panel");
    const maxWidth = await card.evaluate(element => Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--perfil-card-max-width")
    ));
    return { cardBox, scaleBox, attributionBox, legendBox, maxWidth };
  };

  if (testInfo.project.name !== "mobile") {
    if (await citizenToggle.getAttribute("aria-expanded") !== "true") {
      await citizenToggle.click();
      await page.waitForTimeout(650);
    }
    const open = await measure();
    await testInfo.attach(`perfil-${testInfo.project.name}-panel-visible`, {
      body: await page.screenshot(),
      contentType: "image/png"
    });

    await citizenToggle.click();
    await page.waitForTimeout(650);
    const hidden = await measure();
    await testInfo.attach(`perfil-${testInfo.project.name}-panel-oculto`, {
      body: await page.screenshot(),
      contentType: "image/png"
    });

    expect(open.cardBox.width).toBeLessThanOrEqual(open.maxWidth + 1);
    expect(hidden.cardBox.width).toBeLessThanOrEqual(hidden.maxWidth + 1);
    expect(Math.abs(hidden.cardBox.width - hidden.maxWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(open.cardBox.left - hidden.cardBox.left)).toBeGreaterThan(20);
    if (open.cardBox.width >= open.maxWidth - 1) {
      expect(Math.abs(open.cardBox.width - hidden.cardBox.width)).toBeLessThanOrEqual(1);
    } else {
      expect(intersects(open.cardBox, open.legendBox)).toBeFalsy();
    }
  } else {
    await testInfo.attach("perfil-mobile", {
      body: await page.screenshot(),
      contentType: "image/png"
    });
  }

  const geometry = await measure();
  const scaleCenter = (geometry.scaleBox.left + geometry.scaleBox.right) / 2;
  expect(Math.abs(scaleCenter - viewport.width / 2)).toBeLessThanOrEqual(1);
  expect(intersects(geometry.cardBox, geometry.scaleBox)).toBeFalsy();
  expect(intersects(geometry.scaleBox, geometry.attributionBox)).toBeFalsy();
  expect(intersects(geometry.scaleBox, geometry.legendBox)).toBeFalsy();
  if (testInfo.project.name === "mobile") {
    const mobileCitizenToggleBox = await box(page, "#mobile-citizen-toggle");
    expect(intersects(geometry.scaleBox, mobileCitizenToggleBox)).toBeFalsy();
  }
  await expect(page.locator(".road-scale-control").locator("xpath=..")).toHaveClass(/leaflet-center/);
});

test("panel técnico mantiene orden global y propósito explícito del año", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "El orden móvil se valida dentro de su drawer.");
  await loadPortal(page);
  await page.locator('[data-right-panel="layers"]').click();

  const order = await page.evaluate(() => {
    const top = selector => document.querySelector(selector).getBoundingClientRect().top;
    return {
      timeline: top(".timeline-control"),
      period: top(".period-mode-control"),
      level: top("#territory-level-control"),
      variables: top("#variable-disclosure"),
      events: top("#event-layer-disclosure"),
      infrastructure: top("#infrastructure-disclosure")
    };
  });

  expect(order.timeline, JSON.stringify(order)).toBeLessThan(order.period);
  expect(order.period, JSON.stringify(order)).toBeLessThan(order.level);
  expect(order.level, JSON.stringify(order)).toBeLessThan(order.variables);
  expect(order.variables, JSON.stringify(order)).toBeLessThan(order.events);
  expect(order.events, JSON.stringify(order)).toBeLessThan(order.infrastructure);
  await expect(page.locator(".timeline-control")).toContainText("Año de los datos mostrados");
  await expect(page.locator(".timeline-help")).toHaveText("Mueve el control para ver los datos de cada año.");
  await expect(page.locator("#map-year-slider")).toHaveAttribute("aria-label", "Año de los datos mostrados");
});

test("pantalla grande abre el panel ciudadano y mantiene la leyenda como vista derecha inicial", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "La comprobación 1920 px se ejecuta una vez.");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await loadPortal(page);

  await expect(page.locator("body")).toHaveClass(/citizen-panel-open/);
  await expect(page.locator("#citizen-panel")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#legend-context-panel")).toBeVisible();
  await expect(page.locator("#technical-drawer")).toBeHidden();
  const citizenBox = await box(page, "#citizen-panel");
  const rightPanelBox = await box(page, "#right-context-host");
  expect(citizenBox.right).toBeLessThan(rightPanelBox.left);
  expect(rightPanelBox.right).toBeLessThan(1920);
});

test("mobile conserva sus paneles off-canvas y oculta el toggle web", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Validación exclusiva del breakpoint móvil.");
  await loadPortal(page);

  await expect(page.locator("#citizen-panel-visibility-toggle")).toBeHidden();
  await expect(page.locator("#right-tools-rail")).toBeVisible();
  await expect(page.locator("#legend-context-panel")).toBeVisible();
  await expect(page.locator("body")).not.toHaveClass(/mobile-citizen-open/);
  await page.locator("#mobile-citizen-toggle").click();
  await expect(page.locator("body")).toHaveClass(/mobile-citizen-open/);
  await expect(page.locator("#right-context-host")).toBeHidden();
  await page.locator("#mobile-citizen-close").click();
  await expect(page.locator("body")).not.toHaveClass(/mobile-citizen-open/);

  await page.locator('[data-right-panel="layers"]').click();
  await expect(page.locator("#technical-drawer")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator(".timeline-control")).toContainText("Año de los datos mostrados");
  const timelineBox = await box(page, ".timeline-control");
  const variablesBox = await box(page, "#variable-disclosure");
  expect(timelineBox.top).toBeLessThan(variablesBox.top);
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
  await expect(page.locator("body")).not.toHaveClass(/citizen-panel-open/);
  await assertBasemapControlHasDedicatedSpace(page);
});
