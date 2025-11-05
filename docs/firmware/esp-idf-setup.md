# ESP-IDF Setup Guide for Windows

This guide will help you install ESP-IDF (Espressif IoT Development Framework) to build and flash firmware for the ESP32-C6 gateway and endpoint nodes.

## Prerequisites

- Windows 10/11
- At least 10GB free disk space
- USB cable for ESP32-C6
- Administrator privileges

## Installation Methods

### Method 1: ESP-IDF Installer (Recommended for Beginners)

This is the easiest method for Windows users.

#### Step 1: Download ESP-IDF Installer

1. Visit: https://dl.espressif.com/dl/esp-idf/
2. Download the latest **ESP-IDF Tools Installer** for Windows
   - Look for: `esp-idf-tools-setup-x.x.x.exe`
   - Recommended version: **ESP-IDF v5.1 or later**

#### Step 2: Run the Installer

1. Run the installer as Administrator
2. Choose installation options:
   - **ESP-IDF Version**: Select v5.1 or later
   - **Installation Directory**: Default is `C:\Espressif`
   - **Download Server**: Choose closest to your location
   - **Python**: Let installer install Python (if not already installed)

3. Select components to install:
   - ✅ ESP-IDF
   - ✅ ESP-IDF Tools
   - ✅ Python
   - ✅ Git (if not installed)

4. Click **Install** and wait (this may take 15-30 minutes)

#### Step 3: Verify Installation

After installation completes:

1. Open **ESP-IDF PowerShell** (installed by the installer)
   - Look for it in Start Menu: "ESP-IDF PowerShell"

2. Verify installation:
   ```powershell
   idf.py --version
   ```
   
   Expected output:
   ```
   ESP-IDF v5.1.x
   ```

### Method 2: Manual Installation (Advanced Users)

If you prefer manual installation or the installer doesn't work:

#### Step 1: Install Prerequisites

1. **Install Git**
   - Download from: https://git-scm.com/download/win
   - Install with default options

2. **Install Python 3.8+**
   - Download from: https://www.python.org/downloads/
   - ⚠️ **Important**: Check "Add Python to PATH" during installation

#### Step 2: Clone ESP-IDF

```powershell
# Create directory
mkdir C:\Espressif
cd C:\Espressif

# Clone ESP-IDF
git clone -b v5.1 --recursive https://github.com/espressif/esp-idf.git
```

#### Step 3: Install ESP-IDF Tools

```powershell
cd C:\Espressif\esp-idf
.\install.bat esp32c6
```

This will download and install all required tools.

#### Step 4: Set Up Environment

Every time you want to use ESP-IDF, run:

```powershell
C:\Espressif\esp-idf\export.bat
```

Or add it to your PowerShell profile for automatic setup.

## Building the Gateway Firmware

### Step 1: Open ESP-IDF Terminal

**Option A: Using ESP-IDF PowerShell (if installed via installer)**
- Open "ESP-IDF PowerShell" from Start Menu

**Option B: Using regular PowerShell**
```powershell
# Run this first to set up environment
C:\Espressif\esp-idf\export.bat
```

### Step 2: Navigate to Project

```powershell
cd c:\Users\Aimz\source\repos\smart-storage-device\firmware\gateway-node
```

### Step 3: Set Target (First Time Only)

```powershell
idf.py set-target esp32c6
```

### Step 4: Build the Firmware

```powershell
idf.py build
```

This will:
- Configure the project
- Compile all source files
- Link the firmware
- Generate binary files

**Build time**: 2-5 minutes (first build is slower)

### Step 5: Connect ESP32-C6

1. Connect your ESP32-C6 to PC via USB
2. Check which COM port it's using:
   ```powershell
   # List available COM ports
   [System.IO.Ports.SerialPort]::getportnames()
   ```
   
   Common ports: `COM3`, `COM4`, `COM5`, etc.

### Step 6: Flash the Firmware

```powershell
# Replace COM3 with your actual port
idf.py -p COM3 flash
```

### Step 7: Monitor Serial Output

```powershell
idf.py -p COM3 monitor
```

Or combine flash and monitor:
```powershell
idf.py -p COM3 flash monitor
```

**To exit monitor**: Press `Ctrl + ]`

## Expected Output

When the gateway boots, you should see:

```
I (xxx) GATEWAY_NODE: Smart Storage Gateway Node starting...
I (xxx) GATEWAY_NODE: WiFi initialization finished
I (xxx) GATEWAY_NODE: Connected to AP SSID:AuraLink
I (xxx) GATEWAY_NODE: Got IP:192.168.x.x
I (xxx) GATEWAY_NODE: MQTT_EVENT_CONNECTED
I (xxx) GATEWAY_NODE: Provisioning registered, err_code 0
I (xxx) GATEWAY_NODE: BLE Mesh Gateway initialized
I (xxx) GATEWAY_NODE: Gateway Node ready
```

## Building the Endpoint Firmware

Same process, but for endpoint nodes:

```powershell
cd c:\Users\Aimz\source\repos\smart-storage-device\firmware\endpoint-node
idf.py set-target esp32c6
idf.py build
idf.py -p COM3 flash monitor
```

## Troubleshooting

### "idf.py not recognized"

**Solution**: ESP-IDF environment not set up
```powershell
# Run this first
C:\Espressif\esp-idf\export.bat
```

### "Port COM3 not found"

**Solution**: Check which port your device is on
```powershell
[System.IO.Ports.SerialPort]::getportnames()
```

### "Failed to connect to ESP32-C6"

**Solutions**:
1. Hold BOOT button while connecting
2. Try different USB cable
3. Install USB drivers: https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers
4. Check Device Manager for COM port

### Build Errors

**"CMake Error"**
```powershell
# Clean and rebuild
idf.py fullclean
idf.py build
```

**"Python module not found"**
```powershell
# Reinstall Python requirements
cd C:\Espressif\esp-idf
.\install.bat esp32c6
```

### Permission Denied on COM Port

**Solution**: Close any other programs using the serial port
- Arduino IDE
- PuTTY
- Other terminal programs

## Quick Reference Commands

```powershell
# Set up ESP-IDF environment (run first)
C:\Espressif\esp-idf\export.bat

# Navigate to project
cd firmware/gateway-node

# Configure for ESP32-C6 (first time only)
idf.py set-target esp32c6

# Build firmware
idf.py build

# Flash firmware
idf.py -p COM3 flash

# Monitor serial output
idf.py -p COM3 monitor

# Flash and monitor (combined)
idf.py -p COM3 flash monitor

# Clean build
idf.py fullclean

# Configuration menu
idf.py menuconfig

# Erase flash completely
idf.py -p COM3 erase-flash
```

## VS Code Integration (Optional)

For better development experience:

1. Install **ESP-IDF Extension** in VS Code
2. Configure extension to use your ESP-IDF installation
3. Use built-in commands for building/flashing

## Next Steps

After successfully flashing:

1. ✅ Gateway firmware flashed
2. 🔲 Set up backend server
3. 🔲 Test MQTT communication
4. 🔲 Provision BLE mesh network
5. 🔲 Flash endpoint nodes
6. 🔲 Test complete system

## Additional Resources

- [ESP-IDF Documentation](https://docs.espressif.com/projects/esp-idf/en/latest/)
- [ESP32-C6 Datasheet](https://www.espressif.com/sites/default/files/documentation/esp32-c6_datasheet_en.pdf)
- [ESP-IDF GitHub](https://github.com/espressif/esp-idf)
- [Espressif Forum](https://www.esp32.com/)

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: Smart Storage Team

