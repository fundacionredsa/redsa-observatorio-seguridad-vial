# ADR-007: Experiencia ciudadana y registros frontend

- Estado: Aceptada
- Fecha: 2026-07-16

## Contexto

El geoportal reunia variables, periodos, niveles territoriales, capas y paneles
tecnicos en la primera pantalla. La riqueza analitica era util para especialistas,
pero no respondia con rapidez la pregunta ciudadana principal: que ocurre en mi
canton y como ha cambiado. La configuracion tambien estaba duplicada dentro de
`docs/index.html`, por lo que agregar una variable o capa exigia editar varias
secciones del monolito.

El observatorio dejo de ser un piloto de Pichincha. La interfaz debia iniciar en
Ecuador continental, tratar las 24 provincias por igual y conservar toda la
profundidad tecnica sin imponerla al primer uso.

## Decision

Adoptar divulgacion progresiva con dos superficies:

1. `Explorar mi territorio`, visible al abrir: pregunta ciudadana, busqueda de
   canton, accidentes reportados, tasa, cambio temporal, comparacion orientativa,
   enlace compartible y descarga CSV del resumen.
2. `Datos y capas`, bajo demanda: las diez variables, linea de tiempo, mapas de
   fondo, capas independientes, advertencias de cobertura, metodologia y
   descargas. El analisis territorial detallado permanece en un segundo panel.

La vista inicial usa `Siniestros INEC` en 2024, encuadra Ecuador continental y
no activa infraestructura. Ninguna provincia recibe resaltado especial.

Separar la configuracion y la experiencia en archivos estaticos sin build:

- `docs/assets/js/geoportal-registry.js`: contratos de variables, capas,
  leyendas, popups y estado inicial.
- `docs/assets/js/geoportal-experience.js`: busqueda, resumen, comparacion,
  compartir y descarga.
- `docs/assets/css/geoportal-experience.css`: jerarquia visual y drawers.

`docs/index.html` conserva el motor cartografico existente y consume los
registros. Agregar una variable o capa nueva se hace en el registro; los
selectores, cargadores y leyendas se generan de forma generica.

## Honestidad y accesibilidad

- La comparacion ciudadana usa la mediana de tasas cantonales y se declara como
  orientativa; no se presenta como significancia estadistica.
- `sin_dato`, huecos temporales y cobertura desigual de OSM conservan sus textos
  y estilos.
- Los drawers tienen cierre, backdrop, tecla Escape, atributos ARIA y objetivos
  tactiles de al menos 44 px en movil.
- Los popovers tecnicos, variables, capas, anos y niveles existentes siguen
  alcanzables.

## Consecuencias

La primera pantalla es mas comprensible y el mapa puede quedar solo con limites
o con toda la infraestructura apagada. El frontend sigue siendo compatible con
GitHub Pages y no introduce servicios ni costos. `docs/index.html` aun contiene
logica cartografica historica; una modularizacion posterior puede extraer el
motor territorial, pero las extensiones de variables y capas ya no dependen de
editar ese monolito.

Actualizacion 2026-07-16: ADR-008 completo esa modularizacion y reemplazo el
modelo de hover por seleccion persistente mediante clic.
