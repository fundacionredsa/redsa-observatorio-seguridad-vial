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
| Leyenda | `.legend-panel` | Umbrales dinamicos; colapsable en movil | bins activos y overlays visibles |
| Perfil demografico | `.perfil-fallecidos-card` | Unidad seleccionada por clic; panel fijo y cerrable | EDG y SPPAT agregados |
| Grafico de tendencia | `#historico-chart` | Siniestros y fallecidos por ano | Chart.js |
| Popovers de siglas | `.sigla-tooltip-trigger`, `.sigla-popover` | Glosario reutilizable | diccionario JS `siglaDefinitions` |
| Loader | `#loader` | Estado de descarga/render | metricas de carga |
| Diagnostico | `.diagnostic-panel` | Features, zoom, tiempo | oculto por defecto |
| Atribucion | `.leaflet-control-attribution` | Creditos legales | Leaflet/basemaps/capas |
| Acceso institucional | `#open-institutional-button` | Abre ranking, confianza y citacion sin ocupar permanentemente el mapa | estado global del geoportal |
| Modal institucional | `#institutional-modal` | Vista accesible bajo demanda con pestanas y cierre por X, backdrop o Escape | registro de variables y textos institucionales |
| Ranking nacional | `#national-ranking-table` | Ordena cantones, excluye `sin_dato` y permite buscar la posicion nacional | propiedades cantonales y variable/ano activos |

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
- En movil, un toque sobre una geometria crea la seleccion persistente. La
  leyenda puede abrirse y cerrarse sin perderla; drawers y leyenda completa no
  compiten simultaneamente con el perfil.
- El ranking escucha los cambios de variable y ano del estado global. Las
  variables fijas conservan su periodo declarado y las no disponibles a nivel
  cantonal muestran una indisponibilidad explicita en lugar de una tabla falsa.
- La busqueda del ranking filtra filas visibles, resalta coincidencias y conserva
  la posicion calculada sobre el conjunto nacional completo con dato valido.

## Accesibilidad conocida

La busqueda, los drawers y las acciones principales son operables por teclado;
los cambios de resumen usan `aria-live` y los objetivos tactiles moviles miden al
menos 44 px. Los popovers funcionan por clic y el mapa conserva controles
estandar Leaflet. Falta una auditoria WCAG formal y navegacion completa por
teclado de los poligonos.

El modal institucional implementa pestanas con roles ARIA, trampa de foco,
navegacion de pestanas por flechas y cierre con `Escape`. En movil ocupa el
viewport completo y mantiene objetivos tactiles de al menos 44 px.

Las reglas moviles viven exclusivamente en `geoportal-mobile.css`; Playwright
comprueba su geometria en telefono compacto, telefono estandar y tablet vertical.
