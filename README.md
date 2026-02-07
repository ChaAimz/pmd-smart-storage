# PMD Smart Storage Device

[![Platform](https://img.shields.io/badge/Platform-IoT%20Warehouse-0A7EA4?style=for-the-badge)](https://github.com/ChaAimz/pmd-smart-storage)
[![Frontend](https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=111827)](frontend)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](backend/server)
[![MQTT](https://img.shields.io/badge/Messaging-MQTT-660066?style=for-the-badge&logo=eclipsemosquitto&logoColor=white)](docs/mqtt)
[![Firmware](https://img.shields.io/badge/Firmware-ESP32--C6-CC4B37?style=for-the-badge&logo=espressif&logoColor=white)](firmware)
[![Database](https://img.shields.io/badge/Database-SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](backend/server/data)
[![License](https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge)](#license)

Smart warehouse platform that integrates BLE Mesh devices, MQTT messaging, backend inventory services, and a web dashboard for day-to-day operations.

## Quick Navigation

- [System Architecture](#system-architecture)
- [Feature Overview](#feature-overview)
- [Tech Stack](#tech-stack)
- [Quick Start Local Development](#quick-start-local-development)
- [API Highlights](#api-highlights)
- [Firmware Workflow](#firmware-workflow-esp32-c6)
- [Documentation Index](#documentation-index)

## System Architecture

```text
[React Frontend] <----HTTP----> [Node.js Backend + SQLite]
                                      ^
                                      | MQTT
                                      v
                               [MQTT Broker]
                                      ^
                                      | Wi-Fi / MQTT
                                      v
                           [ESP32-C6 Gateway Node]
                                      ^
                                      | BLE Mesh
                                      v
                         [ESP32-C6 Endpoint Nodes]
```

## Feature Overview

| Domain | Capability |
| --- | --- |
| Inventory | Item master data, stock movements, transaction history |
| Planning | Low-stock detection and purchase-order creation |
| Location | Mapping items to physical mesh node addresses |
| Automation | LED indication commands from API to devices |
| Real-time | MQTT ingestion for button events and gateway status |
| Demo Ops | Seed scripts with realistic users and warehouse data |

## Runtime Snapshot

| Service | Default URL / Endpoint | Status |
| --- | --- | --- |
| Frontend | `http://localhost:5173` | ![Ready](https://img.shields.io/badge/Ready-Frontend-22C55E) |
| Backend | `http://localhost:3001` | ![Ready](https://img.shields.io/badge/Ready-API-22C55E) |
| Health Check | `http://localhost:3001/health` | ![Monitor](https://img.shields.io/badge/Monitor-Health-0EA5E9) |
| MQTT Broker | `mqtt://localhost:1883` | ![Broker](https://img.shields.io/badge/Broker-MQTT-8B5CF6) |

## Repository Structure

```text
smart-storage-device/
├── frontend/                  # React + Vite dashboard
├── backend/
│   └── server/                # Node.js API, MQTT integration, SQLite
├── firmware/
│   ├── endpoint-node/         # ESP32-C6 endpoint firmware
│   └── gateway-node/          # ESP32-C6 gateway firmware
├── docs/
│   ├── firmware/              # ESP-IDF setup
│   ├── mqtt/                  # Mosquitto setup and scripts
│   ├── provisioning/          # BLE Mesh provisioning guide
│   ├── hardware/              # Hardware setup and BOM
│   └── testing/               # End-to-end test guide
└── README.md
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind/Flowbite |
| Backend | Node.js, Express, MQTT.js, SQLite3 |
| Firmware | ESP-IDF (ESP32-C6), ESP BLE Mesh |
| Messaging | Mosquitto MQTT |

## Quick Start Local Development

### 1. Prerequisites

- Node.js 18+
- npm
- Mosquitto MQTT broker (local)
- ESP-IDF v5.1+ (only if building firmware)

### 2. Backend Setup

```bash
cd backend/server
npm install
cp .env.example .env
```

Recommended local config in `backend/server/.env`:

```env
PORT=3001
MQTT_BROKER_URL=mqtt://localhost:1883
NODE_ENV=development
LOG_LEVEL=info
```

Run backend:

```bash
npm start
```

Optional seed data:

```bash
npm run seed
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create/update `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001/api
```

Run frontend:

```bash
npm run dev
```

### 4. Verify Services

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:3001/health`
- API base: `http://localhost:3001/api`

## Default Seed Credentials

When `npm run seed` is executed in `backend/server`, demo users are:

- `admin / admin123`
- `manager / manager123`
- `operator / operator123`

## API Highlights

- `GET /health`
- `POST /api/auth/login`
- `GET /api/items`
- `GET /api/items/low-stock`
- `POST /api/transactions`
- `GET /api/locations`
- `POST /api/locations/:address/led`
- `POST /api/purchase-orders`

Backend deep-dive docs: `backend/server/README.md`

## Firmware Workflow (ESP32-C6)

### Endpoint Node

```bash
cd firmware/endpoint-node
idf.py set-target esp32c6
idf.py build
idf.py -p COMx flash monitor
```

### Gateway Node

```bash
cd firmware/gateway-node
idf.py set-target esp32c6
idf.py build
idf.py -p COMx flash monitor
```

More setup details:

- `docs/firmware/esp-idf-setup.md`
- `docs/provisioning/guide.md`
- `docs/mqtt/mosquitto-setup.md`

## Data and Persistence

- Active backend DB: `backend/server/data/warehouse.db`
- Additional tracked DB: `backend/server/data/inventory.db`

## Testing and Validation

- Full system test plan: `docs/testing/complete-system-test.md`
- MQTT helper scripts: `docs/mqtt/test-mqtt.ps1`

## Documentation Index

- Hardware: `docs/hardware/setup.md`, `docs/hardware/bom.md`
- MQTT: `docs/mqtt/README.md`, `docs/mqtt/mosquitto-setup.md`
- Provisioning: `docs/provisioning/guide.md`
- Firmware environment: `docs/firmware/esp-idf-setup.md`

## License

MIT (declared in project package metadata)
