import { test, expect } from '@playwright/test';

test.describe('Observatory Improvements (Blocks B, C, D, E)', () => {

    test.beforeEach(async ({ page }) => {
        // Mock the backend/network if needed or just navigate to local index
        // Depending on existing tests, we might use a file:// url or a local server.
        // The project uses a local server in existing tests, usually `http://localhost:8080` or `http://127.0.0.1:8080/docs/`.
        // Let's rely on the same URL pattern as geoportal.spec.js
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
        await page.goto('./', { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 10_000 });
    });

    test.describe('Block B: Guided Tour', () => {
        test('tour appears on first visit, can be closed and reopened', async ({ page }) => {
            // First visit (localStorage is empty by default in Playwright incognito context)
            
            const driverType = await page.evaluate(() => typeof window.driver);
            console.log('TYPEOF WINDOW.DRIVER:', driverType);

            if (driverType === 'object') {
                const innerType = await page.evaluate(() => typeof window.driver.js);
                console.log('TYPEOF WINDOW.DRIVER.JS:', innerType);
            }

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
});
