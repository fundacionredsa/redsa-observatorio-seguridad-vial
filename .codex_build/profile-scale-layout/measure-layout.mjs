import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const stage = process.argv[2] || "before";
const cases = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "medium", width: 1180, height: 800 },
  { name: "mobile", width: 390, height: 844, mobile: true }
];

await fs.mkdir(`.codex_build/profile-scale-layout/${stage}`, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

for (const viewport of cases) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: Boolean(viewport.mobile),
    hasTouch: Boolean(viewport.mobile)
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("redsa_tour_v2_visto", "true");
    localStorage.setItem("redsa_tour_seen", "true");
    localStorage.setItem("has_seen_geoportal_tour", "true");
  });
  await page.goto("http://127.0.0.1:4173/docs/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
  await page.locator("#loader").waitFor({ state: "hidden", timeout: 90_000 });
  await page.evaluate(async () => {
    await window.__redsaAudit.setZoom(9);
    await window.__redsaAudit.showTerritory("canton", "1701");
  });
  await page.locator("#demographic-hover-card").waitFor({ state: "visible" });

  const toggle = page.locator("#citizen-panel-visibility-toggle");
  if (!viewport.mobile && await toggle.getAttribute("aria-expanded") !== "true") {
    await toggle.click();
    await page.waitForTimeout(650);
  }

  const measure = label => page.evaluate(currentLabel => {
    const box = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const styles = getComputedStyle(element);
      return {
        left: Number(rect.left.toFixed(1)),
        right: Number(rect.right.toFixed(1)),
        top: Number(rect.top.toFixed(1)),
        bottom: Number(rect.bottom.toFixed(1)),
        width: Number(rect.width.toFixed(1)),
        height: Number(rect.height.toFixed(1)),
        display: styles.display,
        visibility: styles.visibility
      };
    };
    return {
      label: currentLabel,
      card: box("#demographic-hover-card"),
      scale: box(".road-scale-control"),
      attribution: box(".leaflet-control-attribution"),
      citizen: box("#citizen-panel"),
      legend: box(".legend-panel"),
      mobileCitizenToggle: box("#mobile-citizen-toggle"),
      viewport: { width: innerWidth, height: innerHeight }
    };
  }, label);

  const visible = await measure("citizen-visible-or-mobile-default");
  await page.screenshot({
    path: `.codex_build/profile-scale-layout/${stage}/${viewport.name}-visible.png`,
    fullPage: false
  });

  let hidden = null;
  if (!viewport.mobile) {
    await toggle.click();
    await page.waitForTimeout(650);
    hidden = await measure("citizen-hidden");
    await page.screenshot({
      path: `.codex_build/profile-scale-layout/${stage}/${viewport.name}-hidden.png`,
      fullPage: false
    });
  }

  results.push({ name: viewport.name, visible, hidden });
  await context.close();
}

await browser.close();
await fs.writeFile(
  `.codex_build/profile-scale-layout/${stage}/metrics.json`,
  `${JSON.stringify(results, null, 2)}\n`,
  "utf8"
);
console.log(JSON.stringify(results, null, 2));
