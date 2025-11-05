# Restart Mosquitto with Updated Configuration
# Run this as Administrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Mosquitto Configuration Update Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Paths
$configSource = "C:\Users\Aimz\source\repos\smart-storage-device\docs\mqtt\mosquitto.conf"
$configDest = "C:\Program Files\mosquitto\mosquitto.conf"

# Check if source exists
if (-not (Test-Path $configSource)) {
    Write-Host "ERROR: Configuration file not found at:" -ForegroundColor Red
    Write-Host "  $configSource" -ForegroundColor Yellow
    exit 1
}

# Backup existing config
if (Test-Path $configDest) {
    $backupPath = "$configDest.backup"
    Write-Host "Backing up existing configuration..." -ForegroundColor Cyan
    Copy-Item $configDest $backupPath -Force
    Write-Host "Backup saved to: $backupPath" -ForegroundColor Green
}

# Copy new configuration
Write-Host "Copying new configuration..." -ForegroundColor Cyan
Copy-Item $configSource $configDest -Force
Write-Host "Configuration updated!" -ForegroundColor Green
Write-Host ""

# Stop Mosquitto service
Write-Host "Stopping Mosquitto service..." -ForegroundColor Cyan
$service = Get-Service mosquitto -ErrorAction SilentlyContinue

if ($service) {
    if ($service.Status -eq "Running") {
        Stop-Service mosquitto
        Start-Sleep -Seconds 2
        Write-Host "Service stopped." -ForegroundColor Green
    }
} else {
    Write-Host "WARNING: Mosquitto service not found!" -ForegroundColor Yellow
    Write-Host "Will try to start it anyway..." -ForegroundColor Yellow
}

# Start Mosquitto service
Write-Host "Starting Mosquitto service..." -ForegroundColor Cyan
try {
    Start-Service mosquitto -ErrorAction Stop
    Start-Sleep -Seconds 2
    
    $service = Get-Service mosquitto
    if ($service.Status -eq "Running") {
        Write-Host "Service started successfully!" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Service may not have started correctly." -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: Failed to start service!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Try starting manually:" -ForegroundColor Cyan
    Write-Host '  cd "C:\Program Files\mosquitto"' -ForegroundColor White
    Write-Host '  .\mosquitto.exe -v -c mosquitto.conf' -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Configuration Updated Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Test the connection
Write-Host "Testing MQTT broker..." -ForegroundColor Cyan
Start-Sleep -Seconds 2

# Check if listening on all interfaces
$listening = netstat -ano | findstr :1883
Write-Host "Listening on:" -ForegroundColor Cyan
Write-Host $listening -ForegroundColor White
Write-Host ""

# Get IP addresses
Write-Host "Your PC IP addresses:" -ForegroundColor Cyan
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object IPAddress, InterfaceAlias | Format-Table
Write-Host ""

Write-Host "MQTT Broker URLs:" -ForegroundColor Cyan
Write-Host "  Local:   mqtt://localhost:1883" -ForegroundColor White
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254.*" } | ForEach-Object {
    Write-Host "  Network: mqtt://$($_.IPAddress):1883" -ForegroundColor White
}
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Rebuild gateway firmware with correct IP" -ForegroundColor White
Write-Host "2. Flash to ESP32-C6" -ForegroundColor White
Write-Host "3. Monitor MQTT messages:" -ForegroundColor White
Write-Host '   cd "C:\Program Files\mosquitto"' -ForegroundColor Gray
Write-Host '   .\mosquitto_sub.exe -h localhost -t "smart-storage/#" -v' -ForegroundColor Gray
Write-Host ""

