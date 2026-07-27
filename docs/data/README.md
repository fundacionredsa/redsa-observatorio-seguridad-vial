# Limites Cantonales WGS84

Archivo generado: `cantones_wgs84.geojson`

Archivo derivado adicional: `provincias_wgs84.geojson`

Metodologias complementarias:

- `vehiculos_metodologia.md`
- `hotspots_metodologia.md`
- `temporal_osm_metodologia.md`

## Serie territorial de siniestros

`siniestros_historico` cubre 2017-2026 en provincias y cantones. El nivel
parroquial tiene dato comprobable desde 2024; 2017-2023 permanece `null`.
2025 es un ano completo semidefinitivo y 2026 es un corte provisional de
enero-junio, comparable solo con `siniestros_enero_junio_2025`.

El bloque `metadata.siniestros_transito_territorial` declara por ano la fuente,
fecha de corte, total nacional y conteo de zonas en estudio que no se asignan a
un poligono ordinario.

Capas OSM nacionales (corte 2026-07-16):

- `ciclovias_ecuador.geojson`
- `aceras_ecuador.geojson`
- `cruces_ecuador.geojson`
- `pacificacion_ecuador.geojson`
- `semaforos_rotondas_ecuador.geojson`
- `iluminacion_ecuador.geojson`
- `velocidad_ecuador.geojson`
- `brt_metrobus_ecuador.geojson`
- `osm_cobertura_reporte.json` (conteos y tamanos auditables)

## Fuente

- Dataset original: Organizacion Territorial Cantonal
- Publicador: Ministerio de Gobierno - Direccion de Limites Territoriales Internos
- Portal: https://www.datosabiertos.gob.ec
- Recurso original: https://www.datosabiertos.gob.ec/dataset/f3ed6f26-a85c-449a-9246-2bdc9a612b4b/resource/11b85d91-9139-4709-97dd-4bc0b92d4f02/download/organizacion-territorial-cantonal.zip
- Archivo fuente local: `fuentes_confirmadas/territorial_cantonal_descomprimido/ORGANIZACION_TERRITORIAL_CANTONAL.shp`
- Fecha del recurso CKAN: 2025-02-20
- Fecha de generacion de esta capa: 2026-07-14

## Transformacion

- CRS original confirmado: `EPSG:32717` (`WGS_1984_UTM_Zone_17S`)
- CRS de salida: `EPSG:4326`
- Metodo: reproyeccion y simplificacion topologica con `mapshaper`
- Tolerancia final de simplificacion: `interval=40m`
- Precision de coordenadas de salida: `0.00001` grados
- Comando base:

```powershell
npx --yes mapshaper "<SHAPEFILE_ORIGEN>" encoding=utf8 -filter-fields DPA_CANTON,DPA_DESCAN,DPA_PROVIN,DPA_DESPRO -proj EPSG:4326 -simplify interval=40m keep-shapes -o format=geojson precision=0.00001 "geoportal/data/cantones_wgs84.geojson"
```

## Atributos Conservados

- `DPA_CANTON`
- `DPA_DESCAN`
- `DPA_PROVIN`
- `DPA_DESPRO`

## Capas Provincial y Parroquial Oficiales

`provincias_wgs84.geojson` usa la geometria oficial CONALI publicada el
2025-02-20. Contiene las 24 provincias (`01` a `24`), una `ZONA EN ESTUDIO`
(`90`) y `ISLA`: 26 áreas en total. Las estadísticas de las provincias
regulares se agregan desde cantones; las áreas especiales conservan `txt`,
`categoria_territorial` y `no_aplica_zona_especial`.

`parroquias_wgs84.geojson` usa la organización territorial CONALI vigente al
2026-02-03: 1.050 parroquias/áreas. El cruce histórico confirmado
`140157 -> 141350` reasigna 21 fallecidos EDG de Sevilla Don Bosco al código
vigente, sin cambiar los totales nacionales.

Ambas geometrías se procesan con mapshaper 0.7.48: reproyección a EPSG:4326,
normalización submétrica de vértices, `clean only-arcs` y simplificación
topológica de 40 m. La precisión final es 0.000005 grados.

Atributos agregados por suma provincial:

- `poblacion_por_anio`
- `fallecidos_historico`
- `siniestros_historico`
- `fallecidos_sppat_2016_2021`
- `siniestros_inec_2019`
- `lesionados_inec_2019`
- `fallecidos_inec_2019`
- desgloses `sppat_*`, `inec_*` y `fallecidos_detallado`
- `vehiculos_matriculados_2024` y composicion de flota
- cobertura de mapeo OSM, cuando las ocho capas nacionales han sido extraidas
- `fallecidos_parroquial` 2021-2024, agregado directamente desde
  `parroquias_wgs84.geojson`, con `fallecidos_cobertura_pct` por ano

La tasa `tasa_fallecidos_100k` se recalcula a nivel provincial con numerador y denominador agregados, no promediando tasas cantonales. Los años con cantones sin dato no se imputan como cero: el archivo declara cobertura por campo y año en `properties.cobertura_datos`, con `estado` igual a `completo`, `parcial` o `sin_dato`.

La agregacion parroquial se reproduce con
`python scripts/agregar_fallecidos_territorial.py`. Los grupos históricos se
auditan antes de publicar; el script detiene la ejecución si un grupo sin
geometría contiene un valor distinto de cero.

Validacion de `provincias_wgs84.geojson`:

- Features salida: 26
- CRS: `EPSG:4326`
- Geometrias validas: 26 / 26
- Solapamientos y huecos internos posteriores: 0

## Validacion

- Features fuente: 224
- Features salida: 224
- Vertices fuente: 5,990,430
- Vertices salida: 235,749
- Tamano de la geometria simplificada inicial: 4,901,430 bytes (4.67 MiB)
- El GeoJSON publicado posteriormente incorpora series y desgloses estadisticos; por eso su tamano actual es mayor y debe consultarse en el manifiesto de cada entrega.
- Geometrias validas en salida: 224 / 224
- Huecos internos en la union disuelta: ninguno mayor a ~1 km2
- Hueco interno maximo aproximado en fuente original: ~0.008 km2
- Hueco interno maximo aproximado en salida simplificada: ~0.009 km2

Nota tecnica: `shapely.coverage_is_valid` reporta `False` tambien para la cobertura derivada, por lo que esta capa no debe usarse para analisis topologico o mediciones de precision. La simplificacion se hizo con preservacion topologica de bordes compartidos mediante mapshaper, pero el producto final es para visualizacion web.

## Licencia y Atribucion

CKAN reporta `license_id=cc-by` y `license_title=Creative Commons Attribution`. El metadato consultado no explicita una version numerica concreta de Creative Commons; por tanto, esta capa debe atribuirse como derivada de datos abiertos CC BY / Creative Commons Attribution del Ministerio de Gobierno, publicados en datosabiertos.gob.ec.

## Advertencia de Uso

Esta es una version simplificada para visualizacion web del geoportal REDSA Observa. No reemplaza el shapefile original confirmado en `fuentes_confirmadas` para analisis de precision, procesos PostGIS o construccion de capas territoriales oficiales.
