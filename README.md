# Smart Storage Device - Bluetooth Mesh Inventory Management System

## Project Overview

This project implements a Smart Storage system for managing 200-500 inventory items in a 15x10 meter area. Each storage endpoint has an LED for position indication and a button for pick confirmation.

## System Architecture

### Hardware Components

- **ESP32-C6 Microcontroller**: Main controller for each node
- **LED Indicator**: Position identification
- **Push Button**: Pick confirmation
- **LiPo Battery 4000mAh**: Power source with multi-year operation capability
- **Bluetooth Mesh Network**: Reliable wireless communication

### Network Structure

```
┌─────────────────────────────────────────────────────────┐
│                  Central Server                         │
│            (Inventory Management System)                │
└──────────────────────┬──────────────────────────────────┘
                       │ Wi-Fi/MQTT
                       │
                ┌──────▼──────┐
                │   Gateway   │
                │  (ESP32-C6) │
                └──────┬──────┘
                       │ Bluetooth Mesh
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
   │ Node 1  │   │ Node 2  │   │ Node N  │
   │ LED+Btn │   │ LED+Btn │   │ LED+Btn │
   └─────────┘   └─────────┘   └─────────┘
```

## Features

- ✅ **Long Battery Life**: Multi-year operation with 4000mAh battery
- ✅ **Scalable**: Easily add up to 500+ endpoints
- ✅ **Reliable**: Mesh network with automatic routing
- ✅ **Low Cost**: ESP32-C6 based solution
- ✅ **Energy Efficient**: Deep sleep mode with wake-on-button

## Project Structure

```
smart-storage-device/
├── firmware/
│   ├── endpoint-node/          # ESP32-C6 endpoint firmware
│   ├── gateway-node/            # ESP32-C6 gateway firmware
│   └── common/                  # Shared libraries
├── backend/
│   ├── server/                  # Central inventory server
│   └── api/                     # REST API endpoints
├── docs/
│   ├── hardware/                # Hardware specifications
│   ├── provisioning/            # Setup guides
│   └── architecture/            # System architecture
└── tools/
    └── provisioning/            # Configuration tools
```

## Getting Started

### Prerequisites

- ESP-IDF v5.1 or later
- Node.js v18+ (for backend)
- nRF Mesh mobile app (for provisioning)

### Hardware Requirements

- ESP32-C6-DevKitC-1 (or compatible)
- LED (3.3V compatible)
- Push button
- LiPo battery 4000mAh with protection circuit
- Resistors: 220Ω (LED), 10kΩ (pull-up)

## Quick Start

1. **Flash Endpoint Firmware**
   ```bash
   cd firmware/endpoint-node
   idf.py build flash monitor
   ```

2. **Flash Gateway Firmware**
   ```bash
   cd firmware/gateway-node
   idf.py build flash monitor
   ```

3. **Start Backend Server**
   ```bash
   cd backend/server
   npm install
   npm start
   ```

4. **Provision Network**
   - Use nRF Mesh app to provision nodes
   - Configure groups and publish/subscribe settings

## Documentation

- [Hardware Setup Guide](docs/hardware/setup.md)
- [Provisioning Guide](docs/provisioning/guide.md)
- [API Documentation](docs/api/README.md)
- [System Architecture](docs/architecture/overview.md)

## License

MIT License

## Contributors

Smart Storage Team