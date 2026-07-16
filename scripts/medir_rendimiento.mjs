import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const CONFIG = {
  baseURL: "http://127.0.0.1:4175/docs/",
  outputURL: new URL("../artifacts/performance/reporte_rendimiento.json", import.meta.url),
  repetitions: 3,
  viewports: {
    desktop: { width: 1366, height: 768 },
    mobile: { width: 390, height: 844 }
  }
};

const server = spawn("python", ["-m", "http.server", "4175"], { stdio: "ignore" });

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(CONFIG.baseURL);
      if (response.ok) return;
    } catch {
      // El proceso puede tardar unos instantes en abrir el puerto.
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`El servidor local no respondio en ${CONFIG.baseURL}`);
}

function median(values) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)];
}

await mkdir(new URL("../artifacts/performance/", import.meta.url), { recursive: true });
const browser = await chromium.launch({ headless: true });
const runs = [];

try {
  await waitForServer();
  for (const [viewportName, viewport] of Object.entries(CONFIG.viewports)) {
    for (let repetition = 1; repetition <= CONFIG.repetitions; repetition += 1) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const startedAt = Date.now();
      await page.goto(CONFIG.baseURL, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
      await page.locator("#loader").waitFor({ state: "hidden", timeout: 90_000 });
      const wallMs = Date.now() - startedAt;
      const pageEvidence = await page.evaluate(() => {
        const resources = performance.getEntriesByType("resource")
          .filter(entry => entry.name.includes(".geojson"))
          .map(entry => ({
            name: entry.name.split("/").pop(),
            durationMs: Math.round(entry.duration * 100) / 100,
            transferSize: entry.transferSize || null,
            decodedBodySize: entry.decodedBodySize || null
          }));
        return {
          internalMetrics: window.__redsaGeojsonLoadMetrics,
          resources
        };
      });
      runs.push({ viewport: viewportName, repetition, wallMs, ...pageEvidence });
      await context.close();
    }
  }

  const summary = Object.fromEntries(Object.keys(CONFIG.viewports).map(viewportName => {
    const selected = runs.filter(run => run.viewport === viewportName);
    return [viewportName, {
      medianWallMs: median(selected.map(run => run.wallMs)),
      medianInternalTotalMs: median(selected.map(run => run.internalMetrics.totalMs)),
      thresholdExceeded: median(selected.map(run => run.wallMs)) > 4000
    }];
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    environment: "servidor HTTP local, Chromium headless, cache aislada por corrida",
    config: CONFIG,
    summary,
    runs
  };
  await writeFile(CONFIG.outputURL, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
  server.kill();
}
