[CmdletBinding()]
param(
    [int]$Port = 4180,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Push-Location $projectRoot
try {
    $arguments = @('tools\photo_viewer.py', '--port', $Port)
    if ($NoBrowser) {
        $arguments += '--no-browser'
    }
    & python -u @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Uruchomienie przeglądarki zdjęć nie powiodło się."
    }
}
finally {
    Pop-Location
}
