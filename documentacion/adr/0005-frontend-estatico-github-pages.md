# ADR-005: Frontend estatico en GitHub Pages

- Estado: Aceptada
- Fecha: 2026-07-14

## Contexto

El piloto requiere costo operativo minimo, acceso abierto y despliegue simple.

## Decision

Servir HTML/CSS/JavaScript y GeoJSON desde `docs/` en GitHub Pages, con Leaflet
y Chart.js por CDN. No usar backend en esta etapa.

## Consecuencias

Despliegue barato y auditable. Los GeoJSON grandes impactan carga inicial, no
hay control de acceso y toda logica/dato servido es visible. Una futura base
PostGIS/API requerira nuevo ADR y estrategia de migracion.
