# Estado actual al 2026-07-16

## Despliegue

- Sitio: `https://fundacionredsa.github.io/redsa-observatorio-seguridad-vial/`
- Rama publicada: `main`, carpeta `docs/` mediante GitHub Pages.
- Frontend: HTML/CSS/JavaScript sin compilacion; Leaflet 1.9.4 y Chart.js 4.4.1
  cargados por CDN.
- Commit de referencia previo a esta auditoria: `efa5229`.

## Capas publicadas

| Capa | Features | Estado |
|---|---:|---|
| Provincias | 24 | Activa en zoom <= 7; derivada de cantones |
| Cantones | 224 | Activa en zoom 8-10 |
| Parroquias | 1.040 | Activa en zoom >= 11; geometria historica INEC 2014 |
| Hotspots cantonales | 224 | Cargada como atributos para interpretacion |
| Ciclovias Pichincha | 949 | Activa por defecto |
| Aceras | 7.687 | Disponible |
| Cruces peatonales | 10.205 | Disponible |
| Pacificacion de transito | 227 | Disponible |
| Semaforos/rotondas | 3.193 | Disponible |
| Iluminacion | 1.892 | Disponible |
| Limites de velocidad | 6.015 | Disponible |
| BRT/Metrobus-Q | 11 | Disponible |
| Corredores REDSA | 1.000 | Conservado como insumo; no expuesto en el geoportal |
| Mapillary | 0 | No disponible y no expuesto en el geoportal |

## Variables del mapa

1. Limites.
2. Siniestros INEC 2019.
3. Fallecidos INEC 2019.
4. Tasa de fallecidos por 100.000 habitantes (2019).
5. Tasa de siniestros por 1.000 vehiculos matriculados (2024).
6. Motociclistas fallecidos 2020-2024 por 1.000 motos matriculadas en 2024.
7. Fallecidos SPPAT 2016-2021.
8. Fallecidos parroquiales EDG 2021-2024.

Los quintiles se recalculan para la combinacion de variable y nivel territorial
activo. Cuando una variable no existe en el nivel visible, el mapa cae a
limites y muestra una nota de indisponibilidad.

## Series efectivamente publicadas

- Siniestros INEC: 2019 y 2021-2024. No hay 2020 publicado. Los microdatos
  2017, 2018 y 2020 de ANDA requieren aceptar terminos antes de descarga.
- Fallecidos EDG: 2020-2024, filtro CIE-10 V01-V89.
- Fallecidos SPPAT: 2016-2021.
- Poblacion cantonal: 2010-2035; 221 de 224 unidades con dato.
- Vehiculos matriculados: 2024, 3.138.562 registros agregados.

## Estado de privacidad

Solo se publican agregados territoriales. Los archivos crudos permanecen en
Drive con acceso del proyecto. EDG y SPPAT contienen fechas y combinaciones
demograficas/territoriales con riesgo de reidentificacion; se clasifican como
**uso interno restringido**, aunque no incluyan nombres.

## Calidad y rendimiento verificados

- Pruebas automatizadas: 5 contratos de datos, 2 pruebas CIE-10 y 8 pruebas UI aprobadas.
- Evidencia visual: 48 capturas reproducibles para 8 variables, 3 niveles y 2 viewports.
- Mediana de carga integral local: 2,78 s escritorio y 2,89 s movil; una corrida movil llego a 4,39 s.
- Peso inicial observado: 48,86 MiB en 13 GeoJSON. Es la principal deuda tecnica de rendimiento.
- Limitacion visible en movil: el sidebar ocupa casi todo el ancho inicial y reduce la inspeccion simultanea del mapa.
