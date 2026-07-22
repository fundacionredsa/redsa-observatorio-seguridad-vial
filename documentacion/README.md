# Documentacion del Observatorio de Seguridad Vial y Movilidad Sostenible

Este es el punto de entrada para auditar, mantener o ampliar el geoportal.
Estado documentado: **2026-07-17**.

## Ruta recomendada por rol

- Auditor de datos: [estado actual](ESTADO_ACTUAL_2026-07-16.md),
  [diccionario](DICCIONARIO_DATOS.md), [metodologia](METODOLOGIA.md),
  [procedencia](FUENTES_Y_PROCEDENCIA.md) y [evidencia](VALIDACION.md).
- Desarrollo: [arquitectura](ARQUITECTURA.md),
  [despliegue](DESPLIEGUE_Y_OPERACION.md), ADR y pruebas en `tests/`.
- Diseno: [componentes](UI_COMPONENTES.md),
  [sistema visual](SISTEMA_DISENO.md),
  [rediseño nacional](EVIDENCIA_REDISENO_NACIONAL.md) e
  [interaccion territorial](EVIDENCIA_INTERACCION_PROFESIONAL.md) y
  [recuperacion movil](EVIDENCIA_RECUPERACION_MOVIL.md) y
  [ranking institucional](EVIDENCIA_RANKING_INSTITUCIONAL.md).
- Gestion: [problemas conocidos](PROBLEMAS_CONOCIDOS.md),
  [changelog](../CHANGELOG.md) y licencias de [codigo](../LICENSE) y
  [datos](../LICENSE-DATA.md).

## Regla de autoridad

Los GeoJSON publicados son la evidencia del estado desplegado; los scripts del
repositorio privado `redsa-observatorio-pipelines` explican su generacion. Las
notas antiguas junto a datasets se conservan por trazabilidad, pero este
directorio es la documentacion metodologica canonica.

Nunca copie al repositorio microdatos EDG, SPPAT o ESTRA ni credenciales. El
paquete de Drive contiene un inventario y checksums, no duplicados de fuentes
sensibles.
