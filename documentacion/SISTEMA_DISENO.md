# Sistema de diseno actual

## Tipografia

- Titulos: Outfit, pesos 400-800, cargada desde Google Fonts.
- Interfaz: Inter, pesos 300-700.
- Fallback: `sans-serif`.

## Tokens principales

| Token | Valor | Uso |
|---|---|---|
| `--bg-glass` | `rgba(15,23,42,.85)` | paneles |
| `--bg-glass-hover` | `rgba(30,41,59,.9)` | hover |
| `--text-primary` | `#f8fafc` | texto principal |
| `--text-secondary` | `#cbd5e1` | texto secundario |
| `--text-muted` | `#94a3b8` | metadatos |
| `--accent` | `#0ea5e9` | titulos/acciones |
| `--accent-hover` | `#38bdf8` | enfasis |
| `--public-action` | `#087f8c` | busqueda y acciones ciudadanas |
| `--public-risk` | `#b8323c` | contexto de siniestralidad |
| `--citizen-panel-width` | 390 px | vista ciudadana |
| `--analysis-drawer-width` | 440 px | analisis detallado |
| `--technical-drawer-width` | 400 px | datos y capas |
| `--ui-padding` | 20 px; 10 px movil | separacion |
| `--perfil-card-max-height` | 280 px | panel demografico |

## Escala de apilamiento

Todos los componentes usan tokens declarados en `geoportal-core.css`: mapa,
controles, perfil, paneles publicos, navegacion movil, backdrop, drawers, popover
y modal. No se admiten valores numericos de `z-index` ni `!important` fuera de
esa escala sin un ADR que documente la excepcion.

## Colores cartograficos

- Limites administrativos nacionales: `#52616b`, sin distincion provincial.
- Ciclovias: `#22c55e`; aceras: `#ec4899`; cruces: `#eab308`.
- Pacificacion: `#a855f7`; semaforos/rotondas: `#f97316`.
- Iluminacion: `#e2e8f0`; velocidad: `#ef4444`; BRT: `#06b6d4`.
- Corredores REDSA: muy alta `#f43f5e`, alta `#fb923c`.
- Coropletas: cinco tonos definidos por variable en `VARIABLE_CONFIGS`; los
  cortes numericos son cuantiles dinamicos por nivel.

## Breakpoints

- `<=1024px`: ajuste intermedio desktop/tablet horizontal en
  `geoportal-core.css`.
- `<=768px`: telefono y tablet vertical; drawers superpuestos, panel ciudadano
  compacto, leyenda colapsable y objetivos tactiles de 44 px.
- `<=370px`: ajustes de telefono compacto sin retirar datos ni advertencias.

Las dos reglas moviles viven solo en `geoportal-mobile.css`, cargado al final.
No se agregan media queries equivalentes a otras hojas de estilo.

## Convenciones

- Vista ciudadana clara para lectura inmediata; paneles tecnicos oscuros para
  diferenciar la profundidad analitica.
- No introducir un color para representar datos sin definir tambien estilo y
  texto de `sin_dato`.
- Nuevas variables y capas se agregan en `geoportal-registry.js`; cada capa debe
  declarar color, leyenda, popup, cobertura y estado de precarga.
- Nuevas siglas deben reutilizar `siglaDefinitions` y `.sigla-tooltip-trigger`.
