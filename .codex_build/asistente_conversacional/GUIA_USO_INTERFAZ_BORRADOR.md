# Guía de uso del geoportal

**Borrador para revisión e incorporación futura al corpus del asistente.**

## ¿Qué permite hacer el geoportal?

El geoportal del Observatorio Ciudadano de Seguridad Vial y Movilidad Sostenible permite explorar y comparar datos oficiales de Ecuador por provincia, cantón y parroquia. También muestra fuentes, periodos disponibles y limitaciones conocidas.

El Observatorio no reemplaza a las instituciones que producen los datos. Los organiza, cruza y explica para facilitar su uso ciudadano y técnico.

## Inicio rápido

1. Busca un cantón en el panel **Explorar mi territorio** o selecciona una unidad directamente en el mapa.
2. Elige el **Año de los datos mostrados** en el panel **Datos y capas**.
3. Selecciona una opción en **Variables del mapa**.
4. Consulta la leyenda y abre **Ver análisis completo** para revisar la ficha territorial.

## Buscar y seleccionar un territorio

- Escribe el nombre de un cantón en **Busca tu cantón**.
- También puedes seleccionar una provincia, cantón o parroquia directamente en el mapa.
- La unidad seleccionada queda resaltada hasta que elijas otra.
- En móvil, usa **Explorar mi territorio** para abrir el panel ciudadano.

Si un nombre puede referirse a más de un lugar, confirma la provincia antes de continuar.

## Año y periodo

El control **Año de los datos mostrados** cambia el periodo del mapa y de los paneles compatibles.

- **Año seleccionado** muestra únicamente el año marcado.
- **Acumulado histórico** suma solo años compatibles y declara el periodo real de cada fuente.
- Un año gris o marcado como no disponible significa **sin dato**, no cero.
- Los cortes parciales se identifican expresamente. Por ejemplo, 2026 puede representar solo enero-junio en una fuente.

En móvil, la barra fija **Año** permite cambiar de periodo sin abrir el panel completo.

## Nivel territorial

Elige entre:

- **Auto:** el nivel cambia según el acercamiento del mapa.
- **Provincias**
- **Cantones**
- **Parroquias**

No todas las variables existen en todos los niveles. Cuando una variable no está disponible, el mapa muestra límites y un mensaje; no asigna valores falsos.

## Variables del mapa

Abre **Variables del mapa** y elige una variable territorial. Solo una coropleta puede estar activa a la vez.

Para dejar el mapa únicamente con límites administrativos, vuelve a activar la variable ya seleccionada.

La descripción bajo el control explica en lenguaje simple qué representa cada variable. La leyenda informa la unidad, el periodo, la fuente y las clases de color.

## Siniestros en el mapa

La opción **Siniestros (ANT)** muestra los mismos siniestros de la estadística territorial en el lugar donde fueron registrados. No es una cifra adicional que deba sumarse a la coropleta.

Modos disponibles:

- **Calor:** muestra concentración de registros. No mide riesgo individual, calidad de la vía ni exposición al tránsito.
- **Agrupaciones:** reúne casos cercanos y muestra un conteo.
- **Casos:** muestra registros individuales sanitizados.

La cobertura declara cuántos eventos tienen ubicación válida, cuántos no tienen coordenada y cuántos tienen ubicación no verificable. La capa se descarga únicamente cuando se activa.

## Infraestructura vial

Abre **Infraestructura vial** para activar una o varias capas, como ciclovías, aceras, cruces peatonales, semáforos, pacificación del tránsito, límites de velocidad, carriles BRT/Metrobús y vías principales o secundarias.

Estas capas proceden principalmente de OpenStreetMap. Su ausencia puede significar que un elemento no ha sido mapeado; no demuestra que la infraestructura no exista.

## Controles del mapa

- **+ / −:** acercar o alejar.
- **Opacidad de capa:** hacer más transparente o intensa la variable territorial.
- **Mapas base:** cambiar entre mapas claros, oscuros, OpenStreetMap o imagen satelital.
- **Escala gráfica:** estimar distancias según el nivel de acercamiento.

## Leyenda

La leyenda se actualiza con todo lo visible:

- variable territorial;
- nivel y periodo;
- fuente;
- clases de color;
- capas de infraestructura;
- modo y cobertura de Siniestros (ANT);
- datos no disponibles y advertencias metodológicas.

El ícono de información abre el detalle técnico de la clasificación o de una sigla.

En móvil, abre la leyenda desde su control inferior para leerla completa.

## Análisis territorial

Después de seleccionar una unidad, pulsa **Ver análisis completo**.

La ficha puede incluir:

- valor del año seleccionado y acumulado histórico;
- comparación con el territorio superior;
- tendencia anual;
- población y tasas;
- perfil de personas fallecidas;
- información de ANT, EDG y SPPAT;
- fuentes y limitaciones.

Las fuentes no deben sumarse entre sí:

- **ANT/INEC-ESTRA** registra siniestros, lesionados y fallecidos en sitio según su metodología.
- **EDG** corresponde al Registro Estadístico de Defunciones Generales del INEC y usa causas CIE-10 V01-V89.
- **SPPAT** corresponde a reclamaciones del seguro.

## Catálogo y descargas

Abre **Catálogo de Datos** para:

- buscar una variable;
- revisar fuente, años, nivel, licencia, metodología y calidad;
- descargar archivos tabulares o geográficos cuando estén disponibles;
- consultar la sección **Transparencia y confianza**.

Cada descarga debe incluir metadatos y referencia a la fuente original y a cualquier cálculo realizado por REDSA.

## Ranking nacional y transparencia

Abre **Ver ranking nacional** para comparar cantones bajo la variable y el periodo activos.

Los territorios sin dato se excluyen del ordenamiento; no se colocan como si tuvieran valor cero. En esta sección también se explica por qué confiar en el tratamiento del Observatorio y cómo citarlo.

## Ficha PDF

Después de seleccionar un territorio, **Descargar ficha PDF** genera una ficha en el navegador. El archivo incluye mapa, indicadores, periodo consultado, contexto histórico, comparaciones, gráficos, fuentes, metodología y contacto de Fundación REDSA.

La ficha se genera para la descarga del usuario y no se guarda como archivo permanente en el repositorio.

## Tema claro u oscuro

El botón **Modo Claro/Oscuro** cambia el contraste de la interfaz. Los datos y la selección permanecen iguales.

## Tour guiado

**Tour guiado** recorre búsqueda, análisis, variables, periodos, niveles, infraestructura, Siniestros (ANT), leyenda, catálogo, ficha PDF, ranking y transparencia.

## Cómo interpretar “sin dato”

- **0:** la fuente registró cero para esa combinación.
- **Sin dato:** la fuente no publicó o no permitió calcular un valor.
- **Parcial:** el periodo aún no cubre el año completo.
- **No comparable:** la definición, el periodo o el nivel no permiten una comparación válida.

El Observatorio conserva estas diferencias y nunca reemplaza automáticamente un dato faltante por cero.

## Ayuda y contacto

Para consultas sobre el Observatorio o sus datos: **info@fundacionredsa.org**.

Antes de reportar un problema, anota la variable, el año, el nivel territorial y el territorio que estabas consultando.
