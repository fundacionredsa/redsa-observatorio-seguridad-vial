// Registrar tiempo inicial exacto
        const tStart = performance.now();

        // --- CONSTANTES MATEMATICAS Y UMBRALES ---
        const UMBRAL_CONCENTRACION_BIN = 0.70; // Activar log-transform si bin 0 concentra > 70%
        const UMBRAL_MEJORA_GVF = 0.02; // Mejoría mínima de GVF para aumentar de clases
        const MIN_CLASSES = 5;
        const MAX_CLASSES = 7;

        // --- PALETAS SEMANTICAS (ColorBrewer) ---
        const COLORBREWER = {
            "Reds": {
                3: ["#fee0d2", "#fc9272", "#de2d26"],
                4: ["#fee5d9", "#fcae91", "#fb6a4a", "#cb181d"],
                5: ["#fee5d9", "#fcae91", "#fb6a4a", "#de2d26", "#a50f15"],
                6: ["#fee5d9", "#fcbba1", "#fc9272", "#fb6a4a", "#de2d26", "#a50f15"],
                7: ["#fee5d9", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#99000d"]
            },
            "OrRd": {
                3: ["#fee8c8", "#fdbb84", "#e34a33"],
                4: ["#fef0d9", "#fdcc8a", "#fc8d59", "#d7301f"],
                5: ["#fef0d9", "#fdcc8a", "#fc8d59", "#e34a33", "#b30000"],
                6: ["#fef0d9", "#fdd49e", "#fdbb84", "#fc8d59", "#e34a33", "#b30000"],
                7: ["#fef0d9", "#fdd49e", "#fdbb84", "#fc8d59", "#ef6548", "#d7301f", "#990000"]
            },
            "Oranges": {
                3: ["#fee6ce", "#fdae6b", "#e6550d"],
                4: ["#feedde", "#fdbe85", "#fd8d3c", "#d94701"],
                5: ["#feedde", "#fdbe85", "#fd8d3c", "#e6550d", "#a63603"],
                6: ["#feedde", "#fdd0a2", "#fdae6b", "#fd8d3c", "#e6550d", "#a63603"],
                7: ["#feedde", "#fdd0a2", "#fdae6b", "#fd8d3c", "#f16913", "#d94801", "#8c2d04"]
            },
            "Purples": {
                3: ["#efedf5", "#bcbddc", "#756bb1"],
                4: ["#f2f0f7", "#cbc9e2", "#9e9ac8", "#6a51a3"],
                5: ["#f2f0f7", "#cbc9e2", "#9e9ac8", "#756bb1", "#54278f"],
                6: ["#f2f0f7", "#dadaeb", "#bcbddc", "#9e9ac8", "#756bb1", "#54278f"],
                7: ["#f2f0f7", "#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3", "#4a1486"]
            },
            "YlOrBr": {
                3: ["#fff7bc", "#fec44f", "#d95f0e"],
                4: ["#ffffd4", "#fed98e", "#fe9929", "#cc4c02"],
                5: ["#ffffd4", "#fed98e", "#fe9929", "#d95f0e", "#993404"],
                6: ["#ffffd4", "#fee391", "#fec44f", "#fe9929", "#d95f0e", "#993404"],
                7: ["#ffffd4", "#fee391", "#fec44f", "#fe9929", "#ec7014", "#cc4c02", "#8c2d04"]
            },
            "Blues": {
                3: ["#deebf7", "#9ecae1", "#3182bd"],
                4: ["#eff3ff", "#bdd7e7", "#6baed6", "#2171b5"],
                5: ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"],
                6: ["#eff3ff", "#c6dbef", "#9ecae1", "#6baed6", "#3182bd", "#08519c"],
                7: ["#eff3ff", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#084594"]
            },
            "Greens": {
                3: ["#e5f5e0", "#a1d99b", "#31a354"],
                4: ["#edf8e9", "#bae4b3", "#74c476", "#238b45"],
                5: ["#edf8e9", "#bae4b3", "#74c476", "#31a354", "#006d2c"],
                6: ["#edf8e9", "#c7e9c0", "#a1d99b", "#74c476", "#31a354", "#006d2c"],
                7: ["#edf8e9", "#c7e9c0", "#a1d99b", "#74c476", "#41ab5d", "#238b45", "#005a32"]
            }
        };

        // --- CONSTANTES DE COLOR ---
        const COLOR_BOUNDARY = "#52616b";
        const COLOR_BOUNDARY_HOVER = "#ffffff";
        const COLOR_CICLOVIAS = "#22c55e";
        const COLOR_ACERAS = "#ec4899"; // Rosa
        const COLOR_CRUCES = "#eab308"; // Amarillo
        const COLOR_PACIFICACION = "#a855f7"; // Púrpura
        const COLOR_SEMAFOROS_ROTONDAS = "#f97316"; // Naranja
        const COLOR_ILUMINACION = "#e2e8f0"; // Plateado/Blanco
        const COLOR_VELOCIDAD = "#ef4444"; // Rojo
        const COLOR_BRT_METROBUS = "#06b6d4"; // Cyan
        // Activar panel de diagnóstico si ?debug=true
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('debug') === 'true') {
            document.addEventListener("DOMContentLoaded", () => {
                const diagPanel = document.querySelector('.diagnostic-panel');
                if (diagPanel) diagPanel.style.display = 'block';
            });
        }

        // --- CONFIGURACIÓN REQUERIDA ---
        const GEO_CONFIG = window.REDSA_GEO_CONFIG;
        const INITIAL_VIEW = GEO_CONFIG.initialView;
        const RUTA_PROVINCIAS_RELATIVA = "data/provincias_wgs84.geojson";
        const RUTA_CANTONES_RELATIVA = "data/cantones_wgs84.geojson";
        const RUTA_PARROQUIAS_RELATIVA = "data/parroquias_wgs84.geojson";
        const RUTA_HOTSPOTS_CANTONALES_RELATIVA = "data/hotspots_cantonales.geojson";
        const CENTRO_MAPA = INITIAL_VIEW.center;
        const ZOOM_INICIAL = INITIAL_VIEW.zoom;
        const ZOOM_PROVINCIAS_MAX = 7;
        const ZOOM_CANTONES_MIN = 8;
        const ZOOM_CANTONES_MAX = 10;
        const ZOOM_PARROQUIAS_MIN = 11;
        // -------------------------------

        // Inicializar el Mapa
        const map = L.map('map', {
            center: CENTRO_MAPA,
            zoom: ZOOM_INICIAL,
            preferCanvas: true,
            zoomControl: false,
            attributionControl: true
        });
        window.geoportalMap = map;
        map.fitBounds(INITIAL_VIEW.bounds, { padding: [12, 12], animate: false });

        // Reposicionar el control de Zoom
        L.control.zoom({
            position: 'topright'
        }).addTo(map);

        // --- CONTROL DE LEYENDA (Glassmorphism) ---
        const LegendControl = L.Control.extend({
            options: {
                position: 'bottomright'
            },
            onAdd: function(map) {
                const div = L.DomUtil.create('div', 'legend-panel');
                L.DomEvent.disableClickPropagation(div);
                L.DomEvent.disableScrollPropagation(div);

                div.innerHTML = `
                    <button class="mobile-legend-toggle" id="mobile-legend-toggle" type="button" aria-expanded="false" aria-controls="legend-content">
                        <span>Leyenda</span>
                        <span class="mobile-legend-state">Mostrar</span>
                    </button>
                    <div class="legend-content" id="legend-content">
                        <div class="legend-title">Leyenda</div>
                        <div id="legend-items" style="display: flex; flex-direction: column; gap: 8px;"></div>
                    </div>
                `;
                return div;
            }
        });

        const legendControlInstance = new LegendControl();
        legendControlInstance.addTo(map);

        // Definir Atribuciones Requeridas
        const attributionCantonales = ' | <strong>Límites cantonales: INEC/CONALI vía datosabiertos.gob.ec, licencia CC-BY</strong> | Límites parroquiales: INEC 2014 (vigencia histórica)';

        // Definición de Capas Base (Mapas de fondo)
        const baseMaps = {
            "CartoDB Positron (Claro)": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' + attributionCantonales,
                subdomains: 'abcd',
                maxZoom: 20
            }),
            "CartoDB Dark Matter (Oscuro)": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' + attributionCantonales,
                subdomains: 'abcd',
                maxZoom: 20
            }),
            "OpenStreetMap (Estándar)": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' + attributionCantonales,
                maxZoom: 19
            })
        };

        // Agregar mapa base por defecto (Positron)
        baseMaps["CartoDB Positron (Claro)"].addTo(map);

        // Control de opacidad personalizado
        const OpacityControl = L.Control.extend({
            options: { position: 'topright' },
            onAdd: function (map) {
                const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control opacity-control');
                div.style.padding = '10px';
                div.style.background = 'var(--bg-panel, rgba(255, 255, 255, 0.95))';
                div.style.border = '1px solid var(--border-color, #ccc)';
                div.style.borderRadius = '4px';
                div.style.backdropFilter = 'blur(10px)';
                div.innerHTML = `
                    <label for="opacity-slider" style="font-size: 11px; font-weight: 600; display: block; margin-bottom: 5px; color: var(--text-color, #333); text-transform: uppercase; letter-spacing: 0.5px;">Opacidad de Capa</label>
                    <input type="range" id="opacity-slider" min="0" max="100" value="100" style="width: 120px; cursor: pointer;">
                `;
                L.DomEvent.disableClickPropagation(div);
                L.DomEvent.disableScrollPropagation(div);
                
                setTimeout(() => {
                    const slider = document.getElementById('opacity-slider');
                    if (slider) {
                        slider.addEventListener('input', (e) => {
                            const val = e.target.value / 100;
                            const pane = map.getPane('overlayPane');
                            if (pane) pane.style.opacity = val;
                        });
                    }
                }, 100);

                return div;
            }
        });
        map.addControl(new OpacityControl());

        // Capa GeoJSON
        let provinceLayer = null;
        let provinceData = null;
        let cantonLayer;
        let cantonData = null;
        let hotspotData = null;
        let nationalFatalitiesByYear = {};
        let selectedLayer = null;
        let selectedProvinceLayer = null;
        let layerControl = null;
        let overlayMaps = {};
        let historicoChart = null;

        layerControl = L.control.layers(baseMaps, overlayMaps, { position: 'topright' }).addTo(map);

        const mobileSidebarToggle = document.getElementById("mobile-sidebar-toggle");
        const mobileSidebarClose = document.getElementById("mobile-sidebar-close");
        const mobileLayersToggle = document.getElementById("mobile-layers-toggle");
        const mobileOverlayBackdrop = document.getElementById("mobile-overlay-backdrop");
        const mobileMediaQuery = window.matchMedia("(max-width: 768px)");
        const technicalPanelToggle = document.getElementById("technical-panel-toggle");
        const technicalDrawer = document.getElementById("technical-drawer");
        const technicalDrawerClose = document.getElementById("technical-drawer-close");
        const technicalControlsSlot = document.getElementById("technical-controls-slot");
        const territorySidebar = document.getElementById("territory-sidebar");
        const mobileLegendToggle = document.getElementById("mobile-legend-toggle");
        const legendPanel = document.querySelector(".legend-panel");

        territorySidebar?.addEventListener("transitionend", () => updateProfileCardLayout());
        technicalDrawer?.addEventListener("transitionend", () => updateProfileCardLayout());

        function setMobileLegend(open) {
            const shouldOpen = Boolean(open && mobileMediaQuery.matches);
            legendPanel?.classList.toggle("mobile-legend-open", shouldOpen);
            document.body.classList.toggle("mobile-legend-open", shouldOpen);
            mobileLegendToggle?.setAttribute("aria-expanded", String(shouldOpen));
            const stateLabel = mobileLegendToggle?.querySelector(".mobile-legend-state");
            if (stateLabel) stateLabel.textContent = shouldOpen ? "Ocultar" : "Mostrar";
            window.requestAnimationFrame(updateProfileCardLayout);
        }

        function setMobilePanel(panel, open) {
            if (open) setMobileLegend(false);
            if (panel === "sidebar") {
                document.body.classList.toggle("mobile-sidebar-open", open);
                territorySidebar?.setAttribute("aria-hidden", String(!open));
                if (mobileSidebarToggle) mobileSidebarToggle.setAttribute("aria-expanded", String(open));
                if (open) {
                    document.body.classList.remove("mobile-layers-open");
                    if (mobileLayersToggle) mobileLayersToggle.setAttribute("aria-expanded", "false");
                    if (technicalPanelToggle) technicalPanelToggle.setAttribute("aria-expanded", "false");
                    technicalDrawer?.setAttribute("aria-hidden", "true");
                    mobileSidebarClose?.focus({ preventScroll: true });
                }
            }
            if (panel === "layers") {
                document.body.classList.toggle("mobile-layers-open", open);
                technicalDrawer?.setAttribute("aria-hidden", String(!open));
                if (mobileLayersToggle) mobileLayersToggle.setAttribute("aria-expanded", String(open));
                if (technicalPanelToggle) technicalPanelToggle.setAttribute("aria-expanded", String(open));
                if (open) {
                    document.body.classList.remove("mobile-sidebar-open");
                    if (mobileSidebarToggle) mobileSidebarToggle.setAttribute("aria-expanded", "false");
                    territorySidebar?.setAttribute("aria-hidden", "true");
                    technicalDrawerClose?.focus({ preventScroll: true });
                }
            }
            window.requestAnimationFrame(updateProfileCardLayout);
            window.setTimeout(updateProfileCardLayout, 240);
        }

        function closeMobilePanels() {
            setMobilePanel("sidebar", false);
            setMobilePanel("layers", false);
        }

        function syncMobileLayerDrawer() {
            const container = layerControl?.getContainer?.() || document.querySelector(".leaflet-control-layers");
            const selector = document.querySelector(".map-selector-control");
            if (!technicalControlsSlot) return;
            if (selector && selector.parentElement !== technicalControlsSlot) technicalControlsSlot.appendChild(selector);
            if (container && container.parentElement !== technicalControlsSlot) {
                container.id = "mobile-layer-control";
                technicalControlsSlot.appendChild(container);
            }
            if (selector && container) document.body.classList.add("technical-ready");
        }

        mobileSidebarToggle?.addEventListener("click", () => {
            setMobilePanel("sidebar", !document.body.classList.contains("mobile-sidebar-open"));
        });
        mobileSidebarClose?.addEventListener("click", () => setMobilePanel("sidebar", false));
        mobileLayersToggle?.addEventListener("click", () => {
            syncMobileLayerDrawer();
            setMobilePanel("layers", !document.body.classList.contains("mobile-layers-open"));
        });
        technicalPanelToggle?.addEventListener("click", () => {
            syncMobileLayerDrawer();
            setMobilePanel("layers", !document.body.classList.contains("mobile-layers-open"));
        });
        technicalDrawerClose?.addEventListener("click", () => setMobilePanel("layers", false));
        document.getElementById("clear-infrastructure-button")?.addEventListener("click", () => {
            Object.values(overlayMaps).forEach(layer => {
                if (map.hasLayer(layer)) map.removeLayer(layer);
            });
            updateLegend();
        });
        document.getElementById("clean-map-button")?.addEventListener("click", () => {
            Object.values(overlayMaps).forEach(layer => {
                if (map.hasLayer(layer)) map.removeLayer(layer);
            });
            const select = document.getElementById("map-variable-select");
            if (select) {
                select.value = "normal";
                select.dispatchEvent(new Event("change", { bubbles: true }));
            }
            map.fitBounds(INITIAL_VIEW.bounds, { padding: [12, 12], animate: false });
            updateLegend();
        });
        mobileOverlayBackdrop?.addEventListener("click", closeMobilePanels);
        mobileLegendToggle?.addEventListener("click", () => {
            setMobileLegend(!legendPanel?.classList.contains("mobile-legend-open"));
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeMobilePanels();
                setMobileLegend(false);
            }
        });
        mobileMediaQuery.addEventListener("change", (event) => {
            if (!event.matches) {
                closeMobilePanels();
                setMobileLegend(false);
            }
        });

        let selectedVariable = INITIAL_VIEW.variable;
        let selectedYear = INITIAL_VIEW.year;
        let parishLayer = null;
        let parishData = null;
        let parishLoadPromise = null;
        let selectedParishLayer = null;
        let activeTerritoryLevel = null;
        let territoryLevelMode = "auto";
        let selectedTerritory = null;

        const LEVEL_LABELS = {
            province: "provincias",
            canton: "cantones",
            parish: "parroquias"
        };

        const VARIABLE_CONFIGS = GEO_CONFIG.variables;
        const INFRASTRUCTURE_LAYER_CONFIGS = GEO_CONFIG.infrastructureLayers;

        const TEMPORAL_COVERAGE = Object.fromEntries(
            Object.entries(VARIABLE_CONFIGS).map(([id, config]) => [id, config.temporal])
        );
        const DECLARED_TIMELINE_YEARS = Object.values(TEMPORAL_COVERAGE)
            .flatMap(coverage => coverage?.anios_disponibles || [])
            .map(Number)
            .filter(Number.isFinite);
        const TIMELINE_MIN_YEAR = Math.min(...DECLARED_TIMELINE_YEARS);
        const TIMELINE_MAX_YEAR = Math.max(...DECLARED_TIMELINE_YEARS);
        const ALL_TIMELINE_YEARS = Array.from(
            { length: TIMELINE_MAX_YEAR - TIMELINE_MIN_YEAR + 1 },
            (_, index) => TIMELINE_MIN_YEAR + index
        );

        function getVariableValue(properties, variable, year = selectedYear) {
            const config = VARIABLE_CONFIGS[variable];
            if (!config || !properties) return null;
            if (config.temporal?.tipo === "anual" && !config.temporal.anios_disponibles.includes(Number(year))) {
                return null;
            }
            return config.getValue
                ? config.getValue(properties, year)
                : properties[config.property];
        }

        function getFatalitiesCoverageWarning(properties, year = selectedYear) {
            const coverage = properties?.fallecidos_cobertura_pct?.[String(year)];
            if (!Number.isFinite(Number(coverage)) || Number(coverage) >= 100) return "";
            if (Number(coverage) <= 0) return `Sin cobertura parroquial para ${year}; no se muestra como cero.`;
            return `Cobertura parcial: ${Number(coverage).toLocaleString("es-EC", { maximumFractionDigits: 2 })}% de las parroquias tiene dato para ${year}.`;
        }

        function updateTimelineControl() {
            const slider = document.getElementById("map-year-slider");
            const badge = document.getElementById("timeline-badge");
            const marks = document.getElementById("timeline-marks");
            const coverage = TEMPORAL_COVERAGE[selectedVariable] || { tipo: "foto_unica", anios_disponibles: [] };
            if (!slider || !badge || !marks) return;

            const isAnnual = coverage.tipo === "anual";
            slider.disabled = !isAnnual;
            slider.value = String(selectedYear);
            badge.className = `timeline-badge${isAnnual ? "" : " fixed"}`;
            badge.textContent = isAnnual
                ? String(selectedYear)
                : (coverage.anios_disponibles.length
                    ? `Dato fijo · ${coverage.anios_disponibles.join("–")}`
                    : "Vista territorial");
            marks.style.setProperty("--timeline-year-count", ALL_TIMELINE_YEARS.length);
            marks.innerHTML = ALL_TIMELINE_YEARS.map(year => {
                const covered = isAnnual && coverage.anios_disponibles.includes(year);
                return `<span class="timeline-mark${covered ? "" : " gap"}">${String(year).slice(2)}</span>`;
            }).join("");
        }

        let activeVariableBins = {
            variable: "normal",
            level: null,
            year: null,
            bins: [],
            validValueCount: 0
        };

        function getTerritoryLevelForZoom(zoom = map.getZoom()) {
            if (activeTerritoryLevel === "province") {
                return zoom >= ZOOM_CANTONES_MIN ? "canton" : "province";
            }
            if (activeTerritoryLevel === "canton") {
                if (zoom < ZOOM_PROVINCIAS_MAX) return "province";
                if (zoom >= ZOOM_PARROQUIAS_MIN) return "parish";
                return "canton";
            }
            if (activeTerritoryLevel === "parish") {
                return zoom < ZOOM_CANTONES_MAX ? "canton" : "parish";
            }
            if (zoom <= ZOOM_PROVINCIAS_MAX) return "province";
            if (zoom >= ZOOM_PARROQUIAS_MIN) return "parish";
            return "canton";
        }

        function getTerritoryTooltipContent(feature, level) {
            const props = feature?.properties || {};
            const names = {
                province: props.DPA_DESPRO,
                canton: props.DPA_DESCAN,
                parish: props.DPA_DESPAR
            };
            const config = VARIABLE_CONFIGS[getEffectiveVariable(level)] || VARIABLE_CONFIGS.normal;
            const value = getVariableValue(props, getEffectiveVariable(level), selectedYear);
            const valueText = getEffectiveVariable(level) === "normal"
                ? "Límite administrativo"
                : `${config.label}: ${value === null || value === undefined ? "Sin dato" : formatNumber(value)}`;
            const coverageWarning = selectedVariable === "fallecidos_parroquial"
                ? getFatalitiesCoverageWarning(props, selectedYear)
                : "";
            const warningHtml = coverageWarning
                ? `<br><span class="u-text-warning">${coverageWarning}</span>`
                : "";
            return `<strong>${names[level] || "Unidad territorial"}</strong><br>${valueText}${warningHtml}`;
        }

        function getEffectiveVariable(level = activeTerritoryLevel) {
            const config = VARIABLE_CONFIGS[selectedVariable] || VARIABLE_CONFIGS.normal;
            return config.levels.includes(level) ? selectedVariable : "normal";
        }

        function getVariableColorPalette(config, numClasses) {
            const family = config.colorFamily || "Reds";
            if (COLORBREWER[family] && COLORBREWER[family][numClasses]) {
                return COLORBREWER[family][numClasses];
            }
            if (numClasses < 3 && COLORBREWER[family] && COLORBREWER[family][3]) {
                return COLORBREWER[family][3].slice(0, numClasses);
            }
            return ["#fee5d9", "#fcae91", "#fb6a4a", "#de2d26", "#a50f15"];
        }

        function calculateOptimalBins(features, config, variable) {
            const values = features
                .map(feature => getVariableValue(feature.properties, variable, selectedYear))
                .filter(value => value !== null && value !== undefined)
                .map(value => Number(value))
                .filter(value => Number.isFinite(value) && (
                    config.zeroAsNoMapping ? value > 0 : (config.zeroIsData ? value >= 0 : value > 0)
                ))
                .sort((a, b) => a - b);
                
            if (!values.length) return { bins: [], displayBins: [], method: 'Sin datos', gvf: 0, validValueCount: 0, colors: [], logScaled: false };

            const uniqueValues = [...new Set(values)].sort((a,b) => a-b);
            
            if (uniqueValues.length <= MAX_CLASSES) {
                const k = uniqueValues.length;
                const numBreaks = Math.max(1, k - 1);
                const bins = uniqueValues.slice(0, numBreaks);
                const colors = getVariableColorPalette(config, Math.max(3, k)).slice(0, k);
                return { 
                    bins, 
                    displayBins: [...bins], 
                    method: 'Valores Únicos', 
                    gvf: 1.0, 
                    validValueCount: values.length, 
                    colors, 
                    logScaled: false 
                };
            }

            const getGvf = (vals, breaks) => {
                const sdam = ss.variance(vals) * vals.length;
                if (sdam === 0) return 1;
                let sdcm = 0;
                let classValues = [];
                let bIdx = 0;
                for (let v of vals) {
                    if (bIdx < breaks.length && v > breaks[bIdx]) {
                        if (classValues.length > 0) sdcm += ss.variance(classValues) * classValues.length;
                        classValues = [];
                        while(bIdx < breaks.length && v > breaks[bIdx]) bIdx++;
                    }
                    classValues.push(v);
                }
                if (classValues.length > 0) sdcm += ss.variance(classValues) * classValues.length;
                return 1 - (sdcm / sdam);
            };

            // 1. Primer pase: calcular bins óptimos sobre valores crudos
            let bestK = MIN_CLASSES;
            let bestGvf = 0;
            let bestBreaks = [];
            
            for (let k = MIN_CLASSES; k <= MAX_CLASSES; k++) {
                const clusters = ss.ckmeans(values, k);
                const breaks = clusters.slice(0, k - 1).map(c => Math.max(...c));
                const currentGvf = getGvf(values, breaks);
                
                if (k === MIN_CLASSES) {
                    bestK = k;
                    bestGvf = currentGvf;
                    bestBreaks = breaks;
                } else if (currentGvf - bestGvf > UMBRAL_MEJORA_GVF) {
                    bestK = k;
                    bestGvf = currentGvf;
                    bestBreaks = breaks;
                } else {
                    break;
                }
            }

            // 2. Verificar si el primer bin de la clasificación cruda concentra > UMBRAL_CONCENTRACION_BIN (70%) de unidades
            let logScaled = false;
            let finalBreaks = bestBreaks;
            let reportedGvf = bestGvf;
            let bestMethod = 'Rupturas Naturales (Jenks)';

            const firstBreak = bestBreaks[0];
            const firstBinCount = values.filter(v => v <= firstBreak).length;
            
            if (firstBinCount / values.length > UMBRAL_CONCENTRACION_BIN) {
                logScaled = true;
                const logValues = values.map(v => Math.log(v + 1));
                
                // Recalcular sobre Math.log(valor + 1)
                bestK = MIN_CLASSES;
                bestGvf = 0;
                bestBreaks = [];
                for (let k = MIN_CLASSES; k <= MAX_CLASSES; k++) {
                    const clusters = ss.ckmeans(logValues, k);
                    const breaks = clusters.slice(0, k - 1).map(c => Math.max(...c));
                    const currentGvf = getGvf(logValues, breaks);
                    
                    if (k === MIN_CLASSES) {
                        bestK = k;
                        bestGvf = currentGvf;
                        bestBreaks = breaks;
                    } else if (currentGvf - bestGvf > UMBRAL_MEJORA_GVF) {
                        bestK = k;
                        bestGvf = currentGvf;
                        bestBreaks = breaks;
                    } else {
                        break;
                    }
                }
                
                // Des-transformar cortes
                finalBreaks = bestBreaks.map(v => Math.exp(v) - 1);
                reportedGvf = bestGvf;
            } else {
                // Si no se usó log, evaluar si intervalos iguales o cuantiles son mejores
                const numBreaks = bestK - 1;
                const quantiles = [];
                for (let i = 1; i <= numBreaks; i++) quantiles.push(ss.quantile(values, i / bestK));
                const gvfQuantiles = getGvf(values, quantiles);

                const min = values[0];
                const max = values[values.length - 1];
                const step = (max - min) / bestK;
                const equalIntervals = [];
                for (let i = 1; i <= numBreaks; i++) equalIntervals.push(min + i * step);
                const gvfEqual = getGvf(values, equalIntervals);

                if (gvfEqual > reportedGvf) {
                    finalBreaks = equalIntervals;
                    bestMethod = 'Intervalos Iguales';
                    reportedGvf = gvfEqual;
                }
                if (gvfQuantiles > reportedGvf + 0.01) {
                    finalBreaks = quantiles;
                    bestMethod = 'Cuantiles';
                    reportedGvf = gvfQuantiles;
                }
            }

            const displayBins = finalBreaks.map(val => {
                if (val === 0) return 0;
                const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(val))));
                let factor = 1;
                if (mag >= 100) factor = mag / 10;
                else if (mag >= 10) factor = 5;
                else if (mag >= 1) factor = 1;
                else factor = mag;
                
                let rounded = Math.round(val / factor) * factor;
                return config.continuous ? Number(rounded.toFixed(3)) : Math.floor(rounded);
            });

            const colors = getVariableColorPalette(config, bestK);

            return { 
                bins: finalBreaks.map(b => config.continuous ? Number(b.toFixed(6)) : Math.floor(b)), 
                displayBins, 
                method: bestMethod, 
                gvf: reportedGvf, 
                validValueCount: values.length, 
                colors, 
                logScaled 
            };
        }

        function getFeaturesForLevel(level) {
            const dataByLevel = {
                province: provinceData,
                canton: cantonData,
                parish: parishData
            };
            const data = dataByLevel[level];
            return data && Array.isArray(data.features) ? data.features : [];
        }

        function recalculateActiveVariableBins(variable, level) {
            const config = VARIABLE_CONFIGS[variable] || VARIABLE_CONFIGS.normal;
            if (variable === "normal" || !config.levels.includes(level)) {
                activeVariableBins = { variable: "normal", level, year: selectedYear, bins: [], displayBins: [], method: '', gvf: 0, validValueCount: 0, colors: [], logScaled: false };
            } else {
                const result = calculateOptimalBins(getFeaturesForLevel(level), config, variable);
                activeVariableBins = {
                    variable,
                    level,
                    year: selectedYear,
                    bins: result.bins,
                    displayBins: result.displayBins,
                    method: result.method,
                    gvf: result.gvf,
                    validValueCount: result.validValueCount,
                    colors: result.colors,
                    logScaled: result.logScaled
                };
            }
            window.__redsaActiveBins = {
                variable: activeVariableBins.variable,
                level: activeVariableBins.level,
                year: activeVariableBins.year,
                bins: [...activeVariableBins.bins],
                displayBins: [...(activeVariableBins.displayBins || [])],
                method: activeVariableBins.method,
                gvf: activeVariableBins.gvf,
                validValueCount: activeVariableBins.validValueCount,
                colors: activeVariableBins.colors,
                logScaled: activeVariableBins.logScaled
            };
            return activeVariableBins.bins;
        }

        function getVariableBins(variable, level) {
            if (
                activeVariableBins.variable !== variable
                || activeVariableBins.level !== level
                || activeVariableBins.year !== selectedYear
            ) {
                return recalculateActiveVariableBins(variable, level);
            }
            return activeVariableBins.bins;
        }

        function getBoundaryStyle(feature, level, isHovered = false, isSelected = false) {
            let color = COLOR_BOUNDARY;
            let fillColor = "#d9e0e5";
            let baseWeight = level === "province" ? 1.8 : (level === "parish" ? 0.9 : 1.2);
            let opacity = level === "province" ? 0.8 : 0.65;
            let fillOpacity = 0.06;

            if (isSelected) {
                color = "#38bdf8";
                opacity = 1.0;
                baseWeight = level === "province" ? 3.2 : 3.0;
                fillOpacity = 0.20;
            } else if (isHovered) {
                color = COLOR_BOUNDARY_HOVER;
                opacity = 1.0;
                baseWeight = level === "province" ? 2.8 : 2.5;
                fillOpacity = 0.25;
            }

            return {
                color: color,
                weight: baseWeight,
                opacity: opacity,
                fillColor: fillColor,
                fillOpacity: fillOpacity,
                dashArray: ''
            };
        }

        function getChoroplethStyle(feature, variable, level, isHovered = false, isSelected = false) {
            const config = VARIABLE_CONFIGS[variable];
            const val = getVariableValue(feature.properties, variable, selectedYear);
            const bins = getVariableBins(variable, level);
            let color = "#cbd5e1";
            let weight = isHovered ? 2.5 : (isSelected ? 3.0 : 1.0);
            let opacity = 0.8;
            let fillColor = "#334155";
            let fillOpacity = 0.65;
            let dashArray = '';

            if (config.zeroAsNoMapping && Number(val) === 0) {
                fillColor = "#475569";
                fillOpacity = 0.28;
                dashArray = "6, 4";
                color = "#94a3b8";
            } else if (val === null || val === undefined || !Number.isFinite(Number(val)) || (val === 0 && !config.zeroIsData)) {
                fillColor = "#1e293b";
                fillOpacity = 0.45;
                dashArray = '3, 4';
                color = "#475569";
            } else {
                let idx = 0;
                while (idx < bins.length && val > bins[idx]) {
                    idx++;
                }
                fillColor = (activeVariableBins.colors && activeVariableBins.colors[idx]) ? activeVariableBins.colors[idx] : getVariableColorPalette(config, bins.length + 1)[idx];
                color = isSelected ? "#38bdf8" : (isHovered ? "#ffffff" : "#475569");
                opacity = (isSelected || isHovered) ? 1.0 : 0.6;
            }

            return {
                color: color,
                weight: weight,
                opacity: opacity,
                fillColor: fillColor,
                fillOpacity: fillOpacity,
                dashArray: dashArray
            };
        }

        function getTerritoryStyle(feature, level, isHovered = false, isSelected = false) {
            const effectiveVariable = getEffectiveVariable(level);
            if (effectiveVariable === "normal") {
                return getBoundaryStyle(feature, level, isHovered, isSelected);
            }
            return getChoroplethStyle(feature, effectiveVariable, level, isHovered, isSelected);
        }

        function getProvinceStyle(feature, isHovered = false, isSelected = false) {
            return getTerritoryStyle(feature, "province", isHovered, isSelected);
        }

        function getCantonStyle(feature, isHovered = false, isSelected = false) {
            return getTerritoryStyle(feature, "canton", isHovered, isSelected);
        }

        function getParishStyle(feature, isHovered = false, isSelected = false) {
            return getTerritoryStyle(feature, "parish", isHovered, isSelected);
        }

        function getSelectedLayerForLevel(level) {
            if (level === "province") return selectedProvinceLayer;
            if (level === "canton") return selectedLayer;
            if (level === "parish") return selectedParishLayer;
            return null;
        }

        function setSelectedLayerForLevel(level, layer) {
            if (level === "province") selectedProvinceLayer = layer;
            if (level === "canton") selectedLayer = layer;
            if (level === "parish") selectedParishLayer = layer;
        }

        function fitBoundsWithinTerritoryLevel(layer, level) {
            const maxZoomByLevel = {
                province: ZOOM_PROVINCIAS_MAX,
                canton: ZOOM_CANTONES_MAX,
                parish: map.getMaxZoom()
            };
            map.fitBounds(layer.getBounds(), {
                padding: [24, 24],
                maxZoom: maxZoomByLevel[level],
                animate: true
            });
        }

        function preservePopupForSecondClick(layer) {
            if (layer?._openPopup) layer.off("click", layer._openPopup);
        }

        function handleTerritoryClick(level, event) {
            const layer = event.target;
            if (selectedTerritory?.layer === layer) {
                layer.openPopup?.();
                return true;
            }
            map.closePopup();
            return selectTerritoryLayer(level, layer);
        }

        function selectTerritoryLayer(level, layer, options = {}) {
            if (!layer?.feature?.properties) return false;
            setMobileLegend(false);
            const { fitBounds = true, updateHash = true } = options;
            const previousSelection = selectedTerritory;
            if (previousSelection?.layer && previousSelection.layer !== layer) {
                const previousGroup = getLayerForLevel(previousSelection.level);
                previousGroup?.resetStyle(previousSelection.layer);
            }

            setSelectedLayerForLevel(level, layer);
            selectedTerritory = {
                level,
                layer,
                props: layer.feature.properties
            };
            layer.setStyle(getTerritoryStyle(layer.feature, level, false, true));
            layer.bringToFront?.();

            if (fitBounds) fitBoundsWithinTerritoryLevel(layer, level);
            updateSidebar(selectedTerritory.props);
            showProfileCard(selectedTerritory.props, { target: layer });

            if (updateHash && level === "canton") {
                window.location.hash = "canton=" + encodeURIComponent(selectedTerritory.props.DPA_DESCAN);
            }
            return true;
        }

        function clearTerritorySelection() {
            if (selectedTerritory?.layer) {
                const group = getLayerForLevel(selectedTerritory.level);
                group?.resetStyle(selectedTerritory.layer);
            }
            selectedLayer = null;
            selectedProvinceLayer = null;
            selectedParishLayer = null;
            selectedTerritory = null;
            currentProps = null;
            currentProfileProps = null;
            updateSidebar(null);
            document.body.classList.remove("profile-selection-active");
            const card = document.getElementById("demographic-hover-card");
            if (card) card.style.display = "none";
            if (window.location.hash.startsWith("#canton=")) {
                history.replaceState(null, "", window.location.pathname + window.location.search);
            }
        }
