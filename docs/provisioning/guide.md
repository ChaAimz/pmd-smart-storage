# Bluetooth Mesh Provisioning Guide

This guide explains how to provision ESP32-C6 nodes into the Bluetooth Mesh network for the Smart Storage system.

## Overview

Provisioning is the process of adding new devices to the Bluetooth Mesh network and configuring them with network credentials and addresses.

## Prerequisites

- **Hardware**: ESP32-C6 devices with firmware flashed
- **Mobile App**: nRF Mesh app ([Android](https://play.google.com/store/apps/details?id=no.nordicsemi.android.nrfmeshprovisioner) | [iOS](https://apps.apple.com/us/app/nrf-mesh/id1380726771))
- **Knowledge**: Basic understanding of Bluetooth Mesh concepts

## Network Architecture

```
┌─────────────────────────────────────────┐
│         Bluetooth Mesh Network          │
│                                         │
│  ┌──────────┐  ┌──────────┐            │
│  │ Gateway  │  │ Endpoint │            │
│  │ (0x0001) │  │ (0x0002) │  ...       │
│  └────┬─────┘  └────┬─────┘            │
│       │             │                   │
│       └─────────────┴──── Mesh ────────┤
└─────────────────────────────────────────┘
```

## Step-by-Step Provisioning

### 1. Prepare the Network

#### 1.1 Flash Firmware

Flash the appropriate firmware to each device:

**Gateway Node:**
```bash
cd firmware/gateway-node
idf.py -p /dev/ttyUSB0 flash
```

**Endpoint Nodes:**
```bash
cd firmware/endpoint-node
idf.py -p /dev/ttyUSB0 flash
```

#### 1.2 Power On Devices

- Power on the gateway (via USB/wall adapter)
- Power on endpoint nodes (via battery or USB for testing)
- Verify LED activity or check serial logs

### 2. Install nRF Mesh App

1. Download nRF Mesh app from App Store or Google Play
2. Open the app
3. Grant necessary permissions (Bluetooth, Location)

### 3. Create Mesh Network

#### 3.1 Create New Network

1. Open nRF Mesh app
2. Tap **"+"** → **"Create new network"**
3. Enter network name: `Smart Storage Network`
4. App generates:
   - Network Key
   - Application Key
   - IV Index

#### 3.2 Configure Network Settings

1. Go to **Settings** → **Network**
2. Note the network configuration:
   - **Network Key**: Auto-generated (keep secure)
   - **App Key**: Auto-generated
   - **IV Index**: 0x00000000 (initial value)

### 4. Provision Gateway Node

#### 4.1 Scan for Unprovisioned Devices

1. In nRF Mesh app, tap **Scanner** icon
2. Wait for devices to appear
3. Look for device with UUID starting with `DDDD`

#### 4.2 Provision the Gateway

1. Select the gateway device from the list
2. Tap **"IDENTIFY"** to verify (optional)
3. Tap **"PROVISION"**
4. Choose provisioning method: **"No OOB"**
5. Wait for provisioning to complete
6. Assign unicast address: **0x0001**
7. Tap **"OK"**

#### 4.3 Configure Gateway Elements

1. Select the provisioned gateway
2. Navigate to **Elements** → **Element 0**
3. Configure models:

**Configuration Server (Already bound)**
- Required for all nodes
- No additional configuration needed

**Generic OnOff Client**
- Tap the model
- Tap **"BIND APP KEY"** → Select App Key 1
- Configure **Publication**:
  - Address: **0xC000** (all-nodes group)
  - Period: None
  - TTL: 3
- Configure **Subscription**:
  - Address: **0xC000** (all-nodes group)

### 5. Provision Endpoint Nodes

Repeat for each endpoint (nodes 0x0002, 0x0003, ..., 0x01F4 for 500 nodes):

#### 5.1 Scan and Provision

1. Tap **Scanner** icon
2. Select next unprovisioned device (UUID: `DDDD...`)
3. Tap **"PROVISION"**
4. Choose **"No OOB"**
5. Assign sequential unicast address (0x0002, 0x0003, etc.)
6. Note the physical location of each node

#### 5.2 Configure Endpoint Elements

For each endpoint node:

1. Select the node
2. Navigate to **Elements** → **Element 0**
3. Configure **Generic OnOff Server**:
   - Tap the model
   - Tap **"BIND APP KEY"** → Select App Key 1
   - Configure **Publication**:
     - Address: **0xC000** (to gateway/all nodes)
     - Period: None
     - TTL: 3
   - Configure **Subscription**:
     - Address: Individual address (e.g., 0x0002 for node 2)
     - OR group address for batch control

### 6. Create Groups (Optional)

Groups allow controlling multiple endpoints simultaneously.

#### 6.1 Create Group

1. Go to **Groups** tab
2. Tap **"+"** → **"Create Group"**
3. Enter group name (e.g., "Zone A", "Shelf 1")
4. Assign group address: 0xC001, 0xC002, etc.

#### 6.2 Add Nodes to Group

1. Select a node
2. Navigate to **Elements** → **Element 0** → **Generic OnOff Server**
3. Tap **"SUBSCRIPTION"** → **"ADD GROUP"**
4. Select the desired group
5. Repeat for all nodes in the group

### 7. Verify Configuration

#### 7.1 Test Gateway → Endpoint

1. In nRF Mesh app, select gateway
2. Navigate to **Generic OnOff Client**
3. Tap **"SEND"**
4. Set **ON** or **OFF**
5. Enter destination address (e.g., 0x0002)
6. Verify LED on endpoint responds

#### 7.2 Test Endpoint → Gateway

1. Press button on endpoint node
2. Check gateway serial logs for received message
3. Verify MQTT message is published (if backend connected)

## Address Allocation Plan

| Address Range | Usage | Count |
|---------------|-------|-------|
| 0x0001 | Gateway | 1 |
| 0x0002 - 0x01F5 | Endpoints | 500 |
| 0xC000 | All-nodes group | 1 |
| 0xC001 - 0xC010 | Custom groups (zones/shelves) | 16 |

## Network Configuration Summary

```json
{
  "network_name": "Smart Storage Network",
  "network_key": "AUTO_GENERATED",
  "app_key": "AUTO_GENERATED",
  "iv_index": "0x00000000",
  "gateway": {
    "address": "0x0001",
    "models": ["Config Server", "Generic OnOff Client"]
  },
  "endpoints": {
    "address_range": "0x0002 - 0x01F5",
    "models": ["Config Server", "Generic OnOff Server"]
  },
  "groups": {
    "all_nodes": "0xC000",
    "custom_groups": "0xC001 - 0xC010"
  }
}
```

## Provisioning at Scale

For provisioning 200-500 nodes efficiently:

### Batch Provisioning Strategy

1. **Prepare in batches**: Flash 10-20 nodes at once
2. **Label immediately**: Mark each node with its address
3. **Provision sequentially**: Use auto-increment address feature
4. **Document location**: Create mapping file (address → location)
5. **Test batch**: Verify each batch before installation

### Location Mapping Template

Create a CSV file to track node locations:

```csv
Address,Zone,Shelf,Row,Column,Notes
0x0002,A,1,1,1,Top left corner
0x0003,A,1,1,2,Next to 0x0002
0x0004,A,1,1,3,
...
```

### Automation Script (Future)

Consider developing automation tools:
- Bulk provisioning via ESP-IDF
- Automated configuration scripts
- Address-to-location database sync

## Troubleshooting

### Node Won't Provision

**Symptoms**: Device not appearing in scanner

**Solutions**:
- Verify device is powered on
- Check Bluetooth is enabled on phone
- Restart the device
- Move closer to the device
- Check serial logs for errors

### Provisioning Fails

**Symptoms**: Provisioning process hangs or fails

**Solutions**:
- Reset the node and retry
- Clear app cache and restart
- Verify network key is correct
- Check device logs for error codes

### Node Not Responding After Provisioning

**Symptoms**: LED doesn't respond to commands

**Solutions**:
- Verify app key binding
- Check publication/subscription settings
- Test with direct unicast address
- Review node configuration
- Check TTL settings (minimum 2, recommend 3)

### Gateway Not Forwarding Messages

**Symptoms**: Endpoints work but no MQTT messages

**Solutions**:
- Verify gateway Wi-Fi connection
- Check MQTT broker connectivity
- Review gateway serial logs
- Verify mesh message reception

## Best Practices

1. **Document Everything**: Keep detailed records of all addresses and locations
2. **Test Before Deploy**: Verify each node before physical installation
3. **Use Groups Wisely**: Organize nodes logically by zone/shelf
4. **Plan Addressing**: Reserve address ranges for future expansion
5. **Backup Configuration**: Export mesh network configuration regularly
6. **Label Hardware**: Physical labels on nodes matching addresses
7. **Staged Rollout**: Deploy in phases (gateway first, then zones)

## Maintenance

### Adding New Nodes

1. Follow standard provisioning procedure
2. Use next available address
3. Update location mapping
4. Add to appropriate groups
5. Test functionality

### Replacing Failed Nodes

1. Remove old node from network (app: Delete node)
2. Provision new node with same address
3. Configure with same settings
4. Verify functionality
5. Update documentation if needed

### Network Reset

If complete reset is needed:

1. **Backup data**: Export configuration from nRF Mesh app
2. **Factory reset nodes**: Re-flash firmware to all devices
3. **Delete network**: Remove from nRF Mesh app
4. **Start fresh**: Follow provisioning guide from step 3

## Security Considerations

- **Protect Network Key**: Never share network key publicly
- **Secure App Key**: Keep application keys confidential
- **Physical Security**: Prevent unauthorized access to nodes
- **Regular Updates**: Keep firmware updated
- **Monitor Access**: Log all provisioning activities

## Next Steps

After provisioning:

1. [Configure Backend Server](../backend/setup.md)
2. [Set Up Monitoring Dashboard](../monitoring/dashboard.md)
3. [Create Inventory Database](../database/schema.md)
4. [Test End-to-End Flow](../testing/integration.md)

## Support

For issues not covered in this guide:
- Check ESP-IDF documentation
- Review nRF Mesh app user guide
- Consult Bluetooth SIG specifications
- Contact system administrator

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: Smart Storage Team