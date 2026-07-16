# ADR-002: Niveles territoriales por zoom

- Estado: Aceptada
- Fecha: 2026-07-15

## Contexto

Mostrar 224 cantones a escala nacional o 1.040 parroquias a escala media reduce
legibilidad y rendimiento.

## Decision

Provincia en zoom <=7, canton en 8-10 y parroquia >=11. Solo una capa
territorial esta activa. Si la variable no existe al cambiar de nivel, mostrar
limites y una nota, nunca reutilizar valores de otro nivel.

## Consecuencias

La lectura se adapta a escala y disminuye carga visual. Los umbrales son de UX,
no estadisticos, y deben reevaluarse si cambia el basemap o el tamano de pantalla.
