# Fuentes y procedencia

Las fechas locales corresponden a la copia disponible en Drive, no
necesariamente a la fecha de publicacion institucional.

| Fuente | Periodo | Origen / descarga | Copia local | Transformacion | Licencia/uso |
|---|---|---|---|---|---|
| Organizacion territorial cantonal | recurso 2025-02-20 | [datosabiertos.gob.ec](https://datosabiertos.gob.ec/dataset/f3ed6f26-a85c-449a-9246-2bdc9a612b4b/resource/11b85d91-9139-4709-97dd-4bc0b92d4f02/download/organizacion-territorial-cantonal.zip) | descargada 2026-07-14 | EPSG:32717 a 4326; simplificacion topologica 40 m | CKAN: CC BY sin version explicita |
| Organizacion territorial provincial | recurso 2025-02-20 | [CONALI / Ministerio de Gobierno](https://www.datosabiertos.gob.ec/dataset/2df6df9f-d5ff-4a4f-be78-5b1f9e89f8a0/resource/8c750d82-d0f4-40ff-864f-bc02fb8cc1eb/download/organizacion-territorial-provincial.zip) | descargada 2026-07-24 | EPSG:32717 a 4326; `snap` submetrico, `clean only-arcs`, simplificacion topologica 40 m | CKAN: CC BY |
| Organizacion territorial parroquial | vigencia 2026-02-03 | [CONALI / Ministerio de Gobierno](https://www.datosabiertos.gob.ec/dataset/2fd34713-51be-489c-a444-f0ec2b36dd6f/resource/1ae92432-cfce-4613-a7cf-252750a15c0e/download/organizacion-territorial-parroquial-03.02.2026.7z) | descargada 2026-07-24 | EPSG:32717 a 4326; `snap` submetrico, `clean only-arcs`, simplificacion topologica 40 m; cruce historico 140157 a 141350 | CKAN: CC BY |
| INEC siniestros | 2019 | [datosabiertos.gob.ec](https://www.datosabiertos.gob.ec/dataset/4f7a7f85-7a78-4c15-9402-429745f810fc/resource/bbfef24d-e0b7-48b0-9998-5412a35d50c3/download/inec_anuario-de-estadisticas-de-transporte_siniestros-de-transito_2019.csv) | 2026-07-14 | homologacion territorial y agregacion | datos abiertos INEC |
| ANT / INEC-ESTRA siniestros | 2021-2024 | registro administrativo ANT procesado por INEC/ESTRA | auditado 2026-07-27 | DPA normalizado; 47 registros recuperados (30 en 2021 y 17 en 2022) y 72 zonas en estudio conservadas solo en total nacional | condiciones originales ANT/INEC; agregado REDSA CC BY 4.0 |
| ANT / INEC-ESTRA siniestros | 2025 | [INEC IV trimestre 2025](https://www.ecuadorencifras.gob.ec/siniestros-de-transito-iv-trimestre-2025/) y corte anual ANT | auditado 2026-07-27 | agregacion territorial; reconciliacion exacta I-IV | condiciones originales ANT/INEC; agregado REDSA CC BY 4.0 |
| ANT, ubicaciones sanitizadas | 2024-2026 | cortes diciembre 2024, diciembre 2025 y junio 2026 auditados 2026-07-27 | 21.213/21.220 en 2024; 20.156/20.346 en 2025; 10.748/10.752 en 2026 parcial | un GeoJSON diferido por ano; mes y atributos analiticos minimizados; sin placas, participantes, direccion ni fecha exacta | condiciones originales ANT; derivado REDSA CC BY 4.0 |
| ANT siniestros | 2026 enero-junio | [INEC trimestral 2026](https://www.ecuadorencifras.gob.ec/siniestros-transito-trimestral/) y corte junio ANT | auditado 2026-07-27 | agregado provisional; I trimestre reconciliado, II pendiente de publicacion INEC | condiciones originales ANT; agregado REDSA CC BY 4.0 |
| EDG | 2020 | [datosabiertos.gob.ec](https://www.datosabiertos.gob.ec/dataset/76c25389-908f-4253-b1dd-658faf3ad5a6/resource/fdad9620-9f05-4991-adb5-b8d8638dc83f/download/inec_defuncionesgenerales_2020.csv) | 2026-07-14 | filtro CIE-10 V01-V89 y agregacion | datos abiertos INEC; microdato restringido internamente |
| EDG | 2021 | [datosabiertos.gob.ec](https://www.datosabiertos.gob.ec/dataset/d76d1914-39b0-4004-83b8-7a91f98ce8be/resource/48856f9a-c91d-4e5b-8dbb-9cd55a2f6d07/download/edg_2021_csv.csv) | 2026-07-14 | igual | igual |
| EDG | 2022 | [datosabiertos.gob.ec](https://www.datosabiertos.gob.ec/dataset/18025173-7ce6-4e88-8740-c8ea92b4f713/resource/a7d83710-96ef-49a8-8ea9-7776a9384880/download/edg_2022_csv.csv) | 2026-07-14 | igual | igual |
| EDG | 2023 | [datosabiertos.gob.ec](https://www.datosabiertos.gob.ec/dataset/2a952b84-05a0-4cd9-9463-6a727cdadca8/resource/9faefcfe-5546-46de-8fc0-b4f12bcfdefa/download/edg_2023_csv.csv) | 2026-07-14 | igual | igual |
| EDG | 2024 | [datosabiertos.gob.ec](https://www.datosabiertos.gob.ec/dataset/07a6d0d3-2adc-4b63-87c4-f34197864a64/resource/d291fe38-bd5c-48ea-96ab-18482ec77939/download/edg_2024_csv.csv) | 2026-07-14 | igual | igual |
| SPPAT fallecidos | 2016-2021 | [datosabiertos.gob.ec](https://www.datosabiertos.gob.ec/dataset/7594a5f6-9e88-42ca-bb2d-624c2d163263/resource/981876e9-1e61-4037-9073-cfc8a2d9eb79/download/sppat_fallecidosaccidentestransito_2016-2021.csv) | 2026-07-14 | normalizacion de condicion, tipo, sexo y canton | datos abiertos SPPAT; filas restringidas internamente |
| Poblacion cantonal | 2010-2035 | INEC, proyecciones revision 2024, `Cantonal.zip` | 2026-07-14 | suma por sexo/edad y canton | CC BY 4.0 segun reporte de fuente |
| Vehiculos matriculados | 2024 | INEC ESTRA, `2024_BDD_VEHICULOS_MATRICULADOS.sav` | archivo fechado 2025-07-04 | value labels SPSS, groupby canton/provincia/clase | uso estadistico; agregado publicado |
| OSM | cortes 2026-07-16 y 2026-07-22 | Overpass API | generado por scripts | infraestructura y red vial; consultas poligonales por provincia, deduplicacion y recorte nacional. Las nuevas capas de vias y densidad reutilizan esta misma fuente licenciada | ODbL, OpenStreetMap contributors |
| Mapillary | sin corte util | Graph API | salida vacia | requiere `MAPILLARY_ACCESS_TOKEN` | terminos Mapillary |

Las capas oficiales conservan `txt` y `categoria_territorial`. Las dos zonas
en estudio y la isla no se asignan a una provincia/parroquia ni se interpretan
como `sin_dato`: su estado estadistico es `no_aplica_zona_especial`.

La simplificacion provincial y parroquial usa mapshaper 0.7.48 en este orden:
reproyeccion, `snap interval=0.000001 fix-geometry`, `clean only-arcs` y
`simplify interval=40m keep-shapes`. La precision de salida es 0.000005 grados.
La variacion de superficie total fue menor a 0.001%, con cero geometrías
invalidas, huecos internos o solapamientos posteriores.

## Fuentes aun no incorporadas

- ANDA EDT/ANET 2017, 2018 y 2020: los endpoints de microdatos presentan un
  formulario de terminos. No se aceptaron ni descargaron sin autorizacion.
- Waze: no disponible. Requiere gestion institucional con Waze for Cities o
  acuerdo con AMT; el convenio AMT-Waze no incluye a REDSA.
- Google Maps/EIE/GEE: documentados como fuentes con credencial, no integrados.

## Licenciamiento por archivo

El pipeline ANT nuevo usa encabezados SPDX y una declaracion REUSE para separar
las condiciones originales de ANT, el derivado REDSA bajo CC BY 4.0 y el
codigo. El cumplimiento REUSE del repositorio historico completo sigue
pendiente: no se relicencian automaticamente archivos heredados sin revisar su
procedencia.

## Integridad de archivos

El paquete maestro de Drive incluye `MANIFEST_SHA256.csv` con hash, tamano y
fecha de los artefactos publicados y las fuentes inventariadas. Los hashes
permiten demostrar que un archivo auditado no cambio silenciosamente.

## Dependencias de Terceros (Frontend)

- **simple-statistics**: v7.8.3, vendorizado localmente en `docs/assets/js/vendor/`. Licencia **ISC** (compatible con MIT). Se utiliza para clasificación espacial dinámica de variables continuas usando `ckmeans` (Goodness of Variance Fit).
- **driver.js**: Biblioteca para crear el recorrido guiado interactivo. Obtenida de [driver.js](https://driverjs.com/). Licencia MIT.
- **html2canvas**: v1.4.1, vendorizado localmente. Licencia MIT. Renderiza en el navegador el mapa y la ficha territorial antes de la descarga; no envia ni almacena la ficha en un servidor.
- **jsPDF**: v4.2.1, vendorizado localmente. Licencia MIT. Genera el PDF territorial en memoria y lo entrega directamente al dispositivo de la persona usuaria.
- **Google Analytics 4 (`gtag.js`)**: ID `G-9EXVX3E2SW`. **Única excepción explícita a la regla de vendorización local del proyecto**. Se carga de forma remota y asíncrona desde `https://www.googletagmanager.com/gtag/js` únicamente en entornos de producción (`hostname` distinto de `localhost` o `127.0.0.1`), debido a que requiere conexión en vivo con los servidores de Google para reportar la telemetría y métricas agregadas de tráfico del sitio. No se recolectan datos personales de usuarios ni de víctimas.
- **CountAPI (`countapi.mileshilliard.com`)**: contador público, sin credenciales y con CORS, usado únicamente para acumular eventos de descarga del catálogo desde la publicación de esta función. El valor es global y orientativo: cuenta descargas, no personas únicas, y las claves son públicamente consultables. Las descargas también se envían a GA4 como evento `catalog_download` para auditoría agregada.
- **ColorBrewer**: Estándar de esquemas de color para cartografía, implementado como diccionario en el código fuente. Licencia **Apache 2.0**.
