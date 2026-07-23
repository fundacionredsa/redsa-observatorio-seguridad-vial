import json
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class PortalTextAndDownloadsTest(unittest.TestCase):
    def test_visible_sources_have_no_mojibake(self):
        paths = [ROOT / "docs" / "index.html", ROOT / "docs" / "data" / "catalogo_metadatos.json"]
        paths.extend((ROOT / "docs" / "assets" / "js").glob("*.js"))
        paths.extend((ROOT / "docs" / "assets" / "css").glob("*.css"))
        paths.extend((ROOT / "docs" / "metodologia").glob("*.html"))
        for path in paths:
            content = path.read_text(encoding="utf-8")
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertNotIn("Observatorio REDSA", content)
                self.assertNotRegex(content, r"Ã|Â|�")

    def test_catalog_workbooks_are_present_and_valid(self):
        manifest_path = ROOT / "docs" / "descargas" / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        catalog = json.loads((ROOT / "docs" / "data" / "catalogo_metadatos.json").read_text(encoding="utf-8"))
        self.assertNotIn("densidad_vial_osm", {variable["id"] for variable in catalog["variables"]})
        for variable in catalog["variables"]:
            with self.subTest(variable=variable["id"]):
                self.assertTrue(variable.get("fuente"))
                self.assertTrue(variable.get("metodologia"))
                self.assertTrue(variable.get("licencia"))
                self.assertTrue(variable.get("referencias"))
        direct_entries = {variable["id"]: variable for variable in catalog["variables"] if variable["id"] == "vias_osm"}
        self.assertEqual(set(direct_entries), {"vias_osm"})
        for variable in direct_entries.values():
            self.assertEqual(variable["categoria"], "Otras variables")
            self.assertIsNone(variable["descargas"]["excel"])
            self.assertTrue(variable["descargas"]["archivos_directos"])
            for download in variable["descargas"]["archivos_directos"]:
                self.assertTrue((ROOT / "docs" / download["url"]).exists())
        self.assertEqual(len(manifest["archivos"]), 9)
        for entry in manifest["archivos"]:
            workbook_path = manifest_path.parent / entry["archivo"]
            with self.subTest(workbook=entry["archivo"]):
                self.assertTrue(workbook_path.exists())
                self.assertTrue(zipfile.is_zipfile(workbook_path))
                with zipfile.ZipFile(workbook_path) as workbook:
                    self.assertIn("xl/workbook.xml", workbook.namelist())
                    self.assertEqual(len([name for name in workbook.namelist() if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")]), entry["hojas"])
                    searchable = "\n".join(
                        workbook.read(name).decode("utf-8", errors="ignore")
                        for name in workbook.namelist()
                        if name == "xl/sharedStrings.xml" or name.startswith("xl/worksheets/sheet")
                    )
                    for required in ("Fuente", "Licencia", "Metodolog", "Referencia"):
                        self.assertIn(required, searchable)
                    self.assertNotIn("Observatorio REDSA", searchable)


if __name__ == "__main__":
    unittest.main()
