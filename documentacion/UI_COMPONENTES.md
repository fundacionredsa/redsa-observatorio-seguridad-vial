# Inventario de componentes de interfaz

El motor Leaflet historico permanece en `docs/index.html`, pero la configuracion
extensible y la experiencia publica viven en modulos estaticos. Los archivos
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
| Control de capas | `.leaflet-control-layers` | Basemap y overlays independientes; permite apagar todo | `REDSA_GEO_CONFIG.infrastructureLayers` |
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
- La busqueda de canton selecciona la geometria y actualiza el resumen en una
  sola accion de envio.
- `mouseover` actualiza sidebar y perfil; el perfil permanece con la ultima
  unidad hasta un nuevo hover.
- Los checkboxes de movilidad son independientes del nivel territorial.
- `Escape`, backdrop o cierre explicito cierran los drawers sin cambiar el mapa.

## Accesibilidad conocida

La busqueda, los drawers y las acciones principales son operables por teclado;
los cambios de resumen usan `aria-live` y los objetivos tactiles moviles miden al
menos 44 px. Los popovers funcionan por clic y el mapa conserva controles
estandar Leaflet. Falta una auditoria WCAG formal y navegacion completa por
teclado de los poligonos.
