# Problemas conocidos y trabajo abierto

## Prioridad alta

1. **RESUELTO CON LIMITACION: 119 siniestros 2021-2024 antes no agregados.**
   El DPA ANT resolvio de forma trazable 47 (30 en 2021 y 17 en 2022). Los 72
   restantes son zonas en estudio (15/17/11/29 por ano) y se publican en el
   total nacional, visibles y sin asignacion especulativa a un poligono.
2. **RESUELTO: geometria provincial y parroquial oficial vigente.** Las capas
   publicadas usan CONALI provincial 2025-02-20 y parroquial 2026-02-03, con
   URL/licencia preservadas. Las zonas en estudio y la isla se mantienen como
   categorias especiales neutrales; Sevilla Don Bosco usa un cruce historico
   versionado que no altera los totales nacionales.
3. **Rutas absolutas en ETL heredado.** Se documentan variables de entorno y se
   corrigen entradas principales, pero los scripts requieren una refactorizacion
   a CLI con funciones puras antes de considerarse pipeline de produccion.

## Prioridad media

4. **Mapillary vacio.** Cero features; requiere token y corrida validada. Fue
   retirado del control publico de capas y no se muestra como cobertura disponible.
5. **Serie INEC incompleta.** Falta 2020 y no se incorporaron 2017/2018. ANDA
   exige aceptar terminos; la gestion esta pendiente.
6. **Perfil EDG sin desagregacion anual.** `fallecidos_detallado` acumula
   2020-2024; impide construir tasas anuales por usuario.
7. **DMQ 98,87% en `otro`.** El conteo es consistente con el agregado, pero la
   razon de calidad/codificacion no esta explicada.
8. **Campos `—` a nivel provincial/parroquial.** Algunos componentes del sidebar
   esperan campos cantonales o perfiles no disponibles y muestran vacios.
9. **Hotspots puntuales no ejecutados.** Falta una fuente maestra de siniestros
   con coordenadas validadas; no existe GeoJSON vacio disfrazado de resultado.

## Prioridad tecnica

10. `docs/index.html` concentra mas de 3.000 lineas de CSS/JS/HTML. Debe
    modularizarse conservando pruebas visuales.
11. `docs/assets/css/mapa.css` y `docs/assets/js/mapa-cantones.js` son archivos
    no referenciados; decidir su eliminacion en una tarea separada.
12. No hay auditoria WCAG 2.2 ni prueba de navegacion por teclado.
13. Dependencia de CDN para Leaflet, Chart.js y Google Fonts; definir politica
    de disponibilidad/SRI o vendorizacion.
14. GitHub Actions del Agente 1 puede competir con pushes humanos; conviene usar
    `concurrency` y PR automatizado en vez de push directo.
15. La carga inicial solicita 13 GeoJSON y decodifica 48,86 MiB. La mediana local
    queda bajo 3 s, pero una corrida movil supero 4 s; cargar capas tematicas bajo
    demanda y separar geometria de series estadisticas tendria el mayor impacto.
16. En 390 px de ancho el sidebar ocupa casi todo el viewport inicial. Hace falta
    un modo movil colapsable que preserve acceso al mapa, selector y leyenda.
17. **Cumplimiento REUSE parcial.** El pipeline ANT nuevo tiene SPDX,
    `REUSE.toml` y textos de licencia, pero el repositorio historico completo
    contiene archivos anteriores cuya titularidad/licencia debe revisarse uno
    por uno antes de declarar conformidad REUSE total.
18. **PMTiles evaluado y diferido para la capa ANT.** En el escenario movil
    sintetico acordado, la activacion opcional de 2025 tarda 2,889 s y la
    transferencia gzip explica 2,006 s. GitHub Pages no sirve Brotli para estos
    GeoJSON. Se mantiene un archivo diferido por ano y se reconsiderara PMTiles
    si se cargan varios anos simultaneamente o las metricas reales justifican
    la complejidad adicional. La prioridad inmediata es la carga inicial, que
    afecta a todas las visitas.
