# Diccionario de datos

El inventario exhaustivo, una fila por ruta JSON realmente observada, se genera
con `python scripts/generar_diccionario_geojson.py` y se publica como
`documentacion/diccionario_campos.csv`. Esta pagina define las familias de
campos y evita repetir cientos de claves de anos, horas y categorias.

## Convenciones comunes

| Campo/patron | Tipo | Significado | Unidad | Fuente | Ejemplo |
|---|---|---|---|---|---|
| `DPA_PROVIN` | string | Codigo DPA de provincia | codigo, 2 caracteres | INEC/CONALI | `17` |
| `DPA_DESPRO` | string | Nombre oficial de provincia | texto | INEC/CONALI | `PICHINCHA` |
| `DPA_CANTON` | string | Codigo DPA de canton | codigo, 4 caracteres | INEC/CONALI | `1701` |
| `DPA_DESCAN` | string | Nombre de canton | texto | INEC/CONALI | `DISTRITO METROPOLITANO DE QUITO` |
| `DPA_PARROQ` | string | Codigo DPA parroquial | codigo | INEC 2014 | `170150` |
| `DPA_DESPAR` | string | Nombre de parroquia | texto | INEC 2014 | `QUITO` |

## Cantones y provincias

Aplica a `cantones_wgs84.geojson` y, salvo indicacion, a
`provincias_wgs84.geojson`.

| Campo/patron | Tipo | Significado | Unidad/fuente |
|---|---|---|---|
| `poblacion`, `poblacion_2024` | integer/null | Proyeccion mas reciente expuesta | habitantes, INEC |
| `poblacion_por_anio.{anio}` | integer | Proyeccion anual 2010-2035 | habitantes, INEC |
| `siniestros_historico.{anio}` | integer | Siniestros resueltos a la unidad | eventos, INEC; 2019/2021-2024 |
| `inec_resumen_historico.{anio}.siniestros` | integer | Igual al conteo anual | eventos |
| `inec_resumen_historico.{anio}.lesionados` | integer | Lesionados declarados en eventos | personas |
| `inec_resumen_historico.{anio}.fallecidos` | integer | Fallecidos declarados en eventos | personas |
| `inec_por_clase.{anio}.{clase}` | integer | Eventos por clase de siniestro | eventos |
| `inec_por_causa.{anio}.{causa}` | integer | Eventos por causa probable reportada | eventos |
| `inec_urbano_rural.{anio}.{zona}` | integer | Eventos por zona urbana/rural | eventos |
| `inec_patron_horario.{anio}.{franja}` | integer | Eventos por franja horaria | eventos |
| `fallecidos_historico.{anio}` | integer | Defunciones con CIE-10 V01-V89 | personas, EDG 2020-2024 |
| `fallecidos_parroquial.{anio}` | integer/null | Suma directa de `fallecidos_por_anio` de las parroquias del territorio | personas, EDG 2021-2024 |
| `fallecidos_cobertura_pct.{anio}` | number | Porcentaje de parroquias con valor anual disponible | porcentaje; 0 no se interpreta como cero fallecidos |
| `fallecidos_detallado.{anio}.sexo.{sexo}` | integer | Defunciones por sexo registrado | personas, EDG 2020-2024 |
| `fallecidos_detallado.{anio}.edad.{grupo}` | integer | Defunciones por grupo etario | personas, EDG 2020-2024 |
| `fallecidos_detallado.{anio}.usuario.{tipo}` | integer | Usuario inferido del rango CIE-10 | personas, EDG 2020-2024 |
| `fallecidos_sppat_2016_2021` | integer/null | Total de fallecidos registrados | personas, SPPAT |
| `sppat_fallecidos_por_anio.{anio}` | integer | Fallecidos por ano | personas, SPPAT |
| `sppat_por_condicion.{anio}.categorias.{categoria}` | integer | Fallecidos por condicion vial | personas, SPPAT |
| `sppat_por_sexo.{anio}.categorias.{categoria}` | integer | Fallecidos por sexo | personas, SPPAT |
| `sppat_por_tipo_accidente.{anio}.categorias.{categoria}` | integer | Fallecidos por tipo de accidente | personas, SPPAT |
| `vehiculos_matriculados_2024.total` | integer/null | Vehiculos por residencia del propietario | vehiculos, ESTRA 2024 |
| `vehiculos_matriculados_2024.por_clase.{clase}` | integer/null | Vehiculos matriculados por clase | vehiculos |
| `vehiculos_matriculados_2024.estado` | string | `disponible` o `sin_dato` | bandera de calidad |
| `tasa_fallecidos_100k` | number/null | Fallecidos INEC 2019 / poblacion 2019 x 100.000 | por 100.000 hab. |
| `tasa_fallecidos_100k_por_anio.{anio}` | number/null | Fallecidos EDG / poblacion del ano x 100.000 | solo provincias/hotspots |
| `tasa_siniestros_por_1000_vehiculos_2024` | number/null | Siniestros 2024 / vehiculos 2024 x 1.000 | por 1.000 vehiculos |
| `tasa_fallecidos_por_1000_vehiculos_2024` | number/null | Fallecidos EDG 2024 / vehiculos 2024 x 1.000 | por 1.000 vehiculos |
| `tasa_motociclistas_fallecidos_por_1000_motos_2024` | number/null | Motociclistas EDG 2024 / motos 2024 x 1.000 | por 1.000 motos |
| `porcentaje_motocicletas_vehiculos_2024` | number/null | Motocicletas / total de vehiculos 2024 x 100 | porcentaje de flota matriculada |
| `cobertura_mapeo_osm.elementos_total` | integer | Semaforos/rotondas, cruces y aceras mapeados | conteo OSM; no mide existencia fisica |
| `cobertura_mapeo_osm.por_capa.{capa}` | integer | Conteo deduplicado de la capa intersectada | conteo OSM |
| `cobertura_mapeo_infraestructura_por_100k` | number/null | Elementos OSM / poblacion 2024 x 100.000 | indicador de cobertura de mapeo |
| `calidad_tasas_vehiculos_2024.{tasa}` | string | Motivo de disponibilidad/faltante | bandera de calidad |
| `cobertura_datos.{campo}.{anio}.estado` | string | `completo`, `parcial` o `sin_dato` | solo provincias |
| `cobertura_datos...cantones_*` | integer/array | Conteos/codigos usados para cobertura | solo provincias |
| `cantones_incluidos` | integer | Cantones disueltos en provincia | conteo |
| `nivel_agregacion` | string | Nivel del feature | `provincia` |
| `fuente_geometria` | string | Procedencia de la disolucion | texto |

Campos de compatibilidad como `siniestros_inec_2019`,
`fallecidos_inec_2019`, `lesionados_inec_2019` y
`matriculados_prov_inec_2019` conservan la primera version del frontend. No se
deben usar para ampliar series nuevas; use los objetos historicos.

## Parroquias

| Campo | Tipo | Significado | Unidad/fuente |
|---|---|---|---|
| `fallecidos_2021_2024` | integer | Total EDG V01-V89 2021-2024 | personas |
| `fallecidos_por_anio.{anio}` | integer | EDG V01-V89 del ano | personas |

Un cero parroquial significa cero filas asignadas por el pipeline; debe
interpretarse junto con la vigencia incompleta de la geometria 2014.

La misma serie se publica en cantones y provincias como
`fallecidos_parroquial.{anio}`. Se deriva exclusivamente de esta capa
parroquial, sin mezclar `fallecidos_historico`, SPPAT ni otra fuente. Los
cantones sin parroquias representadas reciben `null` y cobertura 0%, nunca un
cero falso.

## Hotspots

| Campo/patron | Tipo | Significado | Ejemplo |
|---|---|---|---|
| `hotspot_gi.{anio}.z_score` | number/null | Estadistico estandarizado Gi* | `2.18` |
| `hotspot_gi.{anio}.p_value` | number/null | p por permutaciones | `0.013` |
| `hotspot_gi.{anio}.categoria` | string | caliente/frio/no_significativo/isla_sin_vecinos/sin_dato | `caliente` |
| `local_moran.{anio}.i_local` | number/null | I local de Moran | `0.42` |
| `local_moran.{anio}.p_value` | number/null | p por permutaciones | `0.031` |
| `local_moran.{anio}.categoria` | string | alto_alto/bajo_alto/bajo_bajo/alto_bajo/no_significativo/... | `alto_alto` |
| `tasa_fallecidos_100k_por_anio.{anio}` | number/null | Variable analizada | `14.6` |

## Capas OSM y REDSA

| Campo | Capas | Significado |
|---|---|---|
| `osm_id` | todas OSM | Identificador del objeto OpenStreetMap |
| `attribution` | varias OSM | Texto de atribucion ODbL |
| `name` | lineales | Nombre OSM, si existe |
| `highway` | vias | Valor del tag `highway` |
| `cycleway` | ciclovias | Valor de tags ciclistas |
| `sidewalk` | aceras | Lado/cobertura de acera declarada |
| `crossing` | cruces | Tipo de cruce declarado |
| `traffic_calming` | pacificacion | Dispositivo de pacificacion |
| `junction` | semaforos/rotondas | Tipo de interseccion |
| `lit` | iluminacion | Iluminacion declarada |
| `maxspeed` | velocidad | Limite OSM, texto sin normalizar |
| `lanes:bus` | BRT | Numero/texto del tag de carriles bus |
| `DPA_CANTONES`, `DPA_PROVINCIAS` | todas OSM nacionales | Codigos territoriales intersectados |
| `representacion` | todas OSM nacionales | Geometria OSM o centro representativo optimizado |
| `corridor_key` | corredores REDSA | Clave interna del corredor |
| `priority` | corredores REDSA | Prioridad REDSA (`Muy Alta`/`Alta`) |

`mapillary_pichincha.geojson` no tiene features ni campos publicados.
