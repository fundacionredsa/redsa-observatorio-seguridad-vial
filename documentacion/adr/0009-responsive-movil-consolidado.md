# ADR-009: Estrategia responsive movil consolidada

- Estado: Aceptada
- Fecha: 2026-07-16
- Extiende: ADR-008

## Contexto

El rediseno nacional dejo nueve bloques responsive historicos repartidos entre
`geoportal-core.css`, `geoportal-experience.css` y `mapa.css`. Varias reglas
respondian a una estructura DOM anterior: el control Leaflet de capas ya vivia
dentro del drawer tecnico, mientras su CSS aun lo trataba como un panel fijo
independiente. El panel ciudadano, la leyenda y el perfil ocupaban simultaneamente
gran parte del alto del telefono. La suite comprobaba que los controles estuvieran
dentro del viewport, pero no que quedara una superficie de mapa util ni que el
flujo completo funcionara mediante toques reales.

## Decision

1. `geoportal-mobile.css`, cargado despues de los estilos desktop, es la unica
   fuente de reglas para `max-width: 768px`. `geoportal-core.css` conserva solo
   el ajuste intermedio de `1024px`; los demas archivos no definen media queries
   moviles.
2. La convencion responsive es `<=768px` para telefono/tablet vertical y
   `<=370px` para telefonos compactos. No se duplican esos cortes en otros CSS.
3. Sidebar y panel tecnico son drawers superpuestos al mapa. En movil, el selector
   de variable, la linea de tiempo y el nivel territorial aparecen antes de la
   lista extensa de capas mediante orden visual CSS, sin alterar el DOM desktop.
4. El panel ciudadano se compacta, la leyenda inicia colapsada y el perfil se
   oculta mientras un drawer o la leyenda completa estan abiertos. Solo una
   superficie secundaria puede competir con el mapa en cada momento.
5. Todos los controles tactiles criticos tienen un area minima de 44 por 44 px.
   Un toque sobre una geometria fija la misma seleccion persistente que un clic
   desktop; ninguna informacion movil depende de `hover`.
6. Los assets locales llevan una version comun ligada a `package.json` para evitar
   mezclas de HTML, CSS y JavaScript en cache durante un despliegue estatico.
7. Playwright prueba siempre 390x844, 360x740 y 768x1024. La cobertura verifica
   superficie de mapa, drawers, overflow, objetivos tactiles, slider, seleccion
   por toque, leyenda y colisiones mediante `getBoundingClientRect()`.

## Consecuencias

El comportamiento desktop permanece definido por las hojas existentes y queda
fuera de las reglas moviles. Cambiar la experiencia responsive exige editar un
solo archivo y actualizar las pruebas permanentes. El orden visual movil usa
`order`, por lo que el orden semantico y desktop sigue siendo el del HTML. La
leyenda completa requiere una accion explicita en telefono, pero su resumen y
boton permanecen siempre visibles.
