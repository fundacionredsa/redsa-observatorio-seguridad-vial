(function () {
    const state = {
        context: null,
        cantonFeatures: [],
        selectedProps: null,
        initialized: false
    };

    function normalize(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase();
    }

    function formatNumber(value, digits = 0) {
        return Number(value).toLocaleString("es-EC", {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        });
    }

    function availableAccidentYears(props) {
        return Object.entries(props?.siniestros_historico || {})
            .filter(([, value]) => Number.isFinite(Number(value)))
            .map(([year]) => Number(year))
            .sort((a, b) => a - b);
    }

    function resolveSummaryYear(props, requestedYear) {
        const years = availableAccidentYears(props);
        if (!years.length) return null;
        if (years.includes(Number(requestedYear))) return Number(requestedYear);
        const previous = years.filter(year => year <= Number(requestedYear));
        return previous.length ? previous[previous.length - 1] : years[years.length - 1];
    }

    function rateForFeature(feature, year) {
        const props = feature?.properties || feature || {};
        const accidents = Number(props.siniestros_historico?.[String(year)]);
        const population = Number(props.poblacion_por_anio?.[String(year)]);
        return Number.isFinite(accidents) && population > 0
            ? accidents / population * 100000
            : null;
    }

    function median(values) {
        const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
        if (!sorted.length) return null;
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2
            ? sorted[middle]
            : (sorted[middle - 1] + sorted[middle]) / 2;
    }

    function formatYearCoverage(years) {
        if (!years.length) return "sin años disponibles";
        const groups = [];
        let start = years[0];
        let end = years[0];
        years.slice(1).forEach(year => {
            if (year === end + 1) {
                end = year;
                return;
            }
            groups.push(start === end ? `${start}` : `${start}-${end}`);
            start = year;
            end = year;
        });
        groups.push(start === end ? `${start}` : `${start}-${end}`);
        return groups.join(", ");
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function populateSearch() {
        const datalist = document.getElementById("territory-search-list");
        if (!datalist) return;
        datalist.innerHTML = "";
        state.cantonFeatures
            .slice()
            .sort((a, b) => String(a.properties?.DPA_DESCAN || "").localeCompare(String(b.properties?.DPA_DESCAN || ""), "es"))
            .forEach(feature => {
                const props = feature.properties || {};
                const option = document.createElement("option");
                option.value = `${props.DPA_DESCAN} — ${props.DPA_DESPRO}`;
                option.dataset.code = props.DPA_CANTON;
                datalist.appendChild(option);
            });
    }

    function findCanton(query) {
        const rawParts = String(query || "").split(/\s+[—-]\s+/);
        const cantonQuery = normalize(rawParts[0]);
        const provinceQuery = normalize(rawParts[1]);
        const canonicalCanton = value => normalize(value).replace(/^distrito metropolitano de\s+/, "");
        const canonicalMatches = state.cantonFeatures.filter(feature => {
            const props = feature.properties || {};
            return canonicalCanton(props.DPA_DESCAN) === cantonQuery
                && (!provinceQuery || normalize(props.DPA_DESPRO) === provinceQuery);
        });
        if (canonicalMatches.length === 1) return canonicalMatches[0];

        const normalizedQuery = normalize(query).replace(/\s+[—-]\s+/g, " ");
        if (!normalizedQuery) return null;
        const exact = state.cantonFeatures.filter(feature => {
            const props = feature.properties || {};
            const canton = normalize(props.DPA_DESCAN);
            const combined = normalize(`${props.DPA_DESCAN} ${props.DPA_DESPRO}`);
            return canton === normalizedQuery || combined === normalizedQuery;
        });
        if (exact.length === 1) return exact[0];
        const partial = state.cantonFeatures.filter(feature => {
            const props = feature.properties || {};
            return normalize(`${props.DPA_DESCAN} ${props.DPA_DESPRO}`).includes(normalizedQuery);
        });
        return partial.length === 1 ? partial[0] : null;
    }

    function selectFromSearch() {
        const input = document.getElementById("territory-search-input");
        const status = document.getElementById("territory-search-status");
        const feature = findCanton(input?.value);
        if (!feature) {
            if (status) status.textContent = "No encontramos un cantón único. Escribe también la provincia.";
            return false;
        }
        if (status) status.textContent = "";
        input.value = `${feature.properties.DPA_DESCAN} — ${feature.properties.DPA_DESPRO}`;
        state.context?.selectCanton?.(feature.properties.DPA_CANTON);
        return true;
    }

    function updateMapContext(config, year, levelLabel) {
        const title = document.getElementById("citizen-map-variable");
        const description = document.getElementById("citizen-map-description");
        if (!title || !description || !config) return;
        const yearLabel = config.temporal?.tipo === "anual" && year ? ` · ${year}` : "";
        const level = levelLabel ? ` · ${levelLabel}` : "";
        title.textContent = `${config.label}${yearLabel}${level}`;
        description.textContent = config.description;
    }

    function updateSummary(props, requestedYear) {
        const summary = document.getElementById("citizen-summary");
        const panel = document.getElementById("citizen-panel");
        const downloadButton = document.getElementById("download-summary-button");
        if (!summary) return;

        state.selectedProps = props || null;
        panel?.classList.toggle("has-selection", Boolean(props));
        if (!props) {
            summary.innerHTML = `<p class="citizen-summary-empty">Busca tu cantón para ver los accidentes reportados, su evolución y una comparación orientativa con el país.</p>`;
            if (downloadButton) downloadButton.disabled = true;
            return;
        }

        const name = props.DPA_DESPAR || props.DPA_DESCAN || props.DPA_DESPRO || "Territorio";
        const level = props.DPA_DESPAR ? "Parroquia" : (props.nivel_agregacion === "provincia" ? "Provincia" : "Cantón");
        const province = props.DPA_DESPRO || "";
        const year = resolveSummaryYear(props, requestedYear);
        const accidents = year ? Number(props.siniestros_historico?.[String(year)]) : null;
        const population = year ? Number(props.poblacion_por_anio?.[String(year)]) : null;
        const rate = year ? rateForFeature(props, year) : null;
        const years = availableAccidentYears(props);
        const previousYear = year ? years.filter(candidate => candidate < year).at(-1) : null;
        const previousAccidents = previousYear ? Number(props.siniestros_historico?.[String(previousYear)]) : null;
        const change = Number.isFinite(accidents) && Number.isFinite(previousAccidents) && previousAccidents > 0
            ? (accidents - previousAccidents) / previousAccidents * 100
            : null;
        const nationalMedian = year
            ? median(state.cantonFeatures.map(feature => rateForFeature(feature, year)))
            : null;
        const historicalTotal = years.reduce((total, candidate) => {
            const value = Number(props.siniestros_historico?.[String(candidate)]);
            return Number.isFinite(value) ? total + value : total;
        }, 0);
        const currentShare = Number.isFinite(accidents) && historicalTotal > 0
            ? accidents / historicalTotal * 100
            : null;

        let comparison = "No hay una serie comparable suficiente para este territorio.";
        if (Number.isFinite(rate) && Number.isFinite(nationalMedian)) {
            const direction = rate > nationalMedian ? "por encima" : (rate < nationalMedian ? "por debajo" : "en línea");
            comparison = `La tasa está ${direction} de la mediana de los cantones del país (${formatNumber(nationalMedian, 1)} por cada 100.000 habitantes).`;
        }
        if (Number.isFinite(change)) {
            const movement = change > 0 ? "aumentó" : (change < 0 ? "disminuyó" : "no cambió");
            comparison += ` Frente a ${previousYear}, el número reportado ${movement} ${formatNumber(Math.abs(change), 1)}%.`;
        }

        summary.innerHTML = `
            <div class="citizen-summary-title">${name} <span style="font-weight:500;">(${level})</span></div>
            <div class="citizen-summary-province">${province}${year ? ` · datos ${year}` : ""}</div>
            <div class="citizen-summary-metrics">
                <div class="citizen-summary-metric">
                    <strong>${Number.isFinite(accidents) ? formatNumber(accidents) : "Sin dato"}</strong>
                    <span>accidentes reportados${year ? ` en ${year}` : ""}</span>
                </div>
                <div class="citizen-summary-metric">
                    <strong>${Number.isFinite(rate) ? formatNumber(rate, 1) : "Sin dato"}</strong>
                    <span>por cada 100.000 habitantes</span>
                </div>
            </div>
            <div class="citizen-summary-history">
                <strong>Histórico disponible: ${formatNumber(historicalTotal)} accidentes</strong>
                <span>${formatYearCoverage(years)} (${years.length} ${years.length === 1 ? "año con dato" : "años con datos"})${Number.isFinite(currentShare) ? ` · ${year} representa ${formatNumber(currentShare, 1)}% del acumulado` : ""}.</span>
            </div>
            <p class="citizen-comparison">${comparison}</p>
        `;
        if (downloadButton) downloadButton.disabled = false;
    }

    function reportMetric(label, value) {
        return `<div class="pdf-report-metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
    }

    async function captureMapImage() {
        const map = document.getElementById("map");
        if (!map || typeof window.html2canvas !== "function") return null;
        const canvas = await window.html2canvas(map, {
            backgroundColor: "#f8fafc",
            useCORS: true,
            allowTaint: false,
            logging: false,
            scale: 1,
            ignoreElements: element => element.matches?.(".leaflet-control-zoom, .opacity-control, .basemap-control, .mobile-nav-toggle")
        });
        return canvas.toDataURL("image/jpeg", 0.9);
    }

    function buildReportNode(props, year, mapImage) {
        const name = props.DPA_DESPAR || props.DPA_DESCAN || props.DPA_DESPRO || "Territorio";
        const level = props.DPA_DESPAR ? "Parroquia" : (props.nivel_agregacion === "provincia" ? "Provincia" : "Cantón");
        const years = availableAccidentYears(props);
        const accidents = Number(props.siniestros_historico?.[String(year)]);
        const deaths = Number(props.fallecidos_historico?.[String(year)]);
        const population = Number(props.poblacion_por_anio?.[String(year)]);
        const rate = rateForFeature(props, year);
        const historicalTotal = years.reduce((total, candidate) => {
            const value = Number(props.siniestros_historico?.[String(candidate)]);
            return Number.isFinite(value) ? total + value : total;
        }, 0);
        const historyRows = years.map(candidate => {
            const accidentValue = Number(props.siniestros_historico?.[String(candidate)]);
            const deathValue = Number(props.fallecidos_historico?.[String(candidate)]);
            return `<tr><td>${candidate}</td><td>${Number.isFinite(accidentValue) ? formatNumber(accidentValue) : "Sin dato"}</td><td>${Number.isFinite(deathValue) ? formatNumber(deathValue) : "Sin dato"}</td></tr>`;
        }).join("");
        const chart = document.getElementById("chart-historico");
        let chartImage = null;
        try {
            chartImage = chart?.toDataURL("image/png") || null;
        } catch (_) {
            chartImage = null;
        }
        const profileText = document.getElementById("hover-card-body")?.innerText?.trim();
        const report = document.createElement("section");
        report.className = "pdf-report-sheet";
        report.setAttribute("aria-hidden", "true");
        report.innerHTML = `
            <div class="pdf-report-kicker">Fundación REDSA · Observatorio Ciudadano de Seguridad Vial</div>
            <h1>Ficha técnica territorial</h1>
            <p class="pdf-report-context"><strong>${escapeHtml(name)}</strong> · ${escapeHtml(level)} · ${escapeHtml(props.DPA_DESPRO || "Ecuador")} · año seleccionado ${escapeHtml(year || "sin dato")}</p>
            <div class="pdf-report-metrics">
                ${reportMetric("Accidentes reportados", Number.isFinite(accidents) ? formatNumber(accidents) : "Sin dato")}
                ${reportMetric("Personas fallecidas (registro civil)", Number.isFinite(deaths) ? formatNumber(deaths) : "Sin dato")}
                ${reportMetric("Población", Number.isFinite(population) ? formatNumber(population) : "Sin dato")}
                ${reportMetric("Accidentes por 100.000 habitantes", Number.isFinite(rate) ? formatNumber(rate, 1) : "Sin dato")}
            </div>
            <p><strong>Dimensión histórica:</strong> ${formatNumber(historicalTotal)} accidentes acumulados en ${formatYearCoverage(years)}. Los años ausentes no se imputan ni se cuentan como cero.</p>
            ${mapImage ? `<h2>Ubicación y mapa de referencia</h2><img class="pdf-report-image" src="${mapImage}" alt="Mapa de ${escapeHtml(name)}">` : ""}
            ${chartImage ? `<h2>Tendencia histórica</h2><img class="pdf-report-image" src="${chartImage}" alt="Gráfico de tendencia histórica">` : ""}
            <h2>Serie disponible</h2>
            <table class="pdf-report-history"><thead><tr><th>Año</th><th>Accidentes reportados (INEC)</th><th>Personas fallecidas (INEC EDG)</th></tr></thead><tbody>${historyRows}</tbody></table>
            ${profileText ? `<h2>Perfil de personas fallecidas</h2><p>${escapeHtml(profileText).replace(/\n/g, "<br>")}</p>` : ""}
            <h2>Fuentes, metodología y trazabilidad</h2>
            <div class="pdf-report-sources">
                <p><strong>Accidentes:</strong> INEC, Estadísticas de Transporte (ESTRA), registros oficiales agregados territorialmente.</p>
                <p><strong>Personas fallecidas:</strong> INEC, Estadísticas de Defunciones Generales (EDG), causas CIE-10 V01-V89. EDG registra el lugar de fallecimiento, que no necesariamente coincide con el lugar del siniestro.</p>
                <p><strong>Límites:</strong> INEC/CONALI vía datosabiertos.gob.ec, licencia CC BY.</p>
                <p><strong>Tratamiento:</strong> Fundación REDSA. Las tasas se calculan como numerador / población del mismo año × 100.000. Los datos faltantes se declaran como “sin dato”.</p>
                <p><strong>Metodología y datos auditables:</strong> ${escapeHtml(new URL("metodologia/", window.location.href).href)} · ${escapeHtml(new URL("data/catalogo_metadatos.json", window.location.href).href)}</p>
                <p><strong>Cita sugerida:</strong> Fundación REDSA (${new Date().getFullYear()}). Observatorio Ciudadano de Seguridad Vial y Movilidad Sostenible. Consulta: ${new Date().toLocaleDateString("es-EC")}.</p>
            </div>
        `;
        document.body.appendChild(report);
        return report;
    }

    function saveCanvasAsPdf(canvas, filename) {
        const JsPDF = window.jspdf?.jsPDF;
        if (!JsPDF) throw new Error("No se cargó el generador PDF");
        const pdf = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const margin = 8;
        const contentWidth = 210 - margin * 2;
        const pageHeight = 297 - margin * 2;
        const pixelsPerMm = canvas.width / contentWidth;
        const sliceHeight = Math.floor(pageHeight * pixelsPerMm);
        let sourceY = 0;
        let page = 0;
        while (sourceY < canvas.height) {
            const height = Math.min(sliceHeight, canvas.height - sourceY);
            const slice = document.createElement("canvas");
            slice.width = canvas.width;
            slice.height = height;
            slice.getContext("2d").drawImage(canvas, 0, sourceY, canvas.width, height, 0, 0, canvas.width, height);
            if (page > 0) pdf.addPage();
            pdf.addImage(slice.toDataURL("image/jpeg", 0.9), "JPEG", margin, margin, contentWidth, height / pixelsPerMm);
            sourceY += height;
            page += 1;
        }
        pdf.save(filename);
    }

    async function downloadSummary() {
        const props = state.selectedProps;
        if (!props) return;
        const button = document.getElementById("download-summary-button");
        const status = document.getElementById("territory-search-status");
        const year = resolveSummaryYear(props, state.context?.getSelectedYear?.());
        const name = props.DPA_DESPAR || props.DPA_DESCAN || props.DPA_DESPRO;
        let report = null;
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Generando ficha…';
        }
        try {
            const mapImage = await captureMapImage();
            report = buildReportNode(props, year, mapImage);
            await Promise.all(Array.from(report.querySelectorAll("img")).map(image => image.complete ? Promise.resolve() : new Promise(resolve => {
                image.addEventListener("load", resolve, { once: true });
                image.addEventListener("error", resolve, { once: true });
            })));
            const canvas = await window.html2canvas(report, { backgroundColor: "#ffffff", scale: 1.5, logging: false });
            const slug = normalize(name).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
            saveCanvasAsPdf(canvas, `redsa_ficha_${slug}_${year || "sin_anio"}.pdf`);
            if (status) status.textContent = "Ficha PDF generada en tu dispositivo; no se almacenó en el portal.";
        } catch (error) {
            console.error(error);
            if (status) status.textContent = "No se pudo generar la ficha PDF. Inténtalo nuevamente cuando el mapa termine de cargar.";
        } finally {
            report?.remove();
            if (button) {
                button.disabled = false;
                button.innerHTML = '<i class="fa-solid fa-file-pdf" aria-hidden="true"></i> Descargar ficha PDF';
            }
        }
    }

    function init(context) {
        if (state.initialized) return;
        state.initialized = true;
        state.context = context;
        state.cantonFeatures = context.cantonFeatures || [];
        populateSearch();

        const form = document.getElementById("territory-search-form");
        const input = document.getElementById("territory-search-input");
        form?.addEventListener("submit", event => {
            event.preventDefault();
            selectFromSearch();
        });
        input?.addEventListener("change", selectFromSearch);
        document.getElementById("open-analysis-button")?.addEventListener("click", () => context.openAnalysis?.());
        document.getElementById("download-summary-button")?.addEventListener("click", downloadSummary);
        updateSummary(null, context.getSelectedYear?.());

        window.__redsaExperienceAudit = {
            search(query) {
                const feature = findCanton(query);
                return feature ? feature.properties.DPA_CANTON : null;
            },
            state() {
                return {
                    initialized: state.initialized,
                    cantonOptions: state.cantonFeatures.length,
                    selectedCanton: state.selectedProps?.DPA_CANTON || null,
                    selectedName: state.selectedProps?.DPA_DESCAN || state.selectedProps?.DPA_DESPRO || null
                };
            }
        };
    }

    window.REDSAExperience = Object.freeze({
        init,
        updateMapContext,
        updateSummary
    });
})();
