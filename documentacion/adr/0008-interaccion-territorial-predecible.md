# ADR-008: Interaccion territorial predecible y frontend modular

- Estado: Aceptada
- Fecha: 2026-07-16
- Reemplaza parcialmente: ADR-002 y la deuda tecnica declarada en ADR-007

## Contexto

La seleccion dependia de `mouseover`, los clics ejecutaban `fitBounds` sin tope
y el evento `zoomend` podia cambiar de canton a parroquia como efecto lateral.
El panel demografico podia invadir el sidebar o quedar fuera del viewport porque
una regla nueva fijaba `left: 20px`. La pagina seguia concentrando CSS y JavaScript
en `index.html`, con valores de `z-index` y reglas `!important` contradictorias.

## Decision

1. Hover solo resalta la geometria y muestra un tooltip breve. No modifica datos.
2. Clic crea una seleccion persistente, actualiza sidebar y perfil, y mantiene un
   borde visible. La seleccion se reemplaza con otro clic o se cierra con la X.
3. `fitBounds` limita el zoom segun el nivel activo: provincia hasta 7, canton
   hasta 10 y parroquia dentro del rango parroquial. Un clic nunca cruza de nivel.
4. El control `Auto | Provincias | Cantones | Parroquias` expone el nivel actual.
   En Auto se usa histeresis de un nivel de zoom para evitar parpadeos; un nivel
   manual permanece fijado aunque cambie el zoom.
5. El panel inferior calcula sus bordes contra sidebar, panel ciudadano, drawer
   tecnico, selector, leyenda y atribucion mediante `getBoundingClientRect`.
6. En movil, una seleccion convierte el perfil en la superficie principal y
   oculta temporalmente el panel ciudadano. La X restaura el estado inicial.
7. Toda la escala de apilamiento vive en variables `--z-*`; no se usan reglas
   `!important` en los estilos de produccion.

## Modulos estaticos

El sitio conserva GitHub Pages sin build ni backend. `docs/index.html` es el
esqueleto HTML y carga, en orden:

- `geoportal-registry.js`: variables, capas e inicio nacional.
- `geoportal-experience.js`: busqueda y resumen ciudadano.
- `geoportal-state.js`: mapa, estado global, simbologia y seleccion.
- `geoportal-territories.js`: capas provincia/canton/parroquia y modo de nivel.
- `geoportal-panels.js`: sidebar, perfil, graficos y layout dinamico.
- `geoportal-app.js`: inicializacion, infraestructura, controles y API de prueba.

Los estilos viven en `geoportal-core.css` y `geoportal-experience.css`. No queda
un bloque `<style>` ni un script principal inline en `index.html`.

La estrategia responsive movil se consolido posteriormente en ADR-009 y agrega
`geoportal-mobile.css` como unica fuente de reglas para `max-width: 768px`.

## Verificacion y consecuencias

Playwright cubre que un clic cantonal no salte a parroquias, que hover no cambie
el panel, que la seleccion sobreviva al scroll, que la X la cierre y que el nivel
manual ignore el zoom hasta volver a Auto. Los contratos GeoJSON no cambian.

La interaccion gana previsibilidad y una salida explicita en cada estado. La
separacion sigue usando scripts clasicos ordenados para conservar compatibilidad;
una migracion futura a ES modules requeriria declarar interfaces entre archivos.
