# ADR-004: Getis-Ord Gi* para hotspots cantonales

- Estado: Aceptada
- Fecha: 2026-07-15

## Contexto

Se requiere identificar concentraciones territoriales, no solo ordenar tasas.

## Opciones

1. Quintiles descriptivos.
2. Getis-Ord Gi* local.
3. KDE puntual.

## Decision

Aplicar Gi* sobre tasas por 100.000 con contigüidad Queen, 999 permutaciones y
alfa 0,05. Conservar Local Moran como diagnostico. Cantones sin vecinos quedan
`isla_sin_vecinos`; KDE se pospone hasta disponer de coordenadas suficientes.

## Consecuencias

Hay una prueba espacial interpretable, pero no identifica vias y es sensible a
la matriz, cobertura, multiple testing y falacia ecologica.
