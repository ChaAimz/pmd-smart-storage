# Factory Reset Testing Guide

This guide explains how to test both factory reset methods.

---

## 🧪 **Test 1: MQTT Factory Reset**

### **Prerequisites:**

- ✅ Gateway is running and connected to MQTT
- ✅ Endpoint is provisioned and reachable
- ✅ Mosquitto MQTT client installed
- ✅ Serial monitor open for Endpoint

### **Test Steps:**

#### **1. Check Current Status**

```powershell
# Open Endpoint serial monitor
idf.py -p COM6 monitor
```

You should see the Endpoint is provisioned and running normally.

#### **2. Send Factory Reset Command**

```powershell
# Using the test script
.\test-factory-reset-mqtt.ps1 -NodeAddress 2

# Or manually
mosquitto_pub -h localhost -t "smart-storage/command" `
  -m '{"node_addr": 2, "command": "factory_reset"}'
```

#### **3. Expected Output**

**Gateway Serial Monitor:**
```
I (12345) GATEWAY_NODE: MQTT_EVENT_DATA
I (12345) GATEWAY_NODE: TOPIC=smart-storage/command
I (12345) GATEWAY_NODE: DATA={"node_addr":2,"command":"factory_reset"}
I (12345) GATEWAY_NODE: Sending factory reset command to node 0x0002
I (12345) GATEWAY_NODE: ✓ Factory reset command sent to node 0x0002
```

**Endpoint Serial Monitor:**
```
I (23456) ENDPOINT_NODE: Generic server recv set msg: onoff=2
W (23456) ENDPOINT_NODE: 🔴 Factory reset command received via MQTT!
W (23456) ENDPOINT_NODE: Clearing provisioning data and restarting...
I (23456) MESH_STORAGE: Clearing all mesh storage...
I (23456) MESH_STORAGE: ✓ Mesh storage cleared
I (23956) ENDPOINT_NODE: 
I (23956) ENDPOINT_NODE: ========================================
I (23956) ENDPOINT_NODE: 🔄 RESTARTING...
I (23956) ENDPOINT_NODE: ========================================

[Device restarts]

I (1234) ENDPOINT_NODE: Device not provisioned yet
I (1234) ENDPOINT_NODE: Waiting for provisioning...
```

#### **4. Verify Factory Reset**

After restart, the Endpoint should:
- ✅ Show "Device not provisioned yet"
- ✅ Not have any provisioning data
- ✅ Be ready for re-provisioning

### **✅ Test Pass Criteria:**

- [ ] MQTT message sent successfully
- [ ] Gateway received and forwarded command
- [ ] Endpoint received factory reset command
- [ ] Endpoint cleared NVS
- [ ] Endpoint restarted
- [ ] Endpoint shows "Device not provisioned yet"

---

## 🔘 **Test 2: GPIO5 Button Factory Reset**

### **Prerequisites:**

- ✅ Endpoint is running (provisioned or not)
- ✅ Serial monitor open for Endpoint
- ✅ Physical access to Endpoint device
- ✅ Button connected to GPIO5 and GND

### **Test Steps:**

#### **1. Open Serial Monitor**

```powershell
idf.py -p COM6 monitor
```

#### **2. Press and Hold Factory Reset Button**

1. Connect a button between GPIO5 and GND
2. Press and **hold** the button
3. Watch the serial monitor

#### **3. Expected Output**

**At 0 seconds (button pressed):**
```
I (5000) ENDPOINT_NODE: Button pressed - hold for 10 seconds to factory reset
```

**At 3 seconds:**
```
W (8000) ENDPOINT_NODE: ⚠️  Factory reset in 7 seconds...
```

**At 7 seconds:**
```
W (12000) ENDPOINT_NODE: 🔴 FACTORY RESET IN 3 SECONDS! Release button to cancel!
```

**At 10 seconds:**
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

[Device restarts]

I (1234) ENDPOINT_NODE: Device not provisioned yet
I (1234) ENDPOINT_NODE: Waiting for provisioning...
```

#### **4. Verify Factory Reset**

Same as Test 1 - device should be unprovisioned.

### **✅ Test Pass Criteria:**

- [ ] Button press detected
- [ ] Warning shown at 3 seconds
- [ ] Critical warning shown at 7 seconds
- [ ] Factory reset triggered at 10 seconds
- [ ] NVS cleared successfully
- [ ] Device restarted
- [ ] Device shows "Device not provisioned yet"

---

## 🧪 **Test 3: Button Cancellation**

### **Test Steps:**

1. Press and hold BOOT button
2. Wait for first warning (3 seconds)
3. **Release button** before 10 seconds
4. Check serial monitor

### **Expected Output:**

```
I (5000) ENDPOINT_NODE: Button pressed - hold for 10 seconds to factory reset
W (8000) ENDPOINT_NODE: ⚠️  Factory reset in 7 seconds...
I (9000) ENDPOINT_NODE: Factory reset cancelled (held for 4000 ms)
```

### **✅ Test Pass Criteria:**

- [ ] Button press detected
- [ ] Warning shown
- [ ] Factory reset cancelled when button released
- [ ] Device continues running normally
- [ ] Provisioning data NOT cleared

---

## 🧪 **Test 4: Short Button Press**

### **Test Steps:**

1. Quickly press and release GPIO5 button (< 1 second)
2. Check serial monitor

### **Expected Output:**

```
I (5000) ENDPOINT_NODE: Button pressed!
I (5000) ENDPOINT_NODE: Location indicator turned off by button
```

### **✅ Test Pass Criteria:**

- [ ] Button press detected
- [ ] Button message sent via BLE Mesh
- [ ] No factory reset triggered
- [ ] Device continues running normally

---

## 🛠️ **Troubleshooting**

### **MQTT Test Fails:**

**Problem:** Gateway doesn't receive MQTT message

**Solutions:**
1. Check MQTT broker is running: `mosquitto -v`
2. Check Gateway is connected to MQTT
3. Check MQTT topic is correct
4. Check JSON format is valid

**Problem:** Endpoint doesn't receive factory reset

**Solutions:**
1. Check Endpoint is provisioned
2. Check Endpoint is reachable (try LED control first)
3. Check Gateway and Endpoint are on same mesh network
4. Check AppKey binding is correct

### **Button Test Fails:**

**Problem:** Button press not detected

**Solutions:**
1. Check button is connected to GPIO5 and GND
2. Check button wiring is correct
3. Check button is not damaged
4. Check pull-up resistor is enabled (should be automatic)

**Problem:** Factory reset triggers immediately

**Solutions:**
1. Check GPIO is not conflicting with other functions
2. Check GPIO is configured as INPUT
3. Check pull-up is enabled
4. Check button is not stuck

---

## 📊 **Test Results Template**

```
Date: ___________
Tester: ___________

Test 1: MQTT Factory Reset
[ ] PASS  [ ] FAIL
Notes: _________________________________

Test 2: GPIO5 Button Factory Reset
[ ] PASS  [ ] FAIL
Notes: _________________________________

Test 3: Button Cancellation
[ ] PASS  [ ] FAIL
Notes: _________________________________

Test 4: Short Button Press
[ ] PASS  [ ] FAIL
Notes: _________________________________

Overall Result: [ ] PASS  [ ] FAIL
```

---

## 🎯 **Success Criteria**

All tests must pass for factory reset feature to be considered working:

- ✅ MQTT factory reset works
- ✅ GPIO5 button factory reset works
- ✅ Button cancellation works
- ✅ Short button press works
- ✅ No false triggers
- ✅ NVS cleared correctly
- ✅ Device restarts properly
- ✅ Device ready for re-provisioning

---

## 📚 **Related Documentation**

- [FACTORY_RESET_METHODS.md](FACTORY_RESET_METHODS.md) - Complete factory reset guide
- [FACTORY_RESET_GUIDE.md](FACTORY_RESET_GUIDE.md) - User guide (Thai)
- [test-factory-reset-mqtt.ps1](test-factory-reset-mqtt.ps1) - MQTT test script

---

## 🚀 **Quick Test Commands**

```powershell
# Test MQTT factory reset
.\test-factory-reset-mqtt.ps1 -NodeAddress 2

# Monitor Endpoint
idf.py -p COM6 monitor

# Re-provision after test
# Use nRF Mesh app to provision the device again
```

Good luck with testing! 🎉

