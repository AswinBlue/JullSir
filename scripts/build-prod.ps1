# JullSir Production Build Script
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  JullSir Production Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Type Check
Write-Host "[1/2] Checking TypeScript types..." -ForegroundColor Yellow
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm typecheck
} else {
    corepack pnpm@9 run typecheck
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Type check failed." -ForegroundColor Red
    exit 1
}

# 2. Production Bundle
Write-Host "[2/2] Running Vite Production Build..." -ForegroundColor Yellow
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm build
} else {
    corepack pnpm@9 run build
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[SUCCESS] Production build completed successfully!" -ForegroundColor Green
    Write-Host "Output Directory: dist/" -ForegroundColor Gray
    Get-ChildItem dist | Format-Table Name, Length, LastWriteTime
} else {
    Write-Host "[FAIL] Production build failed." -ForegroundColor Red
    exit 1
}
