# PowerShell Script สำหรับทดสอบ Mesh Storage
# ใช้งาน: .\test-mesh-storage.ps1

param(
    [Parameter(Mandatory=$false)]
    [string]$GatewayPort = "COM5",
    
    [Parameter(Mandatory=$false)]
    [string]$EndpointPort = "COM6"
)

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Mesh Storage Test Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This script will guide you through testing the Mesh Storage functionality." -ForegroundColor White
Write-Host ""

# Test 1: Check if devices are provisioned
Write-Host "Test 1: Checking if devices are provisioned..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Please check the serial monitor output for:" -ForegroundColor White
Write-Host "  Gateway ($GatewayPort):" -ForegroundColor Cyan
Write-Host "    - '✓ Loaded provisioning data from NVS'" -ForegroundColor Green
Write-Host "    - 'Node address: 0x0001'" -ForegroundColor Green
Write-Host ""
Write-Host "  Endpoint ($EndpointPort):" -ForegroundColor Cyan
Write-Host "    - '✓ Loaded provisioning data from NVS'" -ForegroundColor Green
Write-Host "    - 'Node address: 0x0002'" -ForegroundColor Green
Write-Host ""

$provisioned = Read-Host "Do you see these messages? (yes/no)"
if ($provisioned -ne "yes") {
    Write-Host ""
    Write-Host "⚠️  Devices are not provisioned yet!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please provision the devices first:" -ForegroundColor White
    Write-Host "1. Open nRF Mesh app on your phone" -ForegroundColor White
    Write-Host "2. Provision Gateway (should get address 0x0001)" -ForegroundColor White
    Write-Host "   - Bind App Key 1 to Generic OnOff Client" -ForegroundColor Green
    Write-Host "   - Set Publication to C000" -ForegroundColor White
    Write-Host "3. Provision Endpoint (should get address 0x0002)" -ForegroundColor White
    Write-Host "   - Bind App Key 1 to Generic OnOff Server" -ForegroundColor Green
    Write-Host "   - Set Publication to C000" -ForegroundColor White
    Write-Host "   - Add Subscription C000" -ForegroundColor White
    Write-Host ""
    Write-Host "See FIX_APPKEY_ERROR.md for detailed instructions" -ForegroundColor Cyan
    Write-Host ""
    exit 0
}

Write-Host "✓ Test 1 Passed: Devices are provisioned" -ForegroundColor Green
Write-Host ""

# Test 2: Check model bindings
Write-Host "Test 2: Checking model bindings..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Please check the serial monitor output for:" -ForegroundColor White
Write-Host "  Gateway:" -ForegroundColor Cyan
Write-Host "    - '✓ Generic OnOff Client bound to AppKey 0x0001'" -ForegroundColor Green
Write-Host ""
Write-Host "  Endpoint:" -ForegroundColor Cyan
Write-Host "    - '✓ Generic OnOff Server bound to AppKey 0x0001'" -ForegroundColor Green
Write-Host ""

$bound = Read-Host "Do you see these messages? (yes/no)"
if ($bound -ne "yes") {
    Write-Host ""
    Write-Host "⚠️  Models are not bound to AppKey!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please bind AppKey to models using nRF Mesh app:" -ForegroundColor White
    Write-Host "1. Select Gateway node" -ForegroundColor White
    Write-Host "2. Go to Elements → Element 0 → Generic OnOff Client" -ForegroundColor White
    Write-Host "3. Bind Key → App Key 1" -ForegroundColor Green
    Write-Host ""
    Write-Host "4. Select Endpoint node" -ForegroundColor White
    Write-Host "5. Go to Elements → Element 0 → Generic OnOff Server" -ForegroundColor White
    Write-Host "6. Bind Key → App Key 1" -ForegroundColor Green
    Write-Host ""
    exit 0
}

Write-Host "✓ Test 2 Passed: Models are bound to AppKey" -ForegroundColor Green
Write-Host ""

# Test 3: Test LED control before reset
Write-Host "Test 3: Testing LED control (before reset)..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Sending LED ON command..." -ForegroundColor White

try {
    .\test-led.ps1 -NodeAddress 2 -State on -Method mqtt -ErrorAction Stop
    Start-Sleep -Seconds 2
    
    Write-Host ""
    $ledOn = Read-Host "Did the LED turn ON (green)? (yes/no)"
    if ($ledOn -ne "yes") {
        Write-Host "✗ Test 3 Failed: LED did not turn on" -ForegroundColor Red
        Write-Host "Please check the connection and try again" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host ""
    Write-Host "Sending LED OFF command..." -ForegroundColor White
    .\test-led.ps1 -NodeAddress 2 -State off -Method mqtt -ErrorAction Stop
    Start-Sleep -Seconds 2
    
    Write-Host ""
    $ledOff = Read-Host "Did the LED turn OFF? (yes/no)"
    if ($ledOff -ne "yes") {
        Write-Host "✗ Test 3 Failed: LED did not turn off" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "✗ Test 3 Failed: Error sending LED command" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Test 3 Passed: LED control works" -ForegroundColor Green
Write-Host ""

# Test 4: Reset and check if data is loaded
Write-Host "Test 4: Testing reset and data loading..." -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  Please reset the Gateway now:" -ForegroundColor Yellow
Write-Host "   - Press the RESET button on the Gateway board" -ForegroundColor White
Write-Host "   - OR in the serial monitor, press Ctrl+T then Ctrl+R" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter after you have reset the Gateway"

Write-Host ""
Write-Host "Waiting for Gateway to boot..." -ForegroundColor White
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "Please check the Gateway serial monitor for:" -ForegroundColor White
Write-Host "  - '✓ Loaded provisioning data from NVS'" -ForegroundColor Green
Write-Host "  - 'Node address: 0x0001'" -ForegroundColor Green
Write-Host "  - '✓ Generic OnOff Client bound to AppKey 0x0001'" -ForegroundColor Green
Write-Host ""

$loaded = Read-Host "Do you see these messages? (yes/no)"
if ($loaded -ne "yes") {
    Write-Host "✗ Test 4 Failed: Data was not loaded from NVS" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible issues:" -ForegroundColor Yellow
    Write-Host "  - NVS was erased during reset" -ForegroundColor White
    Write-Host "  - mesh_storage functions are not working correctly" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "✓ Test 4 Passed: Data loaded successfully after reset" -ForegroundColor Green
Write-Host ""

# Test 5: Test LED control after reset
Write-Host "Test 5: Testing LED control (after reset)..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Sending LED ON command..." -ForegroundColor White

try {
    .\test-led.ps1 -NodeAddress 2 -State on -Method mqtt -ErrorAction Stop
    Start-Sleep -Seconds 2
    
    Write-Host ""
    $ledOnAfter = Read-Host "Did the LED turn ON (green)? (yes/no)"
    if ($ledOnAfter -ne "yes") {
        Write-Host "✗ Test 5 Failed: LED did not turn on after reset" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please check the Gateway serial monitor for errors:" -ForegroundColor Yellow
        Write-Host "  - Look for 'Model not bound to AppKey' error" -ForegroundColor White
        Write-Host "  - If you see this error, the model binding was not saved/loaded correctly" -ForegroundColor White
        Write-Host ""
        exit 1
    }
    
    Write-Host ""
    Write-Host "Sending LED OFF command..." -ForegroundColor White
    .\test-led.ps1 -NodeAddress 2 -State off -Method mqtt -ErrorAction Stop
    Start-Sleep -Seconds 2
    
} catch {
    Write-Host "✗ Test 5 Failed: Error sending LED command after reset" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Test 5 Passed: LED control works after reset" -ForegroundColor Green
Write-Host ""

# Test 6: Reset Endpoint and check
Write-Host "Test 6: Testing Endpoint reset and data loading..." -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  Please reset the Endpoint now:" -ForegroundColor Yellow
Write-Host "   - Press the RESET button on the Endpoint board" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter after you have reset the Endpoint"

Write-Host ""
Write-Host "Waiting for Endpoint to boot..." -ForegroundColor White
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "Please check the Endpoint serial monitor for:" -ForegroundColor White
Write-Host "  - '✓ Loaded provisioning data from NVS'" -ForegroundColor Green
Write-Host "  - 'Node address: 0x0002'" -ForegroundColor Green
Write-Host "  - '✓ Generic OnOff Server bound to AppKey 0x0001'" -ForegroundColor Green
Write-Host ""

$endpointLoaded = Read-Host "Do you see these messages? (yes/no)"
if ($endpointLoaded -ne "yes") {
    Write-Host "✗ Test 6 Failed: Endpoint data was not loaded from NVS" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Test 6 Passed: Endpoint data loaded successfully after reset" -ForegroundColor Green
Write-Host ""

# Test 7: Final LED test
Write-Host "Test 7: Final LED control test..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Sending LED ON command..." -ForegroundColor White

try {
    .\test-led.ps1 -NodeAddress 2 -State on -Method mqtt -ErrorAction Stop
    Start-Sleep -Seconds 2
    
    Write-Host ""
    $finalTest = Read-Host "Did the LED turn ON (green)? (yes/no)"
    if ($finalTest -ne "yes") {
        Write-Host "✗ Test 7 Failed: LED did not turn on" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "✗ Test 7 Failed: Error sending LED command" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Test 7 Passed: Final LED control test successful" -ForegroundColor Green
Write-Host ""

# All tests passed
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  ✓ ALL TESTS PASSED!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  ✓ Devices are provisioned and data is saved to NVS" -ForegroundColor Green
Write-Host "  ✓ Model bindings are saved and loaded correctly" -ForegroundColor Green
Write-Host "  ✓ LED control works before and after reset" -ForegroundColor Green
Write-Host "  ✓ Gateway loads data from NVS after reset" -ForegroundColor Green
Write-Host "  ✓ Endpoint loads data from NVS after reset" -ForegroundColor Green
Write-Host "  ✓ No need to re-provision after reset!" -ForegroundColor Green
Write-Host ""

Write-Host "Mesh Storage is working correctly! 🎉" -ForegroundColor Cyan
Write-Host ""

