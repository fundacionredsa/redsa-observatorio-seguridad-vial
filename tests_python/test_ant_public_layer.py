import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "data"
ALLOWED_KEYS = {"a", "c", "f", "h", "l", "m", "p", "q", "s", "t", "v", "w", "z"}
FORBIDDEN_TERMS = {"placa", "direccion", "edad", "sexo", "casco", "cinturon", "participante"}


class AntPublicLayerContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.expected = {
            2024: {"features": 21_193, "total": 21_220, "sin_ubicacion": 7, "no_verificable": 20, "fecha": 0, "corte": "2024-12-31", "coverage": "anio_completo"},
            2025: {"features": 20_148, "total": 20_346, "sin_ubicacion": 186, "no_verificable": 8, "fecha": 4, "corte": "2025-12-31", "coverage": "anio_completo"},
            2026: {"features": 10_747, "total": 10_752, "sin_ubicacion": 4, "no_verificable": 1, "fecha": 0, "corte": "2026-06-30", "coverage": "parcial_enero_junio"},
        }
        cls.layers = {
            year: json.loads((DATA / f"siniestros_ant_{year}.geojson").read_text(encoding="utf-8"))
            for year in cls.expected
        }
        cls.heat_layers = {
            year: json.loads((DATA / f"siniestros_ant_{year}_heat.json").read_text(encoding="utf-8"))
            for year in cls.expected
        }
        cls.catalog = json.loads((DATA / "catalogo_metadatos.json").read_text(encoding="utf-8"))

    def test_public_layer_count_and_audit_metadata(self):
        for year, expected in self.expected.items():
            with self.subTest(year=year):
                layer = self.layers[year]
                self.assertEqual(len(layer["features"]), expected["features"])
                self.assertEqual(layer["metadata"]["corte"], expected["corte"])
                self.assertEqual(layer["metadata"]["cobertura_temporal"], expected["coverage"])
                self.assertEqual(layer["metadata"]["sd_c"]["umbral_recomendado"], 5)
                audit = layer["metadata"]["auditoria_ubicacion"]
                self.assertEqual(audit["total_eventos"], expected["total"])
                self.assertEqual(audit["ubicaciones_publicadas"], expected["features"])
                self.assertEqual(audit["sin_ubicacion"], expected["sin_ubicacion"])
                self.assertEqual(audit["ubicacion_no_verificable"], expected["no_verificable"])
                self.assertEqual(audit["fechas_no_publicables"], expected["fecha"])

    def test_public_properties_are_whitelisted_and_sanitized(self):
        for year, layer in self.layers.items():
            with self.subTest(year=year):
                for feature in layer["features"]:
                    properties = feature.get("properties") or {}
                    self.assertLessEqual(set(properties), ALLOWED_KEYS)
                serialized_schema = json.dumps(layer["metadata"]["esquema_compacto"], ensure_ascii=False).lower()
                self.assertFalse(FORBIDDEN_TERMS.intersection(serialized_schema.split()))

    def test_heat_compact_is_exact_coordinate_projection(self):
        for year, layer in self.layers.items():
            with self.subTest(year=year):
                compact = self.heat_layers[year]
                self.assertEqual(compact["schema"], "redsa-ant-heat-v1")
                self.assertEqual(compact["year"], year)
                self.assertEqual(compact["scale"], 100_000)
                self.assertEqual(compact["point_count"], len(layer["features"]))
                expected_coordinates = []
                for feature in layer["features"]:
                    longitude, latitude = feature["geometry"]["coordinates"]
                    expected_coordinates.extend(
                        [round(latitude * compact["scale"]), round(longitude * compact["scale"])]
                    )
                self.assertEqual(compact["coordinates"], expected_coordinates)

    def test_catalog_declares_event_layer_source_period_and_download(self):
        entry = next(item for item in self.catalog["variables"] if item["id"] == "siniestros_ant_puntos")
        self.assertEqual(entry["tipo"], "capa_eventos")
        self.assertEqual(entry["categoria"], "Siniestralidad")
        self.assertEqual(entry["anios_disponibles"], [2024, 2025, 2026])
        self.assertIn("ANT", entry["fuente"])
        self.assertEqual(
            [item["url"] for item in entry["descargas"]["archivos_directos"]],
            [
                "data/siniestros_ant_2024.geojson",
                "data/siniestros_ant_2025.geojson",
                "data/siniestros_ant_2026.geojson",
            ],
        )


if __name__ == "__main__":
    unittest.main()
