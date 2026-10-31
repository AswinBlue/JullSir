# scripts/supabase-deploy.ps1
# Deploy Supabase Edge Functions without Docker requirements

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  JullSir Edge Function Deploy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Search for .env.local or .env file
$envFile = $null
if (Test-Path "$PSScriptRoot\..\.env.local") {
    $envFile = "$PSScriptRoot\..\.env.local"
} elseif (Test-Path "$PSScriptRoot\..\.env") {
    $envFile = "$PSScriptRoot\..\.env"
}

$projectId = $null

if ($envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -match "^SUPABASE_PROJECT_ID=(.+)$") {
            $projectId = $matches[1].Trim('"').Trim("'")
        } elseif (-not $projectId -and $line -match "^VITE_SUPABASE_URL=https:\/\/([a-zA-Z0-9_\-]+)\.supabase\.co") {
            $projectId = $matches[1]
        }
    }
}

if (-not $projectId -or $projectId -eq "your-project-id") {
    Write-Host "[INPUT] Could not automatically extract Project ID from .env file." -ForegroundColor Yellow
    $projectId = Read-Host "Enter Supabase Project ID (Reference ID)"
}

if (-not $projectId) {
    Write-Host "[ERROR] Project ID is required. Aborting." -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Deploying 'notify-ticket' to project: $projectId..." -ForegroundColor Cyan

function Invoke-SupabaseCli {
    param([string[]]$CliArgs)
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm dlx supabase @CliArgs
    } else {
        corepack pnpm@9 dlx supabase @CliArgs
    }
}

# Deploy with --use-api (Server-side bundling, no local Docker needed) and --no-verify-jwt
Invoke-SupabaseCli @("functions", "deploy", "notify-ticket", "--project-ref", $projectId, "--use-api", "--no-verify-jwt")

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[SUCCESS] Edge function 'notify-ticket' deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Deployment failed. Please ensure you are logged in via 'scripts/supabase-login.ps1'." -ForegroundColor Red
    exit 1
}
