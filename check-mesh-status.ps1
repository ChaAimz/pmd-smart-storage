# PowerShell Script สำหรับตรวจสอบสถานะ BLE Mesh Network
# ใช้งาน: .\check-mesh-status.ps1

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  BLE Mesh Network Status" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# ตรวจสอบ Mosquitto Service
Write-Host "1. Checking Mosquitto MQTT Broker..." -ForegroundColor Yellow
$mosquittoService = Get-Service -Name "mosquitto" -ErrorAction SilentlyContinue

if ($mosquittoService) {
    if ($mosquittoService.Status -eq "Running") {
        Write-Host "   ✓ Mosquitto is running" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Mosquitto is stopped" -ForegroundColor Red
        Write-Host "   Fix: net start mosquitto" -ForegroundColor Gray
    }
} else {
    Write-Host "   ✗ Mosquitto service not found" -ForegroundColor Red
    Write-Host "   Fix: Install Mosquitto MQTT Broker" -ForegroundColor Gray
}
Write-Host ""

# ตรวจสอบ Backend Server
Write-Host "2. Checking Backend Server..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 2 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✓ Backend server is running (port 3000)" -ForegroundColor Green
    }
} catch {
    Write-Host "   ✗ Backend server is not running" -ForegroundColor Red
    Write-Host "   Fix: cd backend/server && npm start" -ForegroundColor Gray
}
Write-Host ""

# ตรวจสอบ COM Ports
Write-Host "3. Checking Serial Ports..." -ForegroundColor Yellow
$ports = [System.IO.Ports.SerialPort]::getportnames()
if ($ports.Count -gt 0) {
    Write-Host "   Available COM ports:" -ForegroundColor Green
    foreach ($port in $ports) {
        Write-Host "   - $port" -ForegroundColor Cyan
    }
} else {
    Write-Host "   ✗ No COM ports found" -ForegroundColor Red
    Write-Host "   Fix: Connect ESP32 devices via USB" -ForegroundColor Gray
}
Write-Host ""

# แสดงคำแนะนำ
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Next Steps" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1: Provision Gateway with nRF Mesh App" -ForegroundColor Yellow
Write-Host "  - Open nRF Mesh app on your phone" -ForegroundColor White
Write-Host "  - Scan for 'ESP Gateway'" -ForegroundColor White
Write-Host "  - Provision the device" -ForegroundColor White
Write-Host "  - Bind App Key 1 to Generic OnOff Client ⭐" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Provision Endpoint with nRF Mesh App" -ForegroundColor Yellow
Write-Host "  - Scan for 'ESP BLE Mesh Node'" -ForegroundColor White
Write-Host "  - Provision the device" -ForegroundColor White
Write-Host "  - Bind App Key 1 to Generic OnOff Server ⭐" -ForegroundColor Green
Write-Host ""

Write-Host "Step 3: Test LED Control" -ForegroundColor Yellow
Write-Host "  - Run: .\test-led.ps1 -NodeAddress 2 -State on" -ForegroundColor White
Write-Host ""

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Common Issues" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Issue: 'Model not bound to AppKey 0x0000'" -ForegroundColor Red
Write-Host "Fix: Bind App Key 1 to Generic OnOff Client on Gateway" -ForegroundColor Green
Write-Host "     See: FIX_APPKEY_ERROR.md" -ForegroundColor Gray
Write-Host ""

Write-Host "Issue: LED doesn't turn on" -ForegroundColor Red
Write-Host "Fix: Check all steps in TEST_LED_CONTROL.md" -ForegroundColor Green
Write-Host ""

Write-Host "Issue: Can't find devices in nRF Mesh app" -ForegroundColor Red
Write-Host "Fix: " -ForegroundColor Green
Write-Host "  1. Check ESP32 is running (idf.py monitor)" -ForegroundColor Gray
Write-Host "  2. Look for 'BLE Mesh Node initialized' in logs" -ForegroundColor Gray
Write-Host "  3. Try resetting the device" -ForegroundColor Gray
Write-Host ""

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Useful Commands" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Monitor Gateway:" -ForegroundColor Yellow
Write-Host "  cd firmware/gateway-node" -ForegroundColor Gray
Write-Host "  idf.py -p COM3 monitor" -ForegroundColor Gray
Write-Host ""

Write-Host "Monitor Endpoint:" -ForegroundColor Yellow
Write-Host "  cd firmware/endpoint-node" -ForegroundColor Gray
Write-Host "  idf.py -p COM6 monitor" -ForegroundColor Gray
Write-Host ""

Write-Host "Test LED via MQTT:" -ForegroundColor Yellow
Write-Host "  cd 'C:\Program Files\mosquitto'" -ForegroundColor Gray
Write-Host "  .\mosquitto_pub.exe -h localhost -t 'smart-storage/command' -m '{`"node_addr`":2,`"led_state`":true}'" -ForegroundColor Gray
Write-Host ""

Write-Host "Test LED via API:" -ForegroundColor Yellow
Write-Host "  curl -X POST http://localhost:3000/api/locations/0x0002/led -H 'Content-Type: application/json' -d '{`"state`": `"on`"}'" -ForegroundColor Gray
Write-Host ""

Write-Host "Reset Everything (if needed):" -ForegroundColor Yellow
Write-Host "  cd firmware/gateway-node" -ForegroundColor Gray
Write-Host "  idf.py -p COM3 erase-flash" -ForegroundColor Gray
Write-Host "  idf.py -p COM3 flash monitor" -ForegroundColor Gray
Write-Host ""
Write-Host "  cd firmware/endpoint-node" -ForegroundColor Gray
Write-Host "  idf.py -p COM6 erase-flash" -ForegroundColor Gray
Write-Host "  idf.py -p COM6 flash monitor" -ForegroundColor Gray
Write-Host ""

Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

