# Metodologia consolidada

## Principios

1. Los faltantes permanecen `null`/`sin_dato`; ausencia de registro no equivale
   automaticamente a cero.
2. Los conteos territoriales se publican completos; los microdatos puntuales ANT
   se preparan en una fase separada con minimizacion de atributos.
3. Toda tasa conserva numerador, denominador, periodo y escala.
4. La geometria web sirve para visualizacion, no para precision catastral.
5. Una clasificacion inferencial solo se muestra si existe soporte espacial.

## Unidades territoriales

### Cantones

La fuente tiene 224 entidades, EPSG:32717. Se reproyecto a EPSG:4326 y se
simplifico con mapshaper usando `interval=40m keep-shapes` y precision 0.00001
grados. Se conservaron DPA_CANTON, DPA_DESCAN, DPA_PROVIN y DPA_DESPRO.

### Provincias

La geometria usa la capa oficial CONALI publicada el 20 de febrero de 2025:
24 provincias, una zona en estudio y una isla (26 areas). Los conteos
estadisticos de provincias ordinarias se agregan desde cantones. Las tasas se
recalculan con numeradores y denominadores sumados; nunca se promedian tasas.

### Parroquias

La geometria usa CONALI vigente al 3 de febrero de 2026 y contiene 1.050
parroquias/areas. Las zonas en estudio y la isla conservan categoria territorial
propia: no se rellenan, no se asignan a un lado y no se confunden con
`sin_dato`.

## Siniestros ANT / INEC-ESTRA

ANT es el registro administrativo primario e INEC/ESTRA publica su
procesamiento estadistico. Son dos etapas de una misma cadena y no deben
sumarse como fuentes rivales. Cada fila representa un siniestro; se normalizan
codigos DPA y se agregan:

- conteo total por anio;
- fallecidos, lesionados y victimas informados;
- clase, causa, zona urbana/rural y patron horario.

Cobertura publicada: 2017-2026. Los anos 2017, 2018 y 2020 proceden de
EDT/ANET (catalogos ANDA 704, 786 y 894). Para 2021-2024, el DPA del microdato
ANT resolvio de forma trazable 47 de los 119 registros antes no agregados:
30 en 2021 y 17 en 2022. Los 72 restantes corresponden a zonas en estudio:
15 en 2021, 17 en 2022, 11 en 2023 y 29 en 2024. Permanecen en el total
nacional y no se asignan especulativamente a un poligono.

2025 es un ano completo semidefinitivo: ANT (20.346 siniestros, 17.932
lesionados y 2.354 fallecidos en sitio) coincide exactamente con la suma de
INEC/ESTRA I-IV. 2026 es provisional y cubre enero-junio: 10.752 siniestros,
9.220 lesionados y 1.226 fallecidos en sitio. INEC/ESTRA I-2026 coincide con
ANT (4.789 / 4.032 / 603); el trimestre II no estaba publicado al 27 de julio
de 2026. El corte 2026 solo se compara con enero-junio de 2025, nunca con un
ano completo.

### Control de divulgacion estadistica

El umbral SDC es 5 y se aplica a tabulaciones cruzadas de multiples atributos
(por ejemplo, tipo por causa por franja horaria por parroquia). No se aplica a
los conteos territoriales principales de siniestros, lesionados y fallecidos
por provincia, canton o parroquia: son cifras oficiales publicas y su
supresion romperia la lectura territorial sin aportar proteccion adicional.

## Fallecidos EDG y CIE-10

Se toma el tallo de tres caracteres de `CAUSA` o `CAUSA4`. La expresion valida
es `^V(0[1-9]|[1-7][0-9]|8[0-9])$`: incluye V01-V89 y excluye V00/V90-V99.
Los rangos de usuario vial son:

| Categoria | Rango |
|---|---|
| Peaton | V01-V09 |
| Ciclista | V10-V19 |
| Motociclista | V20-V29 |
| Ocupante | V30-V79 |
| Otros/no especificado | V80-V89 |

En 2021-2024 los 179 registros inicialmente no resueltos fueron recuperados
con variantes territoriales auditables. El resultado publicado coincide con
los 15.297 registros V01-V89 de esos cuatro anos. Para 2020 hay 2.578 casos
adicionales, tambien completamente agregados.

V89 concentra 11.648 de 15.297 fallecidos 2021-2024 (76,1%). Existe una dependencia empírica severa al código V892 en 2024 que varía drásticamente por cantón (DMQ 99.01% vs Guayaquil 91.58% vs Cuenca 67.44%). Esta alta tasa de "vehículo no especificado" está verificada en el microdato, pero su causa institucional de registro no está explicada; no debe interpretarse como estructura real de usuarios viales, sino como una limitación de la fuente o un "sin dato" de facto.

## SPPAT

Se agregan 16.526 filas 2016-2021 por canton, anio, condicion, sexo y tipo de
accidente. SPPAT describe reclamaciones/protecciones registradas, no el universo
exhaustivo de defunciones. Su campo `Condicion` es mas informativo que EDG para
tipo de usuario, pero responde a otra cobertura administrativa.

## Poblacion y tasas

Poblacion: proyecciones INEC 2010-2035, 221/224 unidades con dato.

- `tasa_fallecidos_100k = fallecidos / poblacion_del_mismo_anio * 100000`.
- `tasa_siniestros_por_1000_vehiculos_2024 = siniestros_2024 /
  vehiculos_matriculados_2024 * 1000`.
- `tasa_fallecidos_por_1000_vehiculos_2024 = fallecidos_EDG_2024 /
  vehiculos_matriculados_2024 * 1000`.
- `tasa_motociclistas_fallecidos_por_1000_motos_2024 = motociclistas_EDG_2020_2024 /
  motos_matriculadas_2024 * 1000`.

La ultima formula mezcla numerador de cinco anos con denominador de un ano y
solo es exploratoria. Los vehiculos reflejan residencia del propietario, no
lugar de circulacion.

## Hotspots

Para cada ano se calcula la tasa cantonal de fallecidos por 100.000 habitantes
y una matriz Queen de vecinos. `esda.G_Local` usa 999 permutaciones, semilla 42,
`star=1.0`, pesos estandarizados por fila y alfa 0,05. Local Moran se conserva
como diagnostico complementario.

## Clasificación Dinámica y Simbolización

El geoportal no utiliza cortes fijos ni un único método estadístico para las variables continuas. Al seleccionar una variable, cambiar de año, o hacer zoom a un nivel territorial distinto, el sistema evalúa dinámicamente varios parámetros matemáticos para encontrar la representación visual más óptima:

1. **Transformación Logarítmica**: Se identifica automáticamente el sesgo en los datos. Si más del 70% de las unidades territoriales se concentran en el rango basal inicial (ej. un comportamiento de ley de potencia extremo), los datos se transforman con una función logarítmica (ln(x+1)) antes de clasificarse, mitigando la opacidad visual de un mapa "plano".
2. **K Adaptativo (Número de clases)**: El número de intervalos no es fijo. El algoritmo itera entre 5 y 7 clases (`k`). Incrementa de clases únicamente si la nueva partición representa una mejora significativa de la varianza estadística del conjunto (`ΔGVF > 0.02`).
3. **Selección del Método Matemático**:
    - **Rupturas Naturales (Jenks / ckmeans)**: Minimiza la varianza dentro de las clases y la maximiza entre clases. Óptimo para distribuciones asimétricas (el preferido por defecto).
    - **Intervalos Iguales**: Divide el rango de los datos en segmentos de igual tamaño.
    - **Cuantiles**: Distribuye la misma cantidad de territorios en cada clase.
4. **Goodness of Variance Fit (GVF)**:
   `GVF = 1 - (Varianza intra-clase / Varianza total)`
   El método con el GVF más alto gana automáticamente.

Las paletas de colores aplicadas se derivan del estándar cartográfico **ColorBrewer**, agrupando variables por familias semánticas: las fatalidades usan `Reds` o `OrRd`, los siniestros usan `Oranges`, las tasas de riesgo relativo usan `Purples` y la infraestructura usa gamas de azules/verdes. Esto garantiza legibilidad y daltonismo-friendly en variaciones cromáticas y de luminancia.

- `caliente`: Gi* positivo y p <= 0,05.
- `frio`: Gi* negativo y p <= 0,05.
- `no_significativo`: p > 0,05.
- `isla_sin_vecinos`: sin vecino geografico; z/p quedan null.
- `sin_dato`: numerador o poblacion insuficiente.

Un hotspot cantonal no localiza un tramo peligroso. La inferencia es sensible
a la falacia ecologica, la definicion de vecinos y la cobertura desigual.

## Quintiles y zoom

El frontend calcula cuantiles 20/40/60/80 sobre valores finitos de la capa y
variable activas. Los umbrales se recalculan al cambiar zoom o variable. Valores
faltantes usan el estilo `sin_dato`; el cero solo entra cuando la configuracion
de la variable declara `zeroIsData`.

- Zoom <= 7: provincias, adecuado para la extension nacional.
- Zoom 8-10: cantones, equilibrio entre detalle y legibilidad.
- Zoom >= 11: parroquias, donde la escala permite distinguir unidades menores.

Son umbrales de interfaz, no criterios estadisticos.

## Capas OSM/Mapillary

Los extractores consultan tags de Overpass y recortan a Pichincha. La presencia
de un elemento refleja cobertura colaborativa de OSM, no un inventario oficial.
Mapillary tiene actualmente cero features porque falta una extraccion validada;
el archivo vacio se mantiene para que la ausencia sea explicita.

### Vias OSM

La red vial usa exclusivamente OpenStreetMap, consultado por provincia mediante
Overpass API el 22 de julio de 2026. Se deduplican los objetos por
`osm_type/osm_id`, se recortan al territorio nacional y se separan asi:

- vias principales: `highway=motorway|trunk|primary`;
- vias secundarias: `highway=secondary|tertiary`.

La prueba de completitud obtuvo 11.897,384 km OSM de vias principales frente a
9.858,600 km en 725 tramos de la Red Vial Estatal MTOP 2024: una razon de
120,68%. El resultado supera el umbral operativo de 70%, pero no debe
interpretarse como cobertura literal superior al 100%: la jerarquia funcional
de OSM incluye vias que no necesariamente pertenecen juridicamente a la Red
Vial Estatal. Es una comprobacion orientativa de magnitud, no una conciliacion
tramo a tramo.

`tertiary` suma 18.350,325 km y representa 72,26% del grupo publicado como vias
secundarias. Se conserva porque la consulta exige la etiqueta jerarquica
explicita y verifico cero elementos de clases locales `residential`,
`unclassified` o `service`. Su peso y la naturaleza colaborativa de OSM son
limitaciones declaradas.

Las capas lineales publicadas suman 37.292,128 km mapeados. No miden trafico,
estado de la via, seguridad ni pertenencia a la red estatal. La ausencia de una
via tampoco demuestra que no exista fisicamente.

## Privacidad

Fechas exactas, edad, sexo, causa y parroquia de EDG/SPPAT pueden facilitar
reidentificacion por combinacion. Las fuentes crudas son de uso interno
restringido. El geoportal publica sumas y categorias agregadas; no nombres,
documentos, coordenadas de victimas ni filas individuales.
