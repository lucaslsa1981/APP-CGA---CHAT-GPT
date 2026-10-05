$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    node tools/package.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar pacote' }
    $packagePath = Join-Path $PSScriptRoot 'dist/APP-CGA'
    $zipPath = Join-Path $PSScriptRoot 'dist/APP-CGA-download.zip'
    Compress-Archive -LiteralPath $packagePath -DestinationPath $zipPath -Force
    Write-Output "Download preparado: $zipPath"
} finally { Pop-Location }
