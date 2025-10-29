# Hardware Setup Guide

Complete hardware assembly and installation instructions for the Smart Storage system.

## Overview

This guide covers the physical assembly of endpoint nodes, gateway nodes, and system installation.

## Safety Precautions

⚠️ **Important Safety Information**

- **Battery Safety**: LiPo batteries can be dangerous if mishandled
  - Never puncture or crush batteries
  - Avoid short circuits
  - Store in fireproof container
  - Charge with appropriate charger only
  
- **Electrical Safety**:
  - Disconnect power before assembly
  - Check polarity before connecting batteries
  - Use proper tools and ESD protection

- **Soldering Safety**:
  - Work in ventilated area
  - Use proper temperature settings
  - Wear safety glasses

## Tools Required

### Basic Tools
- Soldering iron (adjustable temperature)
- Solder (lead-free recommended)
- Wire strippers
- Small screwdriver set
- Multimeter
- Hot glue gun (optional)

### Optional Tools
- Helping hands/PCB holder
- Solder sucker/wick
- Heat shrink tubing
- Label maker

## Bill of Materials

See [BOM document](bom.md) for complete parts list and pricing.

## Endpoint Node Assembly

### Step 1: Prepare Components

Gather components for one endpoint:
- 1× ESP32-C6-DevKitC-1
- 1× LiPo battery 4000mAh
- 1× LED (5mm)
- 1× Push button
- 1× 220Ω resistor
- 1× 10kΩ resistor
- Wire (AWG 24)
- Enclosure

### Step 2: LED Circuit

#### 2.1 Identify LED Polarity
- **Anode (+)**: Longer leg
- **Cathode (-)**: Shorter leg, flat side

#### 2.2 Connect LED

```
ESP32-C6 GPIO8 ──── 220Ω ──── LED Anode (+)
                                  │
                               LED Cathode (-)
                                  │
                                 GND
```

**Connections:**
1. Solder 220Ω resistor to LED anode
2. Connect resistor to ESP32-C6 GPIO8
3. Connect LED cathode to ESP32-C6 GND

### Step 3: Button Circuit

#### 3.1 Button Connections

```
                    10kΩ
ESP32-C6 3.3V ──────/\/\/\────┬──── ESP32-C6 GPIO9
                               │
                            Button
                               │
                              GND
```

**Connections:**
1. Connect one button terminal to GND
2. Connect other button terminal to GPIO9
3. Connect 10kΩ pull-up resistor between 3.3V and GPIO9

### Step 4: Battery Connection

⚠️ **Critical**: Check polarity before connecting!

**ESP32-C6 Power Pins:**
- **VCC/5V**: Battery positive (+)
- **GND**: Battery negative (-)

**Connection:**
1. Identify battery connector polarity
2. Connect battery positive to ESP32-C6 VCC
3. Connect battery negative to ESP32-C6 GND
4. Verify voltage with multimeter (should be 3.7-4.2V)

### Step 5: Testing

Before assembly in enclosure:

1. **Power Test**:
   ```bash
   # Connect via USB-C
   # Check serial output
   idf.py monitor
   ```

2. **LED Test**:
   - LED should be off initially
   - Press reset button
   - LED should blink once after provisioning

3. **Button Test**:
   - Press button
   - LED should flash briefly
   - Check serial output for "Button pressed!"

4. **Battery Test**:
   - Disconnect USB
   - Connect battery
   - Device should power on
   - Measure current draw (~10µA in deep sleep)

### Step 6: Enclosure Assembly

1. **Prepare Enclosure**:
   - Drill hole for LED (5mm)
   - Drill hole for button access
   - Optional: Add mounting holes

2. **Mount Components**:
   - Secure ESP32-C6 with screws or hot glue
   - Position LED in front hole
   - Position button for easy access
   - Secure battery with double-sided tape

3. **Cable Management**:
   - Organize wires neatly
   - Avoid strain on connections
   - Ensure battery can't short circuit

4. **Final Assembly**:
   - Close enclosure
   - Test button through case
   - Verify LED visibility
   - Label with node address

### Step 7: Labeling

Apply labels showing:
- Node address (e.g., "0x0002")
- Location zone/shelf
- QR code (optional, for tracking)

## Gateway Node Assembly

### Components
- 1× ESP32-C6-DevKitC-1
- 1× USB power adapter (5V 2A)
- 1× USB-C cable
- 1× Enclosure

### Assembly Steps

1. **No Additional Circuitry Required**:
   - Gateway uses ESP32-C6 as-is
   - Powered via USB (no battery)

2. **Enclosure Preparation**:
   - Drill hole for USB cable
   - Add ventilation holes
   - Optional: Status LED window

3. **Installation**:
   - Mount ESP32-C6 in enclosure
   - Route USB cable through hole
   - Close enclosure
   - Label as "GATEWAY"

4. **Testing**:
   ```bash
   # Configure WiFi in firmware first
   idf.py monitor
   # Verify WiFi connection
   # Verify MQTT connection
   ```

## Wiring Diagrams

### Endpoint Node Complete Schematic

```
                        ESP32-C6-DevKitC-1
                     ┌────────────────────┐
                     │                    │
        LiPo+ ───────┤ VCC            USB │──── USB-C (programming)
        LiPo- ───────┤ GND                │
                     │                    │
LED Anode ─── 220Ω ──┤ GPIO8              │
LED Cathode ─────────┤ GND                │
                     │                    │
Button Pin 1 ────────┤ GPIO9              │
                     │                    │
Button Pin 2 ────────┤ GND                │
   (10kΩ to 3.3V)    │                    │
                     │                    │
                     └────────────────────┘
```

### Pin Assignment Table

| Function | GPIO | Notes |
|----------|------|-------|
| LED | GPIO8 | Active HIGH |
| Button | GPIO9 | Active LOW with pull-up |
| Battery VCC | VCC/5V | 3.7-4.2V from LiPo |
| Battery GND | GND | Common ground |

## Installation

### Workspace Preparation

1. **Plan Layout**:
   - Map 15m × 10m area
   - Define zones (A, B, C, etc.)
   - Number shelves/rows/columns

2. **Mounting Options**:
   - **Adhesive tape**: Quick, removable
   - **Screws**: Permanent, secure
   - **Velcro**: Flexible, reusable
   - **Magnets**: For metal surfaces

### Installation Process

1. **Install Gateway First**:
   - Central location for best coverage
   - Near power outlet
   - Good WiFi signal
   - Label clearly

2. **Install Endpoint Nodes**:
   - Start from one corner
   - Work systematically (zone by zone)
   - Test each node after installation
   - Document location in spreadsheet

3. **Verify Coverage**:
   - Test button press from each node
   - Verify LED control works
   - Check for weak signal areas
   - Add relay nodes if needed

### Location Mapping

Create a CSV file tracking all installations:

```csv
Address,Zone,Shelf,Row,Column,Physical_Location,Install_Date
0x0002,A,1,1,1,"Top left corner",2024-01-15
0x0003,A,1,1,2,"Next to 0x0002",2024-01-15
```

## Testing Procedures

### Individual Node Test

```bash
# 1. Flash firmware
cd firmware/endpoint-node
idf.py -p /dev/ttyUSB0 flash

# 2. Monitor output
idf.py monitor

# 3. Check boot messages
# Should see: "Smart Storage Endpoint Node starting..."
# Should see: "BLE Mesh Node initialized"

# 4. Test deep sleep
# Wait 5 seconds - current should drop to ~10µA

# 5. Test button wake
# Press button - should wake and log event
```

### System Integration Test

```bash
# 1. Start backend server
cd backend/server
npm start

# 2. Provision all nodes (see provisioning guide)

# 3. Test end-to-end flow:
#    - Press button on endpoint
#    - Verify event in server logs
#    - Check database for event record

# 4. Test LED control:
curl -X POST http://localhost:3000/api/locations/0x0002/led \
  -H "Content-Type: application/json" \
  -d '{"state": "on"}'

# 5. Verify LED turns on at endpoint
```

## Troubleshooting

### LED Not Working

**Check:**
- LED polarity (anode to resistor, cathode to GND)
- Resistor value (220Ω)
- GPIO8 connection
- LED is not burned out (test with multimeter)

**Fix:**
- Reverse LED if backward
- Replace resistor if wrong value
- Re-solder GPIO8 connection

### Button Not Responding

**Check:**
- Button connections (one to GPIO9, one to GND)
- Pull-up resistor (10kΩ to 3.3V)
- Button is functional (test continuity)

**Fix:**
- Check for loose connections
- Verify pull-up resistor is installed
- Replace button if defective

### Device Won't Power On

**Check:**
- Battery voltage (should be 3.7-4.2V)
- Battery polarity (+ to VCC, - to GND)
- Battery protection circuit not tripped
- USB-C connection (for programming)

**Fix:**
- Charge battery if low
- Correct polarity if reversed
- Reset battery protection (disconnect for 30 seconds)

### High Current Draw

**Expected:**
- Deep sleep: ~10 µA
- Active (no LED): ~80 mA
- Active (LED on): ~100 mA

**If higher:**
- Check for short circuits
- Verify deep sleep is functioning
- Look for stuck loops in code
- Measure each component individually

### BLE Mesh Not Connecting

**Check:**
- Device is provisioned
- Bluetooth is enabled on phone
- Device is in range of gateway
- No interference from other devices

**Fix:**
- Re-provision the device
- Move closer to gateway
- Check gateway is functioning
- Review mesh configuration

## Maintenance

### Regular Checks

**Monthly:**
- Check battery voltage (should be >3.5V)
- Test button responsiveness
- Verify LED brightness
- Check enclosure integrity

**Quarterly:**
- Deep clean (dust removal)
- Tighten loose connections
- Update firmware if available
- Verify location labels

**Annually:**
- Replace batteries showing low voltage
- Test all nodes thoroughly
- Update documentation
- Plan for expansion

### Battery Replacement

1. **Power Off**:
   - Let device enter deep sleep
   - Wait 10 seconds

2. **Disconnect Old Battery**:
   - Open enclosure
   - Disconnect battery connector
   - Remove old battery

3. **Install New Battery**:
   - Check polarity
   - Connect new battery
   - Verify device boots

4. **Test**:
   - Press button
   - Verify LED works
   - Check serial output

5. **Dispose**:
   - Recycle old battery properly
   - Follow local regulations

### Firmware Updates

```bash
# 1. Connect via USB-C
# 2. Flash new firmware
cd firmware/endpoint-node
git pull  # Get latest version
idf.py build flash

# 3. Verify operation
idf.py monitor

# 4. Disconnect USB
# 5. Verify battery operation
```

## Best Practices

1. **Documentation**:
   - Keep detailed installation records
   - Photo document installations
   - Maintain node address database

2. **Quality Control**:
   - Test every node before installation
   - Use consistent assembly methods
   - Label everything clearly

3. **Future-Proofing**:
   - Reserve addresses for expansion
   - Install extra nodes in problem areas
   - Plan for easy maintenance access

4. **Safety**:
   - Use proper battery storage
   - Follow ESD precautions
   - Keep tools organized

## Support Resources

- [ESP32-C6 Datasheet](https://www.espressif.com/sites/default/files/documentation/esp32-c6_datasheet_en.pdf)
- [ESP-IDF Programming Guide](https://docs.espressif.com/projects/esp-idf/en/latest/)
- [Bluetooth Mesh Specification](https://www.bluetooth.com/specifications/specs/mesh-protocol/)
- [Project GitHub Repository](https://github.com/your-repo/smart-storage)

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: Smart Storage Team