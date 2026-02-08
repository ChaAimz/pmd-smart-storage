# 💾 BLE Mesh Storage และการ Save ค่า Provisioning

## 🔍 ปัญหา: ค่า Provisioning หายหลัง Reset

เมื่อ reset ESP32 แล้วพบว่า:
- ❌ ต้อง provision ใหม่ทุกครั้ง
- ❌ ต้อง bind AppKey ใหม่ทุกครั้ง
- ❌ ต้อง set publication/subscription ใหม่ทุกครั้ง

**สาเหตุ:** BLE Mesh ไม่ได้ save ค่าลง NVS (Non-Volatile Storage)

---

## ✅ วิธีแก้ไข

### 1. Enable BLE Mesh Settings

ใน `sdkconfig.defaults` ต้องมี config เหล่านี้:

```ini
# BLE Mesh Storage (CRITICAL for preserving provisioning data)
CONFIG_BLE_MESH_SETTINGS=y
CONFIG_BLE_MESH_STORE_TIMEOUT=2
CONFIG_BLE_MESH_SEQ_STORE_RATE=128
CONFIG_BLE_MESH_RPL_STORE_TIMEOUT=5

# NVS Configuration for BLE Mesh persistence
CONFIG_NVS_ENCRYPTION=n
```

**อธิบาย:**
- `CONFIG_BLE_MESH_SETTINGS=y` - เปิดใช้งาน BLE Mesh persistent storage
- `CONFIG_BLE_MESH_STORE_TIMEOUT=2` - บันทึกข้อมูลทุก 2 วินาทีหลังมีการเปลี่ยนแปลง
- `CONFIG_BLE_MESH_SEQ_STORE_RATE=128` - บันทึก sequence number ทุก 128 messages
- `CONFIG_BLE_MESH_RPL_STORE_TIMEOUT=5` - บันทึก replay protection list ทุก 5 วินาที

### 2. ตรวจสอบ Partition Table

ใน `partitions.csv` ต้องมี NVS partition:

```csv
# Name,   Type, SubType, Offset,  Size, Flags
nvs,      data, nvs,     ,        0x40000,  # 256KB for NVS
phy_init, data, phy,     ,        0x1000,
factory,  app,  factory, ,        0x2C0000,
```

**ขนาด NVS ที่แนะนำ:**
- ขั้นต่ำ: 0x6000 (24KB)
- แนะนำ: 0x40000 (256KB) ← ใช้อันนี้
- สูงสุด: 0x100000 (1MB)

---

## 📊 ข้อมูลที่ BLE Mesh จะ Save ลง NVS

### ข้อมูลที่ Save อัตโนมัติ (เมื่อ CONFIG_BLE_MESH_SETTINGS=y):

| ข้อมูล | คำอธิบาย | Save เมื่อไหร่ |
|--------|----------|---------------|
| **Network Key (NetKey)** | กุญแจเข้า mesh network | หลัง provision |
| **Application Key (AppKey)** | กุญแจสำหรับ applications | หลัง bind AppKey |
| **Device Key (DevKey)** | กุญแจเฉพาะของ device | หลัง provision |
| **Unicast Address** | ที่อยู่ของ node (เช่น 0x0001) | หลัง provision |
| **IV Index** | Index สำหรับ replay protection | อัพเดทตาม network |
| **Sequence Number** | ลำดับข้อความ | ทุก 128 messages |
| **Model Bindings** | AppKey ที่ bind กับ models | หลัง bind |
| **Publication Settings** | ตั้งค่าการส่งข้อความ | หลัง set publication |
| **Subscription Addresses** | ที่อยู่ที่ subscribe | หลัง add subscription |
| **Model States** | สถานะของ models | เมื่อมีการเปลี่ยนแปลง |

### ข้อมูลที่ต้อง Save เอง (ใน code):

| ข้อมูล | ต้อง Save เอง? | ตัวอย่าง |
|--------|---------------|----------|
| Node Address | ✅ ใช่ | `nvs_set_u16("node_addr", 0x0001)` |
| Provisioned Flag | ✅ ใช่ | `nvs_set_u8("provisioned", 1)` |
| Custom Settings | ✅ ใช่ | ค่าต่างๆ ที่เราเพิ่มเอง |

---

## 🔧 การ Build และ Flash ใหม่

หลังจากแก้ไข `sdkconfig.defaults` แล้ว:

### Gateway:
```powershell
cd firmware/gateway-node

# Clean build (สำคัญ!)
idf.py fullclean

# Build ใหม่
idf.py build

# Flash
idf.py -p COM3 flash monitor
```

### Endpoint:
```powershell
cd firmware/endpoint-node

# Clean build (สำคัญ!)
idf.py fullclean

# Build ใหม่
idf.py build

# Flash
idf.py -p COM6 flash monitor
```

---

## 🧪 ทดสอบว่า Save ค่าได้แล้ว

### Test 1: Provision และ Reset

1. **Provision Gateway และ Endpoint ด้วย nRF Mesh App**
   - Provision Gateway (0x0001)
   - Bind AppKey กับ Generic OnOff Client
   - Provision Endpoint (0x0002)
   - Bind AppKey กับ Generic OnOff Server

2. **ตรวจสอบ Serial Monitor:**
   ```
   I (xxx) GATEWAY: Provisioning complete
   I (xxx) GATEWAY: Node address: 0x0001
   I (xxx) GATEWAY: Provisioning data saved to NVS
   ```

3. **Reset Gateway (กดปุ่ม Reset)**

4. **ตรวจสอบ Serial Monitor หลัง Reset:**
   ```
   I (xxx) GATEWAY: Loaded provisioning data from NVS
   I (xxx) GATEWAY: Provisioning complete
   I (xxx) GATEWAY: Node address: 0x0001
   ```

   ✅ **ถ้าเห็นข้อความนี้ = Save สำเร็จ!**

### Test 2: ทดสอบส่งคำสั่ง LED หลัง Reset

```powershell
# Reset Gateway และ Endpoint

# ส่งคำสั่ง LED
.\test-led.ps1 -NodeAddress 2 -State on
```

**ผลลัพธ์ที่ถูกต้อง:**
- ✅ ไม่ต้อง provision ใหม่
- ✅ ไม่ต้อง bind AppKey ใหม่
- ✅ ส่งคำสั่ง LED ได้ทันที
- ✅ ไม่เห็น Error "Model not bound to AppKey"

---

## 📝 ข้อมูลที่ Save ใน NVS Namespace

BLE Mesh ใช้ NVS namespaces เหล่านี้:

| Namespace | คำอธิบาย | ข้อมูลที่เก็บ |
|-----------|----------|--------------|
| `mesh_core` | ข้อมูลหลักของ mesh | NetKey, DevKey, Address, IV Index |
| `mesh_model` | ข้อมูล models | AppKey bindings, Pub/Sub settings |
| `mesh_cfg` | ข้อมูล configuration | Model states, settings |
| `ble_mesh` | ข้อมูลเพิ่มเติม | Custom data (ที่เราเพิ่มเอง) |

---

## 🔍 Debug: ตรวจสอบข้อมูลใน NVS

### เพิ่ม Debug Code ใน main.c:

```c
#include "nvs_flash.h"
#include "nvs.h"

void print_nvs_stats(void)
{
    nvs_stats_t nvs_stats;
    esp_err_t err = nvs_get_stats(NULL, &nvs_stats);
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "NVS Stats:");
        ESP_LOGI(TAG, "  Used entries: %d", nvs_stats.used_entries);
        ESP_LOGI(TAG, "  Free entries: %d", nvs_stats.free_entries);
        ESP_LOGI(TAG, "  Total entries: %d", nvs_stats.total_entries);
        ESP_LOGI(TAG, "  Namespace count: %d", nvs_stats.namespace_count);
    }
}

// เรียกใน app_main():
print_nvs_stats();
```

**ผลลัพธ์ที่ควรเห็น:**
```
I (xxx) GATEWAY: NVS Stats:
I (xxx) GATEWAY:   Used entries: 25
I (xxx) GATEWAY:   Free entries: 487
I (xxx) GATEWAY:   Total entries: 512
I (xxx) GATEWAY:   Namespace count: 4
```

---

## ⚠️ ข้อควรระวัง

### 1. NVS Corruption

**อาการ:**
```
E (xxx) nvs: nvs_flash_init failed (0x1105)
```

**วิธีแก้:**
```powershell
# Erase flash และ flash ใหม่
idf.py -p COM3 erase-flash
idf.py -p COM3 flash monitor
```

### 2. NVS เต็ม

**อาการ:**
```
E (xxx) nvs: Not enough space in NVS
```

**วิธีแก้:**
- เพิ่มขนาด NVS partition ใน `partitions.csv`
- ลดขนาด factory partition

### 3. ข้อมูลเก่าค้างอยู่

**อาการ:**
- Provision ใหม่แล้วยังใช้ address เก่า
- AppKey binding ไม่ตรงกับ network ใหม่

**วิธีแก้:**
```powershell
# Erase NVS
idf.py -p COM3 erase-flash

# หรือใช้ code ลบ NVS:
nvs_flash_erase();
nvs_flash_init();
```

---

## 🎯 Checklist: ตรวจสอบ BLE Mesh Storage

```
☐ 1. มี CONFIG_BLE_MESH_SETTINGS=y ใน sdkconfig.defaults
☐ 2. มี NVS partition ใน partitions.csv (ขนาดอย่างน้อย 256KB)
☐ 3. Build ด้วย idf.py fullclean && idf.py build
☐ 4. Flash firmware ใหม่
☐ 5. Provision ด้วย nRF Mesh App
☐ 6. Bind AppKey กับ models
☐ 7. Reset device
☐ 8. ตรวจสอบว่าโหลดข้อมูลจาก NVS ได้ ("Loaded provisioning data from NVS")
☐ 9. ทดสอบส่งคำสั่ง LED โดยไม่ต้อง provision ใหม่
```

---

## 📚 สรุป

### ก่อนแก้ไข:
- ❌ Reset แล้วต้อง provision ใหม่ทุกครั้ง
- ❌ ต้อง bind AppKey ใหม่ทุกครั้ง
- ❌ Error "Model not bound to AppKey" หลัง reset

### หลังแก้ไข:
- ✅ Reset แล้วโหลดข้อมูลจาก NVS อัตโนมัติ
- ✅ ไม่ต้อง provision ใหม่
- ✅ ไม่ต้อง bind AppKey ใหม่
- ✅ ส่งคำสั่ง LED ได้ทันทีหลัง reset

---

## 🔗 อ้างอิง

- [ESP-IDF BLE Mesh Documentation](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/esp-ble-mesh/ble-mesh-index.html)
- [NVS (Non-Volatile Storage) Documentation](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/storage/nvs_flash.html)
- [BLE Mesh Settings API](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/bluetooth/esp-ble-mesh.html#settings)

