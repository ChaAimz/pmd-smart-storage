# 🔧 แก้ไขปัญหา "Model not bound to AppKey 0x0000"

## 🔍 ปัญหา

```
E (22602) BLE_MESH: Model not bound to AppKey 0x0000
E (22607) BLE_MESH: Failed to send client message 0x00008203
```

**สาเหตุ:** Gateway ไม่ได้ bind AppKey กับ Generic OnOff Client Model

## ✅ วิธีแก้ไข - Provision และ Bind AppKey ให้ Gateway

### 📱 Step 1: เปิด nRF Mesh App

1. เปิด **nRF Mesh app** บนมือถือ
2. ตรวจสอบว่ามี Network อยู่แล้ว (ถ้าไม่มีให้สร้างใหม่)

---

### 🔍 Step 2: Scan หา Gateway Node

1. กด **"+"** ที่มุมขวาล่าง
2. เลือก **"Add node"** หรือ **"Provision device"**
3. App จะ Scan หา BLE devices

**ควรเห็น:**
```
ESP Gateway
UUID: dd:dd:xx:xx:xx:xx:...
```

4. **กดเลือก "ESP Gateway"**

---

### 🔑 Step 3: Provision Gateway

1. กด **"Provision"**
2. รอจนเห็นข้อความ:
   ```
   ✓ Provisioning complete
   Node address: 0x0001
   ```

**ตรวจสอบ Serial Monitor ของ Gateway:**
```
I (xxx) GATEWAY: Provisioning complete
I (xxx) GATEWAY: Node address: 0x0001
```

---

### 🎯 Step 4: Bind AppKey กับ Generic OnOff Client

**นี่คือขั้นตอนสำคัญที่แก้ปัญหา!**

#### 4.1 เข้าสู่ Node Configuration

1. กดที่ **"Gateway Node"** ที่เพิ่ง Provision
2. กด **"Elements"** หรือ **"Element 0"**

#### 4.2 เลือก Generic OnOff Client Model

3. เห็น Models:
   - Configuration Server
   - **Generic OnOff Client** ← **เลือกอันนี้**
   - Generic OnOff Server

4. กดที่ **"Generic OnOff Client"**

#### 4.3 Bind App Key

5. กด **"Bind Key"** หรือ **"App Keys"**
6. เลือก **"App Key 1"**
7. กด **"Bind"** หรือ **"OK"**

**ผลลัพธ์:**
```
✓ App Key 1 bound to Generic OnOff Client
```

---

### 📤 Step 5: ตั้งค่า Publication (สำหรับส่งคำสั่ง LED)

#### 5.1 เข้าสู่ Publication Settings

1. อยู่ที่ **Generic OnOff Client**
2. กด **"Publication"** หรือ **"Set Publication"**

#### 5.2 ตั้งค่า Publication Address

3. ตั้งค่าดังนี้:
   - **Publish Address**: `C000` (All-nodes group address)
   - **App Key**: App Key 1
   - **TTL**: 5-10
   - **Period**: None หรือ 0

4. กด **"Apply"** หรือ **"Set"**

**ผลลัพธ์:**
```
✓ Publication set to C000
```

---

### 📥 Step 6: ตั้งค่า Subscription (สำหรับรับ Button Press)

#### 6.1 Bind AppKey กับ Generic OnOff Server

1. กลับไปที่ **Elements** → **Element 0**
2. เลือก **"Generic OnOff Server"**
3. กด **"Bind Key"** → เลือก **"App Key 1"** → **"Bind"**

#### 6.2 เพิ่ม Subscription

1. กด **"Subscription"** หรือ **"Add Subscription"**
2. เลือก **"Group"**
3. ใส่ address: `C000`
4. กด **"Subscribe"**

**ผลลัพธ์:**
```
✓ Subscribed to group C000
```

---

## 🧪 Step 7: ทดสอบ

### Test 1: ส่งคำสั่ง LED ผ่าน MQTT

```powershell
cd "C:\Program Files\mosquitto"
.\mosquitto_pub.exe -h localhost -t 'smart-storage/command' -m '{"node_addr":2,"led_state":true}'
```

**ตรวจสอบ Gateway Serial Monitor:**
```
I (xxx) GATEWAY: MQTT_EVENT_DATA
I (xxx) GATEWAY: Sending LED command to node 0x0002: ON
```

**ไม่ควรเห็น Error นี้อีก:**
```
E (xxx) BLE_MESH: Model not bound to AppKey 0x0000  ← ไม่ควรมี!
```

### Test 2: ตรวจสอบ Endpoint ได้รับคำสั่ง

**Endpoint Serial Monitor:**
```
I (xxx) ENDPOINT_NODE: Generic server recv set msg: onoff=1
I (xxx) ENDPOINT_NODE: Location indicator ON
```

**NeoPixel LED:**
- ติดสีเขียวค้าง 🟢

---

## 📋 Checklist การ Provision Gateway

```
☐ 1. Scan หา "ESP Gateway" ใน nRF Mesh app
☐ 2. Provision Gateway (Node address: 0x0001)
☐ 3. Bind App Key 1 กับ Generic OnOff Client ⭐ สำคัญ!
☐ 4. Set Publication address: C000 สำหรับ Generic OnOff Client
☐ 5. Bind App Key 1 กับ Generic OnOff Server
☐ 6. Add Subscription address: C000 สำหรับ Generic OnOff Server
☐ 7. ทดสอบส่งคำสั่ง LED
```

---

## 🎯 สรุป Models ที่ต้อง Bind AppKey

### Gateway Node (0x0001)

| Model | ต้อง Bind AppKey? | Publication | Subscription |
|-------|------------------|-------------|--------------|
| Configuration Server | ไม่ต้อง (auto) | - | - |
| **Generic OnOff Client** | **✅ ต้อง!** | C000 | - |
| Generic OnOff Server | ✅ ต้อง | - | C000 |

### Endpoint Node (0x0002, 0x0003, ...)

| Model | ต้อง Bind AppKey? | Publication | Subscription |
|-------|------------------|-------------|--------------|
| Configuration Server | ไม่ต้อง (auto) | - | - |
| **Generic OnOff Server** | **✅ ต้อง!** | C000 | C000 |
| Generic OnOff Client | ✅ ต้อง | C000 | - |

---

## 🔍 วิธีตรวจสอบว่า Bind สำเร็จ

### ใน nRF Mesh App:

1. เลือก **Gateway Node**
2. ไปที่ **Elements** → **Element 0**
3. เลือก **Generic OnOff Client**
4. ดูที่ **"Bound App Keys"**

**ควรเห็น:**
```
✓ App Key 1
```

### ใน Serial Monitor:

**ส่งคำสั่ง LED แล้วไม่เห็น Error:**
```
I (xxx) GATEWAY: Sending LED command to node 0x0002: ON
```

**ไม่มี:**
```
E (xxx) BLE_MESH: Model not bound to AppKey 0x0000  ← ไม่ควรมี!
```

---

## 🐛 Troubleshooting

### ปัญหา: ไม่เจอ "ESP Gateway" ใน Scan

**วิธีแก้:**
1. ตรวจสอบ Gateway รันอยู่: `idf.py -p COM3 monitor`
2. ตรวจสอบ log: `BLE Mesh Node initialized`
3. ลอง Reset Gateway (กดปุ่ม Reset)
4. ลอง Scan ใหม่

### ปัญหา: Provision แล้วแต่ไม่เห็น Models

**วิธีแก้:**
1. รอสักครู่ให้ app โหลดข้อมูล
2. ลอง Refresh (ดึงลงมา)
3. ลองออกจาก app แล้วเข้าใหม่

### ปัญหา: Bind แล้วยังเห็น Error

**วิธีแก้:**
1. ตรวจสอบว่า Bind ถูก Model (Generic OnOff **Client** ไม่ใช่ Server)
2. ลอง Reset Gateway และ Provision ใหม่
3. ลบ NVS และ Flash ใหม่:
   ```powershell
   cd firmware/gateway-node
   idf.py -p COM3 erase-flash
   idf.py -p COM3 flash monitor
   ```

### ปัญหา: ต้องการ Reset ทุกอย่างเริ่มใหม่

**วิธีแก้:**

1. **ลบ NVS ทั้ง Gateway และ Endpoint:**
   ```powershell
   # Gateway
   cd firmware/gateway-node
   idf.py -p COM3 erase-flash
   idf.py -p COM3 flash monitor

   # Endpoint
   cd firmware/endpoint-node
   idf.py -p COM6 erase-flash
   idf.py -p COM6 flash monitor
   ```

2. **ลบ Network ใน nRF Mesh App:**
   - Settings → Networks → เลือก Network → Delete

3. **สร้าง Network ใหม่และ Provision ทั้งหมดใหม่**

---

## ✅ ผลลัพธ์ที่ถูกต้อง

### Gateway Serial Monitor:
```
I (xxx) GATEWAY: WiFi connected
I (xxx) GATEWAY: MQTT_EVENT_CONNECTED
I (xxx) GATEWAY: Provisioning complete
I (xxx) GATEWAY: Node address: 0x0001
I (xxx) GATEWAY: MQTT_EVENT_DATA
I (xxx) GATEWAY: Sending LED command to node 0x0002: ON
```

### Endpoint Serial Monitor:
```
I (xxx) ENDPOINT_NODE: Provisioning complete
I (xxx) ENDPOINT_NODE: Node address: 0x0002
I (xxx) ENDPOINT_NODE: Generic server recv set msg: onoff=1
I (xxx) ENDPOINT_NODE: Location indicator ON
```

### NeoPixel LED:
- Endpoint: **สีเขียวติดค้าง** 🟢

---

## 📚 อ้างอิง

- [PROVISIONING.md](firmware/endpoint-node/PROVISIONING.md) - คู่มือ Provision Endpoint
- [TEST_LED_CONTROL.md](TEST_LED_CONTROL.md) - คู่มือทดสอบ LED
- [nRF Mesh App Documentation](https://www.nordicsemi.com/Products/Development-tools/nrf-mesh)

