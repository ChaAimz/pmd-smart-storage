# PowerShell Script สำหรับ Build Endpoint Node
# ใช้งาน: .\build-endpoint.ps1

$ErrorActionPreference = "Stop"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Building Endpoint Node" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Set ESP-IDF environment
$env:IDF_PATH = "E:\Espressif\frameworks\esp-idf-v5.5.1"
$IDF_PY = "E:\Espressif\python_env\idf5.5_py3.11_env\Scripts\python.exe"
$IDF_TOOLS = "$env:IDF_PATH\tools\idf.py"

# Check if idf.py exists
if (-not (Test-Path $IDF_TOOLS)) {
    Write-Host "✗ Error: idf.py not found at $IDF_TOOLS" -ForegroundColor Red
    exit 1
}

# Navigate to endpoint directory
Push-Location "firmware\endpoint-node"

try {
    Write-Host "Building firmware..." -ForegroundColor Yellow
    Write-Host ""
    
    # Run build
    & $IDF_PY $IDF_TOOLS build
    
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed with exit code $LASTEXITCODE"
    }
    
    Write-Host ""
    Write-Host "✓ Build completed successfully!" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "✗ Build failed: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

