(function () {
    const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
    const state = {
        initialized: false,
        context: null,
        activeTab: "ranking",
        sortKey: "value",
        sortDirection: "desc",
        query: "",
        rows: [],
        displayedRows: [],
        excludedCount: 0,
        totalCount: 0,
        variable: null,
        year: null,
        returnFocus: null
    };

    function normalize(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase();
    }

    function getElements() {
        return {
            modal: document.getElementById("institutional-modal"),
            close: document.getElementById("institutional-modal-close"),
            title: document.getElementById("ranking-variable-title"),
            description: document.getElementById("ranking-variable-description"),
            period: document.getElementById("ranking-period"),
            coverage: document.getElementById("ranking-coverage"),
            searchWrap: document.querySelector(".ranking-search-wrap"),
            search: document.getElementById("ranking-search-input"),
            searchStatus: document.getElementById("ranking-search-status"),
            tableWrap: document.getElementById("ranking-table-wrap"),
            tableBody: document.getElementById("ranking-table-body"),
            empty: document.getElementById("ranking-empty"),
            citationDate: document.getElementById("citation-current-date")
        };
    }

    function currentSelection() {
        return state.context?.getState?.() || { selectedVariable: "normal", selectedYear: null };
    }

    function formatPeriod(config, year) {
        const coverage = config?.temporal || {};
        if (coverage.tipo === "anual") return `Año ${year}`;
        const years = coverage.anios_disponibles || [];
        return years.length ? `Dato fijo · ${years.join("–")}` : "Dato fijo";
    }

    function formatValue(config, value) {
        try {
            return config?.format
                ? config.format(value)
                : value.toLocaleString("es-EC", { maximumFractionDigits: 3 });
        } catch (error) {
            return value.toLocaleString("es-EC", { maximumFractionDigits: 3 });
        }
    }

    function compareRows(a, b) {
        const direction = state.sortDirection === "asc" ? 1 : -1;
        if (state.sortKey === "value") {
            const difference = a.value - b.value;
            return difference ? difference * direction : collator.compare(a.canton, b.canton);
        }
        if (state.sortKey === "rank") return (a.rank - b.rank) * direction;
        const key = state.sortKey === "province" ? "province" : "canton";
        const comparison = collator.compare(a[key], b[key]);
        return comparison ? comparison * direction : a.rank - b.rank;
    }

    function updateSortState() {
        document.querySelectorAll("[data-ranking-sort]").forEach(button => {
            const active = button.dataset.rankingSort === state.sortKey;
            const header = button.closest("th");
            if (header) header.setAttribute("aria-sort", active ? (state.sortDirection === "asc" ? "ascending" : "descending") : "none");
            button.classList.toggle("active", active);
        });
    }

    function renderRows() {
        const elements = getElements();
        const query = normalize(state.query);
        const filtered = state.rows
            .filter(row => !query || normalize(`${row.canton} ${row.province}`).includes(query))
            .sort(compareRows);
        state.displayedRows = filtered;
        elements.tableBody.innerHTML = "";

        filtered.forEach(row => {
            const tableRow = document.createElement("tr");
            if (query) tableRow.classList.add("is-highlighted");
            tableRow.dataset.cantonCode = row.code;
            const positionCell = document.createElement("td");
            const cantonCell = document.createElement("th");
            const provinceCell = document.createElement("td");
            const valueCell = document.createElement("td");
            positionCell.className = "ranking-position";
            positionCell.textContent = String(row.rank);
            cantonCell.scope = "row";
            cantonCell.textContent = row.canton;
            provinceCell.textContent = row.province;
            valueCell.className = "ranking-value";
            valueCell.textContent = row.formattedValue;
            tableRow.append(positionCell, cantonCell, provinceCell, valueCell);
            elements.tableBody.appendChild(tableRow);
        });

        if (!query) {
            elements.searchStatus.textContent = "";
        } else if (!filtered.length) {
            elements.searchStatus.textContent = "No se encontró un cantón con ese nombre.";
        } else if (filtered.length === 1) {
            elements.searchStatus.textContent = `${filtered[0].canton}: posición nacional ${filtered[0].rank} de ${state.rows.length} cantones con datos.`;
        } else {
            elements.searchStatus.textContent = `${filtered.length} coincidencias. La posición conserva el orden nacional de la variable activa.`;
        }
        updateSortState();
    }

    function renderUnavailable(config, year, reason) {
        const elements = getElements();
        state.rows = [];
        state.displayedRows = [];
        state.excludedCount = state.totalCount;
        elements.title.textContent = config?.label || "Ranking nacional";
        elements.description.textContent = config?.description || "";
        elements.period.textContent = formatPeriod(config, year);
        elements.coverage.textContent = `${state.totalCount} cantones excluidos: no existe un valor cantonal comparable para esta selección.`;
        elements.searchWrap.hidden = true;
        elements.tableWrap.hidden = true;
        elements.empty.hidden = false;
        elements.empty.textContent = reason;
        elements.tableBody.innerHTML = "";
        elements.searchStatus.textContent = "";
    }

    function buildRanking() {
        if (!state.context) return;
        const elements = getElements();
        const selection = currentSelection();
        const config = state.context.variables?.[selection.selectedVariable];
        const features = state.context.cantonFeatures || [];
        state.variable = selection.selectedVariable;
        state.year = Number(selection.selectedYear);
        state.totalCount = features.length;

        if (!config || selection.selectedVariable === "normal" || !config.levels?.includes("canton")) {
            renderUnavailable(
                config,
                state.year,
                "La variable activa no tiene un dato numérico comparable a nivel cantonal. Se conserva la vista sin inventar equivalencias."
            );
            return;
        }

        const validRows = [];
        features.forEach(feature => {
            const props = feature.properties || {};
            const rawValue = state.context.getVariableValue?.(props, selection.selectedVariable, state.year);
            if (rawValue === null || rawValue === undefined || rawValue === "sin_dato") return;
            const value = Number(rawValue);
            if (!Number.isFinite(value)) return;
            validRows.push({
                code: String(props.DPA_CANTON || ""),
                canton: String(props.DPA_DESCAN || "Cantón sin nombre"),
                province: String(props.DPA_DESPRO || "Provincia sin nombre"),
                value,
                formattedValue: formatValue(config, value)
            });
        });

        validRows
            .sort((a, b) => (b.value - a.value) || collator.compare(a.canton, b.canton))
            .forEach((row, index) => { row.rank = index + 1; });

        state.rows = validRows;
        state.excludedCount = state.totalCount - validRows.length;
        elements.title.textContent = config.label;
        elements.description.textContent = config.description;
        elements.period.textContent = formatPeriod(config, state.year);
        elements.coverage.textContent = `${validRows.length} cantones con dato comparable. ${state.excludedCount} cantones sin dato fueron excluidos del ranking; no se trataron como cero.`;
        elements.searchWrap.hidden = false;
        elements.tableWrap.hidden = !validRows.length;
        elements.empty.hidden = Boolean(validRows.length);
        elements.empty.textContent = validRows.length
            ? ""
            : `No hay datos cantonales para ${formatPeriod(config, state.year).toLowerCase()}. No se sustituyeron con cero ni con otro año.`;
        renderRows();
    }

    function setTab(tab, focus = false) {
        const validTab = ["ranking", "trust", "citation"].includes(tab) ? tab : "ranking";
        state.activeTab = validTab;
        document.querySelectorAll("[data-institutional-tab]").forEach(button => {
            const active = button.dataset.institutionalTab === validTab;
            button.setAttribute("aria-selected", String(active));
            button.tabIndex = active ? 0 : -1;
            if (active && focus) button.focus();
        });
        document.querySelectorAll("[data-institutional-panel]").forEach(panel => {
            panel.hidden = panel.dataset.institutionalPanel !== validTab;
        });
        if (validTab === "ranking") buildRanking();
    }

    function updateCitationDate() {
        const target = getElements().citationDate;
        if (!target) return;
        target.textContent = new Intl.DateTimeFormat("es-EC", {
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(new Date());
    }

    function open(tab = "ranking") {
        const elements = getElements();
        if (!elements.modal) return false;
        state.returnFocus = document.activeElement;
        state.query = "";
        if (elements.search) elements.search.value = "";
        updateCitationDate();
        elements.modal.hidden = false;
        elements.modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("institutional-modal-open");
        setTab(tab);
        elements.close?.focus({ preventScroll: true });
        return true;
    }

    function close() {
        const elements = getElements();
        if (!elements.modal || elements.modal.hidden) return false;
        elements.modal.hidden = true;
        elements.modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("institutional-modal-open");
        if (state.returnFocus instanceof HTMLElement) state.returnFocus.focus({ preventScroll: true });
        state.returnFocus = null;
        return true;
    }

    function trapFocus(event) {
        const modal = getElements().modal;
        if (event.key !== "Tab" || !modal || modal.hidden) return;
        const focusable = Array.from(modal.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'))
            .filter(element => !element.closest("[hidden]") && element.getClientRects().length);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function init(context) {
        if (state.initialized) return;
        state.initialized = true;
        state.context = context;
        const elements = getElements();

        document.getElementById("open-institutional-button")?.addEventListener("click", () => open("ranking"));
        elements.close?.addEventListener("click", close);
        elements.modal?.addEventListener("click", event => {
            if (event.target === elements.modal) close();
        });
        elements.modal?.addEventListener("keydown", event => {
            if (event.key === "Escape") close();
            trapFocus(event);
        });
        elements.search?.addEventListener("input", event => {
            state.query = event.target.value;
            renderRows();
        });
        document.querySelectorAll("[data-ranking-sort]").forEach(button => {
            button.addEventListener("click", () => {
                const key = button.dataset.rankingSort;
                if (state.sortKey === key) {
                    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
                } else {
                    state.sortKey = key;
                    state.sortDirection = key === "value" ? "desc" : "asc";
                }
                renderRows();
            });
        });
        const tabs = Array.from(document.querySelectorAll("[data-institutional-tab]"));
        tabs.forEach((button, index) => {
            button.addEventListener("click", () => setTab(button.dataset.institutionalTab));
            button.addEventListener("keydown", event => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                let targetIndex = index;
                if (event.key === "ArrowLeft") targetIndex = (index - 1 + tabs.length) % tabs.length;
                if (event.key === "ArrowRight") targetIndex = (index + 1) % tabs.length;
                if (event.key === "Home") targetIndex = 0;
                if (event.key === "End") targetIndex = tabs.length - 1;
                setTab(tabs[targetIndex].dataset.institutionalTab, true);
            });
        });
        updateCitationDate();

        window.__redsaInstitutionalAudit = {
            open,
            close,
            setTab,
            state() {
                return {
                    activeTab: state.activeTab,
                    variable: state.variable,
                    year: state.year,
                    totalCount: state.totalCount,
                    validCount: state.rows.length,
                    excludedCount: state.excludedCount,
                    sortKey: state.sortKey,
                    sortDirection: state.sortDirection,
                    rows: state.rows.map(row => ({ ...row })),
                    displayedRows: state.displayedRows.map(row => ({ ...row }))
                };
            }
        };
    }

    function refresh() {
        const modal = getElements().modal;
        if (state.initialized && modal && !modal.hidden && state.activeTab === "ranking") buildRanking();
    }

    window.REDSAInstitutional = Object.freeze({ init, open, close, refresh });
})();
