(function() {
    let catalogData = null;

    async function loadCatalog() {
        if (catalogData) return catalogData;
        try {
            const response = await fetch('data/catalogo_metadatos.json');
            if (!response.ok) throw new Error("No se pudo cargar el catálogo");
            catalogData = await response.json();
            return catalogData;
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    function renderStats(stats) {
        const container = document.getElementById("catalog-summary-stats");
        if (!container || !stats) return;
        
        container.innerHTML = `
            <strong>Transparencia de Datos:</strong><br>
            <span style="color: #005a9c;">&#9679;</span> ${stats.pct_variables_con_fuente_documentada}% de variables tienen su fuente documentada explícitamente.<br>
            <span style="color: #005a9c;">&#9679;</span> ${stats.pct_cobertura_sin_dato_declarado}% de variables declaran "sin_dato" explícitamente cuando falta información (en lugar de imputar o dejar en blanco).
        `;
    }

    function renderCatalog(variables, query = "", category = "todas") {
        const container = document.getElementById("catalog-results");
        if (!container) return;

        container.innerHTML = "";

        const q = query.toLowerCase();
        
        const filtered = variables.filter(v => {
            const matchQuery = v.label.toLowerCase().includes(q) || (v.fuente && v.fuente.toLowerCase().includes(q));
            const matchCat = category === "todas" || v.categoria === category;
            return matchQuery && matchCat;
        });

        if (filtered.length === 0) {
            container.innerHTML = `<p style="color: #666; text-align: center; padding: 20px;">No se encontraron variables que coincidan con la búsqueda.</p>`;
            return;
        }

        filtered.forEach(v => {
            const item = document.createElement("div");
            item.style.padding = "15px";
            item.style.border = "1px solid #e1e8ed";
            item.style.borderRadius = "8px";
            item.style.background = "#fff";
            
            const badgeCat = `<span style="background: #eef1f6; color: #005a9c; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; margin-bottom: 5px; display: inline-block;">${v.categoria}</span>`;
            const anios = v.anios_disponibles && v.anios_disponibles.length > 0 ? v.anios_disponibles.join(", ") : "N/A";
            const niveles = v.nivel_territorial_disponible ? v.nivel_territorial_disponible.map(n => n === "province" ? "Provincia" : (n === "canton" ? "Cantón" : "Parroquia")).join(", ") : "N/A";
            
            item.innerHTML = `
                ${badgeCat}
                <h4 style="margin: 0 0 10px 0; font-size: 16px; color: #1a1a1a;">${v.label}</h4>
                <div style="font-size: 13px; color: #555; display: grid; gap: 4px;">
                    <div><strong>Fuente:</strong> ${v.fuente || "No documentada"}</div>
                    <div><strong>Años disponibles:</strong> ${anios}</div>
                    <div><strong>Nivel territorial:</strong> ${niveles}</div>
                </div>
            `;
            container.appendChild(item);
        });
    }

    function initCatalogUI() {
        const modal = document.getElementById("catalog-modal");
        const btnOpen = document.getElementById("btn-catalog");
        const btnClose = document.getElementById("catalog-modal-close");
        const searchInput = document.getElementById("catalog-search");
        const catSelect = document.getElementById("catalog-category-filter");

        if (!modal || !btnOpen) return;

        // Toggle logic
        btnOpen.addEventListener("click", async () => {
            modal.hidden = false;
            modal.setAttribute("aria-hidden", "false");
            
            if (!catalogData) {
                const data = await loadCatalog();
                if (data) {
                    renderStats(data.resumen_transparencia);
                    
                    // Populate categories
                    const categories = [...new Set(data.variables.map(v => v.categoria))].sort();
                    categories.forEach(c => {
                        const opt = document.createElement("option");
                        opt.value = c;
                        opt.textContent = c;
                        catSelect.appendChild(opt);
                    });

                    renderCatalog(data.variables);
                }
            }
        });

        const closeModal = () => {
            modal.hidden = true;
            modal.setAttribute("aria-hidden", "true");
        };

        if (btnClose) btnClose.addEventListener("click", closeModal);
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });

        // Filter logic
        const updateFilter = () => {
            if (catalogData) {
                renderCatalog(catalogData.variables, searchInput.value, catSelect.value);
            }
        };

        if (searchInput) searchInput.addEventListener("input", updateFilter);
        if (catSelect) catSelect.addEventListener("change", updateFilter);
    }

    document.addEventListener("DOMContentLoaded", initCatalogUI);
})();
