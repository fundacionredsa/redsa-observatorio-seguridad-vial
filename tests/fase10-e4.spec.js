import { expect, test } from "@playwright/test";

const VIEWPORTS = {
  desktop: { width: 1920, height: 945 },
  medium: { width: 1180, height: 800 },
  mobile: { width: 390, height: 844 }
};

const EXPECTED_VISIBLE_MAP = {
  desktop: { closed: 81.56, layers: 60.73 },
  medium: { closed: 70.00, layers: 36.10 },
  mobile: { closed: 2.05, layers: 0.00 }
};

test.beforeEach(async ({ page }, testInfo) => {
  await page.setViewportSize(VIEWPORTS[testInfo.project.name]);
  await page.addInitScript(() => {
    localStorage.setItem("redsa_tour_v2_visto", "true");
    localStorage.setItem("redsa_tour_seen", "true");
    localStorage.setItem("has_seen_geoportal_tour", "true");
  });
});

async function loadPortal(page) {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__redsaAudit), null, {
    timeout: 90_000
  });
  await expect(page.locator("#loader")).toBeHidden({ timeout: 90_000 });
}

async function visibleMapArea(page) {
  return page.evaluate(() => {
    const map = document.getElementById("map").getBoundingClientRect();
    const leftColumn = document.querySelector(".map-left-column")?.getBoundingClientRect();
    const host = document.getElementById("right-context-host");
    const rail = document.getElementById("right-tools-rail").getBoundingClientRect();
    const hostRect = host.hidden ? null : host.getBoundingClientRect();
    const visible = {
      left: Math.max(map.left, leftColumn?.right ?? map.left),
      right: Math.min(map.right, hostRect?.left ?? rail.left),
      top: map.top,
      bottom: map.bottom
    };
    const width = Math.max(0, visible.right - visible.left);
    const height = Math.max(0, visible.bottom - visible.top);
    return (width * height) / (innerWidth * innerHeight) * 100;
  });
}

test("E4 limita los paneles y mantiene el scroll en su contenido", async ({ page }, testInfo) => {
  await loadPortal(page);

  const viewport = VIEWPORTS[testInfo.project.name];
  const isMobile = testInfo.project.name === "mobile";
  const leftColumn = page.locator(".map-left-column");
  const legend = page.locator("#map-legend-card");
  const legendScroll = page.locator(".map-legend-card-scroll");
  const collapse = page.locator("#map-legend-card-collapse");

  const leftGeometry = await leftColumn.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      overflowY: getComputedStyle(element).overflowY
    };
  });

  const expectedLeftMaxHeight = await page.evaluate(() => {
    const top = parseFloat(getComputedStyle(document.querySelector(".map-left-column")).top) || 52;
    const bottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--left-context-bottom")) || 12;
    return window.innerHeight - top - bottom;
  });
  expect(leftGeometry.height).toBeLessThanOrEqual(expectedLeftMaxHeight + 1);
  expect(leftGeometry.overflowY).toBe("visible");
  await expect(legendScroll).toHaveCSS("overflow-y", "auto");

  if (isMobile) {
    await expect(legend).toHaveClass(/is-collapsed/);
    await expect(collapse).toHaveAttribute("aria-expanded", "false");
    await expect(collapse).toHaveAttribute("aria-label", "Expandir leyenda del mapa");

    const touchTarget = await collapse.boundingBox();
    expect(touchTarget.width).toBeGreaterThanOrEqual(44);
    expect(touchTarget.height).toBeGreaterThanOrEqual(44);

    await collapse.focus();
    await expect(collapse).toHaveCSS("outline-style", "solid");
    await collapse.click();
    await expect(legend).not.toHaveClass(/is-collapsed/);
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
  } else {
    expect(leftGeometry.width).toBeCloseTo(272, 0);
    await expect(legend).not.toHaveClass(/is-collapsed/);
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
  }

  await page.locator('[data-right-panel="layers"]').click();
  const host = page.locator("#right-context-host");
  const drawer = page.locator("#technical-drawer");
  await expect(host).toBeVisible();
  await expect(drawer).toBeVisible();

  const hostGeometry = await host.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {
      height: rect.height,
      bottomGap: window.innerHeight - rect.bottom
    };
  });
  if (isMobile) {
    const expectedMobileHeight = await page.evaluate(() => {
      const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--mobile-context-top")) || 140;
      const bottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--mobile-context-bottom")) || 108;
      return window.innerHeight - top - bottom;
    });
    expect(hostGeometry.height).toBeLessThanOrEqual(expectedMobileHeight + 1);
  } else {
    expect(hostGeometry.bottomGap).toBeLessThanOrEqual(14);
  }
  await expect(host).toHaveCSS("overflow", "hidden");
  await expect(drawer).toHaveCSS("overflow-y", "auto");

  await drawer.locator("details").evaluateAll(details => {
    details.forEach(detail => {
      detail.open = true;
    });
  });

  const scrollState = await drawer.evaluate(element => {
    element.scrollTop = element.scrollHeight;
    return {
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop
    };
  });
  expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
  expect(scrollState.scrollTop).toBeGreaterThan(0);
});

test("E4 aumenta el área útil con el mismo cálculo territorial", async ({ page }, testInfo) => {
  await loadPortal(page);
  const expected = EXPECTED_VISIBLE_MAP[testInfo.project.name];

  const closed = await visibleMapArea(page);
  expect(closed).toBeCloseTo(expected.closed, 0);

  await page.locator('[data-right-panel="layers"]').click();
  await expect(page.locator("#right-context-host")).toBeVisible();

  const layers = await visibleMapArea(page);
  expect(layers).toBeCloseTo(expected.layers, 0);
});
