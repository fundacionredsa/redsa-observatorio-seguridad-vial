# Hotspots cantonales - metodologia

Fecha de generacion: 2026-07-15T18:51:16-05:00

## Entradas

- Capa cantonal: `./redsa-observatorio-seguridad-vial/docs/data/cantones_wgs84.geojson`
- Campo numerador: `fallecidos_historico`
- Campo poblacion: `poblacion_por_anio`
- Anios evaluados: 2019, 2021, 2022, 2023, 2024
- Metodo de contiguidad: `queen`
- Umbral de significancia: `0.05`

## Fuentes de referencia local

- Directorio configurable: `REDSA_RAW_DATA_DIR`.
- SPPAT fallecidos: `${REDSA_RAW_DATA_DIR}/sppat_fallecidos.csv`.
- INEC siniestros: `${REDSA_RAW_DATA_DIR}/inec_siniestros.csv`.
- EDG 2024: `${REDSA_RAW_DATA_DIR}/edg_2024.csv`.

Las rutas absolutas no se publican en la metodologia; el inventario del paquete
de auditoria conserva la ubicacion autorizada en Drive y su checksum.

## Formula

`tasa = fallecidos_historico[anio] / poblacion_por_anio[anio] * 100000`

Sobre la tasa por 100,000 habitantes se calculan:

- Getis-Ord Gi* local (`esda.G_Local`, `star=1.0`).
- Local Moran's I (`esda.Moran_Local`).

Cada canton/anio sin numerador o poblacion valida se marca como `sin_dato`; no se reemplazan faltantes por cero.

Los cantones sin vecinos geograficos reales en la matriz de contiguidad se excluyen del calculo inferencial y se marcan como `isla_sin_vecinos`, con `z_score`, `i_local` y `p_value` en `null`.

## Resumen por anio

- 2019: 0 cantones validos; 224 cantones `sin_dato`; componentes=no calculado; islas=ninguna.
- 2021: 195 cantones validos; 29 cantones `sin_dato`; componentes=2; islas=2003.
- 2022: 193 cantones validos; 31 cantones `sin_dato`; componentes=2; islas=2003.
- 2023: 198 cantones validos; 26 cantones `sin_dato`; componentes=3; islas=2001, 2003.
- 2024: 202 cantones validos; 22 cantones `sin_dato`; componentes=3; islas=2001, 2003.

## Advertencias

- 2019: datos insuficientes para estadistica espacial (0 cantones validos)
- 2021: matriz de contiguidad no plenamente conectada; islas=2003
- 2022: matriz de contiguidad no plenamente conectada; islas=2003
- 2023: matriz de contiguidad no plenamente conectada; islas=2001, 2003
- 2024: matriz de contiguidad no plenamente conectada; islas=2001, 2003

## Nota EDG / CIE-10

- El numerador EDG usa los primeros 3 caracteres del campo `CAUSA` y filtra exactamente `V01-V89` como accidentes de transporte terrestre. `V00` queda excluido explicitamente; en 2021-2024 no existieron registros `V00`, por lo que el cierre de la regex no altera los conteos actuales.
- Los codigos `V90-V99` quedan excluidos porque corresponden a transporte acuatico/aereo u otros accidentes de transporte no terrestre. En 2021-2024 se identificaron 43 registros `V90-V99` excluidos.
- Los 179 registros que pasaban `V01-V89` pero no resolvian a canton/parroquia fueron recuperados mediante normalizacion de variantes territoriales del origen EDG (`Empalme` -> `El Empalme`, `La Condordia` -> `La Concordia`, abreviaturas `Crnel.`/`Gnral.`, y errores tipograficos como `Cotacahi`, `Olemdo`). El conteo final `fallecidos_sin_georreferenciar_2021_2024` es 0.
- `V89` (tipo de vehiculo no especificado) concentra 11,648 de 15,297 fallecidos de transito EDG 2021-2024 (~76.1%). Es una limitacion conocida del registro civil, no un error del pipeline. El desglose por tipo de usuario vial es mas confiable en SPPAT (campo `Condicion`) que en EDG por esta razon.

## Limitaciones

- Las tasas cantonales esconden variacion intraurbana e intravia.
- Los resultados dependen de la calidad de los campos historicos ya integrados en la capa cantonal.
- Un hotspot cantonal no identifica un punto exacto de riesgo; orienta priorizacion territorial.
- Para analisis puntual se requiere una fuente de siniestros georreferenciada validada.
