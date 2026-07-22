import json
import subprocess
import sys
import os

CONFIG = {
    "CATEGORIA_POR_PREFIJO": {
        "siniestros_": "Siniestralidad",
        "fallecidos_": "Mortalidad",
        "lesionados_": "Morbilidad",
        "tasa_": "Indicadores Relativos",
        "porcentaje_": "Indicadores Relativos",
        "osm_": "Infraestructura",
        "brt_": "Transporte Público",
        "normal": "Sistema"
    }
}

def infer_categoria(var_id):
    for prefix, cat in CONFIG["CATEGORIA_POR_PREFIJO"].items():
        if var_id.startswith(prefix):
            return cat
    return "Otras variables"

def run_node_extractor():
    # Node.js script to safely parse geoportal-registry.js and evaluate sin_dato on GeoJSON
    node_script = """
    const fs = require('fs');
    
    // Polyfill window to load registry
    global.window = {};
    const code = fs.readFileSync('docs/assets/js/geoportal-registry.js', 'utf8');
    eval(code);
    
    const variables = window.REDSA_GEO_CONFIG.variables;
    const geojsons = {
        province: JSON.parse(fs.readFileSync('docs/data/provincias_wgs84.geojson', 'utf8')),
        canton: JSON.parse(fs.readFileSync('docs/data/cantones_wgs84.geojson', 'utf8')),
        parish: JSON.parse(fs.readFileSync('docs/data/parroquias_wgs84.geojson', 'utf8'))
    };

    const results = {};

    for (const [id, config] of Object.entries(variables)) {
        let explicit_sin_dato = false;
        let has_missing = false;

        // Try to evaluate getValue or property for all features and years
        if (config.levels && config.levels.length > 0) {
            const level = config.levels[0]; // test on the first available level
            if (geojsons[level]) {
                const features = geojsons[level].features;
                const years = config.temporal && config.temporal.anios_disponibles ? config.temporal.anios_disponibles : [null];
                
                for (const feature of features) {
                    for (const year of years) {
                        let val = null;
                        if (config.getValue) {
                            try { val = config.getValue(feature.properties, year); } catch (e) {}
                        } else if (config.property) {
                            val = feature.properties[config.property];
                        }

                        if (val === -9999 || (typeof val === 'number' && val < 0)) {
                            explicit_sin_dato = true;
                        } else if (val === null || val === undefined || val === '') {
                            has_missing = true;
                        }
                    }
                    
                    // Specific check for user's mentioned EDG cobertura in detailed properties
                    // (if a variable name matches fallecidos, we peek into fallecidos_detallado)
                    if (id.includes('fallecidos') && feature.properties.fallecidos_detallado) {
                        for (const year of years) {
                            if (year && feature.properties.fallecidos_detallado[year]) {
                                const det = feature.properties.fallecidos_detallado[year];
                                if (det.estado === 'sin_dato' || (det.cobertura && det.cobertura.usuario_conocido === 0 && det.total > 0)) {
                                    explicit_sin_dato = true;
                                }
                            }
                        }
                    }
                }
            }
        }

        results[id] = {
            id: id,
            label: config.label,
            fuente: config.fuente || null,
            description: config.description || null,
            unidad: config.unidad || null,
            metodologia: config.metodologia || null,
            licencia: config.licencia || null,
            referencias: config.referencias || [],
            anios_disponibles: config.temporal ? config.temporal.anios_disponibles : [],
            nivel_territorial_disponible: config.levels || [],
            explicit_sin_dato: explicit_sin_dato,
            has_missing: has_missing
        };
    }

    console.log(JSON.stringify(results));
    """
    
    with open("temp_extractor.cjs", "w", encoding="utf-8") as f:
        f.write(node_script)
    
    try:
        result = subprocess.run(
            ["node", "temp_extractor.cjs"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=True,
        )
        return json.loads(result.stdout)
    finally:
        if os.path.exists("temp_extractor.cjs"):
            os.remove("temp_extractor.cjs")

def main():
    print("Ejecutando extractor de Node...")
    try:
        raw_vars = run_node_extractor()
    except subprocess.CalledProcessError as e:
        print("Error ejecutando Node:", e.stderr)
        sys.exit(1)

    catalogo = []
    
    vars_con_fuente = 0
    vars_total = 0
    
    vars_declarando_sin_dato = 0
    vars_con_faltantes = 0

    for var_id, var_data in raw_vars.items():
        if var_id == "normal":
            continue # Omitir el mapa base administrativo de las metricas

        # Validaciones de campos
        if not var_data.get("label"):
            print(f"Warning: La variable '{var_id}' no tiene 'label'.")
            
        fuente = var_data["fuente"]
        if not fuente:
            print(f"Warning: La variable '{var_id}' no tiene 'fuente'. Asignando 'fuente_pendiente_confirmar'.")
            fuente = "fuente_pendiente_confirmar"
        else:
            vars_con_fuente += 1
            
        vars_total += 1

        if var_data["explicit_sin_dato"]:
            vars_declarando_sin_dato += 1
            vars_con_faltantes += 1
        elif var_data["has_missing"]:
            vars_con_faltantes += 1

        catalogo.append({
            "id": var_data["id"],
            "label": var_data["label"],
            "categoria": infer_categoria(var_id),
            "fuente": fuente,
            "descripcion": var_data["description"],
            "unidad": var_data["unidad"],
            "metodologia": var_data["metodologia"],
            "licencia": var_data["licencia"],
            "referencias": var_data["referencias"],
            "anios_disponibles": var_data["anios_disponibles"],
            "nivel_territorial_disponible": var_data["nivel_territorial_disponible"],
            "descargas": {
                "excel": f"descargas/{var_id}.xlsx",
                "geojson_niveles": var_data["nivel_territorial_disponible"],
            },
        })

    pct_fuente = (vars_con_fuente / vars_total) * 100 if vars_total > 0 else 0
    pct_sindato = (vars_declarando_sin_dato / vars_con_faltantes) * 100 if vars_con_faltantes > 0 else 100

    output = {
        "resumen_transparencia": {
            "pct_variables_con_fuente_documentada": round(pct_fuente, 1),
            "pct_cobertura_sin_dato_declarado": round(pct_sindato, 1),
            "vars_total": vars_total,
            "vars_con_fuente": vars_con_fuente,
            "vars_con_faltantes": vars_con_faltantes,
            "vars_declarando_sin_dato": vars_declarando_sin_dato
        },
        "variables": catalogo
    }

    os.makedirs("docs/data", exist_ok=True)
    with open("docs/data/catalogo_metadatos.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
        
    print("\n--- RESUMEN ---")
    print(f"Variables analizadas: {vars_total}")
    print(f"Variables con fuente: {vars_con_fuente} ({pct_fuente:.1f}%)")
    print(f"Variables que declaran explícitamente sin_dato frente a vacíos: {vars_declarando_sin_dato} de {vars_con_faltantes} ({pct_sindato:.1f}%)")
    print("Guardado en docs/data/catalogo_metadatos.json")

if __name__ == "__main__":
    main()
