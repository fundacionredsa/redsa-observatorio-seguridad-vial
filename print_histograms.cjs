const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    const { spawn } = require('child_process');
    const server = spawn('python', ['-m', 'http.server', '8183'], { 
        cwd: 'C:\\Users\\Admin\\Documents\\023_REDSA_ObservatorioSeguridadVial\\redsa-observatorio-seguridad-vial' 
    });

    await new Promise(r => setTimeout(r, 2000)); // wait for server

    try {
        await page.goto('http://127.0.0.1:8183/docs/');
        await page.waitForFunction(() => Boolean(window.__redsaAudit), null, { timeout: 90000 });

        // Provincial check
        await page.evaluate(() => window.__redsaAudit.setTerritoryLevelMode('province'));
        await page.waitForTimeout(1000);
        const provincialResults = await page.evaluate(() => {
            const features = getFeaturesForLevel('province');
            const values = features
                .map(feature => getVariableValue(feature.properties, 'siniestros_inec_2019', 2019))
                .filter(value => value !== null && value !== undefined)
                .map(value => Number(value))
                .sort((a, b) => a - b);
            
            const rawClusters = ss.ckmeans(values, 5);
            const rawBreaks = rawClusters.map(c => Math.max(...c));
            const rawCounts = rawClusters.map(c => c.length);

            const logValues = values.map(v => Math.log(v + 1));
            const logClusters = ss.ckmeans(logValues, 5);
            const logBreaks = logClusters.map(c => Math.exp(Math.max(...c)) - 1);
            const logCounts = logClusters.map(c => c.length);

            return {
                valuesCount: values.length,
                raw: { breaks: rawBreaks, counts: rawCounts },
                log: { breaks: logBreaks, counts: logCounts }
            };
        });

        // Parish check
        await page.evaluate(() => window.__redsaAudit.setTerritoryLevelMode('parish'));
        await page.waitForSelector('#loader', { state: 'visible' }).catch(() => {});
        await page.waitForSelector('#loader', { state: 'hidden', timeout: 90000 });
        await page.waitForTimeout(2000); // extra wait for rendering
        
        const parroquialResults = await page.evaluate(() => {
            const features = getFeaturesForLevel('parish');
            const values = features
                .map(feature => getVariableValue(feature.properties, 'fallecidos_parroquial', 2024))
                .filter(value => value !== null && value !== undefined)
                .map(value => Number(value))
                .sort((a, b) => a - b);
            
            const rawClusters = ss.ckmeans(values, 5);
            const rawBreaks = rawClusters.map(c => Math.max(...c));
            const rawCounts = rawClusters.map(c => c.length);

            const logValues = values.map(v => Math.log(v + 1));
            const logClusters = ss.ckmeans(logValues, 5);
            const logBreaks = logClusters.map(c => Math.exp(Math.max(...c)) - 1);
            const logCounts = logClusters.map(c => c.length);

            return {
                valuesCount: values.length,
                raw: { breaks: rawBreaks, counts: rawCounts },
                log: { breaks: logBreaks, counts: logCounts }
            };
        });

        console.log("=== HISTOGRAMAS DE VERIFICACIÓN ===");
        console.log("\n1. Nivel Provincial: Siniestros INEC 2019 (2019)");
        console.log(`Total unidades con dato: ${provincialResults.valuesCount}`);
        console.log("--- Sin Transformación (Raw, k=5) ---");
        console.log("Límites de clase (cortes):", provincialResults.raw.breaks);
        console.log("Conteo de unidades por bin:", provincialResults.raw.counts);
        console.log("--- Con Transformación Logarítmica (ln(x+1), k=5) ---");
        console.log("Límites de clase (de-transformados):", provincialResults.log.breaks);
        console.log("Conteo de unidades por bin:", provincialResults.log.counts);

        console.log("\n2. Nivel Parroquial: Fallecidos 2024 (2024)");
        console.log(`Total unidades con dato: ${parroquialResults.valuesCount}`);
        console.log("--- Sin Transformación (Raw, k=5) ---");
        console.log("Límites de clase (cortes):", parroquialResults.raw.breaks);
        console.log("Conteo de unidades por bin:", parroquialResults.raw.counts);
        console.log("--- Con Transformación Logarítmica (ln(x+1), k=5) ---");
        console.log("Límites de clase (de-transformados):", parroquialResults.log.breaks);
        console.log("Conteo de unidades por bin:", parroquialResults.log.counts);

    } catch (e) {
        console.error(e);
    } finally {
        server.kill();
        await browser.close();
    }
})();
