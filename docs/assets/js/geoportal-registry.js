(function () {
    const variables = {
        normal: {
            label: "Límites administrativos",
            description: "Solo muestra los límites administrativos, sin datos de color.",
            levels: ["province", "canton", "parish"],
            temporal: { tipo: "foto_unica", anios_disponibles: [] }
        },
        siniestros_inec_2019: {
            label: "Accidentes de tránsito reportados (INEC)",
            description: "Número de accidentes de tránsito reportados oficialmente en esta zona.",
            getValue: (props, year) => props.siniestros_historico?.[String(year)],
            levels: ["province", "canton"],
            temporal: { tipo: "anual", anios_disponibles: [2019, 2021, 2022, 2023, 2024] },
            dynamicBins: true,
            zeroIsData: true,
            colors: ["#fff1e6", "#fdd0b5", "#f79072", "#d94b4b", "#8f1d2c"],
            format: value => value.toString()
        },
        fallecidos_inec_2019: {
            label: "Personas fallecidas por accidentes (registro civil)",
            description: "Número de personas que murieron por accidentes de tránsito.",
            getValue: (props, year) => props.fallecidos_historico?.[String(year)],
            levels: ["province", "canton"],
            temporal: { tipo: "anual", anios_disponibles: [2020, 2021, 2022, 2023, 2024] },
            dynamicBins: true,
            zeroIsData: true,
            colors: ["#fff1e6", "#fdd0b5", "#f79072", "#d94b4b", "#8f1d2c"],
            format: value => value.toString()
        },
        tasa_fallecidos_100k: {
            label: "Fallecidos por cada 100.000 habitantes",
            description: "Fallecidos por cada 100.000 habitantes: permite comparar zonas con poblaciones de distinto tamaño.",
            getValue: (props, year) => {
                const numerator = props.fallecidos_historico?.[String(year)];
                const denominator = props.poblacion_por_anio?.[String(year)];
                return Number.isFinite(Number(numerator)) && Number(denominator) > 0
                    ? Number(numerator) / Number(denominator) * 100000
                    : null;
            },
            levels: ["province", "canton"],
            temporal: { tipo: "anual", anios_disponibles: [2020, 2021, 2022, 2023, 2024] },
            dynamicBins: true,
            zeroIsData: true,
            continuous: true,
            colors: ["#f1eef6", "#d7b5d8", "#df65b0", "#dd1c77", "#980043"],
            format: value => value.toFixed(1)
        },
        tasa_siniestros_1000_vehiculos_2024: {
            label: "Accidentes por cada 1.000 vehículos (2024)",
            description: "Accidentes por cada 1.000 vehículos matriculados: mide el riesgo según la cantidad de vehículos, no solo de personas.",
            property: "tasa_siniestros_por_1000_vehiculos_2024",
            levels: ["province", "canton"],
            temporal: { tipo: "foto_unica", anios_disponibles: [2024] },
            dynamicBins: true,
            zeroIsData: true,
            continuous: true,
            infoSigla: "VEHICULOS_MATRICULADOS",
            colors: ["#ffffcc", "#a1dab4", "#41b6c4", "#2c7fb8", "#253494"],
            format: value => value.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        },
        tasa_motociclistas_1000_motos_2024: {
            label: "Motociclistas fallecidos por cada 1.000 motos (2024)",
            description: "Muertes de motociclistas por cada 1.000 motos matriculadas en la zona.",
            property: "tasa_motociclistas_fallecidos_por_1000_motos_2024",
            levels: ["province", "canton"],
            temporal: { tipo: "foto_unica", anios_disponibles: [2024] },
            dynamicBins: true,
            zeroIsData: true,
            continuous: true,
            infoSigla: "VEHICULOS_MATRICULADOS",
            colors: ["#ffffcc", "#fed976", "#fd8d3c", "#e31a1c", "#800026"],
            format: value => value.toLocaleString("es-EC", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
        },
        fallecidos_sppat_2016_2021: {
            label: "Fallecidos según reclamos del seguro (SPPAT)",
            description: "Fallecidos según reclamos del seguro obligatorio de accidentes de tránsito (2016-2021).",
            getValue: (props, year) => props.sppat_fallecidos_por_anio?.[String(year)],
            levels: ["province", "canton"],
            temporal: { tipo: "anual", anios_disponibles: [2016, 2017, 2018, 2019, 2020, 2021] },
            dynamicBins: true,
            zeroIsData: true,
            colors: ["#fef0d9", "#fdcc8a", "#fc8d59", "#e34a33", "#b30000"],
            format: value => value.toString()
        },
        fallecidos_parroquial: {
            label: "Personas fallecidas por parroquia",
            description: "Fallecidos por accidente de tránsito a nivel de parroquia (2021-2024).",
            getValue: (props, year) => props.fallecidos_por_anio?.[String(year)],
            levels: ["parish"],
            temporal: { tipo: "anual", anios_disponibles: [2021, 2022, 2023, 2024] },
            dynamicBins: true,
            zeroIsData: true,
            colors: ["#fef0d9", "#fdcc8a", "#fc8d59", "#e34a33", "#b30000"],
            format: value => value.toString()
        },
        porcentaje_motos_flota_2024: {
            label: "Porcentaje de vehículos que son motos (2024)",
            description: "Qué porcentaje de todos los vehículos matriculados en la zona son motocicletas.",
            property: "porcentaje_motocicletas_vehiculos_2024",
            levels: ["province", "canton"],
            temporal: { tipo: "foto_unica", anios_disponibles: [2024] },
            dynamicBins: true,
            zeroIsData: true,
            continuous: true,
            infoSigla: "VEHICULOS_MATRICULADOS",
            colors: ["#edf8e9", "#bae4b3", "#74c476", "#31a354", "#006d2c"],
            format: value => `${value.toFixed(1)}%`
        },
        cobertura_mapeo_osm: {
            label: "Cobertura del mapeo de infraestructura vial",
            description: "Qué tanto se ha registrado la infraestructura de seguridad vial (semáforos, cruces y aceras) en el mapa colaborativo OpenStreetMap. No mide si la infraestructura existe o no; solo si alguien ya la mapeó.",
            property: "cobertura_mapeo_infraestructura_por_100k",
            levels: ["province", "canton"],
            temporal: { tipo: "foto_unica", anios_disponibles: [2026] },
            dynamicBins: true,
            zeroIsData: true,
            zeroAsNoMapping: true,
            continuous: true,
            infoSigla: "COBERTURA_OSM",
            colors: ["#f7fcf0", "#ccebc5", "#7bccc4", "#2b8cbe", "#084081"],
            format: value => value.toFixed(1)
        }
    };

    const infrastructureLayers = [
        {
            id: "ciclovias",
            label: "Ciclovías",
            url: "data/ciclovias_ecuador.geojson",
            render: "line",
            color: "#22c55e",
            weight: 3,
            coverageMask: true,
            osmAudit: true,
            popup: props => `<strong>Ciclovía:</strong> ${props.name || "Ciclovía sin nombre"}<br><strong>Tipo:</strong> ${props.highway || "—"}<br><small>${props.attribution || "OpenStreetMap contributors, ODbL"}</small>`,
            legend: [{ shape: "line", color: "#22c55e", label: "Ciclovías registradas" }]
        },
        {
            id: "aceras",
            label: "Aceras",
            url: "data/aceras_ecuador.geojson",
            render: "line",
            color: "#ec4899",
            weight: 2,
            coverageMask: true,
            osmAudit: true,
            popup: props => `<strong>Acera:</strong> ${props.name || "Acera sin nombre"}<br><strong>Tipo:</strong> ${props.highway || "footway"}<br><small>${props.attribution || "OpenStreetMap contributors, ODbL"}</small>`,
            legend: [{ shape: "line", color: "#ec4899", label: "Aceras registradas" }]
        },
        {
            id: "cruces",
            label: "Cruces Peatonales",
            url: "data/cruces_ecuador.geojson",
            render: "point",
            color: "#eab308",
            radius: 4,
            coverageMask: true,
            osmAudit: true,
            popup: props => `<strong>Cruce peatonal:</strong> ${props.crossing || "cruce"}<br><small>${props.attribution || "OpenStreetMap contributors, ODbL"}</small>`,
            legend: [{ shape: "circle", color: "#eab308", label: "Cruces peatonales registrados" }]
        },
        {
            id: "pacificacion",
            label: "Pacificación de Tránsito",
            url: "data/pacificacion_ecuador.geojson",
            render: "point",
            color: "#a855f7",
            radius: 5,
            coverageMask: true,
            osmAudit: true,
            popup: props => `<strong>Medida para reducir velocidad:</strong> ${props.traffic_calming || "sin tipo especificado"}<br><small>${props.attribution || "OpenStreetMap contributors, ODbL"}</small>`,
            legend: [{ shape: "circle", color: "#a855f7", label: "Medidas para reducir velocidad" }]
        },
        {
            id: "semaforos_rotondas",
            label: "Semáforos y Rotondas",
            url: "data/semaforos_rotondas_ecuador.geojson",
            render: "mixed",
            color: "#f97316",
            radius: 5,
            weight: 3,
            coverageMask: true,
            osmAudit: true,
            popup: props => `<strong>Infraestructura:</strong> ${props.junction === "roundabout" ? "Rotonda" : "Semáforo"}<br><small>${props.attribution || "OpenStreetMap contributors, ODbL"}</small>`,
            legend: [{ shape: "circle", color: "#f97316", label: "Semáforos y rotondas registrados" }]
        },
        {
            id: "iluminacion",
            label: "Iluminación Vial",
            url: "data/iluminacion_ecuador.geojson",
            render: "mixed",
            color: "#e2e8f0",
            outlineColor: "#94a3b8",
            radius: 3,
            weight: 1.5,
            coverageMask: true,
            osmAudit: true,
            popup: props => `<strong>Iluminación:</strong> ${props.highway === "street_lamp" ? "Lámpara de alumbrado público" : "Vía marcada como iluminada"}<br><small>${props.attribution || "OpenStreetMap contributors, ODbL"}</small>`,
            legend: [{ shape: "line", color: "#e2e8f0", label: "Iluminación vial registrada" }]
        },
        {
            id: "velocidad",
            label: "Límites de Velocidad",
            url: "data/velocidad_ecuador.geojson",
            render: "mixed",
            color: "#ef4444",
            radius: 3,
            weight: 2.5,
            coverageMask: true,
            osmAudit: true,
            popup: props => `<strong>Límite registrado:</strong> ${props.maxspeed || "No especificado"}<br><strong>Vía:</strong> ${props.name || "Tramo sin nombre"}<br><small>${props.attribution || "OpenStreetMap contributors, ODbL"}</small>`,
            legend: [{ shape: "line", color: "#ef4444", label: "Límites de velocidad registrados" }]
        },
        {
            id: "brt_metrobus",
            label: "Carriles BRT/Metrobús",
            url: "data/brt_metrobus_ecuador.geojson",
            render: "line",
            color: "#06b6d4",
            weight: 3,
            coverageMask: true,
            osmAudit: true,
            popup: props => `<strong>Carril exclusivo de bus:</strong> ${props.name || "Carril sin nombre"}<br><strong>Número de carriles:</strong> ${props["lanes:bus"] || "No especificado"}<br><small>${props.attribution || "OpenStreetMap contributors, ODbL"}</small>`,
            legend: [{ shape: "line", color: "#06b6d4", label: "Carriles BRT o Metrobús" }]
        }
    ];

    window.REDSA_GEO_CONFIG = Object.freeze({
        initialView: Object.freeze({
            bounds: [[-5.05, -81.2], [1.65, -75.1]],
            center: [-1.7, -78.45],
            zoom: 6,
            variable: "siniestros_inec_2019",
            year: 2024
        }),
        variables: Object.freeze(variables),
        infrastructureLayers: Object.freeze(infrastructureLayers)
    });
})();
