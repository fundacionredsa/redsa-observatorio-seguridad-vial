import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const CONFIG = {
  outputDir: "docs/descargas",
  catalogPath: "docs/data/catalogo_metadatos.json",
  geojson: {
    province: "docs/data/provincias_wgs84.geojson",
    canton: "docs/data/cantones_wgs84.geojson",
    parish: "docs/data/parroquias_wgs84.geojson"
  },
  sourceUrl: "https://fundacionredsa.github.io/redsa-observatorio-seguridad-vial/",
  generatedDate: new Date().toISOString().slice(0, 10)
};

const DEFINITIONS = {
  siniestros_inec_2019: { kind: "count", value: (p, y) => p.siniestros_historico?.[y] },
  fallecidos_inec_2019: { kind: "count", value: (p, y) => p.fallecidos_historico?.[y] },
  tasa_fallecidos_100k: { kind: "rate", factor: 100000, numerator: (p, y) => p.fallecidos_historico?.[y], denominator: (p, y) => p.poblacion_por_anio?.[y] },
  tasa_siniestros_1000_vehiculos_2024: { kind: "rate", factor: 1000, numerator: (p) => p.siniestros_historico?.["2024"], denominator: (p) => p.vehiculos_matriculados_2024?.total },
  tasa_motociclistas_1000_motos_2024: { kind: "rate", factor: 1000, numerator: (p) => p.fallecidos_detallado?.["2024"]?.usuario?.motociclista, denominator: (p) => p.vehiculos_matriculados_2024?.por_clase?.MOTOCICLETA },
  fallecidos_sppat_2016_2021: { kind: "count", value: (p, y) => p.sppat_fallecidos_por_anio?.[y] },
  fallecidos_parroquial: { kind: "count", value: (p, y) => p.fallecidos_parroquial?.[y] ?? p.fallecidos_por_anio?.[y] },
  porcentaje_motos_flota_2024: { kind: "rate", factor: 100, numerator: (p) => p.vehiculos_matriculados_2024?.por_clase?.MOTOCICLETA, denominator: (p) => p.vehiculos_matriculados_2024?.total },
  cobertura_mapeo_osm: { kind: "rate", factor: 100000, numerator: (p) => p.cobertura_mapeo_osm?.elementos_total, denominator: (p) => p.poblacion_por_anio?.["2024"] }
};

function text(value) { return value === undefined || value === null ? "" : String(value); }
function numeric(value) { const n = Number(value); return value === "" || value === null || value === undefined || !Number.isFinite(n) || n < 0 ? null : n; }
function code(p, key) { return text(p[key] ?? p[key.toLowerCase()]); }
function territorial(feature, level) {
  const p = feature.properties;
  return {
    level,
    provinceCode: code(p, "DPA_PROVIN"), province: text(p.DPA_DESPRO ?? p.provincia),
    cantonCode: level === "province" ? "" : code(p, "DPA_CANTON"), canton: level === "province" ? "" : text(p.DPA_DESCAN ?? p.canton),
    parishCode: level === "parish" ? code(p, "DPA_PARROQ") || code(p, "DPA_PARRO") : "",
    parish: level === "parish" ? text(p.DPA_DESPAR ?? p.parroquia) : "",
    properties: p
  };
}

function metric(definition, properties, year) {
  if (definition.kind === "count") return { value: numeric(definition.value(properties, String(year))), numerator: null, denominator: null };
  const numerator = numeric(definition.numerator(properties, String(year)));
  const denominator = numeric(definition.denominator(properties, String(year)));
  return { value: numerator === null || denominator === null || denominator === 0 ? null : numerator / denominator * definition.factor, numerator, denominator };
}

function aggregateMetric(definition, metrics) {
  if (definition.kind === "count") {
    const values = metrics.map((item) => item.value).filter((value) => value !== null);
    return { value: values.length ? values.reduce((sum, value) => sum + value, 0) : null, numerator: null, denominator: null };
  }
  const valid = metrics.filter((item) => item.numerator !== null && item.denominator !== null && item.denominator > 0);
  if (!valid.length) return { value: null, numerator: null, denominator: null };
  const numerator = valid.reduce((sum, item) => sum + item.numerator, 0);
  const denominator = valid.reduce((sum, item) => sum + item.denominator, 0);
  return { value: numerator / denominator * definition.factor, numerator, denominator };
}

function groupBy(items, keyFn) {
  const groups = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return groups;
}

function sheetRows(variable, definition, year, data) {
  const useParish = variable.nivel_territorial_disponible.includes("parish");
  const details = (useParish ? data.parish : data.canton).map((feature) => territorial(feature, useParish ? "parish" : "canton"));
  details.sort((a, b) => `${a.province}|${a.canton}|${a.parish}`.localeCompare(`${b.province}|${b.canton}|${b.parish}`, "es"));
  const rows = [{ type: "Total nacional", provinceCode: "", province: "ECUADOR", cantonCode: "", canton: "", parishCode: "", parish: "" }];
  const groupedProvinces = groupBy(details, (item) => item.provinceCode);
  for (const provinceRows of groupedProvinces.values()) {
    const firstProvince = provinceRows[0];
    rows.push({ type: "Subtotal provincia", ...firstProvince, cantonCode: "", canton: "", parishCode: "", parish: "" });
    if (useParish) {
      const groupedCantons = groupBy(provinceRows, (item) => item.cantonCode);
      for (const cantonRows of groupedCantons.values()) {
        rows.push({ type: "Subtotal cantón", ...cantonRows[0], parishCode: "", parish: "" });
        cantonRows.forEach((item) => rows.push({ type: "Parroquia", ...item }));
      }
    } else {
      provinceRows.forEach((item) => rows.push({ type: "Cantón", ...item }));
    }
  }
  const detailMetrics = details.map((item) => ({ item, metric: metric(definition, item.properties, year) }));
  return rows.map((row) => {
    if (row.type === "Cantón" || row.type === "Parroquia") {
      const result = metric(definition, row.properties, year);
      return { ...row, metric: result, status: result.value === null ? "sin_dato" : "con_dato" };
    }
    let children = detailMetrics;
    if (row.type === "Subtotal provincia") children = children.filter(({ item }) => item.provinceCode === row.provinceCode);
    if (row.type === "Subtotal cantón") children = children.filter(({ item }) => item.cantonCode === row.cantonCode);
    const result = aggregateMetric(definition, children.map((child) => child.metric));
    const missing = children.some((child) => child.metric.value === null);
    return { ...row, metric: result, status: result.value === null ? "sin_dato" : (missing ? "calculado_con_datos_parciales" : "calculado") };
  });
}

function styleTitle(sheet, range) {
  range.format.fill = "#12313B";
  range.format.font = { bold: true, color: "#FFFFFF", size: 16, name: "Aptos Display" };
}
function styleHeader(range) {
  range.format.fill = "#087F8C";
  range.format.font = { bold: true, color: "#FFFFFF", size: 10, name: "Aptos" };
  range.format.wrapText = true;
  range.format.rowHeight = 30;
}

function buildReadme(workbook, variable) {
  const sheet = workbook.worksheets.add("Léeme");
  sheet.showGridLines = false;
  sheet.getRange("A1:H2").merge();
  sheet.getRange("A1").values = [[variable.label]];
  styleTitle(sheet, sheet.getRange("A1:H2"));
  const rows = [
    ["Producto", "Descarga pública del Catálogo de datos del Observatorio de Seguridad Vial y Movilidad Sostenible"],
    ["Descripción", variable.descripcion], ["Unidad", variable.unidad], ["Fuente", variable.fuente],
    ["Años", variable.anios_disponibles.join(", ")], ["Niveles", variable.nivel_territorial_disponible.join(", ")],
    ["Licencia", variable.licencia], ["Generado", CONFIG.generatedDate], ["Portal", CONFIG.sourceUrl],
    ["Cómo leer", "Cada hoja anual presenta total nacional, subtotales provinciales y datos cantonales. Cuando existe nivel parroquial, incluye además subtotales cantonales y el detalle parroquial."],
    ["Valores faltantes", "Un valor vacío acompañado por estado sin_dato significa que la fuente no ofrece información suficiente. No se reemplaza por cero."],
    ["Citación sugerida", `Fundación REDSA (2026). ${variable.label}. Observatorio Ciudadano de Seguridad Vial y Movilidad Sostenible. Consulta: ${CONFIG.generatedDate}.`]
  ];
  sheet.getRange(`A4:B${rows.length + 3}`).values = rows;
  sheet.getRange(`A4:A${rows.length + 3}`).format.font = { bold: true, color: "#075D66" };
  sheet.getRange(`A4:B${rows.length + 3}`).format.wrapText = true;
  sheet.getRange("A:A").format.columnWidth = 22;
  sheet.getRange("B:B").format.columnWidth = 90;
  sheet.getRange(`A4:B${rows.length + 3}`).format.borders = { preset: "inside", style: "thin", color: "#D9E2EC" };
}

function buildMethod(workbook, variable, definition) {
  const sheet = workbook.worksheets.add("Metodología");
  sheet.showGridLines = false;
  sheet.getRange("A1:H2").merge(); sheet.getRange("A1").values = [["Metodología, referencias y limitaciones"]]; styleTitle(sheet, sheet.getRange("A1:H2"));
  const formula = definition.kind === "rate" ? `Numerador ÷ denominador × ${definition.factor.toLocaleString("es-EC")}` : "Conteo de registros válidos por territorio y año";
  const rows = [["Método", variable.metodologia], ["Fórmula", formula], ["Fuente", variable.fuente], ["Licencia", variable.licencia]];
  variable.referencias.forEach((reference, index) => rows.push([`Referencia ${index + 1}`, `${reference.label}: ${reference.url}`]));
  rows.push(["Tratamiento territorial", "Los subtotales se calculan en el archivo mediante fórmulas sobre las filas de detalle. Las tasas se recalculan con numeradores y denominadores agregados; no se promedian tasas territoriales."]);
  sheet.getRange(`A4:B${rows.length + 3}`).values = rows;
  sheet.getRange(`A4:A${rows.length + 3}`).format.font = { bold: true, color: "#075D66" };
  sheet.getRange(`A4:B${rows.length + 3}`).format.wrapText = true;
  sheet.getRange("A:A").format.columnWidth = 24; sheet.getRange("B:B").format.columnWidth = 95;
}

function buildYear(workbook, variable, definition, year, data) {
  const sheet = workbook.worksheets.add(`Año ${year}`);
  sheet.showGridLines = false;
  sheet.getRange("A1:K2").merge(); sheet.getRange("A1").values = [[`${variable.label} · ${year}`]]; styleTitle(sheet, sheet.getRange("A1:K2"));
  sheet.getRange("A3:K3").merge(); sheet.getRange("A3").values = [[`${variable.fuente} · ${variable.unidad} · Los vacíos se declaran como sin_dato.`]];
  sheet.getRange("A3:K3").format.font = { color: "#52606B", italic: true, size: 9 };
  const headers = [["Tipo de fila", "Código provincia", "Provincia", "Código cantón", "Cantón", "Código parroquia", "Parroquia", "Valor", "Estado del dato", "Numerador", "Denominador"]];
  sheet.getRange("A5:K5").values = headers; styleHeader(sheet.getRange("A5:K5"));
  const rows = sheetRows(variable, definition, year, data);
  const start = 6, end = start + rows.length - 1;
  const values = rows.map((row) => [row.type, row.provinceCode, row.province, row.cantonCode, row.canton, row.parishCode, row.parish,
    row.metric?.value ?? null, row.status, row.metric?.numerator ?? null, row.metric?.denominator ?? null]);
  sheet.getRange(`A${start}:K${end}`).values = values;
  sheet.freezePanes.freezeRows(5);
  sheet.getRange(`H${start}:H${end}`).format.numberFormat = definition.kind === "count" ? "0" : "0.00";
  sheet.getRange(`J${start}:K${end}`).format.numberFormat = "0";
  sheet.getRange(`A${start}:K${end}`).format.font = { size: 9, name: "Aptos" };
  rows.forEach((row, index) => {
    const range = sheet.getRange(`A${start + index}:K${start + index}`);
    if (row.type === "Total nacional") { range.format.fill = "#DFF4F6"; range.format.font = { bold: true, color: "#075D66" }; }
    else if (row.type === "Subtotal provincia") { range.format.fill = "#E8EEF2"; range.format.font = { bold: true, color: "#243746" }; }
    else if (row.type === "Subtotal cantón") { range.format.fill = "#F5F7F9"; range.format.font = { bold: true, color: "#334155" }; }
  });
  sheet.getRange(`A5:K${end}`).format.borders = { preset: "inside", style: "thin", color: "#E2E8F0" };
  const widths = [20, 15, 24, 14, 27, 16, 27, 16, 15, 16, 16];
  widths.forEach((width, i) => sheet.getRangeByIndexes(0, i, end, 1).format.columnWidth = width);
}

async function main() {
  await fs.mkdir(CONFIG.outputDir, { recursive: true });
  const catalog = JSON.parse(await fs.readFile(CONFIG.catalogPath, "utf8"));
  const data = {};
  for (const [level, file] of Object.entries(CONFIG.geojson)) data[level] = JSON.parse(await fs.readFile(file, "utf8")).features;
  const manifest = [];
  for (const variable of catalog.variables) {
    const definition = DEFINITIONS[variable.id];
    if (!definition) throw new Error(`Falta definición de descarga para ${variable.id}`);
    const workbook = Workbook.create();
    buildReadme(workbook, variable);
    buildMethod(workbook, variable, definition);
    variable.anios_disponibles.forEach((year) => buildYear(workbook, variable, definition, year, data));
    const outputPath = path.join(CONFIG.outputDir, `${variable.id}.xlsx`);
    const file = await SpreadsheetFile.exportXlsx(workbook);
    await file.save(outputPath);
    const stats = await fs.stat(outputPath);
    manifest.push({ id: variable.id, archivo: `${variable.id}.xlsx`, bytes: stats.size, hojas: 2 + variable.anios_disponibles.length, anios: variable.anios_disponibles });
    console.log(`${variable.id}: ${(stats.size / 1024).toFixed(1)} KiB`);
  }
  await fs.writeFile(path.join(CONFIG.outputDir, "manifest.json"), JSON.stringify({ generado_el: CONFIG.generatedDate, archivos: manifest }, null, 2) + "\n", "utf8");
}

await main();
