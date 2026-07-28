# Guía de lenguaje simple para productos REDSA

Fecha de revisión: 2026-07-28.

## Para qué sirve

Esta guía aplica a fichas territoriales, boletines, catálogo de variables,
metodologías breves y publicaciones en redes del Observatorio Ciudadano de
Seguridad Vial y Movilidad Sostenible.

Toma como referencia
[ISO 24495-1:2023](https://www.iso.org/standard/78907.html), que establece
principios y directrices para documentos en lenguaje claro. Esta guía es una
adaptación práctica de REDSA; no reproduce la norma ni certifica conformidad.
La accesibilidad digital debe evaluarse además con WCAG.

## Los cuatro resultados que debe lograr un texto

1. **Pertinente:** la persona recibe la información que necesita para su
   decisión, sin detalles que compitan con el mensaje principal.
2. **Localizable:** puede encontrar rápido el dato, el periodo, el territorio,
   la fuente y la limitación principal.
3. **Comprensible:** entiende las palabras, relaciones y cifras en la primera
   lectura.
4. **Utilizable:** sabe qué puede concluir, qué no puede concluir y qué acción
   puede realizar después.

## Reglas prácticas

- Comenzar por la conclusión útil; dejar códigos y fórmulas como segundo nivel.
- Nombrar siempre **qué se contó**, **dónde**, **cuándo** y **quién produjo el
  dato**.
- Usar una idea principal por oración y párrafos breves.
- Preferir verbos directos: “cuenta”, “compara”, “muestra”, “no incluye”.
- Explicar la sigla la primera vez: “Registro Civil (EDG)”.
- Mantener términos necesarios como `CIE-10` o `DPA`, pero acompañarlos con una
  explicación ciudadana.
- Distinguir dato faltante de cero: “sin datos disponibles”, nunca “0” por
  sustitución.
- Convertir límites metodológicos en frases concretas: “indica residencia del
  propietario, no dónde circula el vehículo”.
- Evitar atribuir culpa. Usar “causa probable registrada por la entidad de
  control”, no “causa del accidente”.
- Presentar primero cifras redondeadas para lectura; conservar el valor exacto
  en tablas descargables cuando corresponda.
- Terminar con una acción clara: cambiar año, comparar territorio, descargar
  datos o consultar metodología.

## Patrón recomendado por producto

### Ficha territorial

1. Hallazgo principal.
2. Valor del año y comparación histórica.
3. Referencia provincial o nacional.
4. Fuente y periodo.
5. Limitación que cambia la interpretación.

### Boletín

1. Titular con resultado verificable.
2. Tres cifras clave como máximo.
3. Qué cambió y contra qué periodo.
4. Qué no puede concluirse.
5. Enlace al dato y metodología.

### Catálogo

1. Nombre ciudadano de la variable.
2. Qué cuenta.
3. Periodo y nivel territorial.
4. Fuente.
5. Advertencia principal.
6. Descargas.

### Redes sociales

1. Una idea por pieza.
2. Periodo visible en la imagen y en el texto.
3. Fuente legible.
4. Evitar “zona peligrosa” si el dato solo muestra concentración de registros.
5. Enlazar a la ficha o al catálogo para contexto.

## Ejemplos tomados del geoportal

Los textos “antes” se copiaron del catálogo o del registro de variables
publicado el 28 de julio de 2026.

| Uso | Antes | Después recomendado |
|---|---|---|
| Variable de siniestros | “Número de siniestros de tránsito registrados oficialmente. ANT e INEC/ESTRA forman una sola cadena estadística y sus cifras no deben sumarse entre sí.” | “Cuenta los siniestros registrados oficialmente en cada territorio. ANT registra los hechos e INEC procesa esa misma información; por eso sus cifras no se suman.” |
| Fallecidos EDG | “Número de personas que murieron por accidentes de tránsito.” | “Cuenta las personas cuya defunción fue registrada por una causa de tránsito. El territorio corresponde al lugar de fallecimiento registrado, no siempre al lugar del siniestro.” |
| Tasa por población | “Fallecidos por cada 100.000 habitantes: permite comparar zonas con poblaciones de distinto tamaño.” | “Compara la mortalidad vial entre territorios de distinto tamaño: muestra cuántas personas fallecieron por cada 100.000 habitantes.” |
| Tasa por vehículos | “Accidentes por cada 1.000 vehículos matriculados: mide el riesgo según la cantidad de vehículos, no solo de personas.” | “Compara los siniestros con el número de vehículos matriculados. Los vehículos se ubican por residencia del propietario; la tasa no mide dónde circulan ni el tráfico real.” |
| Cobertura OSM | “Qué tanto se ha registrado la infraestructura de seguridad vial (...) en el mapa colaborativo OpenStreetMap.” | “Muestra cuánta infraestructura está dibujada en OpenStreetMap. Un valor bajo puede significar falta de mapeo; no demuestra que la infraestructura no exista.” |
| Puntos ANT | “Derivados públicos sanitizados de siniestros registrados por ANT.” | “Muestra cada siniestro con ubicación publicable. REDSA retiró placas, datos de participantes, dirección completa y fecha exacta antes de publicar.” |
| Método territorial | “Conteo por código territorial DPA y año. Los valores faltantes se mantienen como sin dato.” | “Agrupamos los registros por provincia, cantón o parroquia y por año. Cuando la fuente no tiene información, mostramos ‘sin datos’; no la reemplazamos con cero.” |
| Coordenadas excluidas | “Se excluyen 29 ubicaciones no verificables (20/8/1), sin alterar los totales territoriales.” | “No dibujamos 29 puntos porque su ubicación no pudo verificarse: 20 de 2024, 8 de 2025 y 1 de 2026. Esos registros sí permanecen en el total del territorio declarado.” |

## Lista de control antes de publicar

- [ ] El título dice qué pasó y a quién o qué se refiere.
- [ ] El territorio y el periodo aparecen antes de la metodología.
- [ ] Cada cifra tiene unidad y fuente.
- [ ] Las siglas se explican en su primera aparición.
- [ ] “Sin datos” y “cero” tienen significados distintos.
- [ ] La limitación principal está junto al dato, no escondida al final.
- [ ] El texto no presenta asociación como causalidad ni culpa a la víctima.
- [ ] La persona sabe dónde ampliar, comparar o descargar.
- [ ] Otra persona ajena al proyecto pudo leerlo sin explicación oral.

## Gobernanza

La persona autora aplica la lista de control. Una segunda persona revisa
exactitud y lenguaje. Cuando el texto resume una variable estadística, la
revisión debe contrastarlo con `catalogo_metadatos.json` y la metodología
vigente antes de publicarlo.
