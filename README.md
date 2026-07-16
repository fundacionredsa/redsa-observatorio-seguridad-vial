# REDSA Observatorio de Seguridad Vial

Geoportal auditable del Observatorio de Seguridad Vial y Movilidad Sostenible de
Fundacion REDSA. Publica agregados territoriales de fuentes oficiales y capas
abiertas de movilidad, sin datos personales de victimas.

- Sitio: https://fundacionredsa.github.io/redsa-observatorio-seguridad-vial/
- Estado documentado: 2026-07-16.
- Documentacion: [guia por rol](documentacion/README.md).
- Datos: [diccionario](documentacion/DICCIONARIO_DATOS.md),
  [metodologia](documentacion/METODOLOGIA.md) y
  [procedencia](documentacion/FUENTES_Y_PROCEDENCIA.md).
- Ingenieria: [arquitectura](documentacion/ARQUITECTURA.md),
  [ADR](documentacion/adr/README.md), [despliegue](documentacion/DESPLIEGUE_Y_OPERACION.md)
  y [problemas conocidos](documentacion/PROBLEMAS_CONOCIDOS.md).

## Inicio local

```powershell
git clone https://github.com/fundacionredsa/redsa-observatorio-seguridad-vial.git
cd redsa-observatorio-seguridad-vial
python -m http.server 8000
```

Abra `http://127.0.0.1:8000/docs/`.

## Verificacion

```powershell
npm ci
npx playwright install chromium
python -m unittest discover -s tests_python -v
python scripts/generar_diccionario_geojson.py
python scripts/verificar_datos_publicados.py
npm test
```

Para conciliar contra las fuentes crudas, configure `REDSA_RAW_DATA_DIR` antes
de ejecutar el verificador. Sin esa variable se validan contratos y sumas entre
capas publicadas.

## Estructura

```text
docs/                 sitio y GeoJSON publicados por GitHub Pages
documentacion/        metodologia, diccionario, ADR y evidencia
scripts/              verificadores y captura de matriz visual
tests/                pruebas Playwright
tests_python/         contratos de datos sin dependencias externas
```

## Licencias y privacidad

Codigo: [MIT](LICENSE). Datos/atribuciones: [LICENSE-DATA.md](LICENSE-DATA.md).
Las capas OSM conservan ODbL y las fuentes oficiales sus condiciones de origen.
Los repositorios no contienen microdatos EDG, SPPAT o ESTRA ni credenciales.
