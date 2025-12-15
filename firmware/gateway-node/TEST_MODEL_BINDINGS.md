# Test Model Bindings Feature

## Problem
Model Bindings และ Subscriptions ไม่แสดงใน Web UI แม้ว่า code ถูกต้องแล้ว

## Root Cause Analysis

### ✅ Code ที่ถูกต้องแล้ว:

1. **Event Handlers** (`main.c` lines 1421-1492):
   - `ESP_BLE_MESH_MODEL_OP_MODEL_APP_BIND` → บันทึก model binding
   - `ESP_BLE_MESH_MODEL_OP_MODEL_SUB_ADD` → บันทึก subscription
   - `ESP_BLE_MESH_MODEL_OP_MODEL_SUB_DELETE` → ลบ subscription

2. **Storage Functions** (`mesh_storage.c`):
   - `mesh_storage_save_model_binding()` → บันทึก binding ลง NVS
   - `mesh_storage_load_model_binding()` → โหลด binding จาก NVS
   - `mesh_storage_save_subscription()` → บันทึก subscription ลง NVS
   - `mesh_storage_load_subscription()` → โหลด subscription จาก NVS

3. **API Response** (`main.c` lines 720-791):
   - โหลดข้อมูล model bindings และ subscriptions
   - ส่งใน JSON response

4. **Web UI** (`main.c` lines 464-475, 530-548):
   - แสดง Generic OnOff Client และ Server details
   - อัพเดทเมื่อได้รับข้อมูลจาก API

### ❌ สาเหตุที่ไม่แสดง:

**ยังไม่ได้ bind models ใน nRF Mesh App!**

Events จะเกิดขึ้นก็ต่อเมื่อ:
1. Gateway ถูก provision แล้ว
2. nRF Mesh App ส่ง "Bind App Key" command มา
3. nRF Mesh App ส่ง "Add Subscription" command มา

## Testing Steps

### Step 1: Verify Gateway is Provisioned

```powershell
# Run check script
.\check-model-bindings.ps1
```

**Expected Output:**
```
Provisioned: ✅ YES
Node Address: 0x0001
Network Index: 0x0000
App Index: 0x0000
Network Key: 0123456789ABCDEF...
App Key: FEDCBA9876543210...
```

**If NOT provisioned:**
1. Open nRF Mesh App
2. Scan for "ESP BLE Mesh Gateway"
3. Provision the device

### Step 2: Bind Models to AppKey

**In nRF Mesh App:**

1. Select Gateway node (0x0001)
2. Tap **"Generic OnOff Client"**
3. Tap **"Bind App Key"**
4. Select **"App Key 1"**
5. Tap **"OK"**

**Expected Serial Monitor Output:**
```
I (xxx) GATEWAY_NODE: ========================================
I (xxx) GATEWAY_NODE: 🔗 Model Bound to AppKey!
I (xxx) GATEWAY_NODE:    Element Addr: 0x0001
I (xxx) GATEWAY_NODE:    Model ID: 0x1000
I (xxx) GATEWAY_NODE:    App Index: 0x0000
I (xxx) GATEWAY_NODE: ========================================
I (xxx) GATEWAY_NODE: 📝 Model Binding Saved: onoff_cli
I (xxx) GATEWAY_NODE:    Bound: true
I (xxx) GATEWAY_NODE:    App Index: 0x0000
```

6. Repeat for **"Generic OnOff Server"**

**Expected Serial Monitor Output:**
```
I (xxx) GATEWAY_NODE: ========================================
I (xxx) GATEWAY_NODE: 🔗 Model Bound to AppKey!
I (xxx) GATEWAY_NODE:    Element Addr: 0x0001
I (xxx) GATEWAY_NODE:    Model ID: 0x1001
I (xxx) GATEWAY_NODE:    App Index: 0x0000
I (xxx) GATEWAY_NODE: ========================================
I (xxx) GATEWAY_NODE: 📝 Model Binding Saved: onoff_srv
I (xxx) GATEWAY_NODE:    Bound: true
I (xxx) GATEWAY_NODE:    App Index: 0x0000
```

### Step 3: Add Subscription

**In nRF Mesh App:**

1. Select Gateway node (0x0001)
2. Tap **"Generic OnOff Server"**
3. Tap **"Subscribe"**
4. Select or create group address (e.g., **0xC000**)
5. Tap **"OK"**

**Expected Serial Monitor Output:**
```
I (xxx) GATEWAY_NODE: ========================================
I (xxx) GATEWAY_NODE: 📬 Subscription Added!
I (xxx) GATEWAY_NODE:    Element Addr: 0x0001
I (xxx) GATEWAY_NODE:    Model ID: 0x1001
I (xxx) GATEWAY_NODE:    Sub Addr: 0xC000
I (xxx) GATEWAY_NODE: ========================================
I (xxx) GATEWAY_NODE: 📝 Subscription Saved: onoff_srv
I (xxx) GATEWAY_NODE:    Count: 1
I (xxx) GATEWAY_NODE:    [0] 0xC000
```

### Step 4: Verify in Web UI

1. Open Web UI: `http://192.168.4.1`
2. Scroll down to Model Info section

**Expected Display:**
```
📋 Generic OnOff Client
Bound: ✅ YES
App Index: 0x0000
Publication: -
Subscriptions: -

📋 Generic OnOff Server
Bound: ✅ YES
App Index: 0x0000
Publication: -
Subscriptions: 0xC000
```

### Step 5: Verify Persistence

1. Restart Gateway (press reset button or power cycle)
2. Wait for Gateway to boot up
3. Open Web UI again

**Expected:** Model bindings and subscriptions should still be displayed (loaded from NVS)

## Troubleshooting

### Issue 1: Serial Monitor shows no logs

**Cause:** Firmware not built/flashed with new code

**Solution:**
```powershell
cd firmware/gateway-node
idf.py build
idf.py -p COM3 flash
```

### Issue 2: "Model Bound" log appears but Web UI shows "NO"

**Cause:** NVS save failed or Web UI not refreshing

**Solution:**
1. Check Serial Monitor for "📝 Model Binding Saved" log
2. If missing, check `mesh_storage_save_model_binding()` return value
3. Refresh Web UI (F5)

### Issue 3: After restart, bindings disappear

**Cause:** NVS not persisting data

**Solution:**
1. Check if `mesh_storage_load_model_binding()` is called in `status_handler()`
2. Verify NVS partition is not corrupted
3. Try erasing flash and re-provisioning:
   ```powershell
   idf.py -p COM3 erase-flash
   idf.py -p COM3 flash
   ```

## Debug Commands

### Check API Response

```powershell
# Windows PowerShell
Invoke-RestMethod -Uri "http://192.168.4.1/api/status" | ConvertTo-Json

# Or use check script
.\check-model-bindings.ps1
```

### Monitor Serial Output

```powershell
cd firmware/gateway-node
idf.py -p COM3 monitor
```

Look for these logs:
- `🔗 Model Bound to AppKey!`
- `📬 Subscription Added!`
- `📝 Model Binding Saved:`
- `📝 Subscription Saved:`

## Summary

**The feature is implemented correctly!**

The reason Model Bindings don't show is because:
1. Gateway needs to be provisioned first
2. Models need to be bound to AppKey in nRF Mesh App
3. Subscriptions need to be added in nRF Mesh App

**These are manual configuration steps that must be done in nRF Mesh App.**

Once configured, the data will be:
- ✅ Saved to NVS automatically
- ✅ Displayed in Web UI
- ✅ Persisted across reboots

