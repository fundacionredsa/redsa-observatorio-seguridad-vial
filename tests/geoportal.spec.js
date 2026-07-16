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
  if ((page.viewportSize()?.width || 0) > 768) {
    expect(await card.locator("#hover-card-title").textContent()).toBe(before);
  } else {
    expect((await card.locator("#hover-card-title").textContent()) || "").not.toHaveLength(0);
  }

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

test("mobile muestra sidebar y capas como drawers accesibles", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Validacion especifica del breakpoint movil.");

  async function assertMobileLayout(width, height) {
    await page.setViewportSize({ width, height });
    await loadPortal(page);

    const closed = await page.evaluate(() => {
      function box(selector) {
        const el = document.querySelector(selector);
        const rect = el.getBoundingClientRect();
        const styles = getComputedStyle(el);
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          opacity: Number(styles.opacity),
          pointerEvents: styles.pointerEvents,
          inViewport: rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight
        };
      }
      return {
        sidebar: box(".sidebar"),
        layers: box(".leaflet-control-layers"),
        mapSelector: box(".map-selector-control"),
        sidebarButton: box("#mobile-sidebar-toggle"),
        layersButton: box("#mobile-layers-toggle")
      };
    });

    expect(closed.sidebar.inViewport).toBeFalsy();
    expect(closed.layers.inViewport).toBeFalsy();
    expect(closed.layers.pointerEvents).toBe("none");
    expect(closed.mapSelector.inViewport).toBeTruthy();
    expect(closed.sidebarButton.height).toBeGreaterThanOrEqual(44);
    expect(closed.layersButton.height).toBeGreaterThanOrEqual(44);

    await page.locator("#mobile-sidebar-toggle").click();
    await page.waitForTimeout(300);
    const sidebarOpen = await page.evaluate(() => {
      const sidebar = document.querySelector(".sidebar").getBoundingClientRect();
      const close = document.querySelector("#mobile-sidebar-close").getBoundingClientRect();
      return {
        bodyClass: document.body.className,
        sidebar: { left: sidebar.left, right: sidebar.right, top: sidebar.top, bottom: sidebar.bottom, width: sidebar.width, height: sidebar.height },
        close: { width: close.width, height: close.height },
        text: document.querySelector(".sidebar").innerText
      };
    });
    expect(sidebarOpen.bodyClass).toContain("mobile-sidebar-open");
    expect(sidebarOpen.sidebar.left).toBeGreaterThanOrEqual(0);
    expect(sidebarOpen.sidebar.right).toBeLessThanOrEqual(width);
    expect(sidebarOpen.sidebar.bottom).toBeLessThanOrEqual(height);
    expect(sidebarOpen.close.width).toBeGreaterThanOrEqual(44);
    expect(sidebarOpen.close.height).toBeGreaterThanOrEqual(44);
    expect(sidebarOpen.text.toUpperCase()).toContain("INFORMACI");

    await page.locator("#mobile-overlay-backdrop").click({ position: { x: width - 8, y: height - 8 } });
    await expect(page.locator("body")).not.toHaveClass(/mobile-sidebar-open/);

    await page.locator("#mobile-layers-toggle").click();
    await page.waitForTimeout(300);
    const layersOpen = await page.evaluate(() => {
      const layers = document.querySelector(".leaflet-control-layers").getBoundingClientRect();
      const close = document.querySelector(".mobile-layer-close").getBoundingClientRect();
      return {
        bodyClass: document.body.className,
        layers: { left: layers.left, right: layers.right, top: layers.top, bottom: layers.bottom, width: layers.width, height: layers.height },
        close: { width: close.width, height: close.height },
        text: document.querySelector(".leaflet-control-layers").innerText
      };
    });
    expect(layersOpen.bodyClass).toContain("mobile-layers-open");
    expect(layersOpen.layers.left).toBeGreaterThanOrEqual(0);
    expect(layersOpen.layers.right).toBeLessThanOrEqual(width);
    expect(layersOpen.layers.bottom).toBeLessThanOrEqual(height);
    expect(layersOpen.close.width).toBeGreaterThanOrEqual(44);
    expect(layersOpen.close.height).toBeGreaterThanOrEqual(44);
    expect(layersOpen.text.toUpperCase()).toContain("CAPAS");
    expect(layersOpen.text).toContain("Ciclov");

    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveClass(/mobile-layers-open/);

    await page.evaluate(() => {
      window.__redsaAudit.setZoom(9);
      window.__redsaAudit.showTerritory("canton", "1701");
    });
    const profile = await page.evaluate(() => {
      const card = document.querySelector(".perfil-fallecidos-card").getBoundingClientRect();
      const legend = document.querySelector(".legend-panel").getBoundingClientRect();
      return {
        card: { top: card.top, bottom: card.bottom, left: card.left, right: card.right, width: card.width, height: card.height },
        legend: { top: legend.top, bottom: legend.bottom, left: legend.left, right: legend.right },
        intersects: !(card.right <= legend.left || card.left >= legend.right || card.bottom <= legend.top || card.top >= legend.bottom)
      };
    });
    expect(profile.card.bottom).toBeLessThanOrEqual(height - 10);
    expect(profile.intersects).toBeFalsy();

    const tooSmall = await page.evaluate(() => {
      const selectors = [
        ".mobile-nav-toggle",
        ".mobile-sidebar-close",
        ".mobile-layer-close",
        ".leaflet-control-layers-list label",
        "#map-variable-select",
        "#map-year-slider"
      ];
      return selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)).map(el => {
        const rect = el.getBoundingClientRect();
        const styles = getComputedStyle(el);
        const visible = styles.display !== "none" && styles.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        return visible && (rect.width < 44 || rect.height < 44)
          ? { selector, width: rect.width, height: rect.height, text: (el.innerText || el.value || el.getAttribute("aria-label") || "").slice(0, 40) }
          : null;
      }).filter(Boolean));
    });
    expect(tooSmall).toEqual([]);
  }

  await assertMobileLayout(390, 844);
  await assertMobileLayout(360, 740);
});
