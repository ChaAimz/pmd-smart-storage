# Start frontend and backend in separate PowerShell windows for local testing.
# Usage:
#   .\scripts\test\start-local-dev.ps1
#   .\scripts\test\start-local-dev.ps1 -BackendDev -OpenBrowser
#   .\scripts\test\start-local-dev.ps1 -EnsureFirewall

param(
    [Parameter(Mandatory = $false)]
    [switch]$BackendDev = $false,

    [Parameter(Mandatory = $false)]
    [switch]$OpenBrowser = $true,

    [Parameter(Mandatory = $false)]
    [switch]$EnsureFirewall = $false
)

$ErrorActionPreference = "Stop"

function Get-EnvMap {
    param([string]$Path)

    $envMap = @{}
    if (-not (Test-Path $Path)) {
        return $envMap
    }

    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
            return
        }

        $separator = $line.IndexOf("=")
        if ($separator -lt 1) {
            return
        }

        $key = $line.Substring(0, $separator).Trim()
        $value = $line.Substring($separator + 1).Trim()
        $envMap[$key] = $value
    }

    return $envMap
}

function Get-LanIpAddress {
    try {
        $config = Get-NetIPConfiguration |
            Where-Object {
                $_.IPv4DefaultGateway -ne $null -and
                $_.IPv4Address -ne $null -and
                $_.NetAdapter.Status -eq "Up"
            } |
            Select-Object -First 1

        if ($config -and $config.IPv4Address) {
            return $config.IPv4Address.IPAddress
        }
    } catch {
        # Ignore and fall through to null.
    }

    return $null
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..\..")).Path
$backendPath = Join-Path $repoRoot "backend\server"
$frontendPath = Join-Path $repoRoot "frontend"
$backendEnvPath = Join-Path $backendPath ".env"
$firewallScriptPath = Join-Path $repoRoot "scripts\check\allow-local-dev-firewall.ps1"

if (-not (Test-Path (Join-Path $backendPath "package.json"))) {
    throw "Cannot find backend package.json at $backendPath"
}

if (-not (Test-Path (Join-Path $frontendPath "package.json"))) {
    throw "Cannot find frontend package.json at $frontendPath"
}

$backendCommand = if ($BackendDev) { "npm run dev" } else { "npm start" }
$frontendCommand = "npm run dev"
$frontendPort = 5173
$backendPort = 3001
$backendEnv = Get-EnvMap -Path $backendEnvPath

if ($backendEnv.ContainsKey("PORT")) {
    $parsedPort = 0
    if ([int]::TryParse($backendEnv["PORT"], [ref]$parsedPort) -and $parsedPort -gt 0) {
        $backendPort = $parsedPort
    }
}

$lanIp = $null
if ($backendEnv.ContainsKey("LAN_HOST_IP")) {
    $candidate = $backendEnv["LAN_HOST_IP"].Trim()
    if (-not [string]::IsNullOrWhiteSpace($candidate)) {
        $lanIp = $candidate
    }
}

if (-not $lanIp) {
    $lanIp = Get-LanIpAddress
}

if ($EnsureFirewall -and (Test-Path $firewallScriptPath)) {
    try {
        & $firewallScriptPath -Ports @($frontendPort, $backendPort) -Profiles @("Private", "Domain")
    } catch {
        Write-Host "Firewall auto-config skipped: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "Run as Administrator: npm run dev:firewall" -ForegroundColor Yellow
    }
}

Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$backendPath'; $backendCommand"
) | Out-Null

Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$frontendPath'; $frontendCommand"
) | Out-Null

Write-Host ""
Write-Host "Started services in 2 new PowerShell windows:" -ForegroundColor Green
Write-Host "  Backend  : $backendCommand" -ForegroundColor White
Write-Host "  Frontend : $frontendCommand" -ForegroundColor White
Write-Host ""
Write-Host "Test links:" -ForegroundColor Yellow
Write-Host "  Frontend (local)       : http://localhost:$frontendPort" -ForegroundColor Cyan
Write-Host "  Backend health (local) : http://localhost:$backendPort/health" -ForegroundColor Cyan
Write-Host "  Backend API (local)    : http://localhost:$backendPort/api/items" -ForegroundColor Cyan

if ($lanIp) {
    Write-Host "  Frontend (LAN)         : http://${lanIp}:$frontendPort" -ForegroundColor Green
    Write-Host "  Backend health (LAN)   : http://${lanIp}:$backendPort/health" -ForegroundColor Green
}

if (-not $EnsureFirewall) {
    Write-Host ""
    Write-Host "Tip: run once as admin to open firewall ports:" -ForegroundColor Yellow
    Write-Host "  npm run dev:firewall" -ForegroundColor White
}

Write-Host ""

if ($OpenBrowser) {
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:$frontendPort"
    Start-Process "http://localhost:$backendPort/health"
    Write-Host "Opened test links in browser." -ForegroundColor Green
    Write-Host ""
}
