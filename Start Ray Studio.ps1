$ErrorActionPreference = 'Stop'
$rayNode = (Get-Command node -ErrorAction Stop).Source
Write-Host 'Ray Studio will be available at http://127.0.0.1:4173'
Write-Host 'Keep this terminal open while using the editor. Press Ctrl+C to stop.'
& $rayNode (Join-Path $PSScriptRoot 'serve.cjs')
