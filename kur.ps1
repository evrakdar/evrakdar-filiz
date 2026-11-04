# Evrakdar kurulumu (Windows). Kullanim: powershell -ExecutionPolicy Bypass -File kur.ps1
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$composeArgs = @("compose", "-f", "docker/docker-compose.prod.yml", "--env-file", ".env.production")
$webPort = if ($env:WEB_PORT) { $env:WEB_PORT } else { "3000" }
$apiPort = if ($env:API_PORT) { $env:API_PORT } else { "3001" }

$ErrorActionPreference = "Continue"
docker info *> $null
$dockerOk = $LASTEXITCODE -eq 0
$ErrorActionPreference = "Stop"
if (-not $dockerOk) {
  Write-Host "Docker calismiyor. Docker Desktop'i kurup acin, sonra tekrar deneyin: https://www.docker.com/products/docker-desktop/"
  exit 1
}

function New-RandomValue([int]$length) {
  $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".ToCharArray()
  $bytes = New-Object byte[] $length
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

if (-not (Test-Path ".env.production")) {
  $orgName = if ($null -ne $env:ORG_NAME) { $env:ORG_NAME } else { Read-Host "Kurumunuzun adi (ekranda gorunur)" }
  $content = @"
PUBLIC_WEB_URL="http://localhost:$webPort"
PUBLIC_API_URL="http://localhost:$apiPort"
APP_NAME="Evrakdar"
ORG_NAME="$orgName"
POSTGRES_PASSWORD="$(New-RandomValue 32)"
JWT_SECRET="$(New-RandomValue 64)"
JWT_EXPIRES_IN="8h"
SEED_ADMIN_USERNAME="admin"
SEED_ADMIN_PASSWORD=""
SEED_ADMIN_EMAIL=""
WEB_BIND="127.0.0.1:$webPort"
API_BIND="127.0.0.1:$apiPort"
TRUST_PROXY=""
"@
  [System.IO.File]::WriteAllText((Join-Path $PWD ".env.production"), ($content -replace "`r`n", "`n"), (New-Object System.Text.UTF8Encoding $false))
  Write-Host "Ayar dosyasi olusturuldu: .env.production"
}

$ErrorActionPreference = "Continue"
Write-Host "Sistem hazirlaniyor. Ilk kurulum 5-15 dakika surebilir."
& docker @composeArgs up -d --build
if ($LASTEXITCODE -ne 0) { Write-Host "Kurulum tamamlanamadi."; exit 1 }

Write-Host "Sistemin acilmasi bekleniyor..."
$probe = "fetch('http://127.0.0.1:3001/health').then(r=>process.stdout.write(String(r.status))).catch(()=>process.stdout.write('0'))"
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  $status = & docker @composeArgs exec -T api node -e $probe 2>$null
  if ($status -eq "200") { $ready = $true; break }
  Start-Sleep -Seconds 5
}
if (-not $ready) { Write-Host "Sistem acilamadi. Kayitlara bakin: docker compose -f docker/docker-compose.prod.yml --env-file .env.production logs api"; exit 1 }

& docker @composeArgs run --rm api npx prisma db seed
if ($LASTEXITCODE -ne 0) { Write-Host "Baslangic hesaplari olusturulamadi."; exit 1 }

$url = (Select-String -Path ".env.production" -Pattern '^PUBLIC_WEB_URL="(.*)"$').Matches[0].Groups[1].Value
Write-Host ""
Write-Host "Evrakdar calisiyor: $url"
Write-Host "Giris bilgileri yukarida yaziyor. Daha once kurduysaniz sifreleriniz degismedi."
