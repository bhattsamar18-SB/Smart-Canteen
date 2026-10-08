param([string]$Url = 'http://localhost:1311')
$deadline = (Get-Date).AddSeconds(30)
while ((Get-Date) -lt $deadline) {
  try {
    Invoke-WebRequest -Uri "$Url/api/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
    Start-Process $Url
    break
  } catch {
    Start-Sleep -Milliseconds 500
  }
}
