# Plan de Verificacion del Geoportal

## Alcance

Validar la primera vista web del geoportal REDSA Observa con la capa `docs/data/cantones_wgs84.geojson`.

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
- En la pestana Network, medir la descarga de `cantones_wgs84.geojson` de 4.67 MiB.
- Medir y reportar el tiempo real desde apertura de pagina hasta que el mapa termina de renderizar los 224 poligonos.
- La pagina expone la metrica en `window.__redsaGeojsonLoadMetrics.totalMs` y en el texto visible de estado.
- Si el tiempo total supera ~3-4 segundos en una conexion normal, reportarlo como hallazgo antes de dar por buena la tarea.

## Criterio de Cierre

La tarea se considera validada solo si la capa se ve, mantiene 224 poligonos, la atribucion obligatoria esta visible y el tiempo de carga/render queda medido y reportado.
