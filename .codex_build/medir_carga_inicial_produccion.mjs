import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const CONFIG = {
  url: "https://geoportal.observatorio.fundacionredsa.org/",
  repetitions: 3,
  viewport: { width: 390, height: 844 },
  cpuRate: 4,
  network: {
    offline: false,
    latency: 150,
    downloadThroughput: 209715.2,
    uploadThroughput: 96000,
    connectionType: "cellular3g"
  }
};

const browser = await chromium.launch({ headless: true });
const runs = [];
try {
  for (let repetition = 1; repetition <= CONFIG.repetitions; repetition += 1) {
    const context = await browser.newContext({ viewport: CONFIG.viewport });
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", CONFIG.network);
    await client.send("Emulation.setCPUThrottlingRate", { rate: CONFIG.cpuRate });
    await page.addInitScript(() => {
      window.__longTasks = [];
      new PerformanceObserver(list => {
        window.__longTasks.push(...list.getEntries().map(entry => entry.duration));
      }).observe({ entryTypes: ["longtask"] });
      localStorage.setItem("redsa_tour_v2_visto", "true");
      localStorage.setItem("redsa_tour_seen", "true");
      localStorage.setItem("has_seen_geoportal_tour", "true");
    });
    const startedAt = Date.now();
    await page.goto(CONFIG.url, { waitUntil: "domcontentloaded", timeout: 120000 });
    const domReadyWallMs = Date.now() - startedAt;
    await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 120000 });
    await page.locator("#loader").waitFor({ state: "hidden", timeout: 120000 });
    const usableWallMs = Date.now() - startedAt;
    const evidence = await page.evaluate(() => {
      const resources = performance.getEntriesByType("resource").map(entry => ({
        name: new URL(entry.name).pathname.split("/").pop(),
        url: entry.name,
        transferSize: entry.transferSize || 0,
        encodedBodySize: entry.encodedBodySize || 0,
        decodedBodySize: entry.decodedBodySize || 0,
        durationMs: Math.round(entry.duration * 10) / 10
      }));
      const dataResources = resources.filter(entry =>
        entry.url.includes("/data/") &&
        (entry.url.includes(".geojson") || entry.url.includes(".json"))
      );
      return {
        internalMetrics: window.__redsaGeojsonLoadMetrics,
        requestCount: resources.length,
        totalTransferBytes: resources.reduce((sum, entry) => sum + entry.transferSize, 0),
        totalDecodedBytes: resources.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
        dataResources,
        dataTransferBytes: dataResources.reduce((sum, entry) => sum + entry.transferSize, 0),
        dataDecodedBytes: dataResources.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
        longTaskCount: window.__longTasks.length,
        longTaskDurationMs: Math.round(window.__longTasks.reduce((sum, value) => sum + value, 0))
      };
    });
    runs.push({ repetition, domReadyWallMs, usableWallMs, ...evidence });
    await context.close();
  }
} finally {
  await browser.close();
}

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const report = {
  generatedAt: new Date().toISOString(),
  environment: "Public deployment, Chromium mobile 390x844, isolated cache, 4x CPU, 1.6 Mbps down, 150 ms latency.",
  config: CONFIG,
  summary: {
    medianDomReadyWallMs: median(runs.map(run => run.domReadyWallMs)),
    medianUsableWallMs: median(runs.map(run => run.usableWallMs)),
    medianDataTransferBytes: median(runs.map(run => run.dataTransferBytes)),
    medianDataDecodedBytes: median(runs.map(run => run.dataDecodedBytes)),
    medianLongTaskCount: median(runs.map(run => run.longTaskCount)),
    medianLongTaskDurationMs: median(runs.map(run => run.longTaskDurationMs))
  },
  runs
};
await writeFile(
  new URL("./reporte_carga_inicial_produccion.json", import.meta.url),
  JSON.stringify(report, null, 2),
  "utf8"
);
console.log(JSON.stringify(report, null, 2));
