# Series temporales y cobertura OSM

Fecha de actualizacion: 2026-07-16.

## Perfiles anuales de fallecidos

`fallecidos_detallado` se reproceso desde los microdatos EDG y ahora tiene la forma `fallecidos_detallado[anio]` para 2020-2024. Cada anualidad declara:

- `estado`: `completo`, `parcial` o `sin_dato`;
- `total`;
- desgloses `sexo`, `edad` y `usuario`;
- conteos de cobertura de los tres desgloses.

Los perfiles anuales reconcilian con `fallecidos_historico[anio]`. No se repartio proporcionalmente el antiguo agregado 2020-2024. Los faltantes de edad quedan declarados mediante `estado=parcial` y `cobertura.edad_conocida`.

Los campos `sppat_por_sexo`, `sppat_por_condicion` y `sppat_por_tipo_accidente` se reprocesaron como `campo[anio]` para 2016-2021. Cada entrada contiene `estado`, `total` y `categorias`. La fuente SPPAT contiene ademas 7 registros de 2014 y 156 de 2015: se conservaron en el diagnostico de origen, pero se excluyeron de los campos cuyo nombre y cobertura publicados son 2016-2021. No se imputaron a ningun ano.

## Registro temporal del geoportal

La interfaz mantiene un registro central por variable con:

```text
{tipo: anual | agregado_multianio | foto_unica, anios_disponibles: [...]}
```

El slider muestra la union 2016-2026: las series estadisticas llegan hasta 2024 y la foto OSM tiene corte 2026. Una variable anual lee exclusivamente el valor del ano seleccionado; un hueco queda visible y se representa como `sin_dato`. Las variables de foto unica deshabilitan el slider y muestran el badge `Dato fijo`, evitando que parezcan series historicas.

El sidebar, la tarjeta demografica, los sparklines y el marcador del grafico historico comparten el mismo estado global de ano. Se elimino el selector local que antes permitia consolidar siniestros de varios anos.

## Infraestructura OpenStreetMap nacional

Las capas `ciclovias`, `aceras`, `cruces`, `pacificacion`, `semaforos_rotondas`, `iluminacion`, `velocidad` y `brt_metrobus` se consultan mediante Overpass para las 24 provincias oficiales y se recortan contra la geometria nacional cantonal. El extractor:

1. divide las consultas por provincia y usa filtros poligonales simplificados para evitar descargar los rectangulos vecinos de cada provincia;
2. conserva cache local reanudable fuera de Git;
3. deduplica por `osm_type` + `osm_id`;
4. asigna los codigos de todos los cantones/provincias intersectados;
5. redondea coordenadas y simplifica lineas con tolerancia conservadora `0.00001` grados;
6. conserva geometria lineal para ciclovias, aceras y BRT; para vias con `lit=yes` o `maxspeed` publica el centro representativo del tramo, manteniendo `osm_id` y atributos;
7. publica GeoJSON compacto, lo carga solo cuando el usuario activa la capa y lo renderiza con Canvas de Leaflet para evitar miles de nodos SVG.

Las etiquetas que niegan la infraestructura (`sidewalk=no`, `cycleway=no`) o indican que se encuentra cartografiada por separado (`sidewalk=separate`, `cycleway=separate`) no se publican como aceras/ciclovias. Al activar una capa, el navegador agrega una mascara gris discontinua sobre los cantones sin elementos de esa capa; esa mascara representa falta de mapeo OSM, no ausencia fisica.

Instancias de referencia: [Overpass API public instances](https://wiki.openstreetmap.org/wiki/Overpass_API). Fuente de datos: OpenStreetMap contributors, licencia ODbL.

> **Limitacion de cobertura:** la ausencia de elementos en OSM significa que no estan mapeados en esa plataforma. No demuestra que la infraestructura no exista en el territorio.

### Conteos de expansion

El conteo `antes` corresponde a los GeoJSON heredados de Pichincha; `despues` corresponde a la extraccion nacional con corte 2026-07-16. Ademas del cambio de alcance, la version nacional excluye etiquetas OSM negativas o separadas, por lo que la tabla no debe interpretarse como una serie temporal de crecimiento.

| Capa | Antes: Pichincha | Despues: Ecuador |
|---|---:|---:|
| Ciclovias | 949 | 1.892 |
| Semaforos y rotondas | 3.193 | 7.889 |
| Cruces peatonales | 10.205 | 18.125 |
| Aceras | 7.687 | 14.879 |
| Iluminacion vial | 1.892 | 8.191 |
| Pacificacion de transito | 227 | 1.348 |
| Limites de velocidad | 6.015 | 26.960 |
| Carriles BRT/Metrobus | 11 | 27 |

La extraccion consulto 72.112 objetos OSM unicos. Los ocho GeoJSON finales pesan entre 0,01 MiB y 9,85 MiB; ninguno supera el limite de 100 MiB de GitHub.

## Cobertura de mapeo de infraestructura segura

`cobertura_mapeo_osm` suma, por canton, elementos intersectados de semaforos/rotondas, cruces y aceras. `cobertura_mapeo_infraestructura_por_100k` normaliza ese conteo con `poblacion_por_anio[2024]`.

El nivel provincial se cuenta directamente desde los codigos `DPA_PROVINCIAS` de cada feature OSM deduplicado. No se suman los conteos cantonales, porque una via que cruza una frontera cantonal podria duplicarse dentro de la provincia.

Este indicador mide intensidad de mapeo comunitario, no seguridad vial ni disponibilidad fisica de infraestructura. Un valor cero se publica como `sin_elementos_mapeados` y usa un estilo distinto de `sin_dato_poblacion`.

Resultado del corte: 184 de 224 cantones tienen al menos un elemento de las tres capas; 38 se publican como `sin_elementos_mapeados`. Tres cantones no tienen denominador poblacional 2024 y quedan como `sin_dato_poblacion` (uno de ellos si tiene elementos OSM, de ahi que los estados no sumen igual que el conteo de cantones con elementos). Las 24 provincias tienen elementos mapeados y poblacion de referencia.

## Composicion de flota

`porcentaje_motocicletas_vehiculos_2024` se calcula como motocicletas matriculadas / total de vehiculos matriculados x 100. Es una foto unica de 2024 y conserva la advertencia de ESTRA: el territorio corresponde a residencia del propietario, no necesariamente al lugar donde circula el vehiculo.

## Reproduccion

```powershell
python geoportal_estadisticas/extraer_osm_capas.py
python geoportal_estadisticas/calcular_cobertura_osm.py
```

Las rutas se resuelven por `REDSA_PUBLIC_REPO_DIR`; no hay rutas absolutas de Drive hardcodeadas en estos pasos.
