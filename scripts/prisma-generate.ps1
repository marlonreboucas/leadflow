# Gera Prisma Client no Windows sem EPERM (para API/worker antes)
$ErrorActionPreference = 'Continue'
Write-Host 'Parando processos LeadFlow (Node + portas 3000/3001)...'
& "$PSScriptRoot\stop-leadflow-node.ps1"

$clientDir = Join-Path $PSScriptRoot '..\node_modules\.pnpm\@prisma+client@5.22.0_prisma@5.22.0\node_modules\.prisma\client'
if (Test-Path $clientDir) {
  Write-Host 'Removendo engines antigos em .prisma/client...'
  Remove-Item -Path (Join-Path $clientDir 'query_engine-windows.dll.node*') -Force -ErrorAction SilentlyContinue
}

Set-Location (Join-Path $PSScriptRoot '..')
$max = 3
for ($i = 1; $i -le $max; $i++) {
  Write-Host "prisma generate (tentativa $i/$max)..."
  pnpm db:generate
  if ($LASTEXITCODE -eq 0) {
    Write-Host 'Prisma generate OK.'
    exit 0
  }
  if ($i -lt $max) {
    Write-Host 'EPERM ou falha - aguardando 3s e repetindo...'
    Start-Sleep -Seconds 3
    & "$PSScriptRoot\stop-leadflow-node.ps1"
  }
}

Write-Host ''
Write-Host 'Ainda falhou. Feche terminais com pnpm dev / nest --watch e rode:'
Write-Host '  pnpm db:generate:win'
Write-Host 'Ou exclua a pasta do projeto no Windows Defender.'
exit 1
