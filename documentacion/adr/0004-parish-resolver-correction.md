# 4. Corrección del Algoritmo de Resolución Parroquial

Date: 2026-07-17

## Status

Accepted

## Context

El registro de Defunciones Generales (EDG) clasifica la ocurrencia territorial a nivel de provincia, cantón y parroquia. El proceso automatizado `geoportal_estadisticas` intentaba cruzar las parroquias (texto y códigos de la base) contra el shapefile CONALI 2014 (`SHP_INEC_2014.zip`).

Durante la revisión en DMQ, se descubrió que los datos de fallecidos para 2021-2024 a nivel parroquial no estaban siendo agregados correctamente a "QUITO" ni a las demás parroquias por un bug de coincidencia de nombres: el sistema comparaba el nombre de la parroquia ("QUITO") con el nombre del cantón ("DISTRITO METROPOLITANO DE QUITO"), lo cual fallaba y resultaba en falsos negativos. Además, existía un "fallback inseguro" que asignaba siniestros a la "primera parroquia del cantón" cuando no encontraba coincidencias. 

## Decision

Se reescribió la lógica de resolución en `geoportal_estadisticas/process_parroquias.py` y `utils.py`:
1. **Resolución Jerárquica Obligatoria**: Primero se asegura el código DPA del cantón (`DPA_CANTON`). Una vez aislado el cantón exacto, se busca la coincidencia parroquial **únicamente dentro de los polígonos que pertenecen a ese cantón**.
2. **Eliminación de Fallbacks Ambiguos**: Se eliminó el comportamiento de asignar a la "primera parroquia" en caso de duda. 
3. **Casos Especiales Urbanos (Cabeceras)**: Se preservó la lógica documentada para agregar parroquias urbanas sin geometría en el sufijo de cabecera cantonal.

## Consequences

- **Positivas**: Las cifras de recuperación aumentaron drásticamente con precisión espacial garantizada. Para el período 2021-2024 se recuperaron respectivamente 122, 158, 178 y 182 polígonos con coincidencias perfectas. DMQ y otras zonas metropolitanas ahora proyectan los polígonos parroquiales completos en el Geoportal. Los totales cantonales de `cantones_wgs84.geojson` permanecen inalterados.
- **Negativas**: Mayor estrictez algorítmica significa que algunos nombres periféricos con errores ortográficos severos que antes podrían haber hecho match falso, ahora requieren auditoría manual en futuras fases (aunque actualmente la cobertura es altísima).
