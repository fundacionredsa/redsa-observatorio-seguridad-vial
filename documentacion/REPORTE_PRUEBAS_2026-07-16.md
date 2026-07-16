# Reporte de pruebas 2026-07-16

## Resultado

| Suite | Resultado | Comando |
|---|---:|---|
| Contratos de datos publicados | 5/5 | `npm run data:test` |
| Conciliacion con fuentes crudas | Sin fallos | `npm run data:check` |
| Utilidades CIE-10 del pipeline | 2/2 | `python -m unittest discover -s tests -v` |
| UI Playwright Chromium | 8/8 | `npm test` |
| Matriz visual | 48/48 | `npm run screenshots` |
| Rendimiento | 6/6 corridas | `npm run performance` |

## Rendimiento

| Viewport | Corridas integrales (ms) | Mediana (ms) | Mediana interna (ms) |
|---|---|---:|---:|
| 1366x768 | 2.817, 2.768, 2.782 | 2.782 | 900 |
| 390x844 | 2.888, 2.478, 4.386 | 2.888 | 760 |

La metrica integral va desde `page.goto` hasta que `window.__redsaAudit` existe y
el loader se oculta. La metrica interna separa descarga y render de las capas
provincial/cantonal. La corrida movil de 4.386 ms supera el umbral orientativo de
4 s y evidencia variabilidad, aunque la mediana no lo supera.

La primera corrida observo 13 GeoJSON con 51.233.395 bytes decodificados
(48,86 MiB). El principal archivo es `cantones_wgs84.geojson`, con 19.985.385
bytes, seguido por aceras y limites de velocidad.

## Evidencia visual

Se generaron ocho variables por tres niveles (`province`, `canton`, `parish`) y
dos viewports. El reporte JSON confirma 48 archivos y cero discrepancias entre
el nivel solicitado y `window.__redsaAudit.state().level`.

La inspeccion visual confirma funcionamiento, pero tambien registra que el
sidebar ocupa casi todo el ancho de 390 px. Esto no invalida contratos ni
interacciones, pero si constituye una deuda de experiencia movil.
