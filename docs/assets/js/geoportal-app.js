// Funciones interactivas para cada feature (Cantón)
        function onEachFeature(feature, layer) {
            // Popup al hacer clic
            if (feature.properties) {
                const canton = feature.properties.DPA_DESCAN || "Desconocido";
                const provincia = feature.properties.DPA_DESPRO || "Desconocido";
                const codCanton = feature.properties.DPA_CANTON || "—";
                const codProvincia = feature.properties.DPA_PROVIN || "—";

                const popupContent = `
                    <div class="custom-popup">
                        <h3>${canton}</h3>
                        <p><strong>Provincia:</strong> ${provincia}</p>
                        <div class="dpa-code">Cód. Cantón: ${codCanton} | Cód. Prov: ${codProvincia}</div>
                    </div>
                `;
                layer.bindPopup(popupContent, {
                    maxWidth: 300,
                    className: 'custom-leaflet-popup'
                });
                preservePopupForSecondClick(layer);
            }

            // Eventos de Mouse
            layer.on({
                mouseover: highlightFeature,
                mouseout: resetHighlight,
                click: function(e) {
                    handleTerritoryClick("canton", e);
                }
            });
            layer.bindTooltip(() => getTerritoryTooltipContent(layer.feature, "canton"), {
                sticky: true,
                direction: "top",
                className: "territory-hover-tooltip"
            });
        }

        // Resaltado al pasar el mouse
        function highlightFeature(e) {
            const layer = e.target;
            if (layer !== selectedLayer) {
                layer.setStyle(getCantonStyle(layer.feature, true, false));
            }

            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                layer.bringToFront();
            }

        }

        // Restaurar estilo normal al quitar el mouse
        function resetHighlight(e) {
            const layer = e.target;
            if (layer !== selectedLayer) {
                cantonLayer.resetStyle(layer);
            }

        }

        // Iniciar Fetch de datos y medición
        document.getElementById("loader-status").textContent = "Descargando límites provinciales y cantonales...";

        Promise.all([
            fetch(RUTA_PROVINCIAS_RELATIVA).then(response => {
                if (!response.ok) throw new Error("No se pudo cargar el GeoJSON provincial.");
                return response.json();
            }),
            fetch(RUTA_CANTONES_RELATIVA).then(response => {
                if (!response.ok) throw new Error("No se pudo cargar el GeoJSON cantonal.");
                return response.json();
            }),
            fetch(RUTA_HOTSPOTS_CANTONALES_RELATIVA).then(response => {
                if (!response.ok) throw new Error("No se pudo cargar el GeoJSON de hotspots cantonales.");
                return response.json();
            })
        ])
            .then(([provinces, cantons, hotspots]) => {
                const tDownloadEnd = performance.now();
                const tDownload = ((tDownloadEnd - tStart) / 1000).toFixed(2);
                document.getElementById("diag-download").textContent = `${tDownload}s`;
                document.getElementById("loader-status").textContent = "Procesando y renderizando límites territoriales...";
                const tRenderStart = performance.now();
                provinceData = provinces;
                cantonData = cantons;
                hotspotData = hotspots;
                mergeHotspotsIntoCantons(cantonData, hotspotData);
                nationalFatalitiesByYear = calculateNationalFatalitiesByYear(cantonData);

                provinceLayer = L.geoJSON(provinceData, {
                    pane: "territorioPane",
                    style: function(feature) {
                        const isSelected = selectedProvinceLayer && selectedProvinceLayer.feature.properties.DPA_PROVIN === feature.properties.DPA_PROVIN;
                        return getProvinceStyle(feature, false, isSelected);
                    },
                    onEachFeature: onEachProvinceFeature
                });

                cantonLayer = L.geoJSON(cantonData, {
                    pane: "territorioPane",
                    style: function(feature) {
                        const isSelected = selectedLayer && selectedLayer.feature.properties.DPA_CANTON === feature.properties.DPA_CANTON;
                        return getCantonStyle(feature, false, isSelected);
                    },
                    onEachFeature: onEachFeature
                });

                const tRenderEnd = performance.now();
                const tRender = ((tRenderEnd - tRenderStart) / 1000).toFixed(2);
                const tTotal = ((tRenderEnd - tStart) / 1000).toFixed(2);

                document.getElementById("diag-render").textContent = `${tRender}s`;
                document.getElementById("diag-total").textContent = `${tTotal}s`;
                document.getElementById("diag-features").textContent = `${provinces.features ? provinces.features.length : 0} prov. / ${cantons.features ? cantons.features.length : 0} cant.`;

                syncTerritoryLayerToZoom();
                map.on('zoomend', syncTerritoryLayerToZoom);

                function selectCantonLayer(foundLayer, updateHash = true) {
                    if (!foundLayer) return false;
                    return selectTerritoryLayer("canton", foundLayer, { fitBounds: true, updateHash });
                }

                function selectCantonByCode(code, updateHash = true) {
                    let foundLayer = null;
                    cantonLayer.eachLayer(layer => {
                        if (!foundLayer && String(layer.feature?.properties?.DPA_CANTON) === String(code)) foundLayer = layer;
                    });
                    return selectCantonLayer(foundLayer, updateHash);
                }

                window.REDSAExperience?.init({
                    provinceFeatures: provinceData.features,
                    cantonFeatures: cantonData.features,
                    selectCanton: code => selectCantonByCode(code, true),
                    openAnalysis: () => setMobilePanel("sidebar", true),
                    getSelectedYear: () => selectedYear
                });
                window.REDSAInstitutional?.init({
                    cantonFeatures: cantonData.features,
                    variables: VARIABLE_CONFIGS,
                    getState: () => ({ selectedVariable, selectedYear, selectedPeriodMode }),
                    getVariableValue: (properties, variable, year) => getVariableValue(properties, variable, year)
                });

                // Manejo de Hash Routing en carga inicial y cambios
                const handleHash = () => {
                    const hash = window.location.hash;
                    if (hash && hash.startsWith("#canton=")) {
                        const cantonName = decodeURIComponent(hash.substring(8)).trim().toUpperCase();
                        let foundLayer = null;

                        cantonLayer.eachLayer(layer => {
                            if (layer.feature && layer.feature.properties &&
                                layer.feature.properties.DPA_DESCAN.trim().toUpperCase() === cantonName) {
                                foundLayer = layer;
                            }
                        });

                        selectCantonLayer(foundLayer, false);
                    }
                };

                handleHash();
                window.addEventListener("hashchange", handleHash);

                function layerOptionsFromConfig(config) {
                    const options = {
                        pane: "infraestructuraPane",
                        filter: config.filterFeature,
                        onEachFeature(feature, layer) {
                            if (feature.properties && config.popup) layer.bindPopup(config.popup(feature.properties));
                            layer.on("click", event => selectTerritoryBelowInfrastructure(event.latlng));
                        }
                    };
                    if (["point", "mixed"].includes(config.render)) {
                        options.pointToLayer = (feature, latlng) => {
                            return L.circleMarker(latlng, {
                                radius: config.radius || 5,
                                fillColor: config.color,
                                color: config.outlineColor || "#ffffff",
                                pane: "infraestructuraPane",
                                weight: 1,
                                opacity: 1,
                                fillOpacity: 0.82
                            });
                        };
                    }
                    if (["line", "mixed"].includes(config.render)) {
                        options.style = () => {
                            return {
                                color: config.color,
                                weight: config.weight || 3,
                                opacity: 0.82
                            };
                        };
                    }
                    return options;
                }

                function selectTerritoryBelowInfrastructure(latlng) {
                    const territoryLayer = getLayerForLevel(activeTerritoryLevel);
                    if (!territoryLayer || !latlng) return;
                    const point = map.latLngToLayerPoint(latlng);
                    let found = null;
                    territoryLayer.eachLayer(layer => {
                        if (!found && typeof layer._containsPoint === "function" && layer._containsPoint(point)) found = layer;
                    });
                    if (found) handleTerritoryClick(activeTerritoryLevel, { target: found, latlng });
                }

                const infrastructureDataPromises = new Map();
                function fetchInfrastructureData(url) {
                    if (!infrastructureDataPromises.has(url)) {
                        infrastructureDataPromises.set(url, fetch(url).then(response => {
                            if (!response.ok) throw new Error(`No se pudo cargar ${url}.`);
                            return response.json();
                        }));
                    }
                    return infrastructureDataPromises.get(url);
                }

                function registerInfrastructureLayer(config) {
                    const placeholder = L.layerGroup();
                    placeholder._redsaLoaded = false;
                    placeholder._redsaFeatureCount = 0;
                    placeholder._redsaConfigId = config.id;
                    const startLoad = () => {
                        if (placeholder._redsaLoadPromise) return placeholder._redsaLoadPromise;
                        placeholder._redsaLoadPromise = fetchInfrastructureData(config.url)
                            .then(data => {
                                const selectedFeatures = (data.features || []).filter(feature => !config.filterFeature || config.filterFeature(feature));
                                const selectedData = { ...data, features: selectedFeatures };
                                const layer = L.geoJSON(selectedData, layerOptionsFromConfig(config));
                                const mappedCantons = new Set(
                                    selectedFeatures.flatMap(feature => feature.properties?.DPA_CANTONES || []).map(String)
                                );
                                const unmappedFeatures = config.coverageMask
                                    ? (cantonData?.features || []).filter(feature => !mappedCantons.has(String(feature.properties?.DPA_CANTON)))
                                    : [];
                                if (unmappedFeatures.length) {
                                    placeholder.addLayer(L.geoJSON({ type: "FeatureCollection", features: unmappedFeatures }, {
                                        pane: "infraestructuraPane",
                                        interactive: false,
                                        style: {
                                            color: "#64748b",
                                            weight: 0.8,
                                            opacity: 0.65,
                                            dashArray: "4 4",
                                            fillColor: "#94a3b8",
                                            fillOpacity: 0.12
                                        }
                                    }));
                                }
                                placeholder._redsaFeatureCount = selectedFeatures.length;
                                placeholder._redsaUnmappedCantonCount = unmappedFeatures.length;
                                placeholder._redsaLoaded = true;
                                placeholder.addLayer(layer);
                                updateLegend();
                                return layer;
                            })
                            .catch(error => {
                                placeholder._redsaLoadError = error.message;
                                console.warn(`Advertencia al cargar '${config.label}':`, error);
                                updateLegend();
                                throw error;
                            });
                        return placeholder._redsaLoadPromise;
                    };
                    placeholder.on("add", () => {
                        updateLegend();
                        startLoad();
                    });
                    placeholder.on("remove", updateLegend);
                    placeholder._redsaStartLoad = startLoad;
                    overlayMaps[config.label] = placeholder;
                    return placeholder;
                }

                INFRASTRUCTURE_LAYER_CONFIGS.forEach(registerInfrastructureLayer);
                if (layerControl) map.removeControl(layerControl);
                layerControl = L.control.layers({}, overlayMaps, {
                    position: "topright",
                    collapsed: false
                }).addTo(map);
                syncMobileLayerDrawer();
                INFRASTRUCTURE_LAYER_CONFIGS.forEach(config => {
                    if (config.preload) overlayMaps[config.label]?._redsaStartLoad?.();
                });
                updateLegend();

                // Initialize Selector Control on Map
                const MapControl = L.Control.extend({
                    options: { position: 'topleft' },
                    onAdd: function(map) {
                        const div = L.DomUtil.create('div', 'map-selector-control glass');
                        div.innerHTML = `
                            <div style="font-weight: 600; font-size: 0.7rem; color: var(--text-primary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">Variables del Mapa</div>
                            <select id="map-variable-select" style="background: rgba(15, 23, 42, 0.85); color: #f8fafc; border: 1px solid var(--border-glass); border-radius: 4px; padding: 4px 6px; font-size: 0.75rem; cursor: pointer; outline: none; width: 100%;">
                                ${Object.entries(VARIABLE_CONFIGS).map(([id, config]) => `<option value="${id}" ${id === selectedVariable ? "selected" : ""}>${config.label}</option>`).join("")}
                            </select>
                            <div id="map-variable-description" class="map-variable-description" aria-live="polite"></div>
                            <div class="period-mode-control" aria-label="Periodo mostrado">
                                <div class="period-mode-label">Periodo mostrado</div>
                                <div class="period-mode-segments" role="group" aria-label="Cambiar entre año y acumulado histórico">
                                    <button type="button" data-period-mode="year" class="active" aria-pressed="true">Año seleccionado</button>
                                    <button type="button" data-period-mode="accumulated" aria-pressed="false">Acumulado histórico</button>
                                </div>
                                <div id="period-mode-note" class="period-mode-note" aria-live="polite"></div>
                            </div>
                            <div class="timeline-control">
                                <div class="timeline-header">
                                    <div class="timeline-title-wrap" style="display: inline-flex; align-items: center; gap: 6px;">
                                        <button type="button" id="timeline-play-button" class="timeline-play-btn" aria-label="Reproducir línea de tiempo" title="Reproducir animación año a año">
                                            <i class="fa-solid fa-play" id="timeline-play-icon"></i>
                                        </button>
                                        <span>Línea de tiempo global</span>
                                    </div>
                                    <span id="timeline-badge" class="timeline-badge">2024</span>
                                </div>
                                <input id="map-year-slider" type="range" min="${TIMELINE_MIN_YEAR}" max="${TIMELINE_MAX_YEAR}" step="1" value="${selectedYear}" aria-label="Año del geoportal">
                                <div id="timeline-marks" class="timeline-marks"></div>
                            </div>
                            <div id="territory-level-control" class="territory-level-control" aria-label="Nivel territorial visible">
                                <div class="territory-level-label">Nivel territorial</div>
                                <div class="territory-level-segments" role="group" aria-label="Cambiar nivel territorial">
                                    <button type="button" data-level-mode="auto" aria-pressed="true">Auto</button>
                                    <button type="button" data-level-mode="province" aria-pressed="false">Provincias</button>
                                    <button type="button" data-level-mode="canton" aria-pressed="false">Cantones</button>
                                    <button type="button" data-level-mode="parish" aria-pressed="false">Parroquias</button>
                                </div>
                                <div id="territory-level-status" class="territory-level-status" aria-live="polite"></div>
                            </div>
                            <div id="map-level-note" class="map-level-note"></div>
                        `;
                        L.DomEvent.disableClickPropagation(div);
                        const playBtn = div.querySelector("#timeline-play-button");
                        if (playBtn) {
                            L.DomEvent.on(playBtn, "click", function(e) {
                                L.DomEvent.stopPropagation(e);
                                L.DomEvent.preventDefault(e);
                                if (!playBtn.disabled && window.toggleTimelinePlayback) {
                                    window.toggleTimelinePlayback();
                                }
                            });
                        }
                        return div;
                    }
                });
                new MapControl().addTo(map);
                syncMobileLayerDrawer();
                updateMapVariableDescription();
                updatePeriodModeControl();
                updateTimelineControl();
                updateMapLevelNote(activeTerritoryLevel);
                updateTerritoryLevelControl();
                updateLegend();

                document.addEventListener("click", (e) => {
                    const playBtn = e.target.closest("#timeline-play-button");
                    if (playBtn && !playBtn.disabled) {
                        window.toggleTimelinePlayback?.();
                    }
                });

                document.addEventListener("change", (e) => {
                    if (e.target && e.target.id === "map-variable-select") {
                        selectedVariable = e.target.value;
                        handleVariableChange();
                    }
                });

                function handleVariableChange() {
                    if (window.stopTimelinePlayback) window.stopTimelinePlayback();
                    const level = activeTerritoryLevel || getTerritoryLevelForZoom();
                    updateMapVariableDescription();
                    updatePeriodModeControl();
                    updateTimelineControl();
                    recalculateActiveVariableBins(selectedVariable, level);
                    refreshTerritoryLayerStyles(level, true);
                    updateMapLevelNote(level);
                    updateLegend();
                    window.REDSAInstitutional?.refresh();
                }

                function updateMapVariableDescription() {
                    const description = document.getElementById("map-variable-description");
                    const config = VARIABLE_CONFIGS[selectedVariable] || VARIABLE_CONFIGS.normal;
                    if (description) description.textContent = config.description;
                    window.REDSAExperience?.updateMapContext(
                        config,
                        getActivePeriodLabel(config),
                        LEVEL_LABELS[activeTerritoryLevel || getTerritoryLevelForZoom()]
                    );
                }

                document.addEventListener("click", (event) => {
                    const periodButton = event.target.closest("[data-period-mode]");
                    if (!periodButton || periodButton.disabled) return;
                    if (window.stopTimelinePlayback) window.stopTimelinePlayback();
                    selectedPeriodMode = periodButton.dataset.periodMode;
                    const level = activeTerritoryLevel || getTerritoryLevelForZoom();
                    updateMapVariableDescription();
                    updatePeriodModeControl();
                    updateTimelineControl();
                    recalculateActiveVariableBins(selectedVariable, level);
                    refreshTerritoryLayerStyles(level, true);
                    updateMapLevelNote(level);
                    updateLegend();
                    window.REDSAInstitutional?.refresh();
                });

                document.getElementById("map-year-slider").addEventListener("input", function() {
                    if (window.stopTimelinePlayback) window.stopTimelinePlayback();
                    selectedYear = Number(this.value);
                    const level = activeTerritoryLevel || getTerritoryLevelForZoom();
                    updateMapVariableDescription();
                    updateTimelineControl();
                    recalculateActiveVariableBins(selectedVariable, level);
                    refreshTerritoryLayerStyles(level, true);
                    updateMapLevelNote(level);
                    updateLegend();
                    if (currentProps) updateSidebar(currentProps);
                    if (currentProfileProps) showProfileCard(currentProfileProps, null);
                    window.REDSAInstitutional?.refresh();
                });

                document.addEventListener("click", (e) => {
                    const levelButton = e.target.closest("[data-level-mode]");
                    if (levelButton) setTerritoryLevelMode(levelButton.dataset.levelMode);
                });

                // profile-accordion-btn listener removed

                // Glossary Accordion Toggler
                document.getElementById("glossary-accordion-btn").addEventListener("click", function() {
                    this.classList.toggle("active");
                    const content = document.getElementById("glossary-accordion-content");
                    content.classList.toggle("active");
                });

                // Siglas Custom Tooltips & Popovers
                const siglaDefinitions = {
                    "EDG": "Registro Estadístico de Defunciones Generales, INEC — registro civil de muertes clasificadas por causa (CIE-10).",
                    "SPPAT": "Servicio Público para Pago de Accidentes de Tránsito — reclamaciones de seguro procesadas y pagadas.",
                    "INEC": "Instituto Nacional de Estadística y Censos de Ecuador.",
                    "CIE-10": "Clasificación Internacional de Enfermedades, 10ª revisión — estándar usado para causas de muerte por tránsito (códigos V01 a V89).",
                    "DPA": "División Político Administrativa — codificación oficial de provincias, cantones y parroquias del Ecuador.",
                    "VEHICULOS_MATRICULADOS": "Vehículos Matriculados (INEC ESTRA 2024): registrados por residencia del propietario, no representa necesariamente donde circula el vehículo.",
                    "COBERTURA_OSM": "Cobertura de mapeo OSM: densidad de semáforos/rotondas, cruces y aceras registrados. Un cero significa sin elementos mapeados, no ausencia comprobada de infraestructura.",
                    "OSM_VIAS": "Vías de OpenStreetMap clasificadas por jerarquía funcional. No equivalen jurídicamente a la Red Vial Estatal del MTOP y su cobertura depende del mapeo colaborativo."
                };

                const popover = document.createElement("div");
                popover.id = "sigla-popover";
                popover.className = "sigla-popover";
                document.body.appendChild(popover);

                let activeTrigger = null;
                let pinnedTrigger = null;

                function showPopover(trigger, text, pinned = false) {
                    popover.innerHTML = text;
                    popover.style.display = "block";

                    const triggerRect = trigger.getBoundingClientRect();
                    const popoverRect = popover.getBoundingClientRect();

                    let top = triggerRect.top + window.scrollY - popoverRect.height - 8;
                    let left = triggerRect.left + window.scrollX + (triggerRect.width / 2) - (popoverRect.width / 2);

                    if (left < 10) left = 10;
                    if (left + popoverRect.width > window.innerWidth - 10) {
                        left = window.innerWidth - popoverRect.width - 10;
                    }
                    if (top < 10) {
                        top = triggerRect.bottom + window.scrollY + 8;
                    }

                    popover.style.top = top + "px";
                    popover.style.left = left + "px";
                    popover.style.opacity = "1";
                    activeTrigger = trigger;
                    if (pinned) pinnedTrigger = trigger;
                }

                function hidePopover() {
                    popover.style.display = "none";
                    popover.style.opacity = "0";
                    activeTrigger = null;
                    pinnedTrigger = null;
                }

                document.addEventListener("mouseover", (e) => {
                    const trigger = e.target.closest(".sigla-tooltip-trigger");
                    if (trigger && !pinnedTrigger) {
                        const sigla = trigger.getAttribute("data-sigla");
                        const customText = trigger.getAttribute("data-custom-text");
                        if (customText) {
                            showPopover(trigger, `<strong>${sigla}:</strong> ${customText}`);
                        } else if (siglaDefinitions[sigla]) {
                            showPopover(trigger, `<strong>${sigla}:</strong> ${siglaDefinitions[sigla]}`);
                        }
                    }
                });

                document.addEventListener("mouseout", (e) => {
                    const trigger = e.target.closest(".sigla-tooltip-trigger");
                    if (trigger && activeTrigger === trigger && !pinnedTrigger) {
                        hidePopover();
                    }
                });

                document.addEventListener("click", (e) => {
                    const trigger = e.target.closest(".sigla-tooltip-trigger");
                    if (trigger) {
                        e.stopPropagation();
                        const sigla = trigger.getAttribute("data-sigla");
                        const customText = trigger.getAttribute("data-custom-text");
                        if (customText || siglaDefinitions[sigla]) {
                            if (pinnedTrigger === trigger && popover.style.display === "block") {
                                hidePopover();
                            } else {
                                const text = customText ? customText : siglaDefinitions[sigla];
                                showPopover(trigger, `<strong>${sigla}:</strong> ${text}`, true);
                            }
                        }
                    } else if (e.target.closest("#sigla-popover") === null) {
                        hidePopover();
                    }
                });

                // API minima y de solo diagnostico para pruebas reejecutables.
                window.__redsaGeojsonLoadMetrics = {
                    downloadMs: Number(tDownload) * 1000,
                    renderMs: Number(tRender) * 1000,
                    totalMs: Number(tTotal) * 1000,
                    provinceFeatures: provinceData.features.length,
                    cantonFeatures: cantonData.features.length
                };
                window.__redsaAudit = {
                    findTerritoryLayer(level, code) {
                        const group = level === "province" ? provinceLayer : (level === "parish" ? parishLayer : cantonLayer);
                        if (!group) return null;
                        let found = null;
                        group.eachLayer(candidate => {
                            const props = candidate.feature?.properties;
                            const candidateCode = level === "province" ? props?.DPA_PROVIN : (level === "parish" ? props?.DPA_PARROQ : props?.DPA_CANTON);
                            if (!found && String(candidateCode) === String(code)) found = candidate;
                        });
                        return found;
                    },
                    fireTerritoryEvent(level, code, eventName) {
                        const found = this.findTerritoryLayer(level, code);
                        if (!found || !["click", "mouseover", "mouseout"].includes(eventName)) return false;
                        found.fire(eventName, { target: found });
                        return this.state();
                    },
                    territoryStyle(level, code) {
                        const found = this.findTerritoryLayer(level, code);
                        if (!found) return null;
                        return {
                            color: found.options.color,
                            weight: found.options.weight,
                            opacity: found.options.opacity,
                            fillColor: found.options.fillColor,
                            fillOpacity: found.options.fillOpacity
                        };
                    },
                    setZoom(zoom) {
                        map.setView(map.getCenter(), zoom, { animate: false });
                        syncTerritoryLayerToZoom();
                        return this.state();
                    },
                    prepareTerritoryTap(level, code) {
                        const found = this.findTerritoryLayer(level, code);
                        if (!found) return null;
                        const zoomByLevel = { province: 6, canton: 9, parish: 12 };
                        let center = found.getBounds().getCenter();
                        map.setView(center, zoomByLevel[level], { animate: false });
                        syncTerritoryLayerToZoom();
                        if (map.hasLayer(getLayerForLevel(level)) && found.getCenter) {
                            center = found.getCenter();
                            map.setView(center, zoomByLevel[level], { animate: false });
                        }

                        const mapRect = map.getContainer().getBoundingClientRect();
                        const citizen = document.getElementById("citizen-panel");
                        const legend = document.querySelector(".legend-panel");
                        const citizenRect = citizen && isVisibleElement(citizen) ? citizen.getBoundingClientRect() : null;
                        const legendRect = legend && isVisibleElement(legend) ? legend.getBoundingClientRect() : null;
                        const freeTop = Math.max(76, citizenRect ? citizenRect.bottom + 20 : 76);
                        const freeBottom = Math.min(
                            mapRect.bottom - 70,
                            legendRect ? legendRect.top - 20 : mapRect.bottom - 70
                        );
                        const targetY = Math.max(freeTop, Math.min((freeTop + freeBottom) / 2, freeBottom));
                        const currentPoint = map.latLngToContainerPoint(center);
                        map.panBy([0, currentPoint.y - (targetY - mapRect.top)], { animate: false });
                        const tapPoint = map.latLngToContainerPoint(center);
                        return {
                            x: mapRect.left + tapPoint.x,
                            y: mapRect.top + tapPoint.y,
                            level,
                            code: String(code)
                        };
                    },
                    setTerritoryLevelMode(mode) {
                        return setTerritoryLevelMode(mode) ? this.state() : false;
                    },
                    selectVariable(variable) {
                        const select = document.getElementById("map-variable-select");
                        if (!select || !VARIABLE_CONFIGS[variable]) return false;
                        select.value = variable;
                        selectedVariable = variable;
                        handleVariableChange();
                        return true;
                    },
                    selectYear(year) {
                        const numericYear = Number(year);
                        const slider = document.getElementById("map-year-slider");
                        if (!ALL_TIMELINE_YEARS.includes(numericYear) || !slider || slider.disabled) return false;
                        selectedYear = numericYear;
                        slider.value = String(numericYear);
                        slider.dispatchEvent(new Event("input", { bubbles: true }));
                        return true;
                    },
                    showTerritory(level, code) {
                        const layer = level === "province" ? provinceLayer : (level === "parish" ? parishLayer : cantonLayer);
                        if (!layer) return false;
                        let found = null;
                        layer.eachLayer(candidate => {
                            const props = candidate.feature && candidate.feature.properties;
                            const candidateCode = level === "province" ? props?.DPA_PROVIN : (level === "parish" ? props?.DPA_PARROQ : props?.DPA_CANTON);
                            if (!found && (!code || String(candidateCode) === String(code))) found = candidate;
                        });
                        if (!found) return false;
                        return selectTerritoryLayer(level, found, { fitBounds: false, updateHash: false });
                    },
                    clearSelection() {
                        clearTerritorySelection();
                        return this.state();
                    },
                    setOverlay(label, visible = true) {
                        const layer = overlayMaps[label];
                        if (!layer) return false;
                        if (visible) map.addLayer(layer);
                        else map.removeLayer(layer);
                        return true;
                    },
                    clearInfrastructure() {
                        Object.values(overlayMaps).forEach(layer => {
                            if (map.hasLayer(layer)) map.removeLayer(layer);
                        });
                        updateLegend();
                        return this.state();
                    },
                    fireOverlayClick(label) {
                        const group = overlayMaps[label];
                        if (!group) return false;
                        let target = null;
                        group.eachLayer(child => {
                            if (!target && typeof child.eachLayer === "function") {
                                child.eachLayer(candidate => {
                                    if (!target && typeof candidate.getBounds === "function") target = candidate;
                                });
                            }
                        });
                        if (!target) return false;
                        const latlng = target.getBounds().getCenter();
                        target.fire("click", { latlng });
                        return true;
                    },
                    state() {
                        const layerState = layer => ({
                            ready: Boolean(layer),
                            visible: Boolean(layer && map.hasLayer(layer)),
                            features: layer && typeof layer.getLayers === "function" ? layer.getLayers().length : 0
                        });
                        return {
                            zoom: map.getZoom(),
                            center: map.getCenter(),
                            bounds: map.getBounds(),
                            level: activeTerritoryLevel,
                            territoryLevelMode,
                            selectedTerritory: selectedTerritory ? {
                                level: selectedTerritory.level,
                                code: selectedTerritory.level === "province"
                                    ? selectedTerritory.props.DPA_PROVIN
                                    : (selectedTerritory.level === "canton"
                                        ? selectedTerritory.props.DPA_CANTON
                                        : selectedTerritory.props.DPA_PARROQ)
                            } : null,
                            selectedLayerReferenceCount: [selectedProvinceLayer, selectedLayer, selectedParishLayer].filter(Boolean).length,
                            selectedVariable,
                            selectedYear,
                            selectedPeriodMode,
                            variableCount: Object.keys(VARIABLE_CONFIGS).length,
                            infrastructureLayerCount: INFRASTRUCTURE_LAYER_CONFIGS.length,
                            temporalCoverage: TEMPORAL_COVERAGE[selectedVariable],
                            timelineDisabled: Boolean(document.getElementById("map-year-slider")?.disabled),
                            timelineBadge: document.getElementById("timeline-badge")?.textContent,
                            effectiveVariable: getEffectiveVariable(activeTerritoryLevel),
                            bins: [...activeVariableBins.bins],
                            validValueCount: activeVariableBins.validValueCount,
                            layers: {
                                province: layerState(provinceLayer),
                                canton: layerState(cantonLayer),
                                parish: layerState(parishLayer)
                            },
                            osmLayers: Object.fromEntries(INFRASTRUCTURE_LAYER_CONFIGS.map(config => {
                                const layer = overlayMaps[config.label];
                                return [config.label, {
                                    registered: Boolean(layer),
                                    visible: Boolean(layer && map.hasLayer(layer)),
                                    loaded: Boolean(layer?._redsaLoaded),
                                    features: layer?._redsaFeatureCount || 0,
                                    unmappedCantons: layer?._redsaUnmappedCantonCount ?? null,
                                    error: layer?._redsaLoadError || null
                                }];
                            }))
                        };
                    }
                };

                // Ocultar pantalla de carga
                const loader = document.getElementById("loader");
                loader.style.opacity = 0;
                setTimeout(() => {
                    loader.style.display = "none";
                }, 500);
            })
            .catch(error => {
                console.error("Error al inicializar el geoportal:", error);
                document.getElementById("loader-status").innerHTML = `<span style="color: #ef4444; font-weight: bold;">Error: ${error.message}</span>`;
                document.getElementById("diag-download").textContent = "Error";
                document.getElementById("diag-download").style.color = "#ef4444";
            });

        // --- TEMA CLARO / OSCURO ---
        document.addEventListener('DOMContentLoaded', () => {
            const btnTheme = document.getElementById('btn-theme-toggle');
            if (btnTheme) {
                // Leer preferencia
                const savedTheme = localStorage.getItem('redsa_light_theme');
                const isLight = savedTheme === null ? true : savedTheme === 'true';
                if (isLight) {
                    document.body.classList.add('light-theme');
                    btnTheme.innerHTML = '<i class="fa-solid fa-moon"></i> Modo Oscuro';
                }
                
                btnTheme.addEventListener('click', () => {
                    document.body.classList.toggle('light-theme');
                    const currentlyLight = document.body.classList.contains('light-theme');
                    localStorage.setItem('redsa_light_theme', currentlyLight);
                    btnTheme.innerHTML = currentlyLight 
                        ? '<i class="fa-solid fa-moon"></i> Modo Oscuro' 
                        : '<i class="fa-solid fa-sun"></i> Modo Claro';
                });
            }
        });

        // --- COORDENADAS DEL CURSOR ---
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                const mapInstance = window.geoportalMap;
                if (mapInstance) {
                    mapInstance.on('mousemove', (e) => {
                        if (window.innerWidth <= 768) return;
                        const coordDiv = document.getElementById('cursor-coordinates');
                        if (coordDiv) {
                            coordDiv.style.display = 'block';
                            const latEl = document.getElementById('coord-lat');
                            const lngEl = document.getElementById('coord-lng');
                            if (latEl) latEl.textContent = e.latlng.lat.toFixed(4);
                            if (lngEl) lngEl.textContent = e.latlng.lng.toFixed(4);
                        }
                    });
                    mapInstance.on('mouseout', () => {
                        const coordDiv = document.getElementById('cursor-coordinates');
                        if (coordDiv) coordDiv.style.display = 'none';
                    });
                }
            }, 2000);
        });
