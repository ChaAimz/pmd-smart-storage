# PowerShell Script สำหรับ Reset Provisioning
# ใช้งาน: .\reset-provisioning.ps1

param(
    [Parameter(Mandatory=$false)]
    [string]$GatewayPort = "COM5",
    
    [Parameter(Mandatory=$false)]
    [string]$EndpointPort = "COM6",
    
    [Parameter(Mandatory=$false)]
    [switch]$GatewayOnly = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$EndpointOnly = $false
)

$ErrorActionPreference = "Stop"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Reset BLE Mesh Provisioning" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "⚠️  WARNING: This will ERASE ALL PROVISIONING DATA!" -ForegroundColor Yellow
Write-Host ""
Write-Host "This will:" -ForegroundColor White
Write-Host "  - Erase all BLE Mesh provisioning data" -ForegroundColor White
Write-Host "  - Erase WiFi credentials (Gateway only)" -ForegroundColor White
Write-Host "  - Erase MQTT settings (Gateway only)" -ForegroundColor White
Write-Host "  - Flash firmware again" -ForegroundColor White
Write-Host ""
Write-Host "After reset, you will need to:" -ForegroundColor Yellow
Write-Host "  1. Provision devices again with nRF Mesh App" -ForegroundColor White
Write-Host "  2. Bind AppKey to models" -ForegroundColor White
Write-Host "  3. Set publication and subscription" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Are you sure you want to continue? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Cancelled." -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "Settings:" -ForegroundColor Yellow
Write-Host "  Gateway Port: $GatewayPort" -ForegroundColor White
Write-Host "  Endpoint Port: $EndpointPort" -ForegroundColor White
Write-Host ""

# Function to erase and flash
function Reset-Device {
    param(
        [string]$Name,
        [string]$Path,
        [string]$Port
    )
    
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "  Resetting $Name" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
    
    Push-Location $Path
    
    try {
        # Erase flash
        Write-Host "1. Erasing flash on $Port..." -ForegroundColor Yellow
        idf.py -p $Port erase-flash
        if ($LASTEXITCODE -ne 0) {
            throw "Erase flash failed"
        }
        Write-Host "   ✓ Flash erased" -ForegroundColor Green
        Write-Host ""
        
        # Flash firmware
        Write-Host "2. Flashing firmware to $Port..." -ForegroundColor Yellow
        idf.py -p $Port flash
        if ($LASTEXITCODE -ne 0) {
            throw "Flash failed"
        }
        Write-Host "   ✓ Firmware flashed" -ForegroundColor Green
        Write-Host ""
        
        Write-Host "✓ $Name reset successfully!" -ForegroundColor Green
        Write-Host ""
        
    } catch {
        Write-Host "✗ Error: $_" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    Pop-Location
}

# Reset Gateway
if (-not $EndpointOnly) {
    Reset-Device -Name "Gateway" -Path "firmware/gateway-node" -Port $GatewayPort
}

# Reset Endpoint
if (-not $GatewayOnly) {
    Reset-Device -Name "Endpoint" -Path "firmware/endpoint-node" -Port $EndpointPort
}

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Reset Complete!" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "✓ Provisioning data has been erased" -ForegroundColor Green
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Open nRF Mesh app on your phone" -ForegroundColor White
Write-Host ""
Write-Host "2. Provision Gateway (should get address 0x0001):" -ForegroundColor White
Write-Host "   - Scan for 'ESP Gateway'" -ForegroundColor Gray
Write-Host "   - Provision the device" -ForegroundColor Gray
Write-Host "   - Bind App Key 1 to Generic OnOff Client ⭐" -ForegroundColor Green
Write-Host "   - Set Publication to C000" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Provision Endpoint (should get address 0x0002):" -ForegroundColor White
Write-Host "   - Scan for 'ESP BLE Mesh Node'" -ForegroundColor Gray
Write-Host "   - Provision the device" -ForegroundColor Gray
Write-Host "   - Bind App Key 1 to Generic OnOff Server ⭐" -ForegroundColor Green
Write-Host "   - Set Publication to C000" -ForegroundColor Gray
Write-Host "   - Add Subscription C000" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Test LED control:" -ForegroundColor White
Write-Host "   .\test-led.ps1 -NodeAddress 2 -State on" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Test reset and load:" -ForegroundColor White
Write-Host "   - Press RESET button on both devices" -ForegroundColor Gray
Write-Host "   - Check serial monitor for 'Loaded provisioning data from NVS'" -ForegroundColor Gray
Write-Host "   - Test LED control again (should work without re-provisioning)" -ForegroundColor Gray
Write-Host ""

Write-Host "See RESET_PROVISIONING.md for detailed instructions" -ForegroundColor Cyan
Write-Host ""

Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

