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
