# 11. Geometrias CONALI vigentes y transicion Sevilla Don Bosco

Date: 2026-07-25

## Status

Accepted

## Context

La capa provincial publicada se derivaba de cantones y la parroquial provenia
de INEC 2014. CONALI publica geometrías oficiales más recientes, incluyendo
zonas en estudio, una isla y cambios administrativos que no existen en los
microdatos históricos.

## Decision

- Provincias: usar el recurso oficial CONALI publicado el 2025-02-20.
- Parroquias: usar el recurso oficial CONALI vigente al 2026-02-03.
- Conservar `txt` y declarar `zona_en_estudio`/`isla` como
  `no_aplica_zona_especial`, sin asignarlas a un lado ni tratarlas como cero.
- Versionar únicamente el cruce histórico confirmado `140157 -> 141350`
  (Sevilla Don Bosco), con conteos EDG 2021-2024 de 5, 6, 3 y 7.
- No inferir reasignaciones para otras unidades sin datos históricos
  parroquiales verificables. INEC siniestros y SPPAT solo permiten agregación
  cantonal en las fuentes usadas.
- Procesar geometría con mapshaper: reproyección, `snap` submétrico,
  `clean only-arcs` y `simplify interval=40m keep-shapes`.

## Verification

La salida conserva 1.050 parroquias/áreas y 26 provincias/áreas, no contiene
geometrías inválidas, huecos internos ni solapamientos. La variación de
superficie total es menor a 0,001%, frente al umbral de riesgo de 0,5%.
Los totales EDG nacionales 2021-2024 siguen en 3.339, 3.676, 4.068 y 4.214.
