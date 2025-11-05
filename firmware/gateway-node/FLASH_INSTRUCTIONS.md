# Gateway Firmware - Flash Instructions

## 🔧 Current Issue & Solution

The build is failing due to Bluetooth linking errors. This is because the configuration needs to be regenerated.

## ✅ Steps to Fix and Flash

### Step 1: Clean Build Directory

In **ESP-IDF PowerShell**:

```powershell
cd C:\Users\Aimz\source\repos\smart-storage-device\firmware\gateway-node

# Clean everything
idf.py fullclean
```

### Step 2: Set Target

```powershell
idf.py set-target esp32c6
```

This will regenerate the configuration with the correct Bluetooth settings.

### Step 3: Build

```powershell
idf.py build
```

This should now compile successfully (2-5 minutes).

### Step 4: Flash to COM5

```powershell
idf.py -p COM5 flash monitor
```

---

## 📋 What Was Fixed

### 1. Component Dependencies (CMakeLists.txt)
Added missing components:
- `nvs_flash` - Non-volatile storage
- `bt` - Bluetooth stack
- `esp_event` - Event handling

### 2. BLE Mesh API Updates (main.c)
- Fixed client type declaration
- Fixed UUID initialization
- Removed deprecated API calls

### 3. Bluetooth Configuration (sdkconfig.defaults)
Added:
- `CONFIG_BT_CONTROLLER_ENABLED=y`
- `CONFIG_BT_BLUEDROID_PINNED_TO_CORE_0=y`
- `CONFIG_BT_BTU_TASK_STACK_SIZE=4096`

---

## 🎯 Complete Command Sequence

```powershell
# In ESP-IDF PowerShell
cd C:\Users\Aimz\source\repos\smart-storage-device\firmware\gateway-node

# Clean and rebuild
idf.py fullclean
idf.py set-target esp32c6
idf.py build

# Flash to COM5
idf.py -p COM5 flash monitor
```

---

## 📊 Expected Output After Flash

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

---

## 🧪 Testing After Flash

### Monitor MQTT Messages

In a separate PowerShell window:

```powershell
cd "C:\Program Files\mosquitto"
.\mosquitto_sub.exe -h localhost -t 'smart-storage/#' -v
```

You should see:
```
smart-storage/status {"type":"gateway","status":"online"}
```

---

## 🔧 Troubleshooting

### Build Still Fails

Try:
```powershell
# Delete build directory manually
Remove-Item -Recurse -Force build

# Rebuild
idf.py set-target esp32c6
idf.py build
```

### Flash Fails

Check:
1. ESP32-C6 is connected to COM5
2. No other program is using COM5
3. Try holding BOOT button while connecting

### Gateway Won't Connect to WiFi

Check in serial monitor:
- WiFi SSID: `AuraLink`
- WiFi Password: `Abc1234567890`
- Make sure WiFi is 2.4GHz (ESP32-C6 doesn't support 5GHz)

### Gateway Won't Connect to MQTT

Check:
1. Mosquitto is running: `Get-Service mosquitto`
2. Gateway has correct IP: `172.25.0.1`
3. Firewall allows port 1883

---

## 📝 Configuration Summary

- **WiFi SSID**: AuraLink
- **WiFi Password**: Abc1234567890
- **MQTT Broker**: mqtt://172.25.0.1:1883
- **COM Port**: COM5
- **Target**: ESP32-C6

---

**Ready to flash!** Run the commands above in ESP-IDF PowerShell. 🚀

