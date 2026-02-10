# Allow local development ports through Windows Firewall.
# Run as Administrator.
# Usage:
#   .\scripts\check\allow-local-dev-firewall.ps1
#   .\scripts\check\allow-local-dev-firewall.ps1 -Ports 5173,3001
#   .\scripts\check\allow-local-dev-firewall.ps1 -Remove

param(
    [Parameter(Mandatory = $false)]
    [int[]]$Ports = @(5173, 3001),

    [Parameter(Mandatory = $false)]
    [string[]]$Profiles = @("Private", "Domain"),

    [Parameter(Mandatory = $false)]
    [switch]$Remove = $false
)

$ErrorActionPreference = "Stop"

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdmin)) {
    throw "This script must be run as Administrator."
}

foreach ($port in $Ports) {
    $ruleName = "Smart Storage Dev TCP $port"

    Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue |
        Remove-NetFirewallRule -ErrorAction SilentlyContinue | Out-Null

    if ($Remove) {
        Write-Host "Removed firewall rule: $ruleName" -ForegroundColor Yellow
        continue
    }

    New-NetFirewallRule `
        -DisplayName $ruleName `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort $port `
        -Action Allow `
        -Profile $Profiles | Out-Null

    Write-Host "Added firewall rule: $ruleName (Profiles: $($Profiles -join ', '))" -ForegroundColor Green
}

if (-not $Remove) {
    Write-Host ""
    Write-Host "Firewall rules ready for local network access." -ForegroundColor Green
}
