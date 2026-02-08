# Test Factory Reset Feature
# This script helps test the factory reset functionality

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("Gateway", "Endpoint", "Both")]
    [string]$Device = "Both",
    
    [Parameter(Mandatory=$false)]
    [string]$GatewayPort = "COM5",
    
    [Parameter(Mandatory=$false)]
    [string]$EndpointPort = "COM6"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Factory Reset Test Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

function Test-FactoryReset {
    param(
        [string]$DeviceName,
        [string]$Port,
        [string]$GPIO
    )
    
    Write-Host "Testing $DeviceName Factory Reset..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Instructions:" -ForegroundColor White
    Write-Host "1. Make sure $DeviceName is connected to $Port" -ForegroundColor White
    Write-Host "2. Open serial monitor: idf.py -p $Port monitor" -ForegroundColor White
    Write-Host "3. Press and hold BOOT button ($GPIO) for 10 seconds" -ForegroundColor White
    Write-Host ""
    Write-Host "Expected Timeline:" -ForegroundColor Cyan
    Write-Host "  0s  - 'Button hold detected - hold for 10 seconds to factory reset'" -ForegroundColor Gray
    Write-Host "  3s  - '⚠️  Factory reset in 7 seconds...'" -ForegroundColor Yellow
    Write-Host "  7s  - '🔴 FACTORY RESET IN 3 SECONDS! Release button to cancel!'" -ForegroundColor Red
    Write-Host "  10s - '🔴 FACTORY RESET TRIGGERED!'" -ForegroundColor Red
    Write-Host "       - Device will restart" -ForegroundColor Gray
    Write-Host ""
    Write-Host "After restart, you should see:" -ForegroundColor Cyan
    Write-Host "  'Device not provisioned yet'" -ForegroundColor Green
    Write-Host ""
    
    $response = Read-Host "Ready to test? (y/n)"
    if ($response -eq "y") {
        Write-Host "Opening serial monitor..." -ForegroundColor Green
        Write-Host "Press Ctrl+] to exit monitor" -ForegroundColor Yellow
        Write-Host ""
        
        # Change to device directory
        $deviceDir = if ($DeviceName -eq "Gateway") { "firmware\gateway-node" } else { "firmware\endpoint-node" }
        Push-Location $deviceDir
        
        # Open serial monitor
        idf.py -p $Port monitor
        
        Pop-Location
    }
}

function Test-CancelFactoryReset {
    param(
        [string]$DeviceName,
        [string]$Port,
        [string]$GPIO
    )
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Testing Factory Reset Cancellation..." -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Instructions:" -ForegroundColor White
    Write-Host "1. Press and hold BOOT button ($GPIO)" -ForegroundColor White
    Write-Host "2. Wait for warning message (3-7 seconds)" -ForegroundColor White
    Write-Host "3. Release button BEFORE 10 seconds" -ForegroundColor White
    Write-Host ""
    Write-Host "Expected result:" -ForegroundColor Cyan
    Write-Host "  'Factory reset cancelled (held for XXXX ms)'" -ForegroundColor Green
    Write-Host "  Device should NOT restart" -ForegroundColor Green
    Write-Host "  Provisioning data should remain intact" -ForegroundColor Green
    Write-Host ""
    
    $response = Read-Host "Ready to test cancellation? (y/n)"
    if ($response -eq "y") {
        Write-Host "Opening serial monitor..." -ForegroundColor Green
        Write-Host "Press Ctrl+] to exit monitor" -ForegroundColor Yellow
        Write-Host ""
        
        # Change to device directory
        $deviceDir = if ($DeviceName -eq "Gateway") { "firmware\gateway-node" } else { "firmware\endpoint-node" }
        Push-Location $deviceDir
        
        # Open serial monitor
        idf.py -p $Port monitor
        
        Pop-Location
    }
}

# Main test flow
Write-Host "Factory Reset Test Options:" -ForegroundColor Cyan
Write-Host "1. Test Factory Reset (hold 10 seconds)" -ForegroundColor White
Write-Host "2. Test Factory Reset Cancellation (release before 10 seconds)" -ForegroundColor White
Write-Host "3. Both tests" -ForegroundColor White
Write-Host ""

$testOption = Read-Host "Select test option (1/2/3)"

if ($Device -eq "Gateway" -or $Device -eq "Both") {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "GATEWAY NODE" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    if ($testOption -eq "1" -or $testOption -eq "3") {
        Test-FactoryReset -DeviceName "Gateway" -Port $GatewayPort -GPIO "GPIO0"
    }

    if ($testOption -eq "2" -or $testOption -eq "3") {
        Test-CancelFactoryReset -DeviceName "Gateway" -Port $GatewayPort -GPIO "GPIO0"
    }
}

if ($Device -eq "Endpoint" -or $Device -eq "Both") {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "ENDPOINT NODE" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Note: Endpoint uses the same button for two functions:" -ForegroundColor Yellow
    Write-Host "  - Short press (< 1 second): Send button press message" -ForegroundColor Gray
    Write-Host "  - Long press (10 seconds): Factory reset" -ForegroundColor Gray
    Write-Host ""

    if ($testOption -eq "1" -or $testOption -eq "3") {
        Test-FactoryReset -DeviceName "Endpoint" -Port $EndpointPort -GPIO "GPIO0"
    }

    if ($testOption -eq "2" -or $testOption -eq "3") {
        Test-CancelFactoryReset -DeviceName "Endpoint" -Port $EndpointPort -GPIO "GPIO0"
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. If factory reset was successful, provision the device again" -ForegroundColor White
Write-Host "2. Use nRF Mesh App to provision and configure" -ForegroundColor White
Write-Host "3. Test LED control with: .\test-led.ps1 -NodeAddress 2 -State on" -ForegroundColor White
Write-Host ""
Write-Host "For more information, see:" -ForegroundColor Cyan
Write-Host "  - FACTORY_RESET_GUIDE.md" -ForegroundColor Gray
Write-Host "  - QUICK_RESET_GUIDE.md" -ForegroundColor Gray
Write-Host ""

