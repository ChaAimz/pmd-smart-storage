# 🔄 Reset Provisioning - คู่มือการ Reset และ Provision ใหม่

## 🎯 เมื่อไหร่ต้อง Reset Provisioning?

ต้อง reset provisioning เมื่อ:
- ✅ ต้องการเปลี่ยน node address
- ✅ ต้องการเข้า mesh network ใหม่
- ✅ มีปัญหาการ provision (เช่น address ซ้ำ)
- ✅ ต้องการเริ่มต้นใหม่ทั้งหมด
- ✅ ทดสอบระบบ provisioning

---

## 🔧 วิธีการ Reset Provisioning

มี **3 วิธี** ในการ reset provisioning:

### วิธีที่ 1: Erase Flash ทั้งหมด (แนะนำ) ⭐

**ข้อดี:**
- ✅ ลบข้อมูลทั้งหมด รวมถึง WiFi credentials, MQTT settings
- ✅ เริ่มต้นใหม่ทั้งหมด 100%
- ✅ แน่นอนที่สุด

**ข้อเสีย:**
- ❌ ต้อง flash firmware ใหม่
- ❌ ต้องตั้งค่า WiFi/MQTT ใหม่ (สำหรับ Gateway)

**วิธีทำ:**

```powershell
# Erase flash และ flash ใหม่ทั้ง Gateway และ Endpoint
.\rebuild-all.ps1 -EraseFlash

# หรือ erase แยก
cd firmware\gateway-node
idf.py -p COM5 erase-flash
idf.py -p COM5 flash

cd ..\endpoint-node
idf.py -p COM6 erase-flash
idf.py -p COM6 flash
```

---

### วิธีที่ 2: ใช้สคริปต์ Reset (แนะนำสำหรับทดสอบ) ⭐

**ข้อดี:**
- ✅ ลบเฉพาะข้อมูล BLE Mesh provisioning
- ✅ ไม่ต้อง flash firmware ใหม่
- ✅ เก็บ WiFi/MQTT settings ไว้ (สำหรับ Gateway)
- ✅ รวดเร็ว

**ข้อเสีย:**
- ❌ ต้องมี firmware ที่รองรับคำสั่ง reset

**วิธีทำ:**

```powershell
# Reset provisioning ของ Gateway และ Endpoint
.\reset-provisioning.ps1

# หรือ reset แยก
.\reset-provisioning.ps1 -GatewayOnly
.\reset-provisioning.ps1 -EndpointOnly
```

---

### วิธีที่ 3: ใช้ nRF Mesh App

**ข้อดี:**
- ✅ ทำผ่าน mobile app
- ✅ ไม่ต้องใช้ command line

**ข้อเสีย:**
- ❌ ต้องลบ node ออกจาก network ทีละตัว
- ❌ ข้อมูลใน NVS ยังคงอยู่ (อาจทำให้เกิดปัญหา)

**วิธีทำ:**

1. เปิด nRF Mesh app
2. เลือก node ที่ต้องการลบ
3. กด **"Delete Node"** หรือ **"Reset Node"**
4. ยืนยันการลบ

**⚠️ หมายเหตุ:** วิธีนี้ไม่แนะนำเพราะข้อมูลใน NVS ของ device ยังคงอยู่

---

## 📋 ขั้นตอนการ Reset และ Provision ใหม่

### Step 1: Reset Provisioning

เลือกวิธีที่ต้องการ (แนะนำวิธีที่ 2):

```powershell
# วิธีที่ 1: Erase flash ทั้งหมด
.\rebuild-all.ps1 -EraseFlash

# วิธีที่ 2: Reset เฉพาะ provisioning data
.\reset-provisioning.ps1
```

---

### Step 2: ตรวจสอบว่า Reset สำเร็จ

**ตรวจสอบ Serial Monitor:**

**Gateway:**
```
I (xxx) GATEWAY: Smart Storage Gateway Node starting...
I (xxx) MESH_STORAGE: Mesh storage initialized
I (xxx) GATEWAY: Device not provisioned yet
```

**Endpoint:**
```
I (xxx) ENDPOINT_NODE: Smart Storage Endpoint Node starting...
I (xxx) MESH_STORAGE: Mesh storage initialized
I (xxx) ENDPOINT_NODE: Device not provisioned yet
```

✅ **ถ้าเห็น "Device not provisioned yet" แสดงว่า reset สำเร็จ**

---

### Step 3: Provision ใหม่ด้วย nRF Mesh App

#### 3.1 Provision Gateway

1. เปิด nRF Mesh app
2. กด **"+"** → **"Add node"**
3. Scan หา **"ESP Gateway"**
4. กด **"Provision"**
5. รอจน Node address: **0x0001**

**ตรวจสอบ Serial Monitor:**
```
I (xxx) GATEWAY: Provisioning complete
I (xxx) GATEWAY: Node address: 0x0001
I (xxx) GATEWAY: ✓ Provisioning data saved to NVS
```

#### 3.2 Bind AppKey กับ Generic OnOff Client (Gateway)

1. กดที่ **Gateway Node (0x0001)**
2. กด **"Elements"** → **"Element 0"**
3. เลือก **"Generic OnOff Client"**
4. กด **"Bind Key"**
5. เลือก **"App Key 1"**
6. กด **"Bind"**

**ตรวจสอบ Serial Monitor:**
```
I (xxx) GATEWAY: Model bound: elem_addr=0x0001, model_id=0x1001, app_idx=0x0001
I (xxx) GATEWAY: ✓ Model binding saved: onoff_cli
```

#### 3.3 Set Publication (Gateway)

1. อยู่ที่ **Generic OnOff Client**
2. กด **"Publication"**
3. ตั้งค่า:
   - **Publish Address:** `C000` (group address)
   - **App Key:** `App Key 1`
   - **TTL:** `5`
   - **Period:** `Disabled`
4. กด **"Apply"**

**ตรวจสอบ Serial Monitor:**
```
I (xxx) GATEWAY: Publication set: elem_addr=0x0001, model_id=0x1001, pub_addr=0xC000
I (xxx) GATEWAY: ✓ Publication settings saved: onoff_cli
```

#### 3.4 Provision Endpoint

1. กด **"+"** → **"Add node"**
2. Scan หา **"ESP BLE Mesh Node"**
3. กด **"Provision"**
4. รอจน Node address: **0x0002**

**ตรวจสอบ Serial Monitor:**
```
I (xxx) ENDPOINT_NODE: Provisioning complete
I (xxx) ENDPOINT_NODE: Node address: 0x0002
I (xxx) ENDPOINT_NODE: ✓ Provisioning data saved to NVS
```

#### 3.5 Bind AppKey กับ Generic OnOff Server (Endpoint)

1. กดที่ **Endpoint Node (0x0002)**
2. กด **"Elements"** → **"Element 0"**
3. เลือก **"Generic OnOff Server"**
4. กด **"Bind Key"**
5. เลือก **"App Key 1"**
6. กด **"Bind"**

**ตรวจสอบ Serial Monitor:**
```
I (xxx) ENDPOINT_NODE: Model bound: elem_addr=0x0002, model_id=0x1000, app_idx=0x0001
I (xxx) ENDPOINT_NODE: ✓ Model binding saved: onoff_srv
```

#### 3.6 Add Subscription (Endpoint)

1. อยู่ที่ **Generic OnOff Server**
2. กด **"Subscription"**
3. กด **"Add"**
4. เลือก **"Group"** → **"All Proxies"** (C000)
5. กด **"Subscribe"**

**ตรวจสอบ Serial Monitor:**
```
I (xxx) ENDPOINT_NODE: Subscription added: elem_addr=0x0002, model_id=0x1000, sub_addr=0xC000
```

---

### Step 4: ทดสอบ LED Control

```powershell
# ทดสอบส่งคำสั่ง LED
.\test-led.ps1 -NodeAddress 2 -State on
```

**ผลลัพธ์:**
- ✅ Gateway ส่งคำสั่งผ่าน BLE Mesh
- ✅ Endpoint รับคำสั่งและติดไฟ LED สีเขียว
- ✅ ไม่มี Error "Model not bound to AppKey"

---

### Step 5: ทดสอบ Reset และ Load ข้อมูล

```powershell
# กดปุ่ม Reset บน Gateway และ Endpoint
```

**ตรวจสอบ Serial Monitor:**

**Gateway:**
```
I (xxx) GATEWAY: ✓ Loaded provisioning data from NVS
I (xxx) GATEWAY:   Node address: 0x0001
I (xxx) GATEWAY: ✓ Generic OnOff Client bound to AppKey 0x0001
```

**Endpoint:**
```
I (xxx) ENDPOINT_NODE: ✓ Loaded provisioning data from NVS
I (xxx) ENDPOINT_NODE:   Node address: 0x0002
I (xxx) ENDPOINT_NODE: ✓ Generic OnOff Server bound to AppKey 0x0001
```

✅ **ข้อมูลถูก load จาก NVS สำเร็จ!**

---

## 🧪 ทดสอบด้วยสคริปต์อัตโนมัติ

```powershell
# ทดสอบว่าระบบทำงานถูกต้อง
.\test-mesh-storage.ps1
```

---

## 🐛 Troubleshooting

### ปัญหา: Reset แล้วยังเห็น "Loaded provisioning data from NVS"

**สาเหตุ:** ข้อมูลใน NVS ยังไม่ถูกลบ

**วิธีแก้:**
1. ใช้ `.\rebuild-all.ps1 -EraseFlash` แทน
2. หรือตรวจสอบว่าสคริปต์ reset-provisioning.ps1 ทำงานถูกต้อง

---

### ปัญหา: Provision ใหม่แล้วได้ address ไม่ตรงตามที่ต้องการ

**สาเหตุ:** nRF Mesh app จำ node เก่าไว้

**วิธีแก้:**
1. เปิด nRF Mesh app
2. กด **"Settings"** → **"Reset Network"**
3. สร้าง network ใหม่
4. Provision ใหม่

---

### ปัญหา: หลัง reset แล้ว WiFi/MQTT ไม่ทำงาน (Gateway)

**สาเหตุ:** ใช้ `erase-flash` ทำให้ WiFi credentials หาย

**วิธีแก้:**
1. ตั้งค่า WiFi ใหม่ใน `firmware/gateway-node/main/main.c`:
```c
#define WIFI_SSID "your-wifi-ssid"
#define WIFI_PASS "your-wifi-password"
```
2. Build และ flash ใหม่

---

## 📚 สรุป

### วิธีที่แนะนำสำหรับแต่ละกรณี:

| กรณี | วิธีที่แนะนำ | คำสั่ง |
|------|-------------|--------|
| **ทดสอบระบบ** | วิธีที่ 2 | `.\reset-provisioning.ps1` |
| **เริ่มต้นใหม่ทั้งหมด** | วิธีที่ 1 | `.\rebuild-all.ps1 -EraseFlash` |
| **แก้ปัญหา provisioning** | วิธีที่ 1 | `.\rebuild-all.ps1 -EraseFlash` |
| **เปลี่ยน node address** | วิธีที่ 1 | `.\rebuild-all.ps1 -EraseFlash` |

---

## 🔗 เอกสารที่เกี่ยวข้อง

- [MESH_STORAGE_GUIDE.md](MESH_STORAGE_GUIDE.md) - คู่มือการใช้งาน Mesh Storage
- [FIX_APPKEY_ERROR.md](FIX_APPKEY_ERROR.md) - แก้ปัญหา AppKey binding
- [TEST_LED_CONTROL.md](TEST_LED_CONTROL.md) - ทดสอบ LED control

