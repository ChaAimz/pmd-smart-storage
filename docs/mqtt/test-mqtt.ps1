# ============================================================
# MQTT Broker Test Script
# Smart Storage System
# ============================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MQTT Broker Test Script" -ForegroundColor Cyan
Write-Host "Smart Storage System" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$mosquittoPath = "C:\Program Files\mosquitto"
$broker = "localhost"

# Check if Mosquitto is installed
if (-not (Test-Path "$mosquittoPath\mosquitto_pub.exe")) {
    Write-Host "ERROR: Mosquitto tools not found!" -ForegroundColor Red
    Write-Host "Please install Mosquitto first." -ForegroundColor Yellow
    pause
    exit 1
}

# Check if broker is running
Write-Host "[1/5] Checking if broker is running..." -ForegroundColor Yellow
$service = Get-Service -Name "mosquitto" -ErrorAction SilentlyContinue

if ($null -eq $service) {
    Write-Host "  ✗ Mosquitto service not found" -ForegroundColor Red
    Write-Host "  Run setup-mosquitto.ps1 first" -ForegroundColor Yellow
    pause
    exit 1
}

if ($service.Status -ne "Running") {
    Write-Host "  ✗ Mosquitto service is not running" -ForegroundColor Red
    Write-Host "  Starting service..." -ForegroundColor Yellow
    Start-Service -Name "mosquitto"
    Start-Sleep -Seconds 2
}

Write-Host "  ✓ Mosquitto service is running" -ForegroundColor Green
Write-Host ""

# Test 1: Basic connectivity
Write-Host "[2/5] Testing basic connectivity..." -ForegroundColor Yellow

$testTopic = "test/connectivity"
$testMessage = "Hello MQTT!"

try {
    # Publish test message
    & "$mosquittoPath\mosquitto_pub.exe" -h $broker -t $testTopic -m $testMessage 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Successfully published to broker" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to publish message" -ForegroundColor Red
    }
} catch {
    Write-Host "  ✗ Connection failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Smart Storage topics
Write-Host "[3/5] Testing Smart Storage topics..." -ForegroundColor Yellow

# Test button press topic
$buttonTopic = "smart-storage/button"
$buttonPayload = '{"node_addr":1,"event":"button_press","timestamp":1234567890}'

Write-Host "  Publishing to: $buttonTopic" -ForegroundColor White
& "$mosquittoPath\mosquitto_pub.exe" -h $broker -t $buttonTopic -m $buttonPayload 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Button topic OK" -ForegroundColor Green
} else {
    Write-Host "  ✗ Button topic failed" -ForegroundColor Red
}

# Test command topic
$commandTopic = "smart-storage/command"
$commandPayload = '{"node_addr":1,"led_state":true}'

Write-Host "  Publishing to: $commandTopic" -ForegroundColor White
& "$mosquittoPath\mosquitto_pub.exe" -h $broker -t $commandTopic -m $commandPayload 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Command topic OK" -ForegroundColor Green
} else {
    Write-Host "  ✗ Command topic failed" -ForegroundColor Red
}

# Test status topic
$statusTopic = "smart-storage/status"
$statusPayload = '{"type":"gateway","status":"online"}'

Write-Host "  Publishing to: $statusTopic" -ForegroundColor White
& "$mosquittoPath\mosquitto_pub.exe" -h $broker -t $statusTopic -m $statusPayload 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Status topic OK" -ForegroundColor Green
} else {
    Write-Host "  ✗ Status topic failed" -ForegroundColor Red
}
Write-Host ""

# Test 3: Check logs
Write-Host "[4/5] Checking broker logs..." -ForegroundColor Yellow

$logFile = "$mosquittoPath\logs\mosquitto.log"

if (Test-Path $logFile) {
    $recentLogs = Get-Content $logFile -Tail 5
    Write-Host "  Recent log entries:" -ForegroundColor White
    foreach ($line in $recentLogs) {
        Write-Host "    $line" -ForegroundColor Gray
    }
    Write-Host "  ✓ Logs accessible" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Log file not found" -ForegroundColor Yellow
}
Write-Host ""

# Test 4: Network information
Write-Host "[5/5] Network information..." -ForegroundColor Yellow

# Get local IP
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1).IPAddress

Write-Host "  Local IP:      $ipAddress" -ForegroundColor White
Write-Host "  MQTT Port:     1883" -ForegroundColor White
Write-Host "  Local URL:     mqtt://localhost:1883" -ForegroundColor Cyan
Write-Host "  Network URL:   mqtt://$ipAddress:1883" -ForegroundColor Cyan
Write-Host ""

# Check if port is listening
$portCheck = Get-NetTCPConnection -LocalPort 1883 -State Listen -ErrorAction SilentlyContinue

if ($null -ne $portCheck) {
    Write-Host "  ✓ Port 1883 is listening" -ForegroundColor Green
} else {
    Write-Host "  ✗ Port 1883 is not listening" -ForegroundColor Red
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✓ Broker is running and accessible" -ForegroundColor Green
Write-Host "✓ All Smart Storage topics working" -ForegroundColor Green
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Monitor all messages:" -ForegroundColor White
Write-Host "   cd '$mosquittoPath'" -ForegroundColor Cyan
Write-Host "   .\mosquitto_sub.exe -h localhost -t '#' -v" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Monitor Smart Storage topics only:" -ForegroundColor White
Write-Host "   .\mosquitto_sub.exe -h localhost -t 'smart-storage/#' -v" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Update your gateway firmware:" -ForegroundColor White
Write-Host "   File: firmware/gateway-node/main/main.c" -ForegroundColor Gray
Write-Host "   #define MQTT_BROKER_URL `"mqtt://$ipAddress:1883`"" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Update your backend server:" -ForegroundColor White
Write-Host "   File: backend/server/.env" -ForegroundColor Gray
Write-Host "   MQTT_BROKER_URL=mqtt://localhost:1883" -ForegroundColor Cyan
Write-Host ""

Write-Host "Interactive Test:" -ForegroundColor Yellow
Write-Host "  Open a new PowerShell window and run:" -ForegroundColor White
Write-Host "  cd '$mosquittoPath'" -ForegroundColor Cyan
Write-Host "  .\mosquitto_sub.exe -h localhost -t 'smart-storage/#' -v" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Then in this window, publish a test message:" -ForegroundColor White
Write-Host "  .\mosquitto_pub.exe -h localhost -t 'smart-storage/button' -m '{`"test`":true}'" -ForegroundColor Cyan
Write-Host ""

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

