# Pipeline diario de la hemeroteca

## Alcance

Este diseño cubre únicamente la ingesta y publicación de datos de la hemeroteca.
No incorpora páginas, botones ni otros cambios de interfaz.

## Decisiones de diseño

- El proceso se ejecuta diariamente a las 11:15 UTC (06:15 de Ecuador
  continental) mediante GitHub Actions y también admite ejecución manual.
- Fuentes, palabras clave, proveedor compatible con Chat Completions, `base_url`,
  ruta del endpoint, modelo, variable de la API key, temas, reintentos, códigos
  de rate-limit, presupuesto y ruta de salida viven en
  `config/hemeroteca.json`. El script no contiene listas de medios ni
  parámetros operativos duplicados.
- Se usa Python porque los generadores y verificadores de datos del repositorio
  ya se implementan mayoritariamente en ese lenguaje.
- La publicación usa un único `docs/data/hemeroteca.json`. Es el contrato más
  simple para un futuro `fetch("data/hemeroteca.json")` desde GitHub Pages y no
  requiere solicitudes adicionales ni un índice de particiones.
- El archivo conserva un arreglo `noticias` en orden de ingesta. Cada ejecución
  carga el contenido previo y agrega solamente registros nuevos; nunca reemplaza
  ni recalcula entradas existentes. En particular, preserva cualquier cambio
  manual de `oculto`.
- No se fija por ahora un máximo histórico ni una política de purga. Si el peso
  del archivo llega a afectar la carga pública, la migración prevista es un
  índice estable más archivos `AAAA/MM.json`, manteniendo el contrato actual
  durante una transición.

## Flujo diario

1. Validar de forma estricta el archivo de configuración, la ruta relativa de
   salida y el JSON existente antes de realizar solicitudes externas.
2. Descargar de manera independiente cada RSS/Atom habilitado. Una fuente caída
   queda registrada como error y no detiene las demás. La corrida solo falla si
   no alcanza el mínimo configurable de fuentes válidas.
3. Normalizar título y descripción del feed y buscar frases completas de la
   lista configurable, sin distinguir mayúsculas ni tildes. No se descarga ni
   almacena el texto completo de los artículos.
4. Canonicalizar la URL eliminando fragmentos y parámetros de seguimiento
   configurables. El identificador estable es el SHA-256 de esa URL canónica.
5. Descartar candidatos cuyo identificador o URL canónica ya exista, tanto en el
   archivo publicado como entre fuentes de la misma corrida.
6. Enviar cada candidato nuevo al endpoint Chat Completions compatible con
   OpenAI definido en CONFIG, solicitando `response_format: json_object`. El
   modelo recibe únicamente metadatos y el extracto breve provisto por el feed;
   debe devolver título, fuente, fecha, URL, una paráfrasis de 1–2 líneas y uno
   de los temas configurados.
7. Validar la respuesta y construir la entrada pública con los campos canónicos
   del feed, el resumen y tema del modelo, `oculto: false`, fecha de ingesta y la
   palabra clave que produjo la selección.
8. Ante HTTP 429 o códigos de límite del proveedor, reintentar con backoff
   exponencial configurable. Si persiste, registrar y saltar solo ese ítem. Los
   rate-limits no detienen la corrida ni impiden publicar otras entradas.
9. Escribir de forma atómica el JSON solo si hay novedades. Los errores de una
   noticia se reportan y permiten publicar las demás. La política ante el fallo
   de todos los candidatos también es configurable y parte desactivada para que
   un límite temporal del proveedor gratuito no tumbe el Action.
10. El workflow agrega exclusivamente la ruta de salida resuelta desde la
   configuración, crea un commit del bot y hace `pull --rebase` antes de enviar
   `HEAD:main`. Un grupo de concurrencia evita dos corridas simultáneas del
   agente.

## Contrato de datos

```json
{
  "schema_version": 1,
  "actualizado_en": "2026-09-05T12:00:00Z",
  "noticias": [
    {
      "id": "sha256-de-url-canonica",
      "titulo": "Título publicado por el medio",
      "fuente": "Medio",
      "fecha_publicacion": "2026-09-05T10:30:00Z",
      "url": "https://medio.example/noticia",
      "resumen": "Paráfrasis breve generada a partir del RSS.",
      "tema": "siniestro",
      "oculto": false,
      "fecha_ingesta": "2026-09-05T12:00:00Z",
      "palabra_clave": "choque"
    }
  ]
}
```

`oculto` es una decisión editorial manual. El pipeline no vuelve a escribir una
entrada ya conocida, por lo que cambiarlo a `true` permanece intacto en corridas
posteriores.

## Seguridad, derechos y operación

- `HEMEROTECA_AI_API_KEY` se obtiene únicamente de GitHub Actions Secrets. El
  nombre de la variable es configurable y genérico para poder cambiar de
  proveedor sin modificar el workflow; ninguna credencial se guarda en el
  repositorio.
- El proveedor inicial es Z.AI y el modelo `glm-4.7-flash`. Al 2026-09-05, Z.AI
  lo identifica como la variante Flash gratuita vigente y mantiene también
  `glm-4.5-flash` como gratuito. `GLM-5.3-Flash` es más reciente, pero tiene
  tarifa, por lo que no cumple el presupuesto cero. Referencias oficiales:
  [catálogo de modelos](https://docs.z.ai/guides/overview/overview),
  [precios](https://docs.z.ai/guides/overview/pricing) y
  [Chat Completions](https://docs.z.ai/api-reference/llm/chat-completion).
- La documentación pública no publica un límite diario numérico universal; lo
  remite al panel de rate-limits de cada API key. CONFIG conserva 1.000
  solicitudes/día como referencia de planificación aportada por REDSA, no como
  garantía del proveedor. Cada reporte registra solicitudes HTTP, éxitos,
  rate-limits, tokens, porcentaje de esa referencia y costo estimado.
- El bloque `budget` exige tarifas configuradas de entrada y salida iguales a
  cero. Si se cambia de proveedor/modelo, se debe verificar primero su tarifa y
  actualizar las referencias sin tocar la lógica del script.
- Solo se publica título, paráfrasis corta y enlace al original. El prompt
  prohíbe citas extensas y el script limita la longitud final del resumen.
- La salida está dentro de `docs/data/`, igual que el catálogo vigente. Al
  servirse desde el mismo origen de GitHub Pages, el futuro frontend no requerirá
  CORS de terceros.
- El modo `--dry-run` no modifica archivos. La combinación de fixture local y
  extractor simulado solo está permitida en dry-run y permite verificar el flujo
  sin una clave ni costo de API.

## Verificación prevista antes del primer dato real

- Ejecutar los tests unitarios, incluido el mismo feed dos veces contra un
  destino temporal, para comprobar deduplicación e invariancia de `oculto`.
- Confirmar que una noticia con “accidente” en contexto no vial no coincide con
  la frase configurada “accidente de tránsito”.
- Ejecutar el CLI en dry-run con un RSS fixture y extractor simulado, e
  inspeccionar las entradas proyectadas antes de cualquier commit de datos.
- Confirmar en el reporte que el dry-run hizo cero solicitudes al modelo, tuvo
  cero eventos de rate-limit y costo estimado USD 0.
- Parsear `docs/data/hemeroteca.json` con un lector JSON independiente y validar
  que su ruta pública comparte origen con los demás archivos de `docs/data/`.
