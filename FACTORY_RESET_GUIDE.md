# 🔴 Factory Reset Mode - คู่มือการใช้งาน

> **📚 See Also:** [FACTORY_RESET_METHODS.md](FACTORY_RESET_METHODS.md) - Complete guide with MQTT remote factory reset method

## 🎯 Factory Reset คืออะไร?

**Factory Reset** คือการลบข้อมูล BLE Mesh provisioning ทั้งหมดออกจาก device และเริ่มต้นใหม่ โดยไม่ต้องใช้คอมพิวเตอร์หรือสคริปต์

**ข้อมูลที่จะถูกลบ:**
- ✅ Provisioning data (Node address, NetKey, AppKey)
- ✅ Model bindings (AppKey bindings)
- ✅ Publication settings
- ✅ Subscription addresses
- ✅ IV Index และ Sequence Number

**ข้อมูลที่ไม่ถูกลบ:**
- ❌ WiFi credentials (Gateway only)
- ❌ MQTT settings (Gateway only)
- ❌ Firmware

---

## 🔧 วิธีการใช้งาน Factory Reset

### ขั้นตอนที่ 1: กดปุ่ม Boot ค้างไว้

**Gateway Node:**
- กดปุ่ม **BOOT** (GPIO0) ค้างไว้ **10 วินาที**

**Endpoint Node:**
- กดปุ่ม **BOOT** (GPIO0) ค้างไว้ **10 วินาที**
- **หมายเหตุ**: กดสั้น (< 1 วินาที) = ส่ง button press message (ฟีเจอร์เดิม)

---

### ขั้นตอนที่ 2: รอและสังเกต Serial Monitor

#### **หลัง 0 วินาที:**
```
I (xxx) GATEWAY: Button hold detected - hold for 10 seconds to factory reset
```

#### **หลัง 3 วินาที:**
```
W (xxx) GATEWAY: ⚠️  Factory reset in 7 seconds...
```

#### **หลัง 7 วินาที:**
```
W (xxx) GATEWAY: 🔴 FACTORY RESET IN 3 SECONDS! Release button to cancel!
```

#### **หลัง 10 วินาที:**
```
W (xxx) GATEWAY:
W (xxx) GATEWAY: ========================================
W (xxx) GATEWAY: 🔴 FACTORY RESET TRIGGERED!
W (xxx) GATEWAY: ========================================
W (xxx) GATEWAY: Clearing all provisioning data...
I (xxx) GATEWAY: ✓ Provisioning data cleared
W (xxx) GATEWAY: Restarting device in 2 seconds...
W (xxx) GATEWAY: ========================================
W (xxx) GATEWAY: 🔄 RESTARTING...
W (xxx) GATEWAY: ========================================
```

---

### ขั้นตอนที่ 3: Device จะ Restart อัตโนมัติ

หลังจาก restart:
```
I (xxx) GATEWAY: Smart Storage Gateway Node starting...
I (xxx) MESH_STORAGE: Mesh storage initialized
I (xxx) GATEWAY: Device not provisioned yet
```

✅ **Factory reset สำเร็จ!**

---

## ⏱️ Timeline

| เวลา | สถานะ | การแจ้งเตือน |
|------|-------|-------------|
| **0s** | เริ่มกดปุ่ม | "Button hold detected" |
| **3s** | Warning | "⚠️ Factory reset in 7 seconds..." |
| **7s** | Critical Warning | "🔴 FACTORY RESET IN 3 SECONDS!" |
| **10s** | Factory Reset | ลบข้อมูลและ restart |

---

## 🚫 วิธียกเลิก Factory Reset

**ปล่อยปุ่มก่อน 10 วินาที:**

```
I (xxx) GATEWAY: Factory reset cancelled (held for 5432 ms)
```

✅ **Factory reset ถูกยกเลิก - ข้อมูลยังคงอยู่**

---

## 📋 ขั้นตอนหลัง Factory Reset

### 1. ตรวจสอบว่า Factory Reset สำเร็จ

**Serial Monitor ควรแสดง:**
```
I (xxx) GATEWAY: Device not provisioned yet
```

---

### 2. Provision ใหม่ด้วย nRF Mesh App

#### **Gateway (0x0001):**
1. Scan → "ESP Gateway" → Provision
2. Bind **App Key 1** → **Generic OnOff Client**
3. Set Publication → `C000`

#### **Endpoint (0x0002):**
1. Scan → "ESP BLE Mesh Node" → Provision
2. Bind **App Key 1** → **Generic OnOff Server**
3. Set Publication → `C000`
4. Add Subscription → `C000`

---

### 3. ทดสอบ

```powershell
# ทดสอบ LED control
.\test-led.ps1 -NodeAddress 2 -State on
```

---

## 🆚 เปรียบเทียบวิธีการ Reset

| วิธี | ความเร็ว | ต้องใช้ PC | ลบ WiFi/MQTT | แนะนำ |
|------|---------|-----------|-------------|-------|
| **Factory Reset (กดปุ่ม)** | ⭐⭐⭐ | ❌ | ❌ | ✅ ใช้งานง่าย |
| **reset-provisioning.ps1** | ⭐⭐ | ✅ | ✅ | ✅ ทดสอบ |
| **rebuild-all.ps1 -EraseFlash** | ⭐ | ✅ | ✅ | ✅ Production |

---

## 🎯 เมื่อไหร่ควรใช้ Factory Reset?

### ✅ ใช้ Factory Reset เมื่อ:
- ต้องการ reset provisioning แบบเร็ว
- ไม่มีคอมพิวเตอร์ในมือ
- ต้องการเก็บ WiFi/MQTT settings ไว้ (Gateway)
- ทดสอบระบบ provisioning ในสนาม

### ❌ ไม่ควรใช้ Factory Reset เมื่อ:
- ต้องการลบ WiFi credentials (ใช้ `erase-flash` แทน)
- ต้องการ flash firmware ใหม่
- มีปัญหา firmware (ใช้ `rebuild-all.ps1` แทน)

---

## 🐛 Troubleshooting

### ปัญหา: กดปุ่มแล้วไม่มีอะไรเกิดขึ้น

**สาเหตุ:**
- ปุ่ม Boot อาจเสีย
- กดปุ่มผิดตัว (Gateway ใช้ GPIO0, Endpoint ใช้ GPIO9)

**วิธีแก้:**
1. ตรวจสอบ serial monitor ว่ามีข้อความ "⚠️ Factory reset in X seconds..." หรือไม่
2. **ทั้ง Gateway และ Endpoint**: กดปุ่ม BOOT (GPIO0)
3. กดค้างให้ครบ 10 วินาที
4. ลองกดปุ่มอีกครั้ง
5. ใช้วิธี `reset-provisioning.ps1` แทน

---

### ปัญหา: Factory reset แล้วยังเห็น "Loaded provisioning data"

**สาเหตุ:**
- Factory reset ไม่สำเร็จ
- NVS ไม่ถูกลบ

**วิธีแก้:**
```powershell
# ใช้ erase-flash แทน
.\rebuild-all.ps1 -EraseFlash
```

---

### ปัญหา: กดปุ่มค้างแล้ว device restart ก่อน 10 วินาที

**สาเหตุ:**
- ปุ่ม Boot ทำให้ ESP32 เข้า download mode

**วิธีแก้:**
- ปล่อยปุ่มทันทีหลังจาก power on
- กดปุ่มหลังจาก device boot เสร็จแล้ว

---

## 📊 ตัวอย่าง Serial Monitor Output

### Factory Reset สำเร็จ:

```
I (12345) GATEWAY: Button hold detected - hold for 10 seconds to factory reset
W (15345) GATEWAY: ⚠️  Factory reset in 7 seconds...
W (19345) GATEWAY: 🔴 FACTORY RESET IN 3 SECONDS! Release button to cancel!
W (22345) GATEWAY:
W (22345) GATEWAY: ========================================
W (22345) GATEWAY: 🔴 FACTORY RESET TRIGGERED!
W (22345) GATEWAY: ========================================
W (22345) GATEWAY: Clearing all provisioning data...
I (22350) MESH_STORAGE: Clearing all mesh storage data
I (22355) MESH_STORAGE: ✓ All mesh storage data cleared
I (22360) GATEWAY: ✓ Provisioning data cleared
W (22365) GATEWAY: Restarting device in 2 seconds...
W (24365) GATEWAY: ========================================
W (24365) GATEWAY: 🔄 RESTARTING...
W (24365) GATEWAY: ========================================

--- Device restarting ---

I (1234) GATEWAY: Smart Storage Gateway Node starting...
I (1240) MESH_STORAGE: Mesh storage initialized
I (1245) GATEWAY: Device not provisioned yet
```

### Factory Reset ถูกยกเลิก:

```
I (12345) GATEWAY: Button hold detected - hold for 10 seconds to factory reset
W (15345) GATEWAY: ⚠️  Factory reset in 7 seconds...
I (17890) GATEWAY: Factory reset cancelled (held for 5545 ms)
```

---

## 🔗 เอกสารที่เกี่ยวข้อง

- **[QUICK_RESET_GUIDE.md](QUICK_RESET_GUIDE.md)** - คู่มือ reset แบบสั้น
- **[RESET_PROVISIONING.md](RESET_PROVISIONING.md)** - คู่มือ reset แบบละเอียด
- **[MESH_STORAGE_GUIDE.md](MESH_STORAGE_GUIDE.md)** - คู่มือ Mesh Storage

---

## 💡 Tips

1. **ทดสอบก่อนใช้งานจริง:**
   - ลอง factory reset ในสภาพแวดล้อมทดสอบก่อน
   - ตรวจสอบว่า provision ใหม่ได้สำเร็จ

2. **ใช้ Serial Monitor:**
   - เปิด serial monitor เพื่อดูสถานะ
   - ช่วยในการ debug ถ้ามีปัญหา

3. **Backup ข้อมูล:**
   - ถ้าต้องการเก็บ WiFi/MQTT settings ใช้ factory reset
   - ถ้าต้องการลบทั้งหมด ใช้ `erase-flash`

4. **GPIO ที่ใช้:**
   - **Gateway**: GPIO0 (ปุ่ม BOOT)
   - **Endpoint**: GPIO0 (ปุ่ม BOOT)
   - เหตุผล: GPIO9 ถูกใช้โดย NeoPixel (OUTPUT mode) จึงไม่สามารถใช้เป็นปุ่มได้

5. **Endpoint Button Behavior:**
   - **กดสั้น (< 1 วินาที)**: ส่ง button press message ผ่าน BLE Mesh
   - **กดยาว (10 วินาที)**: Factory reset
   - ทั้งสองฟีเจอร์ใช้ปุ่มเดียวกัน (GPIO0)

---

## 🎉 สรุป

**Factory Reset Mode** ช่วยให้คุณสามารถ:
- ✅ Reset provisioning ได้ง่ายโดยกดปุ่ม 10 วินาที
- ✅ ไม่ต้องใช้คอมพิวเตอร์
- ✅ เก็บ WiFi/MQTT settings ไว้
- ✅ ยกเลิกได้ก่อน 10 วินาที

**ลองใช้งานได้เลย!** 🚀
