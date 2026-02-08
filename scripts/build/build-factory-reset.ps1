# PowerShell Script to Build Both Gateway and Endpoint with Factory Reset Feature
# Usage: .\build-factory-reset.ps1

param(
    [Parameter(Mandatory=$false)]
    [switch]$Flash,
    
    [Parameter(Mandatory=$false)]
    [string]$GatewayPort = "COM5",
    
    [Parameter(Mandatory=$false)]
    [string]$EndpointPort = "COM6"
)

$ErrorActionPreference = "Stop"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Build Factory Reset Feature" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if ESP-IDF environment is set up
if (-not $env:IDF_PATH) {
    Write-Host "❌ Error: ESP-IDF environment not set up!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run this script from ESP-IDF Command Prompt:" -ForegroundColor Yellow
    Write-Host "  1. Open 'ESP-IDF 5.5 CMD' from Start Menu" -ForegroundColor Gray
    Write-Host "  2. Navigate to project directory:" -ForegroundColor Gray
    Write-Host "     cd C:\Users\Aimz\source\repos\smart-storage-device" -ForegroundColor Gray
    Write-Host "  3. Run this script: .\build-factory-reset.ps1" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "✓ ESP-IDF environment detected" -ForegroundColor Green
Write-Host "  IDF_PATH: $env:IDF_PATH" -ForegroundColor Gray
Write-Host ""

# Build Gateway
Write-Host "================================" -ForegroundColor Yellow
Write-Host "  Building Gateway Node" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Yellow
Write-Host ""

Push-Location firmware\gateway-node
try {
    Write-Host "Running: idf.py build" -ForegroundColor Gray
    idf.py build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Gateway build failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "✓ Gateway build successful!" -ForegroundColor Green
    Write-Host ""
} finally {
    Pop-Location
}

# Build Endpoint
Write-Host "================================" -ForegroundColor Yellow
Write-Host "  Building Endpoint Node" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Yellow
Write-Host ""

Push-Location firmware\endpoint-node
try {
    Write-Host "Running: idf.py build" -ForegroundColor Gray
    idf.py build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Endpoint build failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "✓ Endpoint build successful!" -ForegroundColor Green
    Write-Host ""
} finally {
    Pop-Location
}

Write-Host "================================" -ForegroundColor Green
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

# Flash if requested
if ($Flash) {
    Write-Host "================================" -ForegroundColor Yellow
    Write-Host "  Flashing Devices" -ForegroundColor Yellow
    Write-Host "================================" -ForegroundColor Yellow
    Write-Host ""
    
    # Flash Gateway
    Write-Host "Flashing Gateway to $GatewayPort..." -ForegroundColor Yellow
    Push-Location firmware\gateway-node
    try {
        idf.py -p $GatewayPort flash
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "✗ Gateway flash failed!" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "✓ Gateway flashed successfully!" -ForegroundColor Green
        Write-Host ""
    } finally {
        Pop-Location
    }
    
    # Flash Endpoint
    Write-Host "Flashing Endpoint to $EndpointPort..." -ForegroundColor Yellow
    Push-Location firmware\endpoint-node
    try {
        idf.py -p $EndpointPort flash
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "✗ Endpoint flash failed!" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "✓ Endpoint flashed successfully!" -ForegroundColor Green
        Write-Host ""
    } finally {
        Pop-Location
    }
    
    Write-Host "================================" -ForegroundColor Green
    Write-Host "  Flash Complete!" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host ""
}

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host ""

if (-not $Flash) {
    Write-Host "To flash the firmware:" -ForegroundColor Yellow
    Write-Host "  .\build-factory-reset.ps1 -Flash" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Or flash individually:" -ForegroundColor Yellow
    Write-Host "  cd firmware\gateway-node" -ForegroundColor Gray
    Write-Host "  idf.py -p $GatewayPort flash monitor" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  cd firmware\endpoint-node" -ForegroundColor Gray
    Write-Host "  idf.py -p $EndpointPort flash monitor" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "To test factory reset:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Method 1: MQTT Command" -ForegroundColor Cyan
Write-Host "    .\test-factory-reset-mqtt.ps1 -NodeAddress 2" -ForegroundColor Gray
Write-Host ""
Write-Host "  Method 2: GPIO0 Button" -ForegroundColor Cyan
Write-Host "    1. Open Endpoint serial monitor" -ForegroundColor Gray
Write-Host "    2. Press and hold BOOT button for 10 seconds" -ForegroundColor Gray
Write-Host "    3. Watch for warnings and factory reset" -ForegroundColor Gray
Write-Host ""

Write-Host "Documentation:" -ForegroundColor Yellow
Write-Host "  FACTORY_RESET_METHODS.md - Complete guide" -ForegroundColor Gray
Write-Host "  TEST_FACTORY_RESET.md - Testing guide" -ForegroundColor Gray
Write-Host ""

