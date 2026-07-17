# Evidencia de validacion

Fecha de corte: 2026-07-16. Los comandos repetibles estan en
`scripts/verificar_datos_publicados.py` y `tests/`.

## Contratos de archivos publicados

| Archivo | Features | Control |
|---|---:|---|
| cantones_wgs84.geojson | 224 | codigos DPA unicos |
| provincias_wgs84.geojson | 24 | suma cantonal = suma provincial |
| parroquias_wgs84.geojson | 1.040 | codigos parroquiales unicos |
| hotspots_cantonales.geojson | 224 | mismo conjunto DPA cantonal |

## Conciliaciones nacionales

| Fuente/ano | Filas fuente relevantes | Suma cantonal | Suma provincial | Diferencia |
|---|---:|---:|---:|---:|
| Siniestros 2019 | 24.595 | 24.595 | 24.595 | 0 |
| Siniestros 2021 | 21.352 | 21.307 | 21.307 | 45 no resueltos |
| Siniestros 2022 | 21.739 | 21.705 | 21.705 | 34 no resueltos |
| Siniestros 2023 | 20.994 | 20.983 | 20.983 | 11 no resueltos |
| Siniestros 2024 | 21.220 | 21.191 | 21.191 | 29 no resueltos |
| EDG V01-V89 2020 | 2.578 | 2.578 | 2.578 | 0 |
| EDG V01-V89 2021 | 3.339 | 3.339 | 3.339 | 0 |
| EDG V01-V89 2022 | 3.676 | 3.676 | 3.676 | 0 |
| EDG V01-V89 2023 | 4.068 | 4.068 | 4.068 | 0 |
| EDG V01-V89 2024 | 4.214 | 4.214 | 4.214 | 0 |
| SPPAT 2016-2021 | 16.526 | 16.526 | 16.526 | 0 |
| Vehiculos ESTRA 2024 | 3.138.562 | 3.138.562 | 3.138.562 | 0 |

Los conteos EDG usan como denominador todas las defunciones: 117.030 (2020),
107.648 (2021), 91.954 (2022), 89.877 (2023) y 91.803 (2024).

## V89 y DMQ

V89 por ano: 1.758 (2020), 2.217 (2021), 2.693 (2022), 3.324 (2023) y
3.414 (2024). Para 2021-2024 son 11.648/15.297 = 76,1%.

DMQ publica: peaton 8, ciclista 2, motociclista 14, ocupante 1 y otro 2.180;
`otro` = 98,87%. La suma se verifico, pero la diferencia frente al patron
nacional permanece como limitacion no explicada.

## Pruebas UI

`tests/geoportal.spec.js` verifica:

- carga de 24/224/1.040 unidades;
- cambio de nivel por zoom y ocultamiento de capas no activas;
- quintiles por nivel/variable y contraste provincial;
- panel demografico dentro del viewport y sin interseccion con leyenda;
- persistencia del panel al salir de un poligono;
- atribuciones y disponibilidad explicita de variables.

`scripts/capturar_matriz.mjs` genera evidencia de cada opcion del selector en
provincia/canton/parroquia y desktop/mobile. El paquete maestro de Drive incluye
el reporte de ejecucion y las capturas fechadas, no el repositorio para evitar
inflar su historial.

## Ejecucion del 2026-07-16

- Contratos Python del geoportal: 5/5 aprobados.
- Utilidades CIE-10 del pipeline: 2/2 aprobadas.
- Playwright Chromium: 8/8 aprobadas, escritorio y movil.
- Matriz visual: 48/48 capturas; 0 estados con nivel territorial incorrecto.
- Carga mediana integral: 2.782 ms escritorio y 2.888 ms movil.
- Carga interna de provincias/cantones: mediana 900 ms escritorio y 760 ms movil.
- Una de seis corridas integrales alcanzo 4.386 ms en movil.
- Carga inicial observada: 13 GeoJSON, 51.233.395 bytes decodificados (48,86 MiB).

El archivo completo de mediciones es
`artifacts/performance/reporte_rendimiento.json`; el paquete de auditoria conserva
una copia junto con las capturas. Las duraciones totales que imprime el runner de
Playwright incluyen arranque y aserciones y no deben confundirse con la metrica
de carga de la pagina.

## Interaccion territorial profesional (2026-07-16)

La validacion posterior a la refactorizacion D1-D5 produjo estos resultados:

- `npm run data:check`: aprobado; 224 cantones, 24 provincias y 1.040
  parroquias, sin cambios en los hashes de los GeoJSON publicados.
- `npm run data:test`: 10/10 contratos aprobados.
- Playwright Chromium: 29 pruebas aprobadas, 3 omitidas de forma intencional
  por perfil de viewport y 0 fallos, en escritorio y movil.
- El clic inicial en una unidad fija la seleccion sin abrir el popup historico
  ni cambiar de nivel; un segundo clic conserva el acceso al popup existente.
- El hover no modifica el sidebar ni el perfil demografico; la seleccion
  persiste durante el scroll y tiene cierre explicito.
- En 1366x768, el panel de perfil quedo en `x=426..1050` y la leyenda en
  `x=1066..1356`; con el sidebar abierto, el perfil inicia en `x=456` y el
  sidebar termina en `x=440`.
- En 390x844, el perfil quedo en `y=308..588` y la leyenda en
  `y=603,6..783,6`; no hay interseccion.
- `git diff -- docs/data` no reporto cambios: esta mision no modifico datos ni
  contratos territoriales.

La evidencia visual y las mediciones reproducibles estan en
`documentacion/evidencia_visual/interaccion_profesional/` y
`documentacion/EVIDENCIA_INTERACCION_PROFESIONAL.md`.

## Recuperacion movil (2026-07-16)

- `npm run data:dictionary`: 1.686 campos observados y diccionario regenerado.
- `npm run data:check`: aprobado; hashes y conteos de los GeoJSON sin cambios.
- `npm run data:test`: 10/10 contratos aprobados.
- Playwright: 30 pruebas aprobadas, 4 omitidas intencionalmente por proyecto de
  viewport y 0 fallos. La suite incluye siempre 390x844, 360x740 y 768x1024.
- En 390x844, la franja vertical libre entre panel ciudadano y leyenda aumento
  de 177 px a 429 px; la leyenda cerrada disminuyo de 180 px a 46 px.
- En 360x740, la franja libre aumento de 73 px a 332 px.
- El flujo tactil real abre/cierra ambos drawers, mueve el ano a 2022, selecciona
  el canton `1701`, conserva el perfil y abre/cierra la leyenda sin colisiones.
- Perfil movil `x=12..378`, `y=471..751`; leyenda cerrada `y=766..812`.
- La comparacion desktop controlada de la vista inicial produjo 0 de 1.049.088
  pixeles distintos. La seleccion conserva perfil `x=426..1050`, `y=460..740`
  y leyenda `x=1066..1356`.
- `git diff -- docs/data` permanece vacio: el cambio es exclusivamente de UI,
  pruebas, versionado de assets y documentacion.

La causa, decision responsive, capturas antes/despues y mediciones completas se
encuentran en `documentacion/EVIDENCIA_RECUPERACION_MOVIL.md`, ADR-009 y
`documentacion/evidencia_visual/recuperacion_movil/`.

## Ranking nacional y transparencia (2026-07-17)

- El ranking reutiliza el registro canonico de variables y el ano global, sin
  cambiar ningun GeoJSON ni contrato de datos.
- Para Siniestros INEC 2024 mostro 212 cantones comparables y excluyo 12 sin
  dato; la suma vuelve al universo completo de 224 cantones.
- La busqueda de Distrito Metropolitano de Quito conservo su posicion nacional
  2 de 212 mientras mostraba una unica fila resaltada.
- El dialogo midio `1040 x 720 px` en 1366x768 y `390 x 844 px` en 390x844,
  ambos completamente dentro del viewport.
- Las pruebas verifican orden y exclusion para Siniestros INEC 2024 y Tasa de
  fallecidos por 100.000 habitantes 2021, ademas de busqueda y experiencia
  movil accesible.
- `npm run data:dictionary`: 1.686 campos observados.
- `npm run data:check`: estado `ok`; conteos y hashes de datos conservados.
- `npm run data:test`: 10/10 contratos aprobados.
- Playwright: 32 pruebas aprobadas, 6 omitidas intencionalmente por proyecto de
  viewport y 0 fallos.

La evidencia reproducible se encuentra en
`documentacion/EVIDENCIA_RANKING_INSTITUCIONAL.md` y
`documentacion/evidencia_visual/ranking_institucional/`.
