# ============================================================
# Mosquitto MQTT Broker Setup Script for Windows
# Smart Storage System
# ============================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Mosquitto MQTT Broker Setup" -ForegroundColor Cyan
Write-Host "Smart Storage System" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    pause
    exit 1
}

# Configuration
$mosquittoPath = "C:\Program Files\mosquitto"
$dataPath = "$mosquittoPath\data"
$logsPath = "$mosquittoPath\logs"
$configFile = "$mosquittoPath\mosquitto.conf"

# Step 1: Check if Mosquitto is installed
Write-Host "[1/6] Checking Mosquitto installation..." -ForegroundColor Yellow

if (-not (Test-Path "$mosquittoPath\mosquitto.exe")) {
    Write-Host "ERROR: Mosquitto not found at $mosquittoPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Mosquitto first:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://mosquitto.org/download/" -ForegroundColor White
    Write-Host "2. Run the installer as Administrator" -ForegroundColor White
    Write-Host "3. Run this script again" -ForegroundColor White
    Write-Host ""
    Write-Host "Or install via Chocolatey:" -ForegroundColor Yellow
    Write-Host "  choco install mosquitto -y" -ForegroundColor White
    pause
    exit 1
}

Write-Host "  ✓ Mosquitto found at $mosquittoPath" -ForegroundColor Green

# Get Mosquitto version
$version = & "$mosquittoPath\mosquitto.exe" -h 2>&1 | Select-String "mosquitto version" | Select-Object -First 1
Write-Host "  ✓ Version: $version" -ForegroundColor Green
Write-Host ""

# Step 2: Create required directories
Write-Host "[2/6] Creating required directories..." -ForegroundColor Yellow

if (-not (Test-Path $dataPath)) {
    New-Item -ItemType Directory -Path $dataPath -Force | Out-Null
    Write-Host "  ✓ Created: $dataPath" -ForegroundColor Green
} else {
    Write-Host "  ✓ Already exists: $dataPath" -ForegroundColor Green
}

if (-not (Test-Path $logsPath)) {
    New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
    Write-Host "  ✓ Created: $logsPath" -ForegroundColor Green
} else {
    Write-Host "  ✓ Already exists: $logsPath" -ForegroundColor Green
}
Write-Host ""

# Step 3: Set permissions
Write-Host "[3/6] Setting directory permissions..." -ForegroundColor Yellow

try {
    icacls $dataPath /grant "Users:(OI)(CI)F" /T | Out-Null
    Write-Host "  ✓ Permissions set for: $dataPath" -ForegroundColor Green
    
    icacls $logsPath /grant "Users:(OI)(CI)F" /T | Out-Null
    Write-Host "  ✓ Permissions set for: $logsPath" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Warning: Could not set permissions" -ForegroundColor Yellow
}
Write-Host ""

# Step 4: Copy configuration file
Write-Host "[4/6] Setting up configuration..." -ForegroundColor Yellow

$sourceConfig = Join-Path $PSScriptRoot "mosquitto.conf"

if (Test-Path $sourceConfig) {
    Copy-Item $sourceConfig $configFile -Force
    Write-Host "  ✓ Configuration copied to: $configFile" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Warning: mosquitto.conf not found in script directory" -ForegroundColor Yellow
    Write-Host "  Using default configuration" -ForegroundColor Yellow
}
Write-Host ""

# Step 5: Configure Windows Firewall
Write-Host "[5/6] Configuring Windows Firewall..." -ForegroundColor Yellow

try {
    $firewallRule = Get-NetFirewallRule -DisplayName "Mosquitto MQTT" -ErrorAction SilentlyContinue
    
    if ($null -eq $firewallRule) {
        New-NetFirewallRule -DisplayName "Mosquitto MQTT" -Direction Inbound -Protocol TCP -LocalPort 1883 -Action Allow | Out-Null
        Write-Host "  ✓ Firewall rule created for port 1883" -ForegroundColor Green
    } else {
        Write-Host "  ✓ Firewall rule already exists" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠ Warning: Could not configure firewall" -ForegroundColor Yellow
    Write-Host "  You may need to manually allow port 1883" -ForegroundColor Yellow
}
Write-Host ""

# Step 6: Configure and start service
Write-Host "[6/6] Configuring Mosquitto service..." -ForegroundColor Yellow

$service = Get-Service -Name "mosquitto" -ErrorAction SilentlyContinue

if ($null -eq $service) {
    Write-Host "  ⚠ Service not found. Installing service..." -ForegroundColor Yellow
    
    try {
        & "$mosquittoPath\mosquitto.exe" install
        Write-Host "  ✓ Service installed" -ForegroundColor Green
        $service = Get-Service -Name "mosquitto"
    } catch {
        Write-Host "  ✗ Failed to install service" -ForegroundColor Red
    }
}

if ($null -ne $service) {
    if ($service.Status -eq "Running") {
        Write-Host "  ⚠ Service is running. Restarting..." -ForegroundColor Yellow
        Restart-Service -Name "mosquitto"
        Write-Host "  ✓ Service restarted" -ForegroundColor Green
    } else {
        Start-Service -Name "mosquitto"
        Write-Host "  ✓ Service started" -ForegroundColor Green
    }
    
    # Set service to start automatically
    Set-Service -Name "mosquitto" -StartupType Automatic
    Write-Host "  ✓ Service set to start automatically" -ForegroundColor Green
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get local IP address
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1).IPAddress

Write-Host "Mosquitto MQTT Broker Information:" -ForegroundColor White
Write-Host "  Status:        Running" -ForegroundColor Green
Write-Host "  Port:          1883" -ForegroundColor White
Write-Host "  Local URL:     mqtt://localhost:1883" -ForegroundColor White
Write-Host "  Network URL:   mqtt://$ipAddress:1883" -ForegroundColor White
Write-Host "  Config:        $configFile" -ForegroundColor White
Write-Host "  Logs:          $logsPath\mosquitto.log" -ForegroundColor White
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Test the broker:" -ForegroundColor White
Write-Host "     cd '$mosquittoPath'" -ForegroundColor Cyan
Write-Host "     .\mosquitto_sub.exe -h localhost -t '#' -v" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Update gateway-node firmware:" -ForegroundColor White
Write-Host "     #define MQTT_BROKER_URL `"mqtt://$ipAddress:1883`"" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. Update backend server .env:" -ForegroundColor White
Write-Host "     MQTT_BROKER_URL=mqtt://localhost:1883" -ForegroundColor Cyan
Write-Host ""

Write-Host "Useful Commands:" -ForegroundColor Yellow
Write-Host "  Start service:   net start mosquitto" -ForegroundColor White
Write-Host "  Stop service:    net stop mosquitto" -ForegroundColor White
Write-Host "  View logs:       Get-Content '$logsPath\mosquitto.log' -Tail 50 -Wait" -ForegroundColor White
Write-Host ""

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

