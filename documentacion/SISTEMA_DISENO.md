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
| `--sidebar-width` | 440 px; 380 px <=1024; 0 <=768 | layout |
| `--ui-padding` | 20 px; 10 px movil | separacion |
| `--perfil-card-max-height` | 280 px | panel demografico |

## Colores cartograficos

- Pichincha: `#0ea5e9`; resto: `#94a3b8`.
- Ciclovias: `#22c55e`; aceras: `#ec4899`; cruces: `#eab308`.
- Pacificacion: `#a855f7`; semaforos/rotondas: `#f97316`.
- Iluminacion: `#e2e8f0`; velocidad: `#ef4444`; BRT: `#06b6d4`.
- Corredores REDSA: muy alta `#f43f5e`, alta `#fb923c`.
- Coropletas: cinco tonos definidos por variable en `VARIABLE_CONFIGS`; los
  cortes numericos son cuantiles dinamicos por nivel.

## Breakpoints

- `<=1024px`: sidebar 380 px.
- `<=768px`: layout de una columna, controles compactos, sidebar-width 0 y
  panel demografico a todo el ancho disponible.

## Convenciones

- Paneles flotantes con fondo oscuro translucido, borde de 1 px y radio 8-16.
- No introducir un color para representar datos sin definir tambien estilo y
  texto de `sin_dato`.
- Nuevas capas deben registrar color, atribucion, leyenda, popup y estado
  inicial en el mismo cambio.
- Nuevas siglas deben reutilizar `siglaDefinitions` y `.sigla-tooltip-trigger`.
