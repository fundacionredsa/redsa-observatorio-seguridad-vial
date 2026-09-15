#!/usr/bin/env python3
"""Rescata una sola vez las fechas reales de las noticias del backfill Tavily."""

from __future__ import annotations

import copy
import json
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from actualizar_hemeroteca import atomic_write_json, extract_article_metadata


# CONFIG: parámetros editables de esta corrección histórica puntual.
REPO_ROOT = Path(__file__).resolve().parents[1]
CONFIG = {
    "archive_path": REPO_ROOT / "docs" / "data" / "hemeroteca.json",
    "pipeline_config_path": REPO_ROOT / "config" / "hemeroteca.json",
    "backfill_marker_field": "palabra_clave",
    "backfill_marker_value": "backfill_tavily",
    "only_backfill_entries": False,
    "request_timeout_seconds": 8,
    "max_workers": 4,
    "minimum_publication_year": 2000,
    "visible_year_min": 2024,
    "visible_year_max": 2026,
    "reference_date": "2026-09-01",
    "non_article_path_fragments": ["/tag/", "/tema/", "/temas/", "/topic/"],
}


def valid_real_date(value: Any, now: datetime) -> datetime | None:
    if not isinstance(value, datetime):
        return None
    normalized = value.astimezone(timezone.utc)
    if normalized.year < CONFIG["minimum_publication_year"] or normalized > now:
        return None
    return normalized


def domain(url: str) -> str:
    return (urlsplit(url).hostname or "desconocido").removeprefix("www.")


def main() -> int:
    archive_path: Path = CONFIG["archive_path"]
    pipeline_config = json.loads(
        Path(CONFIG["pipeline_config_path"]).read_text(encoding="utf-8")
    )
    user_agent = pipeline_config["ingestion"]["og_image_user_agent"]
    archive = json.loads(archive_path.read_text(encoding="utf-8"))
    updated = copy.deepcopy(archive)
    entries = updated["noticias"]
    selected = [
        (index, entry)
        for index, entry in enumerate(entries)
        if not CONFIG["only_backfill_entries"]
        or entry.get(CONFIG["backfill_marker_field"]) == CONFIG["backfill_marker_value"]
    ]
    now = datetime.now(timezone.utc)

    print(f"Noticias totales: {len(entries)}")
    print(f"Noticias históricas a verificar: {len(selected)}")

    results: dict[int, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=CONFIG["max_workers"]) as executor:
        futures = {
            executor.submit(
                extract_article_metadata,
                entry["url"],
                CONFIG["request_timeout_seconds"],
                user_agent,
            ): (index, entry)
            for index, entry in selected
        }
        completed = 0
        for future in as_completed(futures):
            index, entry = futures[future]
            try:
                results[index] = future.result()
            except Exception as error:  # defensa adicional: el extractor ya es tolerante
                results[index] = {"error": f"{type(error).__name__}: {error}"}
            completed += 1
            if completed % 20 == 0 or completed == len(selected):
                print(f"  Verificadas: {completed}/{len(selected)}")

    verified = 0
    reference = 0
    hidden_outside_range = 0
    hidden_non_articles = 0
    failures = 0
    sources = Counter()
    domains_failed = Counter()

    for index, entry in selected:
        metadata = results[index]
        article_path = urlsplit(entry["url"]).path.lower()
        is_non_article = any(
            fragment in article_path for fragment in CONFIG["non_article_path_fragments"]
        )
        if is_non_article:
            if not entry.get("oculto"):
                hidden_non_articles += 1
            entry["oculto"] = True
        published = valid_real_date(metadata.get("published_at"), now)
        if published:
            entry["fecha_publicacion"] = published.strftime("%Y-%m-%d")
            entry["fecha_referencial"] = False
            entry["fuente_fecha"] = metadata.get("date_source") or "pagina_articulo"
            verified += 1
            sources[entry["fuente_fecha"]] += 1
        else:
            existing = str(entry.get("fecha_publicacion") or "")[:10]
            try:
                existing_date = datetime.strptime(existing, "%Y-%m-%d").replace(
                    tzinfo=timezone.utc
                )
            except ValueError:
                existing_date = None
            if not existing_date or existing_date > now:
                entry["fecha_publicacion"] = CONFIG["reference_date"]
            entry["fecha_referencial"] = True
            entry["fuente_fecha"] = "referencial_backfill"
            reference += 1
            if metadata.get("error"):
                failures += 1
                domains_failed[domain(entry["url"])] += 1

        year = int(entry["fecha_publicacion"][:4])
        if year < CONFIG["visible_year_min"] or year > CONFIG["visible_year_max"]:
            if not entry.get("oculto"):
                hidden_outside_range += 1
            entry["oculto"] = True

    entries.sort(key=lambda item: item.get("fecha_publicacion", ""), reverse=True)
    updated["actualizado_en"] = now.isoformat().replace("+00:00", "Z")
    atomic_write_json(archive_path, updated)

    print(f"Fechas reales verificadas: {verified}")
    print(f"Fechas referenciales conservadas/usadas: {reference}")
    print(f"Páginas con error HTTP o timeout: {failures}")
    print(f"Noticias adicionales ocultadas por año fuera de rango: {hidden_outside_range}")
    print(f"Páginas de etiquetas/temas ocultadas: {hidden_non_articles}")
    print("Fuentes de fecha verificadas:")
    for source, count in sources.most_common():
        print(f"  {source}: {count}")
    if domains_failed:
        print("Fallos por dominio:")
        for failed_domain, count in domains_failed.most_common():
            print(f"  {failed_domain}: {count}")

    distribution = Counter(
        str(entry.get("fecha_publicacion") or "")[:7] for entry in entries
    )
    print("Distribución final por mes:")
    for month, count in sorted(distribution.items()):
        print(f"  {month}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
