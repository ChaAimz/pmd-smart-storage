# BLE Mesh Implementation Summary

This document provides a summary of the BLE Mesh implementation in the `firmware` directory, covering both the Endpoint Node and the Gateway Node.

## Overview

The project implements a BLE Mesh network where:
*   **Endpoint Nodes** act as low-power battery-operated devices (sensors/actuators). They send button press events and receive LED control commands.
*   **Gateway Node** bridges the BLE Mesh network to a central server via WiFi and MQTT. It receives button presses from endpoints and sends commands to them.

Both nodes use a custom `mesh_storage` component to persist provisioning data, model bindings, and publication settings in NVS (Non-Volatile Storage), ensuring the network configuration survives reboots.

## Directory Structure

```
firmware/
├── endpoint-node/      # Firmware for the battery-powered endpoint
│   └── main/
│       ├── main.c              # Main application logic
│       ├── mesh_storage.c      # NVS storage implementation
│       └── mesh_storage.h      # NVS storage header
└── gateway-node/       # Firmware for the WiFi/BLE Gateway
    └── main/
        ├── main.c              # Main application logic (WiFi, MQTT, Web UI)
        ├── mesh_storage.c      # NVS storage implementation (extended)
        └── mesh_storage.h      # NVS storage header
```

## Common Components

### `mesh_storage` (NVS Persistence)

Both nodes use this module to save and load BLE Mesh configuration.

**Key Functions:**
*   `mesh_storage_init()`: Initializes NVS.
*   `mesh_storage_save_prov_data()` / `load`: Saves/Loads provisioning data (Node Address, NetKey, AppKey, IV Index).
*   `mesh_storage_save_model_binding()` / `load`: Saves/Loads binding between Models and AppKeys.
*   `mesh_storage_save_pub_settings()` / `load`: Saves/Loads publication settings (Publish Address, TTL, Period).
*   `mesh_storage_clear()`: Erases all mesh-related data from NVS (Factory Reset).

## Endpoint Node

**Path:** `firmware/endpoint-node/main/main.c`

### Features
*   **Models**:
    *   `Generic OnOff Server`: Controls the "Location Indicator" LED.
    *   `Generic OnOff Client`: Sends button press events.
*   **Power Management**: Implements Deep Sleep, waking up on button press or periodic timer.
*   **Status Indication**: Uses NeoPixel and Red LED to show Battery Low, No Gateway, or Location Active status.

### Key Functions in `main.c`
*   `ble_mesh_init()`: Initializes BLE Mesh stack and models.
*   `provisioning_cb()`: Handles provisioning events. Saves data to NVS upon completion.
*   `config_server_cb()`: Handles configuration events (AppKey Add, Model Bind, Pub Set) and saves changes to NVS.
*   `generic_server_cb()`: Handles incoming LED control commands. Checks for "Factory Reset" command (value 2).
*   `check_factory_reset()`: Monitors the physical button for a long press (10s) to trigger factory reset.

## Gateway Node

**Path:** `firmware/gateway-node/main/main.c`

### Features
*   **Models**:
    *   `Generic OnOff Server`: Receives button presses from Endpoints.
    *   `Generic OnOff Client`: Sends LED control commands to Endpoints.
*   **Connectivity**:
    *   **WiFi**: Connects to a configurable WiFi network or creates an AP ("Smart-Storage-Gateway") for setup.
    *   **MQTT**: Connects to an MQTT broker to publish status/events and receive commands.
    *   **Web UI**: Embedded web server for status monitoring and WiFi configuration.
*   **Extended Storage**: `mesh_storage.c` includes `mesh_storage_save_subscription()` to manage subscription addresses.

### Key Functions in `main.c`
*   `ble_mesh_init()`: Initializes BLE Mesh. Auto-restores stack if provisioned, or enables provisioning if not.
*   `mqtt_app_start()`: Connects to the MQTT broker.
*   `mqtt_event_handler()`: Handles MQTT messages.
    *   **Topic**: `smart-storage/command`
    *   **Action**: Parses JSON to send BLE Mesh commands (LED Control or Factory Reset) to specific nodes.
*   `generic_server_cb()`: Receives button press messages from Endpoints and publishes them to MQTT (`smart-storage/button`).
*   `wifi_init_ap()` / `wifi_event_handler()`: Manages WiFi connections and the captive portal.
*   `start_webserver()`: Starts the HTTP server for the dashboard.

## NVS Key Namespace: "ble_mesh"

| Key | Description |
| :--- | :--- |
| `provisioned` | Boolean flag (1=Provisioned) |
| `node_addr` | Unicast Address of the node |
| `net_key`, `app_key` | 128-bit Network and Application Keys |
| `iv_index` | Current IV Index |
| `*_bound` | Model binding status (e.g., `onoff_srv_bound`) |
| `*_pub_addr` | Publication address for a model |
| `*_sub_addrs` | Subscription addresses (Gateway only) |
