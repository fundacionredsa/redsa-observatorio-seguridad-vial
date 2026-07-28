import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "docs", "data");
const CANTON_INPUT = path.join(DATA_DIR, "cantones_wgs84.geojson");
const HOTSPOT_LEGACY_INPUT = path.join(DATA_DIR, "hotspots_cantonales.geojson");
const CANTON_INDEX_OUTPUT = path.join(DATA_DIR, "cantones_indice.json");
const HOTSPOT_OUTPUT = path.join(DATA_DIR, "hotspots_cantonales.json");

const cantons = JSON.parse(fs.readFileSync(CANTON_INPUT, "utf8"));

const cantonIndex = {
    schema_version: "1.0",
    description: "Indice minimo para busqueda; la geometria cantonal se carga bajo demanda.",
    cantones: (cantons.features || []).map(feature => {
        const props = feature.properties || {};
        return {
            DPA_CANTON: props.DPA_CANTON,
            DPA_DESCAN: props.DPA_DESCAN,
            DPA_PROVIN: props.DPA_PROVIN,
            DPA_DESPRO: props.DPA_DESPRO
        };
    })
};

let hotspotIndex;
if (fs.existsSync(HOTSPOT_LEGACY_INPUT)) {
    const hotspots = JSON.parse(fs.readFileSync(HOTSPOT_LEGACY_INPUT, "utf8"));
    hotspotIndex = {
        schema_version: "1.0",
        description: "Resultados espaciales cantonales indexados por DPA; no contiene geometria.",
        por_dpa: Object.fromEntries((hotspots.features || []).map(feature => {
            const props = feature.properties || {};
            return [String(props.DPA_CANTON), {
                hotspot_gi: props.hotspot_gi || null,
                local_moran: props.local_moran || null,
                tasa_fallecidos_100k_por_anio: props.tasa_fallecidos_100k_por_anio || null
            }];
        }))
    };
} else {
    hotspotIndex = JSON.parse(fs.readFileSync(HOTSPOT_OUTPUT, "utf8"));
}

fs.writeFileSync(CANTON_INDEX_OUTPUT, JSON.stringify(cantonIndex), "utf8");
fs.writeFileSync(HOTSPOT_OUTPUT, JSON.stringify(hotspotIndex), "utf8");

console.log(JSON.stringify({
    cantonIndex: { file: CANTON_INDEX_OUTPUT, records: cantonIndex.cantones.length },
    hotspotIndex: { file: HOTSPOT_OUTPUT, records: Object.keys(hotspotIndex.por_dpa).length }
}, null, 2));
