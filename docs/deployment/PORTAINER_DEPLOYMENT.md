# Portainer Stack Deployment Guide

คู่มือการ Deploy PMD Smart Storage ผ่าน Portainer

## วิธีที่ 1: สร้าง Stack ผ่าน Portainer Web Editor (แนะนำ)

### ขั้นตอนที่ 1: Build Images บนเครื่อง Server

```bash
# SSH เข้าเครื่องที่มี Portainer แล้วรันคำสั่งนี้

# Clone หรือ copy project ไปไว้บนเครื่อง
cd /path/to/pmd-smart-storage

# Build Backend
cd backend/server
docker build -t smart-storage-backend:latest .

# Build Frontend
cd ../../frontend
docker build -t smart-storage-frontend:latest .
```

### ขั้นตอนที่ 2: สร้าง Config Folder บน Portainer

```bash
# สร้าง folder สำหรับเก็บ config
sudo mkdir -p /portainer/Files/AppData/Config/smart-storage/mosquitto

# Copy mosquitto config
sudo cp /path/to/pmd-smart-storage/mosquitto/config/mosquitto.conf \
        /portainer/Files/AppData/Config/smart-storage/mosquitto/
```

### ขั้นตอนที่ 3: สร้าง Stack ใน Portainer

1. **เข้า Portainer** → เลือก Environment (เช่น Docker Local)
2. **ไปที่เมนู Stacks** → คลิก **"Add Stack"**
3. **ตั้งชื่อ Stack**: `smart-storage`
4. **เลือก Build method**: **Web editor**
5. **Copy เนื้อหาจาก `docker-compose.portainer.yml`** แล้ว Paste ลงใน Editor
6. **คลิก "Deploy the stack"**

---

## วิธีที่ 2: ใช้ Git Repository (Portainer Business Edition)

หากมี Portainer Business Edition หรือ Portainer CE ที่ enable Git feature:

1. **Stacks** → **Add Stack**
2. **Repository** → ใส่ Git URL
3. **Compose path**: `docker-compose.portainer.yml`
4. **Enable Automatic Updates** (optional)

---

## วิธีที่ 3: Upload Docker Compose File

1. **Stacks** → **Add Stack**
2. **Upload** → เลือกไฟล์ `docker-compose.portainer.yml`
3. **Deploy**

---

## การตั้งค่าที่สำคัญใน Portainer

### Environment Variables

หากต้องการแก้ไขค่าต่างๆ ไปที่ **Stacks** → **smart-storage** → **Editor**:

```yaml
environment:
  - PORT=3001                    # เปลี่ยน port  backend
  - MQTT_BROKER_URL=mqtt://mosquitto:1883
  - DATABASE_PATH=./data/warehouse.db
```

หรือใช้ **Environment variables section** ใน Portainer:

| Variable | Value | Description |
|----------|-------|-------------|
| `BACKEND_PORT` | `3001` | Port ของ backend |
| `FRONTEND_PORT` | `8080` | Port ของ frontend |
| `MQTT_PORT` | `1883` | Port ของ MQTT |

### Volume Management

ข้อมูลจะถูกเก็บใน Docker Volumes:

| Volume | ข้อมูลที่เก็บ | Backup |
|--------|--------------|--------|
| `backend-data` | SQLite database | สำคัญ |
| `mosquitto-data` | MQTT persistence | ไม่สำคัญมาก |
| `mosquitto-logs` | MQTT logs | ไม่สำคัญ |

ดู Volume ได้ที่: **Volumes** → ค้นหา `smart-storage`

---

## การเข้าถึง Services

หลัง Deploy สำเร็จ:

| Service | URL | หมายเหตุ |
|---------|-----|----------|
| Frontend | `http://<server-ip>:8080` | Dashboard |
| Backend API | `http://<server-ip>:3001/api` | REST API |
| Health Check | `http://<server-ip>:3001/health` | Status |
| MQTT | `mqtt://<server-ip>:1883` | MQTT Broker |

### การใช้ Domain Name (Nginx Proxy Manager)

หากใช้ Nginx Proxy Manager ร่วมกับ Portainer:

1. **Proxy Hosts** → **Add Proxy Host**
2. **Domain Names**: `smart-storage.yourdomain.com`
3. **Forward Hostname/IP**: `smart-storage-frontend`
4. **Forward Port**: `80`
5. **Block Common Exploits**: ✅ Enable
6. **SSL** → Request new certificate

---

## การจัดการ Stack

### หยุด Stack

```
Stacks → smart-storage → Stop this stack
```

### อัปเดต Stack

หลังจากแก้ไข `docker-compose.portainer.yml`:

```
Stacks → smart-storage → Editor → แก้ไข → Update the stack
```

หรือหาก build image ใหม่:

```bash
# บน server
docker build -t smart-storage-backend:latest ./backend/server
docker build -t smart-storage-frontend:latest ./frontend

# แล้วใน Portainer
Stacks → smart-storage → Restart stack
```

### ดู Logs

```
Stacks → smart-storage → คลิกที่ container → Logs
```

หรือ **Container** → เลือก container → **Logs**

---

## Troubleshooting

### 1. Container ไม่ start

ตรวจสอบที่ **Container** → เลือก container → **Inspect** → **State**

### 2. Backend ไม่ connect MQTT

ตรวจสอบ:
- Mosquitto container รันอยู่หรือไม่
- Network `smart-storage-network` ถูกสร้างหรือไม่

### 3. Database error

ตรวจสอบ volume mount:
```
Volumes → backend-data → Inspect
```

### 4. ลบ Stack แล้ว Deploy ใหม่

```
Stacks → smart-storage → Delete this stack
# รอให้ลบเสร็จ แล้ Deploy ใหม่
```

**หากต้องการลบข้อมูลทั้งหมด**:
```
Volumes → เลือก volumes ที่เกี่ยวข้อง → Remove
```

---

## สรุป File ที่ต้องใช้ใน Portainer

```
pmd-smart-storage/
├── docker-compose.portainer.yml    # ใช้สร้าง Stack
├── mosquitto/
│   └── config/
│       └── mosquitto.conf          # วางที่ /portainer/Files/AppData/Config/smart-storage/mosquitto/
├── backend/server/                 # Build image ก่อน
│   └── Dockerfile
└── frontend/                       # Build image ก่อน
    └── Dockerfile
```

## Tips

1. **กำหนด Resources**: ไปที่ **Container** → **Edit** → **Resources** ตั้ง Limit CPU/Memory
2. **Auto-restart**: Container จะ restart อัตโนมัติหาก crash (restart: always)
3. **Backup**: สำรอง volume `backend-data` เป็นประจำ
4. **Updates**: ใช้ **Image** → **Pull latest image** เมื่อมีการอัปเดต

---

## ตัวอย่าง Docker Compose สำหรับ Portainer

```yaml
version: '3.8'

services:
  mosquitto:
    image: eclipse-mosquitto:2
    container_name: smart-storage-mosquitto
    restart: always
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - /portainer/Files/AppData/Config/smart-storage/mosquitto:/mosquitto/config:ro
      - mosquitto-data:/mosquitto/data
      - mosquitto-logs:/mosquitto/log
    networks:
      - smart-storage-network

  backend:
    image: smart-storage-backend:latest
    container_name: smart-storage-backend
    restart: always
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - MQTT_BROKER_URL=mqtt://mosquitto:1883
    volumes:
      - backend-data:/app/data
    networks:
      - smart-storage-network
    depends_on:
      - mosquitto

  frontend:
    image: smart-storage-frontend:latest
    container_name: smart-storage-frontend
    restart: always
    ports:
      - "8080:80"
    networks:
      - smart-storage-network
    depends_on:
      - backend

volumes:
  mosquitto-data:
  mosquitto-logs:
  backend-data:

networks:
  smart-storage-network:
    driver: bridge
```
