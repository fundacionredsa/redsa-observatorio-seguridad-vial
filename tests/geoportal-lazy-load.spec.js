import { test, expect } from "@playwright/test";

test("la carga inicial usa provincias e índice y difiere cantones", async ({ page }) => {
  const dataRequests = [];
  page.on("request", request => {
    if (/\/data\/(provincias|cantones|hotspots)/.test(request.url())) dataRequests.push(request.url());
  });
  await page.addInitScript(() => {
    localStorage.setItem("redsa_tour_v2_visto", "true");
    localStorage.setItem("redsa_tour_seen", "true");
  });
  await page.goto("index.html");
  await page.waitForFunction(() => Boolean(window.__redsaAudit));
  expect(dataRequests.some(url => url.endsWith("/provincias_wgs84.geojson"))).toBe(true);
  expect(dataRequests.some(url => url.endsWith("/cantones_indice.json"))).toBe(true);
  expect(dataRequests.some(url => url.endsWith("/cantones_wgs84.geojson"))).toBe(false);
  expect(dataRequests.some(url => url.endsWith("/hotspots_cantonales.json"))).toBe(false);
  expect(await page.evaluate(() => window.__redsaExperienceAudit.search("Quito"))).toBe("1701");
});

test("búsqueda, ranking y ficha activan datos cantonales bajo demanda", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("redsa_tour_v2_visto", "true");
    localStorage.setItem("redsa_tour_seen", "true");
  });
  await page.goto("index.html");
  await page.waitForFunction(() => Boolean(window.__redsaAudit));
  await page.locator("#territory-search-input").fill("Quito");
  await page.locator("#territory-search-form").dispatchEvent("submit");
  await page.waitForFunction(() => window.__redsaAudit.state().selectedTerritory?.code === "1701");
  await expect(page.locator("#download-summary-button")).toBeEnabled();

  await page.evaluate(() => window.__redsaInstitutionalAudit.open("ranking"));
  await expect(page.locator("#ranking-table-body tr").first()).toBeVisible();
  const ranking = await page.evaluate(() => window.__redsaInstitutionalAudit.state());
  expect(ranking.totalCount).toBe(224);
  expect(ranking.validCount).toBeGreaterThan(0);
});
