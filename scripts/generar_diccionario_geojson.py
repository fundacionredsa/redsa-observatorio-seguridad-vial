"""Genera un inventario exhaustivo de campos observados en los GeoJSON."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "docs" / "data"
OUTPUT = ROOT / "documentacion" / "diccionario_campos.csv"


def type_name(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def flatten(value: dict[str, Any], prefix: str = "") -> Iterable[tuple[str, Any]]:
    for key, child in value.items():
        path = f"{prefix}.{key}" if prefix else key
        yield path, child
        if isinstance(child, dict):
            yield from flatten(child, path)


def describe(path: str) -> tuple[str, str, str]:
    rules = [
        ("DPA_PROVIN", "Codigo DPA provincial", "codigo", "INEC/CONALI"),
        ("DPA_DESPRO", "Nombre de provincia", "texto", "INEC/CONALI"),
        ("DPA_CANTON", "Codigo DPA cantonal", "codigo", "INEC/CONALI"),
        ("DPA_DESCAN", "Nombre de canton", "texto", "INEC/CONALI"),
        ("DPA_PARROQ", "Codigo DPA parroquial", "codigo", "INEC 2014"),
        ("DPA_DESPAR", "Nombre de parroquia", "texto", "INEC 2014"),
        ("poblacion_por_anio", "Poblacion proyectada para el ano indicado", "habitantes", "INEC"),
        ("poblacion", "Poblacion proyectada", "habitantes", "INEC"),
        ("siniestros_historico", "Siniestros del ano resueltos territorialmente", "eventos", "INEC ESTRA"),
        ("inec_resumen_historico", "Resumen anual de siniestros/victimas", "conteo", "INEC ESTRA"),
        ("inec_por_clase", "Siniestros por clase y ano", "eventos", "INEC ESTRA"),
        ("inec_por_causa", "Siniestros por causa probable y ano", "eventos", "INEC ESTRA"),
        ("inec_urbano_rural", "Siniestros por zona y ano", "eventos", "INEC ESTRA"),
        ("inec_patron_horario", "Siniestros por franja horaria y ano", "eventos", "INEC ESTRA"),
        ("fallecidos_historico", "Fallecidos CIE-10 V01-V89 por ano", "personas", "INEC EDG"),
        ("fallecidos_detallado", "Fallecidos EDG por categoria demografica", "personas", "INEC EDG"),
        ("sppat_", "Fallecidos SPPAT por categoria/ano", "personas", "SPPAT"),
        ("fallecidos_sppat", "Fallecidos SPPAT acumulados", "personas", "SPPAT"),
        ("vehiculos_matriculados", "Vehiculos por residencia del propietario", "vehiculos", "INEC ESTRA 2024"),
        ("tasa_", "Tasa calculada; consultar metodologia para formula", "tasa", "Derivado REDSA"),
        ("calidad_", "Bandera de calidad/disponibilidad", "categoria", "Derivado REDSA"),
        ("cobertura_datos", "Cobertura del agregado provincial", "metadato", "Derivado REDSA"),
        ("hotspot_gi", "Resultado Getis-Ord Gi* por ano", "estadistico/categoria", "Derivado REDSA"),
        ("local_moran", "Resultado Local Moran por ano", "estadistico/categoria", "Derivado REDSA"),
        ("fallecidos_2021_2024", "Fallecidos EDG acumulados 2021-2024", "personas", "INEC EDG"),
        ("fallecidos_por_anio", "Fallecidos EDG parroquiales por ano", "personas", "INEC EDG"),
        ("osm_id", "Identificador del objeto OpenStreetMap", "identificador", "OpenStreetMap"),
        ("attribution", "Atribucion requerida por la fuente", "texto", "OpenStreetMap"),
    ]
    for token, meaning, unit, source in rules:
        if token in path:
            return meaning, unit, source
    if path in {"name", "highway", "cycleway", "sidewalk", "crossing", "traffic_calming", "junction", "lit", "maxspeed", "lanes_bus"}:
        return f"Valor del tag OSM {path}", "texto", "OpenStreetMap"
    if path in {"corridor_key", "priority"}:
        return "Clasificacion interna del corredor REDSA", "texto", "Fundacion REDSA"
    return "Campo observado; ver diccionario metodologico", "segun campo", "Ver procedencia de la capa"


def main() -> None:
    records: dict[tuple[str, str], dict[str, Any]] = {}
    for source in sorted(DATA_DIR.glob("*.geojson")):
        data = json.loads(source.read_text(encoding="utf-8"))
        for feature in data.get("features", []):
            for field, value in flatten(feature.get("properties") or {}):
                key = (source.name, field)
                record = records.setdefault(
                    key,
                    {"types": set(), "nullable": False, "example": None},
                )
                record["types"].add(type_name(value))
                record["nullable"] = record["nullable"] or value is None
                if record["example"] is None and value is not None and not isinstance(value, (dict, list)):
                    record["example"] = value

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["archivo", "campo_json", "tipo_observado", "nullable", "significado", "unidad", "fuente", "ejemplo_real"],
        )
        writer.writeheader()
        for (filename, field), record in sorted(records.items()):
            meaning, unit, source = describe(field)
            writer.writerow(
                {
                    "archivo": filename,
                    "campo_json": field,
                    "tipo_observado": "/".join(sorted(record["types"])),
                    "nullable": "si" if record["nullable"] else "no",
                    "significado": meaning,
                    "unidad": unit,
                    "fuente": source,
                    "ejemplo_real": record["example"],
                }
            )
    print(f"Generado {OUTPUT} con {len(records)} campos observados")


if __name__ == "__main__":
    main()
