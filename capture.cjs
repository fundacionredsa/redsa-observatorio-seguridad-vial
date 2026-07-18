const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\67061512-d74c-4d64-9ac4-99c844ab7a82';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    
    const { spawn } = require('child_process');
    const server = spawn('python', ['-m', 'http.server', '8182'], {
        cwd: 'C:\\Users\\Admin\\Documents\\023_REDSA_ObservatorioSeguridadVial\\redsa-observatorio-seguridad-vial\\docs'
    });

    await new Promise(r => setTimeout(r, 2000));

    try {
        await page.goto('http://127.0.0.1:8182/');
        
        await page.waitForSelector('.leaflet-interactive');
        await page.waitForTimeout(2000);

        const vars = [
            { id: 'fallecidos_parroquial', level: 'parish' },
            { id: 'fallecidos_sppat_2016_2021', level: 'canton' },
            { id: 'siniestros_inec_2019', level: 'canton' },
            { id: 'tasa_fallecidos_100k', level: 'canton' },
            { id: 'tasa_motociclistas_1000_motos_2024', level: 'canton' },
            { id: 'porcentaje_motos_flota_2024', level: 'province' },
            { id: 'cobertura_mapeo_osm', level: 'canton' }
        ];

        async function captureVariable(variableId, level, basemapIndex, filename) {
            await page.selectOption('#map-variable-select', variableId);
            
            await page.click(`.view-btn[data-view="${level}"]`);
            await page.waitForTimeout(1500);
            
            // Hover over info icon to show popover if available
            const infoIcon = await page.$('.sigla-info-icon');
            if (infoIcon) {
                await infoIcon.hover();
                await page.waitForTimeout(500);
            }

            // Basemap switch logic
            await page.evaluate((idx) => {
                const inputs = document.querySelectorAll('.leaflet-control-layers-selector');
                if (inputs[idx]) {
                    inputs[idx].click();
                }
            }, basemapIndex);

            await page.waitForTimeout(1000);
            
            await page.screenshot({ path: path.join(OUT_DIR, filename) });

            // close popover by moving mouse away
            await page.mouse.move(0, 0);
            await page.waitForTimeout(200);
        }

        for (let v of vars) {
            await captureVariable(v.id, v.level, 0, `map_${v.id}_light.png`);
            await captureVariable(v.id, v.level, 1, `map_${v.id}_dark.png`);
        }

    } finally {
        server.kill();
        await browser.close();
    }
})();
