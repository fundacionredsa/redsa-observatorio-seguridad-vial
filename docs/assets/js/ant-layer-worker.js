importScripts("vendor/supercluster.min.js");

const SUPERCLUSTER_OPTIONS = Object.freeze({
    radius: 48,
    maxZoom: 18,
    minPoints: 2
});
const MAX_CASES_PER_QUERY = 6000;

let activeRequestId = null;
let abortController = null;
let features = [];
let clusterIndex = null;
let metadata = null;

function matchesTerritory(feature, level, code) {
    const props = feature.properties || {};
    if (level === "province") return String(props.c || "").startsWith(String(code || "").padStart(2, "0"));
    if (level === "canton") return String(props.c || "") === String(code || "").padStart(4, "0");
    if (level === "parish") return String(props.p || "") === String(code || "").padStart(6, "0");
    return false;
}

function increment(counter, key) {
    const normalized = String(key ?? "");
    if (!normalized) return;
    counter[normalized] = (counter[normalized] || 0) + 1;
}

function summarizeTerritory(level, code) {
    const summary = {
        total: 0,
        injured: 0,
        fatalitiesOnSite: 0,
        types: {},
        causes: {},
        zones: {},
        weekdays: {},
        timeBands: {},
        vehicles: {}
    };
    for (const feature of features) {
        if (!matchesTerritory(feature, level, code)) continue;
        const props = feature.properties || {};
        summary.total += 1;
        summary.injured += Number(props.l || 0);
        summary.fatalitiesOnSite += Number(props.f || 0);
        increment(summary.types, props.t);
        increment(summary.causes, props.a);
        increment(summary.zones, props.z);
        increment(summary.weekdays, props.w);
        increment(summary.timeBands, props.h);
        for (const vehicle of (Array.isArray(props.v) ? props.v : [])) increment(summary.vehicles, vehicle);
    }
    return summary;
}

function insideBbox(feature, bbox) {
    const [lon, lat] = feature.geometry.coordinates;
    const [west, south, east, north] = bbox;
    if (west <= east) return lon >= west && lon <= east && lat >= south && lat <= north;
    return (lon >= west || lon <= east) && lat >= south && lat <= north;
}

function post(type, payload = {}) {
    self.postMessage({ type, requestId: activeRequestId, ...payload });
}

async function loadData(message) {
    activeRequestId = message.requestId;
    abortController?.abort();
    abortController = new AbortController();
    features = [];
    clusterIndex = null;
    metadata = null;

    const transferStarted = performance.now();
    const response = await fetch(message.url, {
        signal: abortController.signal,
        cache: "force-cache"
    });
    if (!response.ok) throw new Error(`No se pudo descargar la capa ANT (${response.status}).`);
    const buffer = await response.arrayBuffer();
    const transferMs = performance.now() - transferStarted;
    const encodedTransferBytes = Number(response.headers.get("content-length")) || null;
    if (message.requestId !== activeRequestId) return;

    const parseStarted = performance.now();
    const text = new TextDecoder("utf-8").decode(buffer);
    const data = JSON.parse(text);
    const parseMs = performance.now() - parseStarted;
    if (message.requestId !== activeRequestId) return;

    features = Array.isArray(data.features) ? data.features : [];
    metadata = data.metadata || {};
    const indexStarted = performance.now();
    clusterIndex = new Supercluster(SUPERCLUSTER_OPTIONS).load(features);
    const indexMs = performance.now() - indexStarted;
    const heatPoints = features.map(feature => {
        const [lon, lat] = feature.geometry.coordinates;
        return [lat, lon, 1];
    });

    post("loaded", {
        year: message.year,
        metadata,
        pointCount: features.length,
        heatPoints,
        metrics: {
            transferBytes: buffer.byteLength,
            encodedTransferBytes,
            transferMs,
            parseMs,
            indexMs,
            totalWorkerMs: transferMs + parseMs + indexMs
        }
    });
}

self.onmessage = async event => {
    const message = event.data || {};
    try {
        if (message.type === "cancel") {
            if (!message.requestId || message.requestId === activeRequestId) {
                abortController?.abort();
                activeRequestId = null;
            }
            return;
        }
        if (message.type === "load") {
            await loadData(message);
            return;
        }
        if (message.requestId !== activeRequestId || !clusterIndex) return;
        if (message.type === "clusters") {
            const started = performance.now();
            const clusters = clusterIndex.getClusters(message.bbox, Math.max(0, Math.min(18, message.zoom)));
            post("clusters", {
                queryId: message.queryId,
                clusters,
                queryMs: performance.now() - started
            });
            return;
        }
        if (message.type === "cases") {
            const started = performance.now();
            const matching = features.filter(feature => insideBbox(feature, message.bbox));
            post("cases", {
                queryId: message.queryId,
                totalVisible: matching.length,
                truncated: matching.length > MAX_CASES_PER_QUERY,
                features: matching.slice(0, MAX_CASES_PER_QUERY),
                queryMs: performance.now() - started
            });
            return;
        }
        if (message.type === "summary") {
            const started = performance.now();
            post("summary", {
                queryId: message.queryId,
                level: message.level,
                code: message.code,
                summary: summarizeTerritory(message.level, message.code),
                queryMs: performance.now() - started
            });
        }
    } catch (error) {
        if (error?.name === "AbortError") {
            post("cancelled");
        } else {
            post("error", { message: error?.message || String(error) });
        }
    }
};
