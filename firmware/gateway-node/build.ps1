# ESP32-C6 Gateway Build Script
# This script sets up the ESP-IDF environment and builds the firmware

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ESP32-C6 Gateway Firmware Build Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if ESP-IDF is installed
$espIdfPath = "E:\Espressif\frameworks\esp-idf-v5.5.1"
$exportScript = "$espIdfPath\export.ps1"

if (-not (Test-Path $exportScript)) {
    # Try alternative path
    $espIdfPath = "C:\Espressif\esp-idf"
    $exportScript = "$espIdfPath\export.ps1"
    
    if (-not (Test-Path $exportScript)) {
        Write-Host "ERROR: ESP-IDF not found!" -ForegroundColor Red
        Write-Host "Please install ESP-IDF first or update the path in this script." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Expected locations:" -ForegroundColor Yellow
        Write-Host "  - E:\Espressif\frameworks\esp-idf-v5.5.1\export.ps1" -ForegroundColor Yellow
        Write-Host "  - C:\Espressif\esp-idf\export.ps1" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "Found ESP-IDF at: $espIdfPath" -ForegroundColor Green
Write-Host ""

# Set up ESP-IDF environment
Write-Host "Setting up ESP-IDF environment..." -ForegroundColor Cyan
& $exportScript

# Verify idf.py is available
$idfPy = Get-Command idf.py -ErrorAction SilentlyContinue
if (-not $idfPy) {
    Write-Host "ERROR: idf.py not found after running export.ps1" -ForegroundColor Red
    Write-Host "Please open ESP-IDF PowerShell and run this script from there." -ForegroundColor Yellow
    exit 1
}

Write-Host "ESP-IDF environment ready!" -ForegroundColor Green
Write-Host ""

# Get the script directory (project root)
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

Write-Host "Project directory: $projectDir" -ForegroundColor Cyan
Write-Host ""

# Parse command line arguments
$command = $args[0]
$port = $args[1]

if (-not $command) {
    $command = "build"
}

switch ($command) {
    "clean" {
        Write-Host "Cleaning build directory..." -ForegroundColor Yellow
        if (Test-Path "build") {
            Remove-Item -Recurse -Force "build"
            Write-Host "Build directory cleaned!" -ForegroundColor Green
        } else {
            Write-Host "No build directory to clean." -ForegroundColor Yellow
        }
    }
    
    "set-target" {
        Write-Host "Setting target to ESP32-C6..." -ForegroundColor Cyan
        idf.py set-target esp32c6
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Target set successfully!" -ForegroundColor Green
        } else {
            Write-Host "Failed to set target!" -ForegroundColor Red
            exit 1
        }
    }
    
    "build" {
        Write-Host "Building firmware..." -ForegroundColor Cyan
        Write-Host "This may take 2-5 minutes on first build..." -ForegroundColor Yellow
        Write-Host ""
        
        idf.py build
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "BUILD SUCCESSFUL!" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Next steps:" -ForegroundColor Cyan
            Write-Host "1. Connect ESP32-C6 via USB" -ForegroundColor White
            Write-Host "2. Check COM port: [System.IO.Ports.SerialPort]::getportnames()" -ForegroundColor White
            Write-Host "3. Flash: .\build.ps1 flash COM3" -ForegroundColor White
            Write-Host ""
        } else {
            Write-Host ""
            Write-Host "BUILD FAILED!" -ForegroundColor Red
            Write-Host "Check the error messages above." -ForegroundColor Yellow
            exit 1
        }
    }
    
    "flash" {
        if (-not $port) {
            Write-Host "ERROR: COM port not specified!" -ForegroundColor Red
            Write-Host "Usage: .\build.ps1 flash COM3" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Available ports:" -ForegroundColor Cyan
            [System.IO.Ports.SerialPort]::getportnames()
            exit 1
        }
        
        Write-Host "Flashing to $port..." -ForegroundColor Cyan
        idf.py -p $port flash
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "FLASH SUCCESSFUL!" -ForegroundColor Green
            Write-Host ""
            Write-Host "To monitor serial output:" -ForegroundColor Cyan
            Write-Host "  .\build.ps1 monitor $port" -ForegroundColor White
            Write-Host ""
        } else {
            Write-Host "FLASH FAILED!" -ForegroundColor Red
            exit 1
        }
    }
    
    "monitor" {
        if (-not $port) {
            Write-Host "ERROR: COM port not specified!" -ForegroundColor Red
            Write-Host "Usage: .\build.ps1 monitor COM3" -ForegroundColor Yellow
            exit 1
        }
        
        Write-Host "Starting serial monitor on $port..." -ForegroundColor Cyan
        Write-Host "Press Ctrl+] to exit" -ForegroundColor Yellow
        Write-Host ""
        idf.py -p $port monitor
    }
    
    "flash-monitor" {
        if (-not $port) {
            Write-Host "ERROR: COM port not specified!" -ForegroundColor Red
            Write-Host "Usage: .\build.ps1 flash-monitor COM3" -ForegroundColor Yellow
            exit 1
        }
        
        Write-Host "Flashing and monitoring on $port..." -ForegroundColor Cyan
        idf.py -p $port flash monitor
    }
    
    "menuconfig" {
        Write-Host "Opening configuration menu..." -ForegroundColor Cyan
        idf.py menuconfig
    }
    
    "help" {
        Write-Host "ESP32-C6 Gateway Build Script" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Usage: .\build.ps1 [command] [port]" -ForegroundColor White
        Write-Host ""
        Write-Host "Commands:" -ForegroundColor Cyan
        Write-Host "  clean          - Clean build directory" -ForegroundColor White
        Write-Host "  set-target     - Set target to ESP32-C6" -ForegroundColor White
        Write-Host "  build          - Build firmware (default)" -ForegroundColor White
        Write-Host "  flash COM3     - Flash firmware to COM3" -ForegroundColor White
        Write-Host "  monitor COM3   - Monitor serial output on COM3" -ForegroundColor White
        Write-Host "  flash-monitor COM3 - Flash and monitor" -ForegroundColor White
        Write-Host "  menuconfig     - Open configuration menu" -ForegroundColor White
        Write-Host "  help           - Show this help" -ForegroundColor White
        Write-Host ""
        Write-Host "Examples:" -ForegroundColor Cyan
        Write-Host "  .\build.ps1                    # Build firmware" -ForegroundColor White
        Write-Host "  .\build.ps1 flash COM3         # Flash to COM3" -ForegroundColor White
        Write-Host "  .\build.ps1 flash-monitor COM3 # Flash and monitor" -ForegroundColor White
        Write-Host ""
    }
    
    default {
        Write-Host "Unknown command: $command" -ForegroundColor Red
        Write-Host "Run '.\build.ps1 help' for usage information." -ForegroundColor Yellow
        exit 1
    }
}

