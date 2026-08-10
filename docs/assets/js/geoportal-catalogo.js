(function () {
    const LEVEL_LABELS = { province: "provincias", canton: "cantones", parish: "parroquias" };
    const LEVEL_FILES = {
        province: "data/provincias_wgs84.geojson",
        canton: "data/cantones_wgs84.geojson",
        parish: "data/parroquias_wgs84.geojson"
    };
    const CATALOG_UI_CONFIG = Object.freeze({
        allCategoriesValue: "todas",
        allCategoriesLabel: "Todas",
        showDetailsLabel: "Ver detalles",
        hideDetailsLabel: "Ocultar detalles"
    });
    const GLOBAL_COUNTER = {
        productionHostnames: [
            "geoportal.observatorio.fundacionredsa.org",
            "fundacionredsa.github.io"
        ],
        keyPrefix: "fundacionredsa_observatorio_seguridad_vial_v1_",
        totalKey: "catalogo_total",
        endpoint: "https://countapi.mileshilliard.com/api/v1"
    };
    let catalogData = null;
    let activeCatalogCategory = CATALOG_UI_CONFIG.allCategoriesValue;
    const globalCounts = new Map();

    function globalCounterEnabled() {
        return GLOBAL_COUNTER.productionHostnames.includes(window.location.hostname)
            || window.__REDSA_GLOBAL_COUNTER_ENABLED__ === true;
    }

    function counterUrl(key, increment = false) {
        const operation = increment ? "hit" : "get";
        return `${GLOBAL_COUNTER.endpoint}/${operation}/${encodeURIComponent(`${GLOBAL_COUNTER.keyPrefix}${key}`)}`;
    }

    async function requestCounter(key, increment = false) {
        if (!globalCounterEnabled()) return null;
        const response = await fetch(counterUrl(key, increment), { mode: "cors", cache: "no-store" });
        if (!increment && response.status === 404) return 0;
        if (!response.ok) throw new Error(`Contador global no disponible (${response.status})`);
        const payload = await response.json();
        const value = Number(payload.value);
        return Number.isFinite(value) ? value : null;
    }

    function updateDownloadCounters(variableId = null, unavailable = false) {
        document.querySelectorAll("[data-catalog-download-count]").forEach(node => {
            const id = node.dataset.catalogDownloadCount;
            if (!variableId || variableId === id) {
                const count = globalCounts.get(id);
                node.textContent = Number.isFinite(count)
                    ? `Descargas históricas registradas: ${count}.`
                    : (unavailable ? "Conteo histórico no disponible temporalmente." : "Consultando descargas históricas…");
            }
        });
        const total = document.getElementById("catalog-global-download-total");
        if (total) {
            const count = globalCounts.get(GLOBAL_COUNTER.totalKey);
            total.textContent = Number.isFinite(count)
                ? `Descargas históricas registradas en todo el catálogo: ${count}.`
                : (unavailable ? "Conteo histórico global no disponible temporalmente." : "Consultando descargas históricas globales…");
        }
    }

    async function refreshGlobalCounters(variables) {
        if (!globalCounterEnabled()) {
            updateDownloadCounters(null, true);
            return;
        }
        try {
            const entries = await Promise.all([
                [GLOBAL_COUNTER.totalKey, requestCounter(GLOBAL_COUNTER.totalKey)],
                ...variables.map(variable => [variable.id, requestCounter(variable.id)])
            ].map(async ([key, promise]) => [key, await promise]));
            entries.forEach(([key, value]) => globalCounts.set(key, value));
            updateDownloadCounters();
        } catch (error) {
            console.warn(error);
            updateDownloadCounters(null, true);
        }
    }

    async function recordDownload(variable, format, level = "all") {
        if (typeof window.gtag === "function") {
            window.gtag("event", "catalog_download", {
                variable_id: variable.id,
                file_format: format,
                territorial_level: level
            });
        }
        window.dispatchEvent(new CustomEvent("redsa:catalog-download", {
            detail: { variableId: variable.id, format, level, timestamp: new Date().toISOString() }
        }));
        try {
            const [variableCount, totalCount] = await Promise.all([
                requestCounter(variable.id, true),
                requestCounter(GLOBAL_COUNTER.totalKey, true)
            ]);
            if (Number.isFinite(variableCount)) globalCounts.set(variable.id, variableCount);
            if (Number.isFinite(totalCount)) globalCounts.set(GLOBAL_COUNTER.totalKey, totalCount);
            updateDownloadCounters(variable.id);
            updateDownloadCounters();
        } catch (error) {
            console.warn(error);
            updateDownloadCounters(variable.id, true);
        }
    }

    async function loadCatalog() {
        if (catalogData) return catalogData;
        const response = await fetch("data/catalogo_metadatos.json");
        if (!response.ok) throw new Error("No se pudo cargar el catálogo");
        catalogData = await response.json();
        return catalogData;
    }

    function addText(parent, tag, text, className) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        node.textContent = text;
        parent.appendChild(node);
        return node;
    }

    function renderStats(stats) {
        const container = document.getElementById("catalog-summary-stats");
        if (!container || !stats) return;
        container.replaceChildren();
        addText(container, "strong", "Transparencia de datos");
        addText(container, "p", `${stats.pct_variables_con_fuente_documentada}% de las variables tienen su fuente documentada explícitamente.`);
        addText(container, "p", `${stats.pct_cobertura_sin_dato_declarado}% declaran “sin dato” cuando falta información, en lugar de imputar o dejar en blanco.`);
        const count = addText(container, "p", "", "catalog-device-count");
        count.id = "catalog-global-download-total";
        addText(container, "p", "El conteo público es global y orientativo desde la publicación de esta función: registra descargas, no personas únicas, y no requiere identificar al usuario.", "catalog-device-note");
        const trustCard = document.createElement("section");
        trustCard.className = "catalog-trust-card";
        trustCard.setAttribute("aria-labelledby", "catalog-trust-title");
        trustCard.innerHTML = `
            <h3 id="catalog-trust-title">¿Por qué confiar en estos datos?</h3>
            <p>REDSA compara publicaciones oficiales independientes antes de integrarlas. ANT e INEC/ESTRA coincidieron exactamente en los tres cortes verificables; además, mantenemos visibles los registros que no pueden asignarse responsablemente a un cantón.</p>
            <div class="catalog-crosscheck-table" role="table" aria-label="Control cruzado ANT e INEC ESTRA">
                <div role="row"><strong role="cell">2024 anual</strong><span role="cell">21.220 siniestros · 18.312 lesionados · 2.302 fallecidos en sitio</span><b role="cell">Diferencia 0</b></div>
                <div role="row"><strong role="cell">2025 I–IV</strong><span role="cell">20.346 siniestros · 17.932 lesionados · 2.354 fallecidos en sitio</span><b role="cell">Diferencia 0</b></div>
                <div role="row"><strong role="cell">2026-I</strong><span role="cell">4.789 siniestros · 4.032 lesionados · 603 fallecidos en sitio</span><b role="cell">Diferencia 0</b></div>
            </div>
            <p class="catalog-trust-note">ANT/ESTRA registra fallecidos en sitio; no sustituye las defunciones del Registro Civil (EDG). <a href="metodologia/#control-cruzado">Ver método y fuentes</a>.</p>`;
        container.appendChild(trustCard);
        updateDownloadCounters();
    }

    function getRegistryVariable(variableId) {
        return window.REDSA_GEO_CONFIG?.variables?.[variableId] || null;
    }

    function getValue(config, properties, year) {
        if (!config) return null;
        try {
            const value = config.getValue ? config.getValue(properties, year) : properties[config.property];
            return value === undefined || value === null || value === "" || Number(value) < 0 ? null : Number(value);
        } catch (_) {
            return null;
        }
    }

    function territorialProperties(properties, level) {
        const common = {
            codigo_provincia: properties.DPA_PROVIN ?? properties.dpa_provin ?? null,
            provincia: properties.DPA_DESPRO ?? properties.provincia ?? null
        };
        if (level !== "province") {
            common.codigo_canton = properties.DPA_CANTON ?? properties.dpa_canton ?? null;
            common.canton = properties.DPA_DESCAN ?? properties.canton ?? null;
        }
        if (level === "parish") {
            common.codigo_parroquia = properties.DPA_PARROQ ?? properties.DPA_PARRO ?? properties.dpa_parroq ?? null;
            common.parroquia = properties.DPA_DESPAR ?? properties.parroquia ?? null;
        }
        return common;
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function downloadGeoJSON(variable, level, button) {
        const config = getRegistryVariable(variable.id);
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "Preparando…";
        try {
            const response = await fetch(LEVEL_FILES[level]);
            if (!response.ok) throw new Error("No se pudo cargar la geometría territorial");
            const source = await response.json();
            const years = variable.anios_disponibles || [];
            const features = source.features.map((feature) => {
                const properties = territorialProperties(feature.properties, level);
                years.forEach((year) => {
                    const value = getValue(config, feature.properties, year);
                    properties[`valor_${year}`] = value;
                    properties[`estado_${year}`] = value === null ? "sin_dato" : "con_dato";
                });
                return { type: "Feature", geometry: feature.geometry, properties };
            });
            const output = {
                type: "FeatureCollection",
                metadata: {
                    variable_id: variable.id,
                    nombre: variable.label,
                    descripcion: variable.descripcion,
                    unidad: variable.unidad,
                    nivel_territorial: level,
                    anios: years,
                    anios_acumulables: variable.anios_acumulables || years,
                    etiquetas_periodo: variable.etiquetas_periodo || {},
                    procedencia_por_anio: variable.procedencia_por_anio || {},
                    fechas_corte: variable.fechas_corte || {},
                    fuente: variable.fuente,
                    metodologia: variable.metodologia,
                    licencia: variable.licencia,
                    referencias: variable.referencias,
                    responsable_tratamiento: "Fundación REDSA",
                    cita_sugerida: `Fundación REDSA (${new Date().getFullYear()}). Observatorio Ciudadano de Seguridad Vial y Movilidad Sostenible. Variable: ${variable.label}.`,
                    generado_el: new Date().toISOString()
                },
                features
            };
            downloadBlob(new Blob([JSON.stringify(output)], { type: "application/geo+json;charset=utf-8" }), `${variable.id}_${LEVEL_LABELS[level]}.geojson`);
            recordDownload(variable, "geojson", level);
        } catch (error) {
            console.error(error);
            button.textContent = "Error al preparar";
            setTimeout(() => { button.textContent = originalText; }, 2500);
            return;
        } finally {
            button.disabled = false;
        }
        button.textContent = originalText;
    }

    function renderReferences(parent, references) {
        if (!references?.length) return;
        const details = document.createElement("details");
        details.className = "catalog-references";
        addText(details, "summary", "Fuentes y referencias");
        const list = document.createElement("ul");
        references.forEach((reference) => {
            const item = document.createElement("li");
            const link = document.createElement("a");
            link.href = reference.url;
            link.target = "_blank";
            link.rel = "noopener";
            link.textContent = reference.label;
            item.appendChild(link);
            list.appendChild(item);
        });
        details.appendChild(list);
        parent.appendChild(details);
    }

    function createCatalogItem(variable) {
        const article = document.createElement("article");
        article.className = "catalog-item";
        article.dataset.catalogVariable = variable.id;

        const compact = document.createElement("div");
        compact.className = "catalog-item-compact";
        const identity = document.createElement("div");
        identity.className = "catalog-item-identity";
        const icon = document.createElement("span");
        icon.className = "catalog-item-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.innerHTML = '<i class="fa-solid fa-table-list"></i>';
        identity.appendChild(icon);
        addText(identity, "span", variable.categoria, "catalog-category");
        compact.appendChild(identity);

        const title = addText(compact, "h3", variable.label);
        title.id = `catalog-title-${variable.id}`;
        addText(compact, "p", variable.descripcion || "Descripción pendiente.", "catalog-description");

        const details = document.createElement("div");
        details.className = "catalog-item-details";
        details.id = `catalog-details-${variable.id}`;
        details.hidden = true;

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "catalog-details-toggle";
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-controls", details.id);
        toggle.textContent = CATALOG_UI_CONFIG.showDetailsLabel;
        toggle.addEventListener("click", () => {
            const expanded = toggle.getAttribute("aria-expanded") !== "true";
            toggle.setAttribute("aria-expanded", String(expanded));
            toggle.textContent = expanded ? CATALOG_UI_CONFIG.hideDetailsLabel : CATALOG_UI_CONFIG.showDetailsLabel;
            details.hidden = !expanded;
            article.classList.toggle("is-expanded", expanded);
        });
        compact.appendChild(toggle);
        article.appendChild(compact);

        const facts = document.createElement("dl");
        const entries = [
            ["Fuente", variable.fuente || "No documentada"],
            ["Años disponibles", variable.anios_disponibles?.join(", ") || "No aplica"],
            ...(Object.keys(variable.etiquetas_periodo || {}).length
                ? [["Cortes parciales", Object.values(variable.etiquetas_periodo).join(", ")]]
                : []),
            ["Nivel territorial", variable.nivel_territorial_disponible?.map((level) => LEVEL_LABELS[level]).join(", ") || "No aplica"],
            ["Unidad", variable.unidad || "No documentada"],
            ["Licencia", variable.licencia || "Consultar fuente"]
        ];
        entries.forEach(([term, description]) => {
            addText(facts, "dt", term);
            addText(facts, "dd", description);
        });
        details.appendChild(facts);

        const method = document.createElement("details");
        method.className = "catalog-method";
        addText(method, "summary", "Cómo se preparó este dato");
        addText(method, "p", variable.metodologia || "Sin tratamiento documentado.");
        details.appendChild(method);
        renderReferences(details, variable.referencias);

        const downloads = document.createElement("div");
        downloads.className = "catalog-downloads";
        if (variable.descargas.excel) {
            const excel = document.createElement("a");
            excel.className = "catalog-download primary";
            excel.href = variable.descargas.excel;
            excel.download = "";
            excel.innerHTML = '<i class="fa-solid fa-file-excel" aria-hidden="true"></i> Excel documentado';
            excel.addEventListener("click", () => recordDownload(variable, "excel"));
            downloads.appendChild(excel);
        }
        variable.descargas.geojson_niveles.forEach((level) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "catalog-download";
            button.innerHTML = `<i class="fa-solid fa-map" aria-hidden="true"></i> GeoJSON ${LEVEL_LABELS[level]}`;
            button.addEventListener("click", () => downloadGeoJSON(variable, level, button));
            downloads.appendChild(button);
        });
        (variable.descargas.archivos_directos || []).forEach(file => {
            const link = document.createElement("a");
            link.className = "catalog-download";
            link.href = file.url;
            link.download = "";
            link.innerHTML = `<i class="fa-solid fa-download" aria-hidden="true"></i> ${file.etiqueta}`;
            link.addEventListener("click", () => recordDownload(variable, file.formato.toLocaleLowerCase("es")));
            downloads.appendChild(link);
        });
        const count = addText(downloads, "p", "", "catalog-download-count");
        count.dataset.catalogDownloadCount = variable.id;
        count.textContent = "Consultando descargas históricas…";
        details.appendChild(downloads);
        article.appendChild(details);
        return article;
    }

    function renderCategoryChips(variables) {
        const container = document.getElementById("catalog-category-filter");
        if (!container || container.childElementCount) return;
        const categories = [...new Set(variables.map(variable => variable.categoria).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, "es"));
        const entries = [
            [CATALOG_UI_CONFIG.allCategoriesValue, CATALOG_UI_CONFIG.allCategoriesLabel],
            ...categories.map(category => [category, category])
        ];
        entries.forEach(([value, label]) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "catalog-category-chip";
            chip.dataset.catalogCategory = value;
            chip.setAttribute("aria-pressed", String(value === activeCatalogCategory));
            chip.textContent = label;
            chip.addEventListener("click", () => {
                activeCatalogCategory = value;
                container.querySelectorAll("[data-catalog-category]").forEach(button => {
                    button.setAttribute("aria-pressed", String(button.dataset.catalogCategory === value));
                });
                const searchInput = document.getElementById("catalog-search");
                if (catalogData) renderCatalog(catalogData.variables, searchInput?.value || "", activeCatalogCategory);
            });
            container.appendChild(chip);
        });
    }

    function renderCatalog(variables, query = "", category = CATALOG_UI_CONFIG.allCategoriesValue) {
        const container = document.getElementById("catalog-results");
        if (!container) return;
        container.replaceChildren();
        const normalized = query.trim().toLocaleLowerCase("es");
        const filtered = variables.filter((variable) => {
            const haystack = `${variable.label} ${variable.fuente} ${variable.descripcion}`.toLocaleLowerCase("es");
            return (!normalized || haystack.includes(normalized))
                && (category === CATALOG_UI_CONFIG.allCategoriesValue || variable.categoria === category);
        });
        if (!filtered.length) {
            addText(container, "p", "No se encontraron variables que coincidan con la búsqueda.", "catalog-empty");
            return;
        }
        filtered.forEach((variable) => container.appendChild(createCatalogItem(variable)));
        updateDownloadCounters();
    }

    function initCatalogUI() {
        const modal = document.getElementById("catalog-modal");
        const btnOpen = document.getElementById("btn-catalog");
        const btnClose = document.getElementById("catalog-modal-close");
        const searchInput = document.getElementById("catalog-search");
        const tabs = [...document.querySelectorAll("[data-catalog-tab]")];
        const panels = [...document.querySelectorAll("[data-catalog-panel]")];
        if (!modal || !btnOpen) return;

        const selectTab = (tabName, moveFocus = false) => {
            tabs.forEach((tab) => {
                const selected = tab.dataset.catalogTab === tabName;
                tab.classList.toggle("is-active", selected);
                tab.setAttribute("aria-selected", String(selected));
                tab.tabIndex = selected ? 0 : -1;
                if (selected && moveFocus) tab.focus();
            });
            panels.forEach((panel) => {
                panel.hidden = panel.dataset.catalogPanel !== tabName;
            });
        };

        tabs.forEach((tab, index) => {
            tab.addEventListener("click", () => selectTab(tab.dataset.catalogTab));
            tab.addEventListener("keydown", (event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                let nextIndex = index;
                if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
                if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
                if (event.key === "Home") nextIndex = 0;
                if (event.key === "End") nextIndex = tabs.length - 1;
                selectTab(tabs[nextIndex].dataset.catalogTab, true);
            });
        });

        btnOpen.addEventListener("click", async () => {
            selectTab("variables");
            modal.hidden = false;
            modal.setAttribute("aria-hidden", "false");
            try {
                const data = await loadCatalog();
                renderStats(data.resumen_transparencia);
                renderCategoryChips(data.variables);
                renderCatalog(data.variables, searchInput.value, activeCatalogCategory);
                refreshGlobalCounters(data.variables);
            } catch (error) {
                console.error(error);
                addText(document.getElementById("catalog-results"), "p", "No se pudo cargar el catálogo.", "catalog-empty");
            }
        });

        const close = () => {
            modal.hidden = true;
            modal.setAttribute("aria-hidden", "true");
        };
        btnClose?.addEventListener("click", close);
        modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
        const update = () => catalogData && renderCatalog(catalogData.variables, searchInput.value, activeCatalogCategory);
        searchInput?.addEventListener("input", update);
    }

    document.addEventListener("DOMContentLoaded", initCatalogUI);
})();
