# PowerShell Script สำหรับทดสอบ LED Control
# ใช้งาน: .\test-led.ps1 -NodeAddress 2 -State on

param(
    [Parameter(Mandatory=$false)]
    [int]$NodeAddress = 2,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("on", "off")]
    [string]$State = "on",
    
    [Parameter(Mandatory=$false)]
    [string]$Method = "mqtt"  # mqtt หรือ api
)

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  LED Control Test Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# แสดงข้อมูลการทดสอบ
Write-Host "Node Address: 0x$($NodeAddress.ToString('X4')) (decimal: $NodeAddress)" -ForegroundColor Yellow
Write-Host "LED State: $State" -ForegroundColor Yellow
Write-Host "Method: $Method" -ForegroundColor Yellow
Write-Host ""

if ($Method -eq "mqtt") {
    # ทดสอบผ่าน MQTT
    Write-Host "Testing via MQTT..." -ForegroundColor Green
    
    $mosquittoPath = "C:\Program Files\mosquitto"
    if (-not (Test-Path $mosquittoPath)) {
        Write-Host "ERROR: Mosquitto not found at $mosquittoPath" -ForegroundColor Red
        exit 1
    }
    
    $ledState = if ($State -eq "on") { "true" } else { "false" }
    $message = "{`"node_addr`":$NodeAddress,`"led_state`":$ledState}"
    
    Write-Host "Publishing to MQTT topic: smart-storage/command" -ForegroundColor Cyan
    Write-Host "Message: $message" -ForegroundColor Cyan
    Write-Host ""
    
    & "$mosquittoPath\mosquitto_pub.exe" -h localhost -t 'smart-storage/command' -m $message
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ MQTT message sent successfully!" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to send MQTT message" -ForegroundColor Red
        exit 1
    }
    
} elseif ($Method -eq "api") {
    # ทดสอบผ่าน Backend API
    Write-Host "Testing via Backend API..." -ForegroundColor Green
    
    $hexAddress = "0x$($NodeAddress.ToString('X4'))"
    $url = "http://localhost:3000/api/locations/$hexAddress/led"
    $body = @{
        state = $State
    } | ConvertTo-Json
    
    Write-Host "URL: $url" -ForegroundColor Cyan
    Write-Host "Body: $body" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        $response = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json"
        Write-Host "✓ API call successful!" -ForegroundColor Green
        Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor Cyan
    } catch {
        Write-Host "✗ API call failed: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Expected Results:" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Cyan

if ($State -eq "on") {
    Write-Host "1. Gateway Serial Monitor should show:" -ForegroundColor White
    Write-Host "   'Sending LED command to node 0x$($NodeAddress.ToString('X4')): ON'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Endpoint Serial Monitor should show:" -ForegroundColor White
    Write-Host "   'Generic server recv set msg: onoff=1'" -ForegroundColor Gray
    Write-Host "   'Location indicator ON'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. NeoPixel LED should:" -ForegroundColor White
    Write-Host "   Turn GREEN (solid) 🟢" -ForegroundColor Green
} else {
    Write-Host "1. Gateway Serial Monitor should show:" -ForegroundColor White
    Write-Host "   'Sending LED command to node 0x$($NodeAddress.ToString('X4')): OFF'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Endpoint Serial Monitor should show:" -ForegroundColor White
    Write-Host "   'Generic server recv set msg: onoff=0'" -ForegroundColor Gray
    Write-Host "   'Location indicator OFF'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. NeoPixel LED should:" -ForegroundColor White
    Write-Host "   Return to normal state (yellow blinking) 🟡" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Troubleshooting:" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Cyan
Write-Host "If LED doesn't turn on, check:" -ForegroundColor White
Write-Host "1. Mosquitto service is running: Get-Service mosquitto" -ForegroundColor Gray
Write-Host "2. Backend server is running: curl http://localhost:3000/health" -ForegroundColor Gray
Write-Host "3. Gateway is connected to WiFi (blue LED solid)" -ForegroundColor Gray
Write-Host "4. Endpoint is provisioned (check Serial Monitor)" -ForegroundColor Gray
Write-Host "5. Node address matches (check Serial Monitor)" -ForegroundColor Gray
Write-Host ""
Write-Host "For detailed troubleshooting, see: TEST_LED_CONTROL.md" -ForegroundColor Cyan
Write-Host ""

