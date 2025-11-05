# BLE Mesh Provisioning Guide - Endpoint Node

คู่มือการ Provision Endpoint Node เข้า BLE Mesh Network ด้วย nRF Mesh App

---

## 📱 เตรียมความพร้อม

### ดาวน์โหลด nRF Mesh App

- **iOS**: [nRF Mesh - App Store](https://apps.apple.com/app/nrf-mesh/id1380726771)
- **Android**: [nRF Mesh - Google Play](https://play.google.com/store/apps/details?id=no.nordicsemi.android.nrfmeshprovisioner)

### ตรวจสอบ Endpoint Node

เปิด ESP-IDF PowerShell และรัน:

```powershell
cd C:\Users\Aimz\source\repos\smart-storage-device\firmware\endpoint-node
idf.py -p COM6 monitor
```

**ตรวจสอบ log ว่ามีข้อความนี้:**

```
I (xxx) main: BLE Mesh Node initialized
I (xxx) main: Endpoint Node ready
```

---

## 🔧 Step 1: สร้าง Mesh Network

### ครั้งแรกที่เปิด nRF Mesh App:

1. เปิด **nRF Mesh app**
2. กด **"+"** ที่มุมขวาล่าง
3. เลือก **"Create new network"** หรือ **"Add network"**
4. ตั้งชื่อ Network เช่น **"Smart Storage Network"**
5. กด **"Create"** หรือ **"OK"**

**App จะสร้างให้อัตโนมัติ:**
- ✅ **Network Key (NetKey)** - กุญแจเข้า mesh network
- ✅ **Application Key (App Key 1)** - กุญแจสำหรับ applications

---

## 📡 Step 2: Scan และ Provision Endpoint Node

### 2.1 เริ่ม Scan

1. กด **"+"** ที่มุมขวาล่าง
2. เลือก **"Add node"** หรือ **"Provision device"**
3. App จะเริ่ม **Scan หา BLE devices**

### 2.2 เลือก Device

ควรเห็น device ชื่อ:

```
ESP BLE Mesh Node
UUID: dd:dd:xx:xx:xx:xx:...
```

4. **กดเลือก "ESP BLE Mesh Node"**

### 2.3 Identify (ถ้ามี)

- บาง version อาจถาม **"Identify device?"**
- กด **"Identify"** หรือ **ข้ามขั้นตอนนี้**

### 2.4 Provision

5. กด **"Provision"**
6. รอจนเห็นข้อความ:

```
✓ Provisioning complete
Node address: 0x0002
```

**ตรวจสอบ log บน ESP32:**

```
I (xxx) main: Provisioning complete
I (xxx) main: Node address: 0x0002
```

---

## 🔑 Step 3: Bind Application Key

### 3.1 เข้าสู่ Node Configuration

1. กดที่ **"Node ที่เพิ่ง Provision"** ในรายการ
2. กด **"Elements"** หรือ **"Element 0"**

### 3.2 เลือก Model

3. เห็น Models:
   - Configuration Server
   - **Generic OnOff Server** ← เลือกอันนี้

4. กดที่ **"Generic OnOff Server"**

### 3.3 Bind App Key

5. กด **"Bind Key"** หรือ **"App Keys"**
6. เลือก **"App Key 1"** (ที่ app สร้างให้ตอนสร้าง network)
7. กด **"Bind"** หรือ **"OK"**

**ผลลัพธ์:**
```
✓ App Key 1 bound to Generic OnOff Server
```

---

## 📤 Step 4: ตั้งค่า Publication (ส่งข้อมูล)

### 4.1 เข้าสู่ Publication Settings

1. อยู่ที่ **Generic OnOff Server**
2. กด **"Publication"** หรือ **"Set Publication"**

### 4.2 ตั้งค่า Publication Address

3. ตั้งค่าดังนี้:
   - **Publish Address**: `C000` (All-nodes group address)
   - **App Key**: App Key 1
   - **TTL**: 5-10
   - **Period**: None หรือ 0
   - **Retransmit Count**: 0-2
   - **Retransmit Interval**: 50-100 ms

4. กด **"Apply"** หรือ **"Set"**

**ผลลัพธ์:**
```
✓ Publication set to C000
```

---

## 📥 Step 5: ตั้งค่า Subscription (รับข้อมูล)

### 5.1 เข้าสู่ Subscription Settings

1. กด **"Subscription"** หรือ **"Add Subscription"**

### 5.2 เพิ่ม Subscription Address

2. เลือก **"Group"** หรือ **"Group Address"**
3. ใส่ address: `C000`
4. กด **"Subscribe"** หรือ **"Add"**

**ผลลัพธ์:**
```
✓ Subscribed to group C000
```

---

## ✅ Step 6: ทดสอบการทำงาน

### Test 1: กดปุ่ม Boot บน Endpoint

1. **กดปุ่ม Boot** บน ESP32-C6 Feather
2. **ตรวจสอบ:**
   - NeoPixel กระพริบสีแดง (ถ้า location indicator ไม่ทำงาน)
   - Log บน ESP32: `Button pressed!`
   - Gateway ควรรับ message และส่ง MQTT

### Test 2: ส่งคำสั่ง Location Indicator

**จาก nRF Mesh App:**

1. กดที่ **Generic OnOff Server**
2. กด **"ON"** button
3. **ตรวจสอบ:**
   - NeoPixel เปลี่ยนเป็น **สีเขียวติดค้าง**
   - Log: `Location indicator ON`

4. **กดปุ่ม Boot** บน ESP32
5. **ตรวจสอบ:**
   - NeoPixel ดับ
   - Log: `Location indicator turned off by button`

---

## 🎨 LED Behavior Reference

### NeoPixel LED (GPIO 9)

| สถานะ | สี | รูปแบบ | ความหมาย |
|-------|-----|--------|----------|
| ไม่ได้ Provision | 🔵 น้ำเงิน | กระพริบ | รอ Provision |
| Provision แล้ว | 🟡 เหลือง | กระพริบ | สถานะปกติ |
| Location Indicator | 🟢 เขียว | ติดค้าง | แสดงตำแหน่ง |
| Battery < 10% | 🔴 แดง | กระพริบ | แบตเตอรี่ต่ำ |

### Red LED (GPIO 15)

| สถานะ | รูปแบบ | ความหมาย |
|-------|--------|----------|
| ไม่เชื่อม Gateway | ติดค้าง | ยังไม่ได้ Provision |
| เชื่อม Gateway | กระพริบ | Provision แล้ว |

---

## 🔍 Troubleshooting

### ปัญหา: Scan ไม่เจอ "ESP BLE Mesh Node"

**แก้ไข:**

1. **ตรวจสอบ ESP32 รันอยู่:**
   ```powershell
   idf.py -p COM6 monitor
   ```
   ต้องเห็น: `BLE Mesh Node initialized`

2. **เปิด Bluetooth บนมือถือ**

3. **ลดระยะห่าง** - ใกล้ ESP32 ประมาณ 1-2 เมตร

4. **Reset ESP32** - กดปุ่ม Reset แล้ว scan ใหม่

5. **ปิด-เปิด nRF Mesh app ใหม่**

### ปัญหา: Provisioning Failed

**แก้ไข:**

1. **ลบ node ออกจาก app** (ถ้ามี)
2. **Reset ESP32** - กดปุ่ม Reset
3. **ลอง Provision ใหม่**

### ปัญหา: ส่งคำสั่ง ON แล้ว LED ไม่เปลี่ยน

**แก้ไข:**

1. **ตรวจสอบ App Key ถูก Bind แล้ว:**
   - Generic OnOff Server → App Keys → ต้องมี "App Key 1"

2. **ตรวจสอบ Subscription:**
   - Generic OnOff Server → Subscriptions → ต้องมี "C000"

3. **ตรวจสอบ log บน ESP32:**
   ```
   I (xxx) main: Generic OnOff Set message received
   I (xxx) main: Location indicator ON
   ```

---

## 📋 Provisioning Checklist

```
☐ 1. ดาวน์โหลด nRF Mesh app
☐ 2. ตรวจสอบ ESP32 รัน (idf.py monitor)
☐ 3. สร้าง Mesh Network ใน app
☐ 4. Scan หา "ESP BLE Mesh Node"
☐ 5. Provision device
☐ 6. Bind App Key 1 กับ Generic OnOff Server
☐ 7. Set Publication address: C000
☐ 8. Add Subscription address: C000
☐ 9. ทดสอบกดปุ่ม Boot
☐ 10. ทดสอบส่งคำสั่ง ON/OFF
```

---

## 🎯 Application Key คืออะไร?

### Network Key vs Application Key

| Key Type | ชื่อเต็ม | หน้าที่ | สร้างเมื่อไหร่ |
|----------|---------|---------|---------------|
| **NetKey** | Network Key | เข้าถึง mesh network | สร้าง network |
| **AppKey** | Application Key | ใช้งาน applications | สร้าง network |

### ทำไมต้องมี App Key?

- 🔒 **Security** - แยก permissions ระหว่าง applications
- 🔑 **Access Control** - กำหนดว่า node ไหนใช้ app ไหนได้
- 📱 **Multiple Apps** - สามารถมีหลาย app keys ใน network เดียว

### ตัวอย่าง Use Case

```
Network: Smart Storage
├── App Key 1: Storage Management (ใช้กับ Endpoint nodes)
├── App Key 2: Lighting Control (ใช้กับ Light nodes)
└── App Key 3: Sensor Monitoring (ใช้กับ Sensor nodes)
```

**ในโปรเจคนี้:**
- ใช้ **App Key 1** เท่านั้น
- nRF Mesh app **สร้างให้อัตโนมัติ**
- **ไม่ต้องสร้างเอง!**

---

## 📞 ติดต่อ & Support

หากมีปัญหาในการ Provision:

1. ตรวจสอบ log บน ESP32: `idf.py -p COM6 monitor`
2. ดู Troubleshooting section ด้านบน
3. Reset ทั้ง ESP32 และ nRF Mesh app แล้วลองใหม่

---

**สร้างโดย:** Smart Storage Device Project  
**อัพเดทล่าสุด:** 2025-01-04

