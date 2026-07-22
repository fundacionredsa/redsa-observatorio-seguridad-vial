"""Agrega fallecidos EDG parroquiales a cantones y provincias.

Contrato de entrada verificado en ``parroquias_wgs84.geojson``:

* Identificadores: ``DPA_PARROQ``, ``DPA_CANTON`` y ``DPA_PROVIN``.
* Conteos anuales: ``fallecidos_por_anio``.
* Auditoria de asignacion: ``resolucion_parroquial_por_anio``.

La auditoria de asignacion no es un indicador de disponibilidad: un conteo cero
es un dato valido. Un anio se considera sin dato solo cuando la clave anual no
existe, su valor es nulo o existe un estado explicito ``sin_dato``/``no_resuelto``.
"""

from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from copy import deepcopy
from pathlib import Path
from typing import Any


# CONFIG editable
ROOT = Path(__file__).resolve().parents[1]
PARROQUIAS_PATH = ROOT / "docs" / "data" / "parroquias_wgs84.geojson"
CANTONES_PATH = ROOT / "docs" / "data" / "cantones_wgs84.geojson"
PROVINCIAS_PATH = ROOT / "docs" / "data" / "provincias_wgs84.geojson"
YEARS = ("2021", "2022", "2023", "2024")
SOURCE_FIELD = "fallecidos_por_anio"
OUTPUT_FIELD = "fallecidos_parroquial"
COVERAGE_FIELD = "fallecidos_cobertura_pct"
STATUS_FIELDS = ("fallecidos_estado_por_anio", "estado_por_anio")
MISSING_STATES = {"sin_dato", "no_resuelto", "no_disponible"}


def load_geojson(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_schema(payload: dict[str, Any]) -> None:
    required = {"DPA_PARROQ", "DPA_CANTON", "DPA_PROVIN", SOURCE_FIELD}
    for index, feature in enumerate(payload.get("features", [])):
        properties = feature.get("properties") or {}
        missing = sorted(required - properties.keys())
        if missing:
            raise ValueError(f"Parroquia #{index} sin campos requeridos: {', '.join(missing)}")


def annual_value(properties: dict[str, Any], year: str) -> int | float | None:
    for field in STATUS_FIELDS:
        state = (properties.get(field) or {}).get(year)
        if isinstance(state, dict):
            state = state.get("estado")
        if str(state or "").strip().lower() in MISSING_STATES:
            return None

    annual = properties.get(SOURCE_FIELD) or {}
    if year not in annual or annual[year] is None:
        return None
    value = annual[year]
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"Valor anual invalido para {properties.get('DPA_PARROQ')}.{year}: {value!r}")
    if value < 0:
        raise ValueError(f"Conteo negativo para {properties.get('DPA_PARROQ')}.{year}: {value}")
    return value


def aggregate_parishes(
    parishes: list[dict[str, Any]],
    group_field: str,
    years: tuple[str, ...] = YEARS,
) -> dict[str, dict[str, Any]]:
    totals: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    available: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    group_sizes: dict[str, int] = defaultdict(int)

    for feature in parishes:
        properties = feature.get("properties") or {}
        group_code = str(properties.get(group_field) or "")
        if not group_code:
            raise ValueError(f"Parroquia {properties.get('DPA_PARROQ')} sin {group_field}")
        group_sizes[group_code] += 1
        for year in years:
            value = annual_value(properties, year)
            if value is None:
                continue
            totals[group_code][year] += value
            available[group_code][year] += 1

    result: dict[str, dict[str, Any]] = {}
    for group_code, unit_count in group_sizes.items():
        values: dict[str, int | float | None] = {}
        coverage: dict[str, float] = {}
        for year in years:
            available_count = available[group_code][year]
            value = totals[group_code][year] if available_count else None
            values[year] = int(value) if value is not None and float(value).is_integer() else value
            coverage[year] = round(available_count / unit_count * 100, 2)
        result[group_code] = {
            OUTPUT_FIELD: values,
            COVERAGE_FIELD: coverage,
            "unidades_total": unit_count,
            "unidades_con_dato": dict(available[group_code]),
        }
    return result


def merge_aggregates(
    payload: dict[str, Any],
    code_field: str,
    aggregates: dict[str, dict[str, Any]],
    years: tuple[str, ...] = YEARS,
) -> dict[str, Any]:
    result = deepcopy(payload)
    seen: set[str] = set()
    for feature in result.get("features", []):
        properties = feature.get("properties") or {}
        code = str(properties.get(code_field) or "")
        aggregate = aggregates.get(code)
        if aggregate is None:
            properties[OUTPUT_FIELD] = {year: None for year in years}
            properties[COVERAGE_FIELD] = {year: 0.0 for year in years}
            continue
        properties[OUTPUT_FIELD] = aggregate[OUTPUT_FIELD]
        properties[COVERAGE_FIELD] = aggregate[COVERAGE_FIELD]
        seen.add(code)
    return result


def find_orphan_groups(
    payload: dict[str, Any],
    code_field: str,
    aggregates: dict[str, dict[str, Any]],
) -> list[str]:
    target_codes = {
        str((feature.get("properties") or {}).get(code_field) or "")
        for feature in payload.get("features", [])
    }
    orphan_codes = sorted(set(aggregates) - target_codes)
    nonzero = {
        code: aggregates[code][OUTPUT_FIELD]
        for code in orphan_codes
        if any((value or 0) != 0 for value in aggregates[code][OUTPUT_FIELD].values())
    }
    if nonzero:
        raise ValueError(f"Grupos sin geometria {code_field} con fallecidos: {nonzero}")
    return orphan_codes


def sum_level(payload: dict[str, Any], year: str) -> float:
    return sum(
        (feature.get("properties") or {}).get(OUTPUT_FIELD, {}).get(year) or 0
        for feature in payload.get("features", [])
    )


def validate_reconciliation(
    parishes: dict[str, Any],
    cantons: dict[str, Any],
    provinces: dict[str, Any],
    years: tuple[str, ...] = YEARS,
) -> list[dict[str, Any]]:
    report = []
    for year in years:
        parish_total = sum(
            annual_value(feature.get("properties") or {}, year) or 0
            for feature in parishes.get("features", [])
        )
        canton_total = sum_level(cantons, year)
        province_total = sum_level(provinces, year)
        if parish_total != canton_total or canton_total != province_total:
            raise ValueError(
                f"No reconcilia {year}: parroquia={parish_total}, canton={canton_total}, provincia={province_total}"
            )
        report.append(
            {
                "year": year,
                "parish_total": parish_total,
                "canton_total": canton_total,
                "province_total": province_total,
            }
        )
    return report


def write_geojson(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


def run(write: bool = True) -> dict[str, Any]:
    parishes = load_geojson(PARROQUIAS_PATH)
    cantons_source = load_geojson(CANTONES_PATH)
    provinces_source = load_geojson(PROVINCIAS_PATH)
    validate_schema(parishes)

    canton_aggregates = aggregate_parishes(parishes["features"], "DPA_CANTON")
    province_aggregates = aggregate_parishes(parishes["features"], "DPA_PROVIN")
    orphan_canton_codes = find_orphan_groups(cantons_source, "DPA_CANTON", canton_aggregates)
    orphan_province_codes = find_orphan_groups(provinces_source, "DPA_PROVIN", province_aggregates)
    cantons = merge_aggregates(cantons_source, "DPA_CANTON", canton_aggregates)
    provinces = merge_aggregates(provinces_source, "DPA_PROVIN", province_aggregates)
    reconciliation = validate_reconciliation(parishes, cantons, provinces)

    metadata = {
        "fuente": "docs/data/parroquias_wgs84.geojson",
        "dataset": "INEC EDG, fallecidos por accidentes de transporte terrestre CIE-10 V01-V89",
        "campo_origen": SOURCE_FIELD,
        "campo_publicado": OUTPUT_FIELD,
        "anios": list(YEARS),
        "metodo": "Suma directa por DPA_CANTON y DPA_PROVIN; sin imputacion ni mezcla con otras fuentes.",
        "regla_cobertura": "Una parroquia se excluye del denominador disponible solo si falta el valor anual, es nulo o tiene estado explicito sin_dato/no_resuelto.",
        "grupos_sin_geometria_publicada_y_sin_fallecidos": {
            "cantones": orphan_canton_codes,
            "provincias": orphan_province_codes,
        },
    }
    cantons.setdefault("metadata", {})["fallecidos_parroquial_agregado"] = metadata
    provinces.setdefault("metadata", {})["fallecidos_parroquial_agregado"] = metadata

    if write:
        write_geojson(CANTONES_PATH, cantons)
        write_geojson(PROVINCIAS_PATH, provinces)

    return {
        "years": reconciliation,
        "canton_groups_in_source": len(canton_aggregates),
        "province_groups_in_source": len(province_aggregates),
        "published_cantons": len(cantons["features"]),
        "published_provinces": len(provinces["features"]),
        "partial_canton_years": sum(
            value < 100
            for feature in cantons["features"]
            for value in feature["properties"][COVERAGE_FIELD].values()
        ),
        "partial_province_years": sum(
            value < 100
            for feature in provinces["features"]
            for value in feature["properties"][COVERAGE_FIELD].values()
        ),
        "orphan_canton_codes": orphan_canton_codes,
        "orphan_province_codes": orphan_province_codes,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Valida y reconcilia sin escribir archivos")
    args = parser.parse_args()
    print(json.dumps(run(write=not args.check), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
