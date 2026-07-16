# Problemas conocidos y trabajo abierto

## Prioridad alta

1. **119 siniestros 2021-2024 no agregados territorialmente.** Cuarenta y siete
   usan nombres cantonales parenteticos recuperables; 72 usan localidades sin
   canton inequivoco. Corregir los 47 y publicar un contador nacional explicito
   para los restantes, sin asignacion especulativa.
2. **Geometria parroquial desactualizada y mal atribuida historicamente.** El
   archivo real es INEC 2014; una cadena del frontend afirmaba CONALI 2022. La
   afirmacion se corrige en esta auditoria, pero debe sustituirse la geometria
   por una fuente parroquial oficial vigente y con URL/licencia preservadas.
3. **Rutas absolutas en ETL heredado.** Se documentan variables de entorno y se
   corrigen entradas principales, pero los scripts requieren una refactorizacion
   a CLI con funciones puras antes de considerarse pipeline de produccion.

## Prioridad media

4. **Mapillary vacio.** Cero features; requiere token y corrida validada. No debe
   mostrarse como cobertura disponible.
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
