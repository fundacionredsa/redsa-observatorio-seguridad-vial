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
            fuente: "INEC, Estadísticas de Transporte (ESTRA), con registros administrativos de la ANT",
            description: "Número de accidentes de tránsito reportados oficialmente en esta zona.",
            unidad: "accidentes reportados",
            metodologia: "Conteo de registros de siniestros por código territorial DPA y año. Los valores faltantes se mantienen como sin dato; no se sustituyen por cero.",
            licencia: "Creative Commons Atribución 4.0 (fuente INEC)",
            referencias: [
                { label: "INEC - Estadísticas de Transporte", url: "https://www.ecuadorencifras.gob.ec/transporte/" },
                { label: "Metodología ESTRA 2024", url: "https://www.ecuadorencifras.gob.ec/documentos/web-inec/Estadisticas_Economicas/Estadistica%20de%20Transporte/ESTRA/2024/2024_METODOLOGIA_ESTRA.pdf" }
            ],
            getValue: (props, year) => props.siniestros_historico?.[String(year)],
            levels: ["province", "canton"],
            temporal: { tipo: "anual", anios_disponibles: [2019, 2021, 2022, 2023, 2024] },
            aggregation: "sum",
            dynamicBins: true,
            zeroIsData: true,
            colorFamily: "Oranges",
            format: value => value.toString()
        },
        fallecidos_inec_2019: {
            label: "Personas fallecidas por accidentes (registro civil)",
            fuente: "INEC, Registro Estadístico de Defunciones Generales (EDG)",
            description: "Número de personas que murieron por accidentes de tránsito.",
            unidad: "personas fallecidas",
            metodologia: "Conteo de defunciones con causa CIE-10 V01-V89. El territorio corresponde al lugar de fallecimiento registrado, que no necesariamente coincide con el lugar del siniestro.",
            licencia: "Creative Commons Atribución 4.0 (fuente INEC)",
            referencias: [
                { label: "INEC - Defunciones Generales", url: "https://www.ecuadorencifras.gob.ec/defunciones-generales/" },
                { label: "Metodología EDG 2024", url: "https://www.ecuadorencifras.gob.ec/documentos/web-inec/Poblacion_y_Demografia/Defunciones_Generales/2024/Metodologia_EDG_2024.pdf" }
            ],
            getValue: (props, year) => props.fallecidos_historico?.[String(year)],
            levels: ["province", "canton"],
            temporal: { tipo: "anual", anios_disponibles: [2020, 2021, 2022, 2023, 2024] },
            aggregation: "sum",
            dynamicBins: true,
            zeroIsData: true,
            colorFamily: "Reds",
            format: value => value.toString()
        },
        tasa_fallecidos_100k: {
            label: "Fallecidos por cada 100.000 habitantes",
            fuente: "Cálculo REDSA con INEC EDG y población INEC",
            description: "Fallecidos por cada 100.000 habitantes: permite comparar zonas con poblaciones de distinto tamaño.",
            unidad: "personas fallecidas por cada 100.000 habitantes",
            metodologia: "Personas fallecidas EDG del año divididas para la población del mismo año, multiplicado por 100.000. Las tasas agregadas se recalculan con numeradores y denominadores sumados; no se promedian tasas territoriales.",
            licencia: "Derivado de fuentes INEC con atribución",
            referencias: [
                { label: "INEC - Defunciones Generales", url: "https://www.ecuadorencifras.gob.ec/defunciones-generales/" },
                { label: "Metodología publicada por REDSA", url: "https://fundacionredsa.github.io/redsa-observatorio-seguridad-vial/metodologia/#mortalidad" }
            ],
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
            colorFamily: "Purples",
            format: value => value.toFixed(1)
        },
        tasa_siniestros_1000_vehiculos_2024: {
            label: "Accidentes por cada 1.000 vehículos (2024)",
            fuente: "Cálculo REDSA con INEC ESTRA 2024",
            description: "Accidentes por cada 1.000 vehículos matriculados: mide el riesgo según la cantidad de vehículos, no solo de personas.",
            unidad: "accidentes por cada 1.000 vehículos matriculados",
            metodologia: "Accidentes reportados en 2024 divididos para vehículos matriculados en 2024, multiplicado por 1.000. Los vehículos se asignan por residencia del propietario, no por lugar de circulación.",
            licencia: "Creative Commons Atribución 4.0 (fuente INEC)",
            referencias: [
                { label: "INEC - Estadísticas de Transporte 2024", url: "https://anda.inec.gob.ec/anda5/index.php/catalog/1217" },
                { label: "Metodología publicada por REDSA", url: "https://fundacionredsa.github.io/redsa-observatorio-seguridad-vial/metodologia/#vehiculos" }
            ],
            property: "tasa_siniestros_por_1000_vehiculos_2024",
            levels: ["province", "canton"],
            temporal: { tipo: "foto_unica", anios_disponibles: [2024] },
            dynamicBins: true,
            zeroIsData: true,
            continuous: true,
            infoSigla: "VEHICULOS_MATRICULADOS",
            colorFamily: "Purples",
            format: value => value.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        },
        tasa_motociclistas_1000_motos_2024: {
            label: "Motociclistas fallecidos por cada 1.000 motos (2024)",
            fuente: "Cálculo REDSA con INEC EDG 2024 e INEC ESTRA 2024",
            description: "Muertes de motociclistas por cada 1.000 motos matriculadas en la zona.",
            unidad: "motociclistas fallecidos por cada 1.000 motocicletas matriculadas",
            metodologia: "Motociclistas fallecidos identificados en EDG 2024 divididos para motocicletas matriculadas en 2024, multiplicado por 1.000. La clasificación CIE-10 V89 puede subestimar el numerador identificado.",
            licencia: "Derivado de fuentes INEC con atribución",
            referencias: [
                { label: "INEC - Defunciones Generales", url: "https://www.ecuadorencifras.gob.ec/defunciones-generales/" },
                { label: "INEC - Estadísticas de Transporte 2024", url: "https://anda.inec.gob.ec/anda5/index.php/catalog/1217" },
                { label: "Metodología publicada por REDSA", url: "https://fundacionredsa.github.io/redsa-observatorio-seguridad-vial/metodologia/#vehiculos" }
            ],
            property: "tasa_motociclistas_fallecidos_por_1000_motos_2024",
            levels: ["province", "canton"],
            temporal: { tipo: "foto_unica", anios_disponibles: [2024] },
            dynamicBins: true,
            zeroIsData: true,
            continuous: true,
            infoSigla: "VEHICULOS_MATRICULADOS",
            colorFamily: "YlOrBr",
            format: value => value.toLocaleString("es-EC", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
        },
        fallecidos_sppat_2016_2021: {
            label: "Fallecidos según reclamos del seguro (SPPAT)",
            fuente: "Servicio Público para Pago de Accidentes de Tránsito (SPPAT)",
            description: "Fallecidos según reclamos del seguro obligatorio de accidentes de tránsito (2016-2021).",
            unidad: "personas fallecidas registradas en reclamaciones",
            metodologia: "Conteo anual de reclamaciones por fallecimiento procesadas por SPPAT y agregadas por código territorial. Esta fuente refleja reclamaciones administrativas y puede diferir del registro civil.",
            licencia: "Consultar condiciones de la fuente institucional",
            referencias: [
                { label: "SPPAT - información institucional", url: "https://www.sppat.gob.ec/servicios/?p=60" },
                { label: "Metodología publicada por REDSA", url: "https://fundacionredsa.github.io/redsa-observatorio-seguridad-vial/metodologia/#cobertura-temporal" }
            ],
            getValue: (props, year) => props.sppat_fallecidos_por_anio?.[String(year)],
            levels: ["province", "canton"],
            temporal: { tipo: "anual", anios_disponibles: [2016, 2017, 2018, 2019, 2020, 2021] },
            aggregation: "sum",
            dynamicBins: true,
            zeroIsData: true,
            colorFamily: "OrRd",
            format: value => value.toString()
        },
        fallecidos_parroquial: {
            label: "Personas fallecidas (EDG)",
            fuente: "INEC, Registro Estadístico de Defunciones Generales (EDG)",
            description: "Personas fallecidas por accidentes de tránsito según el registro civil (EDG), comparables entre provincia, cantón y parroquia.",
            unidad: "personas fallecidas",
            metodologia: "Conteo de defunciones CIE-10 V01-V89 a nivel parroquial. Los subtotales cantonales y provinciales se obtienen sumando parroquias con dato; las parroquias urbanas sin polígono propio se documentan como limitación.",
            licencia: "Creative Commons Atribución 4.0 (fuente INEC)",
            referencias: [
                { label: "INEC - Defunciones Generales", url: "https://www.ecuadorencifras.gob.ec/defunciones-generales/" },
                { label: "Metodología EDG 2024", url: "https://www.ecuadorencifras.gob.ec/documentos/web-inec/Poblacion_y_Demografia/Defunciones_Generales/2024/Metodologia_EDG_2024.pdf" },
                { label: "Metodología publicada por REDSA", url: "https://fundacionredsa.github.io/redsa-observatorio-seguridad-vial/metodologia/#mortalidad" }
            ],
            getValue: (props, year) => props.fallecidos_parroquial?.[String(year)] ?? props.fallecidos_por_anio?.[String(year)],
            levels: ["province", "canton", "parish"],
            temporal: { tipo: "anual", anios_disponibles: [2021, 2022, 2023, 2024] },
            aggregation: "sum",
            dynamicBins: true,
            zeroIsData: true,
            colorFamily: "Reds",
            format: value => value.toString()
        },
        porcentaje_motos_flota_2024: {
            label: "Porcentaje de vehículos que son motos (2024)",
            fuente: "Cálculo REDSA con INEC ESTRA 2024",
            description: "Qué porcentaje de todos los vehículos matriculados en la zona son motocicletas.",
            unidad: "porcentaje de vehículos matriculados",
            metodologia: "Motocicletas matriculadas divididas para el total de vehículos matriculados en 2024, multiplicado por 100. El territorio representa la residencia del propietario.",
            licencia: "Creative Commons Atribución 4.0 (fuente INEC)",
            referencias: [
                { label: "INEC - Estadísticas de Transporte 2024", url: "https://anda.inec.gob.ec/anda5/index.php/catalog/1217" },
                { label: "Diccionario de vehículos matriculados", url: "https://anda.inec.gob.ec/anda5/index.php/catalog/1217/data-dictionary/F59" }
            ],
            property: "porcentaje_motocicletas_vehiculos_2024",
            levels: ["province", "canton"],
            temporal: { tipo: "foto_unica", anios_disponibles: [2024] },
            dynamicBins: true,
            zeroIsData: true,
            continuous: true,
            infoSigla: "VEHICULOS_MATRICULADOS",
            colorFamily: "Blues",
            format: value => `${value.toFixed(1)}%`
        },
        cobertura_mapeo_osm: {
            label: "Cobertura del mapeo de infraestructura vial",
            fuente: "OpenStreetMap contributors, ODbL; normalización REDSA con población INEC 2024",
            description: "Qué tanto se ha registrado la infraestructura de seguridad vial (semáforos, cruces y aceras) en el mapa colaborativo OpenStreetMap. No mide si la infraestructura existe o no; solo si alguien ya la mapeó.",
            unidad: "elementos mapeados por cada 100.000 habitantes",
            metodologia: "Suma de semáforos y rotondas, cruces peatonales y aceras mapeados en OpenStreetMap, dividida para la población 2024 y multiplicada por 100.000. Cero significa sin elementos mapeados, no ausencia de infraestructura.",
            licencia: "Open Data Commons Open Database License (ODbL)",
            referencias: [
                { label: "OpenStreetMap - derechos de autor y licencia", url: "https://www.openstreetmap.org/copyright/es" },
                { label: "Metodología publicada por REDSA", url: "https://fundacionredsa.github.io/redsa-observatorio-seguridad-vial/metodologia/#openstreetmap" }
            ],
            property: "cobertura_mapeo_infraestructura_por_100k",
            levels: ["province", "canton"],
            temporal: { tipo: "foto_unica", anios_disponibles: [2026] },
            dynamicBins: true,
            zeroIsData: true,
            zeroAsNoMapping: true,
            continuous: true,
            infoSigla: "COBERTURA_OSM",
            colorFamily: "Greens",
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
        },
        {
            id: "vias_principales",
            label: "Vías principales",
            url: "data/vias_ecuador.geojson",
            filterFeature: feature => feature.properties?.clase === "principal",
            render: "line",
            color: "#9f2f2f",
            weight: 4,
            coverageMask: false,
            osmAudit: true,
            popup: props => `<strong>Vía principal:</strong> ${props.name || "Tramo sin nombre"}<br><strong>Clase OSM:</strong> ${props.highway || "No especificada"}<br><strong>Longitud del tramo:</strong> ${Number(props.longitud_km || 0).toLocaleString("es-EC", { maximumFractionDigits: 2 })} km<br><small>${props.attribution || "OpenStreetMap contributors, ODbL"}</small>`,
            legend: [{ shape: "line", color: "#9f2f2f", label: "Motorway, trunk y primary" }],
            catalogEntry: {
                id: "vias_osm",
                label: "Red de vías principales y secundarias (OSM)",
                description: "Geometrías lineales de vías mapeadas en OpenStreetMap, clasificadas en principales y secundarias para visualización independiente.",
                fuente: "OpenStreetMap contributors",
                unidad: "tramos viales con longitud en kilómetros",
                metodologia: "Consulta Overpass por partición provincial, recorte al territorio nacional, deduplicación por osm_type/osm_id y clasificación funcional por highway.",
                licencia: "Open Data Commons Open Database License (ODbL)",
                referencias: [
                    { label: "OpenStreetMap - derechos de autor y licencia", url: "https://www.openstreetmap.org/copyright/es" },
                    { label: "Metodología publicada por REDSA", url: "https://fundacionredsa.github.io/redsa-observatorio-seguridad-vial/metodologia/#vias-osm" }
                ],
                downloads: [{ formato: "GeoJSON", etiqueta: "Red vial clasificada", url: "data/vias_ecuador.geojson" }]
            }
        },
        {
            id: "vias_secundarias",
            label: "Vías secundarias",
            url: "data/vias_ecuador.geojson",
            filterFeature: feature => feature.properties?.clase === "secundaria",
            render: "line",
            color: "#b7791f",
            weight: 2,
            coverageMask: false,
            osmAudit: true,
            popup: props => `<strong>Vía secundaria:</strong> ${props.name || "Tramo sin nombre"}<br><strong>Clase OSM:</strong> ${props.highway || "No especificada"}<br><strong>Longitud del tramo:</strong> ${Number(props.longitud_km || 0).toLocaleString("es-EC", { maximumFractionDigits: 2 })} km<br><small>${props.attribution || "OpenStreetMap contributors, ODbL"}</small>`,
            legend: [{ shape: "line", color: "#b7791f", label: "Secondary y tertiary" }]
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
