# PowerShell Script สำหรับ Rebuild และ Flash ทั้ง Gateway และ Endpoint
# ใช้งาน: .\rebuild-all.ps1

param(
    [Parameter(Mandatory=$false)]
    [string]$GatewayPort = "COM5",
    
    [Parameter(Mandatory=$false)]
    [string]$EndpointPort = "COM6",
    
    [Parameter(Mandatory=$false)]
    [switch]$EraseFlash = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$GatewayOnly = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$EndpointOnly = $false
)

$ErrorActionPreference = "Stop"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Rebuild BLE Mesh Firmware" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

if ($EraseFlash) {
    Write-Host "⚠️  WARNING: This will ERASE ALL DATA including provisioning!" -ForegroundColor Yellow
    Write-Host "   You will need to provision devices again with nRF Mesh App" -ForegroundColor Yellow
    Write-Host ""
    $confirm = Read-Host "Are you sure? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "Cancelled." -ForegroundColor Red
        exit 0
    }
}

Write-Host "Settings:" -ForegroundColor Yellow
Write-Host "  Gateway Port: $GatewayPort" -ForegroundColor White
Write-Host "  Endpoint Port: $EndpointPort" -ForegroundColor White
Write-Host "  Erase Flash: $EraseFlash" -ForegroundColor White
Write-Host ""

# Function to build and flash
function Build-And-Flash {
    param(
        [string]$Name,
        [string]$Path,
        [string]$Port,
        [bool]$Erase
    )
    
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "  Building $Name" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
    
    Push-Location $Path
    
    try {
        # Clean build
        Write-Host "1. Cleaning previous build..." -ForegroundColor Yellow
        idf.py fullclean
        if ($LASTEXITCODE -ne 0) {
            throw "Clean failed"
        }
        Write-Host "   ✓ Clean complete" -ForegroundColor Green
        Write-Host ""
        
        # Build
        Write-Host "2. Building firmware..." -ForegroundColor Yellow
        idf.py build
        if ($LASTEXITCODE -ne 0) {
            throw "Build failed"
        }
        Write-Host "   ✓ Build complete" -ForegroundColor Green
        Write-Host ""
        
        # Erase flash if requested
        if ($Erase) {
            Write-Host "3. Erasing flash..." -ForegroundColor Yellow
            idf.py -p $Port erase-flash
            if ($LASTEXITCODE -ne 0) {
                throw "Erase flash failed"
            }
            Write-Host "   ✓ Flash erased" -ForegroundColor Green
            Write-Host ""
        }
        
        # Flash
        Write-Host "4. Flashing firmware to $Port..." -ForegroundColor Yellow
        idf.py -p $Port flash
        if ($LASTEXITCODE -ne 0) {
            throw "Flash failed"
        }
        Write-Host "   ✓ Flash complete" -ForegroundColor Green
        Write-Host ""
        
        Write-Host "✓ $Name completed successfully!" -ForegroundColor Green
        Write-Host ""
        
    } catch {
        Write-Host "✗ Error: $_" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    Pop-Location
}

# Build Gateway
if (-not $EndpointOnly) {
    Build-And-Flash -Name "Gateway" -Path "firmware/gateway-node" -Port $GatewayPort -Erase $EraseFlash
}

# Build Endpoint
if (-not $GatewayOnly) {
    Build-And-Flash -Name "Endpoint" -Path "firmware/endpoint-node" -Port $EndpointPort -Erase $EraseFlash
}

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  All Done!" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

if ($EraseFlash) {
    Write-Host "⚠️  IMPORTANT: Flash was erased!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Open nRF Mesh app on your phone" -ForegroundColor White
    Write-Host "2. Provision Gateway (should get address 0x0001)" -ForegroundColor White
    Write-Host "   - Bind App Key 1 to Generic OnOff Client ⭐" -ForegroundColor Green
    Write-Host "   - Set Publication to C000" -ForegroundColor White
    Write-Host "   - Bind App Key 1 to Generic OnOff Server" -ForegroundColor White
    Write-Host "   - Add Subscription C000" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Provision Endpoint (should get address 0x0002)" -ForegroundColor White
    Write-Host "   - Bind App Key 1 to Generic OnOff Server ⭐" -ForegroundColor Green
    Write-Host "   - Set Publication to C000" -ForegroundColor White
    Write-Host "   - Add Subscription C000" -ForegroundColor White
    Write-Host ""
    Write-Host "4. Test LED control:" -ForegroundColor White
    Write-Host "   .\test-led.ps1 -NodeAddress 2 -State on" -ForegroundColor Gray
    Write-Host ""
    Write-Host "See FIX_APPKEY_ERROR.md for detailed instructions" -ForegroundColor Cyan
} else {
    Write-Host "✓ Firmware updated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The devices should automatically load provisioning data from NVS." -ForegroundColor White
    Write-Host ""
    Write-Host "Monitor Gateway:" -ForegroundColor Yellow
    Write-Host "  cd firmware/gateway-node" -ForegroundColor Gray
    Write-Host "  idf.py -p $GatewayPort monitor" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Monitor Endpoint:" -ForegroundColor Yellow
    Write-Host "  cd firmware/endpoint-node" -ForegroundColor Gray
    Write-Host "  idf.py -p $EndpointPort monitor" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Test LED:" -ForegroundColor Yellow
    Write-Host "  .\test-led.ps1 -NodeAddress 2 -State on" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

