# Factory Reset Methods

This guide explains the two methods available to factory reset Endpoint nodes and clear provisioning data.

---

## 📋 **Overview**

There are **2 ways** to factory reset an Endpoint node:

1. **MQTT Command** (Remote) - Send command via MQTT → Gateway → Endpoint
2. **GPIO0 Button** (Physical) - Hold Boot button for 10 seconds

Both methods will:
- ✅ Clear all provisioning data from NVS
- ✅ Clear network keys, app keys, and bindings
- ✅ Restart the device
- ✅ Device will be ready for re-provisioning

---

## 🌐 **Method 1: MQTT Command (Remote Factory Reset)**

### **How It Works:**

```
Frontend/Backend → MQTT → Gateway → BLE Mesh → Endpoint
                                                    ↓
                                            Clear NVS & Restart
```

### **MQTT Message Format:**

```json
{
  "node_addr": 2,
  "command": "factory_reset"
}
```

### **Usage Examples:**

#### **Using mosquitto_pub:**

```bash
# Factory reset node with address 2
mosquitto_pub -h localhost -t "smart-storage/command" \
  -m '{"node_addr": 2, "command": "factory_reset"}'

# Factory reset node with address 3
mosquitto_pub -h localhost -t "smart-storage/command" \
  -m '{"node_addr": 3, "command": "factory_reset"}'
```

#### **Using Node.js Backend:**

```javascript
// In your backend API
const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost:1883');

// Factory reset endpoint
app.post('/api/nodes/factory-reset', (req, res) => {
  const { node_addr } = req.body;
  
  client.publish('smart-storage/command', JSON.stringify({
    node_addr,
    command: 'factory_reset'
  }));
  
  res.json({ success: true, message: `Factory reset sent to node ${node_addr}` });
});
```

#### **Using curl:**

```bash
# If you have a backend API endpoint
curl -X POST http://localhost:3000/api/nodes/factory-reset \
  -H "Content-Type: application/json" \
  -d '{"node_addr": 2}'
```

### **Expected Output (Endpoint Serial Monitor):**

```
I (12345) ENDPOINT_NODE: Generic server recv set msg: onoff=2
W (12345) ENDPOINT_NODE: 🔴 Factory reset command received via MQTT!
W (12345) ENDPOINT_NODE: Clearing provisioning data and restarting...
I (12345) MESH_STORAGE: Clearing all mesh storage...
I (12345) MESH_STORAGE: ✓ Mesh storage cleared
I (12845) ENDPOINT_NODE: 
I (12845) ENDPOINT_NODE: ========================================
I (12845) ENDPOINT_NODE: 🔄 RESTARTING...
I (12845) ENDPOINT_NODE: ========================================
```

### **Advantages:**
- ✅ Remote reset - no physical access needed
- ✅ Can reset multiple nodes from one location
- ✅ Can be integrated into web interface
- ✅ Useful for deployed devices

### **Disadvantages:**
- ❌ Requires network connectivity
- ❌ Requires Gateway to be online
- ❌ Requires device to be provisioned (to receive message)

---

## 🔘 **Method 2: GPIO5 Button (Physical Factory Reset)**

### **How It Works:**

1. Press and **hold** the **factory reset button** connected to **GPIO5**
2. Wait for warnings at 3s and 7s
3. Continue holding until 10 seconds
4. Device will clear NVS and restart

### **Button Behavior:**

| Hold Duration | Action |
|---------------|--------|
| < 1 second | Send button press message (normal function) |
| 1-10 seconds | Factory reset cancelled (release button) |
| 3 seconds | ⚠️ Warning: "Factory reset in 7 seconds..." |
| 7 seconds | 🔴 Critical warning: "FACTORY RESET IN 3 SECONDS!" |
| 10 seconds | 🔴 **FACTORY RESET TRIGGERED** |

### **Step-by-Step:**

1. **Connect a button to GPIO5**
   - Connect one side of button to GPIO5
   - Connect other side to GND
   - GPIO5 has internal pull-up enabled

2. **Press and hold** the button

3. **Watch the serial monitor:**
   ```
   I (5000) ENDPOINT_NODE: Button pressed - hold for 10 seconds to factory reset
   W (8000) ENDPOINT_NODE: ⚠️  Factory reset in 7 seconds...
   W (12000) ENDPOINT_NODE: 🔴 FACTORY RESET IN 3 SECONDS! Release button to cancel!
   ```

4. **Continue holding** until you see:
   ```
   W (15000) ENDPOINT_NODE: 
   W (15000) ENDPOINT_NODE: ========================================
   W (15000) ENDPOINT_NODE: 🔴 FACTORY RESET TRIGGERED!
   W (15000) ENDPOINT_NODE: ========================================
   W (15000) ENDPOINT_NODE: Clearing all provisioning data...
   I (15000) MESH_STORAGE: ✓ Mesh storage cleared
   W (15000) ENDPOINT_NODE: Restarting device in 2 seconds...
   W (17000) ENDPOINT_NODE: ========================================
   W (17000) ENDPOINT_NODE: 🔄 RESTARTING...
   W (17000) ENDPOINT_NODE: ========================================
   ```

5. **Device will restart** and be ready for re-provisioning

### **To Cancel Factory Reset:**

Simply **release the button** before 10 seconds:

```
I (5000) ENDPOINT_NODE: Button pressed - hold for 10 seconds to factory reset
W (8000) ENDPOINT_NODE: ⚠️  Factory reset in 7 seconds...
I (9000) ENDPOINT_NODE: Factory reset cancelled (held for 4000 ms)
```

### **Advantages:**
- ✅ Works without network
- ✅ Works even if device is not provisioned
- ✅ No computer or tools needed
- ✅ Physical confirmation (must hold button)

### **Disadvantages:**
- ❌ Requires physical access to device
- ❌ Must hold button for 10 seconds
- ❌ Cannot reset multiple devices at once

---

## 🔧 **Technical Details**

### **MQTT Command Implementation:**

**Gateway Side (`firmware/gateway-node/main/main.c`):**
- Receives MQTT message with `command: "factory_reset"`
- Sends BLE Mesh Generic OnOff Set message with special values:
  - `onoff = 2` (special value, normal is 0 or 1)
  - `tid = 0xFF` (special transaction ID)

**Endpoint Side (`firmware/endpoint-node/main/main.c`):**
- Receives Generic OnOff Set message
- Checks if `onoff == 2` and `tid == 0xFF`
- If match, calls `mesh_storage_clear()` and `esp_restart()`

### **GPIO5 Button Implementation:**

**Endpoint Side (`firmware/endpoint-node/main/main.c`):**
- Polls GPIO5 every 100ms in `app_task()`
- Tracks button hold duration using `esp_timer_get_time()`
- Shows warnings at 3s and 7s
- Triggers factory reset at 10s
- Supports short press (< 1s) for button message

### **NVS Storage Cleared:**

Both methods call `mesh_storage_clear()` which erases:
- Provisioning data (node address, keys, IV index)
- Model bindings (OnOff Client/Server)
- Publication settings
- All mesh-related NVS entries

---

## 📊 **Comparison**

| Feature | MQTT Command | GPIO5 Button |
|---------|--------------|--------------|
| **Physical Access** | ❌ Not required | ✅ Required |
| **Network Required** | ✅ Yes | ❌ No |
| **Works Unprovisioned** | ❌ No | ✅ Yes |
| **Remote Reset** | ✅ Yes | ❌ No |
| **Batch Reset** | ✅ Yes | ❌ No |
| **User Confirmation** | ⚠️ Software only | ✅ Physical (10s hold) |
| **Best For** | Production/Deployed | Development/Local |

---

## 🚀 **Recommended Usage**

### **Development/Testing:**
Use **GPIO5 Button** - Quick and easy, no network setup needed

### **Production/Deployed Devices:**
Use **MQTT Command** - Remote management, can reset multiple devices

### **Emergency/Network Issues:**
Use **GPIO5 Button** - Always works, even without network

---

## 📝 **After Factory Reset**

After factory reset, the device will:

1. **Restart** and show:
   ```
   I (1234) ENDPOINT_NODE: Device not provisioned yet
   I (1234) ENDPOINT_NODE: Waiting for provisioning...
   ```

2. **Be ready for provisioning** via nRF Mesh app

3. **Advertise** as an unprovisioned device

4. **Require re-provisioning** to join the mesh network again

---

## 🛠️ **Troubleshooting**

### **MQTT Command Not Working:**

1. Check Gateway is online and connected to MQTT
2. Check Endpoint is provisioned and reachable
3. Check MQTT topic is correct: `smart-storage/command`
4. Check JSON format is correct
5. Check node address is correct

### **GPIO5 Button Not Working:**

1. Check serial monitor is open
2. Verify button is connected to GPIO5 and GND
3. Hold button for full 10 seconds
4. Check button is not damaged
5. Check button wiring is correct
6. Try pressing button after device has fully booted

### **Device Not Restarting:**

1. Check serial monitor for error messages
2. Try manual restart (press RESET button)
3. Try erase-flash and reflash firmware

---

## 📚 **Related Documentation**

- [QUICK_RESET_GUIDE.md](QUICK_RESET_GUIDE.md) - Quick reference guide
- [RESET_PROVISIONING.md](RESET_PROVISIONING.md) - Detailed reset guide
- [MESH_STORAGE_GUIDE.md](MESH_STORAGE_GUIDE.md) - NVS storage details

---

## ✅ **Summary**

You now have **2 powerful methods** to factory reset Endpoint nodes:

1. **MQTT Command** - `{"node_addr": 2, "command": "factory_reset"}`
2. **GPIO5 Button** - Hold button connected to GPIO5 for 10 seconds

Choose the method that best fits your use case! 🎉

