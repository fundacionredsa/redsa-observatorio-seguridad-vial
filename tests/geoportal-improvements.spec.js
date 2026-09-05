import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

async function openCitizenPanelWhenNeeded(page) {
    if (!await page.locator('#site-topbar-actions').isVisible()) {
        await page.locator('#site-topbar-menu-toggle').click();
        await expect(page.locator('#site-topbar-actions')).toBeVisible();
    }
}

async function openSiteMenuWhenNeeded(page) {
    if (!await page.locator('#site-topbar-actions').isVisible()) {
        await page.locator('#site-topbar-menu-toggle').click();
        await expect(page.locator('#site-topbar-actions')).toBeVisible();
    }
}

test.describe('Observatory Improvements (Blocks B, C, D, E)', () => {

    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
        const counts = new Map();
        await page.route('https://countapi.mileshilliard.com/api/v1/**', async route => {
            const parts = new URL(route.request().url()).pathname.split('/').filter(Boolean);
            const operation = parts.at(-2);
            const key = decodeURIComponent(parts.at(-1));
            const current = counts.get(key) || 0;
            if (operation === 'hit') counts.set(key, current + 1);
            const value = counts.get(key) || 0;
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ key, value }) });
        });
        await page.addInitScript(() => { window.__REDSA_GLOBAL_COUNTER_ENABLED__ = true; });
        await page.goto('./', { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 20_000 });
        
        await page.waitForSelector('.driver-popover-close-btn', { state: 'visible', timeout: 5000 }).catch(() => {});
        await page.evaluate(() => {
            const closeBtn = document.querySelector('.driver-popover-close-btn');
            if (closeBtn instanceof HTMLElement) closeBtn.click();
            const overlay = document.querySelector('.driver-overlay');
            if (overlay) overlay.remove();
        });
        await page.waitForSelector('.driver-overlay', { state: 'detached', timeout: 5000 }).catch(() => {});
    });

    test.describe('Block B: Guided Tour', () => {
        test('tour appears on first visit, can be closed and reopened', async ({ page }) => {
            const isMobile = (page.viewportSize()?.width || 0) <= 768;
            test.skip(isMobile, 'Tour test is for desktop');

            // By default, the first visit triggers it, which was handled by beforeEach above.
            // Let's clear localStorage and reload to ensure we get it fresh.
            await page.evaluate(() => localStorage.removeItem('redsa_tour_v2_visto'));
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
            const flag = await page.evaluate(() => localStorage.getItem('redsa_tour_v2_visto'));
            expect(flag).toBe('true');

            // Reload page - tour should NOT auto-start
            await page.evaluate(() => window.__TEST_ALLOW_TOUR = false); // Let it rely on localStorage now
            await page.reload();
            // Wait 2 seconds to ensure it doesn't appear
            await page.waitForTimeout(2000);
            await expect(popover).toBeHidden();

            // Click manual tour button
            await openCitizenPanelWhenNeeded(page);
            const btnTour = page.locator('#btn-tour');
            await expect(btnTour).toBeVisible();
            await btnTour.click();

            // Tour should appear again
            await expect(popover).toBeVisible();
            await expect(popover.locator('.driver-popover-title')).toContainText('Bienvenido al Observatorio');
            const tourAudit = await page.evaluate(() => window.__redsaTourAudit);
            expect(tourAudit).toMatchObject({
                stepCount: 12,
                coversCatalogDownloads: true,
                coversAnalysis: true,
                coversVariablesAndLayers: true
            });
            expect(tourAudit.titles).toContain('Catálogo y descarga de datos');
            expect(tourAudit.titles).toContain('Siniestros en el lugar donde ocurrieron');
            expect(tourAudit.titles).toContain('Leyenda siempre a la vista');
            expect(tourAudit.titles).toContain('Controles permanentes del mapa');
            for (const expectedTitle of tourAudit.titles.slice(1)) {
                await popover.locator('.driver-popover-next-btn').click();
                await expect(popover.locator('.driver-popover-title')).toHaveText(expectedTitle);
                if (expectedTitle === 'Controles permanentes del mapa') {
                    const geometry = await page.evaluate(() => {
                        const targetElement = document.querySelector('.site-topbar-center-controls') || document.querySelector('#mobile-level-bar');
                        const target = targetElement?.getBoundingClientRect();
                        const box = rect => rect && ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height });
                        return {
                            target: box(target),
                            targetIsActive: targetElement?.classList.contains('driver-active-element'),
                            activeCount: document.querySelectorAll('.driver-active-element').length
                        };
                    });
                    expect(geometry.targetIsActive, JSON.stringify(geometry)).toBeTruthy();
                    expect(geometry.target?.height, JSON.stringify(geometry)).toBeGreaterThan(0);
                }
            }
        });

        test('mobile tour highlights every visible target inside the viewport', async ({ page }) => {
            const isMobile = (page.viewportSize()?.width || 0) <= 768;
            test.skip(!isMobile, 'Tour test is for mobile');

            await page.evaluate(() => window.setMobilePanel?.('sidebar', true));
            await openSiteMenuWhenNeeded(page);
            await page.locator('#btn-tour').click();

            const popover = page.locator('.driver-popover');
            await expect(popover).toBeVisible();

            const targets = [
                null,
                '#territory-search-form',
                '#right-tab-analysis',
                '#right-tab-layers',
                '#infrastructure-disclosure',
                '#map-legend-card',
                '#right-tab-layers',
                '#event-layer-disclosure',
                '#mobile-level-bar',
                '#site-methodology-toggle',
                '#btn-catalog',
                '#open-institutional-button'
            ];

            for (let index = 0; index < targets.length; index += 1) {
                if (index > 0) {
                    await popover.locator('.driver-popover-next-btn').click();
                }
                await page.waitForTimeout(450);

                const geometry = await page.evaluate(selector => {
                    const toBox = rect => rect && ({
                        left: rect.left,
                        right: rect.right,
                        top: rect.top,
                        bottom: rect.bottom,
                        width: rect.width,
                        height: rect.height
                    });
                    const target = selector
                        ? document.querySelector(selector)
                        : document.querySelector('#driver-dummy-element');
                    const targetBox = target?.getBoundingClientRect();
                    return {
                        targetMatchesActive: target?.classList.contains('driver-active-element'),
                        target: toBox(targetBox),
                        active: toBox(targetBox),
                        viewport: { width: window.innerWidth, height: window.innerHeight }
                    };
                }, targets[index]);

                expect(geometry.targetMatchesActive, JSON.stringify({ index, geometry })).toBeTruthy();
                expect(geometry.active.width, JSON.stringify({ index, geometry })).toBeGreaterThanOrEqual(0);
                expect(geometry.active.height, JSON.stringify({ index, geometry })).toBeGreaterThanOrEqual(0);

                if (targets[index]) {
                    expect(geometry.target.width, JSON.stringify({ index, geometry })).toBeGreaterThan(0);
                    expect(geometry.target.height, JSON.stringify({ index, geometry })).toBeGreaterThan(0);
                    expect(geometry.target.right, JSON.stringify({ index, geometry })).toBeGreaterThan(0);
                    expect(geometry.target.left, JSON.stringify({ index, geometry })).toBeLessThan(geometry.viewport.width);
                    expect(geometry.target.bottom, JSON.stringify({ index, geometry })).toBeGreaterThan(0);
                    expect(geometry.target.top, JSON.stringify({ index, geometry })).toBeLessThan(geometry.viewport.height);
                }

            }
        });
    });

    test.describe('Block C: Data Catalog', () => {
        test('catalog modal opens and displays variables', async ({ page }) => {
            await openSiteMenuWhenNeeded(page);
            const btnCatalog = page.locator('#btn-catalog');
            await expect(btnCatalog).toBeVisible();
            await btnCatalog.click();

            const modal = page.locator('#catalog-modal');
            await expect(modal).toBeVisible();
            const variablesTab = modal.locator('#catalog-tab-variables');
            const transparencyTab = modal.locator('#catalog-tab-transparency');
            await expect(variablesTab).toHaveAttribute('aria-selected', 'true');
            await expect(modal.locator('#catalog-panel-variables')).toBeVisible();
            await expect(modal.locator('#catalog-panel-transparency')).toBeHidden();

            // Wait for fetch to complete and render
            const results = modal.locator('#catalog-results > article');
            await expect(results).toHaveCount(11, { timeout: 10000 });
            await expect(modal.locator('#catalog-category-filter .catalog-category-chip')).toHaveCount(5);
            await expect(modal.locator('#catalog-category-filter select')).toHaveCount(0);
            await expect(results.first().locator('.catalog-details-toggle')).toHaveText('Ver detalles');
            await expect(results.first().locator('.catalog-item-details')).toBeHidden();
            await expect(modal).not.toContainText(/Ã|Â|�/);
            await expect(modal.locator('a[download][href$=".xlsx"]')).toHaveCount(9);
            // Excel plus GeoJSON provincial, cantonal and parroquial.
            await expect(results.first().locator('.catalog-download')).toHaveCount(4);
            await expect(results.first().locator('.catalog-download-count')).toHaveText('Descargas históricas registradas: 0.');
            await expect(modal.locator('#catalog-global-download-total')).toHaveText('Descargas históricas registradas en todo el catálogo: 0.');
            await expect(modal).toContainText('registra descargas, no personas únicas');

            await modal.locator('#catalog-search').fill('vías principales');
            await expect(results).toHaveCount(1);
            await expect(modal).toContainText('Red de vías principales y secundarias');
            await expect(modal.locator('.catalog-category')).toHaveText(['Otras variables']);
            await modal.locator('#catalog-search').fill('');
            await expect(results).toHaveCount(11);

            await modal.locator('[data-catalog-category="Otras variables"]').click();
            await expect(results).toHaveCount(2);
            await expect(modal.locator('[data-catalog-category="Otras variables"]')).toHaveAttribute('aria-pressed', 'true');
            await modal.locator('[data-catalog-category="todas"]').click();
            await expect(results).toHaveCount(11);

            await results.first().locator('.catalog-details-toggle').click();
            await expect(results.first().locator('.catalog-details-toggle')).toHaveText('Ocultar detalles');
            await expect(results.first().locator('.catalog-item-details')).toBeVisible();
            await expect(results.first().locator('dl')).toContainText('Fuente');
            const geojsonDownload = page.waitForEvent('download');
            await results.first().locator('button.catalog-download').first().click();
            const geojson = await geojsonDownload;
            const geojsonPath = await geojson.path();
            const payload = JSON.parse(await fs.readFile(geojsonPath, 'utf8'));
            expect(payload.metadata.fuente).toBeTruthy();
            expect(payload.metadata.metodologia).toBeTruthy();
            expect(payload.metadata.licencia).toBeTruthy();
            expect(payload.metadata.referencias.length).toBeGreaterThan(0);
            expect(payload.metadata.responsable_tratamiento).toBe('Fundación REDSA');
            expect(payload.metadata.cita_sugerida).toContain('Fundación REDSA');
            await expect(results.first().locator('.catalog-download-count')).toHaveText('Descargas históricas registradas: 1.');
            await expect(modal.locator('#catalog-global-download-total')).toHaveText('Descargas históricas registradas en todo el catálogo: 1.');

            const content = modal.locator('#catalog-results');
            const scrollMetrics = await content.evaluate(element => ({
                clientHeight: element.clientHeight,
                scrollHeight: element.scrollHeight,
                visibleCards: [...element.children].filter((child) => {
                    const card = child.getBoundingClientRect();
                    const container = element.getBoundingClientRect();
                    return card.top < container.bottom && card.bottom > container.top;
                }).length
            }));
            expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
            expect(scrollMetrics.clientHeight).toBeGreaterThanOrEqual(180);
            expect(scrollMetrics.visibleCards).toBeGreaterThanOrEqual(1);
            await content.evaluate(element => { element.scrollTop = element.scrollHeight; });
            const lastResult = results.last();
            await expect(lastResult).toBeVisible();
            const lastWithinViewport = await lastResult.evaluate(element => {
                const item = element.getBoundingClientRect();
                const container = element.closest('#catalog-results').getBoundingClientRect();
                return item.top < container.bottom && item.bottom > container.top;
            });
            expect(lastWithinViewport).toBeTruthy();

            await transparencyTab.click();
            await expect(transparencyTab).toHaveAttribute('aria-selected', 'true');
            await expect(modal.locator('#catalog-panel-transparency')).toBeVisible();
            await expect(modal.locator('#catalog-panel-variables')).toBeHidden();
            await expect(modal.locator('.catalog-trust-card')).toBeVisible();
            await expect(modal.locator('.catalog-crosscheck-table [role="row"]')).toHaveCount(3);
            await transparencyTab.press('ArrowLeft');
            await expect(variablesTab).toBeFocused();
            await expect(variablesTab).toHaveAttribute('aria-selected', 'true');
            await expect(modal.locator('#catalog-panel-variables')).toBeVisible();

            // Test search filter
            const searchInput = modal.locator('#catalog-search');
            await searchInput.fill('INEC');
            
            // Should filter out some, let's just check it updates
            await expect(results).not.toHaveCount(9, { timeout: 5000 });
            await expect(results.first()).toBeVisible();

            await transparencyTab.click();
            await expect(transparencyTab).toHaveAttribute('aria-selected', 'true');
            const closeBtn = modal.locator('#catalog-modal-close');
            await closeBtn.click();
            await expect(modal).toBeHidden();
            await openSiteMenuWhenNeeded(page);
            await btnCatalog.click();
            await expect(modal).toBeVisible();
            await expect(variablesTab).toHaveAttribute('aria-selected', 'true');
            await expect(modal.locator('#catalog-panel-variables')).toBeVisible();
            await closeBtn.click();
        });

        test('methodology links use the professional interface and drawer has no direct download', async ({ page }) => {
            await openSiteMenuWhenNeeded(page);
            await page.locator('#site-methodology-toggle').click();
            const links = page.locator('#site-methodology-menu a');
            await expect(links).toHaveCount(4);
            const hrefs = await links.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
            expect(hrefs.every(href => href.startsWith('metodologia/#'))).toBeTruthy();
            expect(hrefs.some(href => href.endsWith('.md') || href.endsWith('.geojson'))).toBeFalsy();
            await expect(page.locator('#technical-drawer .technical-links')).toHaveCount(0);
            await expect(page.locator('.site-topbar-brand')).toContainText('Observatorio de Seguridad Vial');
            await expect(page.locator('.site-topbar-brand')).toContainText('Fundación REDSA');
            await expect(page.locator('.site-topbar-contact')).toHaveAttribute('href', 'mailto:info@fundacionredsa.org');
            await expect(page.locator('body')).not.toContainText('Observatorio REDSA');
        });
    });

    test.describe('Block D: Basemap and Opacity', () => {
        test('opacity slider changes territory opacity without fading infrastructure', async ({ page }) => {
            const isMobile = test.info().project.name === 'mobile';
            if (!isMobile) {
                await page.locator('#right-tab-layers').click();
                await page.locator('#view-settings-disclosure summary').click();
                await expect(page.locator('#view-settings-disclosure')).toHaveAttribute('open', '');
            }
            const slider = page.locator('#territory-opacity-slider');
            await expect(slider).toBeVisible();
            const expectedSlot = isMobile ? 'mobile-opacity-control-slot' : 'view-settings-opacity-slot';
            expect(await slider.evaluate(element => element.closest('#territory-opacity-control')?.parentElement?.id)).toBe(expectedSlot);

            // Set to 50%
            await slider.fill('50');
            // The event is 'input', dispatch it
            await slider.evaluate(node => {
                node.value = 50;
                node.dispatchEvent(new Event('input'));
            });

            // The territorial pane fades while infrastructure keeps its visual priority.
            const territoryPane = page.locator('.leaflet-territorio-pane');
            const infrastructurePane = page.locator('.leaflet-infraestructura-pane');
            await expect(territoryPane).toHaveCSS('opacity', '0.5', { timeout: 5000 });
            await expect(infrastructurePane).toHaveCSS('opacity', '1');

            if (!isMobile) {
                // Mapas base vive en el popover del riel de herramientas.
                const layerControl = page.locator('#basemap-popover .basemap-control');
                await page.locator('#map-basemap-toggle').click();
                await expect(layerControl).toBeVisible();

                const controlsClearDrawer = await page.evaluate(() => {
                    const box = rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
                    const host = document.querySelector('#basemap-popover').getBoundingClientRect();
                    const rail = document.querySelector('#right-tools-rail').getBoundingClientRect();
                    const zoom = document.querySelector('#map-zoom-in').getBoundingClientRect();
                    return {
                        zoom: box(zoom),
                        host: box(host),
                        rail: box(rail)
                    };
                });
                const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
                expect(intersects(controlsClearDrawer.zoom, controlsClearDrawer.host)).toBe(false);
                expect(controlsClearDrawer.zoom.left).toBeGreaterThanOrEqual(controlsClearDrawer.rail.left - 1);
                expect(controlsClearDrawer.zoom.right).toBeLessThanOrEqual(controlsClearDrawer.rail.right + 1);
            }
            await expect(page.locator('.opacity-control')).toHaveCount(0);
        });
    });

    test.describe('Block E: UI Theme & Coordinates', () => {
        test('theme toggle changes body class and localstorage', async ({ page, isMobile }) => {
            await openCitizenPanelWhenNeeded(page);
            const btnTheme = page.locator('#btn-theme-toggle');
            await expect(btnTheme).toBeVisible();

            // Default is light for public readability.
            await expect(page.locator('body')).toHaveClass(/light-theme/);

            await page.evaluate(() => {
                window.__redsaAudit.setZoom(9);
                window.__redsaAudit.showTerritory('canton', '1701');
            });
            const lightSurfaces = await page.evaluate(() => {
                const colors = selector => {
                    const style = getComputedStyle(document.querySelector(selector));
                    return { background: style.backgroundColor, color: style.color };
                };
                return {
                    sidebar: colors('#territory-sidebar'),
                    search: colors('.map-search-card'),
                    legend: colors('#map-legend-card')
                };
            });
            for (const surface of Object.values(lightSurfaces)) {
                const rawNumbers = surface.background.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number);
                const rgb = surface.background.includes('color(srgb') ? rawNumbers.map(n => n * 255) : rawNumbers;
                expect(Math.min(...rgb)).toBeGreaterThan(230);
                const textRgb = surface.color.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number);
                expect(Math.max(...textRgb)).toBeLessThan(100);
            }

            if (isMobile) {
                await page.evaluate(() => {
                    document.querySelector('.site-topbar-actions')?.classList.remove('is-open');
                    window.closeMobilePanels?.();
                });
                await page.locator('#active-layers-shortcut, [data-right-panel="layers"]').first().click();
                const mobileDrawerHeader = await page.evaluate(() => {
                    const colors = selector => {
                        const style = getComputedStyle(document.querySelector(selector));
                        return { background: style.backgroundColor, color: style.color };
                    };
                    return {
                        header: colors('#technical-drawer .drawer-header'),
                        title: colors('#technical-drawer .drawer-header h2'),
                        close: colors('#technical-drawer .drawer-close')
                    };
                });
                const headerRaw = mobileDrawerHeader.header.background.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number);
                const headerRgb = mobileDrawerHeader.header.background.includes('color(srgb') ? headerRaw.map(n => n * 255) : headerRaw;
                expect(Math.min(...headerRgb)).toBeGreaterThan(230);
                for (const surface of Object.values(mobileDrawerHeader)) {
                    const textRgb = surface.color.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number);
                    expect(Math.max(...textRgb)).toBeLessThan(100);
                }
                await page.locator('#technical-drawer-close').click();
                await openCitizenPanelWhenNeeded(page);
            }

            // First click changes to dark and persists the choice.
            await page.evaluate(() => window.__redsaAudit.clearSelection());
            await openCitizenPanelWhenNeeded(page);
            await btnTheme.click();
            await expect(page.locator('body')).not.toHaveClass(/light-theme/);
            expect(await page.evaluate(() => localStorage.getItem('redsa_light_theme'))).toBe('false');

            // Second click returns to the default light theme.
            await openCitizenPanelWhenNeeded(page);
            await btnTheme.click();
            await expect(page.locator('body')).toHaveClass(/light-theme/);
            expect(await page.evaluate(() => localStorage.getItem('redsa_light_theme'))).toBe('true');
        });

        test('cursor coordinates display on mousemove', async ({ page, isMobile }) => {
            test.skip(isMobile, 'Cursor coordinates are only displayed on desktop viewport.');
            // Need a viewport > 768px (default in playwright desktop is usually 1280x720)
            const mapContainer = page.locator('#map');
            await expect(mapContainer).toBeVisible();

            // Hover over map
            await page.locator('#map-legend-card-collapse').click();
            await mapContainer.hover({ position: { x: 600, y: 320 } });
            await page.mouse.move(500, 500);

            // Give the coordinate tracker a moment (there is a setTimeout(..., 2000) for initialization)
            await page.waitForTimeout(2500);
            await page.mouse.move(510, 510);

            const coordDiv = page.locator('#cursor-coordinates');
            await expect(coordDiv).toBeVisible();
            await expect(coordDiv.locator('#coord-lat')).not.toHaveText('--');
            await expect(coordDiv.locator('#coord-lng')).not.toHaveText('--');
        });
    });

    test.describe('Block F: Google Analytics 4 (GA4)', () => {
        test('GA_MEASUREMENT_ID constant is defined and correctly configured', async ({ page }) => {
            const measurementId = await page.evaluate(() => window.GA_MEASUREMENT_ID || GA_MEASUREMENT_ID);
            expect(measurementId).toBe('G-9EXVX3E2SW');
        });

        test('GA4 script is NOT loaded in localhost / 127.0.0.1 development environment', async ({ page }) => {
            const gaScripts = page.locator('script[src*="googletagmanager.com/gtag/js"]');
            await expect(gaScripts).toHaveCount(0);
        });

        test('GA4 privacy notice is visible in "¿Por qué confiar?" section', async ({ page }) => {
            await openSiteMenuWhenNeeded(page);
            const openInstitutionalBtn = page.locator('#open-institutional-button');
            await openInstitutionalBtn.click();
            const btnTrust = page.locator('#institutional-tab-trust');
            await expect(btnTrust).toBeVisible();
            await btnTrust.click();

            const privacyNotice = page.locator('#privacy-notice');
            await expect(privacyNotice).toBeVisible();
            await expect(privacyNotice).toContainText('Google Analytics');
            await expect(privacyNotice).toContainText('No publicamos datos personales de usuarios ni de víctimas');
        });
    });

    test.describe('Block G: Timeline Year Buttons & 3 Visual States', () => {
        test('timeline year buttons show available, unavailable and selected states, and update on click', async ({ page }) => {
            const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 768px)').matches);
            const container = isMobile ? page.locator('#mobile-year-bar-scroll') : page.locator('#timeline-years-bar');
            await expect(container).toBeVisible();

            // Select an annual variable (e.g. siniestros_inec_2019, covering 2019-2025)
            await page.evaluate(() => window.__redsaAudit.selectVariable('siniestros_inec_2019'));
            await page.waitForTimeout(500);

            // Available year button (2020)
            const btn2020 = container.locator('[data-timeline-year="2020"], [data-year="2020"]').first();
            await expect(btn2020).toBeVisible();
            await expect(btn2020).not.toBeDisabled();

            // Click available year
            await btn2020.click();
            await expect(btn2020).toHaveClass(/is-selected|my-selected/);
            expect(await page.evaluate(() => window.__redsaAudit.state().selectedYear)).toBe(2020);

            // Unavailable year button (2016)
            const btn2016 = container.locator('[data-timeline-year="2016"], [data-year="2016"]').first();
            await expect(btn2016).toBeVisible();
            await expect(btn2016).toBeDisabled();
            const title = await btn2016.getAttribute('title');
            expect(title).toContain('Sin dato disponible para 2016');
        });

        test('timeline year buttons are disabled for foto_unica variables', async ({ page }) => {
            const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 768px)').matches);
            const container = isMobile ? page.locator('#mobile-year-bar-scroll') : page.locator('#timeline-years-bar');
            await expect(container).toBeVisible();

            // Switch to a single year / foto_unica variable (e.g., normal / límites administrativos)
            await page.evaluate(() => window.__redsaAudit.selectVariable('normal'));
            await page.waitForTimeout(500);

            const buttons = container.locator('button');
            const count = await buttons.count();
            expect(count).toBeGreaterThan(0);
            for (let i = 0; i < count; i++) {
                await expect(buttons.nth(i)).toBeDisabled();
            }
        });
    });
});
