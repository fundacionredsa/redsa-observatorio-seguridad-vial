const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.addInitScript(() => localStorage.setItem("redsa-tour-completed", "true"));
  await page.goto("https://geoportal.observatorio.fundacionredsa.org/?verify=0.10.19", {
    waitUntil: "domcontentloaded",
    timeout: 120000
  });
  await page.waitForFunction(() => window.__redsaAudit !== undefined, null, { timeout: 120000 });
  await page.locator("#loader").waitFor({ state: "hidden", timeout: 120000 });
  const result = await page.evaluate(() => ({
    citizenTitle: document.getElementById("citizen-map-variable")?.textContent?.trim(),
    citizenMeta: document.getElementById("citizen-map-meta")?.textContent?.trim(),
    primaryClass: document.getElementById("open-analysis-button")?.className,
    legendTitle: document.querySelector(".legend-heading-title")?.textContent?.trim(),
    legendMeta: document.querySelector(".legend-heading-meta")?.textContent?.replace(/\s+/g, " ").trim()
  }));
  await page.screenshot({
    path: ".codex_build/production-language-hierarchy.png",
    fullPage: false
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
