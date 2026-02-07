param(
  [string]$ProjectRoot = "e:\account-android-app\AccountApp"
)

$BackupDir = Join-Path $ProjectRoot "backup\optionA_before_20260207_223904"

Copy-Item (Join-Path $BackupDir 'App.tsx') (Join-Path $ProjectRoot 'App.tsx') -Force
Copy-Item (Join-Path $BackupDir 'LedgerContactDetailScreen.js') (Join-Path $ProjectRoot 'src\screens\LedgerContactDetailScreen.js') -Force
Copy-Item (Join-Path $BackupDir 'package.json') (Join-Path $ProjectRoot 'package.json') -Force
Copy-Item (Join-Path $BackupDir 'package-lock.json') (Join-Path $ProjectRoot 'package-lock.json') -Force

Push-Location $ProjectRoot
npm ci
Pop-Location

Write-Output "Restore complete: code + packages reverted to backup snapshot." 
