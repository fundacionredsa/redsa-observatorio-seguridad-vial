param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectDriveRoot,

    [string]$GeoportalRepo = (Split-Path -Parent $PSScriptRoot),
    [string]$PipelinesRepo = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'redsa-observatorio-pipelines'),
    [string]$PackageName = 'AUDITORIA_REDSA_OBSERVA_2026-07-16'
)

$ErrorActionPreference = 'Stop'
$DevelopmentRoot = Join-Path $ProjectDriveRoot '05_DESARROLLO'
$OutputRoot = Join-Path (Join-Path $DevelopmentRoot '02_ENTREGADOS') $PackageName
$SourceRoot = Join-Path (Join-Path $DevelopmentRoot '01_EN PROCESO') '03_DATOS_FUENTES'

if (Test-Path -LiteralPath $OutputRoot) {
    throw "El paquete ya existe: $OutputRoot. Cambie PackageName para conservar entregas previas."
}
foreach ($requiredPath in @($GeoportalRepo, $PipelinesRepo, $SourceRoot)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "No existe la entrada requerida: $requiredPath"
    }
}

$DocumentationDir = Join-Path $OutputRoot '01_DOCUMENTACION'
$BundlesDir = Join-Path $OutputRoot '02_RESPALDOS_GIT'
$EvidenceDir = Join-Path $OutputRoot '03_EVIDENCIA_VALIDACION'
$InventoryDir = Join-Path $OutputRoot '04_INVENTARIO_FUENTES'
$ManifestDir = Join-Path $OutputRoot '05_INDICES_Y_MANIFIESTOS'
foreach ($directory in @($DocumentationDir, $BundlesDir, $EvidenceDir, $InventoryDir, $ManifestDir)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

function Copy-SelectedFiles([string]$Source, [string]$Destination, [string[]]$Names) {
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    foreach ($name in $Names) {
        $path = Join-Path $Source $name
        if (Test-Path -LiteralPath $path) {
            Copy-Item -LiteralPath $path -Destination $Destination -Recurse
        }
    }
}

function Get-RelativePathCompat([string]$BasePath, [string]$TargetPath) {
    $base = [System.IO.Path]::GetFullPath($BasePath).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    $target = [System.IO.Path]::GetFullPath($TargetPath)
    if (-not $target.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) {
        if ($target.TrimEnd('\', '/') -eq $base.TrimEnd('\', '/')) { return '' }
        throw "La ruta $target no esta dentro de $base"
    }
    return $target.Substring($base.Length)
}

function Get-TopLevelName([string]$BasePath, [string]$DirectoryPath) {
    $relative = Get-RelativePathCompat $BasePath $DirectoryPath
    if ([string]::IsNullOrWhiteSpace($relative)) { return 'RAIZ' }
    return ($relative -split '[\\/]')[0]
}

Copy-Item -LiteralPath (Join-Path $GeoportalRepo 'documentacion') -Destination (Join-Path $DocumentationDir 'geoportal') -Recurse
Copy-SelectedFiles $GeoportalRepo (Join-Path $DocumentationDir 'geoportal_raiz') @(
    'README.md', 'CHANGELOG.md', 'LICENSE', 'LICENSE-DATA.md', 'package.json',
    'package-lock.json', 'playwright.config.js'
)
Copy-SelectedFiles $PipelinesRepo (Join-Path $DocumentationDir 'pipelines') @(
    'README.md', 'CHANGELOG.md', 'LICENSE', 'requirements.txt', '.env.example'
)
Copy-Item -LiteralPath (Join-Path $PipelinesRepo 'geoportal_estadisticas\README.md') -Destination (Join-Path $DocumentationDir 'pipelines\GEOportal_ESTADISTICAS_README.md')

Copy-Item -LiteralPath (Join-Path $GeoportalRepo 'artifacts\screenshots') -Destination (Join-Path $EvidenceDir 'capturas') -Recurse
Copy-Item -LiteralPath (Join-Path $GeoportalRepo 'artifacts\performance') -Destination (Join-Path $EvidenceDir 'rendimiento') -Recurse
Copy-Item -LiteralPath (Join-Path $GeoportalRepo 'documentacion\evidencia_validacion.json') -Destination $EvidenceDir

$inventory = foreach ($file in Get-ChildItem -LiteralPath $SourceRoot -File -Recurse | Sort-Object FullName) {
    $relative = Get-RelativePathCompat $SourceRoot $file.FullName
    $lower = $relative.ToLowerInvariant()
    $classification = if ($lower -match 'edg_|sppat|siniestros|vehiculos|estra|\.sav$') {
        'USO_INTERNO_RESTRINGIDO'
    } elseif ($lower -match 'territorial|cantonal|conali|shp_inec|fuentes_confirmadas') {
        'FUENTE_OFICIAL_ABIERTA_O_METADATO'
    } else {
        'REVISAR_ANTES_DE_COMPARTIR'
    }
    [pscustomobject]@{
        ruta_relativa = $relative
        tamano_bytes = $file.Length
        modificado_utc = $file.LastWriteTimeUtc.ToString('o')
        sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        clasificacion_privacidad = $classification
        copiado_al_paquete = 'NO'
    }
}
$inventoryPath = Join-Path $InventoryDir 'inventario_fuentes_sha256.csv'
$inventory | Export-Csv -LiteralPath $inventoryPath -NoTypeInformation -Encoding utf8

$privacyNote = @"
# Privacidad del inventario de fuentes

Este directorio contiene rutas relativas, tamanos, fechas y hashes SHA-256. No
duplica microdatos. Los archivos EDG, SPPAT, ESTRA y siniestros a nivel de
registro se clasifican conservadoramente como `USO_INTERNO_RESTRINGIDO` por el
riesgo de reidentificacion mediante combinaciones territoriales, demograficas o
temporales. Un hash permite verificar integridad sin exponer el contenido.
"@
$privacyNote | Set-Content -LiteralPath (Join-Path $InventoryDir 'README.md') -Encoding utf8

$geoBundle = Join-Path $BundlesDir 'redsa-observatorio-seguridad-vial.bundle'
$pipelineBundle = Join-Path $BundlesDir 'redsa-observatorio-pipelines.bundle'
& git -C $GeoportalRepo bundle create $geoBundle --all
if ($LASTEXITCODE -ne 0) { throw 'Fallo al crear el bundle del geoportal.' }
& git -C $PipelinesRepo bundle create $pipelineBundle --all
if ($LASTEXITCODE -ne 0) { throw 'Fallo al crear el bundle de pipelines.' }
$geoVerify = (& git -C $GeoportalRepo bundle verify $geoBundle 2>&1) -join "`n"
$pipelineVerify = (& git -C $PipelinesRepo bundle verify $pipelineBundle 2>&1) -join "`n"

$restore = @"
# Restaurar los repositorios

```powershell
git clone redsa-observatorio-seguridad-vial.bundle redsa-observatorio-seguridad-vial
git clone redsa-observatorio-pipelines.bundle redsa-observatorio-pipelines
```

Los bundles preservan ramas, etiquetas e historial disponible. Verificacion al
crear esta entrega:

## Geoportal

```text
$geoVerify
```

## Pipelines

```text
$pipelineVerify
```
"@
$restore | Set-Content -LiteralPath (Join-Path $BundlesDir 'RESTAURAR.md') -Encoding utf8

$environment = @(
    "Generado: $((Get-Date).ToString('o'))",
    "Sistema: $([System.Environment]::OSVersion.VersionString)",
    "PowerShell: $($PSVersionTable.PSVersion)",
    "Python: $(& python --version 2>&1)",
    "Node: $(& node --version 2>&1)",
    "npm: $(& npm --version 2>&1)",
    "Git: $(& git --version 2>&1)",
    "Playwright: $(& npx playwright --version 2>&1)"
)
$environment | Set-Content -LiteralPath (Join-Path $ManifestDir 'ENTORNO_EJECUCION.txt') -Encoding utf8

$index = @"
# Auditoria REDSA Observa 2026-07-16

Este paquete permite auditar, mantener y restaurar el geoportal sin depender de
contexto oral. Fecha de corte: **2026-07-16**.

## Por donde empezar

- Auditor de datos: `01_DOCUMENTACION/geoportal/VALIDACION.md`,
  `DICCIONARIO_DATOS.md`, `METODOLOGIA.md` y
  `04_INVENTARIO_FUENTES/inventario_fuentes_sha256.csv`.
- Desarrollo: `01_DOCUMENTACION/geoportal/ARQUITECTURA.md`, los ADR,
  `DESPLIEGUE_Y_OPERACION.md` y los bundles de `02_RESPALDOS_GIT`.
- Diseno: `01_DOCUMENTACION/geoportal/UI_COMPONENTES.md`,
  `SISTEMA_DISENO.md` y las 48 capturas en `03_EVIDENCIA_VALIDACION/capturas`.
- Gestion: `ESTADO_ACTUAL_2026-07-16.md`, `PROBLEMAS_CONOCIDOS.md` y los
  changelogs de ambos repositorios.

## Estructura

1. `01_DOCUMENTACION`: documentacion canonica, licencias y entornos fijados.
2. `02_RESPALDOS_GIT`: dos bundles con historial y guia de restauracion.
3. `03_EVIDENCIA_VALIDACION`: conciliaciones, rendimiento y 48 capturas.
4. `04_INVENTARIO_FUENTES`: inventario con hashes; no contiene microdatos.
5. `05_INDICES_Y_MANIFIESTOS`: entorno e integridad del paquete.

## Privacidad

No se copiaron EDG, SPPAT, ESTRA, datos de siniestros a nivel de registro ni
credenciales. Solo se incluyen agregados publicados, documentacion, evidencia
visual e identificadores de integridad.

## Regeneracion

El paquete fue creado con
`scripts/crear_paquete_auditoria.ps1` del repo publico. El manifiesto SHA-256
permite detectar cualquier alteracion posterior.
"@
$index | Set-Content -LiteralPath (Join-Path $OutputRoot 'README.md') -Encoding utf8

$filesBeforeManifest = Get-ChildItem -LiteralPath $OutputRoot -File -Recurse
$summary = $filesBeforeManifest | Group-Object { Get-TopLevelName $OutputRoot $_.DirectoryName } | ForEach-Object {
    $bytes = ($_.Group | Measure-Object Length -Sum).Sum
    "- ``$($_.Name)``: $($_.Count) archivos, $([math]::Round($bytes / 1MB, 2)) MiB"
}
(@("# Inventario del paquete", "", "Total previo al manifiesto: $($filesBeforeManifest.Count) archivos.", "") + $summary) |
    Set-Content -LiteralPath (Join-Path $ManifestDir 'INVENTARIO_ARCHIVOS.md') -Encoding utf8

$manifest = foreach ($file in Get-ChildItem -LiteralPath $OutputRoot -File -Recurse | Sort-Object FullName) {
    [pscustomobject]@{
        ruta_relativa = Get-RelativePathCompat $OutputRoot $file.FullName
        tamano_bytes = $file.Length
        sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}
$manifest | Export-Csv -LiteralPath (Join-Path $ManifestDir 'MANIFEST_SHA256.csv') -NoTypeInformation -Encoding utf8

Write-Host "Paquete creado: $OutputRoot"
Write-Host "Fuentes inventariadas: $($inventory.Count)"
Write-Host "Archivos en manifiesto: $($manifest.Count)"
