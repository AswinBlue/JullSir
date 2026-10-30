# JullSir Preview Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  JullSir Production Preview" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if (-not (Test-Path "dist/index.html")) {
    Write-Host "[WARN] dist/index.html not found. Building production bundle first..." -ForegroundColor Yellow
    & "$PSScriptRoot/build-prod.ps1"
}

Write-Host "URL: http://localhost:4173/Jullsir/" -ForegroundColor Green
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm preview
} else {
    corepack pnpm@9 run preview
}
