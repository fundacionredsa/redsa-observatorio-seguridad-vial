// @ts-check
import { test, expect } from "@playwright/test";

test.describe("Hemeroteca de Seguridad Vial (Fase 23)", () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem("redsa_tour_seen", "true");
            window.localStorage.setItem("has_seen_geoportal_tour", "true");
            window.localStorage.setItem("redsa_tour_v2_visto", "true");
        });
    });

    test("el botón de Hemeroteca existe en el menú superior del geoportal y navega a la página", async ({ page }) => {
        await page.goto("./", { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
        await expect(page.locator("#loader")).toBeHidden({ timeout: 90_000 });

        const menuToggle = page.locator("#site-topbar-menu-toggle");
        await menuToggle.click();
        const hemerotecaBtn = page.locator("#site-topbar-actions #btn-hemeroteca");
        await expect(hemerotecaBtn).toBeVisible();
        await expect(hemerotecaBtn).toHaveAttribute("href", "hemeroteca/");
        await expect(hemerotecaBtn).toContainText("Hemeroteca");

        await hemerotecaBtn.click();
        await expect(page).toHaveURL(/.*hemeroteca/);
        await expect(page.locator("h1")).toContainText("Hemeroteca de Seguridad Vial");
    });

    test("la página de Hemeroteca muestra el estado vacío elegante cuando no hay noticias", async ({ page }) => {
        await page.route("**/data/hemeroteca.json", async route => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ schema_version: 1, actualizado_en: "2026-09-10T00:00:00Z", noticias: [] })
            });
        });

        await page.goto("./hemeroteca/", { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => window.__hemerotecaLoaded === true, null, { timeout: 30_000 });

        await expect(page.locator("#hemeroteca-empty")).toBeVisible();
        await expect(page.locator("#hemeroteca-empty h3")).toContainText("Sin noticias registradas todavía");
        await expect(page.locator("#hemeroteca-counter")).toContainText("0 noticias");
        await expect(page.locator("#hemeroteca-back-map")).toHaveAttribute("href", "../");
        await expect(page.locator("#hemeroteca-to-methodology")).toHaveAttribute("href", "../metodologia/");
    });

    test("renderiza noticias cronológicamente y excluye estrictamente entradas con oculto: true", async ({ page }) => {
        const fixtureData = {
            schema_version: 1,
            actualizado_en: "2026-09-08T15:00:00Z",
            noticias: [
                {
                    id: "noticia-1-sept7",
                    titulo: "Siniestro en la Panamericana Norte deja dos personas heridas",
                    fuente: "El Comercio",
                    fecha_publicacion: "2026-09-07T14:30:00Z",
                    url: "https://www.elcomercio.com/actualidad/siniestro-panamericana-norte.html",
                    resumen: "Choque frontal entre dos vehículos livianos a la altura de Calderón.",
                    tema: "siniestro",
                    oculto: false
                },
                {
                    id: "noticia-oculta-clasificada",
                    titulo: "TITULO CONFIDENCIAL QUE NUNCA DEBE APARECER EN EL DOM",
                    fuente: "Primicias",
                    fecha_publicacion: "2026-09-08T10:00:00Z",
                    url: "https://www.primicias.ec/noticia-oculta.html",
                    resumen: "Este resumen clasificado jamás debe estar visible para el usuario.",
                    tema: "política pública",
                    oculto: true
                },
                {
                    id: "noticia-sin-resumen-sept6",
                    titulo: "Inauguración de nueva infraestructura ciclista en Cuenca",
                    fuente: "El Universo",
                    fecha_publicacion: "2026-09-06T09:00:00Z",
                    url: "https://www.eluniverso.com/noticias/ciclovia-cuenca.html",
                    resumen: "",
                    tema: "infraestructura",
                    oculto: false
                },
                {
                    id: "noticia-antigua-agosto",
                    titulo: "Campaña de concienciación sobre límites de velocidad en zonas escolares",
                    fuente: "Expreso",
                    fecha_publicacion: "2026-08-15T08:00:00Z",
                    url: "https://www.expreso.ec/actualidad/seguridad-vial-escolar.html",
                    resumen: "Capacitaciones preventivas dirigidas a conductores de transporte escolar.",
                    tema: "seguridad vial",
                    oculto: false
                }
            ]
        };

        await page.route("**/docs/data/hemeroteca.json*", route => {
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(fixtureData)
            });
        });

        await page.goto("./hemeroteca/", { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => window.__hemerotecaLoaded === true, null, { timeout: 30_000 });

        // 1. Verificación de exclusión obligatoria de oculto: true
        await expect(page.locator("text=TITULO CONFIDENCIAL QUE NUNCA DEBE APARECER EN EL DOM")).toHaveCount(0);
        await expect(page.locator("[data-news-id='noticia-oculta-clasificada']")).toHaveCount(0);
        await expect(page.locator("text=Este resumen clasificado jamás debe estar visible")).toHaveCount(0);

        // 2. Conteo de noticias públicas visibles: deben ser 3 (no 4)
        const cards = page.locator("#hemeroteca-feed .hemeroteca-card");
        await expect(cards).toHaveCount(3);
        await expect(page.locator("#hemeroteca-counter")).toContainText("3 noticias encontradas");

        // 3. Verificación de tarjeta completa con resumen
        const firstCard = cards.nth(0);
        await expect(firstCard.locator(".hemeroteca-source-badge")).toHaveText("El Comercio");
        await expect(firstCard.locator(".hemeroteca-card-title a")).toContainText("Siniestro en la Panamericana");
        await expect(firstCard.locator(".hemeroteca-card-title a")).toHaveAttribute("href", "https://www.elcomercio.com/actualidad/siniestro-panamericana-norte.html");
        await expect(firstCard.locator(".hemeroteca-card-title a")).toHaveAttribute("target", "_blank");
        await expect(firstCard.locator(".hemeroteca-card-title a")).toHaveAttribute("rel", "noopener noreferrer");
        await expect(firstCard.locator(".hemeroteca-card-resumen")).toHaveText("Choque frontal entre dos vehículos livianos a la altura de Calderón.");
        await expect(firstCard.locator(".hemeroteca-topic-tag")).toHaveText("siniestro");

        // 4. Verificación de tarjeta sin resumen (no debe inventar texto)
        const secondCard = cards.nth(1);
        await expect(secondCard.locator(".hemeroteca-card-title a")).toContainText("Inauguración de nueva infraestructura ciclista");
        await expect(secondCard.locator(".hemeroteca-card-resumen")).toHaveCount(0);
        await expect(secondCard.locator(".hemeroteca-topic-tag")).toHaveText("infraestructura");

        // 5. Verificación de orden cronológico: Sept 7 -> Sept 6 -> Agosto 15
        const thirdCard = cards.nth(2);
        await expect(thirdCard.locator(".hemeroteca-card-title a")).toContainText("Campaña de concienciación");
    });

    test("los filtros de tema, fuente, fecha y búsqueda por texto funcionan reactivamente", async ({ page }) => {
        const fixtureData = {
            schema_version: 1,
            actualizado_en: "2026-09-08T15:00:00Z",
            noticias: [
                {
                    id: "n-1",
                    titulo: "Colisión múltiple en vía a la Costa",
                    fuente: "El Comercio",
                    fecha_publicacion: "2026-09-07T14:30:00Z",
                    url: "https://www.elcomercio.com/colision-costa.html",
                    resumen: "Tres vehículos involucrados sin víctimas fatales.",
                    tema: "siniestro",
                    oculto: false
                },
                {
                    id: "n-2",
                    titulo: "Reforma al código vial en la Asamblea",
                    fuente: "Primicias",
                    fecha_publicacion: "2026-09-05T10:00:00Z",
                    url: "https://www.primicias.ec/reforma-vial.html",
                    resumen: "Debate legislativo sobre sanciones a infractores de tránsito.",
                    tema: "política pública",
                    oculto: false
                },
                {
                    id: "n-3",
                    titulo: "Ampliación de ciclo-sendas en Ambato",
                    fuente: "El Universo",
                    fecha_publicacion: "2026-08-20T09:00:00Z",
                    url: "https://www.eluniverso.com/ciclosendas-ambato.html",
                    resumen: "Construcción de diez kilómetros de vías protegidas.",
                    tema: "infraestructura",
                    oculto: false
                }
            ]
        };

        await page.route("**/docs/data/hemeroteca.json*", route => {
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(fixtureData)
            });
        });

        await page.goto("./hemeroteca/", { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => window.__hemerotecaLoaded === true, null, { timeout: 30_000 });

        const cards = page.locator("#hemeroteca-feed .hemeroteca-card");
        await expect(cards).toHaveCount(3);

        // Filtro por tema (chip)
        const chipInfra = page.locator(".hemeroteca-chip[data-topic='infraestructura']");
        await chipInfra.click();
        await expect(chipInfra).toHaveAttribute("aria-pressed", "true");
        await expect(cards).toHaveCount(1);
        await expect(cards.first().locator(".hemeroteca-card-title")).toContainText("Ampliación de ciclo-sendas");

        // Restablecer filtros
        await page.locator("#hemeroteca-reset-filters").click();
        await expect(cards).toHaveCount(3);

        // Filtro por fuente
        const sourceSelect = page.locator("#hemeroteca-source-select");
        await sourceSelect.selectOption("Primicias");
        await expect(cards).toHaveCount(1);
        await expect(cards.first().locator(".hemeroteca-card-title")).toContainText("Reforma al código vial");

        // Filtro por búsqueda textual
        await page.locator("#hemeroteca-reset-filters").click();
        const searchInput = page.locator("#hemeroteca-search");
        await searchInput.fill("Costa");
        await expect(cards).toHaveCount(1);
        await expect(cards.first().locator(".hemeroteca-card-title")).toContainText("Colisión múltiple");

        // Búsqueda sin coincidencias
        await searchInput.fill("término inexistente");
        await expect(cards).toHaveCount(0);
        await expect(page.locator("#hemeroteca-no-results")).toBeVisible();
        await expect(page.locator("#hemeroteca-no-results h3")).toContainText("No se encontraron noticias");
    });
});
