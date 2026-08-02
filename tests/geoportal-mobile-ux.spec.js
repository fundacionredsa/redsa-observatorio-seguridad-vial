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
        const mobileCitizenClose = page.locator('#mobile-citizen-close');
        const mobileSidebarClose = page.locator('#mobile-sidebar-close');
        const layersToggle = page.locator('[data-right-panel="layers"]');
        const openAnalysisBtn = page.locator('#open-analysis-button');

        // Open citizen panel
        await mobileCitizenToggle.click();
        await expect(page.locator('body')).toHaveClass(/mobile-citizen-open/);
        await expect(openAnalysisBtn).toBeVisible();

        // El análisis cubre el panel ciudadano sin alterar su preferencia abierta.
        await openAnalysisBtn.click();
        await expect(page.locator('body')).toHaveClass(/mobile-sidebar-open/);
        await expect(page.locator('body')).toHaveClass(/mobile-citizen-open/);
        await expect(mobileSidebarClose).toBeInViewport();

        // Close sidebar
        await mobileSidebarClose.click();
        await expect(page.locator('body')).not.toHaveClass(/mobile-sidebar-open/);
        await expect(page.locator('body')).toHaveClass(/mobile-citizen-open/);

        // El rail derecho reaparece al cerrar el panel ciudadano.
        await mobileCitizenClose.click();
        await expect(page.locator('body')).not.toHaveClass(/mobile-citizen-open/);

        // Open layers
        await layersToggle.click();
        await expect(page.locator('body')).toHaveClass(/mobile-layers-open/);
        await expect(page.locator('body')).not.toHaveClass(/mobile-citizen-open/);

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

            if (await page.locator('#right-context-host').isVisible()) {
                await page.locator('#mobile-legend-toggle').click();
                await expect(page.locator('#right-context-host')).toBeHidden();
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
        await expect(yearBar.locator('.mobile-year-bar-label')).toHaveText('Año');
        await expect(yearBar.locator('button')).toHaveCount(11);
        await expect(yearBar.locator('.my-available')).toHaveCount(6);
        await expect(yearBar.locator('.my-unavailable')).toHaveCount(5);
        await expect(yearBar.locator('.my-unavailable:disabled')).toHaveCount(5);

        const layout = await page.evaluate(() => {
            const toBox = element => {
                const rect = element.getBoundingClientRect();
                return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
            };
            const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
            const bar = toBox(document.querySelector('#mobile-year-bar'));
            const zoom = toBox(document.querySelector('#map-zoom-in'));
            const rail = toBox(document.querySelector('#right-tools-rail'));
            return {
                bar,
                zoom,
                rail,
                overlapsZoom: intersects(bar, zoom),
                overlapsRail: intersects(bar, rail)
            };
        });
        expect(layout.overlapsZoom, JSON.stringify(layout)).toBeFalsy();
        expect(layout.overlapsRail, JSON.stringify(layout)).toBeFalsy();

        const labelPosition = await page.evaluate(() => {
            const label = document.querySelector('.mobile-year-bar-label');
            const scroll = document.querySelector('#mobile-year-bar-scroll');
            const before = label.getBoundingClientRect().left;
            scroll.scrollLeft = scroll.scrollWidth;
            return { before, after: label.getBoundingClientRect().left, scrollLeft: scroll.scrollLeft };
        });
        expect(labelPosition.after).toBe(labelPosition.before);
        expect(labelPosition.scrollLeft).toBeGreaterThan(0);

        if (await page.locator('#right-context-host').isVisible()) {
            await page.locator('#mobile-legend-toggle').click();
            await expect(page.locator('#right-context-host')).toBeHidden();
        }

        const valuesBeforeYearChange = await page.evaluate(() => ["01", "09", "17"].map(code => {
            const feature = window.__redsaAudit.findTerritoryLayer("province", code)?.feature;
            return feature?.properties?.sppat_fallecidos_por_anio?.["2021"] ?? null;
        }));
        const targetYear = yearBar.locator('button[data-year="2020"]');
        await targetYear.click();
        await expect(targetYear).toHaveClass(/my-selected/);
        await expect(page.locator('#map-year-slider')).toHaveValue('2020');
        expect(await page.evaluate(() => window.__redsaAudit.state().selectedYear)).toBe(2020);
        await expect(page.locator('.legend-panel')).toContainText('2020');
        const valuesAfterYearChange = await page.evaluate(() => ["01", "09", "17"].map(code => {
            const feature = window.__redsaAudit.findTerritoryLayer("province", code)?.feature;
            return feature?.properties?.sppat_fallecidos_por_anio?.["2020"] ?? null;
        }));
        expect(valuesAfterYearChange).not.toEqual(valuesBeforeYearChange);

        await page.evaluate(() => window.setRightContextPanel("legend", true));
        await page.locator('[data-period-mode="accumulated"]').click();
        expect((await page.evaluate(() => window.__redsaAudit.state())).selectedPeriodMode).toBe('accumulated');
        await expect(page.locator('#right-context-host')).toHaveAttribute('data-active-panel', 'legend');
        await page.locator('#mobile-legend-toggle').click();
        await expect(yearBar).toBeVisible();
        const targetHistoricalYear = yearBar.locator('button[data-year="2019"]');
        await expect(targetHistoricalYear).toBeEnabled();
        await targetHistoricalYear.click();
        await expect(targetHistoricalYear).toHaveClass(/my-selected/);
        await expect(page.locator('#map-year-slider')).toHaveValue('2019');
        await expect(page.locator('[data-period-mode="year"]')).toHaveClass(/active/);
        expect((await page.evaluate(() => window.__redsaAudit.state())).selectedPeriodMode).toBe('year');
        await expect(page.locator('.legend-panel')).toContainText('2019');

        await page.locator('[data-right-panel="layers"]').click();
        await expect(yearBar).toBeHidden();
        await page.locator('#technical-drawer-close').click();
        await expect(yearBar).toBeVisible();

        await page.setViewportSize({ width: 360, height: 740 });
        const compactLayout = await page.evaluate(() => {
            const toBox = element => {
                const rect = element.getBoundingClientRect();
                return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
            };
            const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
            const bar = toBox(document.querySelector('#mobile-year-bar'));
            const zoom = toBox(document.querySelector('#map-zoom-in'));
            const rail = toBox(document.querySelector('#right-tools-rail'));
            return {
                bar,
                zoom,
                rail,
                overlapsZoom: intersects(bar, zoom),
                overlapsRail: intersects(bar, rail)
            };
        });
        expect(compactLayout.overlapsZoom, JSON.stringify(compactLayout)).toBeFalsy();
        expect(compactLayout.overlapsRail, JSON.stringify(compactLayout)).toBeFalsy();
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
        const overflow = await card.evaluate(element => {
            const scroll = element.closest('.legend-context-scroll');
            return {
                clientWidth: element.clientWidth,
                scrollWidth: element.scrollWidth,
                clientHeight: scroll.clientHeight,
                scrollHeight: scroll.scrollHeight
            };
        });
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
