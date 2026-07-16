# ADR-003: EDG y SPPAT para usuario vial

- Estado: Aceptada
- Fecha: 2026-07-15

## Contexto

EDG permite una serie nacional, pero 76,1% de casos 2021-2024 estan en V89.
SPPAT tiene `Condicion` mas especifica, con cobertura administrativa distinta.

## Decision

Usar EDG V01-V89 para totales comparables y perfil demografico; inferir usuario
por rangos CIE-10 oficiales. Preferir SPPAT para describir condicion de usuario,
siempre etiquetando fuente y periodo. No mezclar ambos como si fueran el mismo
universo.

## Consecuencias

Se preserva cobertura EDG y mejor detalle SPPAT, pero ninguna distribucion debe
presentarse sin su advertencia. La tasa de motociclistas actual es exploratoria.
