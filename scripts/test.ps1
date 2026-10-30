# JullSir Unit Test Script
param (
    [switch]$Watch
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  JullSir Logic & Unit Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($Watch) {
    Write-Host "[INFO] Starting tests in Watch mode..." -ForegroundColor Yellow
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm run test:watch
    } else {
        corepack pnpm@9 run test:watch
    }
} else {
    Write-Host "[INFO] Running all unit tests..." -ForegroundColor Yellow
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm test
    } else {
        corepack pnpm@9 run test
    }
}
