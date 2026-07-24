import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

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
            const btnTour = page.locator('#btn-tour');
            await expect(btnTour).toBeVisible();
            await btnTour.click();

            // Tour should appear again
            await expect(popover).toBeVisible();
            await expect(popover.locator('.driver-popover-title')).toContainText('Bienvenido al Observatorio');
            const tourAudit = await page.evaluate(() => window.__redsaTourAudit);
            expect(tourAudit).toMatchObject({
                stepCount: 9,
                coversCatalogDownloads: true,
                coversAnalysis: true,
                coversVariablesAndLayers: true
            });
            expect(tourAudit.titles).toContain('Catálogo y descarga de datos');
            expect(tourAudit.titles).toContain('Ficha PDF del territorio');
            for (const expectedTitle of tourAudit.titles.slice(1)) {
                await popover.locator('.driver-popover-next-btn').click();
                await expect(popover.locator('.driver-popover-title')).toHaveText(expectedTitle);
                if (expectedTitle === 'Leyenda adaptativa') {
                    const geometry = await page.evaluate(() => {
                        const legendElement = document.querySelector('.legend-panel');
                        const targetElement = document.querySelector('#legend-tour-target');
                        const legend = legendElement?.getBoundingClientRect();
                        const target = targetElement?.getBoundingClientRect();
                        const box = rect => rect && ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height });
                        return {
                            legend: box(legend),
                            target: box(target),
                            targetIsActive: targetElement?.classList.contains('driver-active-element'),
                            activeCount: document.querySelectorAll('.driver-active-element').length
                        };
                    });
                    expect(geometry.targetIsActive, JSON.stringify(geometry)).toBeTruthy();
                    expect(geometry.target, JSON.stringify(geometry)).toEqual(geometry.legend);
                }
            }
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
            const results = modal.locator('#catalog-results > article');
            await expect(results).toHaveCount(10, { timeout: 10000 });
            await expect(modal).not.toContainText(/Ã|Â|�/);
            await expect(modal.locator('a[download][href$=".xlsx"]')).toHaveCount(9);
            await expect(results.first().locator('.catalog-download')).toHaveCount(3);
            await expect(results.first().locator('.catalog-download-count')).toHaveText('Descargas históricas registradas: 0.');
            await expect(modal.locator('#catalog-global-download-total')).toHaveText('Descargas históricas registradas en todo el catálogo: 0.');
            await expect(modal).toContainText('registra descargas, no personas únicas');

            await modal.locator('#catalog-search').fill('vías principales');
            await expect(results).toHaveCount(1);
            await expect(modal).toContainText('Red de vías principales y secundarias');
            await expect(modal.locator('.catalog-category')).toHaveText(['Otras variables']);
            await modal.locator('#catalog-search').fill('');
            await expect(results).toHaveCount(10);

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
                scrollHeight: element.scrollHeight
            }));
            expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
            await content.evaluate(element => { element.scrollTop = element.scrollHeight; });
            const lastResult = results.last();
            await expect(lastResult).toBeVisible();
            const lastWithinViewport = await lastResult.evaluate(element => {
                const item = element.getBoundingClientRect();
                const container = element.closest('#catalog-results').getBoundingClientRect();
                return item.top < container.bottom && item.bottom > container.top;
            });
            expect(lastWithinViewport).toBeTruthy();

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

        test('methodology links use the professional interface and drawer has no direct download', async ({ page }) => {
            const links = page.locator('#technical-drawer .technical-links a');
            await expect(links).toHaveCount(4);
            const hrefs = await links.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
            expect(hrefs.every(href => href.startsWith('metodologia/#'))).toBeTruthy();
            expect(hrefs.some(href => href.endsWith('.md') || href.endsWith('.geojson'))).toBeFalsy();
            await expect(page.locator('#citizen-panel .citizen-intro-full')).toContainText('iniciativa independiente de la sociedad civil');
            await expect(page.locator('#citizen-panel')).toContainText('info@fundacionredsa.org');
            await expect(page.locator('body')).not.toContainText('Observatorio REDSA');
        });
    });

    test.describe('Block D: Basemap and Opacity', () => {
        test('opacity slider changes territory opacity without fading infrastructure', async ({ page }) => {
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

            // The territorial pane fades while infrastructure keeps its visual priority.
            const territoryPane = page.locator('.leaflet-territorio-pane');
            const infrastructurePane = page.locator('.leaflet-infraestructura-pane');
            await expect(territoryPane).toHaveCSS('opacity', '0.5', { timeout: 5000 });
            await expect(infrastructurePane).toHaveCSS('opacity', '1');

            // Layer control should exist
            const layerControl = page.locator('.leaflet-top .leaflet-control-layers').first();
            await expect(layerControl).toBeVisible();

            const controlsClearDrawer = await page.evaluate(() => {
                const drawer = document.querySelector('#technical-drawer').getBoundingClientRect();
                const zoom = document.querySelector('.leaflet-control-zoom').getBoundingClientRect();
                const opacity = document.querySelector('.opacity-control').getBoundingClientRect();
                return {
                    zoomRight: zoom.right,
                    opacityRight: opacity.right,
                    drawerLeft: drawer.left
                };
            });
            expect(controlsClearDrawer.zoomRight).toBeLessThanOrEqual(controlsClearDrawer.drawerLeft);
            expect(controlsClearDrawer.opacityRight).toBeLessThanOrEqual(controlsClearDrawer.drawerLeft);
        });
    });

    test.describe('Block E: UI Theme & Coordinates', () => {
        test('theme toggle changes body class and localstorage', async ({ page }) => {
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
                    drawer: colors('#technical-drawer'),
                    selector: colors('.map-selector-control'),
                    profile: colors('.perfil-fallecidos-card'),
                    legend: colors('.legend-panel')
                };
            });
            for (const surface of Object.values(lightSurfaces)) {
                const rgb = surface.background.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number);
                expect(Math.min(...rgb)).toBeGreaterThan(230);
                const textRgb = surface.color.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number);
                expect(Math.max(...textRgb)).toBeLessThan(100);
            }

            // First click changes to dark and persists the choice.
            await page.evaluate(() => window.__redsaAudit.clearSelection());
            await btnTheme.click();
            await expect(page.locator('body')).not.toHaveClass(/light-theme/);
            expect(await page.evaluate(() => localStorage.getItem('redsa_light_theme'))).toBe('false');

            // Second click returns to the default light theme.
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
            await mapContainer.hover();
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
            const openInstitutionalBtn = page.locator('#open-institutional-button');
            if (await openInstitutionalBtn.isVisible()) {
                await openInstitutionalBtn.click();
            }
            const btnTrust = page.locator('#institutional-tab-trust');
            await expect(btnTrust).toBeVisible();
            await btnTrust.click();

            const privacyNotice = page.locator('#privacy-notice');
            await expect(privacyNotice).toBeVisible();
            await expect(privacyNotice).toContainText('Google Analytics');
            await expect(privacyNotice).toContainText('No publicamos datos personales de usuarios ni de víctimas');
        });
    });

    test.describe('Block G: Timeline Playback & Color Transition', () => {
        test('timeline play button advances year, pauses on click and auto-stops on last year', async ({ page }) => {
            const playBtn = page.locator('#timeline-play-button');
            await expect(playBtn).toBeVisible();

            // Select an annual variable (e.g. siniestros_inec_2019)
            await page.evaluate(() => window.__redsaAudit.selectVariable('siniestros_inec_2019'));
            await page.waitForTimeout(500);

            // Should not be disabled for annual variable with multiple years
            await expect(playBtn).not.toBeDisabled();

            // Start playback
            await page.evaluate(() => window.toggleTimelinePlayback());
            await expect(playBtn).toHaveClass(/playing/);
            await expect(playBtn.locator('i')).toHaveClass(/fa-pause/);

            // Wait for 1.5 seconds (INTERVALO_REPRODUCCION_MS is 1200ms)
            await page.waitForTimeout(1600);

            // Year should have advanced
            const badge = page.locator('#timeline-badge');
            const newYearText = await badge.innerText();
            expect(Number(newYearText)).toBeGreaterThan(2019);

            // Pause playback
            await page.evaluate(() => window.toggleTimelinePlayback());
            await expect(playBtn).not.toHaveClass(/playing/);
            await expect(playBtn.locator('i')).toHaveClass(/fa-play/);

            // Verify paused year stays stable
            const yearAtPause = await badge.innerText();
            await page.waitForTimeout(1500);
            expect(await badge.innerText()).toBe(yearAtPause);
        });

        test('timeline play button is disabled with tooltip for foto_unica variables', async ({ page }) => {
            const playBtn = page.locator('#timeline-play-button');
            await expect(playBtn).toBeVisible();

            // Switch to a single year / foto_unica variable (e.g., normal / límites administrativos)
            await page.evaluate(() => window.__redsaAudit.selectVariable('normal'));
            await page.waitForTimeout(500);

            await expect(playBtn).toBeDisabled();
            const title = await playBtn.getAttribute('title');
            expect(title).toBe('Esta variable solo tiene un año disponible');
        });
    });
});
