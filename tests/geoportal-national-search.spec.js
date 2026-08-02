import { test, expect } from "@playwright/test";

async function loadPortal(page) {
  await page.addInitScript(() => {
    localStorage.setItem("redsa_tour_v2_visto", "true");
    localStorage.setItem("redsa_tour_seen", "true");
  });
  await page.goto("index.html");
  await page.waitForFunction(() => Boolean(window.__redsaAudit && window.__redsaExperienceAudit));
}

async function openCitizenPanel(page) {
  await page.evaluate(() => window.setMobilePanel("citizen", true));
  await expect(page.locator("#citizen-panel")).toHaveAttribute("aria-hidden", "false");
}

async function searchTerritory(page, query, expectedLevel, expectedCode) {
  await openCitizenPanel(page);
  const input = page.locator("#territory-search-input");
  await input.fill(query);
  await input.press("Enter");
  await expect.poll(async () => page.evaluate(() => window.__redsaAudit.state().selectedTerritory)).toEqual({
    level: expectedLevel,
    code: expectedCode
  });
  await expect(page.locator("#territory-sidebar")).toHaveAttribute("aria-hidden", "false");
}

test("el estado inicial muestra una referencia nacional que sigue variable, año y periodo", async ({ page }) => {
  await loadPortal(page);
  await openCitizenPanel(page);
  const reference = page.locator(".citizen-national-reference");
  await expect(reference).toBeVisible();
  await expect(reference).toContainText("20.346");
  await expect(reference).toContainText("2025");
  await expect(reference).not.toContainText("Fuente:");
  const referenceInfo = reference.locator(".citizen-national-info");
  await expect(referenceInfo).toBeVisible();
  await expect(referenceInfo).toHaveAttribute("data-custom-text", /Fuente: ANT/);
  expect(await reference.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();

  await page.evaluate(() => window.__redsaAudit.selectYear(2024));
  await expect(reference).toContainText("21.220");
  await expect(reference).toContainText("2024");

  await page.evaluate(() => window.__redsaAudit.selectVariable("tasa_fallecidos_100k"));
  await expect(reference).toContainText("personas fallecidas por cada 100.000 habitantes");
  await expect(reference.locator(".citizen-national-info")).toHaveAttribute("data-custom-text", /Fuente: Cálculo REDSA/);
  await expect(reference).not.toContainText("21.220");

  await page.evaluate(() => window.__redsaAudit.selectVariable("fallecidos_sppat_2016_2021"));
  await page.evaluate(() => document.querySelector('[data-period-mode="accumulated"]')?.click());
  await expect(reference).toContainText("Histórico 2016–2021");
  const accumulatedText = await reference.textContent();
  expect(accumulatedText).not.toContain("21.220");
});

test("la búsqueda selecciona provincia, cantón y parroquia y abre su ficha", async ({ page }) => {
  await loadPortal(page);

  await searchTerritory(page, "AZUAY — Provincia", "province", "01");
  await expect(page.locator("#info-provincia")).toHaveText("AZUAY");

  await searchTerritory(page, "Quito", "canton", "1701");
  await expect(page.locator("#info-canton")).toContainText("DISTRITO METROPOLITANO DE QUITO");

  await searchTerritory(page, "TUMBACO", "parish", "170184");
  await expect(page.locator("#info-parroquia")).toHaveText("TUMBACO");
  const experienceState = await page.evaluate(() => window.__redsaExperienceAudit.state());
  expect(experienceState.parishOptions).toBe(1050);

  await openCitizenPanel(page);
  await page.locator("#territory-search-input").fill("SAN ANTONIO");
  await page.locator("#territory-search-input").press("Enter");
  await expect(page.locator("#territory-search-status")).toContainText("varias coincidencias");
});

test("una búsqueda parroquial conserva la variable y muestra límites con aviso cuando no aplica", async ({ page }) => {
  await loadPortal(page);
  await page.evaluate(() => window.__redsaAudit.selectVariable("tasa_fallecidos_100k"));

  await searchTerritory(page, "TUMBACO", "parish", "170184");
  const state = await page.evaluate(() => window.__redsaAudit.state());
  expect(state.selectedVariable).toBe("tasa_fallecidos_100k");
  expect(state.effectiveVariable).toBe("normal");
  await expect(page.locator("#territory-search-adjustment-note")).toBeVisible();
  await expect(page.locator("#territory-search-adjustment-note")).toContainText(
    "Esta variable no tiene datos en ese nivel, por eso mostramos los límites."
  );
  await expect(page.locator("#map-level-note")).toContainText("se muestran solo límites");
});
