// @ts-check
import { test, expect } from "@playwright/test";

const MINIMUM_UNOBSTRUCTED_MAP_VIEWPORT_RATIO = 0.60;

test.describe("Presupuesto de espacio inicial del mapa en mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("redsa_tour_seen", "true");
      window.localStorage.setItem("has_seen_geoportal_tour", "true");
      window.localStorage.setItem("redsa_tour_v2_visto", "true");
    });
  });

  test("reserva al mapa al menos 60% del alto del viewport sin interacción", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Criterio de aceptación exclusivo del proyecto mobile.");

    await page.goto("./", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__redsaAudit !== undefined);
    await expect(page.locator("#loader")).toBeHidden({ timeout: 90_000 });
    await expect(page.locator("#map-legend-card")).toBeVisible();
    await expect(page.locator("#map-legend-card")).toHaveClass(/is-collapsed/);

    const metrics = await page.evaluate(() => {
      const rect = selector => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`No existe el selector requerido: ${selector}`);
        const box = element.getBoundingClientRect();
        return {
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          left: box.left,
          width: box.width,
          height: box.height
        };
      };

      const blocks = {
        search: rect("#map-search-card"),
        level: rect("#mobile-level-bar"),
        timeline: rect("#mobile-year-bar"),
        legendHeader: rect("#map-legend-card .map-legend-card-header")
      };
      const map = rect("#map");
      const toolsRail = rect("#right-tools-rail");
      const occupiedBands = Object.entries(blocks)
        .map(([name, block]) => ({
          names: [name],
          top: Math.max(map.top, block.top),
          bottom: Math.min(map.bottom, block.bottom)
        }))
        .filter(band => band.bottom > band.top)
        .sort((a, b) => a.top - b.top)
        .reduce((merged, band) => {
          const previous = merged.at(-1);
          if (previous && band.top <= previous.bottom) {
            previous.bottom = Math.max(previous.bottom, band.bottom);
            previous.names.push(...band.names);
          } else {
            merged.push({ ...band, names: [...band.names] });
          }
          return merged;
        }, []);

      const unobstructedBands = [];
      let cursor = map.top;
      for (const band of occupiedBands) {
        if (band.top > cursor) unobstructedBands.push({ top: cursor, bottom: band.top });
        cursor = Math.max(cursor, band.bottom);
      }
      if (cursor < map.bottom) unobstructedBands.push({ top: cursor, bottom: map.bottom });

      const largestUnobstructedBand = unobstructedBands
        .map(band => ({ ...band, height: band.bottom - band.top }))
        .sort((a, b) => b.height - a.height)[0] || { top: map.top, bottom: map.top, height: 0 };

      const touchTargets = Array.from(document.querySelectorAll([
        "#map-search-card input",
        "#map-search-card button",
        "#mobile-level-bar button",
        "#mobile-year-bar button",
        "#mobile-year-bar input",
        "#map-legend-card .map-legend-card-header button",
        "#right-tools-rail button"
      ].join(","))).flatMap(element => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden" || bounds.width === 0 || bounds.height === 0) {
          return [];
        }
        return [{
          id: element.id || null,
          label: element.getAttribute("aria-label") || element.textContent?.trim() || null,
          width: bounds.width,
          height: bounds.height
        }];
      });

      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        blocks,
        map,
        toolsRail,
        toolsRailMapExclusionWidth: map.right - toolsRail.left,
        touchTargets,
        undersizedTouchTargets: touchTargets.filter(target => target.width < 44 || target.height < 44),
        occupiedBands,
        largestUnobstructedBand,
        unobstructedMapHeight: largestUnobstructedBand.height,
        unobstructedMapViewportRatio: largestUnobstructedBand.height / window.innerHeight
      };
    });

    await testInfo.attach("mobile-map-space-metrics.json", {
      body: JSON.stringify(metrics, null, 2),
      contentType: "application/json"
    });

    const budgetEvidence = {
      viewport: metrics.viewport,
      blocks: metrics.blocks,
      map: metrics.map,
      occupiedBands: metrics.occupiedBands,
      largestUnobstructedBand: metrics.largestUnobstructedBand,
      unobstructedMapHeight: metrics.unobstructedMapHeight,
      unobstructedMapViewportRatio: metrics.unobstructedMapViewportRatio,
      undersizedTouchTargets: metrics.undersizedTouchTargets
    };

    expect(
      metrics.unobstructedMapViewportRatio,
      `Geometría inicial mobile: ${JSON.stringify(budgetEvidence)}`
    ).toBeGreaterThanOrEqual(MINIMUM_UNOBSTRUCTED_MAP_VIEWPORT_RATIO);
  });
});
