# Auditoría de coordenadas ANT fuera de Ecuador

Fecha: 2026-07-28

## Resultado ejecutivo

- Se revisaron 52.319 filas crudas de ANT (2024–junio de 2026); 52.317 contienen ambas coordenadas numéricas.
- Contra la unión exacta de `provincias_wgs84.geojson`, 230 filas crudas están fuera: 29 en 2024, 195 en 2025 y 6 en 2026.
- De esas 230, 196 son inválidas para el pipeline y 5 tienen longitud positiva que el pipeline corrige por signo. Las 29 restantes pasan el rectángulo nacional, se etiquetan `valida_original` y son publicadas aunque están fuera del polígono: 20 en 2024, 8 en 2025 y 1 en 2026.
- Las 29 coordenadas visibles fuera de tierra coinciden exactamente entre el Excel ANT, la salida del sanitizador (redondeada a 5 decimales) y los GeoJSON publicados. El error posicional ya está presente en la fuente ANT.
- El pipeline sí tiene una brecha de validación: usa un *bounding box* (`-5.1..2.1`, `-92.2..-74.8`) en lugar de la máscara territorial. Por eso no origina el desplazamiento, pero permite publicarlo.
- No existe offset constante. En las 29 filas visibles, el desplazamiento mínimo hacia el cantón declarado varía en Δlat de -0,99060° a +2,97072° y en Δlon de -0,05224° a +2,51911°; ninguna pareja de offsets se repite ni siquiera redondeada a 0,0001°.

## Alcance y criterio

La máscara principal fue la unión de las 26 geometrías válidas de `docs/data/provincias_wgs84.geojson`, usando `covers` para considerar válidos los puntos sobre el borde. Esa unión incluye Galápagos, tal como exige la referencia de archivo. Si “continental” se interpreta excluyendo DPA 20, el conteo sería 245; los 15 adicionales caen en Galápagos y no son el patrón oceánico investigado.

Para responder “dónde debería caer”, no se inventó una ubicación puntual. Se calculó el punto más cercano de la geometría del cantón declarado: es el desplazamiento mínimo necesario para que la coordenada sea compatible con el cantón, no una reconstrucción del sitio real.

## Tabla comparativa (muestra de 20)

| Año/fila | ID ANT | Coordenada cruda lat, lon | Provincia / cantón / parroquia declarados | Punto mínimo compatible con cantón lat, lon | Distancia al cantón | Δlat, Δlon |
|---|---|---|---|---|---:|---|
| 2024/2370 | CTE00187022024 | -0.8975370, -80.5680420 | MANABI / JARAMIJO / JARAMIJO | -0.92810, -80.58506 | 3.9 km | -0.03056, -0.01702 |
| 2024/7724 | MMA00250052024 | -0.9834372, -80.8461980 | MANABI / MANTA / MANTA | -0.98361, -80.84600 | 0.0 km | -0.00017, 0.00020 |
| 2024/10070 | CTE00022062024 | -2.2301380, -80.9911940 | SANTA ELENA / SALINAS / SALINAS (SALINAS) | -2.21673, -80.97910 | 2.0 km | 0.01341, 0.01209 |
| 2024/15688 | CTE00439102024 | -3.5274520, -80.4681600 | AZUAY / SANTA ISABEL / SANTA ISABEL | -2.98948, -79.64525 | 109.1 km | 0.53797, 0.82291 |
| 2024/16220 | CTE00002102024 | -3.5519550, -80.2488600 | GUAYAS / GUAYAQUIL / GUAYAQUIL | -3.04149, -80.19713 | 56.7 km | 0.51046, 0.05173 |
| 2024/16274 | CTE00143102024 | -3.6358410, -80.5210400 | GUAYAS / ALFREDO BAQUERIZO MORENO / ALFREDO BAQUERIZO MORENO (JUJAN) | -2.02992, -79.56098 | 207.2 km | 1.60592, 0.96006 |
| 2024/16277 | CTE00147102024 | -3.1383440, -80.2640100 | GUAYAS / ALFREDO BAQUERIZO MORENO / ALFREDO BAQUERIZO MORENO (JUJAN) | -2.02992, -79.56098 | 145.4 km | 1.10842, 0.70303 |
| 2024/16321 | CTE00242102024 | -3.2254690, -80.3023800 | GUAYAS / SAMBORONDON / SAMBORONDON | -2.17700, -79.86651 | 125.7 km | 1.04847, 0.43587 |
| 2024/16384 | CTE00409102024 | -2.9161110, -80.9638800 | GUAYAS / MILAGRO / MILAGRO (MILAGRO) | -2.15673, -79.67477 | 166.1 km | 0.75938, 1.28911 |
| 2024/16603 | CTE00333102024 | -2.8779440, -79.8643600 | LOS RIOS / MONTALVO / MONTALVO (MONTALVO) | -1.85978, -79.42010 | 123.0 km | 1.01816, 0.44426 |
| 2024/16706 | CTE00229102024 | -3.2185800, -80.3006600 | AZUAY / SANTA ANA / SANTA ANA | -1.32683, -80.09751 | 210.4 km | 1.89175, 0.20315 |
| 2024/17154 | CTE00391102024 | -3.2997220, -80.3625000 | PICHINCHA / MEJIA / MACHACHI | -0.66306, -78.71586 | 344.3 km | 2.63666, 1.64664 |
| 2025/2571 | CTE00021022025 | -2.2449440, -80.9664170 | SANTA ELENA / LA LIBERTAD / LA LIBERTAD (LA LIBERTAD) | -2.24259, -80.92097 | 5.1 km | 0.00236, 0.04545 |
| 2025/2757 | CTE00207022025 | -2.4661110, -81.1094440 | ESMERALDAS / SAN LORENZO / ANCON | 0.50461, -78.59033 | 431.9 km | 2.97072, 2.51911 |
| 2025/2796 | CTE00246022025 | -3.4393080, -80.4394470 | EL ORO / ARENILLAS / ARENILLAS | -3.49895, -80.21846 | 25.4 km | -0.05964, 0.22099 |
| 2025/2896 | CTE00346022025 | -2.9744440, -80.5519440 | GUAYAS / PLAYAS / GENERAL VILLAMIL | -2.71334, -80.31647 | 39.0 km | 0.26110, 0.23547 |
| 2025/7650 | MMA00366052025 | -0.9435676, -80.7488864 | MANABI / MANTA / MANTA | -0.94400, -80.74882 | 0.0 km | -0.00044, 0.00006 |
| 2025/13273 | MEP00037082025 | 0.6443788, -77.4248190 | ORELLANA / LORETO / LORETO | -0.34622, -77.30161 | 110.4 km | -0.99060, 0.12321 |
| 2025/17781 | MMA00186112025 | -0.9471188, -80.7155429 | MANABI / MANTA / MANTA | -0.94909, -80.71678 | 0.3 km | -0.00197, -0.00124 |
| 2026/6171 | MLO00232042026 | -4.2516933, -80.7702860 | LOJA / LOJA / LOJA | -3.80074, -79.54602 | 144.8 km | 0.45095, 1.22427 |

## Evaluación de hipótesis

1. **Signo equivocado:** descartado para las 29 visibles. Cambiar el signo de longitud no coloca ninguna dentro de Ecuador.
2. **Latitud/longitud invertidas:** descartado. Intercambiar ejes no coloca ninguna de las 29 dentro de Ecuador.
3. **Datum/proyección:** descartado como causa común. Interpretar las coordenadas decimales como PSAD56 geográfico y transformarlas a WGS84 mueve entre 433 y 454 m; solo 4 puntos limítrofes entran en la máscara, mientras las distancias observadas a tierra llegan a 61,9 km y al cantón declarado a 431,9 km. UTM 17S mal etiquetado tampoco es compatible con valores fuente en grados decimales (~-4..1, ~-81..-77), no con este/norte métricos.
4. **Dato de origen ANT defectuoso:** hipótesis principal. Las coordenadas anómalas están literalmente en los Excel crudos y llegan sin cambio al GeoJSON.
5. **Pipeline REDSA:** causa contribuyente de publicación, no del desplazamiento. `inside_ecuador()` valida solo un rectángulo; `sanitize_coordinates()` conserva cualquier par dentro de ese rectángulo como `valida_original`. Falta una comprobación punto-polígono y una coherencia coordenada↔DPA.

## Patrón de offset

El patrón es errático respecto del territorio declarado. La distancia mínima al cantón tiene mediana 109,9 km, promedio 111,6 km, mínimo 28,9 m y máximo 431,9 km. En el subgrupo suroccidental (23 de 29), Δlat tiene media 0,94585° y desviación 0,89487°; Δlon media 0,61223° y desviación 0,62950°. La gran dispersión y la ausencia de offsets repetidos descartan una traslación rígida.

La alineación visual paralela a la costa se explica porque 23 coordenadas defectuosas se concentran en el corredor suroccidental, pero sus cantones declarados abarcan Esmeraldas/San Lorenzo, Pichincha/Mejía, Azuay, Guayas, Los Ríos, El Oro, Santa Elena y Loja. No representan un único desplazamiento geométrico desde esos cantones.

## Recomendación para decisión de Diego

No corregir coordenadas caso por caso: no hay transformación demostrable que recupere la ubicación real. Tratar las 29 como “ubicación no verificable” o excluirlas de la capa puntual, conservando el registro territorial agregado cuando el DPA sea válido. En una fase posterior y solo con autorización, endurecer el pipeline para poner en cuarentena todo punto fuera de la unión provincial y toda discordancia fuerte con el cantón declarado.
