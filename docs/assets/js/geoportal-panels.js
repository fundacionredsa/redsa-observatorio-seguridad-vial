// Elementos del DOM
        const domCanton = document.getElementById("info-canton");
        const domProvincia = document.getElementById("info-provincia");
        const domPoblacion = document.getElementById("info-poblacion");
        const domPoblacionYear = document.getElementById("info-poblacion-year");
        const domTasaSiniestros = document.getElementById("info-tasa-siniestros");
        const domTasaSiniestrosYear = document.getElementById("info-tasa-siniestros-year");
        const domFallecidosSppat = document.getElementById("info-fallecidos-sppat");
        const domSiniestrosInec = document.getElementById("info-siniestros-inec");
        const domLesionadosInec = document.getElementById("info-lesionados-inec");
        const domFallecidosInec = document.getElementById("info-fallecidos-inec");
        const domMatriculadosProv = document.getElementById("info-matriculados-prov");
        const domTasaFallecidos = document.getElementById("info-tasa-fallecidos");
        const domCodCanton = document.getElementById("info-cod-canton");
        const domCodProvincia = document.getElementById("info-cod-provincia");

        // Elementos parroquiales
        const domParroquia = document.getElementById("info-parroquia");
        const domFallecidosParroquia = document.getElementById("info-fallecidos-parroquia");
        const domCodParroquia = document.getElementById("info-cod-parroquia");
        const domParroquiaRow = document.getElementById("parroquia-row");
        const domFallecidosParroquiaRow = document.getElementById("fallecidos-parroquia-row");
        const domWarningBox = document.getElementById("cabecera-warning-box");
        const domPopulationRow = document.getElementById("population-detail-row");
        const domSiniestrosRateRow = document.getElementById("siniestros-rate-detail-row");
        const domFallecidosRateRow = document.getElementById("fallecidos-rate-detail-row");
        const domParishPopulationNote = document.getElementById("parish-population-note");
        const domTerritoryBreadcrumb = document.getElementById("territory-breadcrumb");
        const domHistoricalChartViewControls = document.getElementById("historical-chart-view-controls");

        // Configuración de aviso de cabecera
        const CABECERA_SUFFIX = "50";
        const MENSAJE_CABECERA = "Este polígono agrupa varias parroquias urbanas de {DPA_DESCAN} representadas como cabecera cantonal en la geometría CONALI vigente al 3 de febrero de 2026. La cifra mostrada es la suma de todas ellas, no de una sola parroquia.";
        const TERRITORY_BREADCRUMB_CONFIG = Object.freeze({
            provinceSuffix: /\s+\(Provincia\)$/i,
            emptyValues: Object.freeze(["", "—", "Sin Nombre"])
        });
        const HISTORICAL_CHART_CONFIG = Object.freeze({
            defaultView: "totals",
            typeView: "types",
            maxVisibleTypes: 4,
            typePalette: Object.freeze(["#0284c7", "#ea580c", "#7c3aed", "#059669", "#e11d48"])
        });
        let historicalChartView = HISTORICAL_CHART_CONFIG.defaultView;

        // Dynamic Containers
        const inecDetailedStats = document.getElementById("inec-detailed-stats");
        const inecZonaRatio = document.getElementById("inec-zona-ratio");
        const inecClaseList = document.getElementById("inec-clase-list");
        const inecCausaList = document.getElementById("inec-causa-list");
        const inecHoraPico = document.getElementById("inec-horapico");
        // Profile containers removed from sidebar

        function formatNumber(val) {
            if (val === null || val === undefined) return "Dato no disponible a este nivel";
            return Number(val).toLocaleString('de-DE');
        }

        function validBreadcrumbValue(value) {
            const normalized = String(value || "").trim();
            return normalized &&
                !TERRITORY_BREADCRUMB_CONFIG.emptyValues.includes(normalized) &&
                !normalized.startsWith("Haz clic");
        }

        function updateTerritoryBreadcrumb() {
            if (!domTerritoryBreadcrumb) return;
            const province = domProvincia?.textContent.trim() || "";
            const canton = (domCanton?.textContent.trim() || "")
                .replace(TERRITORY_BREADCRUMB_CONFIG.provinceSuffix, "")
                .trim();
            const parish = domParroquia?.textContent.trim() || "";
            const parishVisible = domParroquiaRow && window.getComputedStyle(domParroquiaRow).display !== "none";
            const parts = [];

            if (validBreadcrumbValue(province)) parts.push(province);
            if (validBreadcrumbValue(canton) && canton !== province) parts.push(canton);
            if (parishVisible && validBreadcrumbValue(parish) && !parts.includes(parish)) parts.push(parish);

            domTerritoryBreadcrumb.replaceChildren();
            domTerritoryBreadcrumb.hidden = parts.length === 0;
            parts.forEach((part, index) => {
                if (index > 0) {
                    const separator = document.createElement("span");
                    separator.className = "territory-breadcrumb-separator";
                    separator.setAttribute("aria-hidden", "true");
                    separator.textContent = "›";
                    domTerritoryBreadcrumb.appendChild(separator);
                }
                const item = document.createElement("span");
                item.className = "territory-breadcrumb-item";
                item.textContent = part;
                domTerritoryBreadcrumb.appendChild(item);
            });
        }

        function hasHistoricalTypeData(props) {
            return Object.values(props?.inec_por_clase || {}).some(entry =>
                entry && Object.values(entry).some(value => Number.isFinite(Number(value)))
            );
        }

        function syncHistoricalChartViewControls(hasTypeData) {
            if (!domHistoricalChartViewControls) return;
            if (!hasTypeData) historicalChartView = HISTORICAL_CHART_CONFIG.defaultView;
            domHistoricalChartViewControls.hidden = !hasTypeData;
            domHistoricalChartViewControls.querySelectorAll("[data-historical-chart-view]").forEach(button => {
                const active = button.dataset.historicalChartView === historicalChartView;
                button.classList.toggle("active", active);
                button.setAttribute("aria-pressed", String(active));
            });
        }

        function buildHistoricalTypeDatasets(props, years, chartTheme) {
            const series = props?.inec_por_clase || {};
            const totals = {};
            Object.values(series).forEach(entry => {
                Object.entries(entry || {}).forEach(([category, value]) => {
                    const numeric = Number(value);
                    if (Number.isFinite(numeric)) totals[category] = (totals[category] || 0) + numeric;
                });
            });
            const categories = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
            const visibleCategories = categories.slice(0, HISTORICAL_CHART_CONFIG.maxVisibleTypes);
            const remainingCategories = categories.slice(HISTORICAL_CHART_CONFIG.maxVisibleTypes);
            const datasetFor = (label, color, categoryGroup) => ({
                label,
                data: years.map(year => {
                    const entry = series[year];
                    if (!entry) return null;
                    return categoryGroup.reduce((sum, category) => sum + (Number(entry[category]) || 0), 0);
                }),
                borderColor: color,
                backgroundColor: color,
                borderWidth: 2,
                tension: 0.15,
                fill: false,
                pointBackgroundColor: color,
                pointBorderColor: chartTheme.pointOutline,
                pointRadius: years.map(year => year === String(selectedYear) ? 5 : 2),
                yAxisID: "y"
            });
            const datasets = visibleCategories.map((category, index) =>
                datasetFor(category, HISTORICAL_CHART_CONFIG.typePalette[index], [category])
            );
            if (remainingCategories.length) {
                datasets.push(datasetFor(
                    "Resto de tipos",
                    HISTORICAL_CHART_CONFIG.typePalette[HISTORICAL_CHART_CONFIG.typePalette.length - 1],
                    remainingCategories
                ));
            }
            return datasets;
        }

        function availableYears(series) {
            return Object.keys(series || {})
                .filter(year => /^\d{4}$/.test(year) && series[year] !== null && series[year] !== undefined)
                .sort((a, b) => Number(a) - Number(b));
        }

        function completeSiniestrosYears(series) {
            return availableYears(series).filter(year => Number(year) <= 2025);
        }

        function formatPeriodYears(years) {
            if (!years.length) return "sin datos";
            return years.length === 1 ? years[0] : `${years[0]}–${years[years.length - 1]}`;
        }

        function sumAnnualSeries(series, years = availableYears(series)) {
            const values = years
                .map(year => Number(series?.[year]))
                .filter(Number.isFinite);
            return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
        }

        function mergeCategorySeries(series, years) {
            const categories = {};
            let total = 0;
            let found = false;
            years.forEach(year => {
                const entry = series?.[year];
                if (!entry || entry.estado === "sin_dato") return;
                Object.entries(entry.categorias || {}).forEach(([key, value]) => {
                    const numeric = Number(value);
                    if (!Number.isFinite(numeric)) return;
                    categories[key] = (categories[key] || 0) + numeric;
                    total += numeric;
                    found = true;
                });
            });
            return found ? { estado: "disponible", total, categorias: categories } : null;
        }

        function mergeEdgSeries(series, years) {
            const merged = {
                estado: "completo",
                total: 0,
                sexo: {},
                edad: {},
                usuario: {},
                cobertura: { edad_conocida: 0, sexo_conocido: 0, usuario_conocido: 0 }
            };
            let found = false;
            years.forEach(year => {
                const entry = series?.[year];
                if (!entry || entry.estado === "sin_dato") return;
                found = true;
                merged.total += Number(entry.total) || 0;
                ["sexo", "edad", "usuario", "cobertura"].forEach(group => {
                    Object.entries(entry[group] || {}).forEach(([key, value]) => {
                        const numeric = Number(value);
                        if (Number.isFinite(numeric)) merged[group][key] = (merged[group][key] || 0) + numeric;
                    });
                });
            });
            return found ? merged : null;
        }

        function updateDetailPeriodControls() {
            document.querySelectorAll("[data-detail-period-mode]").forEach(button => {
                const active = button.dataset.detailPeriodMode === selectedDetailPeriodMode;
                button.classList.toggle("active", active);
                button.setAttribute("aria-pressed", String(active));
            });
            document.querySelectorAll("[data-detail-period-note]").forEach(note => {
                note.textContent = selectedDetailPeriodMode === "accumulated"
                    ? "Suma solo conteos compatibles y muestra el periodo real de cada fuente. Las tasas anuales no se suman."
                    : "Conteos del año marcado en la línea de tiempo.";
            });
        }

        function getSiniestrosRate(props, year) {
            const siniestros = props && props.siniestros_historico;
            const poblacion = props && props.poblacion_por_anio;
            if (!siniestros || !poblacion) return null;
            const yearKey = String(year);
            const total = Number(siniestros[yearKey]);
            const population = Number(poblacion[yearKey]);
            return Number.isFinite(total) && Number.isFinite(population) && population > 0
                ? { year: yearKey, value: total / population * 100000 }
                : null;
        }

        function siglaInfoIcon(sigla, customText = null) {
            if (customText) {
                const encodedText = customText.replace(/"/g, '&quot;');
                return `<button type="button" class="sigla-tooltip-trigger" data-sigla="${sigla}" data-custom-text="${encodedText}" aria-label="Por qué no se muestran población ni tasas parroquiales">ⓘ</button>`;
            }
            return `<span class="sigla-tooltip-trigger" data-sigla="${sigla}">ⓘ</span>`;
        }

        function updateParishPopulationContext(isParish) {
            [domPopulationRow, domSiniestrosRateRow, domFallecidosRateRow].forEach(row => {
                if (!row) return;
                row.classList.toggle("u-hidden", isParish);
                row.hidden = isParish;
            });
            if (!domParishPopulationNote) return;
            domParishPopulationNote.classList.toggle("u-hidden", !isParish);
            domParishPopulationNote.hidden = !isParish;
            domParishPopulationNote.innerHTML = isParish
                ? `<span>Sobre población y tasas por habitante en parroquias ${siglaInfoIcon(
                    "Población parroquial",
                    "El INEC no publica proyecciones de población a nivel parroquial. Por eso el Observatorio no muestra población ni tasas por habitante en este nivel."
                )}</span>`
                : "";
        }
        window.updateParishPopulationContext = updateParishPopulationContext;

        // Helper to render dynamic progress bar
        defProgressBar = (label, count, pct, color, trendHtml = "") => {
            const bar = `
                <div class="profile-bar-row">
                    <div class="profile-bar-labels">
                        <span>${label}</span>
                        <span style="font-weight: 600;">${count} (${pct.toFixed(1)}%)</span>
                    </div>
                    <div class="profile-bar-wrapper">
                        <div class="profile-bar-fill" style="width: ${pct}%; background-color: ${color};"></div>
                    </div>
                </div>
            `;
            return trendHtml
                ? `<div class="profile-row-with-trend">${bar}${trendHtml}</div>`
                : bar;
        }

        function renderSparkline(values, color) {
            const numeric = values.map(value => Number.isFinite(Number(value)) ? Number(value) : null);
            const available = numeric.filter(value => value !== null);
            if (available.length < 2) {
                return `<span style="font-size:0.58rem;color:var(--text-muted);">sin serie</span>`;
            }
            const width = 72;
            const height = 23;
            const min = Math.min(...available);
            const max = Math.max(...available);
            const range = max - min || 1;
            const points = numeric.map((value, index) => {
                if (value === null) return null;
                const x = index / Math.max(1, numeric.length - 1) * width;
                const y = height - 2 - ((value - min) / range) * (height - 4);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).filter(Boolean).join(" ");
            return `<svg class="profile-sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="Tendencia 2020 a 2024"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="${width}" cy="${points.split(" ").at(-1).split(",")[1]}" r="2.4" fill="${color}"/></svg>`;
        }

        // --- FICHA TERRITORIAL DENTRO DE LA PESTAÑA LEYENDA ---

        function hideProfileCard() {
            currentProfileProps = null;
            document.body.classList.remove("profile-selection-active");
            const card = document.getElementById("demographic-hover-card");
            if (card) card.hidden = true;
            const body = document.getElementById("hover-card-body");
            const title = document.getElementById("hover-card-title");
            if (body) body.replaceChildren();
            if (title) title.textContent = "Consulta territorial";
        }

        function ensureProfileHeaderVisible(card) {
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    card.querySelector("#profile-card-close")?.scrollIntoView({
                        block: "nearest",
                        inline: "nearest",
                        behavior: "smooth"
                    });
                });
            });
        }

        function renderLegacyProfileCard(props, e) {
            const card = document.getElementById("demographic-hover-card");
            const body = document.getElementById("hover-card-body");
            const title = document.getElementById("hover-card-title");

            if (!card || !body || !title) return;
            currentProfileProps = props;
            const periodBadge = document.getElementById("hover-card-period");
            if (periodBadge) {
                periodBadge.textContent = selectedDetailPeriodMode === "accumulated"
                    ? "Histórico"
                    : (Number(selectedYear) === 2026 ? "2026 ene-jun" : String(selectedYear));
            }

            card.hidden = false;
            document.body.classList.add("profile-selection-active");
            ensureProfileHeaderVisible(card);

            // Caso 1: Parroquia
            if (props.DPA_PARROQ) {
                title.textContent = `${props.DPA_DESPAR} (Parroquia)`;
                const parishYears = selectedDetailPeriodMode === "accumulated"
                    ? availableYears(props.fallecidos_por_anio)
                    : [String(selectedYear)].filter(year => props.fallecidos_por_anio?.[year] !== undefined);
                const parishPeriod = selectedDetailPeriodMode === "accumulated" ? formatPeriodYears(parishYears) : String(selectedYear);
                const parishFatalities = selectedDetailPeriodMode === "accumulated"
                    ? sumAnnualSeries(props.fallecidos_por_anio, parishYears)
                    : props.fallecidos_por_anio?.[String(selectedYear)];
                let html = `
                    <div style="font-size: 0.72rem; color: var(--text-secondary); line-height: 1.4; padding: 6px 0;">
                        <strong>Personas fallecidas en esta parroquia (${parishPeriod}):</strong> ${parishFatalities ?? "Sin dato"}
                    </div>
                    <div style="font-size: 0.65rem; color: var(--text-muted); line-height: 1.35; margin-top: 8px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 6px;">
                        No hay datos de edad, sexo o forma de desplazamiento disponibles para esta parroquia.
                    </div>
                `;
                body.innerHTML = html;
                return;
            }

            // Caso 2: Cantón
            const isProvinceProfile = props.nivel_agregacion === "provincia";
            title.textContent = isProvinceProfile ? `${props.DPA_DESPRO} (Provincia)` : `${props.DPA_DESCAN} (Cantón)`;

            const edgSeries = props.fallecidos_detallado || {};
            const edgYears = selectedDetailPeriodMode === "accumulated"
                ? availableYears(edgSeries)
                : [String(selectedYear)].filter(year => edgSeries[year]);
            const edgPeriod = selectedDetailPeriodMode === "accumulated" ? formatPeriodYears(edgYears) : String(selectedYear);
            const edg = selectedDetailPeriodMode === "accumulated"
                ? mergeEdgSeries(edgSeries, edgYears)
                : edgSeries[String(selectedYear)];
            let html = `<div class="perfil-card-grid">`;

            // 1. Perfil de personas fallecidas según el registro civil
            html += `
                <div class="profile-card-source-title">
                    <span class="profile-card-citizen-title">¿Quiénes fallecieron en siniestros de tránsito aquí?</span>
                    <span class="profile-card-title-meta">Periodo: ${edgPeriod}</span>
                    <span class="profile-card-source-detail">Personas fallecidas en siniestros de tránsito según el registro civil. ${siglaInfoIcon("INEC")} ${siglaInfoIcon("EDG")} ${siglaInfoIcon("CIE-10")}</span>
                </div>
            `;

            if (edg && edg.estado !== "sin_dato" && edg.sexo && edg.usuario && edg.edad) {
                const total_edg = Number(edg.total) || Object.values(edg.sexo).reduce((a,b) => a+b, 0);
                if (total_edg > 0) {
                    const m_pct = (edg.sexo.Hombre / total_edg) * 100;
                    const f_pct = (edg.sexo.Mujer / total_edg) * 100;
                    html += `
                        <div class="perfil-card-section">
                            <div class="profile-section-title">Sexo registrado y forma de desplazamiento</div>
                            <div class="profile-section-subtitle">Sexo registrado (total: ${total_edg}):</div>
                            <div class="gender-bar-wrapper">
                                ${edg.sexo.Hombre > 0 ? `<div class="gender-segment male" style="width: ${m_pct}%;">H: ${m_pct.toFixed(0)}%</div>` : ''}
                                ${edg.sexo.Mujer > 0 ? `<div class="gender-segment female" style="width: ${f_pct}%;">M: ${f_pct.toFixed(0)}%</div>` : ''}
                            </div>
                            <div class="profile-section-subtitle">Cómo se desplazaban:</div>
                    `;

                    const userColors = {
                        peaton: "#eab308",
                        ciclista: "#22c55e",
                        motociclista: "#f97316",
                        ocupante: "#38bdf8",
                        otro: "#94a3b8",
                        sin_dato: "#64748b"
                    };
                    const AGE_GROUP_COLORS = {
                        '0-14': '#a78bfa',
                        '15-29': '#8b5cf6',
                        '30-49': '#7c3aed',
                        '50-64': '#6d28d9',
                        '65+': '#5b21b6'
                    };
                    const userLabels = {
                        peaton: "Peatón",
                        ciclista: "Ciclista",
                        motociclista: "Motociclista",
                        ocupante: "Ocupante",
                        otro: "Otros / veh. no especificado (V80-V89)",
                        sin_dato: "Sin dato de usuario vial"
                    };

                    const total_sin_dato = edg.cobertura ? (total_edg - edg.cobertura.usuario_conocido) : 0;
                    const total_otro = Math.max(0, (edg.usuario.otro || 0) - total_sin_dato);
                    
                    const userCounts = {
                        peaton: edg.usuario.peaton || 0,
                        ciclista: edg.usuario.ciclista || 0,
                        motociclista: edg.usuario.motociclista || 0,
                        ocupante: edg.usuario.ocupante || 0,
                        otro: total_otro,
                        sin_dato: total_sin_dato
                    };

                    Object.keys(userLabels).forEach(k => {
                        const count = userCounts[k];
                        if (count === 0 && (k === "sin_dato" || k === "otro")) return;

                        const pct = (count / total_edg) * 100;
                        const trend = ["2020", "2021", "2022", "2023", "2024"].map(year => {
                            const annual = edgSeries[year];
                            if (!annual || annual.estado === "sin_dato") return null;
                            const ann_total = annual.total || 0;
                            const ann_conocido = annual.cobertura ? annual.cobertura.usuario_conocido : ann_total;
                            const ann_sin_dato = ann_total - ann_conocido;
                            if (k === "sin_dato") return ann_sin_dato;
                            if (k === "otro") return Math.max(0, (annual.usuario?.otro || 0) - ann_sin_dato);
                            return annual.usuario?.[k] || 0;
                        });
                        html += defProgressBar(
                            userLabels[k],
                            count,
                            pct,
                            userColors[k],
                            renderSparkline(trend, userColors[k])
                        );
                    });
                    html += `</div>`;

                    html += `
                        <div class="perfil-card-section">
                            <div class="profile-section-title">Grupos de edad</div>
                    `;
                    const ageLabels = {
                        '0-14': "Niños (0-14 años)",
                        '15-29': "Jóvenes (15-29)",
                        '30-49': "Adultos (30-49)",
                        '50-64': "Adultos (50-64)",
                        '65+': "Adultos mayores (65+)"
                    };
                    Object.keys(edg.edad).forEach(k => {
                        const count = edg.edad[k];
                        if (count > 0) {
                            const pct = (count / total_edg) * 100;
                            html += defProgressBar(ageLabels[k], count, pct, AGE_GROUP_COLORS[k] || "#8b5cf6");
                        }
                    });
                    html += `</div>`;
                } else {
                    html += `<div class="perfil-card-section" style="grid-column: 1 / -1; color: var(--text-muted); font-size: 0.68rem;">El registro civil no tiene fallecidos disponibles para este año.</div>`;
                }
            } else {
                html += `<div class="perfil-card-section" style="grid-column: 1 / -1; color: var(--text-muted); font-size: 0.68rem;">No hay datos de edad, sexo o forma de desplazamiento en el registro civil para este año.</div>`;
            }

            // 2. Reclamaciones del seguro obligatorio
            const yearKey = String(selectedYear);
            const sppatYears = selectedDetailPeriodMode === "accumulated"
                ? availableYears(props.sppat_fallecidos_por_anio)
                : [yearKey].filter(year => props.sppat_fallecidos_por_anio?.[year] !== undefined);
            const sppatPeriod = selectedDetailPeriodMode === "accumulated" ? formatPeriodYears(sppatYears) : String(selectedYear);
            const sppat_t = selectedDetailPeriodMode === "accumulated"
                ? sumAnnualSeries(props.sppat_fallecidos_por_anio, sppatYears)
                : props.sppat_fallecidos_por_anio?.[yearKey];
            const sppatSexoEntry = selectedDetailPeriodMode === "accumulated" ? mergeCategorySeries(props.sppat_por_sexo, sppatYears) : props.sppat_por_sexo?.[yearKey];
            const sppatCondEntry = selectedDetailPeriodMode === "accumulated" ? mergeCategorySeries(props.sppat_por_condicion, sppatYears) : props.sppat_por_condicion?.[yearKey];
            const sppatTipoEntry = selectedDetailPeriodMode === "accumulated" ? mergeCategorySeries(props.sppat_por_tipo_accidente, sppatYears) : props.sppat_por_tipo_accidente?.[yearKey];
            html += `
                <div class="profile-card-source-title">
                    <span class="profile-card-citizen-title">Fallecidos registrados en reclamaciones del seguro</span>
                    <span class="profile-card-title-meta">Periodo: ${sppatPeriod}</span>
                    <span class="profile-card-source-detail">Personas fallecidas registradas en reclamaciones del seguro. ${siglaInfoIcon("SPPAT")}</span>
                </div>
            `;

            if (sppat_t !== undefined && sppatSexoEntry?.estado === "disponible") {
                const sppatSexo = sppatSexoEntry.categorias || {};
                const s_m_count = sppatSexo.MASCULINO || 0;
                const s_f_count = sppatSexo.FEMENINO || 0;
                const s_total_sex = s_m_count + s_f_count;
                if (s_total_sex > 0) {
                    const sm_pct = (s_m_count / s_total_sex) * 100;
                    const sf_pct = (s_f_count / s_total_sex) * 100;
                    html += `
                        <div class="perfil-card-section">
                            <div class="profile-section-title">Sexo registrado en las reclamaciones</div>
                            <div class="profile-section-subtitle">Total con este dato: ${s_total_sex}</div>
                            <div class="gender-bar-wrapper">
                                ${s_m_count > 0 ? `<div class="gender-segment male" style="width: ${sm_pct}%;">Masc: ${sm_pct.toFixed(0)}%</div>` : ''}
                                ${s_f_count > 0 ? `<div class="gender-segment female" style="width: ${sf_pct}%;">Fem: ${sf_pct.toFixed(0)}%</div>` : ''}
                            </div>
                        </div>
                    `;
                }

                const condObj = sppatCondEntry?.categorias || {};
                const total_cond = Object.values(condObj).reduce((a,b) => a+b, 0);
                const tipoObj = sppatTipoEntry?.categorias || {};
                const total_tipo = Object.values(tipoObj).reduce((a,b) => a+b, 0);
                if (total_cond > 0 || total_tipo > 0) {
                    html += `
                        <div class="perfil-card-section">
                            <div class="profile-section-title">Cómo se desplazaban y tipo de accidente</div>
                    `;
                    if (total_cond > 0) {
                        html += `<div class="profile-section-subtitle">Cómo se desplazaba la víctima:</div>`;
                        const condColors = {
                            "PEATÓN": "#eab308",
                            "OCUPANTE": "#38bdf8",
                            "BICICLETA": "#22c55e",
                            "DESCONOCIDO": "#94a3b8"
                        };
                        Object.keys(condObj).forEach(k => {
                            const count = condObj[k];
                            const pct = (count / total_cond) * 100;
                            html += defProgressBar(k, count, pct, condColors[k] || "#94a3b8");
                        });
                    }
                    if (total_tipo > 0) {
                        html += `<div class="profile-section-subtitle" style="margin-top: 6px;">Tipo de Accidente:</div>`;
                        Object.keys(tipoObj).forEach(k => {
                            const count = tipoObj[k];
                            const pct = (count / total_tipo) * 100;
                            html += defProgressBar(k, count, pct, "#a855f7");
                        });
                    }
                    html += `</div>`;
                }
            } else {
                html += `<div class="perfil-card-section" style="grid-column: 1 / -1; color: var(--text-muted); font-size: 0.68rem;">No hay detalle por sexo, forma de desplazamiento o tipo de accidente en las reclamaciones de ${sppatPeriod}.</div>`;
            }

            html += `
                <div class="profile-note" style="grid-column: 1 / -1;">
                    ${selectedDetailPeriodMode === "accumulated"
                        ? "El acumulado suma únicamente los años disponibles indicados en cada fuente. Los años faltantes no se completan con estimaciones."
                        : "Cada año muestra únicamente los registros disponibles. Los años faltantes no se completan con estimaciones."}
                </div>
                </div>
            `;

            body.innerHTML = html;
        }

        function showProfileCard(props) {
            const card = document.getElementById("demographic-hover-card");
            const body = document.getElementById("hover-card-body");
            const title = document.getElementById("hover-card-title");
            if (!card || !body || !title || !props) return;

            currentProfileProps = props;
            const isParish = Boolean(props.DPA_PARROQ);
            const isProvince = !isParish && props.nivel_agregacion === "provincia";
            const territoryName = isParish
                ? props.DPA_DESPAR
                : (isProvince ? props.DPA_DESPRO : props.DPA_DESCAN);
            const territoryLevel = isParish ? "Parroquia" : (isProvince ? "Provincia" : "Cantón");
            const territoryCode = isParish
                ? props.DPA_PARROQ
                : (isProvince ? props.DPA_PROVIN : props.DPA_CANTON);

            title.textContent = territoryName || "Territorio seleccionado";
            body.innerHTML = `
                <div class="legend-territory-shortcut-copy">
                    <span class="legend-territory-shortcut-meta">${territoryLevel}${territoryCode ? ` · Código DPA ${territoryCode}` : ""}</span>
                    <p>La consulta detallada, series históricas y perfil demográfico están disponibles en la pestaña ANÁLISIS del panel derecho.</p>
                </div>
            `;
            card.hidden = false;
            document.body.classList.add("profile-selection-active");
        }

        document.addEventListener("DOMContentLoaded", () => {
            document.getElementById("profile-card-close")?.addEventListener("click", clearTerritorySelection);
        });

        let currentProps = null;

        function getAnalysisChartTheme() {
            const styles = getComputedStyle(document.documentElement);
            return {
                textPrimary: styles.getPropertyValue("--text-primary").trim() || "#f8fafc",
                textMuted: styles.getPropertyValue("--text-muted").trim() || "#94a3b8",
                grid: styles.getPropertyValue("--border-glass").trim() || "rgba(255, 255, 255, 0.1)",
                pointOutline: document.body.classList.contains("light-theme") ? "#ffffff" : "#0f172a"
            };
        }
        let currentProfileProps = null;

        document.addEventListener("click", event => {
            const button = event.target.closest("[data-detail-period-mode]");
            if (!button) return;
            selectedDetailPeriodMode = button.dataset.detailPeriodMode;
            updateDetailPeriodControls();
            if (currentProps) updateSidebar(currentProps);
            if (currentProfileProps) showProfileCard(currentProfileProps, null);
        });

        document.addEventListener("click", event => {
            const button = event.target.closest("[data-historical-chart-view]");
            if (!button || button.disabled) return;
            historicalChartView = button.dataset.historicalChartView;
            syncHistoricalChartViewControls(true);
            if (selectedTerritory?.props) updateSidebar(selectedTerritory.props);
            else if (currentProps) updateSidebar(currentProps);
        });

        updateDetailPeriodControls();

        function renderSiniestrosSection(props, yearVal) {
            const inecDetailedStats = document.getElementById("inec-detailed-stats");
            const inecZonaRatio = document.getElementById("inec-zona-ratio");
            const inecClaseList = document.getElementById("inec-clase-list");
            const inecCausaList = document.getElementById("inec-causa-list");
            const inecHoraPico = document.getElementById("inec-horapico");

            const domSiniestrosInec = document.getElementById("info-siniestros-inec");
            const domLesionadosInec = document.getElementById("info-lesionados-inec");

            if (!props || !props.siniestros_historico) {
                inecDetailedStats.style.display = "none";
                domSiniestrosInec.textContent = "—";
                domSiniestrosInec.classList.add("empty");
                domLesionadosInec.textContent = "—";
                domLesionadosInec.classList.add("empty");
                return;
            }

            const yearKey = String(yearVal);
            const yearsToProcess = selectedDetailPeriodMode === "accumulated"
                ? completeSiniestrosYears(props.siniestros_historico)
                : (props.siniestros_historico[yearKey] !== undefined ? [yearKey] : []);

            if (yearsToProcess.length === 0) {
                inecDetailedStats.style.display = "none";
                domSiniestrosInec.textContent = "Sin datos";
                domSiniestrosInec.classList.add("empty");
                domLesionadosInec.textContent = "Sin datos";
                domLesionadosInec.classList.add("empty");
                return;
            }

            let totalSiniestros = 0;
            let totalLesionados = 0;
            let hasLesionados = false;

            let mergedZona = {};
            let mergedClase = {};
            let mergedCausa = {};
            let mergedHorario = {};

            yearsToProcess.forEach(yr => {
                totalSiniestros += props.siniestros_historico[yr] || 0;

                const res = props.inec_resumen_historico && props.inec_resumen_historico[yr];
                if (res) {
                    totalLesionados += res.lesionados || 0;
                    hasLesionados = true;
                }

                const zObj = props.inec_urbano_rural && props.inec_urbano_rural[yr];
                if (zObj) {
                    Object.keys(zObj).forEach(k => {
                        mergedZona[k] = (mergedZona[k] || 0) + zObj[k];
                    });
                }

                const cObj = props.inec_por_clase && props.inec_por_clase[yr];
                if (cObj) {
                    Object.keys(cObj).forEach(k => {
                        mergedClase[k] = (mergedClase[k] || 0) + cObj[k];
                    });
                }

                const cauObj = props.inec_por_causa && props.inec_por_causa[yr];
                if (cauObj) {
                    Object.keys(cauObj).forEach(k => {
                        mergedCausa[k] = (mergedCausa[k] || 0) + cauObj[k];
                    });
                }

                const hObj = props.inec_patron_horario && props.inec_patron_horario[yr];
                if (hObj) {
                    Object.keys(hObj).forEach(k => {
                        mergedHorario[k] = (mergedHorario[k] || 0) + hObj[k];
                    });
                }
            });

            domSiniestrosInec.textContent = totalSiniestros.toLocaleString('de-DE');
            domSiniestrosInec.classList.remove("empty");

            domLesionadosInec.textContent = hasLesionados
                ? totalLesionados.toLocaleString('de-DE')
                : "Sin dato";
            domLesionadosInec.classList.toggle("empty", !hasLesionados);

            inecDetailedStats.style.display = "block";

            const u_count = mergedZona.URBANA || 0;
            const r_count = mergedZona.RURAL || 0;
            const total_ur = u_count + r_count;
            if (total_ur > 0) {
                inecZonaRatio.textContent = `Urbana: ${u_count.toLocaleString('de-DE')} (${(u_count/total_ur*100).toFixed(0)}%) / Rural: ${r_count.toLocaleString('de-DE')} (${(r_count/total_ur*100).toFixed(0)}%)`;
            } else {
                inecZonaRatio.textContent = "Sin datos de zona";
            }

            const sortedClases = Object.keys(mergedClase).map(k => [k, mergedClase[k]]).sort((a,b) => b[1] - a[1]);
            let claseHtml = "";
            sortedClases.slice(0, 3).forEach(c => {
                const pct = totalSiniestros > 0 ? (c[1] / totalSiniestros) * 100 : 0;
                claseHtml += defProgressBar(c[0], c[1], pct, "#38bdf8");
            });
            inecClaseList.innerHTML = claseHtml || "Sin datos de clase";

            const sortedCausas = Object.keys(mergedCausa).map(k => [k, mergedCausa[k]]).sort((a,b) => b[1] - a[1]);
            let causaHtml = "";
            sortedCausas.slice(0, 2).forEach(c => {
                const pct = totalSiniestros > 0 ? (c[1] / totalSiniestros) * 100 : 0;
                causaHtml += `<div style="margin-bottom: 4px; line-height: 1.2;">• <strong style="color: var(--text-primary);">${c[0]}:</strong> ${c[1].toLocaleString('de-DE')} (${pct.toFixed(0)}%)</div>`;
            });
            inecCausaList.innerHTML = causaHtml || "Sin datos de causas";

            const sortedHoras = Object.keys(mergedHorario).map(k => [k, mergedHorario[k]]).sort((a,b) => b[1] - a[1]);
            if (sortedHoras.length > 0) {
                inecHoraPico.textContent = `${sortedHoras[0][0]} (${sortedHoras[0][1].toLocaleString('de-DE')} siniestros)`;
            } else {
                inecHoraPico.textContent = "Sin datos horarios";
            }
        }

        function updateSidebar(props) {
            const chartContainer = document.getElementById("chart-container");
            const chartEmptyMsg = document.getElementById("chart-empty-msg");
            const analysisEmptyState = document.getElementById("analysis-empty-state");
            const selectionOnlySections = [
                document.getElementById("chart-wrapper"),
                document.getElementById("traffic-events-section"),
                document.getElementById("territory-codes-disclosure"),
                document.getElementById("fatalities-section")
            ].filter(Boolean);

            let parishProps = null;
            if (props && props.DPA_PARROQ) {
                parishProps = props;
                props = getCantonProps(parishProps.DPA_CANTON) || parishProps;
            }
            updateParishPopulationContext(Boolean(parishProps) || activeTerritoryLevel === "parish");

            if (parishProps) {
                domParroquia.textContent = parishProps.DPA_DESPAR;
                domParroquia.classList.remove("empty");
                document.getElementById("parroquia-sidebar-year").textContent = String(selectedYear);
                const parishFatalities = parishProps.fallecidos_por_anio?.[String(selectedYear)];
                domFallecidosParroquia.textContent = parishFatalities === undefined ? "Sin dato" : formatNumber(parishFatalities);
                domFallecidosParroquia.classList.remove("empty");
                domCodParroquia.textContent = parishProps.DPA_PARROQ;

                if (String(parishProps.DPA_PARROQ).endsWith(CABECERA_SUFFIX)) {
                    domWarningBox.textContent = MENSAJE_CABECERA.replace("{DPA_DESCAN}", parishProps.DPA_DESCAN);
                    domWarningBox.style.display = "block";
                } else {
                    domWarningBox.style.display = "none";
                }

                document.getElementById("dpa-label-prefix").textContent = "Parroquia / Cantón / Provincia";
                document.getElementById("info-cod-parroquia-span").style.display = "inline";
                document.getElementById("info-cod-parroquia").textContent = parishProps.DPA_PARROQ;
            } else {
                if (domParroquia) {
                    domParroquia.textContent = "—";
                    domParroquia.classList.add("empty");
                    domFallecidosParroquia.textContent = "—";
                    domFallecidosParroquia.classList.add("empty");
                }
                if (domWarningBox) {
                    domWarningBox.style.display = "none";
                }

                const span = document.getElementById("info-cod-parroquia-span");
                if (span) span.style.display = "none";
                const prefix = document.getElementById("dpa-label-prefix");
                if (prefix) prefix.textContent = "Cantón / Provincia";
            }

            if (!props) {
                if (analysisEmptyState) analysisEmptyState.hidden = false;
                selectionOnlySections.forEach(section => { section.hidden = true; });
                const promptLevel = activeTerritoryLevel === "province" ? "una provincia" : (activeTerritoryLevel === "parish" ? "una parroquia" : "un cantón");
                currentProps = null;
                domCanton.textContent = `Haz clic en ${promptLevel}`;
                domCanton.classList.add("empty");
                domProvincia.textContent = "—";
                domProvincia.classList.add("empty");
                domPoblacion.textContent = "Dato no disponible a este nivel";
                domPoblacionYear.textContent = String(selectedYear);
                domPoblacion.classList.add("empty");
                domTasaSiniestros.textContent = "Sin dato";
                domTasaSiniestros.classList.add("empty");
                domTasaSiniestrosYear.textContent = "sin dato";
                document.getElementById("siniestros-section-year").textContent = String(selectedYear);
                document.getElementById("sppat-sidebar-year").textContent = String(selectedYear);
                document.getElementById("edg-sidebar-year").textContent = String(selectedYear);
                document.getElementById("tasa-fallecidos-year").textContent = String(selectedYear);
                domFallecidosSppat.textContent = "—";
                domFallecidosSppat.classList.add("empty");
                domSiniestrosInec.textContent = "—";
                domSiniestrosInec.classList.add("empty");
                domLesionadosInec.textContent = "—";
                domLesionadosInec.classList.add("empty");
                domFallecidosInec.textContent = "—";
                domFallecidosInec.classList.add("empty");
                domMatriculadosProv.textContent = "—";
                domMatriculadosProv.classList.add("empty");
                domTasaFallecidos.textContent = "Dato no disponible a este nivel";
                domTasaFallecidos.classList.add("empty");
                domCodCanton.textContent = "—";
                domCodProvincia.textContent = "—";
                updateInterpretationCard(null);

                // Hide dynamic sections
                inecDetailedStats.style.display = "none";

                if (historicoChart) {
                    historicoChart.destroy();
                    historicoChart = null;
                }
                chartContainer.style.display = "none";
                chartEmptyMsg.style.display = "block";
                chartEmptyMsg.textContent = `Haz clic en ${promptLevel} para ver la tendencia`;
                syncHistoricalChartViewControls(false);
                updateTerritoryBreadcrumb();
                window.REDSAExperience?.updateSummary(null, selectedYear);
                return;
            }

            if (analysisEmptyState) analysisEmptyState.hidden = true;
            selectionOnlySections.forEach(section => { section.hidden = false; });

            const isProvinceProps = props.nivel_agregacion === "provincia";

            domCanton.textContent = isProvinceProps ? `${props.DPA_DESPRO} (Provincia)` : (props.DPA_DESCAN || "Sin Nombre");
            domCanton.classList.remove("empty");

            domProvincia.textContent = props.DPA_DESPRO || "Sin Nombre";
            domProvincia.classList.remove("empty");

            if (isProvinceProps && domWarningBox) {
                domWarningBox.textContent = "Este dato se calcula sumando los cantones de la provincia; algunos años pueden tener información incompleta.";
                domWarningBox.title = "Agregado provincial derivado de cantones; la cobertura por año se conserva en los metadatos técnicos del conjunto provincial.";
                domWarningBox.style.display = "block";
            }

            const fatalitiesCoverageWarning = selectedVariable === "fallecidos_parroquial"
                ? getFatalitiesCoverageWarning(props, selectedYear)
                : "";
            if (fatalitiesCoverageWarning && domWarningBox) {
                const prefix = domWarningBox.style.display === "block" && domWarningBox.textContent
                    ? `${domWarningBox.textContent} `
                    : "";
                domWarningBox.textContent = `${prefix}${fatalitiesCoverageWarning}`;
                domWarningBox.style.display = "block";
            }

            const yearKey = String(selectedYear);
            const poblacion = props.poblacion_por_anio?.[yearKey];
            domPoblacionYear.textContent = yearKey;
            domPoblacion.textContent = formatNumber(poblacion);
            if (poblacion !== null && poblacion !== undefined) domPoblacion.classList.remove("empty");
            else {
                domPoblacion.textContent = "Dato no disponible a este nivel";
                domPoblacion.classList.add("empty");
            }

            const selectedSiniestrosRate = selectedDetailPeriodMode === "year"
                ? getSiniestrosRate(parishProps || props, selectedYear)
                : null;
            if (selectedDetailPeriodMode === "accumulated") {
                domTasaSiniestros.textContent = "No aplica al acumulado";
                domTasaSiniestros.classList.add("empty");
                domTasaSiniestrosYear.textContent = "indicador anual";
            } else if (selectedSiniestrosRate) {
                domTasaSiniestros.textContent = selectedSiniestrosRate.value.toLocaleString('de-DE', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }) + " por cada 100.000 habitantes";
                domTasaSiniestros.classList.remove("empty");
                domTasaSiniestrosYear.textContent = selectedSiniestrosRate.year;
            } else {
                domTasaSiniestros.textContent = "Sin dato";
                domTasaSiniestros.classList.add("empty");
                domTasaSiniestrosYear.textContent = "sin dato";
            }

            const sppatYears = selectedDetailPeriodMode === "accumulated"
                ? availableYears(props.sppat_fallecidos_por_anio)
                : [yearKey].filter(year => props.sppat_fallecidos_por_anio?.[year] !== undefined);
            const sppatValue = selectedDetailPeriodMode === "accumulated"
                ? sumAnnualSeries(props.sppat_fallecidos_por_anio, sppatYears)
                : props.sppat_fallecidos_por_anio?.[yearKey];
            document.getElementById("sppat-sidebar-year").textContent = selectedDetailPeriodMode === "accumulated" ? formatPeriodYears(sppatYears) : yearKey;
            domFallecidosSppat.textContent = sppatValue === undefined || sppatValue === null ? "Sin dato" : formatNumber(sppatValue);
            if (sppatValue !== undefined && sppatValue !== null) domFallecidosSppat.classList.remove("empty");
            else domFallecidosSppat.classList.add("empty");

            domSiniestrosInec.textContent = formatNumber(props.siniestros_inec_2019);
            if (props.siniestros_inec_2019 !== null) domSiniestrosInec.classList.remove("empty");
            else domSiniestrosInec.classList.add("empty");

            domLesionadosInec.textContent = formatNumber(props.lesionados_inec_2019);
            if (props.lesionados_inec_2019 !== null) domLesionadosInec.classList.remove("empty");
            else domLesionadosInec.classList.add("empty");

            const edgYears = selectedDetailPeriodMode === "accumulated"
                ? availableYears(props.fallecidos_historico)
                : [yearKey].filter(year => props.fallecidos_historico?.[year] !== undefined);
            const edgValue = selectedDetailPeriodMode === "accumulated"
                ? sumAnnualSeries(props.fallecidos_historico, edgYears)
                : props.fallecidos_historico?.[yearKey];
            document.getElementById("edg-sidebar-year").textContent = selectedDetailPeriodMode === "accumulated" ? formatPeriodYears(edgYears) : yearKey;
            domFallecidosInec.textContent = edgValue === undefined || edgValue === null ? "Sin dato" : formatNumber(edgValue);
            if (edgValue !== undefined && edgValue !== null) domFallecidosInec.classList.remove("empty");
            else domFallecidosInec.classList.add("empty");

            const vehiculos2024 = props.vehiculos_matriculados_2024?.total;
            domMatriculadosProv.textContent = formatNumber(vehiculos2024);
            if (vehiculos2024 !== null && vehiculos2024 !== undefined) domMatriculadosProv.classList.remove("empty");
            else domMatriculadosProv.classList.add("empty");

            const tasa = selectedDetailPeriodMode === "year"
                ? getVariableValue(props, "tasa_fallecidos_100k", selectedYear)
                : null;
            document.getElementById("tasa-fallecidos-year").textContent = selectedDetailPeriodMode === "accumulated" ? "indicador anual" : yearKey;
            if (selectedDetailPeriodMode === "accumulated") {
                domTasaFallecidos.textContent = "No aplica al acumulado";
                domTasaFallecidos.classList.add("empty");
            } else if (tasa !== null && tasa !== undefined) {
                domTasaFallecidos.textContent = tasa.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " por cada 100.000 habitantes";
                domTasaFallecidos.classList.remove("empty");
            } else {
                domTasaFallecidos.textContent = "Dato no disponible a este nivel";
                domTasaFallecidos.classList.add("empty");
            }

            domCodCanton.textContent = isProvinceProps ? "—" : (props.DPA_CANTON || "—");
            domCodProvincia.textContent = props.DPA_PROVIN || "—";

            currentProps = props;
            const inecYears = selectedDetailPeriodMode === "accumulated"
                ? completeSiniestrosYears(props.siniestros_historico)
                : [yearKey].filter(year => props.siniestros_historico?.[year] !== undefined);
            document.getElementById("siniestros-section-year").textContent = selectedDetailPeriodMode === "accumulated"
                ? formatPeriodYears(inecYears)
                : (Number(selectedYear) === 2026 ? "2026 enero-junio" : yearKey);
            renderSiniestrosSection(props, selectedYear);
            updateInterpretationCard(parishProps ? null : props);

            // Perfil demográfico renderizado en tarjeta fija por selección


            // Renderizar mini-gráfico Chart.js con doble eje Y (Siniestros vs Fallecidos)
            const hasHistFallecidos = props.fallecidos_historico && Object.keys(props.fallecidos_historico).length > 0;
            const hasHistSiniestros = props.siniestros_historico && Object.keys(props.siniestros_historico).length > 0;
            const hasHistTypes = hasHistoricalTypeData(props);
            syncHistoricalChartViewControls(hasHistTypes);
            const showHistoricalTypes = hasHistTypes && historicalChartView === HISTORICAL_CHART_CONFIG.typeView;

            if (hasHistFallecidos || hasHistSiniestros || hasHistTypes) {
                chartContainer.style.display = "block";
                chartEmptyMsg.style.display = "none";

                const years = ALL_TIMELINE_YEARS.map(String);
                const valSiniestros = years.map(y => props.siniestros_historico && props.siniestros_historico[y] !== undefined ? props.siniestros_historico[y] : null);
                const valFallecidos = years.map(y => props.fallecidos_historico && props.fallecidos_historico[y] !== undefined ? props.fallecidos_historico[y] : null);

                if (historicoChart) {
                    historicoChart.destroy();
                }

                const ctx = document.getElementById('chart-historico').getContext('2d');
                const chartTheme = getAnalysisChartTheme();
                const historicalDatasets = showHistoricalTypes
                    ? buildHistoricalTypeDatasets(props, years, chartTheme)
                    : [
                        {
                            label: 'Siniestros (INEC)',
                            data: valSiniestros,
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.12)',
                            borderWidth: 2,
                            tension: 0.15,
                            fill: true,
                            pointBackgroundColor: '#f59e0b',
                            pointBorderColor: chartTheme.pointOutline,
                            pointRadius: years.map(year => year === String(selectedYear) ? 7 : 3),
                            yAxisID: 'y'
                        },
                        {
                            label: 'Fallecidos (EDG)',
                            data: valFallecidos,
                            borderColor: '#0ea5e9',
                            backgroundColor: 'rgba(14, 165, 233, 0.12)',
                            borderWidth: 2,
                            tension: 0.15,
                            fill: true,
                            pointBackgroundColor: '#0ea5e9',
                            pointBorderColor: chartTheme.pointOutline,
                            pointRadius: years.map(year => year === String(selectedYear) ? 7 : 3),
                            yAxisID: 'y1'
                        }
                    ];
                const selectedYearMarker = {
                    id: "selectedYearMarker",
                    afterDatasetsDraw(chart) {
                        const index = chart.data.labels.indexOf(String(selectedYear));
                        if (index < 0) return;
                        const x = chart.scales.x.getPixelForValue(index);
                        const { top, bottom } = chart.chartArea;
                        const context = chart.ctx;
                        context.save();
                        context.strokeStyle = chartTheme.textPrimary;
                        context.lineWidth = 1;
                        context.setLineDash([3, 3]);
                        context.beginPath();
                        context.moveTo(x, top);
                        context.lineTo(x, bottom);
                        context.stroke();
                        context.restore();
                    }
                };
                historicoChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: years,
                        datasets: historicalDatasets
                    },
                    plugins: [selectedYearMarker],
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false
                        },
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top',
                                labels: {
                                    color: chartTheme.textMuted,
                                    boxWidth: showHistoricalTypes ? 6 : 8,
                                    boxHeight: showHistoricalTypes ? 6 : 4,
                                    usePointStyle: showHistoricalTypes,
                                    font: {
                                        size: showHistoricalTypes ? 8 : 9,
                                        family: 'Inter'
                                    }
                                }
                            },
                            tooltip: {
                                enabled: true,
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                titleColor: '#f8fafc',
                                bodyColor: '#f8fafc',
                                borderColor: 'rgba(255, 255, 255, 0.15)',
                                borderWidth: 1,
                                padding: 8
                            }
                        },
                        scales: {
                            x: {
                                grid: {
                                    color: chartTheme.grid,
                                    drawBorder: false
                                },
                                ticks: {
                                    color: chartTheme.textMuted,
                                    font: {
                                        size: 9,
                                        family: 'Inter'
                                    }
                                }
                            },
                            y: {
                                type: 'linear',
                                display: true,
                                position: 'left',
                                title: {
                                    display: true,
                                    text: showHistoricalTypes ? 'Siniestros por tipo' : 'Siniestros',
                                    color: showHistoricalTypes ? chartTheme.textMuted : '#f59e0b',
                                    font: {
                                        size: 9,
                                        family: 'Inter',
                                        weight: 'bold'
                                    }
                                },
                                grid: {
                                    color: chartTheme.grid,
                                    drawBorder: false
                                },
                                ticks: {
                                    color: showHistoricalTypes ? chartTheme.textMuted : '#f59e0b',
                                    font: {
                                        size: 9,
                                        family: 'Inter'
                                    }
                                },
                                min: 0
                            },
                            y1: {
                                type: 'linear',
                                display: !showHistoricalTypes,
                                position: 'right',
                                title: {
                                    display: true,
                                    text: 'Fallecidos',
                                    color: '#0ea5e9',
                                    font: {
                                        size: 9,
                                        family: 'Inter',
                                        weight: 'bold'
                                    }
                                },
                                grid: {
                                    drawOnChartArea: false
                                },
                                ticks: {
                                    color: '#0ea5e9',
                                    font: {
                                        size: 9,
                                        family: 'Inter'
                                    }
                                },
                                min: 0
                            }
                        }
                    }
                });
            } else {
                if (historicoChart) {
                    historicoChart.destroy();
                    historicoChart = null;
                }
                chartContainer.style.display = "none";
                chartEmptyMsg.style.display = "block";
                chartEmptyMsg.textContent = "Sin datos de serie histórica para este cantón";
            }
            updateTerritoryBreadcrumb();
            window.REDSAExperience?.updateSummary(parishProps || props, selectedYear);
        }

        document.addEventListener("redsa:themechange", () => {
            if (selectedTerritory?.props) updateSidebar(selectedTerritory.props);
            else if (currentProps) updateSidebar(currentProps);
        });
