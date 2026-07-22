import unittest

from scripts.agregar_fallecidos_territorial import (
    COVERAGE_FIELD,
    OUTPUT_FIELD,
    aggregate_parishes,
    merge_aggregates,
)


def parish(code, canton, province, annual, status=None):
    properties = {
        "DPA_PARROQ": code,
        "DPA_CANTON": canton,
        "DPA_PROVIN": province,
        "fallecidos_por_anio": annual,
    }
    if status:
        properties["estado_por_anio"] = status
    return {"type": "Feature", "properties": properties, "geometry": None}


class TerritorialFatalitiesAggregationTest(unittest.TestCase):
    def test_zero_is_data_and_missing_is_not_zero(self):
        features = [
            parish("010101", "0101", "01", {"2021": 0}),
            parish("010102", "0101", "01", {}),
            parish("010103", "0101", "01", {"2021": 7}, {"2021": "sin_dato"}),
            parish("010104", "0101", "01", {"2021": 3}),
        ]
        result = aggregate_parishes(features, "DPA_CANTON", ("2021",))["0101"]
        self.assertEqual(result[OUTPUT_FIELD]["2021"], 3)
        self.assertEqual(result[COVERAGE_FIELD]["2021"], 50.0)

    def test_merge_is_additive(self):
        payload = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"DPA_CANTON": "0101", "existente": {"no": "cambiar"}},
                    "geometry": None,
                }
            ],
        }
        aggregates = {
            "0101": {
                OUTPUT_FIELD: {"2021": 2},
                COVERAGE_FIELD: {"2021": 100.0},
            }
        }
        merged = merge_aggregates(payload, "DPA_CANTON", aggregates)
        self.assertEqual(merged["features"][0]["properties"]["existente"], {"no": "cambiar"})
        self.assertNotIn(OUTPUT_FIELD, payload["features"][0]["properties"])

    def test_target_without_parishes_is_explicitly_missing(self):
        payload = {
            "type": "FeatureCollection",
            "features": [
                {"type": "Feature", "properties": {"DPA_CANTON": "1413"}, "geometry": None}
            ],
        }
        merged = merge_aggregates(payload, "DPA_CANTON", {}, ("2024",))
        properties = merged["features"][0]["properties"]
        self.assertIsNone(properties[OUTPUT_FIELD]["2024"])
        self.assertEqual(properties[COVERAGE_FIELD]["2024"], 0.0)


if __name__ == "__main__":
    unittest.main()
