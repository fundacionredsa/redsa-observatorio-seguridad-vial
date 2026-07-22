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

    async function captureMapImage() {
        const map = document.getElementById("map");
        if (!map || typeof window.html2canvas !== "function") return null;
        const canvas = await window.html2canvas(map, {
            backgroundColor: "#f8fafc",
            useCORS: true,
            allowTaint: false,
            logging: false,
            scale: 2,
            ignoreElements: element => element.matches?.(".leaflet-control-zoom, .opacity-control, .basemap-control, .mobile-nav-toggle")
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
        const years = availableAccidentYears(props);
        const accidents = Number(props.siniestros_historico?.[String(year)]);
        const deaths = Number(props.fallecidos_historico?.[String(year)]);
        const population = Number(props.poblacion_por_anio?.[String(year)]);
        const rate = rateForFeature(props, year);
        const historicalTotal = years.reduce((total, candidate) => {
            const value = Number(props.siniestros_historico?.[String(candidate)]);
            return Number.isFinite(value) ? total + value : total;
        }, 0);
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
        addParagraph(`${name} · ${level} · ${props.DPA_DESPRO || "Ecuador"} · año seleccionado ${year || "sin dato"}`, { bold: true, size: 12, color: ink });

        const metrics = [
            ["Accidentes reportados", Number.isFinite(accidents) ? formatNumber(accidents) : "Sin dato"],
            ["Personas fallecidas (EDG)", Number.isFinite(deaths) ? formatNumber(deaths) : "Sin dato"],
            ["Población", Number.isFinite(population) ? formatNumber(population) : "Sin dato"],
            ["Accidentes por 100.000 hab.", Number.isFinite(rate) ? formatNumber(rate, 1) : "Sin dato"]
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
        addParagraph(`Dimensión histórica: ${formatNumber(historicalTotal)} accidentes acumulados en ${formatYearCoverage(years)}. Los años ausentes no se imputan ni se cuentan como cero.`, { color: ink });

        if (mapImage) {
            addSection("Ubicación y mapa de referencia");
            ensureSpace(87);
            pdf.addImage(mapImage, "JPEG", margin, y, contentWidth, 82, undefined, "FAST");
            y += 87;
        }

        const trendYears = [...new Set([
            ...Object.keys(props.siniestros_historico || {}),
            ...Object.keys(props.fallecidos_historico || {})
        ])].map(Number).filter(Number.isFinite).sort((a, b) => a - b);
        addSection("Tendencia histórica");
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
        const accidentSeries = trendYears.map(candidate => Number(props.siniestros_historico?.[String(candidate)]));
        const deathSeries = trendYears.map(candidate => Number(props.fallecidos_historico?.[String(candidate)]));
        const accidentMax = Math.max(1, ...accidentSeries.filter(Number.isFinite));
        const deathMax = Math.max(1, ...deathSeries.filter(Number.isFinite));
        drawSeries(accidentSeries, orange, accidentMax);
        drawSeries(deathSeries, cyan, deathMax);
        pdf.setFontSize(6.5);
        pdf.setTextColor(...muted);
        trendYears.forEach((candidate, index) => {
            const x = chartX + (trendYears.length === 1 ? chartW / 2 : index * chartW / (trendYears.length - 1));
            pdf.text(String(candidate), x, chartY + chartH + 5, { align: "center" });
        });
        pdf.setFillColor(...orange); pdf.rect(chartX, chartY - 5, 4, 2, "F");
        pdf.setTextColor(...ink); pdf.text(`Accidentes (máx. ${formatNumber(accidentMax)})`, chartX + 6, chartY - 3.2);
        pdf.setFillColor(...cyan); pdf.rect(chartX + 62, chartY - 5, 4, 2, "F");
        pdf.text(`Fallecidos (máx. ${formatNumber(deathMax)})`, chartX + 68, chartY - 3.2);
        y = chartY + chartH + 12;

        const edg = props.fallecidos_detallado?.[String(year)];
        ensureSpace(edg && edg.estado !== "sin_dato" && Number(edg.total) > 0 ? 123 : 28);
        addSection(`Perfil de personas fallecidas (${year || "sin dato"})`);
        if (edg && edg.estado !== "sin_dato" && Number(edg.total) > 0) {
            const total = Number(edg.total);
            addParagraph(`Registro civil INEC-EDG: ${formatNumber(total)} personas fallecidas. Las barras muestran conteos y proporciones del total.`, { size: 8.5 });
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
            addParagraph("Sin datos demográficos disponibles para el año seleccionado.", { color: ink });
        }

        addSection(`Reclamaciones del seguro - SPPAT (${year || "sin dato"})`);
        const sppatSex = props.sppat_por_sexo?.[String(year)];
        const sppatCondition = props.sppat_por_condicion?.[String(year)];
        const sppatType = props.sppat_por_tipo_accidente?.[String(year)];
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
            addParagraph("Registros vinculados a reclamaciones procesadas por el Servicio Público para Pago de Accidentes de Tránsito. No deben sumarse con EDG.", { size: 8.5 });
            const columnWidth = 55;
            const sexEnd = drawBarList("Sexo registrado", sexEntries, margin, columnWidth, [14, 165, 233]);
            const conditionEnd = drawBarList("Condición", conditionEntries, margin + 63, columnWidth, [8, 145, 178]);
            const typeEnd = drawBarList("Tipo de accidente", typeEntries, margin + 126, columnWidth, [168, 85, 247]);
            y = Math.max(sexEnd, conditionEnd, typeEnd) + 2;
        } else {
            addParagraph("Sin detalle SPPAT disponible para el año seleccionado. La cobertura publicada de esta fuente corresponde a 2016-2021.", { color: ink });
        }

        addSection("Serie anual disponible");
        ensureSpace(12 + years.length * 7);
        const tableX = margin;
        const colWidths = [28, 72, 82];
        const headers = ["Año", "Accidentes reportados (INEC)", "Personas fallecidas (INEC-EDG)"];
        pdf.setFillColor(7, 93, 102); pdf.rect(tableX, y, contentWidth, 8, "F");
        pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5);
        let xCursor = tableX;
        headers.forEach((header, index) => { pdf.text(header, xCursor + 2, y + 5); xCursor += colWidths[index]; });
        y += 8;
        years.forEach((candidate, index) => {
            if (index % 2 === 0) { pdf.setFillColor(241, 245, 249); pdf.rect(tableX, y, contentWidth, 7, "F"); }
            pdf.setTextColor(...ink); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5);
            const row = [candidate, props.siniestros_historico?.[String(candidate)], props.fallecidos_historico?.[String(candidate)]];
            xCursor = tableX;
            row.forEach((value, column) => {
                const displayedValue = column === 0
                    ? String(value)
                    : (Number.isFinite(Number(value)) ? formatNumber(value) : "Sin dato");
                pdf.text(displayedValue, xCursor + 2, y + 4.8);
                xCursor += colWidths[column];
            });
            y += 7;
        });
        y += 5;

        addSection("Fuentes, metodología y trazabilidad");
        addParagraph("Accidentes: INEC, Estadísticas de Transporte (ESTRA), registros oficiales agregados territorialmente.");
        addParagraph("Personas fallecidas: INEC, Estadísticas de Defunciones Generales (EDG), causas CIE-10 V01-V89. EDG registra el lugar de fallecimiento, que no necesariamente coincide con el lugar del siniestro.");
        addParagraph("Límites: INEC/CONALI vía datosabiertos.gob.ec, licencia CC BY. Las tasas se calculan como numerador / población del mismo año x 100.000. Los datos faltantes se declaran como sin dato.");
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
            selectedYear: year
        };
        return pdf;
    }

    async function downloadSummary() {
        const props = state.selectedProps;
        if (!props) return;
        const button = document.getElementById("download-summary-button");
        const status = document.getElementById("territory-search-status");
        const year = resolveSummaryYear(props, state.context?.getSelectedYear?.());
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
