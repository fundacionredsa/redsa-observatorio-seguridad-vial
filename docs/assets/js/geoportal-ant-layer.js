(function () {
    // El worker forma parte del runtime de esta capa, no del dataset. Vincularlo
    // a la version del script evita mezclar implementaciones tras un despliegue.
    const ANT_LAYER_RUNTIME_VERSION = (() => {
        const scriptUrl = document.currentScript?.src;
        if (!scriptUrl) return "current";
        return new URL(scriptUrl, document.baseURI).searchParams.get("v") || "current";
    })();
    const MAX_CACHED_YEARS = 1;
    const CLUSTER_QUERY_DEBOUNCE_MS = 90;
    const SPIDERFY_RADIUS_PX = 18;
    const CASE_RADIUS_PX = 4;
    const CLUSTER_COLOR = "#0f766e";
    const CASE_COLOR = "#7c2d12";
    const CLUSTER_RADIUS_MIN = 10;
    const CLUSTER_RADIUS_MAX = 22;
    const CLUSTER_RADIUS_BASE = 8;
    const CLUSTER_RADIUS_SCALE = 2;
    const CLUSTER_FILL_OPACITY = 0.72;
    const compactNumber = new Intl.NumberFormat("es-EC", {
        notation: "compact",
        maximumFractionDigits: 1
    });
    const HEAT_GRADIENT = Object.freeze({
        0.12: "#000004",
        0.32: "#51127c",
        0.52: "#b73779",
        0.72: "#fc8961",
        0.90: "#feca8d",
        1.00: "#fcfdbf"
    });
    const HEAT_BANDWIDTH_PROFILES = Object.freeze({
        focused: [
            { maxZoom: 6, meters: 18000 },
            { maxZoom: 9, meters: 5500 },
            { maxZoom: 12, meters: 900 },
            { maxZoom: 13, meters: 450 },
            { maxZoom: 15, meters: 280 },
            { maxZoom: 99, meters: 180 }
        ],
        balanced_provisional: [
            { maxZoom: 6, meters: 26000 },
            { maxZoom: 9, meters: 8000 },
            { maxZoom: 12, meters: 2400 },
            { maxZoom: 15, meters: 700 },
            { maxZoom: 99, meters: 250 }
        ],
        broad: [
            { maxZoom: 6, meters: 38000 },
            { maxZoom: 9, meters: 12000 },
            { maxZoom: 12, meters: 3600 },
            { maxZoom: 15, meters: 1100 },
            { maxZoom: 99, meters: 400 }
        ]
    });

    const state = {
        initialized: false,
        active: false,
        mode: "heat",
        periodMode: "year",
        year: null,
        loadedYear: null,
        heatLoadedYear: null,
        fullLoadedYear: null,
        dataSource: null,
        loadKind: null,
        status: "idle",
        requestId: null,
        queryId: 0,
        worker: null,
        heatPoints: null,
        metadata: null,
        metrics: null,
        heatMetrics: null,
        fullMetrics: null,
        pointCount: 0,
        layer: null,
        map: null,
        heatPane: "antHeatPane",
        eventPane: "eventPane",
        heatOpacity: 0.8,
        config: null,
        context: null,
        renderMetrics: {},
        queryTimer: null,
        cacheYears: [],
        selectedTerritory: null,
        bandwidthProfile: "focused",
        activationStartedAt: null,
        activationCacheHit: false,
        activationReadyTracked: false,
        fullLoadPending: false
    };

    function connectionType() {
        return navigator.connection?.effectiveType || "unknown";
    }

    function trackAntEvent(name, parameters = {}) {
        if (typeof window.gtag !== "function") return;
        window.gtag("event", name, {
            year: Number(state.year),
            mode: state.mode,
            connection_type: connectionType(),
            ...parameters
        });
    }

    function trackReadyOnce() {
        if (state.activationReadyTracked || !Number.isFinite(state.activationStartedAt)) return;
        state.activationReadyTracked = true;
        trackAntEvent("ant_layer_ready", {
            duration_ms: Math.round(performance.now() - state.activationStartedAt),
            cache_hit: state.activationCacheHit,
            data_kind: state.metrics?.dataKind || state.dataSource || "unknown"
        });
    }

    function availableYears() {
        return (state.config?.temporal?.anios_disponibles || []).map(Number);
    }

    function isYearAvailable(year = state.year) {
        return availableYears().includes(Number(year)) && Boolean(state.config?.urlByYear?.[String(year)]);
    }

    function hasHeatData(year = state.year) {
        return Boolean(state.heatPoints) && state.heatLoadedYear === Number(year);
    }

    function hasFullData(year = state.year) {
        return Boolean(state.worker) && state.fullLoadedYear === Number(year);
    }

    function dataReadyForMode(mode = state.mode, year = state.year) {
        return mode === "heat" ? hasHeatData(year) : hasHeatData(year) || hasFullData(year);
    }

    function auditForYear(year = state.year) {
        return state.config?.auditByYear?.[String(year)] || null;
    }

    function periodForYear(year = state.year) {
        return auditForYear(year)?.periodLabel || state.config?.temporal?.etiquetas_periodo?.[String(year)] || String(year);
    }

    function coverageText(year = state.year) {
        const audit = auditForYear(year);
        if (!audit) return "";
        const details = [
            `sin ubicación: ${Number(audit.noLocation || 0).toLocaleString("es-EC")}`,
            `ubicación no verificable: ${Number(audit.unverifiableLocation || 0).toLocaleString("es-EC")}`
        ];
        if (Number(audit.invalidDate || 0) > 0) {
            details.push(`fecha no publicable: ${Number(audit.invalidDate).toLocaleString("es-EC")}`);
        }
        return `${periodForYear(year)}: ${Number(audit.publishedLocations).toLocaleString("es-EC")} de ${Number(audit.totalEvents).toLocaleString("es-EC")} puntos publicados; ${details.join("; ")}.`;
    }

    function isAccumulatedMode() {
        return state.periodMode === "accumulated";
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function dictionaryValue(name, key, fallback = "No especificado") {
        return state.metadata?.[name]?.[String(key)] || fallback;
    }

    function humanizeDictionaryValue(value) {
        return String(value || "No especificado")
            .replaceAll("_", " ")
            .toLocaleLowerCase("es-EC")
            .replace(/(^|\s)\p{L}/gu, match => match.toLocaleUpperCase("es-EC"));
    }

    function getBandwidthMeters(zoom = state.map?.getZoom() || 6) {
        const profileName = state.bandwidthProfile;
        const profile = HEAT_BANDWIDTH_PROFILES[profileName] || HEAT_BANDWIDTH_PROFILES.focused;
        return profile.find(item => zoom <= item.maxZoom)?.meters || profile.at(-1).meters;
    }

    function metersToPixels(meters, zoom, latitude) {
        const metersPerPixel = 156543.03392 * Math.cos(latitude * Math.PI / 180) / (2 ** zoom);
        return Math.max(10, Math.min(64, Math.round(meters / Math.max(metersPerPixel, 0.01))));
    }

    function currentBoundsArray() {
        const bounds = state.map.getBounds();
        return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    }

    function disablePanePointerEvents(paneName) {
        const pane = state.map?.getPane(paneName);
        if (pane) {
            pane.style.pointerEvents = "none";
            pane.querySelectorAll("canvas, div, svg").forEach(el => {
                el.style.pointerEvents = "none";
            });
        }
    }

    function findAntMarkerAtLatLng(latlng) {
        if (!state.active || !state.layer || state.mode === "heat" || !state.map || !latlng) return null;
        const point = state.map.latLngToLayerPoint(latlng);
        let found = null;
        if (typeof state.layer.eachLayer === "function") {
            state.layer.eachLayer(marker => {
                if (!found && typeof marker._containsPoint === "function" && marker._containsPoint(point)) {
                    found = marker;
                }
            });
        }
        return found;
    }

    function handleAntMapClick(e) {
        if (!state.active || state.status !== "ready") return;
        const marker = findAntMarkerAtLatLng(e.latlng);
        if (marker) {
            if (typeof marker.fire === "function") {
                marker.fire("click", e);
            }
            if (e.originalEvent) {
                L.DomEvent.stopPropagation(e.originalEvent);
            }
        }
    }

    function handleAntMapMouseMove(e) {
        if (!state.active || state.status !== "ready") return;
        const marker = findAntMarkerAtLatLng(e.latlng);
        if (marker) {
            state.map.getContainer().style.cursor = "pointer";
        }
    }

    function removeCurrentLayer() {
        if (state.layer && state.map.hasLayer(state.layer)) state.map.removeLayer(state.layer);
        state.layer = null;
    }

    function setStatus(status, detail = "") {
        state.status = status;
        const statusNode = document.getElementById("ant-layer-status");
        if (statusNode) {
            const messages = {
                idle: `Modo anual · ${periodForYear()}. Activa la capa para descargar únicamente este periodo.`,
                loading: `Descargando y preparando ${state.year}…`,
                ready: coverageText(),
                unavailable: `No disponible para este periodo. Siniestros (ANT) tiene datos en ${availableYears().join(", ")}.`,
                period_unavailable: "Esta capa se muestra solo por año; no está disponible en modo acumulado. Vuelve a “Año seleccionado” para activarla.",
                error: "No se pudo cargar la capa. Intenta nuevamente.",
                cancelled: "Carga cancelada al cambiar de año."
            };
            statusNode.textContent = detail || messages[status] || "";
        }
        state.context?.onStateChange?.();
        window.REDSAOverlayState?.notify();
    }

    function syncControls() {
        const toggle = document.getElementById("ant-layer-toggle");
        const jumpButton = document.getElementById("ant-jump-year");
        const heatOpacityControl = document.getElementById("ant-heat-opacity-control");
        if (toggle) {
            toggle.checked = state.active;
            toggle.disabled = isAccumulatedMode();
            toggle.setAttribute("aria-disabled", String(isAccumulatedMode()));
            toggle.title = isAccumulatedMode()
                ? "Disponible únicamente en modo Año seleccionado"
                : "Mostrar los siniestros ANT del año seleccionado";
        }
        document.querySelectorAll('[data-legend-layer-toggle="siniestros_ant"]').forEach(el => {
            el.checked = state.active;
        });
        document.querySelector(".event-layer-toggle")?.classList.toggle(
            "period-unavailable",
            isAccumulatedMode() || (state.active && !isYearAvailable())
        );
        const latestYear = Math.max(...availableYears());
        if (jumpButton) jumpButton.hidden = isAccumulatedMode() || !state.active || isYearAvailable() || state.year === latestYear;
        document.querySelectorAll("[data-ant-mode]").forEach(button => {
            const active = button.dataset.antMode === state.mode;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
            button.disabled = isAccumulatedMode() || !state.active || state.status !== "ready" || state.year !== state.loadedYear;
        });
        if (heatOpacityControl) heatOpacityControl.hidden = !(state.active && state.mode === "heat" && !isAccumulatedMode());
    }

    function setHeatOpacity(value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return;
        state.heatOpacity = Math.max(0.2, Math.min(1, numericValue));
        const pane = state.map?.getPane(state.heatPane);
        if (pane) pane.style.opacity = String(state.heatOpacity);
        const percentage = Math.round(state.heatOpacity * 100);
        const slider = document.getElementById("ant-heat-opacity-slider");
        const output = document.getElementById("ant-heat-opacity-value");
        if (slider && Number(slider.value) !== percentage) slider.value = String(percentage);
        if (output) output.value = `${percentage}%`;
    }

    function cancelPending(reason = "cancelled") {
        if (state.worker && state.requestId && (state.status === "loading" || state.fullLoadPending)) {
            state.worker.postMessage({ type: "cancel", requestId: state.requestId });
            state.worker.terminate();
            state.worker = null;
            state.requestId = null;
            state.fullLoadPending = false;
            trackAntEvent("ant_layer_load_cancelled", {
                duration_ms: Number.isFinite(state.activationStartedAt)
                    ? Math.round(performance.now() - state.activationStartedAt)
                    : 0,
                cache_hit: false
            });
            setStatus(reason);
        }
    }

    function clearCachedYear() {
        state.worker?.terminate();
        state.worker = null;
        state.requestId = null;
        state.loadedYear = null;
        state.heatLoadedYear = null;
        state.fullLoadedYear = null;
        state.dataSource = null;
        state.loadKind = null;
        state.heatPoints = null;
        state.metadata = null;
        state.metrics = null;
        state.heatMetrics = null;
        state.fullMetrics = null;
        state.pointCount = 0;
        state.cacheYears = [];
        state.fullLoadPending = false;
    }

    function createWorker() {
        state.worker?.terminate();
        const workerUrl = new URL("assets/js/ant-layer-worker.js", document.baseURI);
        workerUrl.searchParams.set("v", ANT_LAYER_RUNTIME_VERSION);
        state.worker = new Worker(workerUrl.href);
        state.worker.onmessage = handleWorkerMessage;
        state.worker.onerror = event => {
            console.error("Worker ANT:", event.message);
            trackAntEvent("ant_layer_load_error", {
                duration_ms: Number.isFinite(state.activationStartedAt)
                    ? Math.round(performance.now() - state.activationStartedAt)
                    : 0,
                cache_hit: false
            });
            setStatus("error");
        };
        return state.worker;
    }

    function loadYear() {
        if (!state.active || !isYearAvailable()) return;
        if (state.cacheYears.length && !state.cacheYears.includes(state.year)) {
            clearCachedYear();
        }
        // El compacto permite el primer dibujo de cualquier modo. Los
        // atributos completos se incorporan luego sin bloquear el mapa.
        const requestedKind = hasHeatData() || hasFullData() ? "full" : "heat";
        const cached = dataReadyForMode();
        state.activationStartedAt = performance.now();
        state.activationCacheHit = cached;
        state.activationReadyTracked = false;
        trackAntEvent("ant_layer_activation_start", {
            cache_hit: state.activationCacheHit,
            data_kind: cached
                ? (hasFullData() ? "full-geojson" : "heat-compact")
                : requestedKind
        });
        if (cached) {
            state.loadedYear = state.year;
            state.dataSource = hasFullData() ? "full-geojson" : "heat-compact";
            state.metrics = hasFullData() ? state.fullMetrics : state.heatMetrics;
            setStatus("ready");
            syncControls();
            renderCurrentMode();
            requestTerritorySummary();
            ensureFullDetails();
            return;
        }
        removeCurrentLayer();
        setStatus("loading");
        syncControls();
        const requestedYear = state.year;
        const requestId = `ant-${requestedKind}-${requestedYear}-${Date.now()}`;
        state.requestId = requestId;
        state.loadKind = requestedKind;
        const worker = createWorker();
        const urlByYear = requestedKind === "heat"
            ? state.config.heatUrlByYear
            : state.config.urlByYear;
        const dataUrl = new URL(urlByYear[String(requestedYear)], document.baseURI);
        if (state.config?.assetVersion) dataUrl.searchParams.set("v", state.config.assetVersion);
        worker.postMessage({
            type: requestedKind === "heat" ? "load-heat" : "load-full",
            requestId,
            year: requestedYear,
            url: dataUrl.href
        });
    }

    function ensureFullDetails() {
        if (
            !state.active
            || state.mode === "heat"
            || !hasHeatData()
            || hasFullData()
            || state.fullLoadPending
            || !state.worker
            || !state.requestId
        ) return;
        const dataUrl = new URL(state.config.urlByYear[String(state.year)], document.baseURI);
        if (state.config?.assetVersion) dataUrl.searchParams.set("v", state.config.assetVersion);
        state.fullLoadPending = true;
        state.loadKind = "full-background";
        state.worker.postMessage({
            type: "load-full",
            requestId: state.requestId,
            year: state.year,
            url: dataUrl.href
        });
    }

    function handleWorkerMessage(event) {
        const message = event.data || {};
        if (message.requestId !== state.requestId) return;
        if (message.type === "heat-loaded") {
            if (Number(message.year) !== state.year) return;
            state.heatPoints = message.heatPoints;
            state.metrics = message.metrics;
            state.heatMetrics = message.metrics;
            state.loadedYear = Number(message.year);
            state.heatLoadedYear = state.loadedYear;
            state.fullLoadedYear = null;
            state.dataSource = "heat-compact";
            state.loadKind = null;
            state.pointCount = Number(message.pointCount);
            state.cacheYears = [state.loadedYear].slice(-MAX_CACHED_YEARS);
            setStatus("ready");
            syncControls();
            renderCurrentMode();
            ensureFullDetails();
            return;
        }
        if (message.type === "full-loaded") {
            if (Number(message.year) !== state.year) return;
            state.fullLoadPending = false;
            if (hasHeatData(message.year) && state.heatPoints.length !== Number(message.pointCount)) {
                console.error("El conteo ANT difiere entre el compacto de calor y el GeoJSON completo.");
                setStatus("error");
                syncControls();
                return;
            }
            state.metadata = message.metadata;
            state.heatPoints = message.heatPoints;
            state.metrics = message.metrics;
            state.fullMetrics = message.metrics;
            state.loadedYear = Number(message.year);
            state.heatLoadedYear = state.loadedYear;
            state.fullLoadedYear = state.loadedYear;
            state.dataSource = "full-geojson";
            state.loadKind = null;
            state.pointCount = Number(message.pointCount);
            state.cacheYears = [state.loadedYear].slice(-MAX_CACHED_YEARS);
            setStatus("ready");
            syncControls();
            renderCurrentMode();
            requestTerritorySummary();
            return;
        }
        if (message.type === "clusters") renderClusters(message);
        if (message.type === "cases") renderCases(message);
        if (message.type === "summary") renderTerritorySummary(message);
        if (message.type === "error") {
            console.error(message.message);
            if (state.fullLoadPending && hasHeatData()) {
                state.fullLoadPending = false;
                state.loadKind = null;
                setStatus("ready", `La vista está disponible. No se pudo cargar el detalle; puedes volver a intentarlo cambiando de modo. Cobertura: ${coverageText()}`);
                syncControls();
                return;
            }
            trackAntEvent("ant_layer_load_error", {
                duration_ms: Number.isFinite(state.activationStartedAt)
                    ? Math.round(performance.now() - state.activationStartedAt)
                    : 0,
                cache_hit: false
            });
            setStatus("error");
            syncControls();
        }
    }

    function renderHeat() {
        if (!state.heatPoints || !window.L?.heatLayer) return;
        const started = performance.now();
        const zoom = state.map.getZoom();
        const centerLat = state.map.getCenter().lat;
        const bandwidthMeters = getBandwidthMeters(zoom);
        const radius = metersToPixels(bandwidthMeters, zoom, centerLat);
        removeCurrentLayer();
        state.layer = L.heatLayer(state.heatPoints, {
            pane: state.heatPane,
            radius,
            blur: Math.max(12, Math.round(radius * 0.50)),
            minOpacity: 0.18,
            maxZoom: 18,
            gradient: HEAT_GRADIENT
        }).addTo(state.map);
        state.layer.getPane?.()?.classList.add("ant-heat-surface-pane");
        const heatPane = state.map.getPane(state.heatPane);
        if (heatPane) heatPane.style.opacity = String(state.heatOpacity);
        disablePanePointerEvents(state.heatPane);
        state.renderMetrics.heat = {
            renderMs: performance.now() - started,
            zoom,
            bandwidthMeters,
            radiusPx: radius
        };
        setStatus("ready");
        trackReadyOnce();
    }

    function requestViewport(type) {
        if (!state.worker || state.status !== "ready" || !hasHeatData()) return;
        state.queryId += 1;
        state.worker.postMessage({
            type,
            requestId: state.requestId,
            queryId: state.queryId,
            bbox: currentBoundsArray(),
            zoom: Math.round(state.map.getZoom())
        });
    }

    function clusterMarker(feature, renderer) {
        const [lon, lat] = feature.geometry.coordinates;
        const props = feature.properties || {};
        if (!props.cluster) return caseMarker(feature, [lat, lon], renderer, false);
        const count = Number(props.point_count || 0);
        const radius = Math.max(
            CLUSTER_RADIUS_MIN,
            Math.min(CLUSTER_RADIUS_MAX, CLUSTER_RADIUS_BASE + Math.log2(Math.max(count, 2)) * CLUSTER_RADIUS_SCALE)
        );
        const marker = L.circleMarker([lat, lon], {
            renderer,
            pane: state.eventPane,
            radius,
            color: "#ecfeff",
            weight: 2,
            fillColor: CLUSTER_COLOR,
            fillOpacity: CLUSTER_FILL_OPACITY
        });
        marker.bindTooltip(compactNumber.format(count), {
            permanent: true,
            direction: "center",
            className: "ant-cluster-label"
        });
        marker.on("click", () => {
            const expansionZoom = Math.min(18, state.worker ? state.map.getZoom() + 2 : state.map.getZoom() + 1);
            state.map.setView([lat, lon], expansionZoom);
        });
        return marker;
    }

    function renderClusters(message) {
        if (message.queryId !== state.queryId || state.mode !== "clusters") return;
        const started = performance.now();
        removeCurrentLayer();
        const renderer = L.canvas({ padding: 0.5, pane: state.eventPane });
        state.layer = L.layerGroup(message.clusters.map(feature => clusterMarker(feature, renderer))).addTo(state.map);
        disablePanePointerEvents(state.eventPane);
        if (renderer._container) renderer._container.style.pointerEvents = "none";
        state.renderMetrics.clusters = {
            renderMs: performance.now() - started,
            queryMs: message.queryMs,
            visibleObjects: message.clusters.length,
            zoom: state.map.getZoom()
        };
        const detailStatus = message.detailReady ? "" : " Preparando el detalle en segundo plano.";
        setStatus("ready", `${message.clusters.length.toLocaleString("es-EC")} agrupaciones o casos visibles. Cobertura: ${coverageText()}${detailStatus}`);
        trackReadyOnce();
    }

    function decodedCaseProperties(properties) {
        return {
            month: Number(properties.m),
            weekday: Number(properties.w),
            timeBand: dictionaryValue("diccionario_franjas", properties.h),
            zone: dictionaryValue("diccionario_zonas", properties.z),
            type: dictionaryValue("diccionario_tipos", properties.t),
            cause: dictionaryValue("diccionario_causas", properties.a),
            fatalities: Number(properties.f || 0),
            injured: Number(properties.l || 0),
            vehicles: (properties.v || []).map(code => dictionaryValue("diccionario_vehiculos", code)).join(", ") || "No especificado",
            coordinateQuality: properties.q
                ? "Coordenada corregida de forma inequívoca"
                : "Coordenada válida de la fuente"
        };
    }

    function casePopupContent(feature, displaced) {
        const isCompact = Boolean(feature.properties?._compact);
        if (isCompact) return `
            <div class="ant-case-popup">
                <strong>Siniestro registrado por ANT</strong>
                <p>El caso ya está ubicado en el mapa. Preparando el detalle del registro…</p>
                <small>Fuente: ANT.</small>
            </div>
        `;
        const values = decodedCaseProperties(feature.properties || {});
        return `
            <div class="ant-case-popup">
                <strong>Siniestro registrado por ANT</strong>
                <dl>
                    <dt>Periodo</dt><dd>${escapeHtml(values.month)}/${escapeHtml(state.loadedYear)} · ${escapeHtml(["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"][values.weekday - 1] || "día no especificado")}</dd>
                    <dt>Franja horaria</dt><dd>${escapeHtml(values.timeBand.replaceAll("_", " "))}</dd>
                    <dt>Tipo registrado</dt><dd>${escapeHtml(values.type)}</dd>
                    <dt>Causa probable registrada por la entidad de control</dt><dd>${escapeHtml(values.cause)}</dd>
                    <dt>Personas lesionadas</dt><dd>${values.injured}</dd>
                    <dt>Fallecidos en sitio</dt><dd>${values.fatalities}</dd>
                    <dt>Vehículos involucrados</dt><dd>${escapeHtml(values.vehicles)}</dd>
                    <dt>Calidad de ubicación</dt><dd>${escapeHtml(values.coordinateQuality)}${displaced ? "; símbolo desplazado para separar casos coincidentes" : ""}</dd>
                </dl>
                <small>Fuente: ANT. La causa es un registro administrativo probable, no una conclusión causal.</small>
            </div>
        `;
    }

    function caseMarker(feature, latlng, renderer, displaced) {
        const marker = L.circleMarker(latlng, {
            renderer,
            pane: state.eventPane,
            radius: CASE_RADIUS_PX,
            color: "#fff7ed",
            weight: 1.2,
            fillColor: CASE_COLOR,
            fillOpacity: 0.88
        });
        // Preparar 6.000 fichas completas bloqueaba el hilo principal. Leaflet
        // acepta una función y construye el contenido solo al abrir el caso.
        marker.bindPopup(() => casePopupContent(feature, displaced), { maxWidth: 340 });
        marker.on("click", event => state.context?.selectTerritoryBelow?.(event.latlng));
        return marker;
    }

    function spiderfiedLatLng(feature, groupIndex, groupSize) {
        const [lon, lat] = feature.geometry.coordinates;
        if (groupSize <= 1) return [lat, lon];
        const zoom = state.map.getZoom();
        const center = state.map.project([lat, lon], zoom);
        const angle = (Math.PI * 2 * groupIndex) / groupSize;
        const ring = SPIDERFY_RADIUS_PX + Math.floor(groupIndex / 10) * 9;
        return state.map.unproject([
            center.x + Math.cos(angle) * ring,
            center.y + Math.sin(angle) * ring
        ], zoom);
    }

    function renderCases(message) {
        if (message.queryId !== state.queryId || state.mode !== "cases") return;
        const started = performance.now();
        removeCurrentLayer();
        const renderer = L.canvas({ padding: 0.5, pane: state.eventPane });
        const groups = new Map();
        message.features.forEach(feature => {
            const key = feature.geometry.coordinates.join(",");
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(feature);
        });
        const markers = [];
        groups.forEach(group => group.forEach((feature, index) => {
            markers.push(caseMarker(
                feature,
                spiderfiedLatLng(feature, index, group.length),
                renderer,
                group.length > 1
            ));
        }));
        state.layer = L.layerGroup(markers).addTo(state.map);
        disablePanePointerEvents(state.eventPane);
        if (renderer._container) renderer._container.style.pointerEvents = "none";
        state.renderMetrics.cases = {
            renderMs: performance.now() - started,
            queryMs: message.queryMs,
            visibleCases: markers.length,
            totalVisible: message.totalVisible,
            truncated: message.truncated,
            zoom: state.map.getZoom()
        };
        const detail = !message.detailReady
            ? `${markers.length.toLocaleString("es-EC")} casos visibles. Preparando el detalle en segundo plano.`
            : message.truncated
            ? `${message.totalVisible.toLocaleString("es-EC")} casos están en la vista; se dibujan 6.000. Acerca el mapa para verlos todos.`
            : `${markers.length.toLocaleString("es-EC")} casos visibles. Cobertura: ${coverageText()}`;
        setStatus("ready", detail);
        trackReadyOnce();
    }

    function topRows(counter, dictionaryName, limit = 5) {
        return Object.entries(counter || {})
            .sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0])))
            .slice(0, limit)
            .map(([key, count]) => {
                const label = dictionaryName
                    ? humanizeDictionaryValue(dictionaryValue(dictionaryName, key))
                    : key;
                return `<li><span>${escapeHtml(label)}</span><strong>${Number(count).toLocaleString("es-EC")}</strong></li>`;
            })
            .join("");
    }

    function renderTerritorySummary(message) {
        if (!state.selectedTerritory ||
            message.level !== state.selectedTerritory.level ||
            String(message.code) !== String(state.selectedTerritory.code)) return;
        const container = document.getElementById("ant-territory-analysis-content");
        const status = document.getElementById("ant-territory-analysis-status");
        if (!container || !status) return;
        const summary = message.summary || {};
        status.textContent = summary.total
            ? `${Number(summary.total).toLocaleString("es-EC")} siniestros con ubicación válida en ${state.loadedYear}.`
            : `No hay siniestros con ubicación válida para esta unidad en ${state.loadedYear}.`;
        container.hidden = !summary.total;
        if (!summary.total) {
            container.replaceChildren();
            return;
        }
        const weekdayLabels = {
            "1": "Lunes", "2": "Martes", "3": "Miércoles", "4": "Jueves",
            "5": "Viernes", "6": "Sábado", "7": "Domingo"
        };
        const weekdayRows = Object.entries(summary.weekdays || {})
            .sort((left, right) => right[1] - left[1])
            .slice(0, 3)
            .map(([key, count]) => `<li><span>${weekdayLabels[key] || "No especificado"}</span><strong>${Number(count).toLocaleString("es-EC")}</strong></li>`)
            .join("");
        container.innerHTML = `
            <div class="ant-summary-totals">
                <span><strong>${Number(summary.total).toLocaleString("es-EC")}</strong> siniestros</span>
                <span><strong>${Number(summary.injured).toLocaleString("es-EC")}</strong> personas lesionadas</span>
                <span><strong>${Number(summary.fatalitiesOnSite).toLocaleString("es-EC")}</strong> fallecidos en sitio</span>
            </div>
            <div class="ant-summary-grid">
                <section><h4>Tipos registrados</h4><ul>${topRows(summary.types, "diccionario_tipos")}</ul></section>
                <section><h4>Causas probables registradas</h4><ul>${topRows(summary.causes, "diccionario_causas", 3)}</ul></section>
                <section><h4>Zona y momento</h4><ul>${topRows(summary.zones, "diccionario_zonas", 2)}${weekdayRows}${topRows(summary.timeBands, "diccionario_franjas", 2)}</ul></section>
                <section><h4>Vehículos involucrados</h4><ul>${topRows(summary.vehicles, "diccionario_vehiculos")}</ul></section>
            </div>
            <p class="ant-summary-method">Fuente: ANT, ${escapeHtml(periodForYear(state.loadedYear))}. “Causa probable” reproduce la clasificación registrada por la entidad de control; no establece responsabilidad. Estas son distribuciones de una característica. Las tabulaciones cruzadas de múltiples atributos aplican un umbral mínimo de 5 casos.</p>`;
    }

    function requestTerritorySummary() {
        const status = document.getElementById("ant-territory-analysis-status");
        const container = document.getElementById("ant-territory-analysis-content");
        if (!state.selectedTerritory) {
            if (status) status.textContent = "Selecciona una unidad territorial para ver este análisis.";
            if (container) container.hidden = true;
            return;
        }
        if (
            !state.active
            || state.status !== "ready"
            || state.year !== state.loadedYear
            || !hasFullData()
        ) {
            if (status) status.textContent = isAccumulatedMode()
                ? "El análisis de Siniestros (ANT) se muestra solo por año y no está disponible en modo acumulado."
                : !isYearAvailable()
                    ? `Este análisis puntual está disponible en ${availableYears().join(", ")}.`
                    : state.active && hasHeatData()
                        ? "El detalle territorial se prepara al usar Agrupaciones o Casos."
                        : "Activa “Siniestros (ANT)” en Datos y capas para consultar los patrones de esta unidad.";
            if (container) container.hidden = true;
            return;
        }
        if (status) status.textContent = "Calculando patrones de la unidad seleccionada…";
        state.queryId += 1;
        state.worker.postMessage({
            type: "summary",
            requestId: state.requestId,
            queryId: state.queryId,
            level: state.selectedTerritory.level,
            code: state.selectedTerritory.code
        });
    }

    function syncTerritory(level, props) {
        if (!level || !props) {
            state.selectedTerritory = null;
            requestTerritorySummary();
            return;
        }
        const code = level === "province"
            ? props.DPA_PROVIN
            : level === "parish"
            ? props.DPA_PARROQ
            : props.DPA_CANTON;
        state.selectedTerritory = { level, code: String(code || "") };
        requestTerritorySummary();
    }

    function renderCurrentMode() {
        if (!state.active || state.status !== "ready" || !dataReadyForMode()) {
            removeCurrentLayer();
            return;
        }
        if (state.mode === "heat") renderHeat();
        if (state.mode === "clusters") requestViewport("clusters");
        if (state.mode === "cases") requestViewport("cases");
        syncControls();
        window.REDSAOverlayState?.notify();
    }

    function scheduleViewportRender() {
        if (!state.active || state.status !== "ready" || !dataReadyForMode()) return;
        clearTimeout(state.queryTimer);
        state.queryTimer = setTimeout(() => {
            if (state.mode === "heat") renderHeat();
            if (state.mode === "clusters") requestViewport("clusters");
            if (state.mode === "cases") requestViewport("cases");
        }, CLUSTER_QUERY_DEBOUNCE_MS);
    }

    function setActive(active) {
        if (active && isAccumulatedMode()) {
            state.active = false;
            removeCurrentLayer();
            setStatus("period_unavailable");
            syncControls();
            document.getElementById("ant-mode-controls")?.toggleAttribute("hidden", true);
            return;
        }
        state.active = Boolean(active);
        if (state.active) {
            state.wasActiveInLegend = true;
        }
        if (!state.active) {
            cancelPending("cancelled");
            removeCurrentLayer();
            setStatus("idle");
        } else if (!isYearAvailable()) {
            setStatus("unavailable");
        } else {
            loadYear();
        }
        syncControls();
        document.getElementById("ant-mode-controls")?.toggleAttribute("hidden", !state.active);
        requestTerritorySummary();
        window.REDSAOverlayState?.notify();
    }

    function setMode(mode) {
        if (!["heat", "clusters", "cases"].includes(mode)) return;
        if (state.mode === mode) return;
        state.mode = mode;
        state.activationStartedAt = performance.now();
        state.activationCacheHit = dataReadyForMode();
        state.activationReadyTracked = false;
        trackAntEvent("ant_layer_mode_change", { cache_hit: state.activationCacheHit });
        syncControls();
        if (state.active) {
            loadYear();
        } else {
            syncControls();
        }
    }

    function setHeatBandwidthProfile(profileName) {
        if (!HEAT_BANDWIDTH_PROFILES[profileName]) return false;
        state.bandwidthProfile = profileName;
        if (state.mode === "heat") renderCurrentMode();
        return true;
    }

    function syncYear(year) {
        state.year = Number(year);
        if (isAccumulatedMode()) {
            setStatus("period_unavailable");
            syncControls();
            return;
        }
        if (!state.active) return;
        if (!isYearAvailable()) {
            cancelPending("cancelled");
            removeCurrentLayer();
            setStatus("unavailable");
        } else {
            if (state.loadedYear !== state.year || !state.cacheYears.includes(state.year)) {
                cancelPending("cancelled");
                clearCachedYear();
                removeCurrentLayer();
            }
            loadYear();
        }
        syncControls();
        requestTerritorySummary();
    }

    function syncPeriodMode(mode) {
        const nextMode = mode === "accumulated" ? "accumulated" : "year";
        if (state.periodMode === nextMode) {
            syncControls();
            if (isAccumulatedMode()) setStatus("period_unavailable");
            return;
        }

        state.periodMode = nextMode;
        if (isAccumulatedMode()) {
            cancelPending("cancelled");
            state.active = false;
            removeCurrentLayer();
            setStatus("period_unavailable");
            document.getElementById("ant-mode-controls")?.toggleAttribute("hidden", true);
        } else {
            setStatus("idle");
        }
        syncControls();
        requestTerritorySummary();
        window.REDSAOverlayState?.notify();
    }

    function legendEntry() {
        if (!state.active && !state.wasActiveInLegend) return null;
        const available = isYearAvailable();
        const audit = auditForYear();
        const modeLabels = { heat: "Calor", clusters: "Agrupaciones", cases: "Casos individuales" };
        return {
            id: "siniestros_ant",
            title: "Siniestros (ANT)",
            subtitle: `${modeLabels[state.mode]} · ${state.year}${available ? ` (${periodForYear()})` : " · No disponible para este periodo"}`,
            status: state.status,
            available,
            disabled: !state.active,
            items: (!available || !state.active)
                ? []
                : state.mode === "heat"
                ? [{ shape: "gradient", colors: Object.values(HEAT_GRADIENT), label: "Menor a mayor concentración de registros" }]
                : state.mode === "clusters"
                ? [{ shape: "circle", color: CLUSTER_COLOR, label: "El tamaño indica cantidad agrupada" }]
                : [{ shape: "circle", color: CASE_COLOR, label: "Un símbolo por siniestro con ubicación válida" }],
            audit: (available && state.active && audit) ? {
                published: audit.publishedLocations,
                total: audit.totalEvents,
                noLocation: audit.noLocation,
                unverifiableLocation: audit.unverifiableLocation,
                invalidDate: audit.invalidDate
            } : null,
            notes: [
                "Son los mismos siniestros de la variable territorial, mostrados donde ocurrieron; no deben sumarse ni compararse como otra fuente.",
                "Concentración de registros: no mide riesgo individual, calidad de la vía ni exposición al tránsito.",
                "ANT registra fallecidos en sitio. Esta cifra no sustituye las defunciones EDG del Registro Civil.",
                state.mode === "heat" ? "Escala de color adaptativa al año; los colores no son comparables entre años." : null
            ].filter(Boolean)
        };
    }

    function init(context) {
        if (state.initialized) return;
        state.initialized = true;
        state.context = context;
        state.config = context.config;
        state.map = context.map;
        state.heatPane = context.heatPane || "antHeatPane";
        state.eventPane = context.eventPane || context.pane || "eventPane";
        state.year = Number(context.getYear());
        state.periodMode = context.getPeriodMode?.() === "accumulated" ? "accumulated" : "year";
        state.bandwidthProfile = HEAT_BANDWIDTH_PROFILES[context.config.heatBandwidthProfile]
            ? context.config.heatBandwidthProfile
            : "focused";

        document.getElementById("ant-layer-toggle")?.addEventListener("change", event => setActive(event.target.checked));
        document.querySelectorAll("[data-ant-mode]").forEach(button => {
            button.addEventListener("click", () => setMode(button.dataset.antMode));
        });
        document.getElementById("ant-heat-opacity-slider")?.addEventListener("input", event => {
            setHeatOpacity(Number(event.target.value) / 100);
        });
        document.getElementById("ant-jump-year")?.addEventListener("click", () => context.setYear(Math.max(...availableYears())));
        state.map.on("moveend zoomend", scheduleViewportRender);
        state.map.on("click", handleAntMapClick);
        state.map.on("mousemove", handleAntMapMouseMove);
        window.REDSAOverlayState?.register("siniestros_ant", legendEntry);
        setStatus("idle");
        setHeatOpacity(state.heatOpacity);
        if (isAccumulatedMode()) setStatus("period_unavailable");
        syncControls();
    }

    function getAuditState() {
        return {
            active: state.active,
            mode: state.mode,
            periodMode: state.periodMode,
            year: state.year,
            loadedYear: state.loadedYear,
            heatLoadedYear: state.heatLoadedYear,
            fullLoadedYear: state.fullLoadedYear,
            dataSource: state.dataSource,
            loadKind: state.loadKind,
            status: state.status,
            metrics: state.metrics ? { ...state.metrics } : null,
            heatMetrics: state.heatMetrics ? { ...state.heatMetrics } : null,
            fullMetrics: state.fullMetrics ? { ...state.fullMetrics } : null,
            fullLoadPending: state.fullLoadPending,
            renderMetrics: JSON.parse(JSON.stringify(state.renderMetrics)),
            cacheYears: [...state.cacheYears],
            downloaded: Boolean(state.heatPoints),
            pointCount: state.pointCount,
            bandwidthProfile: state.bandwidthProfile,
            bandwidthProfiles: HEAT_BANDWIDTH_PROFILES
        };
    }

    window.REDSAAntLayer = Object.freeze({
        init,
        syncYear,
        syncPeriodMode,
        syncTerritory,
        setActive,
        setMode,
        setHeatOpacity,
        setHeatBandwidthProfile,
        getAuditState
    });
})();
