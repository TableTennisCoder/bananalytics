# download-geoip.ps1 — Downloads the MaxMind GeoLite2-City database for Bananalytics.
#
# Usage:
#   $env:MAXMIND_LICENSE_KEY = "xxx"
#   .\scripts\download-geoip.ps1
#
# Get a free license key: https://www.maxmind.com/en/geolite2/signup

$ErrorActionPreference = "Stop"

if (-not $env:MAXMIND_LICENSE_KEY) {
    Write-Host "ERROR: MAXMIND_LICENSE_KEY environment variable is required." -ForegroundColor Red
    Write-Host ""
    Write-Host "Get a free license key at:"
    Write-Host "  https://www.maxmind.com/en/geolite2/signup"
    Write-Host ""
    Write-Host "Then run:"
    Write-Host '  $env:MAXMIND_LICENSE_KEY = "your_key_here"'
    Write-Host "  .\scripts\download-geoip.ps1"
    exit 1
}

$GeoIpDir = ".\geoip"
$TmpDir = New-Item -ItemType Directory -Path ([System.IO.Path]::GetTempPath() + [System.Guid]::NewGuid().ToString())

try {
    New-Item -ItemType Directory -Path $GeoIpDir -Force | Out-Null

    $DownloadUrl = "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=$env:MAXMIND_LICENSE_KEY&suffix=tar.gz"
    $TarFile = Join-Path $TmpDir "geoip.tar.gz"

    Write-Host "Downloading MaxMind GeoLite2-City database..."
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $TarFile -UseBasicParsing

    Write-Host "Extracting..."
    tar -xzf $TarFile -C $TmpDir.FullName

    $Mmdb = Get-ChildItem -Path $TmpDir.FullName -Recurse -Filter "GeoLite2-City.mmdb" | Select-Object -First 1
    if (-not $Mmdb) {
        Write-Host "ERROR: GeoLite2-City.mmdb not found in archive." -ForegroundColor Red
        exit 1
    }

    $Dest = Join-Path $GeoIpDir "GeoLite2-City.mmdb"
    Move-Item -Path $Mmdb.FullName -Destination $Dest -Force

    $SizeMB = [math]::Round((Get-Item $Dest).Length / 1MB, 1)
    Write-Host ""
    Write-Host "Done! Database saved to: $Dest ($SizeMB MB)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Set in your env: BANANA_GEOIP_DB=/app/geoip/GeoLite2-City.mmdb"
    Write-Host "  2. Restart the server: docker-compose restart bananalytics"
    Write-Host ""
    Write-Host "Tip: MaxMind updates the database weekly. Re-run monthly to stay current."
}
finally {
    Remove-Item -Path $TmpDir.FullName -Recurse -Force -ErrorAction SilentlyContinue
}
