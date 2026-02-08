# 🔄 Quick Reset Guide - รีเซ็ตและ Provision ใหม่

## 🚀 วิธีเร็วที่สุด (3 ขั้นตอน)

### 1️⃣ Reset Provisioning

#### **วิธีที่ 1: Factory Reset (กดปุ่ม) ⭐ แนะนำ**

1. กดปุ่ม **BOOT** ค้างไว้ **10 วินาที**
2. รอจนเห็น "🔴 FACTORY RESET TRIGGERED!" ใน serial monitor
3. Device จะ restart อัตโนมัติ

**ข้อดี:**
- ✅ ไม่ต้องใช้คอมพิวเตอร์
- ✅ เก็บ WiFi/MQTT settings ไว้
- ✅ รวดเร็ว

**Timeline:**
- 0s: เริ่มกดปุ่ม
- 3s: Warning
- 7s: Critical warning
- 10s: Factory reset!

---

#### **วิธีที่ 2: ใช้สคริปต์**

```powershell
# Reset ทั้ง Gateway และ Endpoint
.\reset-provisioning.ps1

# หรือ reset แยก
.\reset-provisioning.ps1 -GatewayOnly
.\reset-provisioning.ps1 -EndpointOnly
```

**หรือใช้วิธีนี้:**
```powershell
# Erase flash และ flash ใหม่
.\rebuild-all.ps1 -EraseFlash
```

---

### 2️⃣ Provision ด้วย nRF Mesh App

#### Gateway (0x0001):
1. Scan → "ESP Gateway" → Provision
2. Bind **App Key 1** → **Generic OnOff Client** ⭐
3. Set Publication → `C000`

#### Endpoint (0x0002):
1. Scan → "ESP BLE Mesh Node" → Provision
2. Bind **App Key 1** → **Generic OnOff Server** ⭐
3. Set Publication → `C000`
4. Add Subscription → `C000`

---

### 3️⃣ ทดสอบ

```powershell
# ทดสอบ LED
.\test-led.ps1 -NodeAddress 2 -State on

# กดปุ่ม Reset บน Gateway และ Endpoint
# ทดสอบ LED อีกครั้ง (ควรทำงานโดยไม่ต้อง provision ใหม่)
.\test-led.ps1 -NodeAddress 2 -State on
```

---

## 📋 Checklist

### ก่อน Reset:
- [ ] Backup WiFi credentials (ถ้าจำเป็น)
- [ ] Backup MQTT settings (ถ้าจำเป็น)
- [ ] ปิด serial monitor ทั้งหมด

### หลัง Reset:
- [ ] เห็น "Device not provisioned yet" ใน serial monitor
- [ ] Provision Gateway → address 0x0001
- [ ] Bind AppKey กับ Generic OnOff Client
- [ ] Provision Endpoint → address 0x0002
- [ ] Bind AppKey กับ Generic OnOff Server
- [ ] ทดสอบ LED control
- [ ] Reset devices และทดสอบ load ข้อมูล

---

## 🐛 แก้ปัญหาเร็ว

### ปัญหา: Reset แล้วยังเห็น "Loaded provisioning data"
```powershell
# ใช้ erase-flash แทน
.\rebuild-all.ps1 -EraseFlash
```

### ปัญหา: Provision ได้ address ไม่ถูกต้อง
1. เปิด nRF Mesh app
2. Settings → Reset Network
3. Provision ใหม่

### ปัญหา: Error "Model not bound to AppKey"
1. ตรวจสอบว่า bind AppKey แล้ว
2. ตรวจสอบว่าใช้ **App Key 1** (ไม่ใช่ App Key 0)

---

## 📚 เอกสารเพิ่มเติม

- **[FACTORY_RESET_GUIDE.md](FACTORY_RESET_GUIDE.md)** - คู่มือ Factory Reset (กดปุ่ม)
- **[RESET_PROVISIONING.md](RESET_PROVISIONING.md)** - คู่มือแบบละเอียด
- **[MESH_STORAGE_GUIDE.md](MESH_STORAGE_GUIDE.md)** - คู่มือ Mesh Storage
- **[FIX_APPKEY_ERROR.md](FIX_APPKEY_ERROR.md)** - แก้ปัญหา AppKey

