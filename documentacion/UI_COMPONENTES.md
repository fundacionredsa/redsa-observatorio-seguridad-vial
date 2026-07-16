# Inventario de componentes de interfaz

El geoportal actual concentra HTML, CSS y logica en `docs/index.html`. Los
archivos `docs/assets/css/mapa.css` y `docs/assets/js/mapa-cantones.js` no estan
referenciados por la pagina y son remanentes de la primera version; no deben
editarse esperando afectar produccion.

| Componente | Selector / ubicacion | Funcion | Datos |
|---|---|---|---|
| Mapa | `#map` | Leaflet, basemaps y capas | todos los GeoJSON |
| Sidebar | `.ui-panel.sidebar` | Territorio, tendencia y resumen | properties de unidad activa |
| Selector de variables | `.map-selector-control`, `#map-variable-select` | Coropleta y nota de disponibilidad | `VARIABLE_CONFIGS` |
| Selector de periodo | `#year-selector` | Cambia resumen INEC | `siniestros_historico` y desgloses |
| Control de capas | `.leaflet-control-layers` | Basemap y overlays independientes | capas OSM/REDSA/Mapillary |
| Leyenda | `.legend-panel` | Umbrales y simbologia dinamica | bins activos y overlays visibles |
| Perfil demografico | `.perfil-fallecidos-card` | Ultima unidad bajo hover; panel fijo | EDG y SPPAT agregados |
| Grafico de tendencia | `#historico-chart` | Siniestros y fallecidos por ano | Chart.js |
| Popovers de siglas | `.sigla-tooltip-trigger`, `.sigla-popover` | Glosario reutilizable | diccionario JS `siglaDefinitions` |
| Loader | `#loader` | Estado de descarga/render | metricas de carga |
| Diagnostico | `.diagnostic-panel` | Features, zoom, tiempo | oculto por defecto |
| Atribucion | `.leaflet-control-attribution` | Creditos legales | Leaflet/basemaps/capas |

## Estado y eventos

- `zoomend` selecciona `province`, `canton` o `parish`.
- `change` de variable recalcula quintiles sobre la capa activa.
- `mouseover` actualiza sidebar y perfil; el perfil permanece con la ultima
  unidad hasta un nuevo hover.
- Los checkboxes de movilidad son independientes del nivel territorial.

## Accesibilidad conocida

Los popovers funcionan por clic y el mapa conserva controles estandar Leaflet.
Faltan una auditoria WCAG formal, navegacion completa por teclado de poligonos,
mensajes `aria-live` y prueba de contraste automatizada.
