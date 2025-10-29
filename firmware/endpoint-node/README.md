# Endpoint Node Firmware

This firmware runs on ESP32-C6 devices deployed at each storage location.

## Features

- **Bluetooth Mesh Networking**: Reliable mesh communication
- **Deep Sleep Mode**: Multi-year battery life with 4000mAh LiPo
- **Button Wake**: Instant wake from deep sleep on button press
- **LED Control**: Remote control via Bluetooth Mesh
- **Auto-sleep**: Enters deep sleep after 5 seconds of inactivity

## Hardware Connections

### ESP32-C6 Pin Configuration

| Component | GPIO | Description |
|-----------|------|-------------|
| LED | GPIO8 | Position indicator |
| Button | GPIO9 | Pick confirmation (active LOW) |
| Battery | VCC/GND | LiPo 4000mAh with protection |

### Circuit Diagram

```
                    ESP32-C6
                  ┌──────────┐
                  │          │
    Button ───────┤ GPIO9    │
    (Pull-up)     │          │
                  │          │
    LED ──────────┤ GPIO8    │
    (220Ω)        │          │
                  │          │
    LiPo+ ────────┤ VCC      │
    LiPo- ────────┤ GND      │
                  │          │
                  └──────────┘
```

## Building and Flashing

### Prerequisites

- ESP-IDF v5.1 or later
- ESP32-C6 development board

### Build

```bash
cd firmware/endpoint-node
idf.py set-target esp32c6
idf.py build
```

### Flash

```bash
idf.py -p /dev/ttyUSB0 flash monitor
```

Replace `/dev/ttyUSB0` with your actual serial port.

## Power Consumption

| Mode | Current | Duration | Energy |
|------|---------|----------|--------|
| Deep Sleep | ~10 µA | 99.9% | Minimal |
| Active (RX/TX) | ~80 mA | <0.1% | Low |
| LED On | +20 mA | Seconds | Low |

**Estimated battery life**: 2-3 years with 4000mAh battery (based on 10 activations/day)

## Configuration

Edit [`main.c`](main/main.c) to change:

- `LED_GPIO`: LED pin number (default: GPIO8)
- `BUTTON_GPIO`: Button pin number (default: GPIO9)
- `DEEP_SLEEP_TIMEOUT_MS`: Sleep timeout (default: 5000ms)

## Provisioning

1. Flash firmware to device
2. Power on the device
3. Use nRF Mesh app to provision:
   - Scan for unprovisioned devices
   - Select the device
   - Complete provisioning
   - Configure publish/subscribe settings

## Operation

### Normal Flow

1. Device boots → Initializes → Enters deep sleep
2. Button press → Wake up → Send message → Sleep
3. Receive LED command → Wake up → Turn LED on/off → Sleep

### LED Indication

- **Solid 1 second**: Provisioning successful
- **Brief flash**: Button press acknowledged
- **Stays on**: Remote command to indicate position

## Troubleshooting

### Device won't provision

- Check Bluetooth is enabled on phone
- Ensure device is powered and in range
- Try power cycling the device

### High power consumption

- Verify deep sleep is working (check logs)
- Check for wake locks or active timers
- Ensure GPIO configuration is correct

### Button not working

- Check pull-up resistor (10kΩ recommended)
- Verify GPIO9 is not used by other functions
- Test button continuity

## Development

### Adding Custom Models

Edit [`main.c`](main/main.c:38) to add more Bluetooth Mesh models:

```c
static esp_ble_mesh_model_t root_models[] = {
    ESP_BLE_MESH_MODEL_CFG_SRV(&config_server),
    ESP_BLE_MESH_MODEL_GEN_ONOFF_SRV(NULL, &onoff_server),
    // Add your custom model here
};
```

### Changing UUID

Modify the device UUID in [`main.c`](main/main.c:28):

```c
static uint8_t dev_uuid[16] = { 0xdd, 0xdd }; // Change this
```

## License

MIT