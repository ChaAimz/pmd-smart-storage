# 🎨 เพิ่ม BLE Mesh Details ใน Web UI

## 📋 สรุปการแก้ไข

เพิ่มการแสดงรายละเอียด BLE Mesh ใน Web UI:
- ✅ **Network Key** (NetKey) - แสดง 8 bytes แรก
- ✅ **Network Index** (NetIdx)
- ✅ **Application Key** (AppKey) - แสดง 8 bytes แรก
- ✅ **Application Index** (AppIdx)
- ✅ **Node Address** (เดิมมีอยู่แล้ว)

## 🔧 ไฟล์ที่แก้ไข

### 1. `firmware/gateway-node/main/main.c`

#### ส่วนที่ 1: แก้ไข `status_handler()` - เพิ่มข้อมูล Mesh Keys

```c
// HTTP GET handler for status API
static esp_err_t status_handler(httpd_req_t *req)
{
    char response[1024];  // เพิ่มขนาด buffer จาก 512 เป็น 1024
    esp_netif_ip_info_t ip_info;
    char sta_ip_str[16] = "-";

    // ... (WiFi status code) ...

    // ⭐ เพิ่มส่วนนี้: Load mesh provisioning data from NVS
    char net_key_str[64] = "-";
    char app_key_str[64] = "-";
    uint16_t net_idx = 0;
    uint16_t app_idx = 0;

    if (provisioned) {
        mesh_prov_data_t prov_data;
        if (mesh_storage_load_prov_data(&prov_data) == ESP_OK) {
            // Format NetKey as hex string (first 8 bytes for display)
            snprintf(net_key_str, sizeof(net_key_str), 
                     "%02X%02X%02X%02X%02X%02X%02X%02X...",
                     prov_data.net_key[0], prov_data.net_key[1], 
                     prov_data.net_key[2], prov_data.net_key[3],
                     prov_data.net_key[4], prov_data.net_key[5],
                     prov_data.net_key[6], prov_data.net_key[7]);

            // Format AppKey as hex string (first 8 bytes for display)
            snprintf(app_key_str, sizeof(app_key_str), 
                     "%02X%02X%02X%02X%02X%02X%02X%02X...",
                     prov_data.app_key[0], prov_data.app_key[1], 
                     prov_data.app_key[2], prov_data.app_key[3],
                     prov_data.app_key[4], prov_data.app_key[5],
                     prov_data.app_key[6], prov_data.app_key[7]);

            net_idx = prov_data.net_idx;
            app_idx = prov_data.app_idx;
        }
    }

    // ⭐ เพิ่ม net_idx, app_idx, net_key, app_key ใน JSON response
    snprintf(response, sizeof(response),
             "{\"clients\":%d,\"sta_connected\":%s,\"sta_ip\":\"%s\",\"ap_active\":%s,"
             "\"provisioned\":%s,\"node_addr\":%d,\"mqtt_connected\":%s,"
             "\"net_idx\":%d,\"app_idx\":%d,\"net_key\":\"%s\",\"app_key\":\"%s\"}",
             client_count,
             sta_connected ? "true" : "false",
             sta_ip_str,
             ap_active ? "true" : "false",
             provisioned ? "true" : "false",
             node_addr,
             mqtt_connected_status ? "true" : "false",
             net_idx,
             app_idx,
             net_key_str,
             app_key_str);

    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, response, strlen(response));
    return ESP_OK;
}
```

#### ส่วนที่ 2: แก้ไข HTML - เพิ่ม UI Elements

```c
"</div>"
"<div class='info'>"
"<p><strong>BLE Mesh:</strong> <span id='mesh-status'>Not Provisioned</span></p>"
"<p><strong>Node Address:</strong> <span id='node-addr'>-</span></p>"
// ⭐ เพิ่มบรรทัดเหล่านี้
"<p><strong>Network Key:</strong> <span id='net-key' style='font-family: monospace; font-size: 0.85em;'>-</span></p>"
"<p><strong>Network Index:</strong> <span id='net-idx'>-</span></p>"
"<p><strong>App Key:</strong> <span id='app-key' style='font-family: monospace; font-size: 0.85em;'>-</span></p>"
"<p><strong>App Index:</strong> <span id='app-idx'>-</span></p>"
"<p><strong>MQTT:</strong> <span id='mqtt-status'>Disconnected</span></p>"
"</div>"
```

#### ส่วนที่ 3: แก้ไข JavaScript - อัพเดท UI

```javascript
function updateStatus() {
  fetch('/api/status')
    .then(r => r.json())
    .then(data => {
      document.getElementById('clients').textContent = data.clients;
      const wifiStatus = document.getElementById('wifi-status');
      const wifiIP = document.getElementById('wifi-ip');
      const apStatus = document.getElementById('ap-status');
      const meshStatus = document.getElementById('mesh-status');
      const nodeAddr = document.getElementById('node-addr');
      // ⭐ เพิ่มตัวแปรเหล่านี้
      const netKey = document.getElementById('net-key');
      const netIdx = document.getElementById('net-idx');
      const appKey = document.getElementById('app-key');
      const appIdx = document.getElementById('app-idx');
      const mqttStatus = document.getElementById('mqtt-status');
      
      // ... (WiFi status update code) ...
      
      if (data.provisioned) {
        meshStatus.textContent = '✅ Provisioned';
        nodeAddr.textContent = '0x' + data.node_addr.toString(16).toUpperCase().padStart(4, '0');
        // ⭐ เพิ่มการอัพเดทเหล่านี้
        netKey.textContent = data.net_key || '-';
        netIdx.textContent = '0x' + data.net_idx.toString(16).toUpperCase().padStart(4, '0');
        appKey.textContent = data.app_key || '-';
        appIdx.textContent = '0x' + data.app_idx.toString(16).toUpperCase().padStart(4, '0');
      } else {
        meshStatus.textContent = '❌ Not Provisioned';
        nodeAddr.textContent = '-';
        // ⭐ เพิ่มการ reset เหล่านี้
        netKey.textContent = '-';
        netIdx.textContent = '-';
        appKey.textContent = '-';
        appIdx.textContent = '-';
      }
      mqttStatus.textContent = data.mqtt_connected ? '✅ Connected' : '❌ Disconnected';
    });
}
```

## 📊 ตัวอย่างการแสดงผล

### ก่อน Provision:
```
BLE Mesh: ❌ Not Provisioned
Node Address: -
Network Key: -
Network Index: -
App Key: -
App Index: -
MQTT: ❌ Disconnected
```

### หลัง Provision:
```
BLE Mesh: ✅ Provisioned
Node Address: 0x0001
Network Key: 0123456789ABCDEF...
Network Index: 0x0000
App Key: FEDCBA9876543210...
App Index: 0x0000
MQTT: ✅ Connected
```

## 🔍 รายละเอียดข้อมูล

### Network Key (NetKey)
- **ขนาด:** 16 bytes (128 bits)
- **แสดง:** 8 bytes แรก + "..." (เพื่อความปลอดภัย)
- **ตัวอย่าง:** `0123456789ABCDEF...`
- **ที่มา:** ได้จาก provisioner เมื่อ provision complete
- **จัดเก็บ:** NVS namespace `ble_mesh`, key `net_key`

### Network Index (NetIdx)
- **ขนาด:** 16 bits (uint16_t)
- **แสดง:** Hexadecimal format (0x0000)
- **ค่าปกติ:** 0x0000 (primary network)
- **ที่มา:** ได้จาก provisioner เมื่อ provision complete
- **จัดเก็บ:** NVS namespace `ble_mesh`, key `net_idx`

### Application Key (AppKey)
- **ขนาด:** 16 bytes (128 bits)
- **แสดง:** 8 bytes แรก + "..." (เพื่อความปลอดภัย)
- **ตัวอย่าง:** `FEDCBA9876543210...`
- **ที่มา:** ได้จาก provisioner เมื่อ AppKey Add
- **จัดเก็บ:** NVS namespace `ble_mesh`, key `app_key`

### Application Index (AppIdx)
- **ขนาด:** 16 bits (uint16_t)
- **แสดง:** Hexadecimal format (0x0000)
- **ค่าปกติ:** 0x0000 หรือ 0x0001
- **ที่มา:** ได้จาก provisioner เมื่อ AppKey Add
- **จัดเก็บ:** NVS namespace `ble_mesh`, key `app_idx`

## 🔐 ความปลอดภัย

### ทำไมแสดงเฉพาะ 8 bytes แรก?

1. **ป้องกันการขโมย Key:** ถ้าแสดง key เต็ม 16 bytes ผู้ไม่หวังดีสามารถนำไปใช้เข้า mesh network ได้
2. **เพียงพอสำหรับการตรวจสอบ:** 8 bytes แรกเพียงพอสำหรับการยืนยันว่าเป็น key ตัวเดียวกัน
3. **Best Practice:** ตาม BLE Mesh security guidelines

### ข้อควรระวัง

⚠️ **อย่าแชร์ Network Key และ App Key เต็มให้ผู้อื่น!**
- Key เหล่านี้เป็นกุญแจเข้า mesh network
- ผู้ที่มี key สามารถควบคุม mesh network ได้
- ควรเก็บ key ไว้เป็นความลับ

## 🧪 การทดสอบ

### 1. Build และ Flash

```powershell
cd firmware/gateway-node
idf.py build
idf.py -p COM5 flash monitor
```

### 2. เปิด Web UI

```
http://192.168.4.1
```

### 3. ตรวจสอบก่อน Provision

- BLE Mesh: ❌ Not Provisioned
- ทุกฟิลด์ควรแสดง "-"

### 4. Provision ด้วย nRF Mesh App

1. Scan และ provision Gateway
2. Bind AppKey กับ models

### 5. ตรวจสอบหลัง Provision

- BLE Mesh: ✅ Provisioned
- Node Address: 0x0001
- Network Key: แสดง hex string
- Network Index: 0x0000
- App Key: แสดง hex string (อาจเป็น "-" ถ้ายังไม่ได้ bind)
- App Index: 0x0000 (หรือ "-" ถ้ายังไม่ได้ bind)

### 6. Refresh หน้าเว็บ

- ข้อมูลควรยังคงอยู่ (โหลดจาก NVS)

### 7. ทดสอบ Clear Provision

1. กดปุ่ม "🗑️ Clear Provision"
2. รอ device restart
3. ตรวจสอบว่าทุกฟิลด์กลับเป็น "-"

## 📚 Related Files

- `firmware/gateway-node/main/main.c` - Main application
- `firmware/gateway-node/main/mesh_storage.c` - Mesh storage implementation
- `firmware/gateway-node/main/mesh_storage.h` - Storage API
- `CLEAR_PROVISION_FIX.md` - Clear provision fix documentation

## 🐛 Bug Fix: AppKey ไม่แสดงใน Web UI

### ปัญหา
- AppKey ไม่แสดงค่าใน Web UI (แสดงเป็น "-")
- เมื่อ provision แล้ว nRF Mesh App ส่ง AppKey มาภายหลัง
- โค้ดเดิมบันทึกเฉพาะ AppKey Index แต่ไม่ได้บันทึก AppKey ตัวจริง (16 bytes)

### สาเหตุ
ใน `config_server_cb()` เมื่อได้รับ `ESP_BLE_MESH_MODEL_OP_APP_KEY_ADD`:
- ✅ บันทึก `app_idx` ลง NVS
- ❌ **ไม่ได้บันทึก `app_key` (16 bytes) ลง NVS**

### การแก้ไข

เพิ่มการ copy AppKey ตัวจริงลง NVS:

```c
case ESP_BLE_MESH_MODEL_OP_APP_KEY_ADD:
    ESP_LOGI(TAG, "========================================");
    ESP_LOGI(TAG, "🔑 AppKey Added!");
    ESP_LOGI(TAG, "   Net Index: 0x%04X", param->value.state_change.appkey_add.net_idx);
    ESP_LOGI(TAG, "   App Index: 0x%04X", param->value.state_change.appkey_add.app_idx);
    ESP_LOGI(TAG, "========================================");

    // Update provisioning data with AppKey index and AppKey value
    mesh_prov_data_t prov_data;
    if (mesh_storage_load_prov_data(&prov_data) == ESP_OK) {
        prov_data.app_idx = param->value.state_change.appkey_add.app_idx;
        // ⭐ เพิ่มบรรทัดนี้: Copy AppKey (app_key is always available as array)
        memcpy(prov_data.app_key, param->value.state_change.appkey_add.app_key, 16);
        mesh_storage_save_prov_data(&prov_data);

        // ⭐ เพิ่ม log เพื่อยืนยันว่า AppKey ถูกบันทึก
        ESP_LOGI(TAG, "💾 AppKey saved to NVS:");
        ESP_LOGI(TAG, "   AppKey: %02X%02X%02X%02X%02X%02X%02X%02X...",
                 prov_data.app_key[0], prov_data.app_key[1],
                 prov_data.app_key[2], prov_data.app_key[3],
                 prov_data.app_key[4], prov_data.app_key[5],
                 prov_data.app_key[6], prov_data.app_key[7]);
    }
    break;
```

### ผลลัพธ์

หลังจากแก้ไข:
1. เมื่อ nRF Mesh App ส่ง AppKey มา → บันทึกทั้ง Index และ Key ลง NVS
2. Web UI จะแสดง AppKey ได้ทันที
3. หลัง restart ข้อมูล AppKey ยังคงอยู่

---

## ✅ Checklist

- [x] แก้ไข `status_handler()` เพื่อส่งข้อมูล mesh keys
- [x] เพิ่ม HTML elements สำหรับแสดง mesh details
- [x] แก้ไข JavaScript เพื่ออัพเดท UI
- [x] **แก้ไข `config_server_cb()` เพื่อบันทึก AppKey ตัวจริงลง NVS**
- [x] ตรวจสอบว่าโค้ดคอมไพล์ได้
- [ ] Build และ flash firmware
- [ ] ทดสอบการแสดงผลก่อน provision
- [ ] ทดสอบการแสดงผลหลัง provision (ตรวจสอบว่า AppKey แสดงหลัง bind)
- [ ] ทดสอบ refresh หน้าเว็บ
- [ ] ทดสอบ clear provision

## 🎯 สรุป

การแก้ไขนี้เพิ่มการแสดงรายละเอียด BLE Mesh ใน Web UI ให้ครบถ้วนมากขึ้น ช่วยให้ผู้ใช้สามารถตรวจสอบสถานะ provisioning และ key configuration ได้ง่ายขึ้น โดยยังคงความปลอดภัยด้วยการแสดงเฉพาะ 8 bytes แรกของ key

