# Declaración de calidad de los datasets del Observatorio

Fecha de evaluación: 2026-07-28.

## Propósito y alcance

Cada entrada de `docs/data/catalogo_metadatos.json` contiene ahora un bloque
`calidad`. Su objetivo es ayudar a decidir si un dato sirve para un uso
concreto. No es una certificación, una nota numérica ni una declaración de
cumplimiento oficial.

La estructura toma como referencia las dimensiones de calidad de resultados
del [Marco Nacional de Aseguramiento de la Calidad de las Naciones Unidas
(UN NQAF)](https://unstats.un.org/capacity-development/admin-data/docs/quality/guidance_and_toolkit_qa_admin_data_for_official_statistics-en.pdf)
y del
[Código de buenas prácticas de las estadísticas europeas](https://ec.europa.eu/eurostat/web/quality/european-quality-standards/european-statistics-code-of-practice):

- relevancia;
- precisión;
- oportunidad y puntualidad;
- comparabilidad;
- coherencia;
- accesibilidad.

Para mantener las seis claves solicitadas, precisión incluye fiabilidad;
accesibilidad incluye claridad. Una declaración “pendiente de evaluación”
significa que el repositorio no contiene evidencia suficiente: no equivale a
calidad baja ni alta.

## Fuentes de evidencia

Las declaraciones se construyeron únicamente con:

- `documentacion/FUENTES_Y_PROCEDENCIA.md`;
- `documentacion/PROBLEMAS_CONOCIDOS.md`;
- `documentacion/METODOLOGIA.md`;
- `documentacion/VALIDACION.md`;
- `documentacion/adr/0004-parish-resolver-correction.md`;
- metadatos y descripciones del catálogo publicado.

## Resumen por dataset

| Dataset | Fortalezas documentadas | Limitación principal declarada |
|---|---|---|
| Siniestros ANT/INEC | Reconciliación exacta en tres cortes; serie territorial 2017-2026 | 2026 parcial y registros en zonas territoriales especiales |
| Fallecidos EDG | Filtro CIE-10 reproducible; totales territoriales reconciliados | V89 concentra 76,1%; lugar de fallecimiento no siempre es lugar del siniestro |
| Fallecidos por 100.000 habitantes | Fórmula estable y agregación sin promediar tasas | Hereda límites de EDG y población |
| Siniestros por 1.000 vehículos | Universo vehicular reconciliado | Residencia del propietario no equivale a circulación |
| Motociclistas por 1.000 motos | Periodo 2024 coherente entre numerador y denominador | V89 puede subestimar el numerador identificado |
| Fallecidos SPPAT | Agregados internos reconciliados | Reclamaciones no equivalen al universo de defunciones; serie termina en 2021 |
| Fallecidos parroquiales EDG | Sumas exactas entre parroquia, cantón y provincia | Cabeceras urbanas y cambios administrativos requieren cruces documentados |
| Porcentaje de motos | Denominador ESTRA reconciliado | Foto única 2024 y residencia del propietario |
| Cobertura de mapeo OSM | Definición explícita y pipeline deduplicado | No existe referencia externa de completitud; no mide infraestructura real |
| Vías OSM | Clasificación y deduplicación documentadas | Fuente colaborativa; comparación MTOP solo orientativa |
| Puntos ANT | Exclusiones de ubicación trazables y esquema sanitizado | Cobertura puntual menor que el total territorial; 2026 parcial |

## Estructura legible por máquina

Ejemplo abreviado:

```json
{
  "calidad": {
    "marco": "Declaración descriptiva basada en dimensiones UN NQAF/Eurostat",
    "fecha_evaluacion": "2026-07-28",
    "relevancia": {
      "evaluacion": "documentada",
      "declaracion": "Texto sustentado en evidencia existente.",
      "evidencia": ["documentacion/VALIDACION.md"]
    },
    "precision": {},
    "oportunidad_puntualidad": {},
    "comparabilidad": {},
    "coherencia": {},
    "accesibilidad": {}
  }
}
```

Todos los datasets deben conservar las seis dimensiones. Si una nueva fuente
no tiene evaluación suficiente, debe usar `pendiente de evaluación` y explicar
qué evidencia falta, en lugar de omitir el campo.

## Resolución de coherencia de la tasa de motociclistas

La revisión encontró un **error de redacción en la metodología**, no un error
del cálculo publicado:

- `geoportal_estadisticas/procesar_datos.py` obtiene el numerador desde
  `fallecidos_detallado["2024"].usuario.motociclista`.
- `geoportal_estadisticas/procesar_vehiculos_2024.py`, mediante
  `get_motorcyclist_deaths()`, selecciona `fallecidos_detallado[str(ANIO)]`,
  donde `ANIO = 2024`.
- `docs/assets/js/geoportal-registry.js` y el catálogo describen la fórmula
  como motociclistas EDG 2024 divididos para motos matriculadas en 2024.
- Los valores publicados de DMQ, Guayaquil y Cayambe coinciden exactamente
  con la fórmula anual. No coinciden con el numerador acumulado 2020-2024.

El texto anterior de `documentacion/METODOLOGIA.md` conservaba la fórmula
exploratoria antigua, con numerador 2020-2024. Se corrigió para reflejar el
cálculo vigente:

`motociclistas identificados en EDG 2024 / motocicletas matriculadas en 2024
* 1.000`.

La dimensión de coherencia queda como `documentada`. Se mantiene la
limitación sustantiva: la elevada presencia de códigos CIE-10 V80-V89,
especialmente V89, puede subestimar el número de motociclistas identificados.
