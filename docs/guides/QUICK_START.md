# Smart Storage System - Quick Start Guide

## 🎯 Current Status

✅ **Mosquitto MQTT Broker**: Running on `localhost:1883`  
✅ **Backend Server**: Running on `http://localhost:3000`  
✅ **Gateway Firmware**: Configured with MQTT broker IP `172.25.0.1:1883`  
⚠️ **ESP-IDF**: Not installed yet (needed to build firmware)

---

## 📋 What's Been Done

### 1. MQTT Broker Setup ✅
- Mosquitto installed and running
- Configuration files created in `docs/mqtt/`
- Test scripts available

### 2. Backend Server Setup ✅
- Dependencies installed
- Server running on port 3000
- Connected to database
- MQTT connection configured

### 3. Gateway Firmware Configuration ✅
- WiFi configured: `AuraLink`
- MQTT broker configured: `mqtt://172.25.0.1:1883`
- Ready to build and flash

---

## 🚀 Next Steps

### Step 1: Install ESP-IDF (Required for Building Firmware)

**Follow the guide**: `docs/firmware/esp-idf-setup.md`

**Quick install:**
1. Download ESP-IDF installer: https://dl.espressif.com/dl/esp-idf/
2. Run installer as Administrator
3. Select ESP-IDF v5.1 or later
4. Install to default location: `C:\Espressif`

### Step 2: Build and Flash Gateway Firmware

```powershell
# Open ESP-IDF PowerShell (from Start Menu)

# Navigate to project
cd c:\Users\Aimz\source\repos\smart-storage-device\firmware\gateway-node

# Set target (first time only)
idf.py set-target esp32c6

# Build
idf.py build

# Connect ESP32-C6 via USB and flash
idf.py -p COM3 flash monitor
```

### Step 3: Test the System

**Terminal 1 - Monitor MQTT:**
```powershell
cd "C:\Program Files\mosquitto"
.\mosquitto_sub.exe -h localhost -t 'smart-storage/#' -v
```

**Terminal 2 - Backend Server (already running):**
```powershell
cd backend/server
npm start
```

**Terminal 3 - Gateway Serial Monitor:**
```powershell
# After flashing
idf.py -p COM3 monitor
```

### Step 4: Verify Everything Works

**Test MQTT:**
```powershell
cd "C:\Program Files\mosquitto"
.\mosquitto_pub.exe -h localhost -t 'smart-storage/button' -m '{"node_addr":1,"event":"button_press"}'
```

**Test Backend API:**
```powershell
curl http://localhost:3000/health
curl http://localhost:3000/api/locations
curl http://localhost:3000/api/events/recent
```

---

## 📁 Important Files

### Configuration Files
- `firmware/gateway-node/main/main.c` - Gateway firmware (WiFi & MQTT configured)
- `backend/server/.env` - Backend server configuration
- `docs/mqtt/mosquitto.conf` - MQTT broker configuration

### Documentation
- `docs/mqtt/mosquitto-setup.md` - Complete MQTT setup guide
- `docs/firmware/esp-idf-setup.md` - ESP-IDF installation guide
- `docs/testing/complete-system-test.md` - Full testing guide
- `docs/provisioning/guide.md` - BLE mesh provisioning guide

### Scripts
- `docs/mqtt/setup-mosquitto.ps1` - Automated MQTT setup (requires Admin)
- `docs/mqtt/test-mqtt.ps1` - MQTT testing script

---

## 🧪 Testing Commands

### MQTT Broker

```powershell
# Check if running
Get-Service mosquitto

# Subscribe to all Smart Storage topics
cd "C:\Program Files\mosquitto"
.\mosquitto_sub.exe -h localhost -t 'smart-storage/#' -v

# Publish test button press
.\mosquitto_pub.exe -h localhost -t 'smart-storage/button' -m '{"node_addr":1,"event":"button_press","timestamp":1234567890}'

# Publish test LED command
.\mosquitto_pub.exe -h localhost -t 'smart-storage/command' -m '{"node_addr":1,"led_state":true}'
```

### Backend Server

```powershell
# Health check
curl http://localhost:3000/health

# Get all locations
curl http://localhost:3000/api/locations

# Get all items
curl http://localhost:3000/api/items

# Get recent events
curl http://localhost:3000/api/events/recent

# Send LED command
curl -X POST http://localhost:3000/api/command/led `
  -H "Content-Type: application/json" `
  -d '{"node_addr":1,"led_state":true}'
```

### Gateway Firmware

```powershell
# Build
idf.py build

# Flash
idf.py -p COM3 flash

# Monitor
idf.py -p COM3 monitor

# Flash and monitor (combined)
idf.py -p COM3 flash monitor

# Clean build
idf.py fullclean
```

---

## 🔧 Troubleshooting

### Mosquitto Not Running

```powershell
# Start service (requires Admin)
net start mosquitto

# Or run manually
cd "C:\Program Files\mosquitto"
.\mosquitto.exe -v
```

### Backend Server Issues

```powershell
# Reinstall dependencies
cd backend/server
npm install

# Check if port 3000 is in use
netstat -ano | findstr :3000

# View logs
npm start
```

### ESP-IDF Not Found

```powershell
# Set up environment
C:\Espressif\esp-idf\export.bat

# Then run idf.py commands
```

### Gateway Can't Connect to MQTT

**Check:**
1. Mosquitto is running
2. Firewall allows port 1883
3. IP address is correct in firmware
4. Gateway has WiFi connectivity

**Test from PC:**
```powershell
.\mosquitto_pub.exe -h 172.25.0.1 -t 'test' -m 'hello'
```

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your PC (172.25.0.1)                 │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Mosquitto   │←→│   Backend    │←→│   Frontend   │ │
│  │  MQTT Broker │  │    Server    │  │  Dashboard   │ │
│  │  :1883       │  │    :3000     │  │    :5173     │ │
│  └──────┬───────┘  └──────────────┘  └──────────────┘ │
│         │                                               │
└─────────┼───────────────────────────────────────────────┘
          │ WiFi/MQTT
          ↓
   ┌──────────────┐
   │   Gateway    │
   │   ESP32-C6   │
   │  (BLE Mesh)  │
   └──────┬───────┘
          │ BLE Mesh
          ↓
   ┌──────────────┐
   │  Endpoint    │
   │   Nodes      │
   │  ESP32-C6    │
   └──────────────┘
```

---

## 🎯 Current Configuration

### WiFi
- **SSID**: `AuraLink`
- **Password**: `Abc1234567890`

### MQTT Broker
- **Local URL**: `mqtt://localhost:1883`
- **Network URL**: `mqtt://172.25.0.1:1883`
- **Topics**:
  - `smart-storage/status` - Gateway status
  - `smart-storage/button` - Button press events
  - `smart-storage/command` - LED control commands

### Backend Server
- **URL**: `http://localhost:3000`
- **API**: `http://localhost:3000/api`
- **Database**: `backend/server/data/warehouse.db`

### Frontend Dashboard
- **URL**: `http://localhost:5173` (when running)
- **Start**: `cd frontend && npm run dev`

---

## 📚 Additional Resources

- [ESP-IDF Documentation](https://docs.espressif.com/projects/esp-idf/en/latest/)
- [Mosquitto Documentation](https://mosquitto.org/documentation/)
- [MQTT Protocol](https://mqtt.org/)
- [Bluetooth Mesh Specification](https://www.bluetooth.com/specifications/specs/mesh-protocol/)

---

## ✅ Success Checklist

- [ ] ESP-IDF installed
- [ ] Gateway firmware built successfully
- [ ] Gateway flashed to ESP32-C6
- [ ] Gateway connects to WiFi
- [ ] Gateway connects to MQTT broker
- [ ] Backend server receives messages
- [ ] API endpoints respond correctly
- [ ] MQTT messages flow end-to-end
- [ ] Endpoint nodes provisioned (optional)
- [ ] Complete system test passed

---

**Need Help?**

Check the detailed guides in the `docs/` directory:
- `docs/mqtt/` - MQTT broker setup
- `docs/firmware/` - Firmware building and flashing
- `docs/testing/` - Complete testing procedures
- `docs/provisioning/` - BLE mesh provisioning

---

**Last Updated**: 2024  
**Project**: Smart Storage Device  
**Status**: Ready for firmware flashing

