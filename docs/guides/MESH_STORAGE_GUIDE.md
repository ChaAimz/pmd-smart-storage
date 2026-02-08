# 💾 BLE Mesh Storage - คู่มือการใช้งาน

## 🎯 ภาพรวม

ระบบ **Mesh Storage** ช่วยให้ Gateway และ Endpoint **save และ load ข้อมูล BLE Mesh provisioning** ลง NVS (Non-Volatile Storage) โดยอัตโนมัติ

### ✅ ข้อดี

- **ไม่ต้อง provision ใหม่** หลัง reset
- **ไม่ต้อง bind AppKey ใหม่** หลัง reset  
- **ไม่ต้อง set publication/subscription ใหม่** หลัง reset
- **ทำงานอัตโนมัติ** ไม่ต้องเขียน code เพิ่ม

---

## 📊 ข้อมูลที่ Save อัตโนมัติ

| ข้อมูล | คำอธิบาย | Save เมื่อไหร่ |
|--------|----------|---------------|
| **Provisioned Flag** | สถานะว่า provision แล้วหรือยัง | หลัง provision complete |
| **Node Address** | ที่อยู่ของ node (เช่น 0x0001, 0x0002) | หลัง provision complete |
| **Network Index** | Index ของ Network Key | หลัง provision complete |
| **Application Index** | Index ของ Application Key | หลัง AppKey add |
| **Network Key** | กุญแจเข้า mesh network (16 bytes) | หลัง provision complete |
| **Device Key** | กุญแจเฉพาะของ device (16 bytes) | หลัง provision complete |
| **IV Index** | Index สำหรับ replay protection | หลัง provision complete |
| **Model Bindings** | AppKey ที่ bind กับแต่ละ model | หลัง model app bind |
| **Publication Settings** | ตั้งค่าการส่งข้อความ (address, ttl, period) | หลัง model pub set |

---

## 🏗️ สถาปัตยกรรม

### ไฟล์ที่เกี่ยวข้อง

```
firmware/
├── gateway-node/
│   └── main/
│       ├── mesh_storage.h      # Header file
│       ├── mesh_storage.c      # Implementation
│       ├── main.c              # ใช้ mesh_storage functions
│       └── CMakeLists.txt      # รวม mesh_storage.c
│
└── endpoint-node/
    └── main/
        ├── mesh_storage.h      # Header file (เหมือนกับ gateway)
        ├── mesh_storage.c      # Implementation (เหมือนกับ gateway)
        ├── main.c              # ใช้ mesh_storage functions
        └── CMakeLists.txt      # รวม mesh_storage.c
```

### NVS Namespace และ Keys

**Namespace:** `ble_mesh`

**Keys สำหรับ Provisioning Data:**
- `provisioned` - Flag (uint8)
- `node_addr` - Node address (uint16)
- `net_idx` - Network index (uint16)
- `app_idx` - Application index (uint16)
- `net_key` - Network key (blob, 16 bytes)
- `app_key` - Application key (blob, 16 bytes)
- `dev_key` - Device key (blob, 16 bytes)
- `iv_index` - IV index (uint32)

**Keys สำหรับ Model Bindings:**
- `{model_id}_bound` - Binding flag (uint8)
- `{model_id}_app_idx` - AppKey index (uint16)

**Keys สำหรับ Publication Settings:**
- `{model_id}_pub_addr` - Publish address (uint16)
- `{model_id}_pub_app` - AppKey index (uint16)
- `{model_id}_pub_ttl` - TTL (uint8)
- `{model_id}_pub_per` - Period (uint8)

**Model IDs:**
- `onoff_cli` - Generic OnOff Client
- `onoff_srv` - Generic OnOff Server

---

## 🔧 API Functions

### 1. mesh_storage_init()

```c
esp_err_t mesh_storage_init(void);
```

**คำอธิบาย:** Initialize NVS สำหรับ mesh storage

**เรียกใช้:** ใน `app_main()` ก่อน BLE Mesh init

**ตัวอย่าง:**
```c
esp_err_t err = mesh_storage_init();
ESP_ERROR_CHECK(err);
```

---

### 2. mesh_storage_save_prov_data()

```c
esp_err_t mesh_storage_save_prov_data(const mesh_prov_data_t *prov_data);
```

**คำอธิบาย:** Save ข้อมูล provisioning ลง NVS

**เรียกใช้:** ใน `provisioning_cb()` เมื่อ `ESP_BLE_MESH_NODE_PROV_COMPLETE_EVT`

**ตัวอย่าง:**
```c
mesh_prov_data_t prov_data = {
    .provisioned = true,
    .node_addr = param->node_prov_complete.addr,
    .net_idx = param->node_prov_complete.net_idx,
    .app_idx = 0,
    .iv_index = param->node_prov_complete.iv_index,
};
memcpy(prov_data.net_key, param->node_prov_complete.net_key, 16);
memcpy(prov_data.dev_key, param->node_prov_complete.dev_key, 16);

esp_err_t err = mesh_storage_save_prov_data(&prov_data);
```

---

### 3. mesh_storage_load_prov_data()

```c
esp_err_t mesh_storage_load_prov_data(mesh_prov_data_t *prov_data);
```

**คำอธิบาย:** Load ข้อมูล provisioning จาก NVS

**เรียกใช้:** ใน `app_main()` ก่อน BLE Mesh init

**Return:**
- `ESP_OK` - Load สำเร็จ
- `ESP_ERR_NOT_FOUND` - ยังไม่ได้ provision

**ตัวอย่าง:**
```c
mesh_prov_data_t prov_data;
esp_err_t err = mesh_storage_load_prov_data(&prov_data);
if (err == ESP_OK) {
    provisioned = true;
    node_addr = prov_data.node_addr;
    ESP_LOGI(TAG, "Loaded: addr=0x%04x, net_idx=0x%04x, app_idx=0x%04x",
             prov_data.node_addr, prov_data.net_idx, prov_data.app_idx);
}
```

---

### 4. mesh_storage_save_model_binding()

```c
esp_err_t mesh_storage_save_model_binding(const char *model_id, 
                                          const mesh_model_binding_t *binding);
```

**คำอธิบาย:** Save model binding ลง NVS

**เรียกใช้:** ใน `config_server_cb()` เมื่อ `ESP_BLE_MESH_MODEL_OP_MODEL_APP_BIND`

**ตัวอย่าง:**
```c
mesh_model_binding_t binding = {
    .bound = true,
    .app_idx = param->value.state_change.mod_app_bind.app_idx,
};
mesh_storage_save_model_binding("onoff_cli", &binding);
```

---

### 5. mesh_storage_load_model_binding()

```c
esp_err_t mesh_storage_load_model_binding(const char *model_id, 
                                          mesh_model_binding_t *binding);
```

**คำอธิบาย:** Load model binding จาก NVS

**เรียกใช้:** ใน `app_main()` หลัง load provisioning data

**ตัวอย่าง:**
```c
mesh_model_binding_t binding;
if (mesh_storage_load_model_binding("onoff_cli", &binding) == ESP_OK) {
    ESP_LOGI(TAG, "Generic OnOff Client bound to AppKey 0x%04x", binding.app_idx);
}
```

---

### 6. mesh_storage_save_pub_settings()

```c
esp_err_t mesh_storage_save_pub_settings(const char *model_id, 
                                         const mesh_pub_settings_t *pub_settings);
```

**คำอธิบาย:** Save publication settings ลง NVS

**เรียกใช้:** ใน `config_server_cb()` เมื่อ `ESP_BLE_MESH_MODEL_OP_MODEL_PUB_SET`

---

### 7. mesh_storage_clear()

```c
esp_err_t mesh_storage_clear(void);
```

**คำอธิบาย:** ลบข้อมูล mesh storage ทั้งหมด (unprovision)

**เรียกใช้:** เมื่อต้องการ reset device

---

### 8. mesh_storage_is_provisioned()

```c
bool mesh_storage_is_provisioned(void);
```

**คำอธิบาย:** ตรวจสอบว่า device ถูก provision แล้วหรือยัง

**Return:** `true` ถ้า provision แล้ว, `false` ถ้ายัง

---

## 🚀 การใช้งาน

### Step 1: Build และ Flash Firmware

```powershell
# Build และ flash ทั้ง Gateway และ Endpoint
.\rebuild-all.ps1

# หรือ build แยก
cd firmware/gateway-node
idf.py build
idf.py -p COM5 flash monitor

cd firmware/endpoint-node
idf.py build
idf.py -p COM6 flash monitor
```

---

### Step 2: Provision ด้วย nRF Mesh App

#### 2.1 Provision Gateway (ครั้งแรก)

1. เปิด nRF Mesh App
2. Scan หา "ESP Gateway"
3. Provision → Node address: **0x0001**
4. Bind App Key 1 กับ **Generic OnOff Client**
5. Set Publication: address=**C000**, app_idx=**1**

**ตรวจสอบ Serial Monitor:**
```
I (xxx) GATEWAY: Provisioning complete
I (xxx) GATEWAY: Node address: 0x0001
I (xxx) GATEWAY: Net Index: 0x0000
I (xxx) GATEWAY: IV Index: 0x00000000
I (xxx) MESH_STORAGE: Provisioning data saved (addr: 0x0001, net_idx: 0x0000, app_idx: 0x0000)
I (xxx) GATEWAY: ✓ Provisioning data saved to NVS
```

```
I (xxx) GATEWAY: Model bound: elem_addr=0x0001, model_id=0x1001, app_idx=0x0001
I (xxx) MESH_STORAGE: Model binding saved: onoff_cli (app_idx: 0x0001)
I (xxx) GATEWAY: ✓ Model binding saved: onoff_cli
```

#### 2.2 Provision Endpoint (ครั้งแรก)

1. Scan หา "ESP BLE Mesh Node"
2. Provision → Node address: **0x0002**
3. Bind App Key 1 กับ **Generic OnOff Server**
4. Set Publication: address=**C000**, app_idx=**1**
5. Add Subscription: address=**C000**

---

### Step 3: ทดสอบ Reset และ Load ข้อมูล

#### 3.1 Reset Gateway

```powershell
# กดปุ่ม Reset บน Gateway หรือ
idf.py -p COM5 monitor
# กด Ctrl+T, Ctrl+R (reset)
```

**ตรวจสอบ Serial Monitor:**
```
I (xxx) GATEWAY: Smart Storage Gateway Node starting...
I (xxx) MESH_STORAGE: Mesh storage initialized
I (xxx) GATEWAY: ========================================
I (xxx) GATEWAY: ✓ Loaded provisioning data from NVS
I (xxx) GATEWAY:   Node address: 0x0001
I (xxx) GATEWAY:   Net Index: 0x0000
I (xxx) GATEWAY:   App Index: 0x0001
I (xxx) GATEWAY:   IV Index: 0x00000000
I (xxx) GATEWAY: ========================================
I (xxx) MESH_STORAGE: Model binding loaded: onoff_cli (app_idx: 0x0001)
I (xxx) GATEWAY: ✓ Generic OnOff Client bound to AppKey 0x0001
I (xxx) MESH_STORAGE: Publication settings loaded: onoff_cli (addr: 0xC000, app_idx: 0x0001)
I (xxx) GATEWAY: ✓ Generic OnOff Client publication: addr=0xC000, app_idx=0x0001
```

✅ **ไม่ต้อง provision ใหม่!**

#### 3.2 Reset Endpoint

```powershell
# กดปุ่ม Reset บน Endpoint
```

**ตรวจสอบ Serial Monitor:**
```
I (xxx) ENDPOINT_NODE: Smart Storage Endpoint Node starting...
I (xxx) MESH_STORAGE: Mesh storage initialized
I (xxx) ENDPOINT_NODE: ========================================
I (xxx) ENDPOINT_NODE: ✓ Loaded provisioning data from NVS
I (xxx) ENDPOINT_NODE:   Node address: 0x0002
I (xxx) ENDPOINT_NODE:   Net Index: 0x0000
I (xxx) ENDPOINT_NODE:   App Index: 0x0001
I (xxx) ENDPOINT_NODE:   IV Index: 0x00000000
I (xxx) ENDPOINT_NODE: ========================================
I (xxx) MESH_STORAGE: Model binding loaded: onoff_srv (app_idx: 0x0001)
I (xxx) ENDPOINT_NODE: ✓ Generic OnOff Server bound to AppKey 0x0001
```

✅ **ไม่ต้อง provision ใหม่!**

---

### Step 4: ทดสอบส่งคำสั่ง LED

```powershell
# ทดสอบส่งคำสั่ง LED หลัง reset
.\test-led.ps1 -NodeAddress 2 -State on
```

**ผลลัพธ์:**
- ✅ Gateway ส่งคำสั่งได้ทันที (ไม่มี Error "Model not bound to AppKey")
- ✅ Endpoint รับคำสั่งและติดไฟ LED สีเขียว

---

## 🧪 การทดสอบ

### Test 1: Provision ครั้งแรก

```
☐ 1. Flash firmware ใหม่ (erase flash)
☐ 2. Provision Gateway ด้วย nRF Mesh App
☐ 3. Bind AppKey กับ Generic OnOff Client
☐ 4. ตรวจสอบ log: "✓ Provisioning data saved to NVS"
☐ 5. ตรวจสอบ log: "✓ Model binding saved: onoff_cli"
```

### Test 2: Reset และ Load ข้อมูล

```
☐ 1. Reset Gateway (กดปุ่ม Reset)
☐ 2. ตรวจสอบ log: "✓ Loaded provisioning data from NVS"
☐ 3. ตรวจสอบ log: "✓ Generic OnOff Client bound to AppKey 0x0001"
☐ 4. ส่งคำสั่ง LED: .\test-led.ps1 -NodeAddress 2 -State on
☐ 5. ตรวจสอบว่าไม่มี Error "Model not bound to AppKey"
```

### Test 3: Power Cycle

```
☐ 1. ถอดสาย USB ของ Gateway
☐ 2. รอ 5 วินาที
☐ 3. เสียบสาย USB กลับ
☐ 4. ตรวจสอบ log: "✓ Loaded provisioning data from NVS"
☐ 5. ส่งคำสั่ง LED ทันที (ไม่ต้อง provision ใหม่)
```

---

## 🐛 Troubleshooting

### ปัญหา: ไม่เห็น log "Loaded provisioning data from NVS"

**สาเหตุ:**
- ยังไม่ได้ provision
- NVS ถูก erase

**วิธีแก้:**
1. Provision ด้วย nRF Mesh App
2. ตรวจสอบว่าเห็น log "✓ Provisioning data saved to NVS"
3. Reset แล้วควรเห็น "✓ Loaded provisioning data from NVS"

---

### ปัญหา: Load ข้อมูลได้แต่ยังเห็น Error "Model not bound to AppKey"

**สาเหตุ:**
- Model binding ไม่ถูก save
- AppKey index ไม่ตรงกัน

**วิธีแก้:**
1. ตรวจสอบ log ว่ามี "✓ Model binding saved: onoff_cli" หรือไม่
2. ถ้าไม่มี ให้ bind AppKey ใหม่ด้วย nRF Mesh App
3. ตรวจสอบว่า AppKey index ตรงกัน (ควรเป็น 0x0001)

---

### ปัญหา: ต้องการ Reset ทุกอย่างเริ่มใหม่

**วิธีแก้:**

```powershell
# Erase flash ทั้งหมด
cd firmware/gateway-node
idf.py -p COM5 erase-flash
idf.py -p COM5 flash monitor

cd firmware/endpoint-node
idf.py -p COM6 erase-flash
idf.py -p COM6 flash monitor
```

หรือใช้สคริปต์:
```powershell
.\rebuild-all.ps1 -EraseFlash
```

---

## 📚 สรุป

### ก่อนใช้ Mesh Storage:
- ❌ Reset แล้วต้อง provision ใหม่ทุกครั้ง
- ❌ ต้อง bind AppKey ใหม่ทุกครั้ง
- ❌ Error "Model not bound to AppKey" หลัง reset

### หลังใช้ Mesh Storage:
- ✅ Reset แล้วโหลดข้อมูลจาก NVS อัตโนมัติ
- ✅ ไม่ต้อง provision ใหม่
- ✅ ไม่ต้อง bind AppKey ใหม่
- ✅ ส่งคำสั่ง LED ได้ทันทีหลัง reset

---

## 🔗 เอกสารที่เกี่ยวข้อง

- [FIX_APPKEY_ERROR.md](FIX_APPKEY_ERROR.md) - แก้ปัญหา AppKey binding
- [BLE_MESH_STORAGE.md](BLE_MESH_STORAGE.md) - อธิบาย BLE Mesh storage
- [TEST_LED_CONTROL.md](TEST_LED_CONTROL.md) - ทดสอบ LED control
- [firmware/endpoint-node/PROVISIONING.md](firmware/endpoint-node/PROVISIONING.md) - คู่มือ provision endpoint

