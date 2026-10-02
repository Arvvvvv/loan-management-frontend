$root = Split-Path -Parent $PSScriptRoot
& "$PSScriptRoot\stop-vite.ps1"
Write-Host "Starting backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit','-Command',"Set-Location '$root\server'; if (!(Test-Path .env)) { Copy-Item .env.example .env }; npm install; npm run dev"
Start-Sleep -Seconds 3
Write-Host "Starting NEW Business Loan frontend on http://localhost:5173 ..." -ForegroundColor Green
Set-Location "$root\client"
if (!(Test-Path node_modules)) { npm install }
npm run dev
