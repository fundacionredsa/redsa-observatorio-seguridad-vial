import copy
import json
import os
import unittest
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

from scripts.actualizar_hemeroteca import (
    CompatibleChatExtractor,
    FeedItem,
    MockExtractor,
    canonicalize_url,
    execute_pipeline,
    match_keyword,
    parse_article_metadata_html,
    parse_publication_date_from_url,
    validate_archive,
    validate_config,
)


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "hemeroteca.json"
FIXTURE_PATH = ROOT / "tests_python" / "fixtures" / "hemeroteca_feed.xml"


class FakeHTTPResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, _exception_type, _exception, _traceback):
        return False

    def read(self):
        return json.dumps(self.payload, ensure_ascii=False).encode("utf-8")


class HemerotecaPipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        cls.fixture = FIXTURE_PATH.read_bytes()
        cls.now = datetime(2026, 9, 5, 12, 0, tzinfo=timezone.utc)
        cls.source = {
            "name": cls.config["verification"]["fixture_source_name"],
            "feed_url": FIXTURE_PATH.as_uri(),
            "enabled": True,
        }

    def empty_archive(self):
        return {
            "schema_version": self.config["schema_version"],
            "actualizado_en": None,
            "noticias": [],
        }

    def extractor(self):
        return MockExtractor(
            self.config["topics"],
            self.config["ingestion"]["max_summary_characters"],
        )

    def run_fixture(self, archive):
        return execute_pipeline(
            self.config,
            archive,
            lambda _source: self.fixture,
            self.extractor(),
            self.now,
            [self.source],
        )

    def test_same_feed_twice_does_not_duplicate_and_preserves_hidden_flag(self):
        first_archive, first_report = self.run_fixture(self.empty_archive())
        self.assertEqual(first_report["new_entries"], 2)
        self.assertEqual(len(first_archive["noticias"]), 2)

        first_archive["noticias"][0]["oculto"] = True
        second_archive, second_report = self.run_fixture(first_archive)

        self.assertEqual(second_report["new_entries"], 0)
        self.assertEqual(second_report["duplicate_candidates"], 2)
        self.assertEqual(len(second_archive["noticias"]), 2)
        self.assertTrue(second_archive["noticias"][0]["oculto"])

    def test_generic_non_road_accident_is_filtered_out(self):
        keywords = self.config["keywords"]
        self.assertIsNone(
            match_keyword(
                "Actriz recuerda un accidente durante el rodaje",
                "La anécdota ocurrió dentro de un estudio de grabación.",
                keywords,
            )
        )
        self.assertEqual(
            match_keyword(
                "Autoridades investigan un accidente de transito",
                "Ocurrió en una vía urbana.",
                keywords,
            ),
            "accidente de tránsito",
        )

    def test_tracking_parameters_are_removed_from_stable_url(self):
        canonical = canonicalize_url(
            "https://Example.org/noticia?utm_source=rss&id=7#portada",
            self.config["ingestion"]["tracking_query_parameters"],
        )
        self.assertEqual(canonical, "https://example.org/noticia?id=7")

    def test_article_metadata_extracts_published_date_from_jsonld(self):
        html = """
        <html><head>
          <script type="application/ld+json">
            {"@type":"NewsArticle","datePublished":"2026-09-03T08:30:00-05:00"}
          </script>
          <meta property="og:image" content="/imagenes/noticia.webp">
        </head></html>
        """
        metadata = parse_article_metadata_html(html, "https://example.org/noticia")
        self.assertEqual(metadata["published_at"].isoformat(), "2026-09-03T13:30:00+00:00")
        self.assertEqual(metadata["date_source"], "jsonld.datePublished")
        self.assertEqual(metadata["image_url"], "https://example.org/imagenes/noticia.webp")

    def test_complete_date_in_url_is_accepted_without_inferring_months(self):
        parsed = parse_publication_date_from_url(
            "https://eldiario.ec/noticia/choque-en-chone-04012026"
        )
        self.assertEqual(parsed.strftime("%Y-%m-%d"), "2026-01-04")
        self.assertIsNone(
            parse_publication_date_from_url(
                "https://example.org/noticia/datos-de-accidentes-a-octubre-del-2023"
            )
        )

    def test_pipeline_uses_article_date_before_model_extraction(self):
        verified = datetime(2026, 9, 4, 15, 0, tzinfo=timezone.utc)
        archive, report = execute_pipeline(
            self.config,
            self.empty_archive(),
            lambda _source: self.fixture,
            self.extractor(),
            self.now,
            [self.source],
            article_metadata_extractor=lambda _url: {
                "published_at": verified,
                "date_source": "jsonld.datePublished",
                "image_url": "https://example.org/noticia.webp",
            },
        )
        self.assertEqual(report["article_dates_verified"], 2)
        self.assertEqual(report["reference_dates_used"], 0)
        self.assertTrue(archive["noticias"])
        for noticia in archive["noticias"]:
            self.assertEqual(noticia["fecha_publicacion"], "2026-09-04T15:00:00Z")
            self.assertFalse(noticia["fecha_referencial"])
            self.assertEqual(noticia["fuente_fecha"], "jsonld.datePublished")

    def test_one_failed_source_does_not_stop_a_valid_source(self):
        sources = [
            {"name": "Fuente caída", "feed_url": "https://invalid.example/rss", "enabled": True},
            self.source,
        ]

        def loader(source):
            if source["name"] == "Fuente caída":
                raise OSError("fuente no disponible")
            return self.fixture

        archive, report = execute_pipeline(
            self.config,
            self.empty_archive(),
            loader,
            self.extractor(),
            self.now,
            sources,
        )
        self.assertEqual(report["status"], "completed_with_warnings")
        self.assertEqual(len(report["source_failures"]), 1)
        self.assertEqual(len(archive["noticias"]), 2)

    def test_versioned_config_and_empty_archive_are_valid(self):
        output_path = validate_config(copy.deepcopy(self.config), ROOT)
        self.assertEqual(output_path, ROOT / "docs" / "data" / "hemeroteca.json")
        archive = json.loads(output_path.read_text(encoding="utf-8"))
        validate_archive(archive, self.config["schema_version"])

    def test_configured_provider_uses_chat_completions_json(self):
        item = FeedItem(
            "Choque activa operativo vial",
            "https://example.org/noticia",
            "La autoridad coordinó la atención y el cierre temporal de la vía.",
            self.now,
        )
        model_result = {
            "titulo": item.title,
            "fuente": "Fuente",
            "fecha_publicacion": "2026-09-05T12:00:00Z",
            "url": item.link,
            "resumen": "La autoridad atendió el hecho y cerró temporalmente la vía.",
            "tema": "siniestro",
        }
        api_response = {
            "choices": [{"message": {"role": "assistant", "content": json.dumps(model_result)}}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 40},
        }
        key_name = self.config["ai_provider"]["api_key_env"]
        with patch.dict(os.environ, {key_name: "clave-de-prueba"}, clear=False):
            extractor = CompatibleChatExtractor(
                self.config["ai_provider"], self.config["topics"], self.config["ingestion"]
            )
        with patch(
            "scripts.actualizar_hemeroteca.urlopen",
            return_value=FakeHTTPResponse(api_response),
        ) as mocked_urlopen:
            extracted = extractor.extract(item, "Fuente", item.link, "choque")

        request = mocked_urlopen.call_args.args[0]
        request_body = json.loads(request.data.decode("utf-8"))
        self.assertEqual(request.full_url, extractor.endpoint)
        self.assertEqual(request_body["model"], self.config["ai_provider"]["model"])
        self.assertEqual(
            request_body["response_format"], self.config["ai_provider"]["response_format"]
        )
        self.assertIn("messages", request_body)
        self.assertNotIn("input", request_body)
        prompt_payload = json.loads(request_body["messages"][1]["content"])
        self.assertEqual(prompt_payload["fecha_publicacion"], "2026-09-05T12:00:00Z")
        self.assertFalse(prompt_payload["fecha_referencial"])
        self.assertIn("no deduzcas una fecha", request_body["messages"][0]["content"])
        self.assertEqual(extracted["tema"], "siniestro")
        self.assertEqual(extractor.request_count, 1)
        self.assertEqual(extractor.prompt_tokens, 100)
        self.assertEqual(extractor.completion_tokens, 40)

    def test_rate_limit_retries_with_configured_backoff(self):
        item = FeedItem(
            "Choque activa operativo vial",
            "https://example.org/noticia",
            "La autoridad coordinó la atención en la vía.",
            self.now,
        )
        model_result = {
            "titulo": item.title,
            "fuente": "Fuente",
            "fecha_publicacion": "2026-09-05T12:00:00Z",
            "url": item.link,
            "resumen": "La autoridad coordinó la atención del hecho vial.",
            "tema": "siniestro",
        }
        api_response = {
            "choices": [{"message": {"role": "assistant", "content": json.dumps(model_result)}}],
            "usage": {"prompt_tokens": 80, "completion_tokens": 30},
        }
        key_name = self.config["ai_provider"]["api_key_env"]
        with patch.dict(os.environ, {key_name: "clave-de-prueba"}, clear=False):
            extractor = CompatibleChatExtractor(
                self.config["ai_provider"], self.config["topics"], self.config["ingestion"]
            )
        rate_limit = HTTPError(
            extractor.endpoint,
            self.config["ai_provider"]["rate_limit_http_status_codes"][0],
            "rate limit",
            {},
            BytesIO(b"{}"),
        )
        with patch(
            "scripts.actualizar_hemeroteca.urlopen",
            side_effect=[rate_limit, FakeHTTPResponse(api_response)],
        ), patch("scripts.actualizar_hemeroteca.time.sleep") as mocked_sleep:
            extracted = extractor.extract(item, "Fuente", item.link, "choque")

        self.assertEqual(extracted["tema"], "siniestro")
        self.assertEqual(extractor.request_count, 2)
        self.assertEqual(extractor.rate_limit_count, 1)
        mocked_sleep.assert_called_once_with(
            self.config["ai_provider"]["retry_backoff_seconds"]
        )

    def test_future_article_date_is_rejected(self):
        future = datetime(2026, 10, 15, tzinfo=timezone.utc)
        archive, report = execute_pipeline(
            self.config,
            self.empty_archive(),
            lambda _source: self.fixture,
            self.extractor(),
            self.now,
            [self.source],
            article_metadata_extractor=lambda _url: {
                "published_at": future,
                "date_source": "texto_fecha_publicada",
                "image_url": None,
            },
        )
        self.assertEqual(report["article_dates_verified"], 0)
        self.assertTrue(archive["noticias"])
        self.assertTrue(
            all(noticia["fecha_publicacion"] <= "2026-09-06T12:00:00Z" for noticia in archive["noticias"])
        )

    def test_topic_pages_are_not_added_as_news(self):
        feed = """<?xml version='1.0' encoding='UTF-8'?>
        <rss version='2.0'><channel><item>
          <title>Accidente de transito: archivo temático</title>
          <link>https://example.org/temas/accidentes-transito</link>
          <description>Archivo sobre accidentes de tránsito.</description>
          <pubDate>Sat, 05 Sep 2026 11:00:00 GMT</pubDate>
        </item></channel></rss>""".encode("utf-8")
        archive, report = execute_pipeline(
            self.config,
            self.empty_archive(),
            lambda _source: feed,
            self.extractor(),
            self.now,
            [self.source],
        )
        self.assertEqual(report["non_article_candidates"], 1)
        self.assertEqual(archive["noticias"], [])


if __name__ == "__main__":
    unittest.main()
