# Fuentes y procedencia

Las fechas locales corresponden a la copia disponible en Drive, no
necesariamente a la fecha de publicacion institucional.

| Fuente | Periodo | Origen / descarga | Copia local | Transformacion | Licencia/uso |
|---|---|---|---|---|---|
| Organizacion territorial cantonal | recurso 2025-02-20 | [datosabiertos.gob.ec](https://datosabiertos.gob.ec/dataset/f3ed6f26-a85c-449a-9246-2bdc9a612b4b/resource/11b85d91-9139-4709-97dd-4bc0b92d4f02/download/organizacion-territorial-cantonal.zip) | descargada 2026-07-14 | EPSG:32717 a 4326; simplificacion topologica 40 m | CKAN: CC BY sin version explicita |
| Limites parroquiales | archivo historico 2014 | `SHP_INEC_2014.zip`; URL original no preservada | descargada 2026-07-15 | reproyeccion, agregacion de EDG | vigencia/licencia por confirmar; no presentar como CONALI 2022 |
| INEC siniestros | 2019 | [datosabiertos.gob.ec](https://www.datosabiertos.gob.ec/dataset/4f7a7f85-7a78-4c15-9402-429745f810fc/resource/bbfef24d-e0b7-48b0-9998-5412a35d50c3/download/inec_anuario-de-estadisticas-de-transporte_siniestros-de-transito_2019.csv) | 2026-07-14 | homologacion territorial y agregacion | datos abiertos INEC |
| INEC siniestros | 2021-2024 | CSV locales derivados de ESTRA | 2026-07-15 | homologacion territorial, resumen por clase/causa/zona/hora | origen exacto por archivo pendiente de registrar |
| EDG | 2020 | [datosabiertos.gob.ec](https://www.datosabiertos.gob.ec/dataset/76c25389-908f-4253-b1dd-658faf3ad5a6/resource/fdad9620-9f05-4991-adb5-b8d8638dc83f/download/inec_defuncionesgenerales_2020.csv) | 2026-07-14 | filtro CIE-10 V01-V89 y agregacion | datos abiertos INEC; microdato restringido internamente |
| EDG | 2021 | [datosabiertos.gob.ec](https://www.datosabiertos.gob.ec/dataset/d76d1914-39b0-4004-83b8-7a91f98ce8be/resource/48856f9a-c91d-4e5b-8dbb-9cd55a2f6d07/download/edg_2021_csv.csv) | 2026-07-14 | igual | igual |
| EDG | 2022 | [datosabiertos.gob.ec](https://www.datosabiertos.gob.ec/dataset/18025173-7ce6-4e88-8740-c8ea92b4f713/resource/a7d83710-96ef-49a8-8ea9-7776a9384880/download/edg_2022_csv.csv) | 2026-07-14 | igual | igual |
| EDG | 2023 | [datosabiertos.gob.ec](https://www.datosabiertos.gob.ec/dataset/2a952b84-05a0-4cd9-9463-6a727cdadca8/resource/9faefcfe-5546-46de-8fc0-b4f12bcfdefa/download/edg_2023_csv.csv) | 2026-07-14 | igual | igual |
| EDG | 2024 | [datosabiertos.gob.ec](https://www.datosabiertos.gob.ec/dataset/07a6d0d3-2adc-4b63-87c4-f34197864a64/resource/d291fe38-bd5c-48ea-96ab-18482ec77939/download/edg_2024_csv.csv) | 2026-07-14 | igual | igual |
| SPPAT fallecidos | 2016-2021 | [datosabiertos.gob.ec](https://www.datosabiertos.gob.ec/dataset/7594a5f6-9e88-42ca-bb2d-624c2d163263/resource/981876e9-1e61-4037-9073-cfc8a2d9eb79/download/sppat_fallecidosaccidentestransito_2016-2021.csv) | 2026-07-14 | normalizacion de condicion, tipo, sexo y canton | datos abiertos SPPAT; filas restringidas internamente |
| Poblacion cantonal | 2010-2035 | INEC, proyecciones revision 2024, `Cantonal.zip` | 2026-07-14 | suma por sexo/edad y canton | CC BY 4.0 segun reporte de fuente |
| Vehiculos matriculados | 2024 | INEC ESTRA, `2024_BDD_VEHICULOS_MATRICULADOS.sav` | archivo fechado 2025-07-04 | value labels SPSS, groupby canton/provincia/clase | uso estadistico; agregado publicado |
| OSM | corte 2026-07-16 | Overpass API | generado por scripts | consultas poligonales por provincia, deduplicacion y recorte nacional | ODbL, OpenStreetMap contributors |
| Mapillary | sin corte util | Graph API | salida vacia | requiere `MAPILLARY_ACCESS_TOKEN` | terminos Mapillary |

## Fuentes aun no incorporadas

- ANDA EDT/ANET 2017, 2018 y 2020: los endpoints de microdatos presentan un
  formulario de terminos. No se aceptaron ni descargaron sin autorizacion.
- Waze: no disponible. Requiere gestion institucional con Waze for Cities o
  acuerdo con AMT; el convenio AMT-Waze no incluye a REDSA.
- Google Maps/EIE/GEE: documentados como fuentes con credencial, no integrados.

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
- **ColorBrewer**: Estándar de esquemas de color para cartografía, implementado como diccionario en el código fuente. Licencia **Apache 2.0**.
