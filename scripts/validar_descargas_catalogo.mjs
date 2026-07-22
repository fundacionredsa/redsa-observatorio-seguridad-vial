import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const CONFIG = {
  downloadsDir: "docs/descargas",
  previewDir: "tmp/catalogo-previews",
  representative: new Set(["siniestros_inec_2019.xlsx", "fallecidos_parroquial.xlsx", "tasa_fallecidos_100k.xlsx"])
};

async function main() {
  const manifest = JSON.parse(await fs.readFile(path.join(CONFIG.downloadsDir, "manifest.json"), "utf8"));
  await fs.mkdir(CONFIG.previewDir, { recursive: true });
  const report = [];
  for (const entry of manifest.archivos) {
    const filePath = path.join(CONFIG.downloadsDir, entry.archivo);
    const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(filePath));
    const inspection = await workbook.inspect({ kind: "sheet", include: "name", maxChars: 4000 });
    const names = [...String(inspection.ndjson).matchAll(/"name":"([^"]+)"/g)].map(match => match[1]);
    if (!names.includes("Léeme") || !names.includes("Metodología")) throw new Error(`${entry.archivo}: faltan hojas documentales`);
    if (names.length !== entry.hojas) throw new Error(`${entry.archivo}: se esperaban ${entry.hojas} hojas y se encontraron ${names.length}`);
    if (CONFIG.representative.has(entry.archivo)) {
      for (const sheetName of ["Léeme", names.find(name => name.startsWith("Año "))]) {
        const rendered = await workbook.render({ sheetName, range: sheetName === "Léeme" ? "A1:H16" : "A1:K25", scale: 1, format: "png" });
        await fs.writeFile(path.join(CONFIG.previewDir, `${path.parse(entry.archivo).name}-${sheetName.replaceAll(" ", "_")}.png`), new Uint8Array(await rendered.arrayBuffer()));
      }
    }
    report.push({ archivo: entry.archivo, hojas: names });
  }
  await fs.writeFile(path.join(CONFIG.previewDir, "validacion.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(`Validados ${report.length} libros; estructura documental y hojas anuales correctas.`);
}

await main();
