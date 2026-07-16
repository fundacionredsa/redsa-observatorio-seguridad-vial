# Evidencia del rediseno nacional

- Fecha: 2026-07-16
- Decision: [ADR-007](adr/0007-experiencia-ciudadana-y-registros-frontend.md)
- Viewports: escritorio `1366x768`; movil `390x844`

## Comparacion visual

| Viewport | Antes | Despues |
|---|---|---|
| Escritorio | [captura](evidencia_visual/redesign_nacional/antes_desktop_1366x768.png) | [captura](evidencia_visual/redesign_nacional/despues_desktop_1366x768.png) |
| Movil | [captura](evidencia_visual/redesign_nacional/antes_mobile_390x844.png) | [captura](evidencia_visual/redesign_nacional/despues_mobile_390x844.png) |

La vista anterior iniciaba centrada en Pichincha y exponia controles tecnicos.
La vista nueva encuadra Ecuador continental, activa accidentes reportados 2024,
no enciende infraestructura y ofrece busqueda de canton antes que configuracion.

## Controles verificados

- 24 provincias y 224 cantones cargados; parroquias bajo demanda: 1.040.
- Diez variables y diez capas de infraestructura conservadas.
- Ninguna capa de infraestructura visible al abrir.
- Todas las capas se pueden apagar juntas; `Dejar solo limites` tambien retira
  la coropleta.
- Busqueda de Quito resuelta en un envio y resumen con dato, tasa, comparacion y
  cambio frente al periodo anterior.
- Drawers operables por cierre, backdrop y tecla Escape; objetivos tactiles de
  al menos 44 px en movil.
- `npm run data:check`: `status: ok`.
- `npm run data:test`: 10 pruebas aprobadas.
- `npm test`: 22 pruebas aprobadas y 2 omisiones esperadas por breakpoint.

