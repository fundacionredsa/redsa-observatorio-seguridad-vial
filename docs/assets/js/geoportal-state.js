// Registrar tiempo inicial exacto
        const tStart = performance.now();

        // --- CONSTANTES MATEMATICAS Y UMBRALES ---
        const UMBRAL_CONCENTRACION_BIN = 0.70; // Activar log-transform si bin 0 concentra > 70%
        const UMBRAL_MEJORA_GVF = 0.02; // Mejoría mínima de GVF para aumentar de clases
        const MIN_CLASSES = 5;
        const MAX_CLASSES = 7;
        const LEGEND_LAYOUT_MIN_WIDTH_PX = 240;
        const LEGEND_LAYOUT_RESIZE_DEBOUNCE_MS = 80;
        const LEGEND_LAYOUT_PANEL_TRANSITION_MS = 240;

        // --- CONSTANTES DE ANIMACION Y TRANSICION ---
        const INTERVALO_REPRODUCCION_MS = 1200; // Intervalo de avance automático entre años (ms)
        const DURACION_TRANSICION_MS = 400;     // Duración de la transición suave de color (ms)

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
        const RUTA_CANTONES_INDICE_RELATIVA = "data/cantones_indice.json";
        const RUTA_PARROQUIAS_RELATIVA = "data/parroquias_wgs84.geojson";
        const RUTA_HOTSPOTS_CANTONALES_RELATIVA = "data/hotspots_cantonales.json";
        const CENTRO_MAPA = INITIAL_VIEW.center;
        const ZOOM_INICIAL = INITIAL_VIEW.zoom;
        const ZOOM_PROVINCIAS_MAX = 7;
        const ZOOM_CANTONES_MIN = 8;
        const ZOOM_CANTONES_MAX = 10;
        const ZOOM_PARROQUIAS_MIN = 11;
        // A partir de este acercamiento de barrio el mapa base aporta más detalle
        // que un relleno uniforme dentro de una sola parroquia.
        const ZOOM_SURFACE_AUTO_HIDE_MIN = 17;
        // Orden cartografico estable: superficies abajo y vectores arriba.
        // Los nombres se comparten con las capas para evitar z-index dispersos.
        const MAP_PANE_STACK = Object.freeze({
            territorySurface: Object.freeze({ name: "territorioPane", zIndex: 400, pointerEvents: "auto" }),
            heatSurface: Object.freeze({ name: "antHeatPane", zIndex: 425, pointerEvents: "none" }),
            infrastructureVector: Object.freeze({ name: "infraestructuraPane", zIndex: 450, pointerEvents: "auto" }),
            eventVector: Object.freeze({ name: "eventPane", zIndex: 475, pointerEvents: "none" })
        });
        const RIGHT_CONTEXT_PANELS = Object.freeze(["layers", "analysis", "settings"]);
        const TOPBAR_CLOSE_KEY = "Escape";
        const MAP_ZOOM_STEP = 1;
        const GEOLOCATION_OPTIONS = Object.freeze({
            setView: false,
            maxZoom: 15,
            enableHighAccuracy: true,
            timeout: 10000
        });
        const GEOLOCATION_MARKER_STYLE = Object.freeze({ radius: 7, weight: 3 });
        const GEOLOCATION_STATUS_DURATION_MS = 6500;
        const GEOLOCATION_MESSAGES = Object.freeze({
            locating: "Buscando tu ubicación…",
            found: "Ubicación encontrada. El mapa se centró en ese punto.",
            unsupported: "Este navegador no ofrece geolocalización.",
            errors: Object.freeze({
                1: "No se concedió permiso para usar tu ubicación.",
                2: "No fue posible determinar tu ubicación.",
                3: "La búsqueda de ubicación tardó demasiado.",
                default: "No se pudo obtener tu ubicación. Intenta nuevamente."
            })
        });
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
        Object.values(MAP_PANE_STACK).forEach(({ name, zIndex, pointerEvents }) => {
            map.createPane(name);
            const pane = map.getPane(name);
            pane.style.zIndex = String(zIndex);
            pane.style.pointerEvents = pointerEvents;
        });
        window.REDSA_MAP_PANES = MAP_PANE_STACK;

        // Leaflet no incluye bottomcenter; registrar la esquina conserva un único control nativo.
        function ensureControlCorner(position, className) {
            if (map._controlCorners[position]) return map._controlCorners[position];
            const corner = L.DomUtil.create("div", className, map._controlContainer);
            map._controlCorners[position] = corner;
            return corner;
        }

        ensureControlCorner("bottomcenter", "leaflet-bottom leaflet-center");

        // La leyenda conserva el contrato Leaflet, pero su DOM vive dentro de la tarjeta única del mapa.
        const LegendControl = L.Control.extend({
            options: {
                position: 'bottomright'
            },
            onAdd: function(map) {
                const div = L.DomUtil.create('div', 'legend-panel');
                L.DomEvent.disableClickPropagation(div);
                L.DomEvent.disableScrollPropagation(div);

                div.innerHTML = `<div class="legend-content" id="legend-content">
                    <div id="legend-items" class="legend-items-structured">
                        <div id="legend-territory-items" class="legend-layer-items"></div>
                        <p id="territory-surface-auto-hide-note" class="territory-surface-auto-hide-note" role="status" hidden>Superficie oculta a este nivel de acercamiento; se prioriza el detalle del mapa base.</p>
                        <div id="legend-overlay-items" class="legend-layer-items"></div>
                        <div id="legend-ant-opacity-slot" class="legend-opacity-slot" data-legend-layer="siniestros_ant"></div>
                        <div id="legend-overlay-notes" class="legend-overlay-notes"></div>
                    </div>
                </div>`;
                return div;
            }
        });

        const scaleControl = L.control.scale({
            position: "bottomcenter",
            imperial: false,
            metric: true,
            maxWidth: 130
        }).addTo(map);
        scaleControl.getContainer()?.classList.add("road-scale-control");

        const legendControlInstance = new LegendControl();
        legendControlInstance.addTo(map);
        const legendControlContainer = legendControlInstance.getContainer();
        const legendContextSlot = document.getElementById("legend-context-slot");
        if (legendContextSlot && legendControlContainer) {
            legendContextSlot.appendChild(legendControlContainer);
        }

        // Definir Atribuciones Requeridas
        const attributionCantonales = ' | <strong>Límites cantonales: INEC/CONALI vía datosabiertos.gob.ec, licencia CC-BY</strong> | Límites provinciales y parroquiales: CONALI, vigencia 2025-02-20 y 2026-02-03, licencia CC-BY';

        const BASEMAP_LABELS = Object.freeze({
            positron: "CartoDB Positron (Claro)",
            darkMatter: "CartoDB Dark Matter (Oscuro)",
            osmStandard: "OpenStreetMap (Estándar)",
            cyclosm: "CyclOSM (Ciclismo)",
            relief: "OpenTopoMap (Relieve)"
        });
        const BASEMAP_TILE_URLS = Object.freeze({
            positron: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
            darkMatter: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            osmStandard: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            cyclosm: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
            relief: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
        });
        const BASEMAP_ATTRIBUTIONS = Object.freeze({
            carto: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            osm: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            cyclosm: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Tiles &copy; <a href="https://www.cyclosm.org/">CyclOSM</a>',
            relief: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style &copy; <a href="https://opentopomap.org/">OpenTopoMap</a> (CC-BY-SA)'
        });

        // Definición de Capas Base (Mapas de fondo)
        const baseMaps = {
            [BASEMAP_LABELS.positron]: L.tileLayer(BASEMAP_TILE_URLS.positron, {
                attribution: BASEMAP_ATTRIBUTIONS.carto + attributionCantonales,
                subdomains: 'abcd',
                maxZoom: 20
            }),
            [BASEMAP_LABELS.darkMatter]: L.tileLayer(BASEMAP_TILE_URLS.darkMatter, {
                attribution: BASEMAP_ATTRIBUTIONS.carto + attributionCantonales,
                subdomains: 'abcd',
                maxZoom: 20
            }),
            [BASEMAP_LABELS.osmStandard]: L.tileLayer(BASEMAP_TILE_URLS.osmStandard, {
                attribution: BASEMAP_ATTRIBUTIONS.osm + attributionCantonales,
                maxZoom: 19
            }),
            [BASEMAP_LABELS.cyclosm]: L.tileLayer(BASEMAP_TILE_URLS.cyclosm, {
                attribution: BASEMAP_ATTRIBUTIONS.cyclosm + attributionCantonales,
                subdomains: "abc",
                maxZoom: 20
            }),
            [BASEMAP_LABELS.relief]: L.tileLayer(BASEMAP_TILE_URLS.relief, {
                attribution: BASEMAP_ATTRIBUTIONS.relief + attributionCantonales,
                subdomains: "abc",
                maxNativeZoom: 17,
                maxZoom: 20
            })
        };

        // Agregar mapa base por defecto (Positron)
        baseMaps[BASEMAP_LABELS.positron].addTo(map);
        document.body.dataset.basemap = "positron";
        map.on("baselayerchange", event => {
            const darkMatterActive = event.name === BASEMAP_LABELS.darkMatter;
            document.body.classList.toggle("basemap-dark-matter", darkMatterActive);
            document.body.dataset.basemap = darkMatterActive
                ? "dark-matter"
                : Object.entries(BASEMAP_LABELS).find(([, label]) => label === event.name)?.[0] || "custom";
        });

        // Capa GeoJSON
        let provinceLayer = null;
        let provinceData = null;
        let cantonLayer;
        let cantonData = null;
        let cantonIndexData = null;
        let cantonLoadPromise = null;
        let hotspotData = null;
        let nationalFatalitiesByYear = {};
        let selectedLayer = null;
        let selectedProvinceLayer = null;
        let layerControl = null;
        const mobileMediaQuery = window.matchMedia("(max-width: 768px)");
        const baseLayerControl = L.control.layers(baseMaps, {}, {
            position: 'topright',
            collapsed: false
        }).addTo(map);
        const basemapControlContainer = baseLayerControl.getContainer();
        basemapControlContainer?.classList.add("basemap-control");
        basemapControlContainer?.setAttribute("aria-label", "Seleccionar mapa base");

        function syncBasemapControlDock() {
            const target = document.getElementById("basemap-context-slot");
            if (!basemapControlContainer || !target) return;
            if (basemapControlContainer.parentElement !== target) target.appendChild(basemapControlContainer);
        }

        syncBasemapControlDock();
        let overlayMaps = {};
        let historicoChart = null;

        const mobileSidebarToggle = document.getElementById("mobile-sidebar-toggle");
        const mobileSidebarClose = document.getElementById("mobile-sidebar-close");
        const mobileLayersToggle = document.getElementById("mobile-layers-toggle");
        const openAnalysisButton = document.getElementById("open-analysis-button");
        const mobileOverlayBackdrop = document.getElementById("mobile-overlay-backdrop");
        const technicalPanelToggle = document.getElementById("technical-panel-toggle");
        const technicalDrawer = document.getElementById("technical-drawer");
        const technicalDrawerClose = document.getElementById("technical-drawer-close");
        const technicalControlsSlot = document.getElementById("technical-controls-slot");
        const mapVariableDisclosureSlot = document.getElementById("map-variable-disclosure-slot");
        const infrastructureControlsSlot = document.getElementById("infrastructure-controls-slot");
        const mapToolbarLevelSlot = document.getElementById("map-toolbar-level-slot");
        const viewSettingsPeriodSlot = document.getElementById("view-settings-period-slot");
        const mapToolbarPeriodSlot = document.getElementById("map-toolbar-period-slot") || viewSettingsPeriodSlot;
        const mapToolbarYearSlot = document.getElementById("map-toolbar-year-slot");
        const viewSettingsOpacitySlot = document.getElementById("view-settings-opacity-slot");
        const mapToolbarOpacitySlot = document.getElementById("map-toolbar-opacity-slot") || viewSettingsOpacitySlot;
        const mapToolbarStatusSlot = document.getElementById("map-toolbar-status-slot");
        const mobilePeriodControlSlot = document.getElementById("mobile-period-control-slot");
        const mobileOpacityControlSlot = document.getElementById("mobile-opacity-control-slot");
        const mobileTimelinePlaySlot = document.getElementById("mobile-timeline-play-slot");
        const mapLegendCard = document.getElementById("map-legend-card");
        const territorySidebar = document.getElementById("territory-sidebar");
        const legendCloseToggle = document.getElementById("legend-close-toggle");
        const legendVisibilityToggle = document.getElementById("legend-visibility-toggle");
        const rightContextHost = document.getElementById("right-context-host");
        const rightToolRail = document.getElementById("right-tools-rail");
        const rightRailButtons = [...document.querySelectorAll(".right-tool-button")];
        const rightToolButtons = [...document.querySelectorAll("[data-right-panel]")];
        const rightContextViews = [...document.querySelectorAll("[data-right-context-view]")];
        const zoomInButton = document.getElementById("map-zoom-in");
        const zoomOutButton = document.getElementById("map-zoom-out");
        const locateButton = document.getElementById("map-locate");
        const rightToolsStatus = document.getElementById("right-tools-status");
        const activeLayersShortcut = document.getElementById("active-layers-shortcut");
        const siteTopbar = document.getElementById("site-topbar");
        const siteTopbarMenuToggle = document.getElementById("site-topbar-menu-toggle");
        const siteTopbarActions = document.getElementById("site-topbar-actions");
        const siteMethodologyToggle = document.getElementById("site-methodology-toggle");
        const siteMethodologyMenu = document.getElementById("site-methodology-menu");
        let activeRightPanel = null;
        let legendUserVisible = true;
        let contextualPanelRestoreTarget = "citizen";
        let sidebarReturnTarget = "map";
        let legendLayoutResizeTimer = null;
        let geolocationPending = false;
        let locationMarker = null;
        let rightToolsStatusTimer = null;

        territorySidebar?.addEventListener("transitionend", () => {
            scheduleSelectedTerritoryRefit();
        });
        technicalDrawer?.addEventListener("transitionend", () => {
            scheduleSelectedTerritoryRefit();
        });
        rightContextHost?.addEventListener("transitionend", () => {
            scheduleSelectedTerritoryRefit();
        });

        function isLegendLayoutConstrained() {
            if (!mapLegendCard) return false;
            if (mobileMediaQuery.matches || !rightToolRail) {
                mapLegendCard.style.removeProperty("--map-legend-available-width");
                return false;
            }
            const rootStyles = getComputedStyle(document.documentElement);
            const layoutGap = Number.parseFloat(rootStyles.getPropertyValue("--map-legend-gap")) || 0;
            // Only territory-sidebar matters now — #citizen-panel was dissolved in Fase 9.
            const visibleLeftPanels = [territorySidebar].filter(panel => {
                if (!panel || panel.getAttribute("aria-hidden") === "true") return false;
                const styles = getComputedStyle(panel);
                return styles.visibility !== "hidden" && styles.display !== "none";
            });
            const leftBoundary = visibleLeftPanels.reduce((edge, panel) => (
                Math.max(edge, panel.getBoundingClientRect().right)
            ), 0);
            const rightBoundary = activeRightPanel && rightContextHost && !rightContextHost.hidden
                ? rightContextHost.getBoundingClientRect().left
                : rightToolRail.getBoundingClientRect().left;
            const availableWidth = Math.max(0, rightBoundary - leftBoundary - (layoutGap * 2));
            mapLegendCard.style.setProperty("--map-legend-available-width", `${availableWidth}px`);
            return availableWidth < LEGEND_LAYOUT_MIN_WIDTH_PX;
        }

        function syncLegendCardPresentation() {
            if (!mapLegendCard) return;
            const hasLegendContent = mapLegendCard.dataset.hasLegend === "true";
            const coveredByMobileSheet = mobileMediaQuery.matches
                && (document.body.classList.contains("mobile-sidebar-open")
                    || document.body.classList.contains("mobile-right-context-open"));
            const layoutConstrained = isLegendLayoutConstrained();
            const shouldShow = legendUserVisible && hasLegendContent && !coveredByMobileSheet && !layoutConstrained;
            mapLegendCard.classList.toggle("is-visible", shouldShow);
            mapLegendCard.setAttribute("aria-hidden", String(!shouldShow));
            mapLegendCard.toggleAttribute("inert", !shouldShow);
            if (legendVisibilityToggle) {
                const shouldOfferRecovery = !legendUserVisible && hasLegendContent && !coveredByMobileSheet && !layoutConstrained;
                legendVisibilityToggle.hidden = !shouldOfferRecovery;
                legendVisibilityToggle.setAttribute("aria-expanded", String(shouldShow));
            }
            document.body.classList.toggle("map-legend-visible", shouldShow);
            document.body.classList.toggle("map-legend-space-constrained", layoutConstrained);
        }

        function hideUnifiedLegend() {
            legendUserVisible = false;
            syncLegendCardPresentation();
            legendVisibilityToggle?.focus({ preventScroll: true });
        }

        function showUnifiedLegend() {
            legendUserVisible = true;
            syncLegendCardPresentation();
            legendCloseToggle?.focus({ preventScroll: true });
        }

        function setRightContextPanel(panel, open = true, options = {}) {
            const nextPanel = open && RIGHT_CONTEXT_PANELS.includes(panel) ? panel : null;
            activeRightPanel = nextPanel;
            const analysisOpen = nextPanel === "analysis";
            if (rightContextHost) {
                rightContextHost.hidden = !nextPanel;
                rightContextHost.dataset.activePanel = nextPanel || "none";
            }
            rightContextViews.forEach(view => {
                const isActive = view.dataset.rightContextView === nextPanel;
                view.hidden = !isActive;
                view.setAttribute("aria-hidden", String(!isActive));
            });
            rightToolButtons.forEach((button, index) => {
                const isActive = button.dataset.rightPanel === activeRightPanel;
                button.classList.toggle("active", isActive);
                button.setAttribute("aria-expanded", String(isActive));
                button.setAttribute("aria-selected", String(isActive));
                button.tabIndex = isActive || (!activeRightPanel && index === 0) ? 0 : -1;
            });

            const layersOpen = nextPanel === "layers";
            document.body.classList.toggle("technical-drawer-open", layersOpen);
            document.body.classList.toggle("mobile-layers-open", layersOpen && mobileMediaQuery.matches);
            document.body.classList.toggle("mobile-sidebar-open", analysisOpen && mobileMediaQuery.matches);
            document.body.classList.toggle("right-context-open", Boolean(nextPanel));
            document.body.classList.toggle("mobile-right-context-open", Boolean(nextPanel) && mobileMediaQuery.matches);
            technicalDrawer?.setAttribute("aria-hidden", String(!layersOpen));
            technicalPanelToggle?.setAttribute("aria-expanded", String(layersOpen));
            activeLayersShortcut?.setAttribute("aria-expanded", String(layersOpen));
            mobileLayersToggle?.setAttribute("aria-expanded", String(layersOpen));
            territorySidebar?.setAttribute("aria-hidden", String(!analysisOpen));
            mobileSidebarToggle?.setAttribute("aria-expanded", String(analysisOpen));

            syncLegendCardPresentation();
            if (options.focusPanel && nextPanel) {
                rightContextViews.find(view => view.dataset.rightContextView === nextPanel)
                    ?.querySelector("button, input, summary, a")
                    ?.focus({ preventScroll: true });
            }
        }

        function setMobilePanel(panel, open, options = {}) {
            if (panel === "sidebar") {
                if (open && options.returnTarget === "map") {
                    sidebarReturnTarget = "map";
                }
                setRightContextPanel("analysis", Boolean(open), options);
                if (open && mobileMediaQuery.matches) {
                    mobileSidebarClose?.focus({ preventScroll: true });
                }
            } else if (panel === "layers") {
                setRightContextPanel("layers", Boolean(open), { focusPanel: Boolean(open && mobileMediaQuery.matches) });
            } else {
                setRightContextPanel(null, false);
            }
            syncLegendCardPresentation();
            if (panel === "sidebar") {
                window.setTimeout(syncLegendCardPresentation, LEGEND_LAYOUT_PANEL_TRANSITION_MS);
            }
        }

        function closeMobilePanels() {
            setMobilePanel("sidebar", false);
            setRightContextPanel(null, false);
        }

        function setDesktopTechnicalPanel(open) {
            setRightContextPanel("layers", Boolean(open));
        }

        function setSiteMethodologyMenu(open, options = {}) {
            const shouldOpen = Boolean(open);
            if (siteMethodologyMenu) siteMethodologyMenu.hidden = !shouldOpen;
            siteMethodologyToggle?.setAttribute("aria-expanded", String(shouldOpen));
            if (shouldOpen && options.focusFirstLink) {
                siteMethodologyMenu?.querySelector("a")?.focus({ preventScroll: true });
            }
        }

        function setSiteTopbarMenu(open, options = {}) {
            const shouldOpen = Boolean(open);
            siteTopbarActions?.classList.toggle("is-open", shouldOpen);
            siteTopbarActions?.setAttribute("aria-hidden", String(!shouldOpen));
            siteTopbarMenuToggle?.setAttribute("aria-expanded", String(shouldOpen));
            if (!shouldOpen) setSiteMethodologyMenu(false);
            if (shouldOpen && (options.focusFirstAction !== false)) {
                const firstItem = siteTopbarActions?.querySelector("button, a");
                firstItem?.focus({ preventScroll: true });
            }
        }

        function decorateInfrastructureControls(container) {
            const count = document.getElementById("infrastructure-layer-count");
            if (count) count.textContent = String(INFRASTRUCTURE_LAYER_CONFIGS.length);
            if (!container || container.dataset.infrastructureDecorated === "true") return;

            const labels = [...container.querySelectorAll(".leaflet-control-layers-overlays label")];
            labels.forEach((label, index) => {
                const config = INFRASTRUCTURE_LAYER_CONFIGS[index];
                const input = label.querySelector("input[type='checkbox']");
                if (!config || !input) return;

                label.className = "infrastructure-toggle-row";
                label.dataset.infrastructureLayer = config.id;
                input.classList.add("infrastructure-toggle-input");
                input.id = `infrastructure-layer-${config.id}`;

                const symbol = document.createElement("span");
                symbol.className = "infrastructure-layer-symbol";
                symbol.dataset.layerRender = config.render || "line";
                symbol.style.setProperty("--infrastructure-layer-color", config.color);
                symbol.setAttribute("aria-hidden", "true");

                const name = document.createElement("span");
                name.className = "infrastructure-layer-name";
                name.textContent = config.label;

                const switchControl = document.createElement("span");
                switchControl.className = "infrastructure-switch";
                const switchVisual = document.createElement("span");
                switchVisual.className = "infrastructure-switch-visual";
                switchVisual.setAttribute("aria-hidden", "true");
                switchControl.append(input, switchVisual);

                label.replaceChildren(symbol, name, switchControl);
            });
            container.dataset.infrastructureDecorated = "true";
        }

        function syncMobileLayerDrawer() {
            const container = layerControl?.getContainer?.();
            const selector = document.querySelector(".map-selector-control");
            if (!technicalControlsSlot) return;
            const timelineBlock = document.querySelector(".timeline-filter-block");
            const timelineControl = document.querySelector(".timeline-control");
            const timelinePlayButton = document.getElementById("timeline-play-button");
            const timelineTitleWrap = document.getElementById("timeline-title-wrap");
            const periodControl = document.querySelector(".period-mode-control");
            const levelControl = document.getElementById("territory-level-control");
            const mapLevelNote = document.getElementById("map-level-note");
            const territoryOpacityControl = document.getElementById("territory-opacity-control");
            const antHeatOpacityControl = document.getElementById("ant-heat-opacity-control");
            if (levelControl && mapToolbarLevelSlot && levelControl.parentElement !== mapToolbarLevelSlot) {
                if (!mapToolbarLevelSlot.contains(levelControl)) {
                    mapToolbarLevelSlot.appendChild(levelControl);
                }
            }
            const periodTarget = mobileMediaQuery.matches ? mobilePeriodControlSlot : (mapToolbarPeriodSlot || viewSettingsPeriodSlot);
            if (periodControl && periodTarget && periodControl.parentElement !== periodTarget) {
                periodTarget.appendChild(periodControl);
            }
            if (timelineControl && mapToolbarYearSlot && timelineControl.parentElement !== mapToolbarYearSlot) {
                if (!mapToolbarYearSlot.contains(timelineControl)) {
                    mapToolbarYearSlot.appendChild(timelineControl);
                }
            }
            const playTarget = mobileMediaQuery.matches ? mobileTimelinePlaySlot : timelineTitleWrap;
            if (timelinePlayButton && playTarget && timelinePlayButton.parentElement !== playTarget) {
                if (playTarget === timelineTitleWrap) {
                    playTarget.prepend(timelinePlayButton);
                } else {
                    playTarget.appendChild(timelinePlayButton);
                }
            }
            const opacityTarget = mobileMediaQuery.matches ? mobileOpacityControlSlot : (mapToolbarOpacitySlot || viewSettingsOpacitySlot);
            if (territoryOpacityControl && opacityTarget && territoryOpacityControl.parentElement !== opacityTarget) {
                opacityTarget.appendChild(territoryOpacityControl);
            }
            if (mapLevelNote && mapToolbarStatusSlot && mapLevelNote.parentElement !== mapToolbarStatusSlot) {
                mapToolbarStatusSlot.appendChild(mapLevelNote);
            }
            const antOpacitySlot = document.getElementById("legend-ant-opacity-slot");
            if (antHeatOpacityControl && antOpacitySlot && antHeatOpacityControl.parentElement !== antOpacitySlot) {
                antOpacitySlot.appendChild(antHeatOpacityControl);
            }
            const variableDisclosure = document.getElementById("variable-disclosure");
            if (variableDisclosure && mapVariableDisclosureSlot && variableDisclosure.parentElement !== mapVariableDisclosureSlot) {
                mapVariableDisclosureSlot.appendChild(variableDisclosure);
            }
            if (container && infrastructureControlsSlot && container.parentElement !== infrastructureControlsSlot) {
                container.id = "mobile-layer-control";
                infrastructureControlsSlot.appendChild(container);
            }
            decorateInfrastructureControls(container);
            // Timeline, level and variable controls now live in their final panels.
            // Remove the empty Leaflet shell so it cannot look like an inert search field.
            if (timelineBlock && timelineBlock.childElementCount === 0) timelineBlock.remove();
            if (selector && selector.childElementCount === 0) selector.remove();
            if (container && variableDisclosure && levelControl && periodControl && timelineControl) {
                document.body.classList.add("technical-ready");
            }
        }

        document.addEventListener("input", event => {
            if (event.target?.id !== "territory-opacity-slider") return;
            const percentage = Number(event.target.value);
            const pane = map.getPane(MAP_PANE_STACK.territorySurface.name);
            if (pane) pane.style.opacity = String(percentage / 100);
            const output = document.getElementById("territory-opacity-value");
            if (output) output.value = `${percentage}%`;
        });

        function syncZoomButtons() {
            if (zoomInButton) zoomInButton.disabled = map.getZoom() >= map.getMaxZoom();
            if (zoomOutButton) zoomOutButton.disabled = map.getZoom() <= map.getMinZoom();
        }

        function showRightToolsStatus(message, tone = "info") {
            if (!rightToolsStatus) return;
            window.clearTimeout(rightToolsStatusTimer);
            rightToolsStatus.textContent = message;
            rightToolsStatus.dataset.tone = tone;
            rightToolsStatus.hidden = false;
            rightToolsStatusTimer = window.setTimeout(() => {
                rightToolsStatus.hidden = true;
            }, GEOLOCATION_STATUS_DURATION_MS);
        }

        function finishGeolocation() {
            geolocationPending = false;
            locateButton?.removeAttribute("aria-busy");
            if (locateButton) locateButton.disabled = false;
        }

        function changeMapZoom(direction) {
            const nextZoom = map.getZoom() + (MAP_ZOOM_STEP * direction);
            map.setView(map.getCenter(), nextZoom, { animate: false });
        }

        zoomInButton?.addEventListener("click", () => changeMapZoom(1));
        zoomOutButton?.addEventListener("click", () => changeMapZoom(-1));
        map.on("zoomend", () => {
            syncZoomButtons();
            if (typeof refreshTerritoryLayerStyles === "function") {
                refreshTerritoryLayerStyles(activeTerritoryLevel || getTerritoryLevelForZoom(), false);
            }
            syncTerritorySurfaceAutoHideNote();
            if (typeof updateLegend === "function") updateLegend();
        });
        syncZoomButtons();

        locateButton?.addEventListener("click", () => {
            if (geolocationPending) return;
            if (!navigator.geolocation) {
                showRightToolsStatus(GEOLOCATION_MESSAGES.unsupported, "error");
                return;
            }
            geolocationPending = true;
            locateButton.disabled = true;
            locateButton.setAttribute("aria-busy", "true");
            showRightToolsStatus(GEOLOCATION_MESSAGES.locating);
            map.locate(GEOLOCATION_OPTIONS);
        });

        map.on("locationfound", event => {
            finishGeolocation();
            const targetZoom = Math.min(GEOLOCATION_OPTIONS.maxZoom, map.getMaxZoom());
            map.stop();
            map.setView(event.latlng, targetZoom, { animate: false });
            if (locationMarker) map.removeLayer(locationMarker);
            const rootStyles = getComputedStyle(document.documentElement);
            locationMarker = L.circleMarker(event.latlng, {
                pane: MAP_PANE_STACK.eventVector.name,
                ...GEOLOCATION_MARKER_STYLE,
                color: rootStyles.getPropertyValue("--map-location-outline").trim(),
                fillColor: rootStyles.getPropertyValue("--map-location-fill").trim(),
                fillOpacity: 1,
                interactive: false
            }).addTo(map);
            showRightToolsStatus(GEOLOCATION_MESSAGES.found, "success");
        });

        map.on("locationerror", event => {
            finishGeolocation();
            const message = GEOLOCATION_MESSAGES.errors[event.code]
                || GEOLOCATION_MESSAGES.errors.default;
            showRightToolsStatus(message, "error");
        });

        mobileSidebarToggle?.addEventListener("click", () => {
            setMobilePanel("sidebar", !document.body.classList.contains("mobile-sidebar-open"), { returnTarget: "map" });
        });
        mobileSidebarClose?.addEventListener("click", () => {
            setMobilePanel("sidebar", false);
            setRightContextPanel(null, false);
        });
        mobileLayersToggle?.addEventListener("click", () => {
            syncMobileLayerDrawer();
            setMobilePanel("layers", !document.body.classList.contains("mobile-layers-open"));
        });
        technicalPanelToggle?.addEventListener("click", () => {
            syncMobileLayerDrawer();
            setRightContextPanel("layers", activeRightPanel !== "layers");
        });
        activeLayersShortcut?.addEventListener("click", () => {
            syncMobileLayerDrawer();
            setRightContextPanel("layers", true, { focusPanel: mobileMediaQuery.matches });
        });
        siteTopbarMenuToggle?.addEventListener("click", () => {
            setSiteTopbarMenu(!siteTopbarActions?.classList.contains("is-open"));
        });
        siteMethodologyToggle?.addEventListener("click", () => {
            setSiteMethodologyMenu(siteMethodologyToggle.getAttribute("aria-expanded") !== "true");
        });
        siteMethodologyMenu?.addEventListener("click", event => {
            if (!event.target.closest("a")) return;
            setSiteMethodologyMenu(false);
            setSiteTopbarMenu(false);
        });
        siteTopbarActions?.querySelectorAll(":scope > button").forEach(button => {
            button.addEventListener("click", () => setSiteTopbarMenu(false));
        });
        siteTopbarActions?.addEventListener("keydown", event => {
            const focusable = [...siteTopbarActions.querySelectorAll("button, a")].filter(el => {
                return !el.hidden && getComputedStyle(el).display !== "none" && !el.closest("[hidden]");
            });
            const currentIndex = focusable.indexOf(document.activeElement);
            if (event.key === "ArrowDown") {
                event.preventDefault();
                const nextIndex = currentIndex < focusable.length - 1 ? currentIndex + 1 : 0;
                focusable[nextIndex]?.focus({ preventScroll: true });
            } else if (event.key === "ArrowUp") {
                event.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : focusable.length - 1;
                focusable[prevIndex]?.focus({ preventScroll: true });
            } else if (event.key === "Home") {
                event.preventDefault();
                focusable[0]?.focus({ preventScroll: true });
            } else if (event.key === "End") {
                event.preventDefault();
                focusable[focusable.length - 1]?.focus({ preventScroll: true });
            }
        });
        document.addEventListener("pointerdown", event => {
            if (!siteTopbar?.contains(event.target)) {
                setSiteMethodologyMenu(false);
                setSiteTopbarMenu(false);
            }
        });
        siteTopbar?.addEventListener("keydown", event => {
            if (event.key !== TOPBAR_CLOSE_KEY) return;
            const wasOpen = siteTopbarActions?.classList.contains("is-open")
                || siteMethodologyToggle?.getAttribute("aria-expanded") === "true";
            setSiteMethodologyMenu(false);
            setSiteTopbarMenu(false);
            if (wasOpen) siteTopbarMenuToggle?.focus({ preventScroll: true });
        });
        technicalDrawerClose?.addEventListener("click", () => {
            setRightContextPanel(null, false);
        });
        const analysisDrawerClose = document.getElementById("analysis-drawer-close");
        analysisDrawerClose?.addEventListener("click", () => {
            setRightContextPanel(null, false);
        });
        const viewSettingsClose = document.getElementById("view-settings-close");
        viewSettingsClose?.addEventListener("click", () => {
            setRightContextPanel(null, false);
        });
        rightContextHost?.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                event.stopPropagation();
                const activeTab = activeRightPanel;
                setRightContextPanel(null, false);
                if (activeTab) {
                    document.querySelector(`.right-tool-button[data-right-panel="${activeTab}"]`)?.focus({ preventScroll: true });
                }
            }
        });
        const mapLegendCollapseToggle = document.getElementById("map-legend-card-collapse");
        mapLegendCollapseToggle?.addEventListener("click", () => {
            if (!mapLegendCard) return;
            const isCollapsed = mapLegendCard.classList.toggle("is-collapsed");
            mapLegendCollapseToggle.setAttribute("aria-expanded", String(!isCollapsed));
            mapLegendCollapseToggle.setAttribute("title", isCollapsed ? "Expandir leyenda del mapa" : "Colapsar leyenda del mapa");
            mapLegendCollapseToggle.setAttribute("aria-label", isCollapsed ? "Expandir leyenda del mapa" : "Colapsar leyenda del mapa");
            const icon = mapLegendCollapseToggle.querySelector("i");
            if (icon) {
                icon.className = isCollapsed ? "fa-solid fa-chevron-down" : "fa-solid fa-chevron-up";
            }
        });
        const territoryLevelSelect = document.getElementById("territory-level-select");
        territoryLevelSelect?.addEventListener("change", (event) => {
            const level = event.target.value;
            if (typeof window.REDSAAppState?.setTerritoryLevelMode === "function") {
                window.REDSAAppState.setTerritoryLevelMode(level);
            } else if (typeof setTerritoryLevelMode === "function") {
                setTerritoryLevelMode(level);
            }
        });
        legendCloseToggle?.addEventListener("click", hideUnifiedLegend);
        legendVisibilityToggle?.addEventListener("click", showUnifiedLegend);
        rightToolButtons.forEach(button => button.addEventListener("click", () => {
            const panel = button.dataset.rightPanel;
            if (panel === "layers") syncMobileLayerDrawer();
            setRightContextPanel(panel, activeRightPanel !== panel, { focusPanel: false });
        }));
        rightToolRail?.addEventListener("keydown", event => {
            const isPanelTab = event.target?.matches?.("[role='tab'][data-right-panel]");
            const acceptedKeys = isPanelTab
                ? ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"]
                : ["ArrowDown", "ArrowUp", "Home", "End"];
            if (!acceptedKeys.includes(event.key)) return;
            const buttons = (isPanelTab ? rightToolButtons : rightRailButtons).filter(button => !button.disabled);
            if (!buttons.length) return;
            event.preventDefault();
            const currentIndex = Math.max(0, buttons.indexOf(document.activeElement));
            const nextIndex = event.key === "Home" ? 0
                : event.key === "End" ? buttons.length - 1
                : ["ArrowDown", "ArrowRight"].includes(event.key) ? (currentIndex + 1) % buttons.length
                : (currentIndex - 1 + buttons.length) % buttons.length;
            buttons[nextIndex].focus();
            if (isPanelTab) {
                const panel = buttons[nextIndex].dataset.rightPanel;
                if (panel === "layers") syncMobileLayerDrawer();
                setRightContextPanel(panel, true);
            }
        });
        document.querySelectorAll("[data-close-right-panel]").forEach(button => {
            button.addEventListener("click", () => setRightContextPanel(null, false));
        });
        mobileOverlayBackdrop?.addEventListener("click", closeMobilePanels);
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeMobilePanels();
            }
        });
        mobileMediaQuery.addEventListener("change", (event) => {
            syncBasemapControlDock();
            syncMobileLayerDrawer();
            if (event.matches) {
                setMobilePanel("sidebar", false);
            } else {
                setMobilePanel("sidebar", false);
            }
            // Conservar la eleccion del usuario al cruzar el breakpoint, incluido el estado cerrado.
            setRightContextPanel(activeRightPanel, Boolean(activeRightPanel));
        });
        window.addEventListener("resize", () => {
            window.clearTimeout(legendLayoutResizeTimer);
            legendLayoutResizeTimer = window.setTimeout(syncLegendCardPresentation, LEGEND_LAYOUT_RESIZE_DEBOUNCE_MS);
        });

        setRightContextPanel(null, false);

        let selectedVariable = INITIAL_VIEW.variable;
        let selectedYear = INITIAL_VIEW.year;
        let selectedPeriodMode = "year";
        let selectedDetailPeriodMode = "year";
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
        const EVENT_LAYER_CONFIGS = GEO_CONFIG.eventLayers || [];

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
        let yearAdjustmentNotice = null;

        function getAvailableYearsForVariable(variable) {
            return [...new Set(
                (TEMPORAL_COVERAGE[variable]?.anios_disponibles || [])
                    .map(Number)
                    .filter(Number.isFinite)
            )].sort((a, b) => a - b);
        }

        function resolveYearForVariable(variable, year) {
            const availableYears = getAvailableYearsForVariable(variable);
            const requestedYear = Number(year);
            if (!availableYears.length || !Number.isFinite(requestedYear)) return requestedYear;
            if (availableYears.includes(requestedYear)) return requestedYear;

            const minimumYear = availableYears[0];
            const maximumYear = availableYears[availableYears.length - 1];
            if (requestedYear < minimumYear) return minimumYear;
            if (requestedYear > maximumYear) return maximumYear;

            return availableYears.reduce((nearestYear, candidateYear) => {
                const candidateDistance = Math.abs(candidateYear - requestedYear);
                const nearestDistance = Math.abs(nearestYear - requestedYear);
                if (candidateDistance < nearestDistance) return candidateYear;
                if (candidateDistance === nearestDistance && candidateYear > nearestYear) return candidateYear;
                return nearestYear;
            }, minimumYear);
        }

        function updateYearAdjustmentNotice() {
            const note = document.getElementById("timeline-year-adjustment-note");
            if (!note) return;
            if (!yearAdjustmentNotice) {
                note.textContent = "";
                note.hidden = true;
                return;
            }

            const { resolvedYear, availableYears } = yearAdjustmentNotice;
            const message = availableYears.length === 1
                ? `El año cambió a ${resolvedYear} porque esta variable solo tiene datos de ${resolvedYear}.`
                : `El año cambió a ${resolvedYear} porque esta variable cubre ${formatCoveredYears(availableYears)}.`;
            note.textContent = message;
            note.hidden = false;
        }

        function clearYearAdjustmentNotice() {
            yearAdjustmentNotice = null;
            updateYearAdjustmentNotice();
        }

        function resolveSelectedYearForVariable(
            variable = selectedVariable,
            { announce = true, clearWhenUnchanged = true } = {}
        ) {
            const availableYears = getAvailableYearsForVariable(variable);
            const requestedYear = Number(selectedYear);
            const resolvedYear = resolveYearForVariable(variable, requestedYear);
            const changed = Number.isFinite(resolvedYear) && resolvedYear !== requestedYear;

            if (changed) selectedYear = resolvedYear;
            if (announce && changed) {
                yearAdjustmentNotice = { variable, requestedYear, resolvedYear, availableYears };
            } else if (clearWhenUnchanged) {
                yearAdjustmentNotice = null;
            }
            updateYearAdjustmentNotice();

            return { changed, requestedYear, resolvedYear, availableYears };
        }

        function getSingleYearVariableValue(properties, config, year) {
            if (config.temporal?.tipo === "anual" && !config.temporal.anios_disponibles.includes(Number(year))) {
                return null;
            }
            return config.getValue
                ? config.getValue(properties, year)
                : properties[config.property];
        }

        function supportsHistoricalAccumulation(config) {
            return config?.temporal?.tipo === "anual" && config.aggregation === "sum";
        }

        function getAccumulationYears(config) {
            return config?.temporal?.anios_acumulables || config?.temporal?.anios_disponibles || [];
        }

        function getVariableValueForPeriod(properties, variable, year, periodMode) {
            const config = VARIABLE_CONFIGS[variable];
            if (!config || !properties) return null;
            if (periodMode === "accumulated" && supportsHistoricalAccumulation(config)) {
                const values = getAccumulationYears(config)
                    .map(coveredYear => getSingleYearVariableValue(properties, config, coveredYear))
                    .filter(value => value !== null && value !== undefined && Number.isFinite(Number(value)))
                    .map(Number);
                return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
            }
            return getSingleYearVariableValue(properties, config, year);
        }

        function getVariableValue(properties, variable, year = selectedYear) {
            return getVariableValueForPeriod(properties, variable, year, selectedPeriodMode);
        }

        function refreshCitizenSummary() {
            window.REDSAExperience?.updateSummary(selectedTerritory?.props || null, selectedYear);
        }

        function formatCoveredYears(years = []) {
            const sorted = [...new Set(years.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
            if (!sorted.length) return "sin periodo declarado";
            const ranges = [];
            let start = sorted[0];
            let end = sorted[0];
            for (let index = 1; index <= sorted.length; index += 1) {
                if (sorted[index] === end + 1) {
                    end = sorted[index];
                    continue;
                }
                ranges.push(start === end ? String(start) : `${start}–${end}`);
                start = sorted[index];
                end = sorted[index];
            }
            return ranges.join(", ");
        }

        function getActivePeriodLabel(config = VARIABLE_CONFIGS[selectedVariable]) {
            if (selectedPeriodMode === "accumulated" && supportsHistoricalAccumulation(config)) {
                return `Histórico ${formatCoveredYears(getAccumulationYears(config))}`;
            }
            return config?.temporal?.tipo === "anual"
                ? (config.temporal.etiquetas_periodo?.[selectedYear] || String(selectedYear))
                : "";
        }

        function updatePeriodModeControl() {
            const config = VARIABLE_CONFIGS[selectedVariable] || VARIABLE_CONFIGS.normal;
            const supported = supportsHistoricalAccumulation(config);
            if (!supported && selectedPeriodMode === "accumulated") selectedPeriodMode = "year";
            document.querySelectorAll("[data-period-mode]").forEach(button => {
                const mode = button.dataset.periodMode;
                const active = mode === selectedPeriodMode;
                button.classList.toggle("active", active);
                button.setAttribute("aria-pressed", String(active));
                button.disabled = mode === "accumulated" && !supported;
            });
            const note = document.getElementById("period-mode-note");
            const info = document.getElementById("period-mode-info");
            if (note) {
                note.textContent = supported
                    ? (selectedPeriodMode === "accumulated"
                        ? `Suma de años completos compatibles: ${formatCoveredYears(getAccumulationYears(config))}. Los cortes parciales no se mezclan con años completos.`
                        : "Muestra únicamente el año marcado en la línea de tiempo.")
                    : "Este indicador no se suma entre años; se muestra su año o corte disponible.";
                if (info) info.dataset.customText = note.textContent;
            }
            window.REDSAAntLayer?.syncPeriodMode(selectedPeriodMode);
        }

        function getFatalitiesCoverageWarning(properties, year = selectedYear) {
            const coverage = properties?.fallecidos_cobertura_pct?.[String(year)];
            if (!Number.isFinite(Number(coverage)) || Number(coverage) >= 100) return "";
            if (Number(coverage) <= 0) return `Sin cobertura parroquial para ${year}; no se muestra como cero.`;
            return `Cobertura parcial: ${Number(coverage).toLocaleString("es-EC", { maximumFractionDigits: 2 })}% de las parroquias tiene dato para ${year}.`;
        }

        // --- TIMELINE PLAYBACK ENGINE ---
        let isPlayingTimeline = false;
        let timelinePlaybackTimer = null;

        function updateTimelinePlayControl() {
            const playBtn = document.getElementById("timeline-play-button");
            const playIcon = playBtn?.querySelector("i") || document.getElementById("timeline-play-icon");
            if (!playBtn) return;

            const coverage = TEMPORAL_COVERAGE[selectedVariable] || { tipo: "foto_unica", anios_disponibles: [] };
            const isAnnual = coverage.tipo === "anual";
            const accumulated = selectedPeriodMode === "accumulated" && supportsHistoricalAccumulation(VARIABLE_CONFIGS[selectedVariable]);
            const availableYears = coverage.anios_disponibles || [];
            const isSingleYear = !isAnnual || accumulated || availableYears.length <= 1;

            if (isSingleYear) {
                if (isPlayingTimeline) {
                    stopTimelinePlayback();
                }
                playBtn.disabled = true;
                playBtn.classList.add("disabled");
                playBtn.title = "Esta variable solo tiene un año disponible";
                playBtn.setAttribute("aria-label", "Esta variable solo tiene un año disponible");
                if (playIcon) playIcon.className = "fa-solid fa-play";
            } else {
                playBtn.disabled = false;
                playBtn.classList.remove("disabled");
                if (isPlayingTimeline) {
                    playBtn.title = "Pausar animación";
                    playBtn.setAttribute("aria-label", "Pausar línea de tiempo");
                    if (playIcon) playIcon.className = "fa-solid fa-pause";
                    playBtn.classList.add("playing");
                } else {
                    playBtn.title = "Reproducir animación año a año";
                    playBtn.setAttribute("aria-label", "Reproducir línea de tiempo");
                    if (playIcon) playIcon.className = "fa-solid fa-play";
                    playBtn.classList.remove("playing");
                }
            }
        }

        function stopTimelinePlayback() {
            if (timelinePlaybackTimer) {
                clearInterval(timelinePlaybackTimer);
                timelinePlaybackTimer = null;
            }
            isPlayingTimeline = false;
            updateTimelinePlayControl();
        }

        function setSelectedYearAndRefresh(newYear, { preserveYearAdjustmentNotice = false } = {}) {
            selectedYear = Number(newYear);
            if (!preserveYearAdjustmentNotice) clearYearAdjustmentNotice();
            const slider = document.getElementById("map-year-slider");
            if (slider) slider.value = String(selectedYear);

            const level = activeTerritoryLevel || getTerritoryLevelForZoom();
            if (typeof updateMapVariableDescription === "function") updateMapVariableDescription();
            updateTimelineControl();
            recalculateActiveVariableBins(selectedVariable, level);
            refreshTerritoryLayerStyles(level, true);
            if (typeof updateMapLevelNote === "function") updateMapLevelNote(level);
            if (typeof updateLegend === "function") updateLegend();
            if (typeof updateSidebar === "function" && typeof currentProps !== "undefined" && currentProps) updateSidebar(currentProps);
            if (typeof showProfileCard === "function" && typeof currentProfileProps !== "undefined" && currentProfileProps) showProfileCard(currentProfileProps, null);
            window.REDSAInstitutional?.refresh();
            window.REDSAAntLayer?.syncYear(selectedYear);
            window.REDSAAntLayer?.syncPeriodMode(selectedPeriodMode);
            refreshCitizenSummary();
        }

        function advanceToNextTimelineYear() {
            const coverage = TEMPORAL_COVERAGE[selectedVariable] || { tipo: "foto_unica", anios_disponibles: [] };
            const availableYears = coverage.anios_disponibles || [];
            if (availableYears.length <= 1) {
                stopTimelinePlayback();
                return;
            }

            let currentIndex = availableYears.indexOf(selectedYear);
            if (currentIndex < availableYears.length - 1) {
                const nextYear = availableYears[currentIndex + 1];
                setSelectedYearAndRefresh(nextYear);
                if (currentIndex + 1 === availableYears.length - 1) {
                    stopTimelinePlayback();
                }
            } else {
                stopTimelinePlayback();
            }
        }

        function startTimelinePlayback() {
            const coverage = TEMPORAL_COVERAGE[selectedVariable] || { tipo: "foto_unica", anios_disponibles: [] };
            const availableYears = coverage.anios_disponibles || [];
            if (availableYears.length <= 1) return;

            isPlayingTimeline = true;

            let currentIndex = availableYears.indexOf(selectedYear);
            if (currentIndex < 0 || currentIndex >= availableYears.length - 1) {
                setSelectedYearAndRefresh(availableYears[0]);
            }

            updateTimelinePlayControl();

            if (timelinePlaybackTimer) clearInterval(timelinePlaybackTimer);
            timelinePlaybackTimer = setInterval(() => {
                advanceToNextTimelineYear();
            }, INTERVALO_REPRODUCCION_MS);
        }

        function toggleTimelinePlayback() {
            if (isPlayingTimeline) {
                stopTimelinePlayback();
            } else {
                startTimelinePlayback();
            }
        }

        window.toggleTimelinePlayback = toggleTimelinePlayback;
        window.stopTimelinePlayback = stopTimelinePlayback;
        window.startTimelinePlayback = startTimelinePlayback;
        window.setMobilePanel = setMobilePanel;
        window.closeMobilePanels = closeMobilePanels;
        window.setRightContextPanel = setRightContextPanel;
        window.syncLegendCardPresentation = syncLegendCardPresentation;
        window.hideUnifiedLegend = hideUnifiedLegend;
        window.showUnifiedLegend = showUnifiedLegend;
        window.setSiteTopbarMenu = setSiteTopbarMenu;
        window.setSiteMethodologyMenu = setSiteMethodologyMenu;
        window.getTerritoryTooltipContent = getTerritoryTooltipContent;

        function updateTimelineControl() {
            const slider = document.getElementById("map-year-slider");
            const badge = document.getElementById("map-year-value") || document.getElementById("timeline-badge");
            const marks = document.getElementById("timeline-marks");
            const coverage = TEMPORAL_COVERAGE[selectedVariable] || { tipo: "foto_unica", anios_disponibles: [] };
            if (!slider) return;

            const isAnnual = coverage.tipo === "anual";
            const accumulated = selectedPeriodMode === "accumulated" && supportsHistoricalAccumulation(VARIABLE_CONFIGS[selectedVariable]);
            slider.min = String(TIMELINE_MIN_YEAR);
            slider.max = String(TIMELINE_MAX_YEAR);
            slider.disabled = !isAnnual || accumulated;
            slider.value = String(selectedYear);
            if (badge) {
                badge.className = `timeline-badge${isAnnual && !accumulated ? "" : " fixed"}`;
                badge.textContent = accumulated
                    ? "Histórico"
                    : isAnnual
                    ? String(selectedYear)
                    : (coverage.anios_disponibles.length
                        ? `Dato fijo · ${coverage.anios_disponibles.join("–")}`
                        : "Vista territorial");
            }
            if (marks) {
                marks.style.setProperty("--timeline-year-count", ALL_TIMELINE_YEARS.length);
                marks.innerHTML = ALL_TIMELINE_YEARS.map(year => {
                    const covered = isAnnual && coverage.anios_disponibles.includes(year);
                    return `<span class="timeline-mark${covered ? " tm-available" : " tm-unavailable"}" title="${covered ? "Dato disponible para " + year : "Sin dato disponible para " + year + " en la variable activa"}">${year}</span>`;
                }).join("");
            }

            const mobileYearBarScroll = document.getElementById("mobile-year-bar-scroll");
            if (mobileYearBarScroll) {
                mobileYearBarScroll.innerHTML = ALL_TIMELINE_YEARS.map(year => {
                    const covered = isAnnual && coverage.anios_disponibles.includes(year);
                    const isSelected = isAnnual && Number(selectedYear) === year;
                    const cls = [`my-${covered ? "available" : "unavailable"}`, isSelected ? "my-selected" : ""].filter(Boolean).join(" ");
                    const label = covered ? `Dato disponible para ${year}` : `Sin dato disponible para ${year} en la variable activa`;
                    return `<button type="button" data-year="${year}" class="${cls}" title="${label}" aria-label="${label}" ${!isAnnual || !covered ? "disabled" : ""}>${String(year).slice(2)}</button>`;
                }).join("");
            }

            updateTimelinePlayControl();
            updateYearAdjustmentNotice();
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

        function formatTooltipValue(val) {
            if (val === null || val === undefined || !Number.isFinite(Number(val))) return "Sin dato";
            const num = Number(val);
            if (Number.isInteger(num)) {
                return num.toLocaleString("es-EC");
            }
            return num.toLocaleString("es-EC", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        }

        const TERRITORY_TOOLTIP_FIXED_LINES = [
            {
                label: year => `Población (${year})`,
                levels: ["province", "canton"],
                sourceFields: ["poblacion_por_anio"],
                getValue: (props, year) => props.poblacion_por_anio?.[String(year)]
            },
            {
                label: year => `Siniestros (${year})`,
                levels: ["province", "canton", "parish"],
                sourceFields: ["siniestros_historico"],
                getValue: (props, year) => props.siniestros_historico?.[String(year)]
            },
            {
                label: year => `Fallecidos (${year})`,
                levels: ["province", "canton", "parish"],
                sourceFields: ["fallecidos_historico", "fallecidos_por_anio", "fallecidos_parroquial"],
                getValue: (props, year) => props.fallecidos_historico?.[String(year)]
                    ?? props.fallecidos_por_anio?.[String(year)]
                    ?? props.fallecidos_parroquial?.[String(year)]
            }
        ];

        function getConfigSourceFields(config) {
            if (Array.isArray(config?.sourceFields)) return config.sourceFields;
            return config?.property ? [config.property] : [];
        }

        function sourceFieldsOverlap(firstFields, secondFields) {
            const secondSet = new Set(secondFields);
            return firstFields.some(field => secondSet.has(field));
        }

        function getTerritoryTooltipContent(feature, level) {
            const props = feature?.properties || {};
            const names = {
                province: props.DPA_DESPRO,
                canton: props.DPA_DESCAN,
                parish: props.DPA_DESPAR
            };
            const name = names[level] || "Unidad territorial";

            const effectiveVar = getEffectiveVariable(level);
            const config = VARIABLE_CONFIGS[effectiveVar] || VARIABLE_CONFIGS.normal;
            const activeSourceFields = getConfigSourceFields(config);
            const fixedLines = TERRITORY_TOOLTIP_FIXED_LINES
                .filter(line => line.levels.includes(level))
                .filter(line => !sourceFieldsOverlap(activeSourceFields, line.sourceFields))
                .map(line => {
                    const rawValue = line.getValue(props, selectedYear);
                    return `${line.label(selectedYear)}: ${formatTooltipValue(rawValue)}`;
                });
            const value = getVariableValue(props, effectiveVar, selectedYear);
            const valueText = effectiveVar === "normal"
                ? "Límite administrativo"
                : `${config.label}: ${value === null || value === undefined ? "Sin dato" : formatTooltipValue(value)}`;
            const coverageWarning = selectedVariable === "fallecidos_parroquial"
                ? getFatalitiesCoverageWarning(props, selectedYear)
                : "";
            const warningHtml = coverageWarning
                ? `<br><span class="u-text-warning">${coverageWarning}</span>`
                : "";
            return `<strong>${name}</strong><br>${[...fixedLines, valueText].join("<br>")}${warningHtml}`;
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

            return window.REDSAClassification.calculateOptimalBinsFromValues(values, config, {
                minClasses: MIN_CLASSES,
                maxClasses: MAX_CLASSES,
                improvementThreshold: UMBRAL_MEJORA_GVF,
                concentrationThreshold: UMBRAL_CONCENTRACION_BIN,
                palette: getVariableColorPalette
            });
        }

        function getFeaturesForLevel(level, variable = selectedVariable) {
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
                activeVariableBins = { variable: "normal", level, year: selectedYear, periodMode: selectedPeriodMode, bins: [], displayBins: [], method: '', gvf: 0, validValueCount: 0, colors: [], logScaled: false };
            } else {
                const result = calculateOptimalBins(getFeaturesForLevel(level, variable), config, variable);
                activeVariableBins = {
                    variable,
                    level,
                    year: selectedYear,
                    periodMode: selectedPeriodMode,
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
                periodMode: activeVariableBins.periodMode,
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
                || activeVariableBins.periodMode !== selectedPeriodMode
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
            const config = VARIABLE_CONFIGS[effectiveVariable] || VARIABLE_CONFIGS.normal;
            const style = effectiveVariable === "normal"
                ? getBoundaryStyle(feature, level, isHovered, isSelected)
                : getChoroplethStyle(feature, effectiveVariable, level, isHovered, isSelected);
            if (isTerritorySurfaceAutoHidden(level)) style.fillOpacity = 0;
            return style;
        }

        function isTerritorySurfaceAutoHidden(level = activeTerritoryLevel || getTerritoryLevelForZoom()) {
            return map.getZoom() >= ZOOM_SURFACE_AUTO_HIDE_MIN
                && getEffectiveVariable(level) !== "normal";
        }

        function syncTerritorySurfaceAutoHideNote(level = activeTerritoryLevel || getTerritoryLevelForZoom()) {
            const hiddenByZoom = isTerritorySurfaceAutoHidden(level);
            const note = document.getElementById("territory-surface-auto-hide-note");
            if (note) note.hidden = !hiddenByZoom;
            document.body.classList.toggle("territory-surface-auto-hidden", hiddenByZoom);
            return hiddenByZoom;
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

        function clearSelectedLayerReferences() {
            selectedLayer = null;
            selectedProvinceLayer = null;
            selectedParishLayer = null;
        }

        function getVisibleMapObstacleRect(selector) {
            const element = document.querySelector(selector);
            if (!element) return null;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            const mapRect = map.getContainer().getBoundingClientRect();
            const intersectsMap = rect.right > mapRect.left
                && rect.left < mapRect.right
                && rect.bottom > mapRect.top
                && rect.top < mapRect.bottom;
            if (
                style.display === "none"
                || style.visibility === "hidden"
                || Number(style.opacity) === 0
                || rect.width <= 0
                || rect.height <= 0
                || !intersectsMap
            ) {
                return null;
            }
            return rect;
        }

        function getTerritoryFitPadding() {
            const mapRect = map.getContainer().getBoundingClientRect();
            const margin = 18;
            let left = 24;
            let right = 24;
            let top = 24;
            let bottom = 24;

            [".map-left-column"].forEach(selector => {
                const rect = getVisibleMapObstacleRect(selector);
                if (rect) left = Math.max(left, rect.right - mapRect.left + margin);
            });
            ["#right-context-host", "#right-tools-rail"].forEach(selector => {
                const rect = getVisibleMapObstacleRect(selector);
                if (rect) right = Math.max(right, mapRect.right - rect.left + margin);
            });

            const maximumHorizontalPadding = Math.max(0, mapRect.width - 220);
            const horizontalPadding = left + right;
            if (horizontalPadding > maximumHorizontalPadding && horizontalPadding > 0) {
                const scale = maximumHorizontalPadding / horizontalPadding;
                left *= scale;
                right *= scale;
            }

            const maximumVerticalPadding = Math.max(0, mapRect.height - 180);
            const verticalPadding = top + bottom;
            if (verticalPadding > maximumVerticalPadding && verticalPadding > 0) {
                const scale = maximumVerticalPadding / verticalPadding;
                top *= scale;
                bottom *= scale;
            }

            return {
                paddingTopLeft: L.point(Math.round(left), Math.round(top)),
                paddingBottomRight: L.point(Math.round(right), Math.round(bottom))
            };
        }

        function fitBoundsWithinTerritoryLevel(layer, level, { animate = true } = {}) {
            const maxZoomByLevel = {
                province: ZOOM_PROVINCIAS_MAX,
                canton: ZOOM_CANTONES_MAX,
                parish: map.getMaxZoom()
            };
            const padding = getTerritoryFitPadding();
            map.fitBounds(layer.getBounds(), {
                ...padding,
                maxZoom: maxZoomByLevel[level],
                animate
            });
        }

        let selectedTerritoryRefitTimer = null;

        function scheduleSelectedTerritoryRefit(delay = 80) {
            if (!selectedTerritory?.layer || !selectedTerritory?.level) return;
            if (selectedTerritoryRefitTimer) window.clearTimeout(selectedTerritoryRefitTimer);
            selectedTerritoryRefitTimer = window.setTimeout(() => {
                selectedTerritoryRefitTimer = null;
                if (selectedTerritory?.layer && selectedTerritory?.level) {
                    fitBoundsWithinTerritoryLevel(selectedTerritory.layer, selectedTerritory.level, { animate: false });
                }
            }, delay);
        }

        function preservePopupForSecondClick(layer) {
            if (layer?._openPopup) layer.off("click", layer._openPopup);
        }

        function handleTerritoryClick(level, event) {
            const layer = event.target;
            if (selectedTerritory?.layer === layer) {
                showProfileCard(selectedTerritory.props, { target: layer });
                fitBoundsWithinTerritoryLevel(layer, level);
                layer.openPopup?.();
                return true;
            }
            map.closePopup();
            return selectTerritoryLayer(level, layer);
        }

        function selectTerritoryLayer(level, layer, options = {}) {
            if (!layer?.feature?.properties) return false;
            const { fitBounds = true, updateHash = true, showProfile = true, searchSelection = false } = options;
            if (!searchSelection) window.REDSAExperience?.clearSearchAdjustmentNotice?.();
            const previousSelection = selectedTerritory;
            clearSelectedLayerReferences();
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

            updateSidebar(selectedTerritory.props);
            if (showProfile) {
                showProfileCard(selectedTerritory.props, { target: layer });
            } else if (typeof hideProfileCard === "function") {
                hideProfileCard();
            }
            if (fitBounds) fitBoundsWithinTerritoryLevel(layer, level);
            window.REDSAAntLayer?.syncTerritory(level, selectedTerritory.props);

            if (updateHash && level === "canton") {
                window.location.hash = "canton=" + encodeURIComponent(selectedTerritory.props.DPA_DESCAN);
            }
            return true;
        }

        function clearTerritorySelection() {
            const previousSelection = selectedTerritory;
            clearSelectedLayerReferences();
            selectedTerritory = null;
            if (previousSelection?.layer) {
                const group = getLayerForLevel(previousSelection.level);
                group?.resetStyle(previousSelection.layer);
            }
            currentProps = null;
            updateSidebar(null);
            window.REDSAAntLayer?.syncTerritory(null, null);
            if (typeof hideProfileCard === "function") hideProfileCard();
            if (window.location.hash.startsWith("#canton=")) {
                history.replaceState(null, "", window.location.pathname + window.location.search);
            }
        }
