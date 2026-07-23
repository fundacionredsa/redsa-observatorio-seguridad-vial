(function () {
    "use strict";

    function calculateOptimalBinsFromValues(inputValues, config = {}, options = {}) {
        const minClasses = options.minClasses || 5;
        const maxClasses = options.maxClasses || 7;
        const improvementThreshold = options.improvementThreshold ?? 0.02;
        const concentrationThreshold = options.concentrationThreshold ?? 0.70;
        const palette = options.palette || (() => []);
        const values = inputValues
            .map(Number)
            .filter(Number.isFinite)
            .sort((a, b) => a - b);

        if (!values.length) {
            return { bins: [], displayBins: [], method: "Sin datos", gvf: 0, validValueCount: 0, colors: [], logScaled: false };
        }

        const uniqueValues = [...new Set(values)];
        if (uniqueValues.length <= maxClasses) {
            const k = uniqueValues.length;
            const bins = uniqueValues.slice(0, Math.max(1, k - 1));
            return {
                bins,
                displayBins: [...bins],
                method: "Valores únicos",
                gvf: 1,
                validValueCount: values.length,
                colors: palette(config, Math.max(3, k)).slice(0, k),
                logScaled: false
            };
        }

        const getGvf = (vals, breaks) => {
            const sdam = ss.variance(vals) * vals.length;
            if (sdam === 0) return 1;
            let sdcm = 0;
            let classValues = [];
            let breakIndex = 0;
            for (const value of vals) {
                if (breakIndex < breaks.length && value > breaks[breakIndex]) {
                    if (classValues.length) sdcm += ss.variance(classValues) * classValues.length;
                    classValues = [];
                    while (breakIndex < breaks.length && value > breaks[breakIndex]) breakIndex += 1;
                }
                classValues.push(value);
            }
            if (classValues.length) sdcm += ss.variance(classValues) * classValues.length;
            return 1 - (sdcm / sdam);
        };

        const classifyJenks = vals => {
            let bestK = minClasses;
            let bestGvf = 0;
            let bestBreaks = [];
            for (let k = minClasses; k <= maxClasses; k += 1) {
                const clusters = ss.ckmeans(vals, k);
                const breaks = clusters.slice(0, k - 1).map(cluster => Math.max(...cluster));
                const gvf = getGvf(vals, breaks);
                if (k === minClasses || gvf - bestGvf > improvementThreshold) {
                    bestK = k;
                    bestGvf = gvf;
                    bestBreaks = breaks;
                } else {
                    break;
                }
            }
            return { bestK, bestGvf, bestBreaks };
        };

        let { bestK, bestGvf, bestBreaks } = classifyJenks(values);
        let finalBreaks = bestBreaks;
        let reportedGvf = bestGvf;
        let method = "Rupturas Naturales (Jenks)";
        let logScaled = false;
        const firstBinCount = values.filter(value => value <= bestBreaks[0]).length;

        if (firstBinCount / values.length > concentrationThreshold) {
            logScaled = true;
            const logResult = classifyJenks(values.map(value => Math.log(value + 1)));
            bestK = logResult.bestK;
            reportedGvf = logResult.bestGvf;
            finalBreaks = logResult.bestBreaks.map(value => Math.exp(value) - 1);
        } else {
            const numberOfBreaks = bestK - 1;
            const quantiles = [];
            for (let index = 1; index <= numberOfBreaks; index += 1) {
                quantiles.push(ss.quantile(values, index / bestK));
            }
            const gvfQuantiles = getGvf(values, quantiles);
            const min = values[0];
            const max = values[values.length - 1];
            const step = (max - min) / bestK;
            const equalIntervals = [];
            for (let index = 1; index <= numberOfBreaks; index += 1) equalIntervals.push(min + index * step);
            const gvfEqual = getGvf(values, equalIntervals);
            if (gvfEqual > reportedGvf) {
                finalBreaks = equalIntervals;
                method = "Intervalos Iguales";
                reportedGvf = gvfEqual;
            }
            if (gvfQuantiles > reportedGvf + 0.01) {
                finalBreaks = quantiles;
                method = "Cuantiles";
                reportedGvf = gvfQuantiles;
            }
        }

        const displayBins = finalBreaks.map(value => {
            if (value === 0) return 0;
            const magnitude = 10 ** Math.floor(Math.log10(Math.abs(value)));
            const factor = magnitude >= 100 ? magnitude / 10 : (magnitude >= 10 ? 5 : (magnitude >= 1 ? 1 : magnitude));
            const rounded = Math.round(value / factor) * factor;
            return config.continuous ? Number(rounded.toFixed(3)) : Math.floor(rounded);
        });

        return {
            bins: finalBreaks.map(value => config.continuous ? Number(value.toFixed(6)) : Math.floor(value)),
            displayBins,
            method,
            gvf: reportedGvf,
            validValueCount: values.length,
            colors: palette(config, bestK),
            logScaled
        };
    }

    window.REDSAClassification = Object.freeze({ calculateOptimalBinsFromValues });
})();
