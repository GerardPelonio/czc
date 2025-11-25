Param(
  [string]$BASEURL = $(throw "Usage: .\validate_deploy.ps1 -BASEURL <url>")
)

Write-Host "Smoke-test: $BASEURL"

$paths = @('/', '/health', '/api/debug/db', '/api/home')

foreach ($p in $paths) {
  try {
    $u = "$BASEURL$p"
    Write-Host "Testing $u"
    $r = Invoke-RestMethod -Uri $u -Method GET -TimeoutSec 30
    Write-Host "OK: $($r | ConvertTo-Json -Depth 2)"
  } catch {
    Write-Host "ERROR calling $u : $($_.Exception.Message)"
  }
}
