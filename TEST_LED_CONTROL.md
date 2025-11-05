# 🔍 การทดสอบและ Debug ไฟ NeoPixel ไม่ติด

## ขั้นตอนการตรวจสอบปัญหา

### 1️⃣ ตรวจสอบว่า Endpoint Node ได้รับคำสั่งหรือไม่

**เปิด Serial Monitor ของ Endpoint Node:**
```powershell
cd firmware/endpoint-node
idf.py -p COM6 monitor
```

**ส่งคำสั่ง LED:**
```powershell
# ผ่าน MQTT
cd "C:\Program Files\mosquitto"
.\mosquitto_pub.exe -h localhost -t 'smart-storage/command' -m '{"node_addr":2,"led_state":true}'
```

**ข้อความที่ควรเห็นใน Serial Monitor:**
```
I (xxxxx) ENDPOINT_NODE: Generic server recv set msg: onoff=1
I (xxxxx) ENDPOINT_NODE: Location indicator ON
```

**ถ้าไม่เห็นข้อความนี้** → ปัญหาอยู่ที่ BLE Mesh (ไม่ได้รับข้อความ)
**ถ้าเห็นข้อความนี้** → ปัญหาอยู่ที่การควบคุม LED

---

### 2️⃣ ตรวจสอบ Gateway ส่งคำสั่งหรือไม่

**เปิด Serial Monitor ของ Gateway:**
```powershell
cd firmware/gateway-node
idf.py -p COM3 monitor
```

**ส่งคำสั่ง LED:**
```powershell
.\mosquitto_pub.exe -h localhost -t 'smart-storage/command' -m '{"node_addr":2,"led_state":true}'
```

**ข้อความที่ควรเห็นใน Gateway Serial Monitor:**
```
I (xxxxx) GATEWAY: MQTT_EVENT_DATA
I (xxxxx) GATEWAY: TOPIC=smart-storage/command
I (xxxxx) GATEWAY: DATA={"node_addr":2,"led_state":true}
I (xxxxx) GATEWAY: Sending LED command to node 0x0002: ON
```

**ถ้าไม่เห็นข้อความนี้** → ปัญหาอยู่ที่ MQTT หรือ WiFi

---

### 3️⃣ ตรวจสอบ Node Address ถูกต้องหรือไม่

**ดู Node Address ของ Endpoint:**
```
I (xxxxx) ENDPOINT_NODE: Provisioning complete
I (xxxxx) ENDPOINT_NODE: Node address: 0x0002
```

**ตรวจสอบว่าคำสั่งที่ส่งใช้ address เดียวกัน:**
```json
{"node_addr":2,"led_state":true}  // 2 (decimal) = 0x0002 (hex)
```

---

### 4️⃣ ตรวจสอบสถานะ LED ปัจจุบัน

**ดูสถานะใน led_control_task:**
```
I (xxxxx) ENDPOINT_NODE: Location indicator ON (from BLE Mesh)
```

**ตรวจสอบว่า LED State เป็นอะไร:**
- `LED_STATE_LOCATION_INDICATOR` → ไฟเขียวติดค้าง ✅
- `LED_STATE_BATTERY_LOW` → ไฟแดงกระพริบ (แบตต่ำ)
- `LED_STATE_NO_GATEWAY` → ไฟน้ำเงินกระพริบ (ไม่เชื่อม Gateway)
- `LED_STATE_OTHER` → ไฟเหลืองกระพริบ (สถานะปกติ)

---

### 5️⃣ ตรวจสอบ BLE Mesh Provisioning

**ตรวจสอบว่า Endpoint ถูก Provision แล้ว:**
```
I (xxxxx) ENDPOINT_NODE: Loaded provisioning data from NVS
I (xxxxx) ENDPOINT_NODE: Provisioning complete
I (xxxxx) ENDPOINT_NODE: Node address: 0x0002
```

**ถ้ายังไม่ได้ Provision:**
1. ใช้ nRF Mesh App เพื่อ Provision
2. หรือลบ NVS และ Provision ใหม่:
```powershell
idf.py -p COM6 erase-flash
idf.py -p COM6 flash monitor
```

---

## 🧪 คำสั่งทดสอบแบบละเอียด

### ทดสอบผ่าน Backend API

```powershell
# 1. ตรวจสอบ Backend ทำงาน
curl http://localhost:3000/health

# 2. ดู Locations ทั้งหมด
curl http://localhost:3000/api/locations

# 3. ส่งคำสั่ง LED (เปลี่ยน 0x0002 เป็น address ของคุณ)
curl -X POST http://localhost:3000/api/locations/0x0002/led `
  -H "Content-Type: application/json" `
  -d '{\"state\": \"on\"}'

# 4. ปิด LED
curl -X POST http://localhost:3000/api/locations/0x0002/led `
  -H "Content-Type: application/json" `
  -d '{\"state\": \"off\"}'
```

### ทดสอบผ่าน MQTT โดยตรง

```powershell
cd "C:\Program Files\mosquitto"

# 1. Subscribe เพื่อดูข้อความทั้งหมด
.\mosquitto_sub.exe -h localhost -t 'smart-storage/#' -v

# 2. ส่งคำสั่ง LED (ใน Terminal อื่น)
.\mosquitto_pub.exe -h localhost -t 'smart-storage/command' -m '{\"node_addr\":2,\"led_state\":true}'

# 3. ปิด LED
.\mosquitto_pub.exe -h localhost -t 'smart-storage/command' -m '{\"node_addr\":2,\"led_state\":false}'
```

---

## 🐛 สาเหตุที่เป็นไปได้

### ปัญหา 1: ไม่ได้ Build Firmware ใหม่
**วิธีแก้:**
```powershell
cd firmware/endpoint-node
idf.py fullclean
idf.py build
idf.py -p COM6 flash monitor
```

### ปัญหา 2: Node Address ไม่ตรงกัน
**ตรวจสอบ:**
- ดู address จาก Serial Monitor: `Node address: 0x0002`
- ใช้ address เดียวกันในคำสั่ง: `"node_addr":2` (2 decimal = 0x0002 hex)

### ปัญหา 3: BLE Mesh ไม่ได้เชื่อมต่อ
**วิธีแก้:**
1. ตรวจสอบว่า Gateway และ Endpoint อยู่ใกล้กัน
2. ตรวจสอบว่า Gateway เชื่อม WiFi แล้ว (ไฟน้ำเงินติดค้าง)
3. Re-provision Endpoint ใหม่

### ปัญหา 4: MQTT ไม่ทำงาน
**ตรวจสอบ:**
```powershell
# ตรวจสอบ Mosquitto ทำงาน
Get-Service mosquitto

# ถ้าไม่ทำงาน
net start mosquitto
```

### ปัญหา 5: Backend ไม่ทำงาน
**ตรวจสอบ:**
```powershell
cd backend/server
npm start
```

### ปัญหา 6: NeoPixel Hardware ชำรุด
**ทดสอบ:**
เพิ่มโค้ดทดสอบใน `app_main()`:
```c
// Test NeoPixel at startup
neopixel_set_color(255, 0, 0);  // Red
vTaskDelay(pdMS_TO_TICKS(1000));
neopixel_set_color(0, 255, 0);  // Green
vTaskDelay(pdMS_TO_TICKS(1000));
neopixel_set_color(0, 0, 255);  // Blue
vTaskDelay(pdMS_TO_TICKS(1000));
neopixel_off();
```

---

## 📊 ตัวอย่าง Log ที่ถูกต้อง

### Gateway Log:
```
I (12345) GATEWAY: WiFi connected
I (12346) GATEWAY: Got IP:172.20.10.5
I (12347) GATEWAY: MQTT_EVENT_CONNECTED
I (12348) GATEWAY: Provisioning complete
I (12349) GATEWAY: Node address: 0x0001
I (45678) GATEWAY: MQTT_EVENT_DATA
I (45679) GATEWAY: TOPIC=smart-storage/command
I (45680) GATEWAY: DATA={"node_addr":2,"led_state":true}
I (45681) GATEWAY: Sending LED command to node 0x0002: ON
```

### Endpoint Log:
```
I (23456) ENDPOINT_NODE: Provisioning complete
I (23457) ENDPOINT_NODE: Node address: 0x0002
I (56789) ENDPOINT_NODE: Generic server recv set msg: onoff=1
I (56790) ENDPOINT_NODE: Location indicator ON
I (56791) ENDPOINT_NODE: Location indicator ON (from BLE Mesh)
```

---

## ✅ Checklist การตรวจสอบ

- [ ] Mosquitto MQTT Broker ทำงาน
- [ ] Backend Server ทำงาน (port 3000)
- [ ] Gateway เชื่อม WiFi (ไฟน้ำเงินติดค้าง)
- [ ] Gateway เชื่อม MQTT
- [ ] Endpoint ถูก Provision แล้ว
- [ ] Endpoint มี Node Address (เช่น 0x0002)
- [ ] ส่งคำสั่งด้วย Node Address ที่ถูกต้อง
- [ ] Gateway ส่งคำสั่ง BLE Mesh
- [ ] Endpoint ได้รับคำสั่ง BLE Mesh
- [ ] `location_indicator_active` เปลี่ยนเป็น `true`
- [ ] LED State เปลี่ยนเป็น `LED_STATE_LOCATION_INDICATOR`
- [ ] NeoPixel ติดสีเขียว

---

## 🔧 คำสั่ง Debug เพิ่มเติม

### เพิ่ม Debug Log ใน generic_server_cb:
```c
static void generic_server_cb(esp_ble_mesh_generic_server_cb_event_t event, esp_ble_mesh_generic_server_cb_param_t *param)
{
    ESP_LOGI(TAG, "=== GENERIC SERVER CALLBACK ===");
    ESP_LOGI(TAG, "Event: %d", event);
    
    switch (event) {
    case ESP_BLE_MESH_GENERIC_SERVER_STATE_CHANGE_EVT:
        ESP_LOGI(TAG, "STATE CHANGE: onoff=%d", onoff_server.state.onoff);
        location_indicator_active = onoff_server.state.onoff;
        ESP_LOGI(TAG, "location_indicator_active = %d", location_indicator_active);
        reset_sleep_timer();
        break;
    case ESP_BLE_MESH_GENERIC_SERVER_RECV_SET_MSG_EVT:
        ESP_LOGI(TAG, "RECV SET MSG: onoff=%d", onoff_server.state.onoff);
        location_indicator_active = onoff_server.state.onoff;
        ESP_LOGI(TAG, "location_indicator_active = %d", location_indicator_active);
        reset_sleep_timer();
        break;
    default:
        ESP_LOGI(TAG, "Unknown event: %d", event);
        break;
    }
}
```

### เพิ่ม Debug Log ใน led_control_task:
```c
static void led_control_task(void *pvParameters)
{
    while (1) {
        ESP_LOGI(TAG, "=== LED CONTROL TASK ===");
        ESP_LOGI(TAG, "location_indicator_active = %d", location_indicator_active);
        ESP_LOGI(TAG, "current_led_state = %d", current_led_state);
        ESP_LOGI(TAG, "onoff_server.state.onoff = %d", onoff_server.state.onoff);
        
        // ... rest of code
    }
}
```

