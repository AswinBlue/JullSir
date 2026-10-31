# scripts/supabase-login.ps1
# Supabase CLI Login & Project Link script using .env / .env.local

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  JullSir Supabase CLI Login & Link" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Search for .env.local or .env file
$envFile = $null
if (Test-Path "$PSScriptRoot\..\.env.local") {
    $envFile = "$PSScriptRoot\..\.env.local"
    Write-Host "[INFO] Detected .env.local file." -ForegroundColor Green
} elseif (Test-Path "$PSScriptRoot\..\.env") {
    $envFile = "$PSScriptRoot\..\.env"
    Write-Host "[INFO] Detected .env file." -ForegroundColor Green
} else {
    Write-Host "[WARN] Neither .env.local nor .env found." -ForegroundColor Yellow
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

Write-Host "[INFO] Target Project ID: $projectId" -ForegroundColor Cyan

# 2. Supabase CLI Login
Write-Host ""
Write-Host "[1/2] Logging in to Supabase CLI (browser will open for authentication)..." -ForegroundColor Yellow
npx supabase login

# 3. Link Project
Write-Host ""
Write-Host "[2/2] Linking project: $projectId..." -ForegroundColor Yellow
npx supabase link --project-ref $projectId

Write-Host ""
Write-Host "[SUCCESS] Supabase project successfully linked!" -ForegroundColor Green
Write-Host "[TIP] You can now deploy edge functions: npx supabase functions deploy notify-ticket --no-verify-jwt" -ForegroundColor Cyan
