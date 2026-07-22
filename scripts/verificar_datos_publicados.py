"""Verifica contratos, sumas nacionales y, opcionalmente, fuentes crudas."""

from __future__ import annotations

import csv
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "data"
OUTPUT = ROOT / "documentacion" / "evidencia_validacion.json"
RAW = Path(os.environ["REDSA_RAW_DATA_DIR"]) if os.environ.get("REDSA_RAW_DATA_DIR") else None
CIE10 = re.compile(r"^V(0[1-9]|[1-7][0-9]|8[0-9])$")


def load(name: str) -> dict[str, Any]:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def aggregate(features: list[dict[str, Any]], field: str, year: str | None = None) -> int:
    total = 0
    for feature in features:
        value = feature.get("properties", {}).get(field)
        if year is not None:
            value = (value or {}).get(year)
        if isinstance(value, (int, float)):
            total += int(value)
    return total


def raw_rows(path: Path, delimiter: str, encoding: str) -> int:
    with path.open(encoding=encoding, newline="") as handle:
        return sum(1 for _ in csv.reader(handle, delimiter=delimiter)) - 1


def edg_counts(path: Path, year: int) -> dict[str, int]:
    encodings = ["latin-1", "utf-8-sig"] if year == 2020 else ["utf-8-sig", "latin-1"]
    for encoding in encodings:
        try:
            with path.open(encoding=encoding, newline="") as handle:
                reader = csv.DictReader(handle, delimiter=";")
                total = transit = v89 = 0
                for row in reader:
                    total += 1
                    normalized = {key.upper(): key for key in row}
                    cause_key = normalized.get("CAUSA") or normalized.get("CAUSA4")
                    stem = str(row.get(cause_key, "") or "").strip().upper()[:3]
                    transit += bool(CIE10.fullmatch(stem))
                    v89 += stem == "V89"
                return {"total_edg": total, "v01_v89": transit, "v89": v89}
        except UnicodeDecodeError:
            continue
    raise UnicodeError(f"No se pudo leer {path}")


def main() -> None:
    cantons = load("cantones_wgs84.geojson")
    provinces = load("provincias_wgs84.geojson")
    parishes = load("parroquias_wgs84.geojson")
    hotspots = load("hotspots_cantonales.geojson")
    osm_report = load("osm_cobertura_reporte.json")
    result: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": "ok",
        "failures": [],
        "files": {},
        "national_controls": {},
        "raw_controls": {},
    }
    expected = {
        "cantones_wgs84.geojson": (cantons, 224),
        "provincias_wgs84.geojson": (provinces, 24),
        "parroquias_wgs84.geojson": (parishes, 1040),
        "hotspots_cantonales.geojson": (hotspots, 224),
    }
    for name, (payload, count) in expected.items():
        actual = len(payload.get("features", []))
        result["files"][name] = {
            "features": actual,
            "expected_features": count,
            "bytes": (DATA / name).stat().st_size,
            "sha256": sha256(DATA / name),
        }
        if actual != count:
            result["failures"].append(f"{name}: {actual} features; esperados {count}")

    for layer_name, layer_report in osm_report.get("capas", {}).items():
        name = layer_report["archivo"]
        payload = load(name)
        actual = len(payload.get("features", []))
        expected_count = int(layer_report["features_despues_nacional"])
        result["files"][name] = {
            "features": actual,
            "expected_features": expected_count,
            "bytes": (DATA / name).stat().st_size,
            "sha256": sha256(DATA / name),
            "alcance": (payload.get("metadata") or {}).get("alcance"),
        }
        if actual != expected_count:
            result["failures"].append(
                f"{name}: {actual} features; reporte OSM declara {expected_count}"
            )
        if result["files"][name]["alcance"] != "Ecuador nacional":
            result["failures"].append(f"{name}: alcance nacional no declarado")

    for field, years in {
        "fallecidos_historico": ["2020", "2021", "2022", "2023", "2024"],
        "siniestros_historico": ["2019", "2021", "2022", "2023", "2024"],
    }.items():
        result["national_controls"][field] = {}
        for year in years:
            canton_sum = aggregate(cantons["features"], field, year)
            province_sum = aggregate(provinces["features"], field, year)
            result["national_controls"][field][year] = {
                "canton_sum": canton_sum,
                "province_sum": province_sum,
                "match": canton_sum == province_sum,
            }
            if canton_sum != province_sum:
                result["failures"].append(f"{field}.{year}: canton {canton_sum} != provincia {province_sum}")

    result["national_controls"]["fallecidos_parroquial"] = {}
    for year in ["2021", "2022", "2023", "2024"]:
        parish_sum = aggregate(parishes["features"], "fallecidos_por_anio", year)
        canton_sum = aggregate(cantons["features"], "fallecidos_parroquial", year)
        province_sum = aggregate(provinces["features"], "fallecidos_parroquial", year)
        matches = parish_sum == canton_sum == province_sum
        result["national_controls"]["fallecidos_parroquial"][year] = {
            "parish_sum": parish_sum,
            "canton_sum": canton_sum,
            "province_sum": province_sum,
            "match": matches,
        }
        if not matches:
            result["failures"].append(
                f"fallecidos_parroquial.{year}: parroquia {parish_sum} != canton {canton_sum} != provincia {province_sum}"
            )

    vehicles = sum(
        (feature["properties"].get("vehiculos_matriculados_2024") or {}).get("total") or 0
        for feature in cantons["features"]
    )
    result["national_controls"]["vehiculos_matriculados_2024"] = vehicles
    if vehicles != 3_138_562:
        result["failures"].append(f"Vehiculos: {vehicles}; esperado 3138562")

    sppat = sum(
        feature["properties"].get("fallecidos_sppat_2016_2021") or 0
        for feature in cantons["features"]
    )
    result["national_controls"]["fallecidos_sppat_2016_2021"] = sppat
    if sppat != 16_363:
        result["failures"].append(f"SPPAT 2016-2021: {sppat}; esperado 16363")

    if RAW and RAW.exists():
        for year, filename in {
            "2019": "inec_siniestros.csv",
            "2021": "inec_siniestros_2021.csv",
            "2022": "inec_siniestros_2022.csv",
            "2023": "inec_siniestros_2023.csv",
            "2024": "inec_siniestros_2024.csv",
        }.items():
            path = RAW / filename
            rows = raw_rows(path, ";", "utf-8-sig")
            published = aggregate(cantons["features"], "siniestros_historico", year)
            result["raw_controls"][f"siniestros_{year}"] = {
                "raw_rows": rows, "published": published, "unresolved": rows - published
            }
        for year in range(2020, 2025):
            counts = edg_counts(RAW / f"edg_{year}.csv", year)
            published = aggregate(cantons["features"], "fallecidos_historico", str(year))
            result["raw_controls"][f"edg_{year}"] = {
                **counts, "published": published, "difference": counts["v01_v89"] - published
            }

    if result["failures"]:
        result["status"] = "failed"
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if result["failures"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
