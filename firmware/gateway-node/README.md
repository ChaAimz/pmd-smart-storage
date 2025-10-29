# Gateway Node Firmware

This firmware runs on an ESP32-C6 device that acts as a bridge between the Bluetooth Mesh network and the central server via Wi-Fi/MQTT.

## Features

- **Bluetooth Mesh to MQTT Bridge**: Forwards messages between mesh and cloud
- **Wi-Fi Connectivity**: Connects to local network
- **MQTT Client**: Publishes events and receives commands
- **Always On**: Powered by wall adapter (not battery)
- **Bidirectional Communication**: 
  - Endpoint → Gateway → Server (button presses)
  - Server → Gateway → Endpoint (LED control)

## Architecture

```
[Endpoint Nodes] ←→ [Gateway] ←→ [MQTT Broker] ←→ [Backend Server]
  (BLE Mesh)           (BLE+WiFi)      (Internet)      (Cloud/Local)
```

## Configuration

### Wi-Fi Settings

Edit [`main.c`](main/main.c:25) to configure your Wi-Fi:

```c
#define WIFI_SSID      "YOUR_WIFI_SSID"
#define WIFI_PASS      "YOUR_WIFI_PASSWORD"
```

### MQTT Settings

Edit [`main.c`](main/main.c:30) to configure MQTT broker:

```c
#define MQTT_BROKER_URL "mqtt://YOUR_MQTT_BROKER:1883"
```

## MQTT Topics

### Published Topics (Gateway → Server)

| Topic | Description | Payload Example |
|-------|-------------|-----------------|
| `smart-storage/status` | Gateway status | `{"type":"gateway","status":"online"}` |
| `smart-storage/button` | Button press events | `{"node_addr":1,"event":"button_press","timestamp":1234567890}` |

### Subscribed Topics (Server → Gateway)

| Topic | Description | Payload Example |
|-------|-------------|-----------------|
| `smart-storage/command` | LED control commands | `{"node_addr":1,"led_state":true}` |

## Message Formats

### Button Press Event

```json
{
  "node_addr": 1,
  "event": "button_press",
  "timestamp": 1234567890
}
```

### LED Control Command

```json
{
  "node_addr": 1,
  "led_state": true
}
```

- `node_addr`: Mesh address of the target endpoint (0x0001 - 0xFFFF)
- `led_state`: `true` to turn LED on, `false` to turn off

## Building and Flashing

### Prerequisites

- ESP-IDF v5.1 or later
- ESP32-C6 development board
- Wi-Fi access point
- MQTT broker (local or cloud)

### Build

```bash
cd firmware/gateway-node
idf.py set-target esp32c6
idf.py menuconfig  # Optional: configure WiFi/MQTT
idf.py build
```

### Flash

```bash
idf.py -p /dev/ttyUSB0 flash monitor
```

Replace `/dev/ttyUSB0` with your actual serial port.

## Hardware Setup

- **Power**: 5V USB or wall adapter (always on)
- **No GPIO required**: Gateway only handles network communication
- **Optional**: Status LED can be added on any free GPIO

## Network Flow

### Button Press (Endpoint → Server)

1. User presses button on endpoint node
2. Endpoint wakes from deep sleep
3. Endpoint sends BLE Mesh message
4. Gateway receives message via mesh
5. Gateway publishes to MQTT topic `smart-storage/button`
6. Server processes the event

### LED Control (Server → Endpoint)

1. Server publishes command to `smart-storage/command`
2. Gateway receives MQTT message
3. Gateway parses JSON payload
4. Gateway sends BLE Mesh message to specific node
5. Endpoint receives message and controls LED

## Provisioning

The gateway node must be provisioned into the mesh network:

1. Flash firmware and power on
2. Use nRF Mesh app to provision the gateway
3. Configure as a relay and proxy node
4. Set up publication/subscription for Generic OnOff model

## Troubleshooting

### Gateway won't connect to Wi-Fi

- Verify SSID and password in configuration
- Check Wi-Fi signal strength
- Review logs for specific error codes

### MQTT connection fails

- Verify broker URL and port
- Check network firewall rules
- Ensure broker is running and accessible

### Messages not forwarded

- Verify gateway is provisioned in mesh network
- Check that endpoints are also provisioned
- Review mesh network configuration
- Check MQTT subscription status

### High latency

- Reduce mesh network TTL (time-to-live)
- Position gateway centrally
- Ensure stable Wi-Fi connection
- Check MQTT broker performance

## Development

### Adding Custom Topics

Modify [`main.c`](main/main.c:30) to add more MQTT topics:

```c
#define MQTT_TOPIC_CUSTOM "smart-storage/custom"
```

Then subscribe in [`mqtt_event_handler`](main/main.c:155):

```c
esp_mqtt_client_subscribe(mqtt_client, MQTT_TOPIC_CUSTOM, 0);
```

### Custom Message Handling

Add handlers in the `MQTT_EVENT_DATA` case of [`mqtt_event_handler`](main/main.c:177).

## Performance

| Metric | Value |
|--------|-------|
| Wi-Fi throughput | ~10 Mbps |
| MQTT message rate | ~100 msg/sec |
| BLE Mesh nodes | Up to 500 |
| Latency | <100ms (typical) |
| Power consumption | ~200mA @ 5V |

## License

MIT