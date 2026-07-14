# redsa-observatorio-seguridad-vial
Pipelines de datos y geoportal del Observatorio Ciudadano de Seguridad Vial - Fundación REDSA

## Geoportal

El geoportal del Observatorio se encuentra en el directorio `/docs`. Está desarrollado utilizando HTML, CSS (Vanilla) y JavaScript puro, sin herramientas de compilación externas, para facilitar su despliegue directo en **GitHub Pages**.

### Características
- **Biblioteca de mapas**: Leaflet.js (v1.9.4) vía CDN.
- **Mapa base**: CartoDB Positron, CartoDB Dark Matter y OpenStreetMap.
- **Capas cargadas**: Límites cantonales de Ecuador (`docs/data/cantones_wgs84.geojson`).
- **Interactividad**: Hover con resaltado y actualización dinámica de panel lateral de información, popups de consulta al hacer clic en los cantones.
- **Atribución**: Atribución obligatoria de límites cantonales a INEC/CONALI vía datosabiertos.gob.ec, bajo licencia CC-BY.

### Desarrollo y Visualización Local
Para abrir el geoportal localmente y evitar problemas de CORS al consultar el archivo GeoJSON, inicia un servidor HTTP local en la raíz del repositorio:

```bash
# Con Python
python -m http.server 8000

# Con Node.js
npx http-server -p 8000
```

Luego abre en tu navegador:
`http://localhost:8000/docs/index.html`

