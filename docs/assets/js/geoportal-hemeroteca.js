/**
 * geoportal-hemeroteca.js
 * Módulo para el panel lateral / bottom-sheet de Hemeroteca en el geoportal.
 */
(function(window) {
    "use strict";

    const HEMEROTECA_CONFIG = {
        dataUrl: "data/hemeroteca.json",
        defaultFecha: null,
        temaLabels: {
            siniestro: "Siniestros",
            normativa: "Normativa",
            infraestructura: "Infraestructura",
            movilidad_activa: "Movilidad activa",
            motociclistas: "Motociclistas",
            transporte_publico: "Transporte público",
            control_policial: "Control policial",
            salud_vial: "Salud vial",
            educacion_vial: "Educación vial",
            investigacion: "Investigación",
            otro: "Otro"
        }
    };

    const SPANISH_MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    let cachedNews = null;
    let isFetching = false;
    let activeCategory = "todas";
    let activeDate = null;
    let datePickerInstance = null;
    let initialized = false;

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getIsoDate(dateStr) {
        if (!dateStr || typeof dateStr !== "string") return "";
        return dateStr.slice(0, 10);
    }

    function formatDisplayDate(isoDateStr) {
        if (!isoDateStr) return "";
        const parts = isoDateStr.slice(0, 10).split("-");
        if (parts.length !== 3) return isoDateStr;
        const year = parts[0];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const day = parts[2];
        const monthName = SPANISH_MONTHS[monthIdx] || parts[1];
        return `${day} ${monthName} ${year}`;
    }

    async function loadData() {
        if (cachedNews) return cachedNews;
        if (isFetching) return null;
        isFetching = true;

        const loadingEl = document.getElementById("hemeroteca-loading");
        if (loadingEl) loadingEl.hidden = false;

        try {
            const response = await fetch(HEMEROTECA_CONFIG.dataUrl);
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            const data = await response.json();
            const rawList = Array.isArray(data?.noticias) ? data.noticias : [];
            // Excluir estrictamente las marcadas como oculto === true
            cachedNews = rawList.filter(item => !item.oculto);
            // Ordenar por fecha_publicacion descendente (más reciente primero)
            cachedNews.sort((a, b) => {
                const dateA = new Date(a.fecha_publicacion).getTime() || 0;
                const dateB = new Date(b.fecha_publicacion).getTime() || 0;
                return dateB - dateA;
            });
            return cachedNews;
        } catch (err) {
            console.error("[Hemeroteca] Error al cargar noticias:", err);
            cachedNews = [];
            return cachedNews;
        } finally {
            isFetching = false;
            if (loadingEl) loadingEl.hidden = true;
        }
    }

    function getSvgPlaceholder() {
        return `<div class="hemeroteca-thumb-placeholder" aria-hidden="true">
            <svg class="hemeroteca-thumb-placeholder-svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path>
                <path d="M18 14h-8"></path>
                <path d="M15 18h-5"></path>
                <path d="M10 6h8v4h-8V6Z"></path>
            </svg>
        </div>`;
    }

    function renderChips(container) {
        if (!container) return;
        container.innerHTML = "";

        const allCategories = [
            { id: "todas", label: "Todas" },
            ...Object.entries(HEMEROTECA_CONFIG.temaLabels).map(([id, label]) => ({ id, label }))
        ];

        allCategories.forEach(cat => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `hemeroteca-chip ${cat.id === activeCategory ? "is-active" : ""}`;
            btn.dataset.tema = cat.id;
            btn.setAttribute("role", "radio");
            btn.setAttribute("aria-checked", String(cat.id === activeCategory));
            btn.textContent = cat.label;

            btn.addEventListener("click", () => {
                if (activeCategory === cat.id) return;
                activeCategory = cat.id;
                container.querySelectorAll(".hemeroteca-chip").forEach(c => {
                    const isSelected = c.dataset.tema === activeCategory;
                    c.classList.toggle("is-active", isSelected);
                    c.setAttribute("aria-checked", String(isSelected));
                });
                renderNews();
            });

            container.appendChild(btn);
        });
    }

    function iniciarDatePicker(noticias) {
        const fechasDisponibles = [...new Set(
            noticias
                .filter(n => !n.oculto && n.fecha_publicacion)
                .map(n => n.fecha_publicacion.slice(0, 10))
        )].sort();

        const input = document.getElementById("hemeroteca-date-input");
        const clearBtn = document.getElementById("hemeroteca-date-clear");
        if (!input || !clearBtn) return;

        if (typeof window.flatpickr !== "function") {
            console.warn("[Hemeroteca] Flatpickr no está disponible; se omite el filtro de fecha.");
            return;
        }

        datePickerInstance = window.flatpickr(input, {
            locale: "es",
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "j M Y",
            enable: fechasDisponibles,
            disableMobile: false,
            onChange: function(selectedDates, dateStr) {
                if (dateStr) {
                    activeDate = dateStr;
                    clearBtn.hidden = false;
                    renderNews();
                }
            }
        });

        clearBtn.addEventListener("click", function() {
            datePickerInstance.clear();
            activeDate = null;
            clearBtn.hidden = true;
            renderNews();
        });
    }

    function updateTodayBadge(newsList) {
        const badge = document.getElementById("hemeroteca-today-badge");
        if (!badge) return;

        const todayIso = new Date().toISOString().slice(0, 10);
        const countToday = newsList.filter(item => getIsoDate(item.fecha_publicacion) === todayIso).length;

        badge.textContent = `${countToday} hoy`;
        badge.hidden = false;
    }

    function renderNews() {
        const listEl = document.getElementById("hemeroteca-news-list");
        const emptyEl = document.getElementById("hemeroteca-empty");
        const loadingEl = document.getElementById("hemeroteca-loading");
        if (!listEl) return;

        if (loadingEl) loadingEl.hidden = true;

        if (!cachedNews) {
            return;
        }

        const filtered = cachedNews.filter(item => {
            if (activeCategory !== "todas" && item.tema !== activeCategory) {
                return false;
            }
            if (activeDate && activeDate !== "todas") {
                const itemDate = getIsoDate(item.fecha_publicacion);
                if (itemDate !== activeDate) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            listEl.innerHTML = "";
            listEl.hidden = true;
            if (emptyEl) emptyEl.hidden = false;
            return;
        }

        if (emptyEl) emptyEl.hidden = true;
        listEl.hidden = false;

        const cardsHtml = filtered.map(item => {
            const catLabel = HEMEROTECA_CONFIG.temaLabels[item.tema] || item.tema || "General";
            const sourceName = (item.fuente || "Fuente").toUpperCase();
            const dateStr = formatDisplayDate(item.fecha_publicacion);
            const safeTitle = escapeHtml(item.titulo);
            const safeResumen = escapeHtml(item.resumen || "");
            const hasOg = Boolean(item.imagen_og);

            const mediaHtml = hasOg
                ? `<div class="hemeroteca-card-media">
                     <img src="${escapeHtml(item.imagen_og)}" alt="" loading="lazy" class="hemeroteca-thumb-img" onerror="this.classList.add('is-hidden'); this.nextElementSibling.classList.remove('is-hidden');">
                     <div class="hemeroteca-thumb-fallback is-hidden">${getSvgPlaceholder()}</div>
                     <span class="hemeroteca-card-category-badge">${escapeHtml(catLabel)}</span>
                   </div>`
                : `<div class="hemeroteca-card-media">
                     ${getSvgPlaceholder()}
                     <span class="hemeroteca-card-category-badge">${escapeHtml(catLabel)}</span>
                   </div>`;

            return `
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="hemeroteca-card" aria-label="${safeTitle}">
                ${mediaHtml}
                <div class="hemeroteca-card-content">
                    <div class="hemeroteca-card-meta">
                        <span class="hemeroteca-card-source">${escapeHtml(sourceName)}</span>
                        <span class="hemeroteca-card-dot" aria-hidden="true">•</span>
                        <time class="hemeroteca-card-date" datetime="${escapeHtml(item.fecha_publicacion)}">${dateStr}</time>
                    </div>
                    <h3 class="hemeroteca-card-title">${safeTitle}</h3>
                    ${safeResumen ? `<p class="hemeroteca-card-summary">${safeResumen}</p>` : ""}
                </div>
            </a>
            `;
        }).join("");

        listEl.innerHTML = cardsHtml;
    }

    async function init() {
        if (initialized) {
            return;
        }
        initialized = true;

        const chipsContainer = document.getElementById("hemeroteca-category-chips");
        renderChips(chipsContainer);

        const news = await loadData();
        if (news) {
            iniciarDatePicker(news);
            updateTodayBadge(news);
            renderNews();
        }
    }

    window.REDSAHemeroteca = {
        config: HEMEROTECA_CONFIG,
        init,
        render: renderNews,
        setFilter: (category, date) => {
            if (category !== undefined) activeCategory = category;
            if (date !== undefined) {
                activeDate = date;
                const clearBtn = document.getElementById("hemeroteca-date-clear");
                if (clearBtn) clearBtn.hidden = !date;
                if (datePickerInstance) {
                    if (date) datePickerInstance.setDate(date);
                    else datePickerInstance.clear();
                }
            }
            renderNews();
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            init();
        });
    } else {
        init();
    }

})(window);
