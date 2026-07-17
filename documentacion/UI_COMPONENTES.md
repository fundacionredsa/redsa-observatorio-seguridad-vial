# Inventario de componentes de interfaz

El motor Leaflet vive en modulos estaticos con responsabilidades separadas y
`docs/index.html` conserva solo el esqueleto. Los archivos
`docs/assets/css/mapa.css` y `docs/assets/js/mapa-cantones.js` son remanentes no
referenciados; no deben editarse esperando afectar produccion.

| Componente | Selector / ubicacion | Funcion | Datos |
|---|---|---|---|
| Mapa | `#map` | Leaflet, basemaps y capas | todos los GeoJSON |
| Vista ciudadana | `#citizen-panel` | Buscar canton, tendencia, comparar, compartir y descargar | agregados cantonales |
| Analisis detallado | `.ui-panel.sidebar` | Territorio, tendencia y resumen completo | properties de unidad activa |
| Panel tecnico | `#technical-drawer` | Variables, anos, capas, metodologia y descargas | registros frontend |
| Selector de variables | `.map-selector-control`, `#map-variable-select` | Coropleta y nota de disponibilidad | `REDSA_GEO_CONFIG.variables` |
| Linea de tiempo | `#map-year-slider` | Estado anual unico del geoportal | coberturas declaradas |
| Nivel territorial | `#territory-level-control` | Auto o nivel manual persistente | estado territorial global |
| Control de capas | `.leaflet-control-layers` | Basemap y overlays independientes; permite apagar todo | `REDSA_GEO_CONFIG.infrastructureLayers` |
| Leyenda | `.legend-panel` | Umbrales y simbologia dinamica | bins activos y overlays visibles |
| Perfil demografico | `.perfil-fallecidos-card` | Unidad seleccionada por clic; panel fijo y cerrable | EDG y SPPAT agregados |
| Grafico de tendencia | `#historico-chart` | Siniestros y fallecidos por ano | Chart.js |
| Popovers de siglas | `.sigla-tooltip-trigger`, `.sigla-popover` | Glosario reutilizable | diccionario JS `siglaDefinitions` |
| Loader | `#loader` | Estado de descarga/render | metricas de carga |
| Diagnostico | `.diagnostic-panel` | Features, zoom, tiempo | oculto por defecto |
| Atribucion | `.leaflet-control-attribution` | Creditos legales | Leaflet/basemaps/capas |

## Estado y eventos

- `zoomend` selecciona `province`, `canton` o `parish` solo en modo Auto y con
  histeresis. El selector segmentado puede fijar un nivel.
- `change` de variable recalcula quintiles sobre la capa activa.
- La busqueda de canton selecciona la geometria y actualiza el resumen en una
  sola accion de envio.
- `mouseover` solo resalta y muestra nombre/valor. `click` fija sidebar, perfil y
  borde territorial hasta otro clic o el cierre explicito.
- Los checkboxes de movilidad son independientes del nivel territorial.
- `Escape`, backdrop o cierre explicito cierran los drawers sin cambiar el mapa;
  la X del perfil limpia la seleccion sin alterar variable, ano o capas.

## Accesibilidad conocida

La busqueda, los drawers y las acciones principales son operables por teclado;
los cambios de resumen usan `aria-live` y los objetivos tactiles moviles miden al
menos 44 px. Los popovers funcionan por clic y el mapa conserva controles
estandar Leaflet. Falta una auditoria WCAG formal y navegacion completa por
teclado de los poligonos.
