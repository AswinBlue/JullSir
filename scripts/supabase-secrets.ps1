param(
    [string]$SecretArg = ""
)

# scripts/supabase-secrets.ps1
# Set Supabase Secrets without Docker or npm/npx bug

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  JullSir Supabase Secrets Manager" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Search for .env.local or .env file
$envFile = $null
if (Test-Path "$PSScriptRoot\..\.env.local") {
    $envFile = "$PSScriptRoot\..\.env.local"
} elseif (Test-Path "$PSScriptRoot\..\.env") {
    $envFile = "$PSScriptRoot\..\.env"
}

$projectId = $null
$defaultKey = $null

if ($envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -match "^SUPABASE_PROJECT_ID=(.+)$") {
            $projectId = $matches[1].Trim('"').Trim("'")
        } elseif (-not $projectId -and $line -match "^VITE_SUPABASE_URL=https:\/\/([a-zA-Z0-9_\-]+)\.supabase\.co") {
            $projectId = $matches[1]
        } elseif ($line -match "^RESEND_API_KEY=(.+)$") {
            $defaultKey = $matches[1].Trim('"').Trim("'")
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

if (-not $SecretArg) {
    Write-Host ""
    if ($defaultKey) {
        Write-Host "Detected RESEND_API_KEY in .env file: $defaultKey" -ForegroundColor Green
        $userInput = Read-Host "Enter secret pair [Press Enter to use RESEND_API_KEY=$defaultKey]"
        if (-not $userInput) {
            $SecretArg = "RESEND_API_KEY=$defaultKey"
        } else {
            $SecretArg = $userInput
        }
    } else {
        Write-Host "Enter secret pair or key (e.g. RESEND_API_KEY=re_xxxx or just re_xxxx):" -ForegroundColor Yellow
        $SecretArg = Read-Host "Secret Pair"
    }
}

if (-not $SecretArg) {
    Write-Host "[ERROR] Secret pair is required. Aborting." -ForegroundColor Red
    exit 1
}

# If user just pasted the raw key starting with re_, auto prefix RESEND_API_KEY=
if ($SecretArg -match "^re_[a-zA-Z0-9_\-]+$") {
    $SecretArg = "RESEND_API_KEY=$SecretArg"
}

function Invoke-SupabaseCli {
    param([string[]]$CliArgs)
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm dlx supabase @CliArgs
    } else {
        corepack pnpm@9 dlx supabase @CliArgs
    }
}

Write-Host ""
Write-Host "[INFO] Setting secret on project $projectId..." -ForegroundColor Yellow
Invoke-SupabaseCli @("secrets", "set", $SecretArg, "--project-ref", $projectId)

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[SUCCESS] Supabase secret set successfully!" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Failed to set secret. Please verify your login status with 'scripts/supabase-login.ps1'." -ForegroundColor Red
    exit 1
}
