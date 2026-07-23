function onEachProvinceFeature(feature, layer) {
            if (feature.properties) {
                const provincia = feature.properties.DPA_DESPRO || "Desconocido";
                const codProvincia = feature.properties.DPA_PROVIN || "—";
                const cantones = feature.properties.cantones_incluidos || "—";

                const popupContent = `
                    <div class="custom-popup">
                        <h3>${provincia}</h3>
                        <p><strong>Nivel:</strong> Provincia</p>
                        <p><strong>Cantones incluidos:</strong> ${cantones}</p>
                        <div class="dpa-code">Cód. Provincia: ${codProvincia}</div>
                    </div>
                `;
                layer.bindPopup(popupContent, {
                    maxWidth: 300,
                    className: 'custom-leaflet-popup'
                });
                preservePopupForSecondClick(layer);
            }

            layer.on({
                mouseover: highlightProvince,
                mouseout: resetProvinceHighlight,
                click: function(e) {
                    handleTerritoryClick("province", e);
                }
            });
            layer.bindTooltip(() => getTerritoryTooltipContent(layer.feature, "province"), {
                sticky: true,
                direction: "top",
                className: "territory-hover-tooltip"
            });
        }

        function highlightProvince(e) {
            const layer = e.target;
            if (layer !== selectedProvinceLayer) {
                layer.setStyle(getProvinceStyle(layer.feature, true, false));
            }
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                layer.bringToFront();
            }
        }

        function resetProvinceHighlight(e) {
            const layer = e.target;
            if (layer !== selectedProvinceLayer) {
                provinceLayer.resetStyle(layer);
            }
        }

        function onEachParishFeature(feature, layer) {
            if (feature.properties) {
                const parroquia = feature.properties.DPA_DESPAR || "Desconocido";
                const canton = feature.properties.DPA_DESCAN || "Desconocido";
                const provincia = feature.properties.DPA_DESPRO || "Desconocido";
                const codParroquia = feature.properties.DPA_PARROQ || "—";

                const popupContent = `
                    <div class="custom-popup">
                        <h3>${parroquia}</h3>
                        <p><strong>Cantón:</strong> ${canton}</p>
                        <p><strong>Provincia:</strong> ${provincia}</p>
                        <div class="dpa-code">Cód. Parroquia: ${codParroquia}</div>
                    </div>
                `;
                layer.bindPopup(popupContent, {
                    maxWidth: 300,
                    className: 'custom-leaflet-popup'
                });
                preservePopupForSecondClick(layer);
            }

            layer.on({
                mouseover: highlightParish,
                mouseout: resetParishHighlight,
                click: function(e) {
                    handleTerritoryClick("parish", e);
                }
            });
            layer.bindTooltip(() => getTerritoryTooltipContent(layer.feature, "parish"), {
                sticky: true,
                direction: "top",
                className: "territory-hover-tooltip"
            });
        }

        function highlightParish(e) {
            const layer = e.target;
            if (layer !== selectedParishLayer) {
                layer.setStyle(getParishStyle(layer.feature, true, false));
            }
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                layer.bringToFront();
            }
        }

        function resetParishHighlight(e) {
            const layer = e.target;
            if (layer !== selectedParishLayer) {
                parishLayer.resetStyle(layer);
            }
        }

        function getCantonProps(cantonCode) {
            let found = null;
            if (cantonLayer) {
                cantonLayer.eachLayer(layer => {
                    if (layer.feature && layer.feature.properties && layer.feature.properties.DPA_CANTON === cantonCode) {
                        found = layer.feature.properties;
                    }
                });
            }
            return found;
        }

        function isOfficialProvinceCode(code) {
            const value = String(code || "");
            return /^\d{2}$/.test(value) && Number(value) >= 1 && Number(value) <= 24;
        }

        function mergeHotspotsIntoCantons(cantons, hotspots) {
            const hotspotByCanton = new Map();
            (hotspots.features || []).forEach(feature => {
                const props = feature.properties || {};
                if (props.DPA_CANTON) {
                    hotspotByCanton.set(String(props.DPA_CANTON), props.hotspot_gi || null);
                }
            });

            (cantons.features || []).forEach(feature => {
                const props = feature.properties || {};
                const hotspot = hotspotByCanton.get(String(props.DPA_CANTON));
                props.hotspot_gi = hotspot || null;
            });
        }

        function calculateNationalFatalitiesByYear(cantons) {
            const totals = {};
            (cantons.features || []).forEach(feature => {
                const props = feature.properties || {};
                if (!isOfficialProvinceCode(props.DPA_PROVIN)) return;
                const historico = props.fallecidos_historico || {};
                Object.keys(historico).forEach(year => {
                    const value = historico[year];
                    if (Number.isFinite(value)) {
                        totals[year] = (totals[year] || 0) + value;
                    }
                });
            });
            return totals;
        }

        const HOTSPOT_TEXT = {
            caliente: "Concentracion de fallecidos significativamente MAYOR de lo esperado para su poblacion (estadisticamente significativo).",
            frio: "Concentracion de fallecidos significativamente MENOR de lo esperado para su poblacion.",
            no_significativo: "Dentro del rango esperado para su poblacion, sin patron estadistico relevante.",
            isla_sin_vecinos: "No se pudo comparar contra cantones vecinos (aislamiento geografico).",
            sin_dato: "Sin datos suficientes para este ano."
        };

        function getInterpretationYear(props) {
            const hotspotYears = props && props.hotspot_gi ? Object.keys(props.hotspot_gi).sort() : [];
            if (hotspotYears.includes(String(selectedYear))) return String(selectedYear);
            const yearsWithData = hotspotYears.filter(year => {
                const category = props.hotspot_gi[year] && props.hotspot_gi[year].categoria;
                return category && category !== "sin_dato";
            });
            return yearsWithData[yearsWithData.length - 1] || hotspotYears[hotspotYears.length - 1] || "2024";
        }

        function updateInterpretationCard(props) {
            const card = document.getElementById("interpretation-card");
            const badge = document.getElementById("interpretation-badge");
            const text = document.getElementById("interpretation-text");
            const share = document.getElementById("interpretation-share");
            if (!card || !badge || !text || !share) return;

            if (!props || props.nivel_agregacion === "provincia" || props.DPA_PARROQ || !props.hotspot_gi) {
                card.classList.remove("visible");
                badge.textContent = "—";
                badge.className = "interpretation-badge";
                text.textContent = "—";
                share.textContent = "—";
                return;
            }

            const year = getInterpretationYear(props);
            const hotspot = props.hotspot_gi[year] || { categoria: "sin_dato" };
            const category = hotspot.categoria || "sin_dato";
            const categoryText = HOTSPOT_TEXT[category] || HOTSPOT_TEXT.sin_dato;
            const fatalities = props.fallecidos_historico ? props.fallecidos_historico[year] : null;
            const nationalTotal = nationalFatalitiesByYear[year];

            card.classList.add("visible");
            badge.className = `interpretation-badge ${category}`;
            badge.textContent = `${category.replaceAll("_", " ")} ${year}`;
            text.textContent = categoryText;

            if (Number.isFinite(fatalities) && Number.isFinite(nationalTotal) && nationalTotal > 0) {
                const pct = (fatalities / nationalTotal) * 100;
                share.textContent = `${fatalities.toLocaleString('de-DE')} fallecidos = ${pct.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% del total nacional de ese ano`;
            } else {
                share.textContent = `Sin dato de fallecidos para calcular proporcion nacional de ${year}.`;
            }
        }

        // --- LÓGICA DE ACTUALIZACIÓN DE LEYENDA ---
        function updateLegend() {
            const container = document.getElementById("legend-items");
            const panel = document.querySelector(".legend-panel");
            if (!container || !panel) return;

            container.innerHTML = "";
            let hasItems = false;

            // 1. Límites territoriales automáticos o coropletas por nivel
            const currentLevel = activeTerritoryLevel || getTerritoryLevelForZoom();
            const effectiveVariable = getEffectiveVariable(currentLevel);
            if (currentLevel) {
                hasItems = true;
                const requestedConfig = VARIABLE_CONFIGS[selectedVariable] || VARIABLE_CONFIGS.normal;
                const unavailableAtLevel = selectedVariable !== "normal" && effectiveVariable === "normal";
                const noValuesAtLevel = !unavailableAtLevel
                    && effectiveVariable !== "normal"
                    && activeVariableBins.method === "Sin datos";

                if (unavailableAtLevel || noValuesAtLevel) {
                    const levelName = LEVEL_LABELS[currentLevel] || "territorio seleccionado";
                    const temporalLabel = requestedConfig.temporal?.tipo === "anual" ? ` · ${getActivePeriodLabel(requestedConfig)}` : "";
                    container.innerHTML += `
                        <div class="legend-item" style="font-weight: 600; margin-bottom: 2px; color: var(--text-primary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">${requestedConfig.label} (Nivel: ${levelName})${temporalLabel}:</div>
                        <div class="legend-unavailable" role="status">
                            <strong>Sin datos disponibles en este nivel territorial.</strong>
                            <span>${unavailableAtLevel ? "La variable seleccionada no se publica para este nivel; se muestran únicamente los límites administrativos." : "No existen valores publicables para la combinación de nivel y periodo seleccionada."}</span>
                        </div>
                        <div class="legend-item" style="padding-left: 8px;">
                            <span class="legend-color-line" style="background-color: ${COLOR_BOUNDARY}; height: 8px; width: 12px; border-radius: 2px;"></span>
                            <span>Límites administrativos</span>
                        </div>
                    `;
                } else if (effectiveVariable === 'normal') {
                    const levelTitle = `Límites ${LEVEL_LABELS[currentLevel]}:`;
                    container.innerHTML += `
                        <div class="legend-item" style="font-weight: 600; margin-bottom: 2px; color: var(--text-primary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">${levelTitle}</div>
                        <div class="legend-item" style="padding-left: 8px;">
                            <span class="legend-color-line" style="background-color: ${COLOR_BOUNDARY}; height: 8px; width: 12px; border-radius: 2px;"></span>
                            <span>Limites administrativos</span>
                        </div>
                    `;
                } else {
                    const config = VARIABLE_CONFIGS[effectiveVariable];
                    const temporalLabel = config.temporal?.tipo === "anual" ? ` · ${getActivePeriodLabel(config)}` : "";
                    
                    let classificationInfo = "";
                    if (activeVariableBins.method && activeVariableBins.method !== "Sin datos") {
                        const gvfText = activeVariableBins.gvf !== undefined ? ` Ajuste estadístico GVF: ${activeVariableBins.gvf.toFixed(2)} sobre los datos disponibles para este nivel y año.` : "";
                        const scaleText = activeVariableBins.logScaled
                            ? " Se aplicó una escala logarítmica para representar mejor valores muy concentrados; los rangos visibles se mantienen en sus unidades originales."
                            : "";
                        classificationInfo = ` ${siglaInfoIcon('INFO', `Clasificación: ${activeVariableBins.method}.${gvfText}${scaleText}`)}`;
                    }

                    const levelContext = config.legendLevelLabel
                        ? ` (${config.legendLevelLabel})`
                        : (LEVEL_LABELS[currentLevel] ? ` (Nivel: ${LEVEL_LABELS[currentLevel].charAt(0).toUpperCase() + LEVEL_LABELS[currentLevel].slice(1)})` : "");
                    const title = `${config.label}${levelContext}${temporalLabel}${config.infoSigla ? ` ${siglaInfoIcon(config.infoSigla)}` : ""}${classificationInfo}:`;
                    const bins = getVariableBins(effectiveVariable, currentLevel);
                    const displayBins = activeVariableBins.displayBins || bins;
                    const colors = activeVariableBins.colors && activeVariableBins.colors.length > 0 ? activeVariableBins.colors : config.colors;
                    const formatFunc = config.format || (v => v.toString());
                    let itemsHtml = `
                        <div class="legend-item" style="font-weight: 600; margin-bottom: 2px; color: var(--text-primary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">${title}</div>
                    `;

                    for (let i = 0; bins.length && i <= bins.length; i++) {
                        let label = "";
                        if (i === 0) {
                            label = `<= ${formatFunc(displayBins[0])}`;
                        } else if (i === bins.length) {
                            label = `> ${formatFunc(displayBins[displayBins.length - 1])}`;
                        } else {
                            label = config.continuous
                                ? `${formatFunc(displayBins[i - 1])} a ${formatFunc(displayBins[i])}`
                                : `${formatFunc(displayBins[i - 1] + 1)} a ${formatFunc(displayBins[i])}`;
                        }
                        itemsHtml += `
                            <div class="legend-item" style="padding-left: 8px;">
                                <span class="legend-color-line" style="background-color: ${colors[i]}; height: 10px; width: 14px; border-radius: 2px; opacity: 0.75; border: 1px solid rgba(255,255,255,0.15)"></span>
                                <span>${label}</span>
                            </div>
                        `;
                    }

                    if (config.zeroAsNoMapping) {
                        itemsHtml += `
                            <div class="legend-item" style="padding-left: 8px;">
                                <span class="legend-color-line" style="background-color: #475569; border: 1px dashed #94a3b8; height: 10px; width: 14px; border-radius: 2px;"></span>
                                <span style="color: var(--text-muted)">Sin elementos mapeados en OSM; no implica ausencia</span>
                            </div>
                        `;
                    }
                    if (!config.omitNoDataLegend) {
                        itemsHtml += `
                            <div class="legend-item" style="padding-left: 8px; margin-bottom: 6px;">
                                <span class="legend-color-line" style="background-color: #1e293b; border: 1px dashed #475569; height: 10px; width: 14px; border-radius: 2px;"></span>
                                <span style="color: var(--text-muted)">Sin dato oficial</span>
                            </div>
                        `;
                    }
                    container.innerHTML += itemsHtml;
                }
            }

            let hasActiveOsmLayer = false;
            INFRASTRUCTURE_LAYER_CONFIGS.forEach(config => {
                const layer = overlayMaps[config.label];
                if (!layer || !map.hasLayer(layer)) return;
                hasItems = true;
                hasActiveOsmLayer = hasActiveOsmLayer || Boolean(config.osmAudit);
                const legendItems = (config.legend || []).map(item => {
                    const shapeClass = item.shape === "circle" ? "legend-color-circle" : "legend-color-line";
                    return `
                        <div class="legend-item" style="padding-left:8px;">
                            <span class="${shapeClass}" style="background-color:${item.color};"></span>
                            <span>${item.label}</span>
                        </div>`;
                }).join("");
                container.innerHTML += `
                    <div class="legend-item" style="font-weight:600;margin-top:4px;color:var(--text-primary);font-size:.75rem;text-transform:uppercase;">${config.label}</div>
                    ${legendItems}`;
            });

            if (hasActiveOsmLayer) {
                container.innerHTML += `
                    <div class="legend-item" style="margin-top:4px;padding-top:6px;border-top:1px dashed rgba(251,191,36,.25);color:#fbbf24;font-size:.67rem;line-height:1.3;align-items:flex-start;">
                        <span class="legend-color-line" style="flex:0 0 auto;background-color:rgba(148,163,184,.18);border:1px dashed #94a3b8;height:10px;width:14px;border-radius:2px;margin-top:2px;"></span>
                        <span>Cobertura OSM desigual: el tramado indica "sin elementos mapeados", no que la infraestructura no exista.</span>
                    </div>`;
            }
            panel.style.display = hasItems ? "block" : "none";
            updateProfileCardLayout();
        }

        // Registrar listeners para actualización de leyenda
        map.on('overlayadd', updateLegend);
        map.on('overlayremove', updateLegend);

        function updateMapLevelNote(level = activeTerritoryLevel) {
            const note = document.getElementById("map-level-note");
            if (!note || !level) return;
            const requestedConfig = VARIABLE_CONFIGS[selectedVariable] || VARIABLE_CONFIGS.normal;
            const effectiveVariable = getEffectiveVariable(level);
            const coverage = TEMPORAL_COVERAGE[selectedVariable];
            if (selectedVariable !== "normal" && effectiveVariable === "normal") {
                note.textContent = `"${requestedConfig.label}" no está disponible en ${LEVEL_LABELS[level]}; se muestran solo límites.`;
                note.style.display = "block";
            } else if (selectedPeriodMode !== "accumulated" && coverage?.tipo === "anual" && !coverage.anios_disponibles.includes(selectedYear)) {
                note.textContent = `Sin cobertura de "${requestedConfig.label}" en ${selectedYear}; se muestra sin dato, sin sustituir otro año.`;
                note.style.display = "block";
            } else {
                note.textContent = "";
                note.style.display = "none";
            }
        }

        function updateTerritoryLevelControl() {
            const control = document.getElementById("territory-level-control");
            const status = document.getElementById("territory-level-status");
            if (!control) return;
            control.querySelectorAll("[data-level-mode]").forEach(button => {
                const isActive = button.dataset.levelMode === territoryLevelMode;
                button.classList.toggle("active", isActive);
                button.setAttribute("aria-pressed", String(isActive));
            });
            if (status) {
                const modeText = territoryLevelMode === "auto" ? "automático" : "fijado manualmente";
                status.textContent = `Nivel visible: ${LEVEL_LABELS[activeTerritoryLevel] || "cargando"} · ${modeText}`;
            }
        }

        function getLayerForLevel(level) {
            if (level === "province") return provinceLayer;
            if (level === "canton") return cantonLayer;
            if (level === "parish") return parishLayer;
            return null;
        }

        function removeLayerIfPresent(layer) {
            if (layer && map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        }

        function refreshTerritoryLayerStyles(level = activeTerritoryLevel) {
            const layerGroup = getLayerForLevel(level);
            if (!layerGroup) return;
            layerGroup.eachLayer(layer => {
                layerGroup.resetStyle(layer);
            });
        }

        function activateTerritoryLevel(level) {
            const targetLayer = getLayerForLevel(level);
            if (!targetLayer) return;

            if (activeTerritoryLevel === level && map.hasLayer(targetLayer)) {
                updateTerritoryLevelControl();
                return;
            }

            removeLayerIfPresent(provinceLayer);
            removeLayerIfPresent(cantonLayer);
            removeLayerIfPresent(parishLayer);

            activeTerritoryLevel = level;
            window.__redsaActiveTerritoryLevel = level;
            recalculateActiveVariableBins(selectedVariable, level);
            targetLayer.addTo(map);

            domParroquiaRow.style.display = level === "parish" ? "flex" : "none";
            domFallecidosParroquiaRow.style.display = level === "parish" ? "flex" : "none";

            refreshTerritoryLayerStyles();
            updateMapLevelNote(level);
            updateLegend();
            updateTerritoryLevelControl();
            if (selectedTerritory?.props) updateSidebar(selectedTerritory.props);
            window.REDSAExperience?.updateMapContext(
                VARIABLE_CONFIGS[selectedVariable] || VARIABLE_CONFIGS.normal,
                selectedYear,
                LEVEL_LABELS[level]
            );
        }

        function ensureParishLayer() {
            if (parishLayer) return Promise.resolve(parishLayer);
            if (parishLoadPromise) return parishLoadPromise;

            const loader = document.getElementById("loader");
            if (loader) {
                document.getElementById("loader-status").textContent = "Descargando límites parroquiales (5.46 MB)...";
                loader.style.display = "flex";
            }
            const parishStart = performance.now();

            parishLoadPromise = fetch(RUTA_PARROQUIAS_RELATIVA)
                .then(response => {
                    if (!response.ok) throw new Error("No se pudo cargar el geojson parroquial.");
                    const tDownloadEnd = performance.now();
                    const tDownload = ((tDownloadEnd - parishStart) / 1000).toFixed(2);
                    document.getElementById("diag-download").textContent = `${tDownload}s`;
                    document.getElementById("loader-status").textContent = "Renderizando 1,040 parroquias...";
                    return response.json();
                })
                .then(data => {
                    const tRenderStart = performance.now();
                    parishData = data;
                    recalculateActiveVariableBins(selectedVariable, "parish");
                    parishLayer = L.geoJSON(parishData, {
                        pane: "territorioPane",
                        style: function(feature) {
                            const isSelected = selectedParishLayer && selectedParishLayer.feature.properties.DPA_PARROQ === feature.properties.DPA_PARROQ;
                            return getParishStyle(feature, false, isSelected);
                        },
                        onEachFeature: onEachParishFeature
                    });

                    const tRenderEnd = performance.now();
                    const tRender = ((tRenderEnd - tRenderStart) / 1000).toFixed(2);
                    const tTotal = ((tRenderEnd - parishStart) / 1000).toFixed(2);
                    document.getElementById("diag-render").textContent = `${tRender}s`;
                    document.getElementById("diag-total").textContent = `${tTotal}s`;
                    document.getElementById("diag-features").textContent = data.features ? data.features.length : 0;
                    if (loader) loader.style.display = "none";
                    return parishLayer;
                })
                .catch(err => {
                    parishLoadPromise = null;
                    console.error(err);
                    document.getElementById("loader-status").textContent = "Error al cargar parroquias: " + err.message;
                    setTimeout(() => { if (loader) loader.style.display = "none"; }, 3000);
                    throw err;
                });

            return parishLoadPromise;
        }

        function syncTerritoryLayerToZoom() {
            const desiredLevel = territoryLevelMode === "auto"
                ? getTerritoryLevelForZoom()
                : territoryLevelMode;
            if (desiredLevel === "parish" && !parishLayer) {
                ensureParishLayer()
                    .then(() => {
                        const stillDesired = territoryLevelMode === "auto"
                            ? getTerritoryLevelForZoom() === "parish"
                            : territoryLevelMode === "parish";
                        if (stillDesired) {
                            activateTerritoryLevel("parish");
                        } else {
                            syncTerritoryLayerToZoom();
                        }
                    })
                    .catch(err => console.error("No se pudo sincronizar capa parroquial:", err));
                return;
            }
            activateTerritoryLevel(desiredLevel);
        }

        function setTerritoryLevelMode(mode) {
            const validModes = ["auto", "province", "canton", "parish"];
            if (!validModes.includes(mode)) return false;
            territoryLevelMode = mode;
            syncTerritoryLayerToZoom();
            updateTerritoryLevelControl();
            return true;
        }
