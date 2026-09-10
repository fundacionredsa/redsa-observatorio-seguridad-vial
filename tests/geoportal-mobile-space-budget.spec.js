// @ts-check
import { test, expect } from "@playwright/test";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Todos los selectores y umbrales en un solo lugar.
// Ajustar aquí si cambian los IDs o los criterios de aceptación.
const CONFIG = {
  // Ratio mínimo de área libre 2D sobre área total del viewport
  MINIMUM_FREE_AREA_RATIO: 0.50,

  // Dimensión mínima de touch target (WCAG 2.5.8)
  MIN_TOUCH_TARGET_PX: 44,

  // Elementos chrome que ocupan espacio sobre el mapa
  CHROME_SELECTORS: [
    "#map-search-card",
    "#mobile-level-bar",
    "#mobile-year-bar",
    "#map-legend-card .map-legend-card-header",
    "#right-tools-rail",
  ],

  // Elementos interactivos cuyo touch target se evalúa
  TOUCH_TARGET_SELECTORS: [
    "#map-search-card input",
    "#map-search-card button",
    "#mobile-level-bar button",
    "#mobile-year-bar button",
    "#mobile-year-bar input",
    "#map-legend-card .map-legend-card-header button",
    "#right-tools-rail button",
  ],

  // Selector del contenedor de mapa
  MAP_SELECTOR: "#map",

  // LocalStorage keys para saltar el tour
  TOUR_KEYS: [
    "redsa_tour_seen",
    "has_seen_geoportal_tour",
    "redsa_tour_v2_visto",
  ],
};
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Presupuesto de espacio inicial del mapa en mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((keys) => {
      keys.forEach(k => window.localStorage.setItem(k, "true"));
    }, CONFIG.TOUR_KEYS);
  });

  test("el área libre 2D del mapa supera el 50% del viewport y todos los touch targets son ≥ 44 px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Criterio de aceptación exclusivo del proyecto mobile.");

    await page.goto("./", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__redsaAudit !== undefined);
    await expect(page.locator("#loader")).toBeHidden({ timeout: 90_000 });
    await expect(page.locator("#map-legend-card")).toBeVisible();
    await expect(page.locator("#map-legend-card")).toHaveClass(/is-collapsed/);

    const metrics = await page.evaluate(({ CHROME_SELECTORS, TOUCH_TARGET_SELECTORS, MAP_SELECTOR, MIN_TOUCH_TARGET_PX }) => {
      const getRect = selector => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { top: b.top, right: b.right, bottom: b.bottom, left: b.left, width: b.width, height: b.height };
      };

      const map = getRect(MAP_SELECTOR);
      if (!map) throw new Error(`No se encontró el selector del mapa: ${MAP_SELECTOR}`);

      const mapArea = map.width * map.height;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Recolectar rectángulos chrome que se superponen al mapa
      const chromeRects = CHROME_SELECTORS
        .map(sel => ({ sel, rect: getRect(sel) }))
        .filter(({ rect }) => rect !== null)
        .map(({ sel, rect }) => ({
          sel,
          // Intersección con el mapa
          top:    Math.max(map.top,    rect.top),
          bottom: Math.min(map.bottom, rect.bottom),
          left:   Math.max(map.left,   rect.left),
          right:  Math.min(map.right,  rect.right),
        }))
        .filter(r => r.bottom > r.top && r.right > r.left);

      // Área de la unión de rectángulos chrome usando scan-line sobre el eje Y
      // (exacto para rectángulos arbitrarios sin necesidad de librería externa)
      const events = [];
      for (const r of chromeRects) {
        events.push({ y: r.top,    type: "open",  r });
        events.push({ y: r.bottom, type: "close", r });
      }
      events.sort((a, b) => a.y - b.y || (a.type === "open" ? -1 : 1));

      let activeRects = [];
      let prevY = map.top;
      let occupiedArea = 0;

      const coveredWidthAt = (rects) => {
        // Cobertura horizontal de la unión de intervalos [left, right]
        const intervals = rects.map(r => [r.left, r.right]).sort((a, b) => a[0] - b[0]);
        if (intervals.length === 0) return 0;
        let covered = 0, [curLeft, curRight] = intervals[0];
        for (const [l, r] of intervals.slice(1)) {
          if (l > curRight) { covered += curRight - curLeft; curLeft = l; curRight = r; }
          else { curRight = Math.max(curRight, r); }
        }
        covered += curRight - curLeft;
        return Math.max(0, covered);
      };

      for (const ev of events) {
        const dy = ev.y - prevY;
        if (dy > 0 && activeRects.length > 0) {
          occupiedArea += dy * coveredWidthAt(activeRects);
        }
        if (ev.type === "open")  activeRects.push(ev.r);
        else                      activeRects = activeRects.filter(r => r !== ev.r);
        prevY = ev.y;
      }

      const freeArea = Math.max(0, mapArea - occupiedArea);
      const freeAreaRatio = freeArea / (vw * vh);

      // Touch targets
      const touchTargets = Array.from(document.querySelectorAll(TOUCH_TARGET_SELECTORS.join(",")))
        .flatMap(el => {
          const b = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          if (s.display === "none" || s.visibility === "hidden" || b.width === 0 || b.height === 0) return [];
          return [{ id: el.id || null, label: el.getAttribute("aria-label") || el.textContent?.trim() || null, width: b.width, height: b.height }];
        });

      const undersizedTouchTargets = touchTargets.filter(t => t.width < MIN_TOUCH_TARGET_PX || t.height < MIN_TOUCH_TARGET_PX);

      return {
        viewport: { width: vw, height: vh },
        map,
        mapArea,
        chromeRects,
        occupiedArea,
        freeArea,
        freeAreaRatio,
        touchTargets,
        undersizedTouchTargets,
      };
    }, { CHROME_SELECTORS: CONFIG.CHROME_SELECTORS, TOUCH_TARGET_SELECTORS: CONFIG.TOUCH_TARGET_SELECTORS, MAP_SELECTOR: CONFIG.MAP_SELECTOR, MIN_TOUCH_TARGET_PX: CONFIG.MIN_TOUCH_TARGET_PX });

    await testInfo.attach("mobile-map-space-metrics.json", {
      body: JSON.stringify(metrics, null, 2),
      contentType: "application/json",
    });

    // Assertion 1: área libre 2D real
    expect(
      metrics.freeAreaRatio,
      `Área libre real: ${(metrics.freeAreaRatio * 100).toFixed(1)}% (mínimo ${CONFIG.MINIMUM_FREE_AREA_RATIO * 100}%)\n` +
      `map=${JSON.stringify(metrics.map)} chromeRects=${JSON.stringify(metrics.chromeRects)}`
    ).toBeGreaterThanOrEqual(CONFIG.MINIMUM_FREE_AREA_RATIO);

    // Assertion 2: todos los touch targets son ≥ 44 px
    expect(
      metrics.undersizedTouchTargets,
      `Touch targets por debajo de ${CONFIG.MIN_TOUCH_TARGET_PX}px: ${JSON.stringify(metrics.undersizedTouchTargets)}`
    ).toEqual([]);
  });
});
