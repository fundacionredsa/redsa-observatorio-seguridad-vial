(function () {
    const state = {
        context: null,
        provinceFeatures: [],
        cantonFeatures: [],
        parishFeatures: [],
        parishLoadPromise: null,
        selectedProps: null,
        initialized: false
    };

    const SEARCH_LEVELS = Object.freeze({
        province: {
            featuresKey: "provinceFeatures",
            label: "Provincia",
            pluralLabel: "provincias",
            nameField: "DPA_DESPRO",
            codeField: "DPA_PROVIN",
            contextFields: []
        },
        canton: {
            featuresKey: "cantonFeatures",
            label: "Cantón",
            pluralLabel: "cantones",
            nameField: "DPA_DESCAN",
            codeField: "DPA_CANTON",
            contextFields: ["DPA_DESPRO"]
        },
        parish: {
            featuresKey: "parishFeatures",
            label: "Parroquia",
            pluralLabel: "parroquias",
            nameField: "DPA_DESPAR",
            codeField: "DPA_PARROQ",
            contextFields: ["DPA_DESCAN", "DPA_DESPRO"]
        }
    });

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

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function finiteNumber(value) {
        if (value === null || value === undefined || value === "") return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function seriesYears(props) {
        return [...new Set([
            ...Object.keys(props?.siniestros_historico || {}),
            ...Object.keys(props?.fallecidos_historico || {})
        ])].map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    }

    function completeTimelineYears(props, consultedYear) {
        const available = seriesYears(props);
        const currentYear = new Date().getFullYear();
        const firstYear = available.length ? available[0] : currentYear;
        const lastYear = Math.max(currentYear, Number(consultedYear) || currentYear);
        return Array.from({ length: Math.max(1, lastYear - firstYear + 1) }, (_, index) => firstYear + index);
    }

    function sumSeries(series) {
        return Object.values(series || {}).reduce((total, value) => {
            const parsed = finiteNumber(value);
            return parsed === null ? total : total + parsed;
        }, 0);
    }

    function sumSeriesForYears(series, years) {
        return (years || []).reduce((total, year) => {
            const value = finiteNumber(series?.[String(year)]);
            return value === null ? total : total + value;
        }, 0);
    }

    function coverageYears(series) {
        return Object.entries(series || {})
            .filter(([, value]) => finiteNumber(value) !== null)
            .map(([year]) => Number(year))
            .filter(Number.isFinite)
            .sort((a, b) => a - b);
    }

    function latestAvailable(series, requestedYear = Infinity) {
        const entries = Object.entries(series || {})
            .map(([year, value]) => ({ year: Number(year), value: finiteNumber(value) }))
            .filter(entry => Number.isFinite(entry.year) && entry.value !== null && entry.year <= Number(requestedYear))
            .sort((a, b) => b.year - a.year);
        return entries[0] || null;
    }

    function latestDetailedAvailable(series, requestedYear = Infinity) {
        const entries = Object.entries(series || {})
            .map(([year, value]) => ({ year: Number(year), value }))
            .filter(entry => Number.isFinite(entry.year)
                && entry.year <= Number(requestedYear)
                && entry.value?.estado !== "sin_dato"
                && (Number(entry.value?.total) > 0 || Object.keys(entry.value?.categorias || {}).length > 0))
            .sort((a, b) => b.year - a.year);
        return entries[0] || null;
    }

    function periodLabel(requestedYear, availableYear, latestOfficialYear) {
        if (!Number.isFinite(availableYear)) return `Periodo ${requestedYear}: sin dato disponible en la fuente oficial`;
        const latest = availableYear === latestOfficialYear ? " · último disponible en fuentes oficiales" : "";
        if (availableYear === requestedYear) return `Periodo ${availableYear}${latest}`;
        return `Periodo ${requestedYear}: sin dato disponible · se muestra ${availableYear}${latest}`;
    }

    function metricPeriodLabel(requestedYear, availableYear, source) {
        if (!Number.isFinite(availableYear)) return `${requestedYear}: sin dato\nFuente: ${source}`;
        if (availableYear === requestedYear) return `Periodo ${availableYear}\nÚltimo oficial · ${source}`;
        return `${requestedYear}: sin dato\nÚltimo oficial: ${availableYear} · ${source}`;
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

    function searchEntry(level, feature) {
        const levelConfig = SEARCH_LEVELS[level];
        const props = feature?.properties || {};
        const name = props[levelConfig.nameField];
        const context = levelConfig.contextFields.map(field => props[field]).filter(Boolean);
        const display = [name, ...context, levelConfig.label].filter(Boolean).join(" — ");
        const canonicalName = level === "canton"
            ? normalize(name).replace(/^distrito metropolitano de\s+/, "")
            : normalize(name);
        const variants = [
            display,
            name,
            canonicalName,
            [name, ...context].filter(Boolean).join(" "),
            [canonicalName, ...context.map(normalize)].filter(Boolean).join(" ")
        ].map(normalize).filter(Boolean);
        return {
            level,
            feature,
            code: String(props[levelConfig.codeField] || ""),
            display,
            variants: [...new Set(variants)]
        };
    }

    function getSearchEntries() {
        return Object.entries(SEARCH_LEVELS).flatMap(([level, config]) =>
            (state[config.featuresKey] || []).map(feature => searchEntry(level, feature))
        );
    }

    function populateSearch() {
        const datalist = document.getElementById("territory-search-list");
        if (!datalist) return;
        datalist.innerHTML = "";
        getSearchEntries()
            .sort((a, b) => a.display.localeCompare(b.display, "es"))
            .forEach(entry => {
                const option = document.createElement("option");
                option.value = entry.display;
                option.dataset.code = entry.code;
                option.dataset.level = entry.level;
                datalist.appendChild(option);
            });
    }

    function resolveTerritorySearch(query) {
        const normalizedQuery = normalize(query).replace(/\s+[—-]\s+/g, " ");
        if (!normalizedQuery) return { status: "empty", matches: [] };
        const entries = getSearchEntries();
        const displayMatch = entries.filter(entry => normalize(entry.display) === normalize(query));
        if (displayMatch.length === 1) return { status: "resolved", match: displayMatch[0], matches: displayMatch };

        const exact = entries.filter(entry => entry.variants.includes(normalizedQuery));
        if (exact.length === 1) return { status: "resolved", match: exact[0], matches: exact };
        if (exact.length > 1) return { status: "ambiguous", matches: exact };

        const partial = entries.filter(entry => normalize(entry.display).includes(normalizedQuery));
        if (partial.length === 1) return { status: "resolved", match: partial[0], matches: partial };
        return { status: partial.length ? "ambiguous" : "not_found", matches: partial };
    }

    async function ensureParishSearchFeatures() {
        if (state.parishFeatures.length) return state.parishFeatures;
        if (!state.parishLoadPromise) {
            state.parishLoadPromise = Promise.resolve(state.context?.ensureSearchFeatures?.("parish"))
                .then(features => {
                    state.parishFeatures = Array.isArray(features) ? features : [];
                    populateSearch();
                    return state.parishFeatures;
                })
                .finally(() => {
                    state.parishLoadPromise = null;
                });
        }
        return state.parishLoadPromise;
    }

    function updateSearchAdjustmentNotice(level) {
        const note = document.getElementById("territory-search-adjustment-note");
        const searchStatus = document.getElementById("territory-search-status");
        if (!note) return;
        if (!SEARCH_LEVELS[level]) {
            clearSearchAdjustmentNotice();
            return;
        }
        const variable = state.context?.getSelectedVariable?.();
        const config = state.context?.getVariableConfig?.(variable);
        if (variable && variable !== "normal" && config && !config.levels?.includes(level)) {
            const message = `La búsqueda cambió el mapa a ${SEARCH_LEVELS[level].pluralLabel}. Esta variable no tiene datos en ese nivel, por eso mostramos los límites.`;
            note.textContent = message;
            note.hidden = false;
            if (searchStatus) searchStatus.textContent = message;
            return;
        }
        note.textContent = "";
        note.hidden = true;
        if (searchStatus) searchStatus.textContent = "";
    }

    function clearSearchAdjustmentNotice() {
        const note = document.getElementById("territory-search-adjustment-note");
        const searchStatus = document.getElementById("territory-search-status");
        if (!note) return;
        note.textContent = "";
        note.hidden = true;
        if (searchStatus) searchStatus.textContent = "";
    }

    async function selectFromSearch() {
        const input = document.getElementById("territory-search-input");
        const status = document.getElementById("territory-search-status");
        const query = input?.value || "";
        let resolution = resolveTerritorySearch(query);
        if (resolution.status !== "resolved" && !state.parishFeatures.length) {
            if (status) status.textContent = "Buscando también entre las parroquias…";
            try {
                await ensureParishSearchFeatures();
                resolution = resolveTerritorySearch(query);
            } catch (error) {
                console.error("No se pudo ampliar la búsqueda a parroquias:", error);
            }
        }
        if (resolution.status !== "resolved") {
            if (status) {
                status.textContent = resolution.status === "ambiguous"
                    ? "Encontramos varias coincidencias. Elige una opción o escribe también el cantón y la provincia."
                    : "No encontramos ese territorio. Revisa el nombre o elige una opción de la lista.";
            }
            return false;
        }
        const entry = resolution.match;
        if (status) status.textContent = "";
        input.value = entry.display;
        const selected = await state.context?.selectTerritory?.(entry.level, entry.code);
        if (!selected) {
            if (status) status.textContent = "Encontramos el territorio, pero no pudimos abrir su ficha. Inténtalo de nuevo.";
            return false;
        }
        updateSearchAdjustmentNotice(entry.level);
        return selected;
    }

    function updateMapContext(config, year, levelLabel) {
        const title = document.getElementById("citizen-map-variable");
        const metadata = document.getElementById("citizen-map-meta");
        const description = document.getElementById("citizen-map-description");
        if (!title || !metadata || !description || !config) return;
        const periodText = config.temporal?.etiquetas_periodo?.[year] || year;
        const availableYears = config.temporal?.anios_disponibles || [];
        const periodLabel = config.temporal?.tipo === "anual" && year
            ? periodText
            : (availableYears.length === 1 ? String(availableYears[0]) : "");
        const metadataParts = [
            levelLabel ? `Nivel: ${levelLabel}` : "",
            periodLabel ? `Periodo: ${periodLabel}` : "",
            config.fuente ? `Fuente: ${config.fuente}` : ""
        ].filter(Boolean);
        title.textContent = config.displayLabel || config.label;
        metadata.textContent = metadataParts.join(" · ");
        description.textContent = config.description;
        const info = document.getElementById("citizen-map-info");
        if (info) info.dataset.customText = `Fuente: ${config.fuente || "documentada en el catálogo"}. ${config.description}`;
    }

    function formatNationalSummaryValue(summary, config) {
        if (!summary || !Number.isFinite(Number(summary.value))) return null;
        if (config?.aggregation === "sum") return formatNumber(summary.value);
        if (typeof config?.format === "function") return config.format(Number(summary.value));
        return formatNumber(summary.value, Number.isInteger(Number(summary.value)) ? 0 : 1);
    }

    function renderNationalReference() {
        const variable = state.context?.getSelectedVariable?.();
        const config = state.context?.getVariableConfig?.(variable);
        const summary = state.context?.getNationalSummary?.();
        const value = formatNationalSummaryValue(summary, config);
        if (!config || variable === "normal" || value === null) return "";
        const period = state.context?.getActivePeriodLabel?.() || "Periodo no especificado";
        const detail = `Fuente: ${config.fuente || "documentada en el catálogo"}. ${config.description || "La metodología está documentada en el catálogo de datos."}`;
        const infoIcon = `<button type="button" class="sigla-tooltip-trigger citizen-national-info" data-sigla="Referencia nacional" data-custom-text="${escapeHtml(detail)}" aria-label="Fuente y metodología de la referencia nacional">ⓘ</button>`;
        return `
            <section class="citizen-national-reference" aria-label="Referencia nacional de la variable activa">
                <span class="citizen-national-kicker">Referencia nacional</span>
                <strong class="citizen-national-value">${escapeHtml(value)} <span>${escapeHtml(config.unidad || "")}</span></strong>
                <span class="citizen-national-meta">${escapeHtml(period)} ${infoIcon}</span>
            </section>`;
    }

    function updateSummary(props, requestedYear) {
        const summary = document.getElementById("citizen-summary");
        const panel = document.getElementById("citizen-panel");
        const downloadButton = document.getElementById("download-summary-button");
        if (!summary) return;

        state.selectedProps = props || null;
        panel?.classList.toggle("has-selection", Boolean(props));
        if (!props) {
            summary.innerHTML = `${renderNationalReference()}<p class="citizen-summary-empty">Busca una provincia, un cantón o una parroquia para ver sus datos, su evolución y una comparación orientativa con el país.</p>`;
            if (downloadButton) {
                downloadButton.disabled = true;
                downloadButton.hidden = true;
            }
            return;
        }

        const name = props.DPA_DESPAR || props.DPA_DESCAN || props.DPA_DESPRO || "Territorio";
        const level = props.DPA_DESPAR ? "Parroquia" : (props.nivel_agregacion === "provincia" ? "Provincia" : "Cantón");
        const province = props.DPA_DESPRO || "";
        const variable = state.context?.getSelectedVariable?.();
        const config = state.context?.getVariableConfig?.(variable);
        const territorySummary = state.context?.getTerritorySummary?.(props);
        const value = formatNationalSummaryValue(territorySummary, config);
        const period = territorySummary?.period || state.context?.getActivePeriodLabel?.() || requestedYear || "Periodo no especificado";
        const detail = `Fuente: ${config?.fuente || "documentada en el catálogo"}. ${config?.description || "La metodología está documentada en el catálogo de datos."}`;
        const infoIcon = `<button type="button" class="sigla-tooltip-trigger citizen-summary-info" data-sigla="Dato territorial" data-custom-text="${escapeHtml(detail)}" aria-label="Fuente y metodología del dato territorial">ⓘ</button>`;

        summary.innerHTML = `
            <div class="citizen-summary-title">${name} <span style="font-weight:500;">(${level})</span></div>
            <div class="citizen-summary-province">${province}</div>
            <section class="citizen-territory-reference" aria-label="Resumen de la variable activa en el territorio">
                <span class="citizen-national-kicker">${escapeHtml(config?.displayLabel || config?.label || "Variable activa")}</span>
                <strong class="citizen-national-value">${value ?? "Sin dato"} <span>${escapeHtml(config?.unidad || "")}</span></strong>
                <span class="citizen-national-meta">${escapeHtml(period)} ${infoIcon}</span>
            </section>
            ${renderNationalReference()}
        `;
        if (downloadButton) {
            downloadButton.hidden = false;
            downloadButton.disabled = false;
        }
    }

    async function captureMapImage() {
        const map = document.getElementById("map");
        if (!map || typeof window.html2canvas !== "function") return null;
        const canvas = await window.html2canvas(map, {
            backgroundColor: "#f8fafc",
            useCORS: true,
            allowTaint: false,
            logging: false,
            scale: 2,
            ignoreElements: element => element.matches?.("#right-tools-rail, #right-context-host, .opacity-control, .basemap-control, .mobile-nav-toggle")
        });
        return canvas.toDataURL("image/jpeg", 0.9);
    }

    function buildTechnicalPdf(props, year, mapImage) {
        const JsPDF = window.jspdf?.jsPDF;
        if (!JsPDF) throw new Error("No se cargó el generador PDF");
        const pdf = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
        const margin = 14;
        const pageWidth = 210;
        const contentWidth = pageWidth - margin * 2;
        const pageBottom = 278;
        const teal = [7, 93, 102];
        const cyan = [14, 165, 233];
        const orange = [245, 158, 11];
        const ink = [23, 32, 51];
        const muted = [82, 96, 107];
        let y = 14;

        const ensureSpace = height => {
            if (y + height <= pageBottom) return;
            pdf.addPage();
            y = 16;
        };
        const addSection = title => {
            ensureSpace(13);
            pdf.setDrawColor(...teal);
            pdf.setLineWidth(0.8);
            pdf.line(margin, y, margin, y + 7);
            pdf.setTextColor(...ink);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(13);
            pdf.text(title, margin + 4, y + 5.5);
            y += 11;
        };
        const addParagraph = (text, options = {}) => {
            const width = options.width || contentWidth;
            pdf.setFont("helvetica", options.bold ? "bold" : "normal");
            pdf.setFontSize(options.size || 9);
            pdf.setTextColor(...(options.color || muted));
            const lines = pdf.splitTextToSize(String(text), width);
            const height = lines.length * (options.lineHeight || 4.4);
            ensureSpace(height + 2);
            pdf.text(lines, options.x || margin, y);
            y += height + (options.after ?? 2);
        };
        const drawBarList = (title, entries, x, width, color) => {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(9);
            pdf.setTextColor(...ink);
            pdf.text(title, x, y);
            let rowY = y + 5;
            const maxValue = Math.max(1, ...entries.map(entry => Number(entry.value) || 0));
            entries.forEach(entry => {
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(7.5);
                pdf.setTextColor(...muted);
                pdf.text(entry.label, x, rowY);
                pdf.text(`${formatNumber(entry.value)} (${formatNumber(entry.pct, 1)}%)`, x + width, rowY, { align: "right" });
                pdf.setFillColor(226, 232, 240);
                pdf.roundedRect(x, rowY + 1.4, width, 2.4, 1, 1, "F");
                pdf.setFillColor(...color);
                pdf.roundedRect(x, rowY + 1.4, width * ((Number(entry.value) || 0) / maxValue), 2.4, 1, 1, "F");
                rowY += 8;
            });
            return rowY;
        };

        const name = props.DPA_DESPAR || props.DPA_DESCAN || props.DPA_DESPRO || "Territorio";
        const level = props.DPA_DESPAR ? "Parroquia" : (props.nivel_agregacion === "provincia" ? "Provincia" : "Cantón");
        const hasPopulationRate = level !== "Parroquia";
        const deathAnnualSeries = props.fallecidos_historico || props.fallecidos_por_anio || {};
        const years = availableAccidentYears(props);
        const trendYears = completeTimelineYears(props, year);
        const accidentCoverage = coverageYears(props.siniestros_historico);
        const deathCoverage = coverageYears(deathAnnualSeries);
        const latestAccident = latestAvailable(props.siniestros_historico);
        const latestDeath = latestAvailable(deathAnnualSeries);
        const selectedAccidents = finiteNumber(props.siniestros_historico?.[String(year)]);
        const selectedDeaths = finiteNumber(deathAnnualSeries[String(year)]);
        const accidentPeriod = selectedAccidents !== null ? { year, value: selectedAccidents } : latestAccident;
        const deathPeriod = selectedDeaths !== null ? { year, value: selectedDeaths } : latestDeath;
        const population = hasPopulationRate
            ? finiteNumber(props.poblacion_por_anio?.[String(accidentPeriod?.year)])
            : null;
        const rate = hasPopulationRate && accidentPeriod ? rateForFeature(props, accidentPeriod.year) : null;
        const completeAccidentYears = accidentCoverage.filter(candidate => candidate <= 2025);
        const historicalTotal = sumSeriesForYears(props.siniestros_historico, completeAccidentYears);
        const historicalDeaths = sumSeries(deathAnnualSeries);
        pdf.setFillColor(7, 93, 102);
        pdf.rect(0, 0, pageWidth, 32, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text("OBSERVATORIO DE SEGURIDAD VIAL Y MOVILIDAD SOSTENIBLE", margin, 10);
        pdf.setFontSize(20);
        pdf.text("Ficha técnica territorial", margin, 20);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.text("Iniciativa independiente de la sociedad civil impulsada por Fundación REDSA", margin, 27);
        y = 42;
        addParagraph(`${name} · ${level} · ${props.DPA_DESPRO || "Ecuador"} · período consultado ${year || "sin dato"}`, { bold: true, size: 12, color: ink });

        const metrics = [
            [`Siniestros\n${metricPeriodLabel(year, accidentPeriod?.year, "ANT/INEC")}`, accidentPeriod ? formatNumber(accidentPeriod.value) : "Sin dato"],
            [`Siniestros históricos completos\nANT/INEC: ${formatYearCoverage(completeAccidentYears)}`, formatNumber(historicalTotal)],
            [`Fallecidos\n${metricPeriodLabel(year, deathPeriod?.year, "INEC-EDG")}`, deathPeriod ? formatNumber(deathPeriod.value) : "Sin dato"],
            [`Fallecidos históricos\nINEC-EDG: ${formatYearCoverage(deathCoverage)}`, formatNumber(historicalDeaths)]
        ];
        const metricWidth = (contentWidth - 9) / 4;
        metrics.forEach(([label, value], index) => {
            const x = margin + index * (metricWidth + 3);
            pdf.setFillColor(241, 245, 249);
            pdf.setDrawColor(203, 213, 225);
            pdf.roundedRect(x, y, metricWidth, 18, 2, 2, "FD");
            pdf.setTextColor(...ink);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(12);
            pdf.text(String(value), x + 3, y + 7);
            pdf.setTextColor(...muted);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(6.7);
            pdf.text(pdf.splitTextToSize(label, metricWidth - 6), x + 3, y + 12);
        });
        y += 24;
        if (hasPopulationRate) {
            const populationText = population !== null ? `${formatNumber(population)} habitantes` : "población sin dato";
            const rateText = Number.isFinite(rate) ? `${formatNumber(rate, 1)} accidentes por cada 100.000 habitantes` : "tasa sin dato";
            addParagraph(`Contexto del período ${accidentPeriod?.year || year}: ${populationText} (fuente: INEC) y ${rateText} (cálculo REDSA con ANT/INEC e INEC población). Los años ausentes no se imputan ni se cuentan como cero.`, { color: ink });
        }
        if (Number(year) === 2026 && accidentPeriod?.year === 2026) {
            const comparable2025 = finiteNumber(props.siniestros_enero_junio_2025);
            const change = comparable2025 !== null && comparable2025 > 0
                ? (Number(accidentPeriod.value) - comparable2025) / comparable2025 * 100
                : null;
            addParagraph(
                `2026 es un corte provisional de enero a junio. Su referencia comparable es enero-junio de 2025: ${comparable2025 === null ? "sin dato territorial" : `${formatNumber(comparable2025)} siniestros${change === null ? "" : ` (${change >= 0 ? "+" : ""}${formatNumber(change, 1)}%)`}`}. No se compara con el total anual 2025.`,
                { bold: true, color: ink, size: 8.5 }
            );
        }

        const selectedCode = String(props.DPA_CANTON || "");
        const selectedProvinceCode = String(props.DPA_PROVIN || selectedCode.slice(0, 2));
        const parentCanton = props.DPA_DESPAR
            ? state.cantonFeatures.find(feature => String(feature.properties?.DPA_CANTON) === selectedCode)?.properties
            : null;
        const parentProvince = level !== "Provincia"
            ? state.provinceFeatures.find(feature => String(feature.properties?.DPA_PROVIN) === selectedProvinceCode)?.properties
            : null;
        const referenceRows = [
            { label: level, data: props },
            ...(parentCanton ? [{ label: "Cantón de referencia", data: parentCanton }] : []),
            ...(parentProvince ? [{ label: "Provincia de referencia", data: parentProvince }] : [])
        ];
        if (referenceRows.length > 1) {
            addSection("Contexto territorial comparable");
            addParagraph(`Comparación del período consultado (${year}) y de los acumulados disponibles. Si ese año no tiene dato, se muestra el último oficial con su año entre paréntesis. Siniestros: ANT/INEC-ESTRA. Fallecidos: INEC-EDG.`, { size: 8 });
            ensureSpace(10 + referenceRows.length * 8);
            const widths = [47, 30, 34, 34, 37];
            const headings = ["Territorio", "Accid. período", "Accid. histórico", "Fallec. período", "Fallec. histórico"];
            pdf.setFillColor(7, 93, 102); pdf.rect(margin, y, contentWidth, 8, "F");
            pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(6.7);
            let referenceX = margin;
            headings.forEach((heading, index) => { pdf.text(heading, referenceX + 1.5, y + 5); referenceX += widths[index]; });
            y += 8;
            referenceRows.forEach((reference, index) => {
                if (index % 2 === 0) { pdf.setFillColor(241, 245, 249); pdf.rect(margin, y, contentWidth, 8, "F"); }
                const referenceName = reference.data.DPA_DESPAR || reference.data.DPA_DESCAN || reference.data.DPA_DESPRO || reference.label;
                const referenceAccidents = finiteNumber(reference.data.siniestros_historico?.[String(year)]) !== null
                    ? { year, value: finiteNumber(reference.data.siniestros_historico?.[String(year)]) }
                    : latestAvailable(reference.data.siniestros_historico);
                const referenceDeaths = finiteNumber(reference.data.fallecidos_historico?.[String(year)]) !== null
                    ? { year, value: finiteNumber(reference.data.fallecidos_historico?.[String(year)]) }
                    : latestAvailable(reference.data.fallecidos_historico);
                const row = [
                    `${reference.label}: ${referenceName}`,
                    referenceAccidents ? `${formatNumber(referenceAccidents.value)} (${referenceAccidents.year})` : null,
                    sumSeries(reference.data.siniestros_historico),
                    referenceDeaths ? `${formatNumber(referenceDeaths.value)} (${referenceDeaths.year})` : null,
                    sumSeries(reference.data.fallecidos_historico)
                ];
                referenceX = margin;
                row.forEach((value, column) => {
                    const display = column === 0 || typeof value === "string"
                        ? String(value)
                        : (value === null ? "Sin dato" : formatNumber(value));
                    pdf.setTextColor(...ink); pdf.setFont("helvetica", column === 0 ? "bold" : "normal"); pdf.setFontSize(6.7);
                    pdf.text(pdf.splitTextToSize(display, widths[column] - 3), referenceX + 1.5, y + 5);
                    referenceX += widths[column];
                });
                y += 8;
            });
            y += 3;
        }

        if (mapImage) {
            addSection("Ubicación y mapa de referencia");
            addParagraph("Fuente cartográfica: límites INEC/CONALI vía datosabiertos.gob.ec (CC BY); mapa base según la selección visible y sus atribuciones.", { size: 7.5 });
            ensureSpace(87);
            pdf.addImage(mapImage, "JPEG", margin, y, contentWidth, 82, undefined, "FAST");
            y += 87;
        }

        ensureSpace(82);
        addSection("Tendencia histórica");
        addParagraph(`Fuentes: siniestros reportados, ANT/INEC-ESTRA; personas fallecidas, INEC-EDG. La línea llega hasta ${trendYears.at(-1)}; los años sin registro se muestran como ausencia de dato y no como cero. El punto 2026 representa enero-junio y no es comparable con puntos de años completos.`, { size: 8 });
        ensureSpace(72);
        const chartX = margin + 14;
        const chartY = y + 8;
        const chartW = contentWidth - 28;
        const chartH = 46;
        pdf.setDrawColor(203, 213, 225);
        [0, 0.5, 1].forEach(position => pdf.line(chartX, chartY + chartH * position, chartX + chartW, chartY + chartH * position));
        const drawSeries = (values, color, maxValue) => {
            let previous = null;
            values.forEach((value, index) => {
                if (!Number.isFinite(value)) { previous = null; return; }
                const point = {
                    x: chartX + (trendYears.length === 1 ? chartW / 2 : index * chartW / (trendYears.length - 1)),
                    y: chartY + chartH - (value / Math.max(1, maxValue)) * chartH
                };
                pdf.setDrawColor(...color);
                pdf.setFillColor(...color);
                pdf.setLineWidth(0.8);
                if (previous) pdf.line(previous.x, previous.y, point.x, point.y);
                pdf.circle(point.x, point.y, 1.1, "F");
                previous = point;
            });
        };
        const accidentSeries = trendYears.map(candidate => finiteNumber(props.siniestros_historico?.[String(candidate)]));
        const deathSeries = trendYears.map(candidate => finiteNumber(props.fallecidos_historico?.[String(candidate)]));
        const accidentMax = Math.max(1, ...accidentSeries.filter(Number.isFinite));
        const deathMax = Math.max(1, ...deathSeries.filter(Number.isFinite));
        drawSeries(accidentSeries, orange, accidentMax);
        drawSeries(deathSeries, cyan, deathMax);
        pdf.setFontSize(6.5);
        pdf.setTextColor(...muted);
        trendYears.forEach((candidate, index) => {
            const x = chartX + (trendYears.length === 1 ? chartW / 2 : index * chartW / (trendYears.length - 1));
            pdf.text(candidate === 2026 ? "2026*" : String(candidate), x, chartY + chartH + 5, { align: "center" });
        });
        pdf.setFillColor(...orange); pdf.rect(chartX, chartY - 5, 4, 2, "F");
        pdf.setTextColor(...ink); pdf.text(`Siniestros (máx. ${formatNumber(accidentMax)})`, chartX + 6, chartY - 3.2);
        pdf.setFillColor(...cyan); pdf.rect(chartX + 62, chartY - 5, 4, 2, "F");
        pdf.text(`Fallecidos (máx. ${formatNumber(deathMax)})`, chartX + 68, chartY - 3.2);
        y = chartY + chartH + 12;
        const missingAccidentYears = trendYears.filter(candidate => finiteNumber(props.siniestros_historico?.[String(candidate)]) === null);
        const missingDeathYears = trendYears.filter(candidate => finiteNumber(props.fallecidos_historico?.[String(candidate)]) === null);
        addParagraph(`Sin dato ANT/INEC-ESTRA: ${missingAccidentYears.length ? missingAccidentYears.join(", ") : "ningún año de la serie"}. Sin dato INEC-EDG: ${missingDeathYears.length ? missingDeathYears.join(", ") : "ningún año de la serie"}. * 2026: enero-junio, provisional.`, { size: 7.5 });

        const latestEdg = latestDetailedAvailable(props.fallecidos_detallado);
        const selectedEdg = props.fallecidos_detallado?.[String(year)];
        const edgPeriod = selectedEdg?.estado !== "sin_dato" && Number(selectedEdg?.total) > 0
            ? { year, value: selectedEdg }
            : latestEdg;
        const edg = edgPeriod?.value;
        ensureSpace(edg && edg.estado !== "sin_dato" && Number(edg.total) > 0 ? 123 : 28);
        addSection("Perfil de personas fallecidas");
        if (edg && edg.estado !== "sin_dato" && Number(edg.total) > 0) {
            const total = Number(edg.total);
            addParagraph(`${periodLabel(year, edgPeriod.year, latestEdg?.year)}: ${formatNumber(total)} personas fallecidas. Fuente: Registro Estadístico de Defunciones Generales (INEC-EDG), causas CIE-10 V01-V89. Acumulado territorial EDG ${formatYearCoverage(deathCoverage)}: ${formatNumber(historicalDeaths)}.`, { size: 8.5 });
            const male = Number(edg.sexo?.Hombre) || 0;
            const female = Number(edg.sexo?.Mujer) || 0;
            const knownSex = Math.max(1, male + female);
            pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(...ink); pdf.text("Sexo registrado", margin, y);
            pdf.setFillColor(14, 165, 233); pdf.roundedRect(margin, y + 3, contentWidth * male / knownSex, 7, 1.5, 1.5, "F");
            pdf.setFillColor(236, 72, 153); pdf.roundedRect(margin + contentWidth * male / knownSex, y + 3, contentWidth * female / knownSex, 7, 1.5, 1.5, "F");
            pdf.setTextColor(255, 255, 255); pdf.setFontSize(7);
            if (male > 0) pdf.text(`Hombres ${formatNumber(male / knownSex * 100, 1)}%`, margin + 3, y + 7.8);
            if (female > 0) pdf.text(`Mujeres ${formatNumber(female / knownSex * 100, 1)}%`, margin + contentWidth - 3, y + 7.8, { align: "right" });
            y += 16;
            const missingUser = Math.max(0, total - (Number(edg.cobertura?.usuario_conocido) || total));
            const userEntries = [
                ["Peatón", edg.usuario?.peaton], ["Ciclista", edg.usuario?.ciclista],
                ["Motociclista", edg.usuario?.motociclista], ["Ocupante", edg.usuario?.ocupante],
                ["Otro / vehículo no especificado", Math.max(0, (Number(edg.usuario?.otro) || 0) - missingUser)],
                ["Sin dato de usuario vial", missingUser]
            ].map(([label, value]) => ({ label, value: Number(value) || 0, pct: (Number(value) || 0) / total * 100 }));
            const ageLabels = { "0-14": "Niños (0-14)", "15-29": "Jóvenes (15-29)", "30-49": "Adultos (30-49)", "50-64": "Adultos (50-64)", "65+": "Adultos mayores (65+)" };
            const ageEntries = Object.entries(ageLabels).map(([key, label]) => ({ label, value: Number(edg.edad?.[key]) || 0, pct: (Number(edg.edad?.[key]) || 0) / total * 100 }));
            const leftEnd = drawBarList("Forma de desplazamiento / usuario vial", userEntries, margin, 86, [14, 165, 233]);
            const rightEnd = drawBarList("Grupos de edad", ageEntries, margin + 96, 86, [8, 145, 178]);
            y = Math.max(leftEnd, rightEnd) + 2;
        } else {
            addParagraph(`Periodo ${year}: sin datos demográficos INEC-EDG disponibles. Tampoco existe un último perfil oficial recuperable para este territorio. Acumulado territorial disponible ${formatYearCoverage(deathCoverage)}: ${formatNumber(historicalDeaths)} personas fallecidas.`, { color: ink });
        }

        const latestSppat = latestDetailedAvailable(props.sppat_por_sexo);
        const selectedSppat = props.sppat_por_sexo?.[String(year)];
        const sppatPeriod = selectedSppat?.estado === "disponible"
            ? { year, value: selectedSppat }
            : latestSppat;
        const sppatYear = sppatPeriod?.year;
        addSection("Reclamaciones del seguro - SPPAT");
        const sppatSex = sppatPeriod?.value;
        const sppatCondition = props.sppat_por_condicion?.[String(sppatYear)];
        const sppatType = props.sppat_por_tipo_accidente?.[String(sppatYear)];
        if (sppatSex?.estado === "disponible") {
            const toEntries = entry => {
                const categories = entry?.categorias || {};
                const total = Math.max(1, Object.values(categories).reduce((sum, value) => sum + (Number(value) || 0), 0));
                return Object.entries(categories).map(([label, value]) => ({ label, value: Number(value) || 0, pct: (Number(value) || 0) / total * 100 }));
            };
            const sexEntries = toEntries(sppatSex);
            const conditionEntries = toEntries(sppatCondition);
            const typeEntries = toEntries(sppatType);
            ensureSpace(12 + Math.max(sexEntries.length, conditionEntries.length, typeEntries.length) * 8);
            addParagraph(`${periodLabel(year, sppatYear, latestSppat?.year)}. Fuente: Servicio Público para Pago de Accidentes de Tránsito (SPPAT), reclamaciones procesadas. No deben sumarse con INEC-EDG porque son registros y metodologías diferentes.`, { size: 8.5 });
            const columnWidth = 55;
            const sexEnd = drawBarList("Sexo registrado", sexEntries, margin, columnWidth, [14, 165, 233]);
            const conditionEnd = drawBarList("Condición", conditionEntries, margin + 63, columnWidth, [8, 145, 178]);
            const typeEnd = drawBarList("Tipo de accidente", typeEntries, margin + 126, columnWidth, [168, 85, 247]);
            y = Math.max(sexEnd, conditionEnd, typeEnd) + 2;
        } else {
            addParagraph(`Periodo ${year}: sin detalle SPPAT disponible. La cobertura publicada corresponde a 2016-2021 y no existe un último registro territorial recuperable; la ausencia posterior no significa cero reclamaciones.`, { color: ink });
        }

        ensureSpace(25 + trendYears.length * 7);
        addSection("Serie anual disponible");
        addParagraph(`Fuentes por columna: siniestros reportados, ANT como registro administrativo primario e INEC-ESTRA como procesamiento estadístico; personas fallecidas, INEC-EDG. Se incluyen todos los años hasta ${trendYears.at(-1)} y se declara “Sin dato” cuando la fuente no ofrece un valor. 2026 corresponde únicamente a enero-junio y no se suma al histórico de años completos.`, { size: 8 });
        ensureSpace(12 + trendYears.length * 7);
        const tableX = margin;
        const colWidths = [28, 72, 82];
        const headers = ["Año / corte", "Siniestros reportados (ANT/INEC)", "Personas fallecidas (INEC-EDG)"];
        pdf.setFillColor(7, 93, 102); pdf.rect(tableX, y, contentWidth, 8, "F");
        pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5);
        let xCursor = tableX;
        headers.forEach((header, index) => { pdf.text(header, xCursor + 2, y + 5); xCursor += colWidths[index]; });
        y += 8;
        trendYears.forEach((candidate, index) => {
            if (index % 2 === 0) { pdf.setFillColor(241, 245, 249); pdf.rect(tableX, y, contentWidth, 7, "F"); }
            pdf.setTextColor(...ink); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5);
            const row = [candidate === 2026 ? "2026 ene-jun" : candidate, props.siniestros_historico?.[String(candidate)], props.fallecidos_historico?.[String(candidate)]];
            xCursor = tableX;
            row.forEach((value, column) => {
                const displayedValue = column === 0
                    ? String(value)
                    : (finiteNumber(value) !== null ? formatNumber(value) : "Sin dato");
                pdf.text(displayedValue, xCursor + 2, y + 4.8);
                xCursor += colWidths[column];
            });
            y += 7;
        });
        y += 5;

        addSection("Fuentes, metodología y trazabilidad");
        addParagraph("Siniestros: ANT, registro administrativo primario; INEC, Estadísticas de Transporte (ESTRA), procesamiento estadístico oficial. Son dos etapas de una misma cadena y no deben sumarse entre sí. Los conteos principales no se suprimen; el umbral SDC de 5 se aplica únicamente a cruces de múltiples atributos.");
        addParagraph("Cobertura temporal: 2025 es año completo semidefinitivo, reconciliado con los cuatro trimestres ESTRA. 2026 es provisional, enero-junio; el segundo trimestre aún no tenía publicación ESTRA al corte del 27 de julio de 2026.");
        addParagraph("Personas fallecidas: INEC, Estadísticas de Defunciones Generales (EDG), causas CIE-10 V01-V89. EDG registra el lugar de fallecimiento, que no necesariamente coincide con el lugar del siniestro.");
        addParagraph(hasPopulationRate
            ? "Límites: INEC/CONALI vía datosabiertos.gob.ec, licencia CC BY. Las tasas se calculan como numerador / población del mismo año x 100.000. Los datos faltantes se declaran como sin dato."
            : "Límites: INEC/CONALI vía datosabiertos.gob.ec, licencia CC BY. A nivel parroquial se omiten la población y las tasas por habitante; consulte la metodología.");
        addParagraph(`Metodología: ${new URL("metodologia/", window.location.href).href}`, { size: 8 });
        addParagraph(`Cita sugerida: Fundación REDSA (${new Date().getFullYear()}). Observatorio Ciudadano de Seguridad Vial y Movilidad Sostenible. Consulta: ${new Date().toLocaleDateString("es-EC")}.`, { size: 8 });
        addParagraph("Contacto institucional: info@fundacionredsa.org", { bold: true, color: teal, size: 9 });

        const pages = pdf.getNumberOfPages();
        for (let page = 1; page <= pages; page += 1) {
            pdf.setPage(page);
            pdf.setDrawColor(203, 213, 225);
            pdf.line(margin, 286, pageWidth - margin, 286);
            pdf.setTextColor(...muted);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7);
            pdf.text("Fundación REDSA · info@fundacionredsa.org", margin, 291);
            pdf.text(`Página ${page} de ${pages}`, pageWidth - margin, 291, { align: "right" });
        }
        window.__redsaLastPdfAudit = {
            pageCount: pages,
            vectorTrend: true,
            structuredProfile: true,
            contactIncluded: true,
            selectedYear: year,
            timelineEndYear: trendYears.at(-1),
            sourcesBySection: true,
            historicalComparison: true,
            territoryLevel: level,
            populationContextIncluded: hasPopulationRate,
            latestOfficialFallbacks: {
                accidents: accidentPeriod?.year || null,
                deaths: deathPeriod?.year || null,
                demographicProfile: edgPeriod?.year || null,
                sppat: sppatYear || null
            },
            territorialReferenceCount: referenceRows.length
        };
        return pdf;
    }

    async function downloadSummary() {
        const props = state.selectedProps;
        if (!props) return;
        const button = document.getElementById("download-summary-button");
        const status = document.getElementById("territory-search-status");
        const requestedYear = Number(state.context?.getSelectedYear?.());
        const year = Number.isFinite(requestedYear) ? requestedYear : resolveSummaryYear(props, requestedYear);
        const name = props.DPA_DESPAR || props.DPA_DESCAN || props.DPA_DESPRO;
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Generando ficha…';
        }
        try {
            const mapImage = await captureMapImage();
            const slug = normalize(name).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
            buildTechnicalPdf(props, year, mapImage).save(`redsa_ficha_${slug}_${year || "sin_anio"}.pdf`);
            if (status) status.textContent = "Ficha PDF generada en tu dispositivo; no se almacenó en el portal.";
        } catch (error) {
            console.error(error);
            if (status) status.textContent = "No se pudo generar la ficha PDF. Inténtalo nuevamente cuando el mapa termine de cargar.";
        } finally {
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
        state.provinceFeatures = context.provinceFeatures || [];
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
                const resolution = resolveTerritorySearch(query);
                return resolution.match?.code || null;
            },
            async searchAll(query) {
                await ensureParishSearchFeatures();
                const resolution = resolveTerritorySearch(query);
                return resolution.match
                    ? { code: resolution.match.code, level: resolution.match.level, display: resolution.match.display }
                    : { code: null, level: null, status: resolution.status, matches: resolution.matches.length };
            },
            state() {
                return {
                    initialized: state.initialized,
                    provinceOptions: state.provinceFeatures.length,
                    cantonOptions: state.cantonFeatures.length,
                    parishOptions: state.parishFeatures.length,
                    selectedCanton: state.selectedProps?.DPA_CANTON || null,
                    selectedParish: state.selectedProps?.DPA_PARROQ || null,
                    selectedName: state.selectedProps?.DPA_DESPAR || state.selectedProps?.DPA_DESCAN || state.selectedProps?.DPA_DESPRO || null
                };
            }
        };
    }

    function setCantonFeatures(features) {
        state.cantonFeatures = Array.isArray(features) ? features : [];
        populateSearch();
    }

    window.REDSAExperience = Object.freeze({
        init,
        setCantonFeatures,
        clearSearchAdjustmentNotice,
        updateSearchAdjustmentNotice,
        updateMapContext,
        updateSummary
    });
})();
