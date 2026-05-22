# Encerra processos Node ligados ao monorepo leadflow-ai (API, web, worker, turbo)
$root = (Resolve-Path "$PSScriptRoot\..").Path
Get-CimInstance Win32_Process -Filter "name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object {
    $_.CommandLine -and
    $_.CommandLine -like "*$root*" -and
    $_.CommandLine -notlike '*\cursor\resources\*'
  } |
  ForEach-Object {
    Write-Host "Encerrando PID $($_.ProcessId): $($_.CommandLine.Substring(0, [Math]::Min(100, $_.CommandLine.Length)))..."
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
& "$PSScriptRoot\dev-ports.ps1"
Start-Sleep -Seconds 2
