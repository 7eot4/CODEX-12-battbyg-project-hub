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

    node --check docs\assets\app.js
    if ($LASTEXITCODE -ne 0) {
        throw "JavaScript syntax validation failed."
    }

    node tests\flashcards.test.mjs
    if ($LASTEXITCODE -ne 0) {
        throw "Flashcard behavior tests failed."
    }

    if (Test-Path (Join-Path $projectRoot '..\battbygg')) {
        python tools\photo_viewer.py --validate-only
        if ($LASTEXITCODE -ne 0) {
            throw "Local photo viewer validation failed."
        }
    }

    Write-Host "BATTBYG_SITE_UPDATE_OK"
}
finally {
    Pop-Location
}
