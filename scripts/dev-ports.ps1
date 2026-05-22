# Libera portas 3000 e 3001 antes de `pnpm dev` (Windows)
$ports = 3000, 3001
foreach ($port in $ports) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object {
      $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
      if ($p -and $p.ProcessName -ne 'Idle') {
        Write-Host "Encerrando $($p.ProcessName) (PID $($_.OwningProcess)) na porta $port"
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
      }
    }
}
Write-Host "Portas 3000/3001 liberadas. Rode: pnpm dev"
