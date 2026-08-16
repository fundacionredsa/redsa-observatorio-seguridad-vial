import { chromium } from "playwright";

const BASE_URL = "https://geoportal.observatorio.fundacionredsa.org/";
const YEARS = [2024, 2025, 2026];
const scenarios = [
  { name: "desktop", viewport: { width: 1366, height: 768 }, cpu: 1, network: null },
  {
    name: "mobile_restringido",
    viewport: { width: 390, height: 844 },
    cpu: 4,
    network: {
      offline: false,
      latency: 150,
      downloadThroughput: 1_600_000 / 8,
      uploadThroughput: 750_000 / 8,
      connectionType: "cellular3g"
    }
  }
];

const browser = await chromium.launch({ headless: true });
const results = [];

for (const scenario of scenarios) {
  const context = await browser.newContext({ viewport: scenario.viewport });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: scenario.cpu });
  if (scenario.network) {
    await cdp.send("Network.emulateNetworkConditions", scenario.network);
  }

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(() => Boolean(window.L?.heatLayer), null, { timeout: 120_000 });
  await page.addScriptTag({ url: `${BASE_URL}assets/js/vendor/supercluster.min.js` });

  const metrics = await page.evaluate(async ({ baseUrl, years, viewport }) => {
    const urls = years.map(year =>
      `${baseUrl}data/siniestros_ant_${year}.geojson?audit_accumulated=${Date.now()}-${year}`
    );
    const transferStarted = performance.now();
    const responses = await Promise.all(urls.map(url => fetch(url, { cache: "no-store" })));
    const buffers = await Promise.all(responses.map(response => response.arrayBuffer()));
    const transferMs = performance.now() - transferStarted;

    const parseStarted = performance.now();
    const datasets = buffers.map(buffer =>
      JSON.parse(new TextDecoder("utf-8").decode(buffer))
    );
    const features = datasets.flatMap(dataset => dataset.features || []);
    const parseMs = performance.now() - parseStarted;

    const indexStarted = performance.now();
    const index = new Supercluster({ radius: 48, maxZoom: 18, minPoints: 2 }).load(features);
    const indexMs = performance.now() - indexStarted;

    const host = document.createElement("div");
    host.style.cssText = `position:fixed;left:0;top:0;width:${viewport.width}px;height:${viewport.height}px;z-index:-1`;
    document.body.appendChild(host);
    const map = L.map(host, { zoomControl: false, attributionControl: false }).setView([-1.45, -78.4], 6);
    map.createPane("auditEventPane");
    const heatPoints = features.map(feature => {
      const [lon, lat] = feature.geometry.coordinates;
      return [lat, lon, 1];
    });

    const nextPaint = () => new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    const heatStarted = performance.now();
    const heat = L.heatLayer(heatPoints, {
      pane: "auditEventPane",
      radius: 36,
      blur: 26,
      minOpacity: 0.18,
      maxZoom: 18
    }).addTo(map);
    await nextPaint();
    const heatRenderMs = performance.now() - heatStarted;
    map.removeLayer(heat);

    const bounds = map.getBounds();
    const queryStarted = performance.now();
    const clusters = index.getClusters(
      [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
      6
    );
    const clusterQueryMs = performance.now() - queryStarted;
    const clusterStarted = performance.now();
    const renderer = L.canvas({ pane: "auditEventPane", padding: 0.5 });
    const group = L.layerGroup(clusters.map(feature => {
      const [lon, lat] = feature.geometry.coordinates;
      return L.circleMarker([lat, lon], {
        pane: "auditEventPane",
        renderer,
        radius: 12,
        fillOpacity: 0.72
      });
    })).addTo(map);
    await nextPaint();
    const clusterRenderMs = performance.now() - clusterStarted;
    map.removeLayer(group);
    map.remove();
    host.remove();

    await new Promise(resolve => setTimeout(resolve, 250));
    const resources = performance.getEntriesByType("resource")
      .filter(entry => entry.name.includes("siniestros_ant_"))
      .slice(-years.length);
    return {
      points: features.length,
      decodedBytes: buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0),
      encodedBytes: resources.reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0),
      transferMs,
      parseMs,
      indexMs,
      heatRenderMs,
      clusterQueryMs,
      clusterRenderMs,
      clustersVisible: clusters.length,
      totalHeatReadyMs: transferMs + parseMs + indexMs + heatRenderMs,
      totalClustersReadyMs: transferMs + parseMs + indexMs + clusterQueryMs + clusterRenderMs
    };
  }, { baseUrl: BASE_URL, years: YEARS, viewport: scenario.viewport });

  results.push({ scenario: scenario.name, ...metrics });
  await context.close();
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
