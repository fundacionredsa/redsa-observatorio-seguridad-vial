# Plan de Verificacion del Geoportal

## Alcance

Validar el estado desplegable del geoportal REDSA Observa con sus capas territoriales y estadisticas publicadas.

## Controles Funcionales

- La pagina `docs/index.html` carga un mapa interactivo.
- El GeoJSON `docs/data/cantones_wgs84.geojson` se carga desde ruta relativa para GitHub Pages.
- La capa renderiza 224 poligonos cantonales.
- El selector de provincia filtra visualmente la capa y ajusta el encuadre del mapa.
- Los tooltips muestran canton y provincia.

## Atribucion

- El mapa debe mostrar atribucion del basemap utilizado.
- El mapa debe mostrar adicionalmente esta atribucion de la capa territorial:

```text
Limites cantonales: INEC/CONALI via datosabiertos.gob.ec, licencia CC-BY
```

## Rendimiento

- Abrir la pagina en navegador con DevTools.
- En la pestana Network, medir la descarga actual de `cantones_wgs84.geojson` (19,985,385 bytes; 19.06 MiB al 2026-07-16). La geometria simplificada original pesaba 4.67 MiB; el archivo publicado crecio al incorporar series y desgloses estadisticos.
- Medir y reportar el tiempo real desde apertura de pagina hasta que el mapa termina de renderizar los 224 poligonos.
- La pagina expone la metrica en `window.__redsaGeojsonLoadMetrics.totalMs` y en el texto visible de estado.
- Si el tiempo total supera ~3-4 segundos en una conexion normal, reportarlo como hallazgo antes de dar por buena la tarea.
- En tres corridas aisladas por viewport del 2026-07-16, la mediana de carga integral fue 2.782 ms en escritorio y 2.888 ms en movil. Una corrida movil alcanzo 4.386 ms. La mediana cumple el umbral, pero la variabilidad y los 48,86 MiB decodificados de 13 GeoJSON se registran como deuda de rendimiento.

## Criterio de Cierre

La tarea se considera validada solo si la capa se ve, mantiene 224 poligonos, la atribucion obligatoria esta visible y el tiempo de carga/render queda medido y reportado.
