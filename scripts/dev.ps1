# JullSir Local Dev Server Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  JullSir Local Dev Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "URL: http://localhost:3000/Jullsir/" -ForegroundColor Green
Write-Host ""

if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm dev
} else {
    corepack pnpm@9 dev
}
