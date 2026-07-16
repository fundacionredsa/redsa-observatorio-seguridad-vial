import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "data"


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


class PublishedDataContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cantons = load("cantones_wgs84.geojson")
        cls.provinces = load("provincias_wgs84.geojson")
        cls.parishes = load("parroquias_wgs84.geojson")
        cls.hotspots = load("hotspots_cantonales.geojson")

    def test_feature_counts_and_unique_codes(self):
        cases = [
            (self.cantons, 224, "DPA_CANTON"),
            (self.provinces, 24, "DPA_PROVIN"),
            (self.parishes, 1040, "DPA_PARROQ"),
            (self.hotspots, 224, "DPA_CANTON"),
        ]
        for data, expected, field in cases:
            with self.subTest(field=field):
                codes = [feature["properties"].get(field) for feature in data["features"]]
                self.assertEqual(len(codes), expected)
                self.assertEqual(len(set(codes)), expected)

    def test_canton_and_hotspot_codes_match(self):
        canton_codes = {feature["properties"]["DPA_CANTON"] for feature in self.cantons["features"]}
        hotspot_codes = {feature["properties"]["DPA_CANTON"] for feature in self.hotspots["features"]}
        self.assertEqual(canton_codes, hotspot_codes)

    def test_national_sums_match_province_sums(self):
        fields = [
            ("fallecidos_historico", ["2020", "2021", "2022", "2023", "2024"]),
            ("siniestros_historico", ["2019", "2021", "2022", "2023", "2024"]),
        ]
        for field, years in fields:
            for year in years:
                with self.subTest(field=field, year=year):
                    canton_sum = sum((feature["properties"].get(field) or {}).get(year, 0) or 0 for feature in self.cantons["features"])
                    province_sum = sum((feature["properties"].get(field) or {}).get(year, 0) or 0 for feature in self.provinces["features"])
                    self.assertEqual(canton_sum, province_sum)

    def test_vehicle_total_and_missing_state(self):
        total = sum((feature["properties"].get("vehiculos_matriculados_2024") or {}).get("total") or 0 for feature in self.cantons["features"])
        self.assertEqual(total, 3_138_562)
        for feature in self.cantons["features"]:
            vehicles = feature["properties"].get("vehiculos_matriculados_2024") or {}
            if not vehicles.get("total"):
                self.assertEqual(vehicles.get("estado"), "sin_dato")

    def test_islands_never_have_inferential_values(self):
        for feature in self.hotspots["features"]:
            for result in (feature["properties"].get("hotspot_gi") or {}).values():
                if result.get("categoria") == "isla_sin_vecinos":
                    self.assertIsNone(result.get("z_score"))
                    self.assertIsNone(result.get("p_value"))


if __name__ == "__main__":
    unittest.main()
