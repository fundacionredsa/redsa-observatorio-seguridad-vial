# Limites Cantonales WGS84

Archivo generado: `cantones_wgs84.geojson`

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

## Validacion

- Features fuente: 224
- Features salida: 224
- Vertices fuente: 5,990,430
- Vertices salida: 235,749
- Tamano salida: 4,901,430 bytes (4.67 MiB)
- Geometrias validas en salida: 224 / 224
- Huecos internos en la union disuelta: ninguno mayor a ~1 km2
- Hueco interno maximo aproximado en fuente original: ~0.008 km2
- Hueco interno maximo aproximado en salida simplificada: ~0.009 km2

Nota tecnica: `shapely.coverage_is_valid` reporta `False` tambien para la cobertura derivada, por lo que esta capa no debe usarse para analisis topologico o mediciones de precision. La simplificacion se hizo con preservacion topologica de bordes compartidos mediante mapshaper, pero el producto final es para visualizacion web.

## Licencia y Atribucion

CKAN reporta `license_id=cc-by` y `license_title=Creative Commons Attribution`. El metadato consultado no explicita una version numerica concreta de Creative Commons; por tanto, esta capa debe atribuirse como derivada de datos abiertos CC BY / Creative Commons Attribution del Ministerio de Gobierno, publicados en datosabiertos.gob.ec.

## Advertencia de Uso

Esta es una version simplificada para visualizacion web del geoportal REDSA Observa. No reemplaza el shapefile original confirmado en `fuentes_confirmadas` para analisis de precision, procesos PostGIS o construccion de capas territoriales oficiales.
