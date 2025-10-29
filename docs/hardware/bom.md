# Bill of Materials (BOM)

Complete hardware specifications and costs for the Smart Storage system.

## System Overview

- **Target Capacity**: 200-500 storage locations
- **Area Coverage**: 15m × 10m (150 m²)
- **Battery Life**: 2-3 years per endpoint
- **Network Type**: Bluetooth Mesh

## Components per Endpoint Node

| Component | Specification | Quantity | Unit Price (USD) | Total (USD) | Notes |
|-----------|---------------|----------|------------------|-------------|-------|
| **ESP32-C6-DevKitC-1** | Espressif development board | 1 | $4.00 | $4.00 | Main controller |
| **LiPo Battery** | 4000mAh 3.7V with protection | 1 | $6.00 | $6.00 | Power source |
| **LED** | 5mm, any color, 3.3V compatible | 1 | $0.05 | $0.05 | Position indicator |
| **Push Button** | Tactile switch, normally open | 1 | $0.10 | $0.10 | Pick confirmation |
| **Resistor 220Ω** | 1/4W, for LED current limiting | 1 | $0.01 | $0.01 | LED protection |
| **Resistor 10kΩ** | 1/4W, pull-up for button | 1 | $0.01 | $0.01 | Button debounce |
| **Enclosure** | Plastic case, 60×40×20mm | 1 | $0.50 | $0.50 | Protection |
| **Wire/Connectors** | AWG 24, JST connectors | 1 set | $0.30 | $0.30 | Assembly |
| **Labels** | Adhesive labels for addressing | 1 | $0.02 | $0.02 | Identification |
| | | | **Subtotal** | **$10.99** | **Per endpoint** |

## Components per Gateway Node

| Component | Specification | Quantity | Unit Price (USD) | Total (USD) | Notes |
|-----------|---------------|----------|------------------|-------------|-------|
| **ESP32-C6-DevKitC-1** | Espressif development board | 1 | $4.00 | $4.00 | Gateway controller |
| **USB Power Adapter** | 5V 2A, wall adapter | 1 | $3.00 | $3.00 | Continuous power |
| **USB Cable** | USB-C, 2m | 1 | $2.00 | $2.00 | Power connection |
| **Enclosure** | Plastic case, 80×60×30mm | 1 | $1.00 | $1.00 | Protection |
| | | | **Subtotal** | **$10.00** | **Per gateway** |

## System Costs by Scale

### 200 Endpoints System

| Item | Quantity | Unit Cost | Total Cost |
|------|----------|-----------|------------|
| Endpoint Nodes | 200 | $10.99 | $2,198.00 |
| Gateway Nodes | 1 | $10.00 | $10.00 |
| MQTT Broker (Raspberry Pi 4) | 1 | $55.00 | $55.00 |
| Network Switch (optional) | 1 | $25.00 | $25.00 |
| Miscellaneous (cables, tools) | - | - | $50.00 |
| **Total** | - | - | **$2,338.00** |
| **Cost per endpoint** | - | - | **$11.69** |

### 500 Endpoints System

| Item | Quantity | Unit Cost | Total Cost |
|------|----------|-----------|------------|
| Endpoint Nodes | 500 | $10.99 | $5,495.00 |
| Gateway Nodes | 2 | $10.00 | $20.00 |
| MQTT Broker (Raspberry Pi 4) | 1 | $55.00 | $55.00 |
| Network Switch | 1 | $25.00 | $25.00 |
| Miscellaneous (cables, tools) | - | - | $100.00 |
| **Total** | - | - | **$5,695.00** |
| **Cost per endpoint** | - | - | **$11.39** |

## Detailed Component Specifications

### ESP32-C6-DevKitC-1

**Microcontroller:**
- **CPU**: RISC-V 32-bit, up to 160 MHz
- **RAM**: 512 KB SRAM
- **Flash**: 4 MB (external)
- **Wireless**: 
  - Bluetooth 5.0 (LE)
  - Wi-Fi 6 (802.11ax)
  - Bluetooth Mesh support
- **GPIO**: 22 programmable pins
- **Power**: 
  - Active mode: ~80 mA
  - Deep sleep: ~5-10 µA
  - Light sleep: ~1 mA
- **Operating Voltage**: 3.3V
- **Dimensions**: 25.4mm × 48.2mm

**Key Features:**
- Built-in USB serial converter
- Reset and boot buttons
- Power LED indicator
- Compatible with ESP-IDF framework

### LiPo Battery 4000mAh

**Specifications:**
- **Capacity**: 4000 mAh
- **Voltage**: 3.7V nominal, 4.2V max
- **Chemistry**: Lithium Polymer
- **Protection**: Built-in PCM (over-charge, over-discharge, short-circuit)
- **Connector**: JST-PH 2.0mm
- **Dimensions**: ~60mm × 35mm × 8mm
- **Weight**: ~65g
- **Cycle life**: 300-500 cycles

**Battery Life Calculation:**

```
Deep sleep current: 10 µA
Active events: 10 per day × 2 seconds × 80 mA = 0.44 mAh/day
Deep sleep: 24 hours × 0.01 mA = 0.24 mAh/day
Total daily consumption: ~0.68 mAh/day

Battery life: 4000 mAh / 0.68 mAh/day ≈ 5,882 days ≈ 16 years
(Practical: 2-3 years considering self-discharge)
```

### LED

**Specifications:**
- **Type**: 5mm through-hole
- **Color**: Red, Green, Blue, or White
- **Forward Voltage**: 2.0-2.2V (Red), 3.0-3.4V (White/Blue)
- **Forward Current**: 20 mA
- **Brightness**: 1000-2000 mcd
- **Viewing Angle**: 30-60°
- **Lifespan**: 50,000+ hours

**Recommended Colors:**
- **Red**: Low power, high visibility
- **Green**: Good visibility, moderate power
- **Blue/White**: High brightness, higher power

### Push Button

**Specifications:**
- **Type**: Tactile switch, momentary
- **Contact Type**: SPST-NO (normally open)
- **Operating Force**: 160-260 gf
- **Travel**: 0.25mm
- **Life Cycle**: 100,000+ operations
- **Contact Resistance**: <100 mΩ
- **Dimensions**: 6mm × 6mm × 5mm

### Enclosure

**Endpoint Node Enclosure:**
- **Material**: ABS plastic
- **Dimensions**: 60mm × 40mm × 20mm
- **Features**: 
  - Snap-fit or screw closure
  - Mounting holes
  - LED window
  - Button access hole
- **IP Rating**: IP40 (basic protection)
- **Color**: Gray or white

**Gateway Node Enclosure:**
- **Material**: ABS plastic
- **Dimensions**: 80mm × 60mm × 30mm
- **Features**:
  - Ventilation holes
  - Cable glands
  - Mounting brackets
  - Status LED windows

## Supporting Infrastructure

### MQTT Broker Options

#### Option 1: Raspberry Pi 4 (Recommended)

| Component | Specification | Price |
|-----------|---------------|-------|
| Raspberry Pi 4 | 4GB RAM | $55 |
| microSD Card | 32GB Class 10 | $10 |
| Power Supply | 5V 3A USB-C | $8 |
| Case | Official case with fan | $12 |
| **Total** | | **$85** |

**Software:**
- Raspbian OS
- Mosquitto MQTT broker
- Node.js backend server

#### Option 2: Cloud MQTT Service

| Service | Free Tier | Paid Tier |
|---------|-----------|-----------|
| HiveMQ Cloud | Up to 100 connections | From $49/month |
| CloudMQTT | 5 connections | From $5/month |
| AWS IoT Core | 12 months free | Pay per message |

### Network Equipment

| Item | Specification | Price | Notes |
|------|---------------|-------|-------|
| Wi-Fi Router | Dual-band AC1200+ | $30-50 | For gateway connectivity |
| Network Switch | 8-port Gigabit | $25-40 | Optional, for multiple gateways |
| Ethernet Cables | Cat6, various lengths | $5-15 | As needed |

## Tools and Equipment

### Development Tools

| Tool | Price | Notes |
|------|-------|-------|
| Soldering Iron | $25-50 | For assembly |
| Multimeter | $20-40 | Testing and debugging |
| USB-UART Adapter | $5-10 | Optional, for debugging |
| Wire Strippers | $10-15 | Cable preparation |
| Heat Shrink Kit | $10 | Cable insulation |

### Flashing Equipment

| Item | Price | Notes |
|------|-------|-------|
| USB-C Cables | $3 each | For flashing ESP32-C6 |
| USB Hub | $15-25 | For flashing multiple boards |

## Assembly Costs

### DIY Assembly

- **Time per endpoint**: ~15 minutes
- **Labor cost** (at $20/hr): ~$5 per endpoint
- **Total for 200 endpoints**: $1,000
- **Total for 500 endpoints**: $2,500

### Professional Assembly

- **PCB Assembly**: $3-5 per board (for custom PCB design)
- **Testing**: $1-2 per unit
- **Packaging**: $0.50 per unit

## Optional Enhancements

### Solar Power (for endpoints)

| Component | Price | Notes |
|-----------|-------|-------|
| Small Solar Panel | $5-10 | 5V 100mA |
| Charge Controller | $3-5 | TP4056 or similar |
| Total per node | $8-15 | Extends battery life indefinitely |

### Custom PCB (for scalability)

| Item | Quantity | Price | Total |
|------|----------|-------|-------|
| PCB Design | One-time | $500 | $500 |
| PCB Manufacturing | 100 boards | $2 each | $200 |
| Component Assembly | 100 units | $5 each | $500 |
| **Total** | | | **$1,200** |
| **Cost per unit** | | | **$12** |

Benefits:
- More compact
- More reliable
- Easier assembly
- Professional appearance

## Cost Optimization Strategies

### Bulk Purchasing

| Component | Small Order (1-10) | Bulk Order (100+) | Savings |
|-----------|-------------------|-------------------|---------|
| ESP32-C6 | $5.00 | $3.50 | 30% |
| LiPo Battery | $7.00 | $5.00 | 29% |
| Enclosure | $1.00 | $0.40 | 60% |

**Potential savings**: 20-30% on total component cost

### Alternative Components

#### Budget ESP32 Alternative

- **ESP32-C3**: $2.50 (vs $4.00 for C6)
- Sufficient for most applications
- Bluetooth 5.0 support
- Lower power Wi-Fi capabilities

#### Battery Alternatives

| Type | Capacity | Price | Pros | Cons |
|------|----------|-------|------|------|
| LiPo 4000mAh | 4000mAh | $6.00 | Compact, rechargeable | Requires protection |
| Li-Ion 18650 | 3400mAh | $4.00 | Standard size, cheaper | Larger enclosure needed |
| CR123A × 2 | 3000mAh | $5.00 | Non-rechargeable | Needs replacement |

## Maintenance Costs

### Annual Maintenance (500 endpoint system)

| Item | Frequency | Cost |
|------|-----------|------|
| Battery Replacement | 10% per year | $300 |
| Failed Nodes | 2% per year | $110 |
| Gateway Maintenance | As needed | $50 |
| Server Hosting | Monthly | $120/year |
| **Total Annual** | | **~$580** |

### 5-Year Total Cost of Ownership (500 endpoints)

| Category | Cost |
|----------|------|
| Initial Hardware | $5,695 |
| Maintenance (5 years) | $2,900 |
| Server Hosting (5 years) | $600 |
| Labor/Support | $1,000 |
| **Total** | **$10,195** |
| **Per endpoint over 5 years** | **$20.39** |

## Vendor Recommendations

### Electronic Components

- **Espressif Direct**: ESP32-C6 modules
- **DigiKey**: General components, US distributor
- **Mouser**: Alternative to DigiKey
- **LCSC/JLCPCB**: Cost-effective for bulk orders
- **AliExpress**: Budget option for non-critical components

### Batteries

- **Adafruit**: Quality LiPo batteries with protection
- **SparkFun**: Reliable battery solutions
- **Turnigy**: Budget option via HobbyKing

### Enclosures

- **Hammond Manufacturing**: Professional enclosures
- **Polycase**: Custom enclosure options
- **Generic suppliers**: AliExpress, eBay for budget options

## Shipping and Handling

### Estimated Shipping Costs

| Region | 200 endpoints | 500 endpoints |
|--------|---------------|---------------|
| Domestic (US) | $50-100 | $100-200 |
| International | $150-300 | $300-500 |

**Note**: Batteries may have shipping restrictions

## Summary

### Cost Breakdown (500 endpoint system)

| Category | Cost | Percentage |
|----------|------|------------|
| Endpoint Hardware | $5,495 | 89.5% |
| Gateway Hardware | $20 | 0.3% |
| Server Infrastructure | $140 | 2.3% |
| Network Equipment | $50 | 0.8% |
| Miscellaneous | $100 | 1.6% |
| Tools (one-time) | $150 | 2.4% |
| Shipping | $200 | 3.3% |
| **Total** | **$6,155** | **100%** |

### ROI Comparison vs. Alternatives

| Solution | Initial Cost | Advantages |
|----------|--------------|------------|
| **Smart Storage (This system)** | $6,155 | Low maintenance, scalable, long battery life |
| **Wi-Fi based system** | $8,000+ | Higher power, frequent battery replacement |
| **Wired system** | $15,000+ | Installation costs, limited flexibility |
| **Commercial RFID** | $20,000+ | Complex setup, higher maintenance |

## Conclusion

The Smart Storage system offers an excellent cost-to-performance ratio:

- **Low initial cost**: ~$11-12 per endpoint
- **Minimal maintenance**: 2-3 year battery life
- **Scalable**: Easy to expand from 200 to 500+ endpoints
- **Reliable**: Bluetooth Mesh redundancy
- **DIY-friendly**: No specialized tools required

**Recommended starting point**: 200 endpoint system (~$2,500) with expansion capability.

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Currency**: USD  
**Pricing Note**: Prices are estimates and may vary by region and supplier