# Auditoría de factibilidad del modo acumulado de Siniestros (ANT)

Fecha de medición: 2026-07-28.

## Alcance

Se midió la carga conjunta de los derivados públicos ANT de 2024, 2025 y
enero-junio de 2026: 52.088 puntos. La prueba reprodujo el procesamiento
real del geoportal: descarga, decodificación JSON, combinación de
`features`, construcción del índice Supercluster y primer render de calor
o agrupaciones con Leaflet.

El escenario móvil usa el perfil acordado para las auditorías del
geoportal: viewport 390 x 844, CPU 4x, descarga de 1,6 Mbps y 150 ms de
latencia.

## Resultados

| Métrica | Escritorio | Móvil restringido |
|---|---:|---:|
| Transferencia combinada | 1.082.032 bytes | 1.082.032 bytes |
| Tamaño decodificado | 10.365.985 bytes | 10.365.985 bytes |
| Descarga | 573 ms | 8.115 ms |
| Parseo JSON | 275 ms | 1.127 ms |
| Índice Supercluster | 551 ms | 1.901 ms |
| Primer render de calor | 84 ms | 723 ms |
| Consulta + primer render de agrupaciones | 116 ms | 1.473 ms |
| Total hasta calor utilizable | 1.483 ms | 11.866 ms |
| Total hasta agrupaciones utilizables | 1.514 ms | 12.616 ms |

Los tiempos son una corrida controlada y deben interpretarse como orden
de magnitud, no como una garantía para todos los dispositivos.

## Decisión

No se habilita la combinación puntual acumulada en esta versión. En el
escenario móvil representativo tarda aproximadamente cuatro veces más que
la carga opt-in de un año que el proyecto ya aceptó como límite práctico.
También triplica el volumen decodificado y el trabajo de indexación en
memoria.

Cuando el periodo territorial está en **Acumulado histórico**, la capa
**Siniestros (ANT)** se desactiva, no puede activarse y explica:

> Esta capa se muestra solo por año; no está disponible en modo acumulado.

La coropleta territorial mantiene su acumulación histórica. Al volver a
**Año seleccionado**, el control puntual se habilita nuevamente sin
activar ni descargar datos por sorpresa.

## Revisión futura

La decisión puede revisarse si se adopta un formato de consulta espacial
por teselas, como PMTiles, que evite descargar e indexar todos los años en
el dispositivo. La evaluación debe repetir este mismo perfil y conservar
la carga diferida.
