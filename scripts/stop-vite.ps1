Write-Host "Checking port 5173..." -ForegroundColor Cyan
$pids = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($pids) {
  foreach ($pid in $pids) {
    Write-Host "Stopping process $pid using port 5173..." -ForegroundColor Yellow
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  }
  Write-Host "Port 5173 is now free." -ForegroundColor Green
} else { Write-Host "Nothing is using port 5173." -ForegroundColor Green }
