"""Genera los SVG livianos del loader a partir de datos locales del geoportal.

Es un proceso offline: los SVG resultantes se versionan en ``docs/assets/img``
y el navegador nunca descarga los GeoJSON de origen para mostrar el loader.

Requiere Shapely (``python -m pip install shapely``) para recortar y unir el
contorno provincial. El trazado vial se filtra antes de simplificarse para
evitar que los miles de segmentos urbanos cortos oculten la silueta nacional.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from shapely.geometry import GeometryCollection, LineString, MultiLineString, box, shape
from shapely.ops import unary_union


CONFIG = {
    "input_roads": Path("docs/data/vias_ecuador.geojson"),
    "input_provinces": Path("docs/data/provincias_wgs84.geojson"),
    "output_roads": Path("docs/assets/img/loader-vias-principales.svg"),
    "output_contour": Path("docs/assets/img/loader-ecuador-contorno.svg"),
    # Ecuador continental. Galapagos queda fuera para que la silueta del país
    # conserve tamaño legible dentro del loader compacto.
    "ecuador_bbox": (-81.20, -5.20, -74.90, 1.80),
    "viewbox": (0, 0, 360, 400),
    "viewbox_padding": 18,
    "road_class": "principal",
    "simplification_tolerance_degrees": 0.025,
    "contour_simplification_tolerance_degrees": 0.018,
    # Los segmentos menores son principalmente fragmentos urbanos; omitirlos
    # preserva los corredores nacionales reconocibles y mantiene el SVG <50 KB.
    "minimum_segment_length_km": 4.0,
    "coordinate_precision": 1,
    "road_stroke": "#4D96C2",
    "road_stroke_width": 1.35,
    "contour_stroke": "#4D96C2",
    "contour_stroke_width": 3.2,
}


def project_point(longitude: float, latitude: float) -> tuple[float, float]:
    min_x, min_y, max_x, max_y = CONFIG["ecuador_bbox"]
    view_x, view_y, view_width, view_height = CONFIG["viewbox"]
    padding = CONFIG["viewbox_padding"]
    usable_width = view_width - (2 * padding)
    usable_height = view_height - (2 * padding)
    scale = min(usable_width / (max_x - min_x), usable_height / (max_y - min_y))
    drawing_width = (max_x - min_x) * scale
    drawing_height = (max_y - min_y) * scale
    offset_x = view_x + (view_width - drawing_width) / 2
    offset_y = view_y + (view_height - drawing_height) / 2
    return (
        offset_x + ((longitude - min_x) * scale),
        offset_y + ((max_y - latitude) * scale),
    )


def format_number(value: float) -> str:
    precision = CONFIG["coordinate_precision"]
    text = f"{value:.{precision}f}"
    return text.rstrip("0").rstrip(".") if "." in text else text


def iter_lines(geometry) -> Iterable[LineString]:
    if geometry.is_empty:
        return
    if isinstance(geometry, LineString):
        yield geometry
    elif isinstance(geometry, MultiLineString):
        yield from geometry.geoms
    elif isinstance(geometry, GeometryCollection):
        for item in geometry.geoms:
            yield from iter_lines(item)


def line_path(line: LineString) -> str:
    points = [project_point(x, y) for x, y, *_ in line.coords]
    if len(points) < 2:
        return ""
    head, *tail = points
    commands = [f"M{format_number(head[0])} {format_number(head[1])}"]
    commands.extend(f"L{format_number(x)} {format_number(y)}" for x, y in tail)
    return "".join(commands)


def polygon_path(geometry) -> str:
    polygons = [geometry] if geometry.geom_type == "Polygon" else list(geometry.geoms)
    paths: list[str] = []
    for polygon in polygons:
        rings = [polygon.exterior, *polygon.interiors]
        for ring in rings:
            points = [project_point(x, y) for x, y, *_ in ring.coords]
            if len(points) < 3:
                continue
            head, *tail = points
            commands = [f"M{format_number(head[0])} {format_number(head[1])}"]
            commands.extend(f"L{format_number(x)} {format_number(y)}" for x, y in tail)
            commands.append("Z")
            paths.append("".join(commands))
    return "".join(paths)


def svg_document(
    path_data: str, *, kind: str, path_id: str, stroke: str, stroke_width: float
) -> str:
    viewbox = " ".join(str(value) for value in CONFIG["viewbox"])
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" '
        f'role="img" aria-label="{kind}">'
        f'<path id="{path_id}" d="{path_data}" fill="none" stroke="{stroke}" '
        f'stroke-width="{stroke_width}" stroke-linecap="round" '
        f'stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'
        "</svg>\n"
    )


def generate_roads(clip_box) -> tuple[str, int]:
    with CONFIG["input_roads"].open(encoding="utf-8") as source:
        collection = json.load(source)

    paths: list[str] = []
    selected_count = 0
    for feature in collection.get("features", []):
        properties = feature.get("properties") or {}
        if properties.get("clase") != CONFIG["road_class"]:
            continue
        if float(properties.get("longitud_km") or 0) < CONFIG["minimum_segment_length_km"]:
            continue
        geometry = shape(feature.get("geometry"))
        geometry = geometry.intersection(clip_box).simplify(
            CONFIG["simplification_tolerance_degrees"], preserve_topology=False
        )
        for line in iter_lines(geometry):
            path = line_path(line)
            if path:
                paths.append(path)
                selected_count += 1
    return "".join(paths), selected_count


def generate_contour(clip_box) -> str:
    with CONFIG["input_provinces"].open(encoding="utf-8") as source:
        collection = json.load(source)
    provinces = [shape(feature["geometry"]) for feature in collection.get("features", [])]
    contour = unary_union(provinces).intersection(clip_box).simplify(
        CONFIG["contour_simplification_tolerance_degrees"], preserve_topology=True
    )
    return polygon_path(contour)


def write_svg(path: Path, content: str) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")
    return path.stat().st_size


def main() -> None:
    clip_box = box(*CONFIG["ecuador_bbox"])
    roads_path, road_count = generate_roads(clip_box)
    contour_path = generate_contour(clip_box)

    roads_size = write_svg(
        CONFIG["output_roads"],
        svg_document(
            roads_path,
            kind="Vías principales simplificadas de Ecuador",
            path_id="loader-roads-path",
            stroke=CONFIG["road_stroke"],
            stroke_width=CONFIG["road_stroke_width"],
        ),
    )
    contour_size = write_svg(
        CONFIG["output_contour"],
        svg_document(
            contour_path,
            kind="Contorno de Ecuador continental",
            path_id="loader-contour-path",
            stroke=CONFIG["contour_stroke"],
            stroke_width=CONFIG["contour_stroke_width"],
        ),
    )

    print(f"Vías exportadas: {road_count}")
    print(f"{CONFIG['output_roads']}: {roads_size / 1024:.1f} KB")
    print(f"{CONFIG['output_contour']}: {contour_size / 1024:.1f} KB")
    if roads_size >= 50 * 1024:
        raise SystemExit("El SVG vial supera 50 KB; ajusta CONFIG antes de publicarlo.")


if __name__ == "__main__":
    main()
