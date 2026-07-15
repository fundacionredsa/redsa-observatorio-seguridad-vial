# Hotspots cantonales - metodologia

Fecha de generacion: 2026-07-15T18:01:24-05:00

## Entradas

- Capa cantonal: `./redsa-observatorio-seguridad-vial/docs/data/cantones_wgs84.geojson`
- Campo numerador: `fallecidos_historico`
- Campo poblacion: `poblacion_por_anio`
- Anios evaluados: 2019, 2021, 2022, 2023, 2024
- Metodo de contiguidad: `queen`
- Umbral de significancia: `0.05`

## Fuentes de referencia local

- SPPAT fallecidos: `G:/Shared drives/03_PROYECTOS/A2026/023_REDSA_ObservatorioSeguridadVial/05_DESARROLLO/01_EN PROCESO/03_DATOS_FUENTES/estadisticas_base/datos_crudos/sppat_fallecidos.csv` (existe)
- INEC siniestros: `G:/Shared drives/03_PROYECTOS/A2026/023_REDSA_ObservatorioSeguridadVial/05_DESARROLLO/01_EN PROCESO/03_DATOS_FUENTES/estadisticas_base/datos_crudos/inec_siniestros.csv` (existe)
- EDG 2024: `G:/Shared drives/03_PROYECTOS/A2026/023_REDSA_ObservatorioSeguridadVial/05_DESARROLLO/01_EN PROCESO/03_DATOS_FUENTES/estadisticas_base/datos_crudos/edg_2024.csv` (existe)

## Formula

`tasa = fallecidos_historico[anio] / poblacion_por_anio[anio] * 100000`

Sobre la tasa por 100,000 habitantes se calculan:

- Getis-Ord Gi* local (`esda.G_Local`, `star=1.0`).
- Local Moran's I (`esda.Moran_Local`).

Cada canton/anio sin numerador o poblacion valida se marca como `sin_dato`; no se reemplazan faltantes por cero.

Los cantones sin vecinos geograficos reales en la matriz de contiguidad se excluyen del calculo inferencial y se marcan como `isla_sin_vecinos`, con `z_score`, `i_local` y `p_value` en `null`.

## Resumen por anio

- 2019: 0 cantones validos; 224 cantones `sin_dato`; componentes=no calculado; islas=ninguna.
- 2021: 190 cantones validos; 34 cantones `sin_dato`; componentes=2; islas=2003.
- 2022: 187 cantones validos; 37 cantones `sin_dato`; componentes=2; islas=2003.
- 2023: 192 cantones validos; 32 cantones `sin_dato`; componentes=3; islas=2001, 2003.
- 2024: 195 cantones validos; 29 cantones `sin_dato`; componentes=3; islas=2001, 2003.

## Advertencias

- 2019: datos insuficientes para estadistica espacial (0 cantones validos)
- 2021: matriz de contiguidad no plenamente conectada; islas=2003
- 2022: matriz de contiguidad no plenamente conectada; islas=2003
- 2023: matriz de contiguidad no plenamente conectada; islas=2001, 2003
- 2024: matriz de contiguidad no plenamente conectada; islas=2001, 2003

## Limitaciones

- Las tasas cantonales esconden variacion intraurbana e intravia.
- Los resultados dependen de la calidad de los campos historicos ya integrados en la capa cantonal.
- Un hotspot cantonal no identifica un punto exacto de riesgo; orienta priorizacion territorial.
- Para analisis puntual se requiere una fuente de siniestros georreferenciada validada.
