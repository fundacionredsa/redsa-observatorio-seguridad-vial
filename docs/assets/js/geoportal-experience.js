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
        const shareButton = document.getElementById("share-view-button");
        const downloadButton = document.getElementById("download-summary-button");
        if (!summary) return;

        state.selectedProps = props || null;
        panel?.classList.toggle("has-selection", Boolean(props));
        if (!props) {
            summary.innerHTML = `<p class="citizen-summary-empty">Busca tu cantón para ver los accidentes reportados, su evolución y una comparación orientativa con el país.</p>`;
            if (shareButton) shareButton.disabled = true;
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
            <p class="citizen-comparison">${comparison}</p>
        `;
        if (shareButton) shareButton.disabled = false;
        if (downloadButton) downloadButton.disabled = false;
    }

    async function shareCurrentView() {
        if (!state.selectedProps) return;
        const status = document.getElementById("territory-search-status");
        const url = window.location.href;
        try {
            await navigator.clipboard.writeText(url);
            if (status) status.textContent = "Enlace de esta vista copiado.";
        } catch (error) {
            if (status) status.textContent = `Comparte este enlace: ${url}`;
        }
    }

    function csvCell(value) {
        return `"${String(value ?? "").replace(/"/g, '""')}"`;
    }

    function downloadSummary() {
        const props = state.selectedProps;
        if (!props) return;
        const year = resolveSummaryYear(props, state.context?.getSelectedYear?.());
        const fields = [
            ["nivel", props.DPA_DESPAR ? "parroquia" : (props.nivel_agregacion === "provincia" ? "provincia" : "canton")],
            ["territorio", props.DPA_DESPAR || props.DPA_DESCAN || props.DPA_DESPRO],
            ["provincia", props.DPA_DESPRO],
            ["anio", year],
            ["poblacion", props.poblacion_por_anio?.[String(year)]],
            ["siniestros_reportados", props.siniestros_historico?.[String(year)]],
            ["fallecidos_registro_civil", props.fallecidos_historico?.[String(year)]],
            ["tasa_siniestros_100k", rateForFeature(props, year)]
        ];
        const csv = `${fields.map(([key]) => csvCell(key)).join(",")}\n${fields.map(([, value]) => csvCell(value)).join(",")}\n`;
        const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `redsa_${normalize(props.DPA_DESPAR || props.DPA_DESCAN || props.DPA_DESPRO).replace(/\s+/g, "_")}_${year || "sin_anio"}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);
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
        document.getElementById("share-view-button")?.addEventListener("click", shareCurrentView);
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
