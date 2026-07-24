// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Geoportal Mobile UX Improvements', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('redsa_tour_seen', 'true');
            window.localStorage.setItem('has_seen_geoportal_tour', 'true');
        });
        await page.goto('http://127.0.0.1:4173/docs/', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.driver-popover-close-btn', { state: 'visible', timeout: 5000 }).catch(() => {});
        await page.evaluate(() => {
            const closeBtn = document.querySelector('.driver-popover-close-btn');
            if (closeBtn instanceof HTMLElement) closeBtn.click();
            const overlay = document.querySelector('.driver-overlay');
            if (overlay) overlay.remove();
        });
        await page.waitForSelector('.driver-overlay', { state: 'detached', timeout: 5000 }).catch(() => {});
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
        const mobileSidebarClose = page.locator('#mobile-sidebar-close');
        const mobileLayersToggle = page.locator('#mobile-layers-toggle');
        const openAnalysisBtn = page.locator('#open-analysis-button');

        // Open citizen panel
        await mobileCitizenToggle.click();
        await expect(page.locator('body')).toHaveClass(/mobile-citizen-open/);
        await expect(openAnalysisBtn).toBeVisible();

        // Click "Ver análisis completo" -> opens sidebar and closes citizen panel
        await openAnalysisBtn.click();
        await expect(page.locator('body')).toHaveClass(/mobile-sidebar-open/);
        await expect(page.locator('body')).not.toHaveClass(/mobile-citizen-open/);
        await expect(mobileSidebarClose).toBeInViewport();

        // Close sidebar
        await mobileSidebarClose.click();
        await expect(page.locator('body')).not.toHaveClass(/mobile-sidebar-open/);

        // Open layers
        await mobileLayersToggle.click();
        await expect(page.locator('body')).toHaveClass(/mobile-layers-open/);

        // Close layers drawer
        await page.locator('#technical-drawer-close').click();
        await expect(page.locator('body')).not.toHaveClass(/mobile-layers-open/);

        // Open citizen panel
        await mobileCitizenToggle.click();
        await expect(page.locator('body')).toHaveClass(/mobile-citizen-open/);
    });

    test('mobile-level-bar is positioned below top navigation without overlap', async ({ page }) => {
        const isMobile = (page.viewportSize()?.width || 0) <= 768;
        const mobileLevelBar = page.locator('#mobile-level-bar');

        if (isMobile) {
            await expect(mobileLevelBar).toBeVisible();
            const levelBarBox = await mobileLevelBar.boundingBox();
            const sidebarToggleBox = await page.locator('#mobile-sidebar-toggle').boundingBox();

            if (levelBarBox && sidebarToggleBox) {
                // Verify level bar is positioned below the top navigation buttons
                expect(levelBarBox.y).toBeGreaterThanOrEqual(sidebarToggleBox.y + sidebarToggleBox.height);
            }

            const provButton = mobileLevelBar.locator('button[data-level-mode="province"]');
            await provButton.click();
            await expect(provButton).toHaveClass(/active/);

            // Verify global synchronization across all level buttons
            const panelProvButton = page.locator('#territory-level-control button[data-level-mode="province"]');
            await expect(panelProvButton).toHaveClass(/active/);
        } else {
            await expect(mobileLevelBar).toBeHidden();
        }
    });

    test('mobile year bar shows coverage and stays synchronized with the main timeline', async ({ page }) => {
        const isMobile = (page.viewportSize()?.width || 0) <= 768;
        test.skip(!isMobile, 'Mobile-only test');
        await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
        await expect(page.locator('#loader')).toBeHidden({ timeout: 90_000 });

        await page.evaluate(() => window.__redsaAudit.selectVariable('fallecidos_sppat_2016_2021'));
        const yearBar = page.locator('#mobile-year-bar');
        await expect(yearBar).toBeVisible();
        await expect(yearBar.locator('button')).toHaveCount(11);
        await expect(yearBar.locator('.my-available')).toHaveCount(6);
        await expect(yearBar.locator('.my-unavailable')).toHaveCount(5);

        const targetYear = yearBar.locator('button[data-year="2021"]');
        await targetYear.click();
        await expect(targetYear).toHaveClass(/my-selected/);
        await expect(page.locator('#map-year-slider')).toHaveValue('2021');
        expect(await page.evaluate(() => window.__redsaAudit.state().selectedYear)).toBe(2021);

        await page.locator('#mobile-layers-toggle').click();
        await expect(yearBar).toBeHidden();
        await page.locator('#technical-drawer-close').click();
        await expect(yearBar).toBeVisible();
    });

    test('mobile demographic profile has no horizontal scroll and exposes its close button', async ({ page }) => {
        const isMobile = (page.viewportSize()?.width || 0) <= 768;
        test.skip(!isMobile, 'Mobile-only test');
        await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90_000 });
        await expect(page.locator('#loader')).toBeHidden({ timeout: 90_000 });

        await page.evaluate(() => {
            window.__redsaAudit.setZoom(9);
            window.__redsaAudit.showTerritory('canton', '1701');
        });

        const card = page.locator('#demographic-hover-card');
        await expect(card).toBeVisible();
        await expect(page.locator('#profile-card-close')).toBeInViewport();
        const overflow = await card.evaluate(element => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight
        }));
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
        expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);
    });

    test('mobile panel topbars have sticky positioning for close button accessibility', async ({ page }) => {
        const isMobile = (page.viewportSize()?.width || 0) <= 768;
        test.skip(!isMobile, 'Mobile-only test');

        const citizenTopbarPosition = await page.locator('.citizen-panel-topbar').evaluate(el => window.getComputedStyle(el).position);
        const drawerHeaderPosition = await page.locator('.drawer-header').first().evaluate(el => window.getComputedStyle(el).position);
        const sidebarTopbarPosition = await page.locator('.mobile-sidebar-topbar').evaluate(el => window.getComputedStyle(el).position);

        expect(citizenTopbarPosition).toBe('sticky');
        expect(drawerHeaderPosition).toBe('sticky');
        expect(sidebarTopbarPosition).toBe('sticky');
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
        const mobileLevelBar = page.locator('#mobile-level-bar');
        const mobileYearBar = page.locator('#mobile-year-bar');
        const citizenPanel = page.locator('#citizen-panel');

        await expect(mobileCitizenToggle).toBeHidden();
        await expect(mobileCitizenClose).toBeHidden();
        await expect(mobileLevelBar).toBeHidden();
        await expect(mobileYearBar).toBeHidden();
        await expect(citizenPanel).toBeVisible();
    });
});
