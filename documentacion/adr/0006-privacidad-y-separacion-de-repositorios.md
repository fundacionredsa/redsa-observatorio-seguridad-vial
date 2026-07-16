# ADR-006: Privacidad y separacion de repositorios

- Estado: Aceptada
- Fecha: 2026-07-16

## Contexto

EDG/SPPAT combinan fechas, demografia y territorio. Aunque no incluyan nombres,
las combinaciones pueden facilitar reidentificacion. Los pipelines contienen
rutas operativas y nombres de secrets.

## Decision

Mantener el geoportal/Agregados separado de fuentes crudas. Los microdatos viven
en Drive con acceso del proyecto; el repositorio publicado contiene solo
agregados. El repositorio de pipelines es privado. El paquete de auditoria
incluye inventarios y hashes, no microdatos ni credenciales.

## Consecuencias

Reduce exposicion y permite auditar integridad. Un tercero necesita acceso
autorizado al Drive para reproducir desde cero; acceso al repo publico basta para
auditar los resultados ya publicados.
