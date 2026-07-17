# Evidencia de recuperacion movil

Fecha: 2026-07-16. Commit base diagnosticado: `caab6a7`.

## Diagnostico inicial

Las funciones moviles seguian presentes: botones, backdrop y handlers abrian los
paneles. La rotura era de layout. Las reglas responsive estaban repartidas en
nueve bloques y algunas aun posicionaban el control Leaflet como si no perteneciera
al drawer tecnico. Al abrir el sitio, panel ciudadano, perfil, leyenda y atribucion
dejaban una franja insuficiente para usar el mapa.

| Viewport | Estado inicial | Antes | Despues |
|---|---|---:|---:|
| 390x844 | alto panel ciudadano | 360 px | 271 px |
| 390x844 | alto leyenda cerrada | 180 px | 46 px |
| 390x844 | alto atribucion | 50 px | 22 px |
| 390x844 | franja vertical libre de mapa | 177 px | 429 px |
| 360x740 | alto panel ciudadano | 360 px | 254 px |
| 360x740 | alto leyenda cerrada | 180 px | 46 px |
| 360x740 | alto atribucion | 50 px | 32 px |
| 360x740 | franja vertical libre de mapa | 73 px | 332 px |
| 768x1024 | alto panel ciudadano | 311 px | 226 px |
| 768x1024 | alto leyenda cerrada | 180 px | 46 px |
| 768x1024 | franja vertical libre de mapa | 423 px | 665 px |

El sidebar inicial tenia dos pixeles de overflow horizontal. El drawer tecnico
ubicaba el selector debajo de la lista de capas: en 390x844 comenzaba en `y=734`
y terminaba fuera del viewport. Tras la consolidacion, el sidebar tiene
`clientWidth == scrollWidth`, y el selector queda en `y=115..508`; slider en
`y=286..330` y control territorial en `y=356..495`.

## Flujo tactil validado

En 390x844 se verifico el flujo completo con eventos tactiles reales:

1. Mapa nacional visible y ambos drawers cerrados al iniciar.
2. Boton de informacion abre el sidebar completo, sin overflow horizontal.
3. Backdrop cierra el sidebar.
4. Boton de datos abre el drawer tecnico; variable, ano y nivel quedan visibles.
5. Toque al 60% del slider selecciona 2022.
6. Toque sobre el canton `1701` fija la seleccion y muestra el perfil 2022.
7. Perfil `x=12..378`, `y=471..751`; leyenda cerrada `y=766..812`: no intersectan.
8. La leyenda abre dentro del viewport y oculta temporalmente el perfil; al cerrar,
   la seleccion y el perfil reaparecen.

Los controles tactiles medidos cumplen un minimo de 44 px. La prueba usa
`page.touchscreen.tap()` para el slider y el poligono; no sustituye el toque por
una llamada directa al estado de seleccion.

## Regresion desktop

La captura inicial de 1366x768 antes y despues es identica: 0 de 1.049.088
pixeles cambiados (`0,0000%`). Con una seleccion, la geometria funcional tambien
permanece: perfil `x=426..1050`, `y=460..740`, y leyenda `x=1066..1356`.

## Archivos reproducibles

- Capturas: `documentacion/evidencia_visual/recuperacion_movil/`.
- Mediciones: `documentacion/evidencia_visual/recuperacion_movil/mediciones.json`.
- Generador: `npm run screenshots:mobile`.
- Pruebas permanentes: `tests/geoportal.spec.js`.
