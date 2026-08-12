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
            (cantons.features || []).forEach(feature => {
                const props = feature.properties || {};
                const hotspot = hotspots?.por_dpa?.[String(props.DPA_CANTON)] || null;
                props.hotspot_gi = hotspot?.hotspot_gi || null;
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

        function getNationalMetadataValue(config, year) {
            const metadataConfig = config?.nationalMetadata;
            if (!metadataConfig || !provinceData?.metadata) return null;
            const collection = provinceData.metadata[metadataConfig.collection];
            const yearRecord = collection?.[metadataConfig.yearsField]?.[String(year)];
            const value = yearRecord?.[metadataConfig.valueField];
            return value === null || value === undefined || !Number.isFinite(Number(value))
                ? null
                : Number(value);
        }

        function getOfficialProvinceFeatures() {
            return (provinceData?.features || []).filter(feature =>
                isOfficialProvinceCode(feature?.properties?.DPA_PROVIN)
            );
        }

        function calculateNationalVariableSummary(variable, year = selectedYear, periodMode = selectedPeriodMode) {
            const config = VARIABLE_CONFIGS[variable];
            const officialFeatures = getOfficialProvinceFeatures();
            if (!config || variable === "normal" || officialFeatures.length !== 24) return null;

            if (config.aggregation === "sum") {
                const years = periodMode === "accumulated" && supportsHistoricalAccumulation(config)
                    ? getAccumulationYears(config)
                    : [Number(year)];
                let nationalTotal = 0;

                for (const coveredYear of years) {
                    const metadataValue = getNationalMetadataValue(config, coveredYear);
                    if (metadataValue !== null) {
                        nationalTotal += metadataValue;
                        continue;
                    }
                    const values = officialFeatures.map(feature =>
                        getVariableValueForPeriod(feature.properties, variable, coveredYear, "year")
                    );
                    if (values.some(value => value === null || value === undefined || !Number.isFinite(Number(value)))) {
                        return null;
                    }
                    nationalTotal += values.reduce((sum, value) => sum + Number(value), 0);
                }

                return {
                    value: nationalTotal,
                    method: "sum",
                    contributingTerritories: officialFeatures.length
                };
            }

            const ratio = config.nationalAggregation;
            if (!ratio?.numerator || !ratio?.denominator || !Number.isFinite(Number(ratio.scale))) return null;
            let numerator = 0;
            let denominator = 0;
            for (const feature of officialFeatures) {
                const props = feature.properties || {};
                const numeratorValue = ratio.numerator(props, year);
                const denominatorValue = ratio.denominator(props, year);
                if (
                    numeratorValue === null || numeratorValue === undefined
                    || denominatorValue === null || denominatorValue === undefined
                    || !Number.isFinite(Number(numeratorValue))
                    || !Number.isFinite(Number(denominatorValue))
                    || Number(denominatorValue) <= 0
                ) {
                    return null;
                }
                numerator += Number(numeratorValue);
                denominator += Number(denominatorValue);
            }
            if (denominator <= 0) return null;
            return {
                value: numerator / denominator * Number(ratio.scale),
                method: "ratio",
                numerator,
                denominator,
                contributingTerritories: officialFeatures.length
            };
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

        const LEGEND_ORDINAL_GAP_PERCENT = 0.8;

        function getLegendPeriodLabel(config) {
            const activePeriod = getActivePeriodLabel(config);
            if (activePeriod) return activePeriod;
            const years = config?.temporal?.anios_disponibles || [];
            if (years.length === 1) return String(years[0]);
            return years.length > 1 ? formatCoveredYears(years) : "";
        }

        function renderLegendHeading(title, metadataParts = [], technicalInfo = "") {
            const metadata = metadataParts
                .filter(Boolean)
                .map(part => String(part).trim().replace(/[.]+$/, ""))
                .join(". ");
            const secondaryLine = metadata || technicalInfo
                ? `<div class="legend-heading-meta">${metadata ? `<span>${metadata}.</span>` : ""}${technicalInfo ? `<span class="legend-heading-technical">${technicalInfo}</span>` : ""}</div>`
                : "";
            return `
                <div class="legend-heading">
                    <div class="legend-heading-title">${title}</div>
                    ${secondaryLine}
                </div>
            `;
        }

        function getLegendBinLabels(bins, displayBins, config, formatFunc) {
            return Array.from({ length: bins.length + 1 }, (_, index) => {
                if (index === 0) {
                    return config.zeroIsData && Number(displayBins[0]) === 0
                        ? "0"
                        : `≤ ${formatFunc(displayBins[0])}`;
                }
                if (index === bins.length) {
                    return `> ${formatFunc(displayBins[displayBins.length - 1])}`;
                }
                return config.continuous
                    ? `${formatFunc(displayBins[index - 1])} a ${formatFunc(displayBins[index])}`
                    : `${formatFunc(displayBins[index - 1] + 1)} a ${formatFunc(displayBins[index])}`;
            });
        }

        function renderOrdinalLegendScale(colors, labels) {
            const categoryWidth = 100 / colors.length;
            const stops = colors.flatMap((color, index) => {
                const start = index * categoryWidth;
                const end = (index + 1) * categoryWidth;
                const inset = LEGEND_ORDINAL_GAP_PERCENT / 2;
                return [
                    `transparent ${start}%`,
                    `transparent ${start + inset}%`,
                    `${color} ${start + inset}%`,
                    `${color} ${end - inset}%`,
                    `transparent ${end - inset}%`,
                    `transparent ${end}%`
                ];
            }).join(", ");
            const accessibleScale = labels.map((label, index) => `${label}: ${colors[index]}`).join("; ");
            return `
                <div class="legend-ordinal-scale" role="img" aria-label="Escala de colores por rangos: ${accessibleScale}">
                    <span class="legend-ordinal-bar" style="background:linear-gradient(90deg, ${stops});"></span>
                    <span class="legend-ordinal-labels" style="--legend-bin-count:${labels.length}">
                        ${labels.map(label => `<span title="${label}">${label}</span>`).join("")}
                    </span>
                </div>
            `;
        }

        function activeLayerSymbol(item, fallbackColors = []) {
            const colors = item?.colors?.length ? item.colors : fallbackColors;
            const background = item?.shape === "gradient" || colors.length > 1
                ? `linear-gradient(90deg, ${colors.join(", ")})`
                : (item?.color || colors[0] || COLOR_BOUNDARY);
            const circleClass = item?.shape === "circle" ? " is-circle" : "";
            return `<span class="legend-active-layer-symbol${circleClass}" style="background:${background}"></span>`;
        }

        function renderActiveLayersCard(currentLevel, effectiveVariable, overlayEntries) {
            const component = document.getElementById("map-legend-card");
            const section = document.getElementById("legend-active-layers-section");
            const list = document.getElementById("legend-active-layers-list");
            const count = document.getElementById("legend-active-layers-count");
            if (!component || !section || !list || !count) return;

            const activeLayers = [];
            if (selectedVariable !== "normal") {
                const config = VARIABLE_CONFIGS[selectedVariable];
                const colors = activeVariableBins.colors?.length
                    ? activeVariableBins.colors
                    : (config?.colors || []);
                const levelLabel = LEVEL_LABELS[currentLevel] || "territorio";
                const unavailable = effectiveVariable === "normal";
                activeLayers.push({
                    title: config?.displayLabel || config?.label || "Variable territorial",
                    subtitle: unavailable ? `No disponible en ${levelLabel}` : `Variable territorial · ${levelLabel}`,
                    symbol: activeLayerSymbol({ shape: "gradient", colors }),
                    info: config?.infoSigla ? siglaInfoIcon(config.infoSigla) : siglaInfoIcon("Información", config?.description || "Variable territorial activa.")
                });
            }

            overlayEntries.forEach(entry => {
                const firstItem = entry.items?.[0] || {};
                const info = entry.id === "siniestros_ant"
                    ? siglaInfoIcon("ANT_SINIESTROS")
                    : siglaInfoIcon(
                        "Información",
                        entry.infoText || `${entry.title}: capa activa en el mapa.`
                    );
                activeLayers.push({
                    title: entry.title,
                    subtitle: entry.subtitle || firstItem.label || "Capa de infraestructura vial",
                    symbol: activeLayerSymbol(firstItem),
                    info
                });
            });

            const layersShortcut = document.getElementById("active-layers-shortcut");
            if (layersShortcut) {
                const hasExtraLayers = activeLayers.length > 1;
                layersShortcut.classList.toggle("has-extra-layers", hasExtraLayers);
                layersShortcut.dataset.activeLayerCount = String(activeLayers.length);
                layersShortcut.setAttribute(
                    "aria-label",
                    hasExtraLayers
                        ? `Abrir Datos y capas; ${activeLayers.length} capas activas`
                        : "Abrir Datos y capas"
                );
            }

            list.innerHTML = activeLayers.map(layer => `
                <div class="legend-active-layer-row" role="listitem">
                    ${layer.symbol}
                    <span class="legend-active-layer-name">${layer.title}<small>${layer.subtitle}</small></span>
                    ${layer.info}
                </div>
            `).join("");
            count.textContent = `${activeLayers.length} ${activeLayers.length === 1 ? "capa" : "capas"}`;
            count.hidden = activeLayers.length === 0;
            component.dataset.layerCount = String(activeLayers.length);
            section.hidden = activeLayers.length === 0;
        }

        // --- LÓGICA DE ACTUALIZACIÓN DE LEYENDA ---
        function updateLegend() {
            const container = document.getElementById("legend-items");
            const territoryContainer = document.getElementById("legend-territory-items") || container;
            const overlayContainer = document.getElementById("legend-overlay-items") || container;
            const overlayNotesContainer = document.getElementById("legend-overlay-notes") || overlayContainer;
            const panel = document.querySelector(".legend-panel");
            if (!container || !panel) return;

            territoryContainer.innerHTML = "";
            if (overlayContainer !== territoryContainer) overlayContainer.innerHTML = "";
            if (overlayNotesContainer !== overlayContainer) overlayNotesContainer.innerHTML = "";
            let hasItems = false;

            // 1. Límites territoriales automáticos o coropletas por nivel
            const currentLevel = activeTerritoryLevel || getTerritoryLevelForZoom();
            const effectiveVariable = getEffectiveVariable(currentLevel);
            if (currentLevel) {
                hasItems = true;
                const requestedConfig = VARIABLE_CONFIGS[selectedVariable] || VARIABLE_CONFIGS.normal;
                const unavailableAtLevel = selectedVariable !== "normal" && effectiveVariable === "normal";
                const yearUnavailable = selectedVariable !== "normal"
                    && selectedPeriodMode !== "accumulated"
                    && requestedConfig.temporal?.tipo === "anual"
                    && !requestedConfig.temporal.anios_disponibles.map(Number).includes(Number(selectedYear));
                const noValuesAtLevel = !unavailableAtLevel
                    && effectiveVariable !== "normal"
                    && activeVariableBins.method === "Sin datos";
                const territoryOpacityControl = document.getElementById("territory-opacity-control");
                const territoryOpacityLabel = document.getElementById("territory-opacity-label");
                const hasTerritorialSurface = effectiveVariable !== "normal" && !unavailableAtLevel && !noValuesAtLevel;
                if (territoryOpacityControl) territoryOpacityControl.hidden = !hasTerritorialSurface;
                if (territoryOpacityLabel && hasTerritorialSurface) {
                    territoryOpacityLabel.textContent = "Intensidad";
                    document.getElementById("territory-opacity-slider")?.setAttribute(
                        "aria-label",
                        `Intensidad del color de ${requestedConfig.displayLabel || requestedConfig.label} en el mapa`
                    );
                }

                if (unavailableAtLevel || noValuesAtLevel || yearUnavailable) {
                    const levelName = LEVEL_LABELS[currentLevel] || "territorio seleccionado";
                    const technicalInfo = requestedConfig.infoSigla ? siglaInfoIcon(requestedConfig.infoSigla) : "";
                    territoryContainer.innerHTML += `
                        ${renderLegendHeading(
                            requestedConfig.displayLabel || requestedConfig.label,
                            [
                                requestedConfig.fuente ? `Fuente: ${requestedConfig.fuente}` : "",
                                `Nivel: ${levelName}`,
                                getLegendPeriodLabel(requestedConfig) ? `Periodo: ${getLegendPeriodLabel(requestedConfig)}` : ""
                            ],
                            technicalInfo
                        )}
                        <div class="legend-unavailable ${yearUnavailable ? "legend-period-unavailable" : ""}" role="status">
                            <strong>${yearUnavailable ? "No disponible para este periodo." : "Sin datos disponibles en este nivel territorial."}</strong>
                            <span>${yearUnavailable
                                ? `Esta variable tiene datos en ${formatCoveredYears(requestedConfig.temporal.anios_disponibles)}; se muestran únicamente los límites administrativos.`
                                : unavailableAtLevel
                                    ? "La variable seleccionada no se publica para este nivel; se muestran únicamente los límites administrativos."
                                    : "No existen valores publicables para la combinación de nivel y periodo seleccionada."}</span>
                        </div>
                        <div class="legend-item" style="padding-left: 8px;">
                            <span class="legend-color-line" style="background-color: ${COLOR_BOUNDARY}; height: 8px; width: 12px; border-radius: 2px;"></span>
                            <span>Límites administrativos</span>
                        </div>
                    `;
                } else if (effectiveVariable === 'normal') {
                    const levelTitle = "Sin variable seleccionada";
                    territoryContainer.innerHTML += `
                        ${renderLegendHeading(levelTitle, [
                            "Vista: límites administrativos",
                            `Nivel: ${LEVEL_LABELS[currentLevel]}`,
                        ])}
                        <div class="legend-item" style="padding-left: 8px;">
                            <span class="legend-color-line" style="background-color: ${COLOR_BOUNDARY}; height: 8px; width: 12px; border-radius: 2px;"></span>
                            <span>Límites administrativos</span>
                        </div>
                    `;
                } else {
                    const config = VARIABLE_CONFIGS[effectiveVariable];
                    
                    let classificationInfo = "";
                    if (activeVariableBins.method && activeVariableBins.method !== "Sin datos") {
                        const gvfText = activeVariableBins.gvf !== undefined ? ` Ajuste estadístico GVF: ${activeVariableBins.gvf.toFixed(2)} sobre los datos disponibles para este nivel y año.` : "";
                        const scaleText = activeVariableBins.logScaled
                            ? " Se aplicó una escala logarítmica para representar mejor valores muy concentrados; los rangos visibles se mantienen en sus unidades originales."
                            : "";
                        classificationInfo = ` ${siglaInfoIcon('INFO', `Clasificación: ${activeVariableBins.method}.${gvfText}${scaleText}`)}`;
                    }

                    const technicalInfo = `${config.infoSigla ? siglaInfoIcon(config.infoSigla) : ""}${classificationInfo}`;
                    const bins = getVariableBins(effectiveVariable, currentLevel);
                    const displayBins = activeVariableBins.displayBins || bins;
                    const colors = activeVariableBins.colors && activeVariableBins.colors.length > 0 ? activeVariableBins.colors : config.colors;
                    const formatFunc = config.format || (v => v.toString());
                    let itemsHtml = `
                        ${renderLegendHeading(
                            config.displayLabel || config.label,
                            [
                                config.fuente ? `Fuente: ${config.fuente}` : "",
                                LEVEL_LABELS[currentLevel] ? `Nivel: ${LEVEL_LABELS[currentLevel]}` : "",
                                getLegendPeriodLabel(config) ? `Periodo: ${getLegendPeriodLabel(config)}` : ""
                            ],
                            technicalInfo
                        )}
                    `;

                    const binLabels = getLegendBinLabels(bins, displayBins, config, formatFunc);
                    if (bins.length && colors.length) {
                        itemsHtml += renderOrdinalLegendScale(colors.slice(0, binLabels.length), binLabels);
                    }

                    if (config.zeroAsNoMapping) {
                        itemsHtml += `
                            <div class="legend-item legend-special-swatch">
                                <span class="legend-color-line" style="background-color: #475569; border: 1px dashed #94a3b8;"></span>
                                <span>Sin elementos mapeados en OSM; no implica ausencia</span>
                            </div>
                        `;
                    }
                    if (!config.omitNoDataLegend) {
                        itemsHtml += `
                            <div class="legend-item legend-special-swatch">
                                <span class="legend-color-line" style="background-color: #1e293b; border: 1px dashed #475569;"></span>
                                <span>Sin dato oficial</span>
                            </div>
                        `;
                    }
                    if (effectiveVariable === "siniestros_inec_2019" && selectedPeriodMode !== "accumulated") {
                        const activeDataset = currentLevel === "province"
                            ? provinceData
                            : (currentLevel === "canton" ? cantonData : parishData);
                        const yearAudit = activeDataset?.metadata?.siniestros_transito_territorial?.anios?.[String(selectedYear)];
                        if (yearAudit) {
                            const total = Number(yearAudit.total_nacional || 0).toLocaleString("es-EC");
                            const mapped = Number(yearAudit.suma_publicada_en_este_nivel || 0).toLocaleString("es-EC");
                            const special = Number(yearAudit.no_representados_en_este_nivel ?? yearAudit.zona_especial_sin_asignar ?? 0).toLocaleString("es-EC");
                            const partial = String(yearAudit.estado || "").includes("parcial")
                                ? "<strong>Corte parcial enero-junio:</strong> no comparar con años completos."
                                : "";
                            itemsHtml += `
                                <div class="legend-data-audit legend-territory-audit" role="note">
                                    <span class="legend-audit-value"><small>Total nacional</small><strong>${total}</strong></span>
                                    <span class="legend-audit-note">${mapped} registros se representan en este nivel; ${special} corresponden a zonas en estudio y se conservan en el total sin asignación especulativa.${partial ? `<span>${partial}</span>` : ""}</span>
                                </div>
                            `;
                        }
                    }
                    territoryContainer.innerHTML += itemsHtml;
                }
            }

            let hasActiveOsmLayer = false;
            const overlayLegendEntries = window.REDSAOverlayState?.getLegendEntries?.() || [];
            renderActiveLayersCard(currentLevel, effectiveVariable, overlayLegendEntries);
            overlayLegendEntries.forEach(entry => {
                hasItems = true;
                hasActiveOsmLayer = hasActiveOsmLayer || Boolean(entry.osmAudit);
                const legendItems = (entry.items || []).map(item => {
                    if (item.shape === "gradient") {
                        return `
                            <div class="legend-item legend-gradient-item">
                                <span class="legend-gradient" style="background:linear-gradient(90deg, ${(item.colors || []).join(",")});"></span>
                                <span>${item.label}</span>
                            </div>`;
                    }
                    const shapeClass = item.shape === "circle" ? "legend-color-circle" : "legend-color-line";
                    return `
                        <div class="legend-item" style="padding-left:8px;">
                            <span class="${shapeClass}" style="background-color:${item.color};"></span>
                            <span>${item.label}</span>
                        </div>`;
                }).join("");
                const audit = entry.audit
                    ? `<div class="legend-data-audit">
                        <strong>${Number(entry.audit.published).toLocaleString("es-EC")} de ${Number(entry.audit.total).toLocaleString("es-EC")} puntos publicados</strong>
                        <span>Sin ubicación: ${Number(entry.audit.noLocation || 0).toLocaleString("es-EC")} · Ubicación no verificable: ${Number(entry.audit.unverifiableLocation || 0).toLocaleString("es-EC")}${Number(entry.audit.invalidDate || 0) ? ` · Fecha no publicable: ${Number(entry.audit.invalidDate).toLocaleString("es-EC")}` : ""}</span>
                    </div>`
                    : "";
                const notes = (entry.notes || []).map(note => `<span>${note}</span>`).join("");
                const noteBlock = notes ? `<div class="legend-overlay-notes" role="note">${notes}</div>` : "";
                const loading = entry.status === "loading"
                    ? `<div class="legend-overlay-status" role="status">Preparando la capa…</div>`
                    : "";
                const unavailable = entry.available === false || entry.status === "unavailable"
                    ? `<div class="legend-unavailable legend-period-unavailable" role="status"><strong>No disponible para este periodo.</strong><span>Elige un año con datos para volver a mostrar esta capa.</span></div>`
                    : "";
                const info = entry.infoText ? siglaInfoIcon("Información", entry.infoText) : "";
                overlayContainer.innerHTML += `
                    <section class="legend-overlay-block ${unavailable ? "legend-layer-unavailable" : ""}" data-legend-layer-id="${entry.id}">
                        <div class="legend-item legend-overlay-title">${entry.title}${info}</div>
                        ${entry.subtitle ? `<div class="legend-overlay-subtitle">${entry.subtitle}</div>` : ""}
                        ${legendItems}${audit}${loading}${unavailable}${noteBlock}
                    </section>`;
            });

            if (hasActiveOsmLayer) {
                overlayNotesContainer.innerHTML += `
                    <div class="legend-item" style="margin-top:4px;padding-top:6px;border-top:1px dashed rgba(251,191,36,.25);color:#fbbf24;font-size:.67rem;line-height:1.3;align-items:flex-start;">
                        <span class="legend-color-line" style="flex:0 0 auto;background-color:rgba(148,163,184,.18);border:1px dashed #94a3b8;height:10px;width:14px;border-radius:2px;margin-top:2px;"></span>
                        <span>Cobertura OSM desigual: el tramado indica "sin elementos mapeados", no que la infraestructura no exista.</span>
                    </div>`;
            }
            if (typeof syncMobileLayerDrawer === "function") syncMobileLayerDrawer();
            if (typeof syncTerritorySurfaceAutoHideNote === "function") {
                syncTerritorySurfaceAutoHideNote(currentLevel);
            }
            panel.style.display = hasItems ? "block" : "none";
            const mapLegendCard = document.getElementById("map-legend-card");
            if (mapLegendCard) {
                mapLegendCard.dataset.hasLegend = String(selectedVariable !== "normal" || overlayLegendEntries.length > 0);
            }
            window.syncLegendCardPresentation?.();
        }

        // Registrar listeners para actualización de leyenda
        map.on('overlayadd', updateLegend);
        map.on('overlayremove', updateLegend);
        window.REDSAOverlayState?.subscribe(updateLegend);

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
                const latestYear = Math.max(...coverage.anios_disponibles.map(Number).filter(Number.isFinite));
                note.innerHTML = `
                    <span>Sin datos de "${requestedConfig.label}" en ${selectedYear}. Esta variable llega hasta ${latestYear}.</span>
                    <button type="button" class="map-level-note-action" data-jump-latest-year="${latestYear}" aria-label="Mostrar ${latestYear}, último año disponible para ${requestedConfig.label}">Ver ${latestYear}</button>
                `;
                note.style.display = "block";
            } else {
                note.replaceChildren();
                note.style.display = "none";
            }
        }

        document.addEventListener("click", event => {
            const jumpButton = event.target.closest("[data-jump-latest-year]");
            if (!jumpButton) return;
            const targetYear = Number(jumpButton.dataset.jumpLatestYear);
            if (Number.isFinite(targetYear)) setSelectedYearAndRefresh(targetYear);
        });

        function updateTerritoryLevelControl() {
            const status = document.getElementById("territory-level-status");
            document.querySelectorAll("[data-level-mode]").forEach(button => {
                const isActive = button.dataset.levelMode === territoryLevelMode;
                button.classList.toggle("active", isActive);
                button.setAttribute("aria-pressed", String(isActive));

                const levelKey = button.dataset.levelMode;
                const config = VARIABLE_CONFIGS[selectedVariable];
                const levelSupported = levelKey === "auto" || !config?.levels || config.levels.includes(levelKey);
                button.classList.toggle("level-unavailable", !levelSupported);
                button.title = levelSupported ? "" : `"${config.label}" no está disponible en ${LEVEL_LABELS[levelKey]}`;
            });
            if (status) {
                const modeText = territoryLevelMode === "auto" ? "automático" : "fijado manualmente";
                status.textContent = `Nivel visible: ${LEVEL_LABELS[activeTerritoryLevel] || "cargando"} · ${modeText}`;
                const info = document.getElementById("territory-level-info");
                if (info) info.dataset.customText = `${status.textContent}. El nivel territorial define los límites y la escala de color que se muestran.`;
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

        let activeColorAnimationId = null;

        function hexToRgbArray(hexOrRgb) {
            if (!hexOrRgb) return [51, 65, 85];
            if (typeof hexOrRgb === "string" && hexOrRgb.startsWith("rgb")) {
                const match = hexOrRgb.match(/\d+/g);
                if (match && match.length >= 3) {
                    return [parseInt(match[0], 10), parseInt(match[1], 10), parseInt(match[2], 10)];
                }
            }
            let hex = String(hexOrRgb).replace("#", "");
            if (hex.length === 3) {
                hex = hex.split("").map(c => c + c).join("");
            }
            if (hex.length === 6) {
                const num = parseInt(hex, 16);
                return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
            }
            return [51, 65, 85];
        }

        function rgbArrayToHex(r, g, b) {
            const clamp = x => Math.max(0, Math.min(255, Math.round(x)));
            return "#" + [r, g, b].map(x => clamp(x).toString(16).padStart(2, "0")).join("");
        }

        function refreshTerritoryLayerStyles(level = activeTerritoryLevel, animate = true) {
            const layerGroup = getLayerForLevel(level);
            if (!layerGroup) return;

            if (activeColorAnimationId) {
                cancelAnimationFrame(activeColorAnimationId);
                activeColorAnimationId = null;
            }

            if (!animate || typeof DURACION_TRANSICION_MS === "undefined" || DURACION_TRANSICION_MS <= 0) {
                layerGroup.eachLayer(layer => {
                    layerGroup.resetStyle(layer);
                });
                return;
            }

            const featureTargets = [];
            layerGroup.eachLayer(layer => {
                const startColor = layer.options.fillColor || "#334155";
                const startRgb = hexToRgbArray(startColor);

                const targetStyle = getTerritoryStyle(layer.feature, level, false, layer === selectedLayer);
                const targetColor = targetStyle.fillColor || "#334155";
                const targetRgb = hexToRgbArray(targetColor);

                featureTargets.push({
                    layer,
                    targetStyle,
                    startRgb,
                    targetRgb,
                    isSame: startColor.toLowerCase() === targetColor.toLowerCase()
                });
            });

            if (featureTargets.every(t => t.isSame)) {
                featureTargets.forEach(t => layerGroup.resetStyle(t.layer));
                return;
            }

            const startTime = performance.now();

            function step(now) {
                const elapsed = now - startTime;
                const progress = Math.min(1, elapsed / DURACION_TRANSICION_MS);

                featureTargets.forEach(t => {
                    if (t.isSame) {
                        t.layer.setStyle(t.targetStyle);
                        return;
                    }
                    const r = t.startRgb[0] + (t.targetRgb[0] - t.startRgb[0]) * progress;
                    const g = t.startRgb[1] + (t.targetRgb[1] - t.startRgb[1]) * progress;
                    const b = t.startRgb[2] + (t.targetRgb[2] - t.startRgb[2]) * progress;

                    const interpolatedColor = rgbArrayToHex(r, g, b);
                    t.layer.setStyle({
                        fillColor: interpolatedColor,
                        fillOpacity: t.targetStyle.fillOpacity,
                        color: t.targetStyle.color,
                        weight: t.targetStyle.weight,
                        opacity: t.targetStyle.opacity,
                        dashArray: t.targetStyle.dashArray
                    });
                });

                if (progress < 1) {
                    activeColorAnimationId = requestAnimationFrame(step);
                } else {
                    featureTargets.forEach(t => t.layer.setStyle(t.targetStyle));
                    activeColorAnimationId = null;
                }
            }

            activeColorAnimationId = requestAnimationFrame(step);
        }

        function activateTerritoryLevel(level) {
            const targetLayer = getLayerForLevel(level);
            if (!targetLayer) return;
            const effectiveVariable = getEffectiveVariable(level);
            const yearResolution = resolveSelectedYearForVariable(effectiveVariable, {
                clearWhenUnchanged: false
            });

            if (activeTerritoryLevel === level && map.hasLayer(targetLayer)) {
                updateTerritoryLevelControl();
                if (yearResolution.changed) {
                    setSelectedYearAndRefresh(selectedYear, { preserveYearAdjustmentNotice: true });
                }
                return;
            }

            removeLayerIfPresent(provinceLayer);
            removeLayerIfPresent(cantonLayer);
            removeLayerIfPresent(parishLayer);

            activeTerritoryLevel = level;
            window.__redsaActiveTerritoryLevel = level;
            if (yearResolution.changed) {
                updateMapVariableDescription();
                updateTimelineControl();
            }
            recalculateActiveVariableBins(selectedVariable, level);
            targetLayer.addTo(map);

            const showParishRows = level === "parish";
            [domParroquiaRow, domFallecidosParroquiaRow].forEach(row => {
                if (!row) return;
                row.classList.toggle("u-hidden", !showParishRows);
                row.style.removeProperty("display");
            });
            if (typeof updateParishPopulationContext === "function") {
                updateParishPopulationContext(level === "parish");
            }

            refreshTerritoryLayerStyles();
            updateMapLevelNote(level);
            updateLegend();
            updateTerritoryLevelControl();
            if (selectedTerritory?.props) updateSidebar(selectedTerritory.props);
            if (yearResolution.changed && currentProfileProps) showProfileCard(currentProfileProps, null);
            if (yearResolution.changed) {
                window.REDSAInstitutional?.refresh();
                window.REDSAAntLayer?.syncYear(selectedYear);
                window.REDSAAntLayer?.syncPeriodMode(selectedPeriodMode);
            }
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

        function ensureCantonLayer() {
            if (cantonLayer) return Promise.resolve(cantonLayer);
            if (cantonLoadPromise) return cantonLoadPromise;

            const loader = document.getElementById("loader");
            if (loader) {
                document.getElementById("loader-status").textContent = "Descargando límites cantonales...";
                loader.style.display = "flex";
            }
            const cantonStart = performance.now();
            cantonLoadPromise = Promise.all([
                fetch(RUTA_CANTONES_RELATIVA).then(response => {
                    if (!response.ok) throw new Error("No se pudo cargar el GeoJSON cantonal.");
                    return response.json();
                }),
                fetch(RUTA_HOTSPOTS_CANTONALES_RELATIVA).then(response => {
                    if (!response.ok) throw new Error("No se pudo cargar el índice de hotspots cantonales.");
                    return response.json();
                })
            ]).then(([cantons, hotspots]) => {
                cantonData = cantons;
                hotspotData = hotspots;
                mergeHotspotsIntoCantons(cantonData, hotspotData);
                nationalFatalitiesByYear = calculateNationalFatalitiesByYear(cantonData);
                cantonLayer = L.geoJSON(cantonData, {
                    pane: "territorioPane",
                    style(feature) {
                        const isSelected = selectedLayer && selectedLayer.feature.properties.DPA_CANTON === feature.properties.DPA_CANTON;
                        return getCantonStyle(feature, false, isSelected);
                    },
                    onEachFeature
                });
                window.REDSAExperience?.setCantonFeatures?.(cantonData.features);
                window.REDSAInstitutional?.setCantonFeatures?.(cantonData.features);
                if (loader) loader.style.display = "none";
                window.__redsaGeojsonLoadMetrics = {
                    ...(window.__redsaGeojsonLoadMetrics || {}),
                    cantonLoadMs: Math.round(performance.now() - cantonStart),
                    cantonFeatures: cantonData.features.length,
                    cantonDeferred: false
                };
                return cantonLayer;
            }).catch(error => {
                cantonLoadPromise = null;
                if (loader) loader.style.display = "none";
                console.error("No se pudo cargar la capa cantonal:", error);
                throw error;
            });
            return cantonLoadPromise;
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
            if (desiredLevel === "canton" && !cantonLayer) {
                ensureCantonLayer()
                    .then(() => {
                        const stillDesired = territoryLevelMode === "auto"
                            ? getTerritoryLevelForZoom() === "canton"
                            : territoryLevelMode === "canton";
                        if (stillDesired) activateTerritoryLevel("canton");
                    })
                    .catch(error => console.error("No se pudo sincronizar capa cantonal:", error));
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
