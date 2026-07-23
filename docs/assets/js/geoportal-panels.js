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

        // Configuración de aviso de cabecera
        const CABECERA_SUFFIX = "50";
        const MENSAJE_CABECERA = "Este polígono agrupa varias parroquias urbanas de {DPA_DESCAN} en la geometría histórica INEC 2014 disponible para esta capa. La cifra mostrada es la suma de todas ellas, no de una sola parroquia.";

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

        function availableYears(series) {
            return Object.keys(series || {})
                .filter(year => /^\d{4}$/.test(year) && series[year] !== null && series[year] !== undefined)
                .sort((a, b) => Number(a) - Number(b));
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
                return `<span class="sigla-tooltip-trigger" data-sigla="${sigla}" data-custom-text="${encodedText}">ⓘ</span>`;
            }
            return `<span class="sigla-tooltip-trigger" data-sigla="${sigla}">ⓘ</span>`;
        }

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

        function isVisibleElement(el) {
            if (!el) return false;
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return style.display !== "none"
                && style.visibility !== "hidden"
                && rect.width > 0
                && rect.height > 0
                && rect.right > 0
                && rect.bottom > 0
                && rect.left < window.innerWidth
                && rect.top < window.innerHeight;
        }

        function updateProfileCardLayout() {
            const card = document.getElementById("demographic-hover-card");
            if (!card || card.style.display === "none") return;

            const root = document.documentElement;
            const safetyMargin = 16;
            const viewportMargin = 12;
            const minUsableWidth = 320;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const legend = document.querySelector(".legend-panel");
            const layerSelector = document.querySelector(".basemap-control");
            const selector = document.querySelector(".map-selector-control");
            const attribution = document.querySelector(".leaflet-control-attribution");
            const sidebar = document.querySelector(".sidebar");
            const citizenPanel = document.querySelector(".citizen-panel");
            const technicalDrawer = document.querySelector(".technical-drawer");

            root.style.removeProperty("--perfil-card-max-height");
            const configuredMaxHeight = parseFloat(
                window.getComputedStyle(root).getPropertyValue("--perfil-card-max-height")
            );
            card.style.bottom = `${viewportMargin}px`;
            card.style.left = `${viewportMargin}px`;
            card.style.width = "";
            const legendVisible = isVisibleElement(legend);
            const legendRect = legendVisible ? legend.getBoundingClientRect() : null;
            const layerSelectorVisible = isVisibleElement(layerSelector);
            const layerSelectorRect = layerSelectorVisible ? layerSelector.getBoundingClientRect() : null;
            const selectorVisible = isVisibleElement(selector);
            const selectorRect = selectorVisible ? selector.getBoundingClientRect() : null;
            const attributionVisible = isVisibleElement(attribution);
            const attributionRect = attributionVisible ? attribution.getBoundingClientRect() : null;
            const sidebarRequestedOpen = document.body.classList.contains("mobile-sidebar-open");
            const sidebarVisible = sidebarRequestedOpen || isVisibleElement(sidebar);
            const sidebarRect = sidebarVisible ? sidebar.getBoundingClientRect() : null;
            const citizenPanelVisible = isVisibleElement(citizenPanel);
            const citizenPanelRect = citizenPanelVisible ? citizenPanel.getBoundingClientRect() : null;
            const technicalDrawerRequestedOpen = document.body.classList.contains("mobile-layers-open")
                || document.body.classList.contains("technical-drawer-open");
            const technicalDrawerVisible = technicalDrawerRequestedOpen || isVisibleElement(technicalDrawer);
            const technicalDrawerRect = technicalDrawerVisible ? technicalDrawer.getBoundingClientRect() : null;

            let bottomOffset = attributionVisible
                ? Math.max(viewportMargin, viewportHeight - attributionRect.top + viewportMargin)
                : viewportMargin;
            let leftBoundary = viewportMargin;
            let rightBoundary = viewportWidth;
            let technicalDrawerBoundary = viewportWidth;

            if (sidebarVisible) {
                const sidebarBoundary = sidebarRequestedOpen ? sidebarRect.width : sidebarRect.right;
                leftBoundary = Math.max(leftBoundary, sidebarBoundary + safetyMargin);
            }
            if (citizenPanelVisible && !sidebarVisible) {
                leftBoundary = Math.max(leftBoundary, citizenPanelRect.right + safetyMargin);
            }

            if (legendVisible) {
                rightBoundary = Math.min(rightBoundary, legendRect.left);
            }
            if (layerSelectorVisible) {
                rightBoundary = Math.min(rightBoundary, layerSelectorRect.left);
            }
            if (technicalDrawerVisible) {
                technicalDrawerBoundary = technicalDrawerRequestedOpen
                    ? viewportWidth - technicalDrawerRect.width
                    : technicalDrawerRect.left;
                rightBoundary = Math.min(rightBoundary, technicalDrawerBoundary);
            }

            if (rightBoundary - leftBoundary < minUsableWidth) {
                rightBoundary = Math.min(
                    viewportWidth,
                    technicalDrawerBoundary,
                    layerSelectorVisible ? layerSelectorRect.left : viewportWidth
                );
                if (legendVisible) {
                    bottomOffset = Math.max(
                        bottomOffset,
                        viewportHeight - legendRect.top + safetyMargin
                    );
                }
            }

            const availableWidth = Math.max(
                180,
                rightBoundary - leftBoundary - (rightBoundary < viewportWidth ? safetyMargin : viewportMargin)
            );
            const width = Math.floor(availableWidth);
            const selectorOverlapsPanel = selectorVisible
                && selectorRect.right > leftBoundary
                && selectorRect.left < rightBoundary;
            const selectorBottom = selectorOverlapsPanel ? selectorRect.bottom : 0;
            const availableHeight = viewportHeight - selectorBottom - bottomOffset - safetyMargin;
            const maxHeight = Math.floor(Math.max(100, Math.min(configuredMaxHeight, availableHeight)));

            root.style.setProperty("--perfil-card-left", `${Math.floor(leftBoundary)}px`);
            root.style.setProperty("--perfil-card-width", `${width}px`);
            root.style.setProperty("--perfil-card-max-height", `${maxHeight}px`);
            card.style.left = `${Math.floor(leftBoundary)}px`;
            card.style.width = `${width}px`;
            card.style.bottom = `${Math.floor(bottomOffset)}px`;

            const renderedRect = card.getBoundingClientRect();
            const maxPanelBottom = viewportHeight - viewportMargin;
            if (renderedRect.bottom > maxPanelBottom) {
                bottomOffset += renderedRect.bottom - maxPanelBottom;
                card.style.bottom = `${Math.ceil(bottomOffset)}px`;
            }
        }

        // --- TARJETA FIJA DE LA UNIDAD SELECCIONADA ---

        function showProfileCard(props, e) {
            const card = document.getElementById("demographic-hover-card");
            const body = document.getElementById("hover-card-body");
            const title = document.getElementById("hover-card-title");

            if (!card || !body || !title) return;
            currentProfileProps = props;
            const periodBadge = document.getElementById("hover-card-period");
            if (periodBadge) periodBadge.textContent = selectedDetailPeriodMode === "accumulated" ? "Histórico" : String(selectedYear);

            // Fixed lower panel; dynamic sizing prevents overlap with map controls.
            card.style.display = "block";
            document.body.classList.add("profile-selection-active");

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
                updateProfileCardLayout();
                window.requestAnimationFrame(updateProfileCardLayout);
                window.setTimeout(updateProfileCardLayout, 120);
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
                    <span class="profile-card-citizen-title">¿Quiénes fallecieron en siniestros de tránsito aquí? (${edgPeriod})</span>
                    <span class="profile-card-source-detail">Personas fallecidas en accidentes de tránsito, según registro civil (INEC ${siglaInfoIcon("INEC")}). Los iconos ⓘ explican los códigos técnicos: EDG ${siglaInfoIcon("EDG")} y CIE-10 ${siglaInfoIcon("CIE-10")} V01-V89.</span>
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
                    <span class="profile-card-citizen-title">Fallecidos registrados en reclamaciones del seguro (${sppatPeriod})</span>
                    <span class="profile-card-source-detail">Fuente: Servicio Público para Pago de Accidentes de Tránsito (SPPAT ${siglaInfoIcon("SPPAT")}).</span>
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
            updateProfileCardLayout();
            window.requestAnimationFrame(updateProfileCardLayout);
            window.setTimeout(updateProfileCardLayout, 120);
        }

        // Ajustar la tarjeta seleccionada al cambiar el viewport
        document.addEventListener("DOMContentLoaded", () => {
            const hoverCard = document.getElementById("demographic-hover-card");
            if (hoverCard) {
                window.addEventListener("resize", updateProfileCardLayout);
            }
            document.getElementById("profile-card-close")?.addEventListener("click", clearTerritorySelection);
        });

        let currentProps = null;
        let currentProfileProps = null;

        document.addEventListener("click", event => {
            const button = event.target.closest("[data-detail-period-mode]");
            if (!button) return;
            selectedDetailPeriodMode = button.dataset.detailPeriodMode;
            updateDetailPeriodControls();
            if (currentProps) updateSidebar(currentProps);
            if (currentProfileProps) showProfileCard(currentProfileProps, null);
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
                ? availableYears(props.siniestros_historico)
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

            let mergedZona = {};
            let mergedClase = {};
            let mergedCausa = {};
            let mergedHorario = {};

            yearsToProcess.forEach(yr => {
                totalSiniestros += props.siniestros_historico[yr] || 0;

                const res = props.inec_resumen_historico && props.inec_resumen_historico[yr];
                if (res) {
                    totalLesionados += res.lesionados || 0;
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

            domLesionadosInec.textContent = totalLesionados.toLocaleString('de-DE');
            domLesionadosInec.classList.remove("empty");

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

            let parishProps = null;
            if (props && props.DPA_PARROQ) {
                parishProps = props;
                props = getCantonProps(parishProps.DPA_CANTON);
            }

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
                window.REDSAExperience?.updateSummary(null, selectedYear);
                return;
            }

            const isProvinceProps = props.nivel_agregacion === "provincia";

            domCanton.textContent = isProvinceProps ? `${props.DPA_DESPRO} (Provincia)` : (props.DPA_DESCAN || "Sin Nombre");
            domCanton.classList.remove("empty");

            domProvincia.textContent = props.DPA_DESPRO || "Sin Nombre";
            domProvincia.classList.remove("empty");

            if (isProvinceProps && domWarningBox) {
                domWarningBox.textContent = "Agregado provincial derivado de cantones. Algunos años pueden tener cobertura parcial; ver metadatos cobertura_datos en provincias_wgs84.geojson.";
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
                ? availableYears(props.siniestros_historico)
                : [yearKey].filter(year => props.siniestros_historico?.[year] !== undefined);
            document.getElementById("siniestros-section-year").textContent = selectedDetailPeriodMode === "accumulated" ? formatPeriodYears(inecYears) : yearKey;
            renderSiniestrosSection(props, selectedYear);
            updateInterpretationCard(parishProps ? null : props);

            // Perfil demográfico renderizado en tarjeta fija por selección


            // Renderizar mini-gráfico Chart.js con doble eje Y (Siniestros vs Fallecidos)
            const hasHistFallecidos = props.fallecidos_historico && Object.keys(props.fallecidos_historico).length > 0;
            const hasHistSiniestros = props.siniestros_historico && Object.keys(props.siniestros_historico).length > 0;

            if (hasHistFallecidos || hasHistSiniestros) {
                chartContainer.style.display = "block";
                chartEmptyMsg.style.display = "none";

                const years = ALL_TIMELINE_YEARS.map(String);
                const valSiniestros = years.map(y => props.siniestros_historico && props.siniestros_historico[y] !== undefined ? props.siniestros_historico[y] : null);
                const valFallecidos = years.map(y => props.fallecidos_historico && props.fallecidos_historico[y] !== undefined ? props.fallecidos_historico[y] : null);

                if (historicoChart) {
                    historicoChart.destroy();
                }

                const ctx = document.getElementById('chart-historico').getContext('2d');
                const selectedYearMarker = {
                    id: "selectedYearMarker",
                    afterDatasetsDraw(chart) {
                        const index = chart.data.labels.indexOf(String(selectedYear));
                        if (index < 0) return;
                        const x = chart.scales.x.getPixelForValue(index);
                        const { top, bottom } = chart.chartArea;
                        const context = chart.ctx;
                        context.save();
                        context.strokeStyle = "#f8fafc";
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
                        datasets: [
                            {
                                label: 'Siniestros (INEC)',
                                data: valSiniestros,
                                borderColor: '#f59e0b',
                                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                borderWidth: 2,
                                tension: 0.15,
                                fill: true,
                                pointBackgroundColor: '#f59e0b',
                                pointBorderColor: '#f8fafc',
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
                                pointBorderColor: '#f8fafc',
                                pointRadius: years.map(year => year === String(selectedYear) ? 7 : 3),
                                yAxisID: 'y1'
                            }
                        ]
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
                                    color: '#94a3b8',
                                    boxWidth: 8,
                                    boxHeight: 4,
                                    font: {
                                        size: 9,
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
                                    color: 'rgba(255, 255, 255, 0.05)',
                                    drawBorder: false
                                },
                                ticks: {
                                    color: '#94a3b8',
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
                                    text: 'Siniestros',
                                    color: '#f59e0b',
                                    font: {
                                        size: 9,
                                        family: 'Inter',
                                        weight: 'bold'
                                    }
                                },
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.05)',
                                    drawBorder: false
                                },
                                ticks: {
                                    color: '#f59e0b',
                                    font: {
                                        size: 9,
                                        family: 'Inter'
                                    }
                                },
                                min: 0
                            },
                            y1: {
                                type: 'linear',
                                display: true,
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
            window.REDSAExperience?.updateSummary(props, selectedYear);
        }
