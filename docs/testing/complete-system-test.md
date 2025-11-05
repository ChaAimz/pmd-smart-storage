# Complete System Testing Guide

This guide walks you through testing the entire Smart Storage system from MQTT broker to gateway to backend server.

## System Architecture

```
[ESP32-C6 Gateway] ←WiFi→ [PC with Mosquitto] ←→ [Backend Server]
       ↕ BLE Mesh
[ESP32-C6 Endpoints]
```

## Prerequisites Checklist

Before testing, ensure:

- ✅ Mosquitto MQTT broker is running on your PC
- ✅ Backend server dependencies installed (`npm install`)
- ✅ Gateway firmware configured with correct MQTT broker IP
- ✅ ESP32-C6 gateway device ready to flash
- ✅ ESP-IDF installed (for building firmware)

## Test Plan

### Phase 1: MQTT Broker Test
### Phase 2: Backend Server Test
### Phase 3: Gateway Firmware Test
### Phase 4: End-to-End Integration Test

---

## Phase 1: MQTT Broker Test

### 1.1 Verify Mosquitto is Running

```powershell
# Check service status
Get-Service mosquitto

# Should show: Status = Running
```

### 1.2 Test Basic Pub/Sub

**Terminal 1 - Subscribe:**
```powershell
cd "C:\Program Files\mosquitto"
.\mosquitto_sub.exe -h localhost -t 'test/#' -v
```

**Terminal 2 - Publish:**
```powershell
cd "C:\Program Files\mosquitto"
.\mosquitto_pub.exe -h localhost -t 'test/hello' -m 'Hello MQTT!'
```

**Expected**: Message appears in Terminal 1

### 1.3 Test Smart Storage Topics

**Subscribe to all Smart Storage topics:**
```powershell
.\mosquitto_sub.exe -h localhost -t 'smart-storage/#' -v
```

**Publish test messages:**
```powershell
# Test button press
.\mosquitto_pub.exe -h localhost -t 'smart-storage/button' -m '{"node_addr":1,"event":"button_press","timestamp":1234567890}'

# Test LED command
.\mosquitto_pub.exe -h localhost -t 'smart-storage/command' -m '{"node_addr":1,"led_state":true}'

# Test gateway status
.\mosquitto_pub.exe -h localhost -t 'smart-storage/status' -m '{"type":"gateway","status":"online"}'
```

**Expected**: All messages appear in subscriber window

✅ **Phase 1 Complete** if all messages are received

---

## Phase 2: Backend Server Test

### 2.1 Start the Backend Server

```powershell
cd backend/server
npm start
```

**Expected output:**
```
Smart Storage Server running on port 3000
Environment: development
MQTT client connected
Subscribed to smart-storage/status
Subscribed to smart-storage/button
```

### 2.2 Test Health Endpoint

**Open new terminal:**
```powershell
curl http://localhost:3000/health
```

**Expected response:**
```json
{
  "status": "ok",
  "mqtt": true,
  "database": true,
  "timestamp": "2024-xx-xxTxx:xx:xx.xxxZ"
}
```

### 2.3 Test MQTT Integration

**With server running, publish a button press:**
```powershell
cd "C:\Program Files\mosquitto"
.\mosquitto_pub.exe -h localhost -t 'smart-storage/button' -m '{"node_addr":1,"event":"button_press","timestamp":1234567890}'
```

**Check server logs** - should show:
```
Received button press from node 1
Event recorded in database
```

### 2.4 Test API Endpoints

**Get all locations:**
```powershell
curl http://localhost:3000/api/locations
```

**Get all items:**
```powershell
curl http://localhost:3000/api/items
```

**Get recent events:**
```powershell
curl http://localhost:3000/api/events/recent
```

✅ **Phase 2 Complete** if server responds to all requests

---

## Phase 3: Gateway Firmware Test

### 3.1 Build the Firmware

**Prerequisites**: ESP-IDF installed (see `docs/firmware/esp-idf-setup.md`)

```powershell
# Open ESP-IDF PowerShell or run:
C:\Espressif\esp-idf\export.bat

# Navigate to gateway project
cd c:\Users\Aimz\source\repos\smart-storage-device\firmware\gateway-node

# Set target (first time only)
idf.py set-target esp32c6

# Build
idf.py build
```

**Expected**: Build completes successfully

### 3.2 Flash the Firmware

```powershell
# Connect ESP32-C6 via USB
# Check COM port
[System.IO.Ports.SerialPort]::getportnames()

# Flash (replace COM3 with your port)
idf.py -p COM3 flash monitor
```

### 3.3 Monitor Serial Output

**Expected boot sequence:**
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

### 3.4 Verify MQTT Connection

**In MQTT subscriber window, you should see:**
```
smart-storage/status {"type":"gateway","status":"online"}
```

✅ **Phase 3 Complete** if gateway connects to WiFi and MQTT

---

## Phase 4: End-to-End Integration Test

### 4.1 Setup Test Environment

**Terminal 1 - MQTT Monitor:**
```powershell
cd "C:\Program Files\mosquitto"
.\mosquitto_sub.exe -h localhost -t 'smart-storage/#' -v
```

**Terminal 2 - Backend Server:**
```powershell
cd backend/server
npm start
```

**Terminal 3 - Gateway Monitor:**
```powershell
# ESP-IDF PowerShell
idf.py -p COM3 monitor
```

### 4.2 Test Gateway → Server Flow

**Simulate button press from gateway:**

In MQTT publisher window:
```powershell
.\mosquitto_pub.exe -h localhost -t 'smart-storage/button' -m '{"node_addr":1,"event":"button_press","timestamp":1234567890}'
```

**Verify:**
- ✅ Message appears in MQTT monitor (Terminal 1)
- ✅ Backend server logs show event received
- ✅ Event stored in database

**Check database:**
```powershell
curl http://localhost:3000/api/events/recent
```

### 4.3 Test Server → Gateway Flow

**Send LED command from server:**

```powershell
curl -X POST http://localhost:3000/api/command/led `
  -H "Content-Type: application/json" `
  -d '{"node_addr":1,"led_state":true}'
```

**Verify:**
- ✅ Command appears in MQTT monitor
- ✅ Gateway receives command (check serial monitor)
- ✅ Gateway would send BLE mesh message (if endpoint provisioned)

### 4.4 Test Complete Flow with Real Hardware

**Prerequisites:**
- Gateway flashed and running
- Endpoint node flashed and running
- Both provisioned in BLE mesh network

**Test sequence:**

1. **Press button on endpoint node**
   - Endpoint wakes up
   - Sends BLE mesh message
   - Gateway receives message
   - Gateway publishes to MQTT
   - Backend server receives event
   - Event stored in database

2. **Send LED command from API**
   ```powershell
   curl -X POST http://localhost:3000/api/command/led `
     -H "Content-Type: application/json" `
     -d '{"node_addr":2,"led_state":true}'
   ```
   - Backend publishes to MQTT
   - Gateway receives command
   - Gateway sends BLE mesh message
   - Endpoint receives message
   - LED turns on

✅ **Phase 4 Complete** if both flows work end-to-end

---

## Troubleshooting

### Gateway Won't Connect to WiFi

**Check:**
- WiFi SSID and password in `firmware/gateway-node/main/main.c`
- WiFi signal strength
- Serial monitor for error messages

**Solution:**
```c
#define WIFI_SSID      "YourActualSSID"
#define WIFI_PASS      "YourActualPassword"
```

### Gateway Won't Connect to MQTT

**Check:**
- Mosquitto is running: `Get-Service mosquitto`
- Broker IP is correct in firmware
- Firewall allows port 1883
- Gateway has network connectivity

**Test from PC:**
```powershell
.\mosquitto_pub.exe -h 172.25.0.1 -t 'test' -m 'hello'
```

### Backend Server Won't Start

**Check:**
- Node.js installed: `node --version`
- Dependencies installed: `npm install`
- Port 3000 not in use
- MQTT broker running

**View logs:**
```powershell
cd backend/server
npm start
```

### No Messages Received

**Check:**
- Topic names match exactly (case-sensitive)
- QoS settings
- MQTT broker logs
- All components running

**Debug:**
```powershell
# Monitor all MQTT traffic
.\mosquitto_sub.exe -h localhost -t '#' -v
```

### BLE Mesh Issues

**Check:**
- Nodes are provisioned
- Network keys configured
- App keys bound to models
- Publication/subscription set up

**See:** `docs/provisioning/guide.md`

---

## Success Criteria

### ✅ System is Working When:

1. **MQTT Broker**
   - Service running
   - Can publish/subscribe
   - No connection errors

2. **Backend Server**
   - Starts without errors
   - Connects to MQTT
   - API endpoints respond
   - Events stored in database

3. **Gateway**
   - Connects to WiFi
   - Connects to MQTT
   - Publishes status message
   - BLE mesh initialized

4. **End-to-End**
   - Button press → Database
   - API command → Gateway
   - All logs show success
   - No error messages

---

## Performance Benchmarks

| Metric | Expected Value |
|--------|----------------|
| MQTT latency | < 50ms |
| WiFi connection time | < 5s |
| MQTT connection time | < 2s |
| Button press to database | < 200ms |
| API response time | < 100ms |
| BLE mesh message delivery | < 100ms |

---

## Next Steps After Testing

1. ✅ All tests passing
2. 🔲 Provision endpoint nodes
3. 🔲 Deploy to production locations
4. 🔲 Set up monitoring dashboard
5. 🔲 Configure inventory database
6. 🔲 Train users

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: Smart Storage Team

