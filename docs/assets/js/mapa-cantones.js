(() => {
  const DATA_URL = "./data/cantones_wgs84.geojson";
  const REQUIRED_ATTRIBUTION =
    "Limites cantonales: INEC/CONALI via datosabiertos.gob.ec, licencia CC-BY";
  const pageStart = performance.now();

  const statusEl = document.querySelector("#load-status");
  const featureMetricEl = document.querySelector("#metric-features");
  const provinceFilterEl = document.querySelector("#province-filter");

  const map = L.map("map", {
    attributionControl: true,
    zoomControl: false,
    preferCanvas: true,
  }).setView([-1.65, -78.55], 7);

  L.control.zoom({ position: "bottomright" }).addTo(map);
  map.attributionControl.setPrefix(false);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 18,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);

  map.attributionControl.addAttribution(REQUIRED_ATTRIBUTION);

  const baseStyle = {
    color: "#2f7d63",
    weight: 0.75,
    opacity: 0.92,
    fillColor: "#73b596",
    fillOpacity: 0.22,
  };

  const mutedStyle = {
    color: "#7c8b91",
    weight: 0.45,
    opacity: 0.45,
    fillColor: "#aab7bb",
    fillOpacity: 0.08,
  };

  const activeStyle = {
    color: "#1d5f49",
    weight: 1.6,
    opacity: 1,
    fillColor: "#2f7d63",
    fillOpacity: 0.34,
  };

  let geojsonLayer;

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function featureName(feature) {
    const props = feature.properties || {};
    const canton = props.DPA_DESCAN || "Canton sin nombre";
    const province = props.DPA_DESPRO ? `, ${props.DPA_DESPRO}` : "";
    return `${canton}${province}`;
  }

  function styleFeature(feature) {
    const selectedProvince = provinceFilterEl.value;
    if (!selectedProvince || feature.properties?.DPA_DESPRO === selectedProvince) {
      return baseStyle;
    }
    return mutedStyle;
  }

  function highlightFeature(event) {
    const layer = event.target;
    layer.setStyle(activeStyle);
    layer.bringToFront();
  }

  function resetHighlight(event) {
    geojsonLayer.resetStyle(event.target);
  }

  function populateProvinceFilter(features) {
    const provinces = [
      ...new Set(
        features
          .map((feature) => feature.properties?.DPA_DESPRO)
          .filter((province) => typeof province === "string" && province.length > 0),
      ),
    ].sort((a, b) => a.localeCompare(b, "es"));

    for (const province of provinces) {
      const option = document.createElement("option");
      option.value = province;
      option.textContent = province;
      provinceFilterEl.appendChild(option);
    }
  }

  function updateProvinceFilter() {
    const selectedProvince = provinceFilterEl.value;
    geojsonLayer.setStyle(styleFeature);
    if (!selectedProvince) {
      map.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20] });
      return;
    }

    const provinceLayers = [];
    geojsonLayer.eachLayer((layer) => {
      if (layer.feature?.properties?.DPA_DESPRO === selectedProvince) {
        provinceLayers.push(layer);
      }
    });

    const group = L.featureGroup(provinceLayers);
    if (provinceLayers.length) {
      map.fitBounds(group.getBounds(), { padding: [26, 26] });
    }
  }

  async function afterPaint() {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  async function loadCantones() {
    const fetchStart = performance.now();
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`No se pudo cargar ${DATA_URL}: HTTP ${response.status}`);
    }

    const text = await response.text();
    const fetchEnd = performance.now();
    const parseStart = performance.now();
    const data = JSON.parse(text);
    const parseEnd = performance.now();

    populateProvinceFilter(data.features || []);

    const renderStart = performance.now();
    geojsonLayer = L.geoJSON(data, {
      style: styleFeature,
      onEachFeature(feature, layer) {
        layer.bindTooltip(featureName(feature), {
          className: "canton-tooltip",
          sticky: true,
        });
        layer.on({
          mouseover: highlightFeature,
          mouseout: resetHighlight,
        });
      },
    }).addTo(map);

    map.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20] });
    provinceFilterEl.addEventListener("change", updateProvinceFilter);

    await afterPaint();
    const renderEnd = performance.now();
    const featureCount = data.features?.length || 0;
    const totalMs = renderEnd - pageStart;
    const resourceEntry = performance
      .getEntriesByName(new URL(DATA_URL, location.href).href)
      .at(-1);
    const metrics = {
      url: DATA_URL,
      bytes: text.length,
      features: featureCount,
      fetchMs: Math.round(fetchEnd - fetchStart),
      parseMs: Math.round(parseEnd - parseStart),
      renderMs: Math.round(renderEnd - renderStart),
      totalMs: Math.round(totalMs),
      networkDurationMs: Math.round(resourceEntry?.duration || fetchEnd - fetchStart),
      transferSize: resourceEntry?.transferSize || null,
      encodedBodySize: resourceEntry?.encodedBodySize || null,
      decodedBodySize: resourceEntry?.decodedBodySize || null,
    };

    window.__redsaGeojsonLoadMetrics = metrics;
    statusEl.dataset.featureCount = String(metrics.features);
    statusEl.dataset.fetchMs = String(metrics.fetchMs);
    statusEl.dataset.parseMs = String(metrics.parseMs);
    statusEl.dataset.renderMs = String(metrics.renderMs);
    statusEl.dataset.totalMs = String(metrics.totalMs);
    statusEl.dataset.networkDurationMs = String(metrics.networkDurationMs);
    statusEl.dataset.transferSize = metrics.transferSize ? String(metrics.transferSize) : "";
    statusEl.dataset.encodedBodySize = metrics.encodedBodySize ? String(metrics.encodedBodySize) : "";
    statusEl.dataset.decodedBodySize = metrics.decodedBodySize ? String(metrics.decodedBodySize) : "";
    window.dispatchEvent(new CustomEvent("redsa:geojson-rendered", { detail: metrics }));

    featureMetricEl.textContent = String(featureCount);
    setStatus(
      `Capa renderizada: ${featureCount} cantones en ${(metrics.totalMs / 1000).toFixed(2)} s.`,
    );
  }

  loadCantones().catch((error) => {
    console.error(error);
    setStatus("No se pudo cargar la capa cantonal. Revisa la consola del navegador.");
  });
})();
