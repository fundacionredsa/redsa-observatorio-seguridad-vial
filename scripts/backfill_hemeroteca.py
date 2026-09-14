"""
Backfill histórico de hemeroteca usando GDELT Project API.
Busca noticias de seguridad vial / movilidad en Ecuador
para un rango de fechas y las añade a docs/data/hemeroteca.json.

CONFIG: editar las variables de la sección CONFIG antes de ejecutar.
"""

import hashlib
import json
import time
from datetime import datetime, timedelta
from pathlib import Path

import requests
from rapidfuzz import fuzz


# ─── CONFIG ───────────────────────────────────────────────────────────────────

HEMEROTECA_PATH = Path("docs/data/hemeroteca.json")
FECHA_INICIO = "20260801"  # YYYYMMDD
FECHA_FIN = "20260914"  # YYYYMMDD (inclusive)
QUERIES = [
    "accidente vial Ecuador",
    "siniestro tránsito Ecuador",
    "seguridad vial Ecuador",
    "atropello Ecuador",
    "choque carretera Ecuador",
    "fallecido accidente tráfico Ecuador",
]
MAX_POR_QUERY = 250  # máx que permite GDELT por request
DELAY_ENTRE_QUERIES = 2  # segundos entre requests
UMBRAL_DEDUP = 85  # % similitud para considerar duplicado

# ──────────────────────────────────────────────────────────────────────────────

GDELT_API = "https://api.gdeltproject.org/api/v2/doc/doc"


def gdelt_buscar(
    query: str, fecha_inicio: str, fecha_fin: str, max_records: int
) -> list:
    """Llama a GDELT y retorna lista de artículos."""
    params = {
        "query": query,
        "mode": "ArtList",
        "maxrecords": max_records,
        "startdatetime": f"{fecha_inicio}000000",
        "enddatetime": f"{fecha_fin}235959",
        "format": "json",
        "sourcelang": "spanish",
    }
    try:
        response = requests.get(GDELT_API, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        return data.get("articles", [])
    except Exception as error:
        print(f"  ERROR GDELT [{query}]: {error}")
        return []


def hacer_id(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def es_duplicado_semantico(titulo: str, existentes: list, umbral: int) -> bool:
    for noticia in existentes:
        if fuzz.token_sort_ratio(titulo, noticia.get("titulo", "")) >= umbral:
            return True
    return False


def main():
    # Cargar hemeroteca existente
    with HEMEROTECA_PATH.open(encoding="utf-8") as handle:
        data = json.load(handle)
    noticias = data.get("noticias", [])
    urls_existentes = {noticia["url"] for noticia in noticias}
    print(f"Noticias existentes: {len(noticias)}")

    nuevas = []
    for query in QUERIES:
        print(f"\nBuscando: '{query}'")
        articulos = gdelt_buscar(query, FECHA_INICIO, FECHA_FIN, MAX_POR_QUERY)
        print(f"  GDELT retornó {len(articulos)} artículos")
        for articulo in articulos:
            url = articulo.get("url", "").strip()
            titulo = articulo.get("title", "").strip()
            if not url or not titulo:
                continue
            if url in urls_existentes:
                continue
            if es_duplicado_semantico(titulo, noticias + nuevas, UMBRAL_DEDUP):
                print(f"  [dedup semántico] {titulo[:60]}")
                continue
            # Construir noticia
            fecha_pub = articulo.get("seendate", "")[:8]  # YYYYMMDD
            try:
                fecha_iso = datetime.strptime(fecha_pub, "%Y%m%d").strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                )
            except ValueError:
                fecha_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
            noticia = {
                "id": hacer_id(url),
                "titulo": titulo,
                "fuente": articulo.get("domain", ""),
                "fecha_publicacion": fecha_iso,
                "url": url,
                "resumen": "",  # sin LLM en backfill inicial
                "tema": "siniestro",  # valor por defecto; revisar manualmente
                "oculto": False,
                "imagen_og": None,
                "fecha_ingesta": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "palabra_clave": query,
                "fuente_backfill": "gdelt",
            }
            nuevas.append(noticia)
            urls_existentes.add(url)
            print(f"  + {titulo[:70]}")
        time.sleep(DELAY_ENTRE_QUERIES)

    if not nuevas:
        print("\nNo se encontraron noticias nuevas.")
        return

    # Insertar ordenadas por fecha (más recientes primero)
    noticias_total = nuevas + noticias
    noticias_total.sort(
        key=lambda noticia: noticia.get("fecha_publicacion", ""), reverse=True
    )
    data["noticias"] = noticias_total
    data["actualizado_en"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    with HEMEROTECA_PATH.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(
        f"\n✓ {len(nuevas)} noticias nuevas añadidas. Total: {len(noticias_total)}"
    )


if __name__ == "__main__":
    main()
