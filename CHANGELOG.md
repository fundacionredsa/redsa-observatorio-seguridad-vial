# Changelog

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
El historial Git conserva el detalle completo; este archivo registra hitos,
incluidos errores relevantes corregidos durante el desarrollo.

## [Unreleased]

### Added

- Serie territorial de siniestros ampliada a 2025 completo y 2026 parcial
  enero-junio, con procedencia y fecha de corte por ano.
- Comparacion territorial enero-junio 2026 contra enero-junio 2025 y nivel
  parroquial disponible desde 2024, sin imputar anos anteriores.
- Umbral SDC de 5 para cruces de multiples atributos; los conteos territoriales
  oficiales principales permanecen completos.
- Documentacion auditable, diccionario de datos, ADR, pruebas automatizadas y
  licencias explicitas.
- Inventario de problemas abiertos y evidencia reproducible de validacion.
- Pruebas tactiles permanentes en telefono compacto, telefono estandar y tablet.
- Ranking nacional comparable de cantones, sincronizado con la variable y el
  ano activos, con busqueda y exclusion explicita de unidades sin dato.
- Secciones institucionales sobre confianza, apertura y citacion con fecha de
  consulta generada en el navegador.

### Fixed

- Cuarenta y siete de 119 siniestros historicos no agregados se recuperaron con
  DPA ANT (30 en 2021 y 17 en 2022). Los 72 de zonas en estudio permanecen
  visibles en el total nacional y sin asignacion especulativa.
- La reconciliacion nacional cierra exactamente con la fuente: ANT e
  INEC/ESTRA coinciden en 2024 anual (21.220 siniestros, 18.312 lesionados y
  2.302 fallecidos en sitio), en la suma de los cuatro trimestres de 2025
  (20.346, 17.932 y 2.354) y en 2026-I (4.789, 4.032 y 603).
- Experiencia movil recuperada con sidebar y panel tecnico operables, leyenda
  colapsable, mapa util y una unica estrategia CSS responsive.

### Changed

- El ano inicial del geoportal pasa de 2024 a 2025, ultimo ano completo de la
  serie territorial de siniestros; 2026 se mantiene identificado como corte
  parcial enero-junio.
- Corredores priorizados por REDSA y Mapillary dejan de mostrarse en el control
  publico de capas mientras no aporten informacion validada al geoportal.

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
