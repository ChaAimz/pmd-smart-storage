# PMD Smart Storage Device

End-to-end smart warehouse platform combining:

- ESP32-C6 endpoint nodes (LED + button) over Bluetooth Mesh
- ESP32-C6 gateway (BLE Mesh <-> MQTT bridge)
- Node.js backend API + SQLite
- React dashboard for inventory operations

The system is designed for real-time pick/receive workflows, inventory visibility, and physical location indication in storage areas.

## Architecture

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

## Key Capabilities

- Inventory master data and stock transaction management
- Low-stock detection and purchase-order planning
- Location management mapped to mesh node addresses
- LED indication commands from API to physical endpoints
- MQTT event ingestion for button-press and gateway status
- Seed tooling for realistic demo datasets and users

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

## Quick Start (Local Development)

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

When `npm run seed` is executed in `backend/server`, the following demo users are available:

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

For backend deep-dive docs, see `backend/server/README.md`.

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

- Active backend database file: `backend/server/data/warehouse.db`
- Additional inventory DB file tracked in repository: `backend/server/data/inventory.db`

## Testing and Validation

- Full system test plan: `docs/testing/complete-system-test.md`
- MQTT helper scripts: `docs/mqtt/test-mqtt.ps1`

## Documentation Index

- Hardware: `docs/hardware/setup.md`, `docs/hardware/bom.md`
- MQTT: `docs/mqtt/README.md`, `docs/mqtt/mosquitto-setup.md`
- Provisioning: `docs/provisioning/guide.md`
- Firmware environment: `docs/firmware/esp-idf-setup.md`

## License

MIT (declared in project package metadata).
