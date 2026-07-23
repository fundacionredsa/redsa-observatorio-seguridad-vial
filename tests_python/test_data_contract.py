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
        cls.osm_report = load("osm_cobertura_reporte.json")

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

    def test_parish_fatalities_reconcile_at_all_levels(self):
        for year in ["2021", "2022", "2023", "2024"]:
            with self.subTest(year=year):
                parish_sum = sum(
                    (feature["properties"].get("fallecidos_por_anio") or {}).get(year, 0) or 0
                    for feature in self.parishes["features"]
                )
                canton_sum = sum(
                    (feature["properties"].get("fallecidos_parroquial") or {}).get(year, 0) or 0
                    for feature in self.cantons["features"]
                )
                province_sum = sum(
                    (feature["properties"].get("fallecidos_parroquial") or {}).get(year, 0) or 0
                    for feature in self.provinces["features"]
                )
                self.assertEqual(parish_sum, canton_sum)
                self.assertEqual(canton_sum, province_sum)

        for level in [self.cantons, self.provinces]:
            for feature in level["features"]:
                coverage = feature["properties"].get("fallecidos_cobertura_pct") or {}
                self.assertEqual(set(coverage), {"2021", "2022", "2023", "2024"})
                self.assertTrue(all(0 <= value <= 100 for value in coverage.values()))

    def test_quito_and_guayaquil_parish_aggregates(self):
        expected = {
            "1701": {"2021": 430, "2022": 428, "2023": 478, "2024": 504},
            "0901": {"2021": 438, "2022": 546, "2023": 617, "2024": 665},
        }
        by_code = {
            str(feature["properties"]["DPA_CANTON"]): feature["properties"]
            for feature in self.cantons["features"]
        }
        for code, annual in expected.items():
            self.assertEqual(by_code[code]["fallecidos_parroquial"], annual)

    def test_vehicle_total_and_missing_state(self):
        total = sum((feature["properties"].get("vehiculos_matriculados_2024") or {}).get("total") or 0 for feature in self.cantons["features"])
        self.assertEqual(total, 3_138_562)
        for feature in self.cantons["features"]:
            vehicles = feature["properties"].get("vehiculos_matriculados_2024") or {}
            if not vehicles.get("total"):
                self.assertEqual(vehicles.get("estado"), "sin_dato")

    def test_annual_edg_profiles_reconcile_with_historical_totals(self):
        for year in ["2020", "2021", "2022", "2023", "2024"]:
            with self.subTest(year=year):
                historical = sum(
                    (feature["properties"].get("fallecidos_historico") or {}).get(year, 0) or 0
                    for feature in self.cantons["features"]
                )
                profiles = [
                    (feature["properties"].get("fallecidos_detallado") or {}).get(year) or {}
                    for feature in self.cantons["features"]
                ]
                profile_total = sum(profile.get("total", 0) or 0 for profile in profiles)
                user_total = sum(
                    sum((profile.get("usuario") or {}).values()) for profile in profiles
                )
                self.assertEqual(profile_total, historical)
                self.assertEqual(user_total, historical)

    def test_annual_sppat_profiles_reconcile_with_counts(self):
        fields = ["sppat_por_sexo", "sppat_por_condicion", "sppat_por_tipo_accidente"]
        for year in ["2016", "2017", "2018", "2019", "2020", "2021"]:
            expected = sum(
                (feature["properties"].get("sppat_fallecidos_por_anio") or {}).get(year, 0) or 0
                for feature in self.cantons["features"]
            )
            for field in fields:
                with self.subTest(year=year, field=field):
                    actual = sum(
                        (((feature["properties"].get(field) or {}).get(year) or {}).get("total", 0))
                        for feature in self.cantons["features"]
                    )
                    self.assertEqual(actual, expected)

        aggregate = sum(
            feature["properties"].get("fallecidos_sppat_2016_2021", 0) or 0
            for feature in self.cantons["features"]
        )
        self.assertEqual(aggregate, 16_363)

    def test_national_osm_layers_match_extraction_report(self):
        layer_names = [
            "ciclovias",
            "aceras",
            "cruces",
            "pacificacion",
            "semaforos_rotondas",
            "iluminacion",
            "velocidad",
            "brt_metrobus",
        ]
        report_layers = self.osm_report["capas"]
        for layer_name in layer_names:
            with self.subTest(layer=layer_name):
                layer = load(f"{layer_name}_ecuador.geojson")
                self.assertEqual(layer["metadata"]["alcance"], "Ecuador nacional")
                self.assertEqual(
                    len(layer["features"]),
                    report_layers[layer_name]["features_despues_nacional"],
                )
                for feature in layer["features"]:
                    codes = feature["properties"].get("DPA_CANTONES") or []
                    self.assertTrue(codes)
                    self.assertEqual(len(codes), len(set(codes)))

    def test_osm_mapping_coverage_is_explicit_at_both_levels(self):
        for level in [self.cantons, self.provinces]:
            for feature in level["features"]:
                properties = feature["properties"]
                coverage = properties.get("cobertura_mapeo_osm") or {}
                self.assertIn(
                    coverage.get("estado"),
                    {"disponible", "sin_elementos_mapeados", "sin_dato_poblacion"},
                )
                self.assertIn("elementos_total", coverage)
                self.assertIn("advertencia", coverage)

    def test_osm_road_layer_is_complete_and_classified(self):
        roads = load("vias_ecuador.geojson")

        self.assertEqual(len(roads["features"]), 41_040)
        self.assertEqual(sum(feature["properties"]["clase"] == "principal" for feature in roads["features"]), 14_687)
        self.assertEqual(sum(feature["properties"]["clase"] == "secundaria" for feature in roads["features"]), 26_353)
        self.assertEqual(roads["metadata"]["clasificacion"]["principal"], ["motorway", "trunk", "primary"])
        self.assertEqual(roads["metadata"]["clasificacion"]["secundaria"], ["secondary", "tertiary"])
        self.assertEqual(roads["metadata"]["cobertura_osm_vs_mtop_pct"], 120.68)
        self.assertAlmostEqual(
            sum(feature["properties"]["longitud_km"] for feature in roads["features"]),
            37_292.128,
            delta=0.2,
        )

    def test_province_osm_coverage_uses_direct_deduplicated_counts(self):
        expected = {}
        for layer_name in ["semaforos_rotondas", "cruces", "aceras"]:
            layer = load(f"{layer_name}_ecuador.geojson")
            for feature in layer["features"]:
                for province_code in set(
                    map(str, feature["properties"].get("DPA_PROVINCIAS") or [])
                ):
                    expected.setdefault(province_code, {}).setdefault(layer_name, 0)
                    expected[province_code][layer_name] += 1
        for feature in self.provinces["features"]:
            properties = feature["properties"]
            code = str(properties["DPA_PROVIN"])
            actual = properties["cobertura_mapeo_osm"]["por_capa"]
            for layer_name in ["semaforos_rotondas", "cruces", "aceras"]:
                with self.subTest(province=code, layer=layer_name):
                    self.assertEqual(actual[layer_name], expected.get(code, {}).get(layer_name, 0))

    def test_islands_never_have_inferential_values(self):
        for feature in self.hotspots["features"]:
            for result in (feature["properties"].get("hotspot_gi") or {}).values():
                if result.get("categoria") == "isla_sin_vecinos":
                    self.assertIsNone(result.get("z_score"))
                    self.assertIsNone(result.get("p_value"))


if __name__ == "__main__":
    unittest.main()
