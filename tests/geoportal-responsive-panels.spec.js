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

test("los controles laterales son iconos y la leyenda conserva su estado en cualquier ancho", async ({ page }) => {
  await loadPortal(page);

  const citizenToggle = page.locator("#citizen-panel-visibility-toggle");
  await expect(citizenToggle.locator("span")).toHaveCount(0);
  expect((await citizenToggle.textContent()).trim()).toBe("");

  const legendToggle = page.locator("#mobile-legend-toggle");
  const legendToggleLabel = legendToggle.locator(".legend-toggle-label");
  const legendContent = page.locator("#legend-content");
  const viewport = page.viewportSize();

  await expect(legendToggle).toBeVisible();
  await expect(legendToggleLabel).toHaveText("Leyenda");
  await expect(legendToggleLabel).toBeHidden();
  await expect(legendToggle).toHaveAttribute("aria-expanded", "true");
  await expect(legendToggle).toHaveAttribute("aria-label", "Ocultar leyenda");
  await expect(legendContent).toBeVisible();

  const openLegend = await box(page, ".legend-panel");
  expect(openLegend.left).toBeGreaterThanOrEqual(0);
  expect(openLegend.right).toBeLessThanOrEqual(viewport.width);
  expect(openLegend.top).toBeGreaterThanOrEqual(0);
  expect(openLegend.bottom).toBeLessThanOrEqual(viewport.height);

  await legendToggle.click();
  await expect(legendToggle).toHaveAttribute("aria-expanded", "false");
  await expect(legendToggle).toHaveAttribute("aria-label", "Mostrar leyenda");
  await expect(legendContent).toBeHidden();
  await expect(legendToggleLabel).toBeVisible();
  const collapsedLegend = await box(page, ".legend-panel");
  expect(collapsedLegend.width).toBeLessThanOrEqual(92);
  expect(collapsedLegend.height).toBeLessThanOrEqual(44);

  const basemap = page.locator(".basemap-control");
  await expect(basemap).toBeVisible();
  expect(intersects(collapsedLegend, await box(page, ".basemap-control"))).toBeFalsy();

  await legendToggle.click();
  await expect(legendToggle).toHaveAttribute("aria-expanded", "true");
  await expect(legendContent).toBeVisible();
});

async function assertBasemapControlHasDedicatedSpace(page) {
  const viewport = page.viewportSize();
  const dock = page.locator(".basemap-control-dock");
  const basemap = page.locator(".basemap-control");

  await expect(dock).toHaveCSS("display", "block");
  await expect(dock).toHaveCSS("position", "fixed");
  await expect(basemap).toBeVisible();
  await expect(basemap).toHaveAttribute("aria-label", "Seleccionar mapa base");
  expect(await basemap.evaluate(element => element.parentElement?.classList.contains("basemap-control-dock"))).toBeTruthy();

  const collapsed = await box(page, ".basemap-control");
  const zoom = await box(page, ".leaflet-control-zoom");
  const opacity = await box(page, ".opacity-control");
  const legend = await box(page, ".legend-panel");
  const technical = await box(page, "#technical-drawer");

  expect(collapsed.width).toBe(44);
  expect(collapsed.height).toBe(44);
  expect(collapsed.left).toBeGreaterThanOrEqual(0);
  expect(collapsed.right).toBeLessThanOrEqual(viewport.width);
  expect(collapsed.right).toBeLessThan(technical.left);
  expect(intersects(collapsed, zoom)).toBeFalsy();
  expect(intersects(collapsed, opacity)).toBeFalsy();
  expect(intersects(collapsed, legend)).toBeFalsy();
  expect(intersects(collapsed, technical)).toBeFalsy();

  expect(zoom.top).toBeLessThan(opacity.top);
  expect(zoom.bottom).toBeLessThanOrEqual(opacity.top);

  await basemap.hover();
  await expect(basemap).toHaveClass(/leaflet-control-layers-expanded/);
  const basemapOptions = basemap.locator(".leaflet-control-layers-base label");
  await expect(basemapOptions).toHaveCount(4);
  await expect(basemapOptions.first()).toBeVisible();
  const expanded = await box(page, ".basemap-control");

  expect(expanded.left).toBeGreaterThanOrEqual(0);
  expect(expanded.right).toBeLessThanOrEqual(viewport.width);
  expect(intersects(expanded, zoom)).toBeFalsy();
  expect(intersects(expanded, opacity)).toBeFalsy();
  expect(intersects(expanded, legend)).toBeFalsy();
  expect(intersects(expanded, technical)).toBeFalsy();

  const satelliteOption = basemapOptions.filter({ hasText: "Esri World Imagery" });
  await expect(satelliteOption).toHaveCount(1);
  await satelliteOption.click();
  await expect(satelliteOption.locator("input")).toBeChecked();

  return { collapsed, expanded, zoom, opacity, legend, technical };
}

test("panel ciudadano web conserva estado y no compite con la ficha territorial", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "La experiencia off-canvas móvil se cubre por separado.");
  await loadPortal(page);

  const viewport = page.viewportSize();
  const body = page.locator("body");
  const citizen = page.locator("#citizen-panel");
  const citizenToggle = page.locator("#citizen-panel-visibility-toggle");
  const sidebar = page.locator("#territory-sidebar");
  const technical = page.locator("#technical-drawer");
  const search = page.locator("#territory-search-input");

  await expect(citizenToggle).toBeVisible();
  await expect(technical).toHaveAttribute("aria-hidden", "false");
  await expect(technical).toHaveCSS("position", "fixed");
  const technicalBox = await box(page, "#technical-drawer");
  expect(technicalBox.right).toBeLessThanOrEqual(viewport.width);
  expect(technicalBox.left).toBeGreaterThanOrEqual(0);

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
  await expect(body).toHaveClass(/profile-selection-active/);
  const resolvedSearchValue = await search.inputValue();
  await page.locator("#open-analysis-button").click();
  await expect(body).toHaveClass(/mobile-sidebar-open/);
  await expect(body).not.toHaveClass(/citizen-panel-open/);
  await expect(sidebar).toHaveAttribute("aria-hidden", "false");
  await expect(citizen).toHaveAttribute("aria-hidden", "true");
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

test("panel técnico mantiene orden global y propósito explícito del año", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "El orden móvil se valida dentro de su drawer.");
  await loadPortal(page);

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

test("pantalla grande abre el panel ciudadano y mantiene fijo el panel técnico", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "La comprobación 1920 px se ejecuta una vez.");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await loadPortal(page);

  await expect(page.locator("body")).toHaveClass(/citizen-panel-open/);
  await expect(page.locator("#citizen-panel")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#technical-drawer")).toHaveAttribute("aria-hidden", "false");
  const citizenBox = await box(page, "#citizen-panel");
  const technicalBox = await box(page, "#technical-drawer");
  expect(citizenBox.right).toBeLessThan(technicalBox.left);
  expect(technicalBox.right).toBe(1920);
});

test("mobile conserva sus paneles off-canvas y oculta el toggle web", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Validación exclusiva del breakpoint móvil.");
  await loadPortal(page);

  await expect(page.locator("#citizen-panel-visibility-toggle")).toBeHidden();
  await expect(page.locator(".basemap-control-dock")).toBeHidden();
  expect(await page.locator(".basemap-control").evaluate(element =>
    element.parentElement?.classList.contains("leaflet-right")
  )).toBeTruthy();
  await expect(page.locator("body")).not.toHaveClass(/mobile-citizen-open/);
  await page.locator("#mobile-citizen-toggle").click();
  await expect(page.locator("body")).toHaveClass(/mobile-citizen-open/);
  await page.locator("#mobile-citizen-close").click();
  await expect(page.locator("body")).not.toHaveClass(/mobile-citizen-open/);

  await page.locator("#mobile-layers-toggle").click();
  await expect(page.locator("#technical-drawer")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator(".timeline-control")).toContainText("Año de los datos mostrados");
  const timelineBox = await box(page, ".timeline-control");
  const variablesBox = await box(page, "#variable-disclosure");
  expect(timelineBox.top).toBeLessThan(variablesBox.top);
});

test("mapas base tiene espacio propio en pantallas medianas y grandes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Mobile conserva el corner Leaflet existente.");
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
