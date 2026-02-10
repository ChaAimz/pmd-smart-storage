# PMD Smart Storage Device - Agent Guide

This document provides comprehensive information for AI coding agents working on the Smart Storage Device project. This is an IoT warehouse management system that integrates BLE Mesh devices, MQTT messaging, backend inventory services, and a web dashboard.

## Project Overview

Smart Storage Device is a complete warehouse inventory management platform consisting of:

- **Frontend**: React-based web dashboard for warehouse operations
- **Backend**: Node.js API server with MQTT integration and SQLite database
- **Firmware**: ESP32-C6 firmware for gateway and endpoint nodes using ESP-IDF
- **Hardware**: ESP32-C6 based BLE Mesh network for physical item tracking

### System Architecture

```
┌─────────────────┐      HTTP      ┌──────────────────────────────────┐
│ React Frontend  │ ←────────────→ │  Node.js Backend + SQLite        │
│   (Port 5173)   │                │  (Port 3001)                     │
└─────────────────┘                └──────────────┬───────────────────┘
                                                   │ MQTT
                                                   ↓
                                            ┌──────────────┐
                                            │ MQTT Broker  │
                                            │  (Port 1883) │
                                            └──────┬───────┘
                                                   │ Wi-Fi
                                                   ↓
                                            ┌──────────────┐
                                            │ ESP32-C6     │
                                            │ Gateway Node │
                                            └──────┬───────┘
                                                   │ BLE Mesh
                                                   ↓
                                            ┌──────────────┐
                                            │ ESP32-C6     │
                                            │ Endpoints    │
                                            └──────────────┘
```

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 19.1.1 |
| Frontend | TypeScript | 5.9.3 |
| Frontend | Vite | 7.1.7 |
| Frontend | Tailwind CSS | 3.4.18 |
| Frontend | Radix UI / shadcn/ui | Latest |
| Backend | Node.js | 18+ |
| Backend | Express | 4.18.2 |
| Backend | SQLite3 | 5.1.6 |
| Backend | MQTT.js | 5.3.0 |
| Backend | Winston | 3.11.0 |
| Firmware | ESP-IDF | v5.1+ |
| Firmware | ESP32-C6 | - |
| Messaging | Mosquitto MQTT | - |

## Project Structure

```
pmd-smart-storage/
├── frontend/                  # React + Vite dashboard
│   ├── src/
│   │   ├── components/        # UI components (layout, ui)
│   │   ├── contexts/          # React contexts (Auth, Page)
│   │   ├── hooks/             # Custom hooks (use-toast)
│   │   ├── lib/               # Utility functions
│   │   ├── pages/             # Page components
│   │   ├── services/          # API client
│   │   └── styles/            # CSS styles
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── backend/
│   └── server/                # Node.js API server
│       ├── src/
│       │   ├── services/      # Business logic
│       │   ├── database.js    # SQLite wrapper
│       │   ├── index.js       # Main server entry
│       │   ├── seed.js        # Database seeding
│       │   └── seedData.js    # Seed data
│       ├── data/              # SQLite database files
│       ├── package.json
│       └── .env.example
│
├── firmware/
│   ├── endpoint-node/         # ESP32-C6 endpoint firmware
│   │   ├── main/
│   │   │   ├── main.c         # Main application
│   │   │   ├── mesh_storage.c # NVS storage for mesh data
│   │   │   └── mesh_storage.h
│   │   └── CMakeLists.txt
│   │
│   └── gateway-node/          # ESP32-C6 gateway firmware
│       ├── main/
│       │   ├── main.c         # Main gateway application
│       │   ├── web_server.c   # WiFi configuration portal
│       │   ├── wifi_manager.c # WiFi management
│       │   └── mesh_storage.c
│       └── CMakeLists.txt
│
├── docs/
│   ├── firmware/              # ESP-IDF setup guides
│   ├── hardware/              # BOM and hardware setup
│   ├── mqtt/                  # Mosquitto configuration
│   ├── provisioning/          # BLE Mesh provisioning
│   └── testing/               # System testing guides
│
├── scripts/                   # Utility scripts
│   ├── build/                 # Build scripts
│   ├── test/                  # Testing scripts
│   ├── check/                 # Status check scripts
│   ├── reset/                 # Reset/provisioning scripts
│   └── docker/                # Docker deployment scripts
└── README.md
```

## Build and Development Commands

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run ESLint
npm run lint
```

### Backend

```bash
cd backend/server

# Install dependencies
npm install

# Start server
npm start

# Start with auto-reload (requires nodemon)
npm run dev

# Seed database with demo data
npm run seed

# Run tests
npm test

# Run ESLint
npm run lint
```

### Firmware (ESP-IDF)

```bash
# Gateway Node
cd firmware/gateway-node

# Set target (first time only)
idf.py set-target esp32c6

# Build
idf.py build

# Flash to device
idf.py -p COM3 flash

# Monitor serial output
idf.py -p COM3 monitor

# Flash and monitor combined
idf.py -p COM3 flash monitor

# Clean build
idf.py fullclean

# Erase all flash (includes provisioning data)
idf.py -p COM3 erase-flash
```

### PowerShell Build Scripts

```powershell
# Build and flash both gateway and endpoint
.\scripts\build\rebuild-all.ps1

# Build only gateway
.\scripts\build\rebuild-all.ps1 -GatewayOnly

# Build only endpoint
.\scripts\build\rebuild-all.ps1 -EndpointOnly

# Erase flash and rebuild (requires re-provisioning)
.\scripts\build\rebuild-all.ps1 -EraseFlash

# Specify custom ports
.\scripts\build\rebuild-all.ps1 -GatewayPort COM5 -EndpointPort COM6
```

## Configuration

### Frontend Environment Variables

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001/api
```

### Backend Environment Variables

Create `backend/server/.env` (copy from `.env.example`):

```env
# Server Configuration
PORT=3001
NODE_ENV=development
LOG_LEVEL=info

# MQTT Configuration
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_CLIENT_ID=smart-storage-server

# Database Configuration
DATABASE_PATH=./data/warehouse.db

# API Configuration
API_PREFIX=/api
```

### Firmware Configuration

Gateway MQTT broker URL in `firmware/gateway-node/main/main.c`:

```c
#define MQTT_BROKER_URL "mqtt://YOUR_PC_IP:1883"
```

Replace `YOUR_PC_IP` with your PC's actual IP address.

## API Endpoints

### Health & Status
- `GET /health` - Server health check

### Authentication
- `POST /api/auth/login` - User login

### Items
- `GET /api/items` - Get all items
- `GET /api/items/search?q={query}` - Search items
- `GET /api/items/low-stock` - Get low stock alerts
- `POST /api/items` - Create new item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item

### Locations
- `GET /api/locations` - Get all locations
- `GET /api/locations/:address` - Get location by address
- `POST /api/locations` - Create location
- `PUT /api/locations/:address` - Update location
- `POST /api/locations/:address/led` - Control LED at location

### Transactions
- `GET /api/transactions` - Get transaction history
- `POST /api/transactions` - Create transaction

### Purchase Requisitions (PR)
- `GET /api/prs` - Get all PRs for user's store
- `POST /api/prs` - Create new PR (status: ordered)
- `GET /api/prs/:id` - Get PR details
- `GET /api/prs/:id/export` - Export PR to Excel
- `POST /api/prs/:id/receive` - Receive goods with PO number

### Statistics
- `GET /api/stats` - Get dashboard statistics

## MQTT Topics

### Published by Gateway
| Topic | Description | Payload Example |
|-------|-------------|-----------------|
| `smart-storage/status` | Gateway status | `{"type":"gateway","status":"online"}` |
| `smart-storage/button` | Button press events | `{"node_addr":1,"event":"button_press","timestamp":1234567890}` |

### Subscribed by Gateway
| Topic | Description | Payload Example |
|-------|-------------|-----------------|
| `smart-storage/command` | LED control commands | `{"node_addr":1,"led_state":true}` |

## Database Schema

### Key Tables
- **users** - Authentication and user profiles
- **items** - Inventory items with SKU, quantity, reorder points
- **locations** - Physical storage locations with node addresses
- **item_locations** - Many-to-many relationship between items and locations
- **stock_transactions** - History of receive, pick, adjust operations
- **purchase_orders** - Supplier orders for restocking
- **pick_events** - Hardware button press events
- **gateway_status** - Gateway connection status

## Code Style Guidelines

### Frontend (TypeScript/React)

1. **Import Order**:
   - React imports first
   - External libraries second
   - Internal components with `@/` alias third
   - Types and utilities last

2. **Component Pattern**:
   ```typescript
   import { useState } from 'react'
   import { Card } from '@/components/ui/card'
   import { cn } from '@/lib/utils'
   
   interface Props {
     className?: string
   }
   
   export function Component({ className }: Props) {
     return <Card className={cn('base-classes', className)} />
   }
   ```

3. **Styling**:
   - Use Tailwind CSS utility classes exclusively
   - Use `cn()` utility for conditional class merging
   - Reference CSS variables for theming

4. **Path Aliases**:
   - `@/` maps to `./src`
   - Configured in `vite.config.ts` and `tsconfig.json`

5. **UI Consistency Memory (Important)**:
   - Frontend visual rules and page-level UI memory are maintained in `frontend/AGENTS.md`.
   - For `Manage Items`, keep the locked header pattern and chip/filter styles defined there.
   - Use shadcn/ui components as default references for all dashboard UI work.

5. **UI Style Memory (Shadcn Standard)**:
   - Use **shadcn/ui components** as the primary building blocks for page UI.
   - Summary/status cards must follow a single shared pattern via `frontend/src/components/ui/status-card.tsx`.
   - Status card pattern: neutral border (`border-border/70`), same internal spacing, icon + title in header line, value line (`text-2xl`), helper text (`text-xs`).
   - Apply the same status-card visual pattern across pages (Receive, Pick, Adjust, Inventory Planning, Dashboard and future pages with summary cards).
   - Keep quick-action button size consistent with compact pattern used in operations pages (`h-7 px-2.5 text-xs`) unless there is a deliberate exception.
   - Keep page spacing consistent with full-content pages using the shared layout spacing pattern already established in `Layout.tsx`.

5. **UI Design Baseline (Required)**:
   - Default UI direction for new pages or redesigns is **shadcn/ui dashboard style** (similar to `/receive` redesign).
   - Prioritize clear dashboard composition: KPI summary row, primary operational panels, and structured activity log.
   - Prefer local shadcn UI components in `frontend/src/components/ui/*` over custom raw markup.
   - Use `Card`, `Badge`, `Tabs`, `Table`, `Dialog`, `Button`, `Input`, `Select`, `Textarea` as first-choice primitives.
   - Use Receive spacing as the baseline page frame for content margin/padding:
     `px-2.5 pt-2.5 pb-1.5 lg:px-3.5 lg:pt-3.5 lg:pb-2.5`.
   - Keep visual language consistent: subtle gradient backgrounds, strong hierarchy, and compact operational spacing.
   - For UI tasks, follow the project skill at `skills/shadcn-dashboard-ui/SKILL.md`.

6. **Theme-Safe UI Styling (Required)**:
   - All actionable buttons in the same view must use one tone system from shadcn variants (`default`/`outline`/`secondary`), not mixed hardcoded colors.
   - Button sizes must follow a consistent page scale (for example `compact` list actions vs `dialog` footer actions), not ad-hoc per button.
   - Avoid hardcoded palette classes for reusable controls (`bg-blue-*`, `bg-emerald-*`, `border-sky-*`) when theme tokens are available.
   - Prefer semantic tokens so future theme switch is low-impact: `bg-background`, `text-foreground`, `border-border`, `border-input`, `bg-muted`.
   - If a compact button style is reused in a page, define shared class constants (for example `COMPACT_PRIMARY_BUTTON_CLASS`) and reuse them.
   - Chip/badge standard (all pages, including status columns): flat, no border (`border-0`), rounded-full, size `px-3 py-1 text-sm`.
   - Count-chip for dashboard/list headers: flat primary chip, no border, `bg-primary text-primary-foreground`.
   - Recommended default mapping for dashboard pages: `compact = h-7 px-2.5 text-xs`, `dialog/action = h-9 px-4`.
   - Table style baseline (all pages): follow `Manage Items` table style as canonical.
     - table wrapper: `rounded-lg border border-border/70 bg-background`
     - header: `sticky top-0 z-10 bg-muted/50 backdrop-blur-xl` with visible `border-b border-border`
     - body rows: `border-b border-border hover:bg-muted/50`
   - Prefer shared `frontend/src/components/ui/table.tsx` primitives; if raw `<table>` is used, mirror the same classes.

7. **Category Governance (Required)**:
   - Implement category as controlled master data (Settings sub-menu), not ad-hoc text.
   - Category deletion must be safe:
     - if referenced by items, block direct delete and require replacement migration first
     - allow delete only when no items reference it
   - Prefer deactivate/archive over immediate hard-delete for safer operations.
   - Use tags for flexible labeling/search only; keep core business logic dependent on controlled categories.
   - Use `/pick` page `Quick Pick` button as the visual size reference for compact quick-action buttons across pages.
   - Keep status highlighting (ETA/state badges) expressive, but isolate to status elements only; base layout/control surfaces stay theme-driven.

### Backend (JavaScript/Node.js)

1. **Module Pattern**: CommonJS (`require`/`module.exports`)
2. **Async Pattern**: Promises and async/await
3. **Error Handling**: Try-catch with Winston logging
4. **API Response Format**:
   ```javascript
   { success: boolean, data?: any, error?: string }
   ```

### Firmware (C/ESP-IDF)

1. **Naming**: Use snake_case for functions and variables
2. **Logging**: Use `ESP_LOGI()`, `ESP_LOGE()` macros with TAG
3. **Error Handling**: Check `esp_err_t` return values
4. **GPIO**: Define pin numbers as constants at file top
5. **NVS**: Use namespace `MESH_NVS_NAMESPACE` for mesh storage

## Testing Strategy

### Backend Testing
```bash
cd backend/server
npm test  # Runs Jest tests
```

### MQTT Testing
```powershell
# Subscribe to all topics
cd "C:\Program Files\mosquitto"
.\mosquitto_sub.exe -h localhost -t 'smart-storage/#' -v

# Publish test messages
.\mosquitto_pub.exe -h localhost -t 'smart-storage/button' -m '{"node_addr":1,"event":"button_press"}'
.\mosquitto_pub.exe -h localhost -t 'smart-storage/command' -m '{"node_addr":1,"led_state":true}'
```

### LED Testing (PowerShell)
```powershell
# Turn on LED at node address 2
.\scripts\test\test-led.ps1 -NodeAddress 2 -State on

# Turn off LED
.\scripts\test\test-led.ps1 -NodeAddress 2 -State off
```

### API Testing
```bash
# Health check
curl http://localhost:3001/health

# Get all items
curl http://localhost:3001/api/items

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## Default Credentials

After running `npm run seed` in the backend:

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Manager | manager | manager123 |
| Operator | operator | operator123 |

## Development Workflow

1. **Start MQTT Broker**: Ensure Mosquitto is running on port 1883
2. **Start Backend**: `cd backend/server && npm start`
3. **Start Frontend**: `cd frontend && npm run dev`
4. **Flash Firmware**: Use ESP-IDF to build and flash gateway/endpoint
5. **Provision Devices**: Use nRF Mesh app to provision BLE mesh network

## Key Domain Concepts

- **Item**: Product stored in warehouse (SKU, name, quantity, reorder point)
- **Location**: Physical storage location (node address, zone, shelf, row, column)
- **Transaction**: Stock movement (receive, pick, adjust)
- **Node Address**: Hex address of ESP32-C6 device in BLE Mesh (e.g., 0x0001)
- **Provisioning**: Adding device to BLE Mesh network with credentials

### PR (Purchase Requisition) Workflow

```
┌─────────────┐    Export Excel     ┌──────────────┐
│  Create PR  │ ─────────────────→ │    Send to   │
│   Status:   │                    │  Purchasing  │
│   ordered   │                    │   (External) │
└─────────────┘                    └──────────────┘
       │                                    │
       │                                    │ Purchase
       │                                    │ from Supplier
       │                                    ▼
       │                           ┌──────────────┐
       │                           │  Get PO No.  │
       │                           │   from Doc   │
       │                           └──────┬───────┘
       │                                  │
       ▼                                  ▼
┌─────────────┐    Enter PO Number     ┌──────────────┐
│   Receive   │ ←───────────────────  │   Goods      │
│   Goods     │    Actual Price       │   Arrived    │
└─────────────┘    Actual Qty         └──────────────┘
```

**PR Status Flow:**
- `ordered` → สร้าง PR สำเร็จ (พร้อมส่งให้จัดซื้อ)
- `partially_received` → รับของบางส่วน
- `fully_received` → รับครบแล้ว
- `cancelled` → ยกเลิก

**Key Points:**
- PR is internal document (no supplier at creation)
- PO number comes from supplier document (entered during receive)
- Actual price entered during receive (for FIFO costing)
- Approval workflow is external (outside software)

## Security Considerations

1. **Authentication**: JWT-like session stored in localStorage (frontend)
2. **Password Hashing**: bcryptjs used for password storage
3. **CORS**: Enabled for development (restrict in production)
4. **MQTT**: Anonymous access allowed for development (add auth for production)
5. **Input Validation**: Validate all API inputs (partially implemented)

## Common Issues and Solutions

### Frontend
- **Port 5173 in use**: Vite will auto-increment to next available port
- **API connection failed**: Check `VITE_API_URL` environment variable

### Backend
- **Database locked**: Ensure only one process accesses SQLite
- **MQTT connection failed**: Verify Mosquitto is running and accessible

### Firmware
- **"idf.py not recognized"**: Run ESP-IDF export script first
- **Port not found**: Check COM port with `[System.IO.Ports.SerialPort]::getportnames()`
- **Failed to connect**: Hold BOOT button while connecting USB

## Documentation References

| Topic | File |
|-------|------|
| Quick Start | `docs/guides/QUICK_START.md` |
| MQTT Setup | `docs/mqtt/README.md`, `docs/mqtt/mosquitto-setup.md` |
| Firmware Setup | `docs/firmware/esp-idf-setup.md` |
| BLE Mesh Provisioning | `docs/provisioning/guide.md` |
| Hardware Setup | `docs/hardware/setup.md`, `docs/hardware/bom.md` |
| System Testing | `docs/testing/complete-system-test.md` |
| Factory Reset | `docs/guides/FACTORY_RESET_GUIDE.md`, `docs/troubleshooting/FACTORY_RESET_IMPLEMENTATION.md` |
| BLE Mesh Storage | `docs/reference/BLE_MESH_STORAGE.md`, `docs/guides/MESH_STORAGE_GUIDE.md` |
| Frontend Guide | `frontend/AGENTS.md` |
| UI Design Skill | `skills/shadcn-dashboard-ui/SKILL.md` |
| UI Style Guide | `docs/reference/UI_STYLE_GUIDE.md` |

## Useful Commands Summary

```bash
# Development
npm install && npm run dev          # Frontend
npm install && npm start            # Backend
npm run seed                        # Seed database

# Firmware (ESP-IDF)
idf.py set-target esp32c6           # Set target (once)
idf.py build                        # Build
idf.py -p COM3 flash monitor        # Flash and monitor
idf.py fullclean                    # Clean build
idf.py -p COM3 erase-flash          # Erase all

# MQTT (PowerShell)
net start mosquitto                 # Start broker
.\mosquitto_sub.exe -h localhost -t '#' -v   # Subscribe all
.\mosquitto_pub.exe -h localhost -t 'test' -m 'hello'  # Publish

# PowerShell Scripts
.\scripts\build\rebuild-all.ps1                   # Build and flash all
.\scripts\test\test-led.ps1 -NodeAddress 2 -State on   # Test LED
```

## License

MIT License (declared in project metadata)
