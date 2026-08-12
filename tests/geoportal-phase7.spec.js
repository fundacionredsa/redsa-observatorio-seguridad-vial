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

function intersects(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function rect(page, selector) {
  return page.locator(selector).evaluate(element => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
  });
}

async function showQuitoAnalysis(page) {
  await page.evaluate(async () => {
    await window.__redsaAudit.setZoom(9);
    await window.__redsaAudit.showTerritory("canton", "1701");
  });
  if ((page.viewportSize()?.width || 0) <= 768 && !await page.locator("body").evaluate(element => element.classList.contains("mobile-citizen-open"))) {
    await page.locator("#mobile-citizen-toggle").click();
  }
  await page.locator("#open-analysis-button").click();
  await expect(page.locator("body")).toHaveClass(/mobile-sidebar-open/);
  await expect(page.locator("#territory-sidebar")).toHaveAttribute("aria-hidden", "false");
}

test("HA mantiene la barra compacta, completa y sin texto truncado", async ({ page }, testInfo) => {
  await loadPortal(page);
  const mobile = testInfo.project.name === "mobile";
  if (mobile) {
    await expect(page.locator("#map-controls-toolbar")).toBeHidden();
    for (const selector of ["#mobile-level-bar button", "#mobile-year-bar button", ".mobile-period-control-slot button"]) {
      const heights = await page.locator(selector).evaluateAll(elements => elements.filter(element => {
        const styles = getComputedStyle(element);
        return styles.display !== "none" && styles.visibility !== "hidden";
      }).map(element => element.getBoundingClientRect().height));
      expect(heights.every(height => height >= 44), `${selector}: ${heights}`).toBeTruthy();
    }
    return;
  }

  const toolbar = page.locator("#map-controls-toolbar");
  await expect(toolbar).toBeVisible();
  await expect(page.locator(".territory-level-segments button")).toHaveCount(4);
  await expect(page.locator(".period-mode-segments button")).toHaveCount(2);
  await expect(page.locator("#territory-opacity-label")).toHaveText("Intensidad");
  const geometry = await toolbar.evaluate(element => ({
    height: element.getBoundingClientRect().height,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth
  }));
  expect(geometry.height).toBeLessThanOrEqual(40);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  const controls = await page.locator(".map-controls-toolbar .territory-level-segments button, .map-controls-toolbar .period-mode-segments button").evaluateAll(elements =>
    elements.map(element => element.getBoundingClientRect().height)
  );
  expect(controls.every(height => height >= 32), `${controls}`).toBeTruthy();
  const label = await page.locator("#territory-opacity-label").evaluate(element => ({
    overflow: getComputedStyle(element).textOverflow,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth
  }));
  expect(label.overflow).not.toBe("ellipsis");
  expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth + 1);
});

test("HB mantiene la leyenda a la derecha sin intersecciones en combinaciones de paneles", async ({ page }, testInfo) => {
  await loadPortal(page);

  if (testInfo.project.name === "mobile") {
    const cardRect = await rect(page, "#map-legend-card");
    const railRect = await rect(page, "#right-tools-rail");
    expect(intersects(cardRect, railRect), JSON.stringify({ cardRect, railRect })).toBeFalsy();
    await showQuitoAnalysis(page);
    await expect(page.locator("#map-legend-card")).toBeHidden();
    await page.locator("#mobile-sidebar-close").click();
    await expect(page.locator("body")).toHaveClass(/mobile-citizen-open/);
    await expect(page.locator("#map-legend-card")).toBeHidden();
    await page.locator("#mobile-citizen-close").click();
    await expect(page.locator("#map-legend-card")).toBeVisible();
    return;
  }

  const assertSafeLegend = async () => {
    await page.waitForTimeout(280);
    const card = page.locator("#map-legend-card");
    if (!(await card.isVisible())) {
      await expect(page.locator("body")).toHaveClass(/map-legend-space-constrained/);
      return;
    }
    const cardRect = await rect(page, "#map-legend-card");
    const railRect = await rect(page, "#right-tools-rail");
    expect(intersects(cardRect, railRect), JSON.stringify({ cardRect, railRect })).toBeFalsy();
    expect(cardRect.right).toBeLessThanOrEqual(page.viewportSize().width);
    expect(cardRect.width).toBeGreaterThanOrEqual(240);
    if (await page.locator("#right-context-host").isVisible()) {
      const rightPanel = await rect(page, "#right-context-host");
      expect(intersects(cardRect, rightPanel), JSON.stringify({ cardRect, rightPanel })).toBeFalsy();
    }
    if (await page.locator("#territory-sidebar").getAttribute("aria-hidden") === "false") {
      const analysis = await rect(page, "#territory-sidebar");
      expect(intersects(cardRect, analysis), JSON.stringify({ cardRect, analysis })).toBeFalsy();
    }
    if (await page.locator("#citizen-panel").getAttribute("aria-hidden") === "false") {
      const citizen = await rect(page, "#citizen-panel");
      expect(intersects(cardRect, citizen), JSON.stringify({ cardRect, citizen })).toBeFalsy();
    }
  };

  await assertSafeLegend();
  await page.locator('[data-right-panel="layers"]').click();
  await assertSafeLegend();
  await showQuitoAnalysis(page);
  await assertSafeLegend();
  await page.locator('[data-right-panel="basemap"]').click();
  await assertSafeLegend();
  await page.locator('[data-right-panel="basemap"]').click();
  await assertSafeLegend();
  await page.locator("#mobile-sidebar-close").click();
  await expect(page.locator("#map-legend-card")).toBeVisible();
  await assertSafeLegend();
});

test("HC la flecha colapsa y restaura el panel visible; Volver recupera el resumen", async ({ page }, testInfo) => {
  await loadPortal(page);
  await showQuitoAnalysis(page);
  const body = page.locator("body");
  const toggle = page.locator("#citizen-panel-visibility-toggle");
  if (testInfo.project.name === "mobile") {
    await expect(toggle).toBeHidden();
    await page.locator("#mobile-sidebar-close").click();
    await expect(body).not.toHaveClass(/mobile-sidebar-open/);
    await expect(body).toHaveClass(/mobile-citizen-open/);
    await expect(page.locator("#citizen-panel")).toHaveAttribute("aria-hidden", "false");
    return;
  }
  await expect(toggle).toHaveAttribute("aria-controls", "territory-sidebar");
  await expect(toggle).toHaveAttribute("aria-label", "Ocultar panel de análisis del territorio");
  await expect(toggle.locator("i")).toHaveClass(/fa-chevron-left/);

  await toggle.click();
  await expect(body).not.toHaveClass(/mobile-sidebar-open/);
  await expect(body).not.toHaveClass(/citizen-panel-open/);
  await expect(toggle).toHaveAttribute("aria-label", "Mostrar panel de análisis del territorio");
  await expect(toggle.locator("i")).toHaveClass(/fa-chevron-right/);

  await toggle.click();
  await expect(body).toHaveClass(/mobile-sidebar-open/);
  await expect(page.locator("#territory-breadcrumb")).toContainText("PICHINCHA");
  await page.locator("#mobile-sidebar-close").click();
  await expect(body).not.toHaveClass(/mobile-sidebar-open/);
  await expect(body).toHaveClass(/citizen-panel-open/);
  await expect(toggle).toHaveAttribute("aria-controls", "citizen-panel");
  await expect(toggle).toHaveAttribute("aria-label", "Ocultar panel de exploración territorial");
});

test("HD compacta el análisis y declara los estados vacíos con menor jerarquía", async ({ page }) => {
  await loadPortal(page);
  await showQuitoAnalysis(page);
  await expect(page.locator(".territory-identity-block")).toBeVisible();
  await expect(page.locator(".territory-identity-block .detail-row")).toHaveCount(3);

  const density = await page.evaluate(() => {
    const populated = document.querySelector("#info-canton");
    const empty = document.querySelector("#info-poblacion.empty") || document.querySelector(".sidebar .detail-value.empty");
    const row = document.querySelector("#population-detail-row");
    const identity = document.querySelector(".territory-identity-block");
    const details = [...document.querySelectorAll(".sidebar .analysis-disclosure")];
    return {
      rowColumns: getComputedStyle(row).gridTemplateColumns,
      valueAlign: getComputedStyle(populated).textAlign,
      populatedSize: parseFloat(getComputedStyle(populated).fontSize),
      emptySize: empty ? parseFloat(getComputedStyle(empty).fontSize) : null,
      identityBorder: parseFloat(getComputedStyle(identity).borderTopWidth),
      disclosureHeights: details.map(element => element.querySelector("summary")?.getBoundingClientRect().height || 0),
      diagnosticOpen: document.querySelector(".diagnostic-panel").open,
      diagnosticTag: document.querySelector(".diagnostic-panel").tagName
    };
  });
  expect(density.rowColumns.split(" ").length).toBeGreaterThanOrEqual(2);
  expect(density.valueAlign).toBe("right");
  expect(density.identityBorder).toBeGreaterThan(0);
  expect(density.emptySize).toBeLessThan(density.populatedSize);
  expect(density.disclosureHeights.every(height => height >= 36 && height <= 44), JSON.stringify(density)).toBeTruthy();
  expect(density.diagnosticTag).toBe("DETAILS");
  expect(density.diagnosticOpen).toBeFalsy();

  await page.evaluate(async () => {
    await window.__redsaAudit.setTerritoryLevelMode("parish");
    await window.__redsaAudit.showTerritory("parish", "170151");
  });
  await expect(page.locator("#parroquia-row")).toBeVisible();
  await expect(page.locator(".sidebar .detail-value.empty").first()).toBeVisible();
});
