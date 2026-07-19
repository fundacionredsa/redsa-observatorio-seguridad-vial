import { test, expect } from '@playwright/test';

test.describe('Observatory Improvements (Blocks B, C, D, E)', () => {

    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
        
        await page.goto('./', { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 10_000 });
        
        // Cierra el tour si aparece (excepto si estamos en el test del tour)
        const closeBtn = page.locator('.driver-popover-close-btn');
        // Usamos una pequeña espera no bloqueante
        await page.waitForTimeout(1500); 
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
        }
    });

    test.describe('Block B: Guided Tour', () => {
        test('tour appears on first visit, can be closed and reopened', async ({ page }) => {
            // By default, the first visit triggers it, which was handled by beforeEach above.
            // Let's clear localStorage and reload to ensure we get it fresh.
            await page.evaluate(() => localStorage.removeItem('redsa_tour_visto'));
            await page.reload({ waitUntil: "domcontentloaded" });
            
            const popover = page.locator('.driver-popover');
            await expect(popover).toBeVisible({ timeout: 5000 });
            await expect(popover.locator('.driver-popover-title')).toContainText('Bienvenido al Observatorio');

            // The close button (Omitir) should be present
            const closeBtn = page.locator('.driver-popover-close-btn');
            await expect(closeBtn).toBeVisible();

            // Click close
            await closeBtn.click();
            await expect(popover).toBeHidden();

            // Verify localStorage is set
            const flag = await page.evaluate(() => localStorage.getItem('redsa_tour_visto'));
            expect(flag).toBe('true');

            // Reload page - tour should NOT auto-start
            await page.evaluate(() => window.__TEST_ALLOW_TOUR = false); // Let it rely on localStorage now
            await page.reload();
            // Wait 2 seconds to ensure it doesn't appear
            await page.waitForTimeout(2000);
            await expect(popover).toBeHidden();

            // Click manual tour button
            const btnTour = page.locator('#btn-tour');
            await expect(btnTour).toBeVisible();
            await btnTour.click();

            // Tour should appear again
            await expect(popover).toBeVisible();
            await expect(popover.locator('.driver-popover-title')).toContainText('Bienvenido al Observatorio');
        });
    });

    test.describe('Block C: Data Catalog', () => {
        test('catalog modal opens and displays variables', async ({ page }) => {
            const btnCatalog = page.locator('#btn-catalog');
            await expect(btnCatalog).toBeVisible();
            await btnCatalog.click();

            const modal = page.locator('#catalog-modal');
            await expect(modal).toBeVisible();

            // Wait for fetch to complete and render
            const results = modal.locator('#catalog-results > div');
            await expect(results).toHaveCount(9, { timeout: 10000 });

            // Test search filter
            const searchInput = modal.locator('#catalog-search');
            await searchInput.fill('INEC');
            
            // Should filter out some, let's just check it updates
            await expect(results).not.toHaveCount(9, { timeout: 5000 });
            await expect(results.first()).toBeVisible();

            const closeBtn = modal.locator('#catalog-modal-close');
            await closeBtn.click();
            await expect(modal).toBeHidden();
        });
    });

    test.describe('Block D: Basemap and Opacity', () => {
        test('opacity slider changes overlayPane opacity', async ({ page }) => {
            // Check that the opacity control is on the map
            const slider = page.locator('.opacity-control input[type="range"]');
            await expect(slider).toBeVisible();

            // Set to 50%
            await slider.fill('50');
            // The event is 'input', dispatch it
            await slider.evaluate(node => {
                node.value = 50;
                node.dispatchEvent(new Event('input'));
            });

            // Check if overlayPane has opacity 0.5
            const overlayPane = page.locator('.leaflet-overlay-pane');
            await expect(overlayPane).toHaveCSS('opacity', '0.5', { timeout: 5000 });

            // Layer control should exist
            const layerControl = page.locator('.leaflet-top .leaflet-control-layers').first();
            await expect(layerControl).toBeVisible();
        });
    });
});
