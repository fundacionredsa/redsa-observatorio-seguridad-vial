# ADR-001: Provincias derivadas de cantones

- Estado: Aceptada
- Fecha: 2026-07-15

## Contexto

El geoportal necesitaba una vista nacional provincial sin incorporar otra
geometria potencialmente desalineada con la capa cantonal publicada.

## Opciones

1. Descargar un shapefile provincial independiente.
2. Disolver cantones por DPA_PROVIN.
3. Mostrar cantones tambien a escala nacional.

## Decision

Disolver la capa cantonal y sumar agregados. Recalcular tasas con numeradores y
denominadores provinciales. Excluir unidades auxiliares `90`/`ISLA`.

## Consecuencias

Los bordes son coherentes con cantones y no aparece una nueva fuente. La
provincia hereda errores/simplificacion cantonal y debe declarar cobertura
parcial cuando falta algun canton.
