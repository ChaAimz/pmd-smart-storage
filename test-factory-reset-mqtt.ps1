# PowerShell Script to Test MQTT Factory Reset
# Usage: .\test-factory-reset-mqtt.ps1 -NodeAddress 2

param(
    [Parameter(Mandatory=$false)]
    [int]$NodeAddress = 2,
    
    [Parameter(Mandatory=$false)]
    [string]$MqttHost = "localhost",
    
    [Parameter(Mandatory=$false)]
    [int]$MqttPort = 1883,
    
    [Parameter(Mandatory=$false)]
    [string]$Topic = "smart-storage/command"
)

$ErrorActionPreference = "Stop"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  MQTT Factory Reset Test" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Settings:" -ForegroundColor Yellow
Write-Host "  Node Address: $NodeAddress" -ForegroundColor White
Write-Host "  MQTT Host: $MqttHost" -ForegroundColor White
Write-Host "  MQTT Port: $MqttPort" -ForegroundColor White
Write-Host "  Topic: $Topic" -ForegroundColor White
Write-Host ""

# Check if mosquitto_pub is available
$mosquittoPub = Get-Command mosquitto_pub -ErrorAction SilentlyContinue
if (-not $mosquittoPub) {
    Write-Host "❌ Error: mosquitto_pub not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Mosquitto MQTT client:" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://mosquitto.org/download/" -ForegroundColor Gray
    Write-Host "  2. Install and add to PATH" -ForegroundColor Gray
    Write-Host "  3. Or use WSL: sudo apt-get install mosquitto-clients" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "⚠️  WARNING: This will factory reset node $NodeAddress!" -ForegroundColor Yellow
Write-Host "   All provisioning data will be erased and the device will restart." -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Are you sure? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Cancelled." -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "Sending factory reset command..." -ForegroundColor Yellow

# Create JSON message
$message = @{
    node_addr = $NodeAddress
    command = "factory_reset"
} | ConvertTo-Json -Compress

Write-Host "Message: $message" -ForegroundColor Gray

# Send MQTT message
try {
    $result = mosquitto_pub -h $MqttHost -p $MqttPort -t $Topic -m $message
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Factory reset command sent successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Expected behavior:" -ForegroundColor Cyan
        Write-Host "  1. Gateway receives MQTT message" -ForegroundColor Gray
        Write-Host "  2. Gateway sends BLE Mesh message to node $NodeAddress" -ForegroundColor Gray
        Write-Host "  3. Endpoint receives factory reset command" -ForegroundColor Gray
        Write-Host "  4. Endpoint clears NVS and restarts" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Check the Endpoint serial monitor for:" -ForegroundColor Cyan
        Write-Host "  🔴 Factory reset command received via MQTT!" -ForegroundColor Yellow
        Write-Host "  Clearing provisioning data and restarting..." -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "✗ Failed to send MQTT message (exit code: $LASTEXITCODE)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Error sending MQTT message: $_" -ForegroundColor Red
    exit 1
}

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Test Complete" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Check Endpoint serial monitor" -ForegroundColor Gray
Write-Host "  2. Wait for device to restart" -ForegroundColor Gray
Write-Host "  3. Re-provision using nRF Mesh app" -ForegroundColor Gray
Write-Host ""

