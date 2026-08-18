<#
    Puts the app on a real HTTPS address so the in-page camera works on a
    phone. Browsers only allow getUserMedia in a secure context, and a plain
    http://192.168.x.x address is not one.

    Uses Tailscale, which issues a genuine certificate for the tailnet name.
    The phone must be signed into the same tailnet.

    Usage:  powershell -ExecutionPolicy Bypass -File .\serve-https.ps1
            powershell -ExecutionPolicy Bypass -File .\serve-https.ps1 -Off
#>

param(
    [switch]$Off
)

if (-not (Get-Command tailscale -ErrorAction SilentlyContinue)) {
    Write-Host "Tailscale is not installed or not on PATH." -ForegroundColor Red
    Write-Host "Alternatives: any HTTPS tunnel in front of port 5173, or run" -ForegroundColor Gray
    Write-Host "the app on the phone over http and use the Phone camera path." -ForegroundColor Gray
    exit 1
}

if ($Off) {
    tailscale serve --https=443 off
    Write-Host "HTTPS serving stopped." -ForegroundColor Yellow
    exit 0
}

Write-Host "== HTTPS for the phone camera ==" -ForegroundColor Cyan

# The whole app is one origin: Vite proxies /api and /generated, so a single
# tunnel to 5173 covers the API and the images too.
tailscale serve --bg 5173

if ($LASTEXITCODE -ne 0) {
    Write-Host "tailscale serve failed. Is Tailscale signed in?" -ForegroundColor Red
    exit 1
}

Write-Host ""
tailscale serve status

$dns = (tailscale status --json | ConvertFrom-Json).Self.DNSName

if ($dns) {
    $url = "https://" + $dns.TrimEnd('.')
    Write-Host ""
    Write-Host "  Open this on the phone:" -ForegroundColor Green
    Write-Host "      $url" -ForegroundColor White
    Write-Host ""
    Write-Host "  Live camera will work there - it is a real certificate." -ForegroundColor Gray
    Write-Host "  Stop serving with: .\serve-https.ps1 -Off" -ForegroundColor Gray
}
