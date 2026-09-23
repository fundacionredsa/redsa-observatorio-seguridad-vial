"""Reporta pares similares y oculta solo los IDs revisados con --apply."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from rapidfuzz import fuzz

from actualizar_hemeroteca import strip_source_suffix


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_PATH = ROOT / "docs" / "data" / "hemeroteca.json"
CONFIG_PATH = ROOT / "config" / "hemeroteca.json"
GOOGLE_PREFIX = "Google News —"


def comparison_title(entry: dict) -> str:
    title = entry["titulo"]
    source = entry.get("fuente", "")
    if source.startswith(GOOGLE_PREFIX):
        # Los registros antiguos guardaron el nombre del feed, pero el título
        # todavía conserva el nombre del medio al final.
        _, separator, editorial_source = title.rpartition(" - ")
        if separator:
            return strip_source_suffix(title, editorial_source)
    return strip_source_suffix(title, source)


def priority(entry: dict, index: int) -> tuple:
    return (
        entry.get("fuente", "").startswith(GOOGLE_PREFIX),
        entry.get("fecha_ingesta", ""),
        index,
    )


def find_duplicate_pairs(entries: list[dict], threshold: int) -> list[tuple[int, int, float]]:
    visible = [(index, entry) for index, entry in enumerate(entries) if entry.get("oculto") is False]
    pairs = []
    for position, (left_index, left) in enumerate(visible):
        left_title = comparison_title(left)
        for right_index, right in visible[position + 1 :]:
            score = fuzz.token_set_ratio(left_title, comparison_title(right))
            if score >= threshold:
                pairs.append((left_index, right_index, score))
    return pairs


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, default=ARCHIVE_PATH)
    parser.add_argument("--apply", action="store_true", help="guarda las marcas oculto:true")
    parser.add_argument(
        "--confirm-pair",
        action="append",
        default=[],
        help="par confirmado como ID_CONSERVAR:ID_OCULTAR; repetible",
    )
    args = parser.parse_args()
    if args.apply and not args.confirm_pair:
        parser.error("--apply requiere al menos un --confirm-pair revisado")
    archive = json.loads(args.archive.read_text(encoding="utf-8"))
    entries = archive["noticias"]
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    threshold = config["ingestion"]["semantic_dedup_threshold"]
    pairs = find_duplicate_pairs(entries, threshold)
    confirmed_pairs = set(args.confirm_pair)
    eligible_pairs: set[str] = set()
    hidden: set[int] = set()
    print(f"Pares candidatos (umbral {threshold}): {len(pairs)}")
    for left_index, right_index, score in pairs:
        winner = min((left_index, right_index), key=lambda index: priority(entries[index], index))
        loser = right_index if winner == left_index else left_index
        pair_key = f"{entries[winner]['id']}:{entries[loser]['id']}"
        eligible_pairs.add(pair_key)
        if pair_key in confirmed_pairs:
            hidden.add(loser)
        left, right = entries[left_index], entries[right_index]
        print(f"\n{score:.1f} | {left['id']} [{left['fuente']}] {left['titulo']}")
        print(f"       {right['id']} [{right['fuente']}] {right['titulo']}")
        decision = "CONFIRMADO" if pair_key in confirmed_pairs else "por revisar"
        print(
            f"  conservar: {entries[winner]['id']} | candidato a ocultar: "
            f"{entries[loser]['id']} ({decision})"
        )
    unknown = confirmed_pairs - eligible_pairs
    if unknown:
        parser.error(f"pares no elegibles como duplicados: {', '.join(sorted(unknown))}")
    print(f"\nRegistros confirmados para ocultar: {len(hidden)}")
    if args.apply and hidden:
        for index in hidden:
            entries[index]["oculto"] = True
        args.archive.write_text(
            json.dumps(archive, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"Cambios guardados en {args.archive}")


if __name__ == "__main__":
    main()
