# 🔧 แก้ไขปัญหา: nRF ไม่เจอ Gateway หลังกด Clear Provision

## 🐛 ปัญหา

หลังจากกดปุ่ม **Clear Provision** ใน Web UI แล้ว restart device:
- ❌ nRF Mesh App ไม่สามารถ scan เจอ Gateway Node ได้
- ❌ Gateway ไม่ออก unprovisioned beacon
- ❌ Gateway ยังคงอยู่ในสถานะ provisioned

## 🔍 สาเหตุ

Gateway Node ใช้ `CONFIG_BLE_MESH_SETTINGS=y` ซึ่งทำให้ ESP-IDF BLE Mesh stack มีการ:
1. **Auto-save** provisioning data ลง **internal NVS partition** ของ ESP-IDF
2. **Auto-restore** provisioning data เมื่อ restart

เมื่อกด Clear Provision:
- ✅ ลบ **custom NVS** (`mesh_storage` namespace) ได้
- ❌ **ไม่ได้ลบ ESP-IDF internal BLE Mesh NVS**
- ❌ หลัง restart BLE Mesh stack โหลดข้อมูลจาก internal NVS กลับมา
- ❌ Gateway ยังคงอยู่ในสถานะ provisioned

## ✅ วิธีแก้ไข

เพิ่มการเรียก `esp_ble_mesh_node_local_reset()` ก่อน restart เพื่อ:
1. De-initialize BLE Mesh stack
2. ลบ ESP-IDF internal BLE Mesh NVS
3. Reset BLE Mesh state กลับไปเป็น unprovisioned

### การแก้ไขใน `main.c`

#### 1. แก้ไข `clear_provision_handler()` (Web UI Clear Provision)

```c
// HTTP POST handler for clear provision (BLE Mesh only)
static esp_err_t clear_provision_handler(httpd_req_t *req)
{
    ESP_LOGW(TAG, "🔴 Clear BLE Mesh provision requested via Web UI");

    // Clear custom mesh storage
    esp_err_t err = mesh_storage_clear();
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "✓ Custom mesh storage cleared");
    } else {
        ESP_LOGE(TAG, "✗ Failed to clear custom mesh storage: %s", esp_err_to_name(err));
    }

    // ⭐ เพิ่มส่วนนี้: Reset BLE Mesh stack
    ESP_LOGW(TAG, "Resetting BLE Mesh stack...");
    err = esp_ble_mesh_node_local_reset();
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "✓ BLE Mesh stack reset successfully");
    } else {
        ESP_LOGE(TAG, "✗ Failed to reset BLE Mesh stack: %s", esp_err_to_name(err));
    }

    const char *response = "{\"status\":\"ok\",\"message\":\"BLE Mesh provisioning cleared\"}";
    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, response, strlen(response));

    // Restart after 2 seconds
    ESP_LOGW(TAG, "Restarting device in 2 seconds...");
    vTaskDelay(pdMS_TO_TICKS(2000));
    esp_restart();

    return ESP_OK;
}
```

#### 2. แก้ไข `factory_reset_task()` (Hardware Button Factory Reset)

```c
// Factory reset at 10 seconds
if (hold_duration >= FACTORY_RESET_HOLD_TIME_MS) {
    ESP_LOGW(TAG, "");
    ESP_LOGW(TAG, "========================================");
    ESP_LOGW(TAG, "🔴 FACTORY RESET TRIGGERED!");
    ESP_LOGW(TAG, "========================================");
    ESP_LOGW(TAG, "Clearing all provisioning data...");

    // Clear custom mesh storage
    esp_err_t err = mesh_storage_clear();
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "✓ Custom mesh storage cleared");
    } else {
        ESP_LOGE(TAG, "✗ Failed to clear custom mesh storage: %s", esp_err_to_name(err));
    }

    // ⭐ เพิ่มส่วนนี้: Reset BLE Mesh stack
    ESP_LOGW(TAG, "Resetting BLE Mesh stack...");
    err = esp_ble_mesh_node_local_reset();
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "✓ BLE Mesh stack reset successfully");
    } else {
        ESP_LOGE(TAG, "✗ Failed to reset BLE Mesh stack: %s", esp_err_to_name(err));
    }

    // Clear WiFi credentials
    err = wifi_clear_credentials();
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "✓ WiFi credentials cleared");
    } else {
        ESP_LOGE(TAG, "✗ Failed to clear WiFi credentials: %s", esp_err_to_name(err));
    }

    ESP_LOGW(TAG, "Restarting device in 2 seconds...");
    vTaskDelay(pdMS_TO_TICKS(2000));

    ESP_LOGW(TAG, "========================================");
    ESP_LOGW(TAG, "🔄 RESTARTING...");
    ESP_LOGW(TAG, "========================================");

    esp_restart();
}
```

## 📋 ขั้นตอนการทดสอบ

### 1. Build และ Flash Firmware ใหม่

```powershell
cd firmware/gateway-node
idf.py build
idf.py -p COM5 flash monitor
```

### 2. Provision Gateway ด้วย nRF Mesh App

1. เปิด nRF Mesh App
2. Scan หา "ESP BLE Mesh Gateway"
3. Provision Gateway
4. Bind AppKey กับ models
5. ตรวจสอบว่า Gateway ทำงานปกติ

### 3. ทดสอบ Clear Provision

#### วิธีที่ 1: ใช้ Web UI

1. เปิด browser ไปที่ `http://192.168.4.1` (หรือ IP ของ Gateway)
2. กดปุ่ม **🗑️ Clear Provision**
3. Confirm การลบ
4. รอ device restart (2 วินาที)

#### วิธีที่ 2: ใช้ Hardware Button

1. กดปุ่ม GPIO5 ค้างไว้ 10 วินาที
2. รอ device restart

### 4. ตรวจสอบผลลัพธ์

**Serial Monitor ควรแสดง:**

```
I (xxx) GATEWAY_NODE: 🔴 Clear BLE Mesh provision requested via Web UI
I (xxx) GATEWAY_NODE: ✓ Custom mesh storage cleared
W (xxx) GATEWAY_NODE: Resetting BLE Mesh stack...
I (xxx) GATEWAY_NODE: ✓ BLE Mesh stack reset successfully
W (xxx) GATEWAY_NODE: Restarting device in 2 seconds...
```

**หลัง restart:**

```
I (xxx) GATEWAY_NODE: Step 11: Initializing BLE Mesh...
I (xxx) GATEWAY_NODE: ✅ BLE Mesh Gateway initialized
I (xxx) GATEWAY_NODE: ℹ️  Device not provisioned yet
```

**nRF Mesh App:**
- ✅ สามารถ scan เจอ "ESP BLE Mesh Gateway" ได้
- ✅ สามารถ provision ใหม่ได้

## 🔬 Technical Details

### `esp_ble_mesh_node_local_reset()` Function

**ที่มา:** `esp_ble_mesh_provisioning_api.h`

**หน้าที่:**
1. De-initialize BLE Mesh stack
2. ลบ ESP-IDF internal BLE Mesh NVS data
3. Reset BLE Mesh state เป็น unprovisioned
4. เปิด unprovisioned beacon advertising

**Return:**
- `ESP_OK` - Reset สำเร็จ
- `ESP_FAIL` - Reset ล้มเหลว

### NVS Namespaces ที่เกี่ยวข้อง

1. **`mesh_storage`** (Custom namespace)
   - เก็บ provisioning data, model bindings, publication settings
   - ลบด้วย `mesh_storage_clear()`

2. **ESP-IDF BLE Mesh Internal** (ชื่อ namespace ถูกจัดการโดย ESP-IDF)
   - เก็บ BLE Mesh stack state, keys, addresses
   - ลบด้วย `esp_ble_mesh_node_local_reset()`

## ⚠️ หมายเหตุ

1. **ต้องเรียก `esp_ble_mesh_node_local_reset()` ก่อน `esp_restart()`**
   - ถ้า restart ก่อน BLE Mesh stack จะโหลดข้อมูลจาก NVS กลับมา

2. **Clear Provision ≠ Factory Reset**
   - Clear Provision: ลบเฉพาะ BLE Mesh data (เก็บ WiFi ไว้)
   - Factory Reset: ลบทั้ง BLE Mesh + WiFi credentials

3. **WiFi credentials ไม่ถูกลบ**
   - หลัง Clear Provision Gateway ยังคงเชื่อมต่อ WiFi ได้
   - ไม่ต้อง config WiFi ใหม่

## 📚 Related Files

- `firmware/gateway-node/main/main.c` - Main application
- `firmware/gateway-node/main/mesh_storage.c` - Custom mesh storage
- `firmware/gateway-node/main/mesh_storage.h` - Storage API
- `RESET_PROVISIONING.md` - Reset provisioning guide

## ✅ Checklist

- [x] เพิ่ม `esp_ble_mesh_node_local_reset()` ใน `clear_provision_handler()`
- [x] เพิ่ม `esp_ble_mesh_node_local_reset()` ใน `factory_reset_task()`
- [x] ตรวจสอบว่ามี header `esp_ble_mesh_provisioning_api.h`
- [x] Build และ flash firmware ใหม่
- [ ] ทดสอบ Clear Provision ผ่าน Web UI
- [ ] ทดสอบ Factory Reset ผ่าน Hardware Button
- [ ] ตรวจสอบว่า nRF Mesh App scan เจอ Gateway หลัง clear
- [ ] ตรวจสอบว่า provision ใหม่ได้

## 🎯 สรุป

การแก้ไขนี้แก้ปัญหาที่ Gateway Node ไม่สามารถกลับไปสู่สถานะ unprovisioned ได้หลังจากกด Clear Provision โดยการเพิ่มการเรียก `esp_ble_mesh_node_local_reset()` เพื่อ reset BLE Mesh stack และลบ internal NVS data ของ ESP-IDF ก่อนที่จะ restart device

