# JullSir Interactive Menu
$PSScript = $PSScriptRoot

while ($true) {
    Clear-Host
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "   JullSir Management & Task Menu" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host " [1] Local Dev Server      (scripts/dev.ps1)"
    Write-Host " [2] Run Unit Tests        (scripts/test.ps1)"
    Write-Host " [3] Test Build (Dry-run)  (scripts/build-test.ps1)"
    Write-Host " [4] Production Build      (scripts/build-prod.ps1)"
    Write-Host " [5] Preview Build (dist)  (scripts/preview.ps1)"
    Write-Host " [6] Supabase Login & Link (scripts/supabase-login.ps1)"
    Write-Host " [7] Deploy Edge Function  (scripts/supabase-deploy.ps1)"
    Write-Host " [Q] Quit"
    Write-Host "--------------------------------------------------" -ForegroundColor DarkGray

    $choice = Read-Host "Select an option"

    switch ($choice) {
        "1" { & "$PSScript/dev.ps1"; break }
        "2" { & "$PSScript/test.ps1"; Read-Host "Press Enter to return to menu" }
        "3" { & "$PSScript/build-test.ps1"; Read-Host "Press Enter to return to menu" }
        "4" { & "$PSScript/build-prod.ps1"; Read-Host "Press Enter to return to menu" }
        "5" { & "$PSScript/preview.ps1"; break }
        "6" { & "$PSScript/supabase-login.ps1"; Read-Host "Press Enter to return to menu" }
        "7" { & "$PSScript/supabase-deploy.ps1"; Read-Host "Press Enter to return to menu" }
        "Q" { exit 0 }
        "q" { exit 0 }
        default { Write-Host "Invalid option. Please try again." -ForegroundColor Yellow; Start-Sleep -Seconds 1 }
    }
}
