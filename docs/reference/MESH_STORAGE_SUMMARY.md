# 💾 Mesh Storage - สรุปสั้น

## ✅ สิ่งที่ทำเสร็จแล้ว

### 1. สร้างระบบ Save/Load ข้อมูล BLE Mesh

**ไฟล์ที่สร้าง:**
- `firmware/gateway-node/main/mesh_storage.h` - Header file
- `firmware/gateway-node/main/mesh_storage.c` - Implementation
- `firmware/endpoint-node/main/mesh_storage.h` - Header file (เหมือนกับ gateway)
- `firmware/endpoint-node/main/mesh_storage.c` - Implementation (เหมือนกับ gateway)

**ไฟล์ที่แก้ไข:**
- `firmware/gateway-node/main/main.c` - ใช้ mesh_storage functions
- `firmware/gateway-node/main/CMakeLists.txt` - รวม mesh_storage.c
- `firmware/endpoint-node/main/main.c` - ใช้ mesh_storage functions
- `firmware/endpoint-node/main/CMakeLists.txt` - รวม mesh_storage.c

---

## 📊 ข้อมูลที่ Save อัตโนมัติ

| ข้อมูล | Save เมื่อไหร่ |
|--------|---------------|
| ✅ Provisioned Flag | หลัง provision complete |
| ✅ Node Address | หลัง provision complete |
| ✅ Network Index | หลัง provision complete |
| ✅ Application Index | หลัง AppKey add |
| ✅ Network Key (16 bytes) | หลัง provision complete |
| ✅ Device Key (16 bytes) | หลัง provision complete |
| ✅ IV Index | หลัง provision complete |
| ✅ Model Bindings | หลัง model app bind |
| ✅ Publication Settings | หลัง model pub set |

---

## 🚀 วิธีใช้งาน (Quick Start)

### 1. Build และ Flash

```powershell
# Build และ flash ทั้งหมด
.\rebuild-all.ps1

# หรือ build แยก
cd firmware/gateway-node
idf.py build
idf.py -p COM5 flash monitor
```

### 2. Provision ด้วย nRF Mesh App (ครั้งแรก)

**Gateway:**
1. Scan → "ESP Gateway"
2. Provision → Address: 0x0001
3. Bind App Key 1 → Generic OnOff Client ⭐
4. Set Publication → C000

**Endpoint:**
1. Scan → "ESP BLE Mesh Node"
2. Provision → Address: 0x0002
3. Bind App Key 1 → Generic OnOff Server ⭐
4. Set Publication → C000
5. Add Subscription → C000

### 3. ตรวจสอบ Serial Monitor

**ควรเห็น:**
```
I (xxx) GATEWAY: ✓ Provisioning data saved to NVS
I (xxx) GATEWAY: ✓ Model binding saved: onoff_cli
I (xxx) GATEWAY: ✓ Publication settings saved: onoff_cli
```

### 4. Reset และทดสอบ

```powershell
# กดปุ่ม Reset บน Gateway

# ควรเห็น:
I (xxx) GATEWAY: ✓ Loaded provisioning data from NVS
I (xxx) GATEWAY:   Node address: 0x0001
I (xxx) GATEWAY: ✓ Generic OnOff Client bound to AppKey 0x0001

# ทดสอบส่งคำสั่ง LED ทันที (ไม่ต้อง provision ใหม่)
.\test-led.ps1 -NodeAddress 2 -State on
```

✅ **ไฟ LED ควรติดสีเขียว!**

---

## 🧪 ทดสอบอัตโนมัติ

```powershell
# รันสคริปต์ทดสอบ
.\test-mesh-storage.ps1
```

สคริปต์จะทดสอบ:
1. ✅ ตรวจสอบว่า provision แล้ว
2. ✅ ตรวจสอบ model bindings
3. ✅ ทดสอบ LED control ก่อน reset
4. ✅ Reset Gateway และตรวจสอบ load ข้อมูล
5. ✅ ทดสอบ LED control หลัง reset
6. ✅ Reset Endpoint และตรวจสอบ load ข้อมูล
7. ✅ ทดสอบ LED control ครั้งสุดท้าย

---

## 📝 API Functions (สำคัญ)

### Save Functions (เรียกอัตโนมัติใน callbacks)

```c
// Save provisioning data
mesh_storage_save_prov_data(&prov_data);

// Save model binding
mesh_storage_save_model_binding("onoff_cli", &binding);

// Save publication settings
mesh_storage_save_pub_settings("onoff_cli", &pub_settings);
```

### Load Functions (เรียกใน app_main)

```c
// Load provisioning data
mesh_prov_data_t prov_data;
if (mesh_storage_load_prov_data(&prov_data) == ESP_OK) {
    // ใช้ข้อมูลที่ load มา
    node_addr = prov_data.node_addr;
}

// Load model binding
mesh_model_binding_t binding;
mesh_storage_load_model_binding("onoff_cli", &binding);

// Load publication settings
mesh_pub_settings_t pub_settings;
mesh_storage_load_pub_settings("onoff_cli", &pub_settings);
```

---

## 🎯 ผลลัพธ์

### ก่อนใช้ Mesh Storage:
- ❌ Reset → ต้อง provision ใหม่
- ❌ Reset → ต้อง bind AppKey ใหม่
- ❌ Error: "Model not bound to AppKey 0x0000"

### หลังใช้ Mesh Storage:
- ✅ Reset → โหลดข้อมูลจาก NVS อัตโนมัติ
- ✅ Reset → ไม่ต้อง provision ใหม่
- ✅ Reset → ไม่ต้อง bind AppKey ใหม่
- ✅ ส่งคำสั่ง LED ได้ทันทีหลัง reset

---

## 🔧 Troubleshooting

### ปัญหา: ไม่เห็น "Loaded provisioning data from NVS"

**แก้ไข:**
1. ตรวจสอบว่า provision แล้วหรือยัง
2. ตรวจสอบว่าเห็น "✓ Provisioning data saved to NVS" หรือไม่
3. ถ้าไม่เห็น ให้ provision ใหม่

### ปัญหา: ยังเห็น Error "Model not bound to AppKey"

**แก้ไข:**
1. ตรวจสอบว่าเห็น "✓ Model binding saved: onoff_cli" หรือไม่
2. ถ้าไม่เห็น ให้ bind AppKey ใหม่ด้วย nRF Mesh App
3. Reset แล้วควรเห็น "✓ Generic OnOff Client bound to AppKey 0x0001"

### ปัญหา: ต้องการ Reset ทุกอย่าง

```powershell
# Erase flash และ flash ใหม่
.\rebuild-all.ps1 -EraseFlash
```

---

## 📚 เอกสารเพิ่มเติม

- **[MESH_STORAGE_GUIDE.md](MESH_STORAGE_GUIDE.md)** - คู่มือการใช้งานแบบละเอียด
- **[FIX_APPKEY_ERROR.md](FIX_APPKEY_ERROR.md)** - แก้ปัญหา AppKey binding
- **[BLE_MESH_STORAGE.md](BLE_MESH_STORAGE.md)** - อธิบาย BLE Mesh storage
- **[TEST_LED_CONTROL.md](TEST_LED_CONTROL.md)** - ทดสอบ LED control

---

## ✨ สรุป

ระบบ Mesh Storage ช่วยให้:
1. ✅ **Save** ข้อมูล provisioning ลง NVS อัตโนมัติ
2. ✅ **Load** ข้อมูลกลับมาใช้หลัง reset
3. ✅ **ไม่ต้อง provision ใหม่** ทุกครั้งที่ reset
4. ✅ **ทำงานอัตโนมัติ** ไม่ต้องเขียน code เพิ่ม

**ทดสอบได้เลย:**
```powershell
.\test-mesh-storage.ps1
```

🎉 **เสร็จสมบูรณ์!**

