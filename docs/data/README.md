# Limites Cantonales WGS84

Archivo generado: `cantones_wgs84.geojson`

Archivo derivado adicional: `provincias_wgs84.geojson`

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

## Capa Provincial Derivada

`provincias_wgs84.geojson` fue generado disolviendo `cantones_wgs84.geojson` por `DPA_PROVIN`, sin incorporar un shapefile nuevo. La capa contiene 24 provincias oficiales (`01` a `24`) y excluye los grupos no provinciales presentes en la fuente cantonal (`90` e `ISLA`).

Atributos agregados por suma provincial:

- `poblacion_por_anio`
- `fallecidos_historico`
- `siniestros_historico`
- `fallecidos_sppat_2016_2021`
- `siniestros_inec_2019`
- `lesionados_inec_2019`
- `fallecidos_inec_2019`
- desgloses `sppat_*`, `inec_*` y `fallecidos_detallado`

La tasa `tasa_fallecidos_100k` se recalcula a nivel provincial con numerador y denominador agregados, no promediando tasas cantonales. Los años con cantones sin dato no se imputan como cero: el archivo declara cobertura por campo y año en `properties.cobertura_datos`, con `estado` igual a `completo`, `parcial` o `sin_dato`.

Validacion de `provincias_wgs84.geojson`:

- Features salida: 24
- CRS: `EPSG:4326`
- Geometrias validas: 24 / 24
- Tamano salida: 2,253,607 bytes (2.15 MiB)

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
