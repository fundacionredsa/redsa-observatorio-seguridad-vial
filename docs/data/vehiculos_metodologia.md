# Vehiculos matriculados 2024: metodologia

## Fuente y corte

- **Fuente:** INEC, Estadisticas de Transporte (ESTRA), Vehiculos Matriculados 2024.
- **Archivo:** `2024_BDD_VEHÍCULOS_MATRICULADOS.sav`.
- **Fecha de corte:** año 2024.
- **Registros leidos y agregados:** 3,138,562. No se perdieron registros entre la lectura y las agregaciones cantonal/provincial.
- **Clases conservadas:** `AUTOBUS`, `AUTOMOVIL`, `CAMION`, `CAMIONETA`, `FURGONETA`, `MOTOCICLETA`, `OTRA CLASE`, `SUV`, `TANQUERO`, `TRAILER`, `VOLQUETA`.

## Unidad territorial

El SAV se agrego mediante los codigos oficiales de `Provincia` y `Canton`. El total provincial se obtuvo sumando directamente los registros fuente, no promediando resultados cantonales. Los cantones del GeoJSON sin registros ESTRA son `1413`, `9006`, `ISLA`; sus campos se publican como `sin_dato`, no como cero.

> **Advertencia de interpretacion:** Los vehiculos se registran por residencia del propietario; no representan necesariamente los vehiculos que circulan en cada territorio.

## Indicadores

- `tasa_siniestros_por_1000_vehiculos_2024` = siniestros INEC 2024 / vehiculos matriculados 2024 x 1.000.
- `tasa_fallecidos_por_1000_vehiculos_2024` = fallecidos EDG 2024 / vehiculos matriculados 2024 x 1.000.
- `tasa_motociclistas_fallecidos_por_1000_motos_2024` = fallecidos clasificados como motociclistas EDG 2024 / motocicletas matriculadas 2024 x 1.000.
- `porcentaje_motocicletas_vehiculos_2024` = motocicletas matriculadas / total de vehiculos matriculados x 100.

Cuando falta el numerador, falta el registro vehicular o el denominador es cero, la tasa queda en `null` y el motivo se declara en `calidad_tasas_vehiculos_2024`.

## Limitacion de la tasa de motociclistas

La tasa usa numerador y denominador de 2024. El registro EDG concentra muchos casos en CIE-10 `V89`, por lo que el numerador clasificado como motociclista puede estar subestimado.

Ademas, el registro EDG concentra una proporcion alta de casos en CIE-10 `V89` (vehiculo no especificado), por lo que el desglose de usuario vial debe interpretarse con cautela. Para condicion del usuario vial, SPPAT suele ofrecer mayor especificidad que EDG.
