// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Geoportal Mobile UX Improvements', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('redsa_tour_seen', 'true');
            window.localStorage.setItem('has_seen_geoportal_tour', 'true');
        });
        await page.goto('http://127.0.0.1:4173/docs/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        await page.evaluate(() => {
            const closeBtn = document.querySelector('.driver-popover-close-btn');
            if (closeBtn instanceof HTMLElement) closeBtn.click();
            const overlay = document.querySelector('.driver-overlay');
            if (overlay) overlay.remove();
        });
    });

    test('mobile citizen panel starts closed and can be toggled', async ({ page }) => {
        const isMobile = (page.viewportSize()?.width || 0) <= 768;
        test.skip(!isMobile, 'Mobile-only test');

        const citizenPanel = page.locator('#citizen-panel');
        const mobileCitizenToggle = page.locator('#mobile-citizen-toggle');
        const mobileCitizenClose = page.locator('#mobile-citizen-close');

        // Citizen panel starts closed on mobile
        await expect(page.locator('body')).not.toHaveClass(/mobile-citizen-open/);
        await expect(mobileCitizenToggle).toBeVisible();

        // Click toggle to open panel
        await mobileCitizenToggle.click();
        await expect(page.locator('body')).toHaveClass(/mobile-citizen-open/);

        // Click close button to close panel
        await mobileCitizenClose.click();
        await expect(page.locator('body')).not.toHaveClass(/mobile-citizen-open/);
    });

    test('mobile drawer mutual exclusivity (citizen, sidebar, layers)', async ({ page }) => {
        const isMobile = (page.viewportSize()?.width || 0) <= 768;
        test.skip(!isMobile, 'Mobile-only test');

        const mobileCitizenToggle = page.locator('#mobile-citizen-toggle');
        const mobileSidebarToggle = page.locator('#mobile-sidebar-toggle');
        const mobileLayersToggle = page.locator('#mobile-layers-toggle');
        const openAnalysisBtn = page.locator('#open-analysis-button');

        // Open citizen panel
        await mobileCitizenToggle.click();
        await expect(page.locator('body')).toHaveClass(/mobile-citizen-open/);

        // Click "Ver análisis completo" -> opens sidebar and closes citizen panel
        await openAnalysisBtn.click();
        await expect(page.locator('body')).toHaveClass(/mobile-sidebar-open/);
        await expect(page.locator('body')).not.toHaveClass(/mobile-citizen-open/);

        // Open layers -> closes sidebar
        await mobileLayersToggle.click();
        await expect(page.locator('body')).toHaveClass(/mobile-layers-open/);
        await expect(page.locator('body')).not.toHaveClass(/mobile-sidebar-open/);

        // Open citizen panel -> closes layers
        await mobileCitizenToggle.click();
        await expect(page.locator('body')).toHaveClass(/mobile-citizen-open/);
        await expect(page.locator('body')).not.toHaveClass(/mobile-layers-open/);
    });

    test('search input has font-size 16px on mobile to prevent iOS auto-zoom', async ({ page }) => {
        const isMobile = (page.viewportSize()?.width || 0) <= 768;
        test.skip(!isMobile, 'Mobile-only test');

        const searchInput = page.locator('#territory-search-input');
        const fontSize = await searchInput.evaluate((el) => window.getComputedStyle(el).fontSize);
        expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(16);
    });

    test('desktop panel remains visible and mobile controls are hidden', async ({ page }) => {
        const isMobile = (page.viewportSize()?.width || 0) <= 768;
        test.skip(isMobile, 'Desktop-only test');

        const mobileCitizenToggle = page.locator('#mobile-citizen-toggle');
        const mobileCitizenClose = page.locator('#mobile-citizen-close');
        const citizenPanel = page.locator('#citizen-panel');

        await expect(mobileCitizenToggle).toBeHidden();
        await expect(mobileCitizenClose).toBeHidden();
        await expect(citizenPanel).toBeVisible();
    });
});
