# Despliegue y operacion

## Desarrollo local

Requisitos: Python 3.12 y Node 24/NPM 11 para pruebas.

```powershell
git clone https://github.com/fundacionredsa/redsa-observatorio-seguridad-vial.git
cd redsa-observatorio-seguridad-vial
python -m http.server 8000
```

Abra `http://127.0.0.1:8000/docs/`.

## Pruebas frontend

```powershell
npm ci
npx playwright install chromium
npm test
npm run screenshots
```

Los resultados quedan en `test-results/` y `artifacts/screenshots/`, ignorados
por Git. Las pruebas levantan su propio servidor local.

## GitHub Pages

GitHub Pages debe configurarse para publicar `main` / `docs`. El despliegue no
requiere build. `docs/.nojekyll` fuerza la publicacion estatica directa y evita
que el despliegue dependa del generador Jekyll o de consultas de metadatos de
GitHub que no forman parte del sitio. Antes de hacer push:

```powershell
python scripts/generar_diccionario_geojson.py
python scripts/verificar_datos_publicados.py
npm test
git diff --check
```

## Automatizaciones del repositorio privado

- `agente1_extractor_noticias.yml`: lunes 12:00 UTC y ejecución manual. Puede
  usar `GOOGLE_SHEETS_CREDENTIALS_PATH`/`SHEET_ID` desde GitHub Secrets.
- `extraer_mapillary.yml`: manual, requiere `MAPILLARY_ACCESS_TOKEN`.
- Ninguna clave se escribe en archivos, logs o documentación. Los nombres de
  secrets pueden documentarse; sus valores no.

## Recuperacion

El paquete de Drive guarda un `.bundle` por repositorio. Para restaurar:

```powershell
git clone redsa-observatorio-seguridad-vial.bundle geoportal-restaurado
git clone redsa-observatorio-pipelines.bundle pipelines-restaurado
git -C geoportal-restaurado fsck --full
```

Luego compare el commit esperado y `MANIFEST_SHA256.csv`.

## Publicacion segura

1. Revisar `git status` y datos modificados.
2. Ejecutar pruebas de contrato y UI.
3. Confirmar que `mapillary_pichincha.geojson` no se presenta como disponible
   si tiene cero features.
4. Buscar secretos: `rg -n "(token|secret|api[_-]?key|password)"` y revisar
   solo nombres/configuracion, nunca valores.
5. Commit descriptivo, push y verificacion por fetch directo.
