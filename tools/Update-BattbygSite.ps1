[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

Push-Location $projectRoot
try {
    python tools\build_site.py
    if ($LASTEXITCODE -ne 0) {
        throw "Site data generation failed."
    }

    python tools\validate_site.py
    if ($LASTEXITCODE -ne 0) {
        throw "Site validation failed."
    }

    Write-Host "BATTBYG_SITE_UPDATE_OK"
}
finally {
    Pop-Location
}
