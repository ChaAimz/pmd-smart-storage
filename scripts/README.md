# Scripts Directory

This directory contains utility scripts for building, testing, and managing the Smart Storage project.

## 📁 Directory Structure

```
scripts/
├── build/          # Build scripts
├── check/          # Status checking scripts
├── docker/         # Docker deployment scripts
├── reset/          # Reset and provisioning scripts
└── test/           # Testing scripts
```

## 🔨 Build Scripts

| Script | Description |
|--------|-------------|
| [build-endpoint.ps1](build/build-endpoint.ps1) | Build ESP32 endpoint node firmware |
| [build-factory-reset.ps1](build/build-factory-reset.ps1) | Build factory reset firmware |
| [rebuild-all.ps1](build/rebuild-all.ps1) | Rebuild all firmware components |

## 🔍 Check Scripts

| Script | Description |
|--------|-------------|
| [check-mesh-status.ps1](check/check-mesh-status.ps1) | Check BLE Mesh network status |
| [check-model-bindings.ps1](check/check-model-bindings.ps1) | Check model bindings |
| [allow-local-dev-firewall.ps1](check/allow-local-dev-firewall.ps1) | Open Windows Firewall ports for frontend/backend |

## 🐳 Docker Scripts

| Script | Description |
|--------|-------------|
| [run-docker.sh](docker/run-docker.sh) | Run Docker containers locally |
| [export-images.sh](docker/export-images.sh) | Export images for Portainer |
| [docker-compose.yml](docker/docker-compose.yml) | Docker Compose (local build) |
| [docker-compose.portainer.yml](docker/docker-compose.portainer.yml) | Portainer (pre-built images) |
| [docker-compose.portainer-build.yml](docker/docker-compose.portainer-build.yml) | Portainer (build from source) |
| [README.md](docker/README.md) | Docker deployment guide |

## 🔄 Reset Scripts

| Script | Description |
|--------|-------------|
| [reset-provisioning.ps1](reset/reset-provisioning.ps1) | Reset device provisioning |

## 🧪 Test Scripts

| Script | Description |
|--------|-------------|
| [test-factory-reset.ps1](test/test-factory-reset.ps1) | Test factory reset functionality |
| [test-factory-reset-mqtt.ps1](test/test-factory-reset-mqtt.ps1) | Test factory reset via MQTT |
| [test-led.ps1](test/test-led.ps1) | Test LED control |
| [test-mesh-storage.ps1](test/test-mesh-storage.ps1) | Test mesh storage operations |
| [start-local-dev.ps1](test/start-local-dev.ps1) | Start backend + frontend for local testing |

## 🚀 Quick Start

### Build Firmware
```powershell
# Build endpoint node
.\scripts\build\build-endpoint.ps1

# Rebuild all
.\scripts\build\rebuild-all.ps1
```

### Run with Docker
```bash
# Run locally
.\scripts\docker\run-docker.sh

# Or use docker-compose
cd scripts/docker && docker-compose up -d
```

### Run Tests
```powershell
# Test LED control
.\scripts\test\test-led.ps1

# Test factory reset
.\scripts\test\test-factory-reset.ps1

# Start backend + frontend quickly
.\scripts\test\start-local-dev.ps1

# Or from project root via npm
npm run dev:test

# Open firewall for LAN access (run as Administrator)
npm run dev:firewall
```

### Check Status
```powershell
# Check mesh status
.\scripts\check\check-mesh-status.ps1
```

## 📝 Notes

- Most scripts require PowerShell (Windows) or can run with PowerShell Core (Linux/Mac)
- Docker scripts require Docker and Docker Compose installed
- Firmware build scripts require ESP-IDF v5.1+
