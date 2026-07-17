# Changelog

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
El historial Git conserva el detalle completo; este archivo registra hitos,
incluidos errores relevantes corregidos durante el desarrollo.

## [Unreleased]

### Added

- Documentacion auditable, diccionario de datos, ADR, pruebas automatizadas y
  licencias explicitas.
- Inventario de problemas abiertos y evidencia reproducible de validacion.
- Pruebas tactiles permanentes en telefono compacto, telefono estandar y tablet.

### Fixed

- Experiencia movil recuperada con sidebar y panel tecnico operables, leyenda
  colapsable, mapa util y una unica estrategia CSS responsive.

## [0.4.0] - 2026-07-16

### Added

- Exposicion vehicular ESTRA 2024 y tasas por 1.000 vehiculos/motocicletas.
- Quintiles recalculados por variable y nivel territorial.
- Tasa de siniestros en el panel territorial y glosario reutilizable.

### Fixed

- Coropletas provinciales que reutilizaban umbrales cantonales y ocultaban la
  variacion entre provincias.
- Panel demografico fuera del viewport y superpuesto con la leyenda.

## [0.3.0] - 2026-07-15

### Added

- Nivel provincial derivado por disolucion de cantones y cambio automatico por
  zoom: provincia `<=7`, canton `8-10`, parroquia `>=11`.
- Hotspots cantonales Getis-Ord Gi* y Local Moran.
- Perfil demografico EDG y capa parroquial de fallecidos 2021-2024.

### Fixed

- Islas sin vecinos dejaron de recibir resultados espaciales significativos y
  pasan a `isla_sin_vecinos`.
- Regex CIE-10 cerrada a `V01-V89`; `V00` y `V90-V99` quedan excluidos.
- 179 registros EDG inicialmente no resueltos territorialmente fueron
  recuperados mediante normalizacion documentada.
- Clasificacion de usuario vial corregida a rangos oficiales: V01-V09 peaton,
  V10-V19 ciclista, V20-V29 motociclista, V30-V79 ocupante y V80-V89 otros.
- Bounding box/consulta de Santo Domingo y geometria de Ruta Viva corregidos.

## [0.2.0] - 2026-07-14

### Added

- Estadisticas INEC, SPPAT, EDG, poblacion 2010-2035 y capas OSM de Pichincha.
- Serie historica, grafico Chart.js, leyenda y controles de capas.

### Changed

- El GeoJSON cantonal se reubico a `docs/data` para GitHub Pages.
- Gazetteer del Agente 1 se redujo de shapefile a JSON sin geometria.

## [0.1.0] - 2026-07-14

### Added

- Primera capa cantonal WGS84 simplificada y primera version del geoportal.
