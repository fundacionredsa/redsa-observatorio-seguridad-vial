// @ts-check
import { test, expect } from "@playwright/test";

test.describe("Panel Hemeroteca en Geoportal", () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem("redsa_tour_seen", "true");
            window.localStorage.setItem("has_seen_geoportal_tour", "true");
            window.localStorage.setItem("redsa_tour_v2_visto", "true");
        });
    });

    test("el botón de Hemeroteca en el riel derecho cumple accesibilidad y touch target ≥ 44px", async ({ page }) => {
        await page.goto("./", { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
        await expect(page.locator("#loader")).toBeHidden({ timeout: 90_000 });

        const btn = page.locator("#right-tab-hemeroteca");
        await expect(btn).toBeVisible();
        await expect(btn).toHaveAttribute("data-right-panel", "hemeroteca");
        await expect(btn).toHaveAttribute("title", "Hemeroteca de noticias");
        await expect(btn.locator("i.fa-newspaper")).toBeVisible();
        await expect(btn.locator(".right-tool-label-vertical")).toHaveText("NOTICIAS");

        const box = await btn.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
        }
    });

    test("abre y cierra el panel Hemeroteca con header, badge y botón de cierre de 44px", async ({ page }) => {
        await page.goto("./", { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
        await expect(page.locator("#loader")).toBeHidden({ timeout: 90_000 });

        const btn = page.locator("#right-tab-hemeroteca");
        const panel = page.locator("#hemeroteca-panel");

        await expect(panel).toBeHidden();

        await btn.click();
        await expect(panel).toBeVisible();
        await expect(btn).toHaveAttribute("aria-selected", "true");
        await expect(btn).toHaveAttribute("aria-expanded", "true");

        // Header
        await expect(panel.locator(".hemeroteca-panel-title")).toHaveText("Hemeroteca");
        const todayBadge = panel.locator("#hemeroteca-today-badge");
        await expect(todayBadge).toBeVisible();
        await expect(todayBadge).toContainText("hoy");

        // Close button touch target
        const closeBtn = panel.locator("#hemeroteca-panel-close");
        await expect(closeBtn).toBeVisible();
        const closeBox = await closeBtn.boundingBox();
        expect(closeBox).not.toBeNull();
        if (closeBox) {
            expect(closeBox.width).toBeGreaterThanOrEqual(44);
            expect(closeBox.height).toBeGreaterThanOrEqual(44);
        }

        // Close via close button
        await closeBtn.click();
        await expect(panel).toBeHidden();
        await expect(btn).toHaveAttribute("aria-selected", "false");
    });

    test("filtros de categorías y fechas con touch target ≥ 44px y reactividad", async ({ page }) => {
        await page.goto("./", { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
        await expect(page.locator("#loader")).toBeHidden({ timeout: 90_000 });

        await page.locator("#right-tab-hemeroteca").click();
        const panel = page.locator("#hemeroteca-panel");
        await expect(panel).toBeVisible();

        // 12 chips: Todas + 11 categorías
        const chips = panel.locator(".hemeroteca-chip");
        await expect(chips).toHaveCount(12);

        // Touch target de cada chip ≥ 44px
        const firstChipBox = await chips.first().boundingBox();
        expect(firstChipBox).not.toBeNull();
        if (firstChipBox) {
            expect(firstChipBox.height).toBeGreaterThanOrEqual(44);
        }

        // Chip "Todas" activo por defecto
        await expect(chips.first()).toHaveAttribute("aria-checked", "true");
        await expect(chips.first()).toHaveClass(/is-active/);

        // Date picker Flatpickr: touch target ≥ 44px
        const dateInput = panel.locator(".hemeroteca-date-picker-wrapper input:not([type='hidden'])");
        await expect(dateInput).toBeVisible();
        const dateBox = await dateInput.boundingBox();
        expect(dateBox).not.toBeNull();
        if (dateBox) {
            expect(dateBox.height).toBeGreaterThanOrEqual(44);
        }

        // Flatpickr debe habilitar únicamente fechas que tienen noticias.
        const datePickerState = await panel.locator("#hemeroteca-date-input").evaluate(input => {
            const instance = input._flatpickr;
            if (!instance) return null;
            const firstEnabled = instance.config.enable[0];
            const firstDate = firstEnabled instanceof Date ? firstEnabled : new Date(firstEnabled);
            return {
                enabledCount: instance.config.enable.length,
                firstDate: instance.formatDate(firstDate, "Y-m-d")
            };
        });
        expect(datePickerState).not.toBeNull();
        expect(datePickerState.enabledCount).toBeGreaterThan(1);

        // Tarjetas visibles
        const cards = panel.locator(".hemeroteca-card");
        const initialCount = await cards.count();
        expect(initialCount).toBeGreaterThan(0);

        // Seleccionar y limpiar una fecha debe filtrar y restaurar las tarjetas.
        await page.evaluate(date => window.REDSAHemeroteca.setFilter(undefined, date), datePickerState.firstDate);
        await expect(panel.locator("#hemeroteca-date-clear")).toBeVisible();
        expect(await cards.count()).toBeLessThanOrEqual(initialCount);
        await panel.locator("#hemeroteca-date-clear").click();
        await expect(panel.locator("#hemeroteca-date-clear")).toBeHidden();
        await expect(cards).toHaveCount(initialCount);

        // Cada tarjeta es clickable con target="_blank"
        const firstCard = cards.first();
        await expect(firstCard).toHaveAttribute("target", "_blank");
        await expect(firstCard).toHaveAttribute("rel", "noopener noreferrer");

        // Thumbnail / media 80x60
        const mediaBox = await firstCard.locator(".hemeroteca-card-media").boundingBox();
        expect(mediaBox).not.toBeNull();
        if (mediaBox) {
            expect(Math.round(mediaBox.width)).toBe(80);
            expect(Math.round(mediaBox.height)).toBe(60);
        }

        // Badge de categoría sobre thumbnail
        await expect(firstCard.locator(".hemeroteca-card-category-badge")).toBeVisible();
    });

    test("comportamiento mobile en 390x844: bottom-sheet a 70vh", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("./", { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
        await expect(page.locator("#loader")).toBeHidden({ timeout: 90_000 });

        await page.locator("#right-tab-hemeroteca").click();
        const panel = page.locator("#hemeroteca-panel");
        await expect(panel).toBeVisible();

        const host = page.locator("#right-context-host");
        const hostBox = await host.boundingBox();
        expect(hostBox).not.toBeNull();
        if (hostBox) {
            // El ancho debe ser ~390px (100% viewport width)
            expect(hostBox.width).toBeCloseTo(390, -1);
            // El alto debe ser ~70% de 844px (590px +- 25px)
            expect(hostBox.height).toBeGreaterThan(500);
            expect(hostBox.height).toBeLessThan(650);
        }

        // El backdrop debe estar visible
        const backdrop = page.locator("#mobile-overlay-backdrop");
        await expect(backdrop).toBeVisible();

        // Cerrar desde backdrop
        await backdrop.click({ position: { x: 50, y: 50 } });
        await expect(panel).toBeHidden();
    });
});
