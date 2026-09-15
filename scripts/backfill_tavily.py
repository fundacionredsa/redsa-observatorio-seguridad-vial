#!/usr/bin/env python3
"""
Backfill de hemeroteca con Tavily API.
Busca noticias de seguridad vial en Ecuador para el rango de fechas indicado
y las agrega a docs/data/hemeroteca.json respetando dedup existente.

Uso:
    export TAVILY_API_KEY="tvly-..."
    python scripts/backfill_tavily.py

Config:
    Editar el bloque CONFIG antes de correr.
"""

import json
import os
import sys
import time
import hashlib
import datetime
from pathlib import Path
from urllib.parse import urlsplit

from actualizar_hemeroteca import es_url_articulo, extract_article_metadata, parse_date

# ─── CONFIG ───────────────────────────────────────────────────────────────────
HEMEROTECA_PATH = Path("docs/data/hemeroteca.json")
FECHA_INICIO = "2026-08-01"      # inclusive
FECHA_FIN    = "2026-09-15"      # inclusive (ajustar a hoy si se corre más tarde)
DIAS_BUSQUEDA = 50               # días hacia atrás desde hoy (cubre ago-sep)
MAX_RESULTS_POR_QUERY = 20
SIMILARIDAD_MINIMA = 85          # umbral rapidfuzz para dedup semántico
ARTICLE_METADATA_TIMEOUT_SECONDS = 8
ARTICLE_METADATA_USER_AGENT = "Mozilla/5.0 (compatible; REDSA-Observatorio/1.0)"
DOMINIOS_EC = [
    "elcomercio.com", "primicias.ec", "eluniverso.com", "expreso.ec",
    "ecuavisa.com", "teleamazonas.com", "ecu911.gob.ec",
    "transito.gob.ec", "amt.gob.ec", "eldiario.ec", "lahora.com.ec"
]
DOMINIOS_EXCLUIR = {"youtube.com", "youtu.be", "instagram.com", "facebook.com"}
QUERIES = [
    "accidente tránsito Ecuador agosto septiembre 2026",
    "siniestro vial Quito 2026",
    "atropello Ecuador 2026",
    "fallecidos accidente carretera Ecuador 2026",
    "seguridad vial Ecuador noticias",
    "muertos accidente Ecuador",
    "colisión vehículo Ecuador",
    "velocidad imprudente Ecuador accidente",
]
# ─────────────────────────────────────────────────────────────────────────────

def extraer_dominio(url: str) -> str:
    try:
        return (urlsplit(url).hostname or "desconocido").removeprefix("www.")
    except Exception:
        return "desconocido"

def sha256_url(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()

def cargar_hemeroteca() -> dict:
    with open(HEMEROTECA_PATH, encoding="utf-8") as f:
        return json.load(f)

def guardar_hemeroteca(data: dict) -> None:
    data["actualizado_en"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(HEMEROTECA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def dedup_semantico(titulo_nuevo: str, titulos_existentes: list) -> bool:
    """Retorna True si el título es duplicado semántico."""
    try:
        from rapidfuzz import fuzz
        return any(fuzz.token_sort_ratio(titulo_nuevo, t) >= SIMILARIDAD_MINIMA for t in titulos_existentes)
    except ImportError:
        return False

def fecha_en_rango(fecha_str: str) -> bool:
    """Retorna True si la fecha está en el rango configurado."""
    if not fecha_str:
        return True  # sin fecha: incluir por defecto
    try:
        # Tavily puede devolver formato ISO o solo fecha
        fecha = fecha_str[:10]  # YYYY-MM-DD
        return FECHA_INICIO <= fecha <= FECHA_FIN
    except Exception:
        return True

def buscar_tavily(api_key: str) -> list:
    from tavily import TavilyClient
    client = TavilyClient(api_key=api_key)
    resultados = []
    for i, query in enumerate(QUERIES):
        print(f"[{i+1}/{len(QUERIES)}] Query: {query}")
        try:
            resp = client.search(
                query=query,
                search_depth="advanced",
                include_domains=DOMINIOS_EC,
                max_results=MAX_RESULTS_POR_QUERY,
                include_answer=False,
                days=DIAS_BUSQUEDA
            )
            items = resp.get("results", [])
            print(f"  → {len(items)} resultados")
            resultados.extend(items)
            time.sleep(2)  # respetar rate limit
        except Exception as e:
            print(f"  ✗ Error: {e}")
    return resultados

def generar_id(url: str) -> str:
    return "bkf_" + sha256_url(url)[:12]

def main():
    api_key = os.environ.get("TAVILY_API_KEY", "").strip()
    if not api_key:
        print("✗ TAVILY_API_KEY no encontrada en variables de entorno")
        print("  Ejecuta: export TAVILY_API_KEY='tvly-...'")
        sys.exit(1)

    print(f"▶ Backfill Tavily: {FECHA_INICIO} → {FECHA_FIN}")
    print(f"  Dominios EC: {len(DOMINIOS_EC)} | Queries: {len(QUERIES)}")

    # Cargar hemeroteca existente
    data = cargar_hemeroteca()
    urls_existentes = {n["url"] for n in data["noticias"]}
    hashes_existentes = {n.get("id", "") for n in data["noticias"]}
    titulos_existentes = [n["titulo"] for n in data["noticias"] if n.get("titulo")]
    total_inicial = len(data["noticias"])
    print(f"  Noticias actuales: {total_inicial}")

    # Buscar en Tavily
    resultados_raw = buscar_tavily(api_key)
    print(f"\n▶ {len(resultados_raw)} resultados crudos obtenidos")

    # Filtrar y deduplicar
    nuevas = 0
    omitidas_url = 0
    omitidas_fecha = 0
    omitidas_dedup = 0

    for item in resultados_raw:
        url = item.get("url", "")
        titulo = item.get("title", "").strip()
        fecha_raw = item.get("published_date", "")

        if not url or not titulo:
            continue

        # Excluir páginas de etiqueta, categoría, búsqueda o paginación.
        if not es_url_articulo(url):
            continue

        # Dedup por URL
        if url in urls_existentes:
            omitidas_url += 1
            continue

        # Dedup semántico por título
        if dedup_semantico(titulo, titulos_existentes):
            omitidas_dedup += 1
            continue

        # Excluir resultados de plataformas sociales o de video.
        dominio = extraer_dominio(url)
        if dominio in DOMINIOS_EXCLUIR:
            continue

        # La fecha del artículo tiene prioridad sobre la fecha devuelta por Tavily.
        metadata = extract_article_metadata(
            url,
            ARTICLE_METADATA_TIMEOUT_SECONDS,
            ARTICLE_METADATA_USER_AGENT,
        )
        fecha_articulo = metadata.get("published_at")
        fecha_tavily = parse_date(fecha_raw)
        fecha_verificada = fecha_articulo or fecha_tavily
        fecha_referencial = fecha_verificada is None
        if fecha_verificada:
            fecha_pub = fecha_verificada.astimezone(datetime.timezone.utc).strftime("%Y-%m-%d")
            fuente_fecha = metadata.get("date_source") or "tavily"
        else:
            fecha_pub = FECHA_FIN
            fuente_fecha = "referencial_backfill"

        # Filtro de rango después de consultar la fecha real del artículo.
        if not fecha_en_rango(fecha_pub):
            omitidas_fecha += 1
            continue

        noticia = {
            "id": generar_id(url),
            "titulo": titulo,
            "fuente": dominio,
            "fecha_publicacion": fecha_pub,
            "url": url,
            "resumen": item.get("content", "")[:300].strip(),
            "tema": "otro",          # sin clasificación IA en backfill
            "oculto": False,
            "imagen_og": metadata.get("image_url"),
            "fecha_ingesta": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "palabra_clave": "backfill_tavily",
            "fecha_referencial": fecha_referencial,
            "fuente_fecha": fuente_fecha,
        }

        data["noticias"].append(noticia)
        urls_existentes.add(url)
        titulos_existentes.append(titulo)
        nuevas += 1

    # Guardar
    if nuevas > 0:
        # Ordenar por fecha_publicacion desc
        data["noticias"].sort(key=lambda n: n.get("fecha_publicacion", ""), reverse=True)
        guardar_hemeroteca(data)
        print(f"\n✔ {nuevas} noticias nuevas agregadas")
    else:
        print(f"\n— Sin noticias nuevas para agregar")

    print(f"  Omitidas por URL duplicada: {omitidas_url}")
    print(f"  Omitidas por fecha fuera de rango: {omitidas_fecha}")
    print(f"  Omitidas por similitud semántica: {omitidas_dedup}")
    print(f"  Total noticias en hemeroteca: {total_inicial + nuevas}")

if __name__ == "__main__":
    main()
