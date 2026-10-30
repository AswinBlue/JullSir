# JullSir Test Build Script
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  JullSir Test Build & Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Unit Tests
Write-Host "[1/3] Running Unit Tests..." -ForegroundColor Yellow
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm test
} else {
    corepack pnpm@9 run test
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Unit tests failed." -ForegroundColor Red
    exit 1
}

# 2. Type Check
Write-Host "[2/3] Checking TypeScript types..." -ForegroundColor Yellow
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm typecheck
} else {
    corepack pnpm@9 run typecheck
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Type check failed." -ForegroundColor Red
    exit 1
}

# 3. Test Build
Write-Host "[3/3] Running Staging Build..." -ForegroundColor Yellow
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm run build:test
} else {
    corepack pnpm@9 run build:test
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[SUCCESS] Test build and verification completed successfully!" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Test build failed." -ForegroundColor Red
    exit 1
}
