<#
    Prints the address to open on a phone, checks the Windows Firewall rules
    the phone needs, and starts the whole pipeline bound to the LAN.

    Usage:  powershell -ExecutionPolicy Bypass -File .\run-mobile.ps1
#>

$root = $PSScriptRoot

Write-Host "== Diabetic Retinopathy platform - mobile mode ==" -ForegroundColor Cyan

# ---------------------------------------------------------------
# 1. Find the LAN address of this machine
# ---------------------------------------------------------------

$lan = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
        $_.IPAddress -notlike '127.*' -and
        $_.IPAddress -notlike '169.254.*' -and
        $_.PrefixOrigin -ne 'WellKnown'
    } |
    Sort-Object -Property @{ Expression = { $_.IPAddress -like '192.168.*' } } -Descending |
    Select-Object -First 1 -ExpandProperty IPAddress

if (-not $lan) {
    Write-Host "No LAN address found. Connect this machine to Wi-Fi first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  Open this on the phone (same Wi-Fi):" -ForegroundColor Green
Write-Host "      http://${lan}:5173" -ForegroundColor White
Write-Host ""

# ---------------------------------------------------------------
# 2. Firewall - the phone cannot reach the ports without these
# ---------------------------------------------------------------

# Only the dev server needs to be reachable: it proxies /api to the backend
# and /generated to the AI service, so 8080 and 8000 stay local.
$ports = @(5173)

foreach ($port in $ports) {

    $ruleName = "DR Platform $port"

    $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

    if ($null -eq $existing) {

        try {
            New-NetFirewallRule -DisplayName $ruleName `
                -Direction Inbound -Action Allow `
                -Protocol TCP -LocalPort $port `
                -Profile Private | Out-Null

            Write-Host "Firewall     : opened TCP $port on private networks" -ForegroundColor Yellow
        }
        catch {
            Write-Host "Firewall     : could not open TCP $port - run this script as Administrator" -ForegroundColor Red
        }
    }
    else {
        Write-Host "Firewall     : TCP $port already allowed" -ForegroundColor Green
    }
}

# ---------------------------------------------------------------
# 3. Live in-page camera needs HTTPS
# ---------------------------------------------------------------

Write-Host ""
Write-Host "Camera on the phone:" -ForegroundColor Cyan
Write-Host "  'Phone camera' works over this plain http address." -ForegroundColor Gray
Write-Host "  'Live camera' needs HTTPS - browsers block getUserMedia otherwise." -ForegroundColor Gray

if (Get-Command tailscale -ErrorAction SilentlyContinue) {
    Write-Host "  Tailscale found - run .\serve-https.ps1 for a real certificate," -ForegroundColor Gray
    Write-Host "  then open the printed https://...ts.net address on the phone." -ForegroundColor Gray
}

# ---------------------------------------------------------------
# 4. Start the services
# ---------------------------------------------------------------

Write-Host ""

& (Join-Path $root 'run-all.ps1')
