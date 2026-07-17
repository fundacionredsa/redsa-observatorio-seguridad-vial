# Evidencia del ranking nacional y transparencia institucional

Fecha de validacion: 2026-07-17.

## Alcance

La entrada `Ver ranking nacional` abre una vista bajo demanda, fuera del
sidebar y del mapa principal. Sus tres pestanas contienen:

- ranking comparable de cantones;
- explicacion institucional de independencia, alcance y honestidad del dato;
- cita sugerida con fecha de consulta calculada en JavaScript.

El ranking consume `REDSA_GEO_CONFIG.variables`, el ano global del slider y la
funcion canonica `getVariableValue`. No duplica formulas ni textos. Para cada
variable conserva solo valores numericos validos; `null`, `undefined`,
`sin_dato` y valores no finitos se excluyen y se informan en el resumen de
cobertura. Un cero numerico real permanece en el ranking.

## Caso comprobado

Con `Siniestros INEC` y 2024 activos:

- universo territorial: 224 cantones;
- cantones comparables: 212;
- cantones sin dato excluidos: 12;
- Distrito Metropolitano de Quito: posicion nacional 2 de 212;
- orden inicial: valor descendente.

La busqueda filtra y resalta el canton, pero la posicion mostrada sigue siendo
la posicion nacional calculada antes del filtro. Las variables sin equivalente
cantonal muestran un estado de no disponibilidad y no inventan una conversion.

## Evidencia visual

- `evidencia_visual/ranking_institucional/ranking_desktop_1366x768.png`
- `evidencia_visual/ranking_institucional/confianza_desktop_1366x768.png`
- `evidencia_visual/ranking_institucional/ranking_mobile_390x844.png`
- `evidencia_visual/ranking_institucional/citacion_mobile_390x844.png`
- `evidencia_visual/ranking_institucional/mediciones.json`

En escritorio, el dialogo medido fue `1040 x 720 px` dentro de un viewport de
`1366 x 768 px`. En movil fue `390 x 844 px`, exactamente el viewport, sin
desbordamiento horizontal o vertical.

## Cobertura automatizada

Playwright comprueba de forma permanente:

- orden descendente y orden alfabetico solicitado por el usuario;
- exclusion de `sin_dato` sin eliminar ceros validos;
- suma `con dato + excluidos = 224`;
- busqueda, resaltado y posicion nacional exacta;
- sincronizacion con dos variables/anos distintos;
- reutilizacion de la descripcion canonica de la variable;
- navegacion, cierre y geometria del modal en movil;
- textos de confianza, enlace al repositorio y fecha dinamica de citacion.

La validacion final produjo 32 pruebas aprobadas, 6 omisiones intencionales por
perfil de viewport y 0 fallos. `data:check` termino con estado `ok` y
`data:test` aprobo sus 10 contratos.
