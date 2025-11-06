# GPIO5 Factory Reset Button Wiring Guide

## 📌 **Overview**

The factory reset button is connected to **GPIO5** on the ESP32-C6 Feather.

---

## 🔌 **Wiring Diagram**

```
ESP32-C6 Feather          Push Button
┌─────────────┐           ┌─────┐
│             │           │     │
│   GPIO5 ────┼───────────┤  1  │
│             │           │     │
│    GND  ────┼───────────┤  2  │
│             │           │     │
└─────────────┘           └─────┘
```

### **Connection:**

1. **GPIO5** → One side of push button
2. **GND** → Other side of push button

---

## 🛠️ **Hardware Requirements**

### **Components:**

- ✅ **1x Push Button** (Momentary switch, normally open)
- ✅ **2x Jumper Wires** (if using breadboard)

### **Optional:**

- Breadboard (for prototyping)
- Enclosure with panel-mount button (for production)

---

## 📋 **Step-by-Step Wiring**

### **Option 1: Direct Connection (Simplest)**

1. **Identify GPIO5 pin** on ESP32-C6 Feather
   - Check the pinout diagram
   - GPIO5 is usually labeled on the board

2. **Identify GND pin**
   - Any GND pin will work
   - Usually labeled "GND" or "G"

3. **Connect button:**
   - Solder one wire from GPIO5 to one terminal of button
   - Solder another wire from GND to other terminal of button

4. **Test:**
   - Press button → GPIO5 should read LOW (0)
   - Release button → GPIO5 should read HIGH (1) due to internal pull-up

### **Option 2: Breadboard Connection (Prototyping)**

1. **Insert ESP32-C6 Feather** into breadboard

2. **Insert push button** into breadboard
   - Make sure button terminals are on different rows

3. **Connect GPIO5 to button:**
   - Use jumper wire from GPIO5 pin to one button terminal

4. **Connect GND to button:**
   - Use jumper wire from GND pin to other button terminal

5. **Test:**
   - Press button → GPIO5 reads LOW
   - Release button → GPIO5 reads HIGH

---

## ⚡ **Technical Details**

### **GPIO5 Configuration:**

```c
// In firmware/endpoint-node/main/main.c
#define BUTTON_GPIO GPIO_NUM_5
#define BUTTON_ACTIVE_LEVEL 0  // Active LOW

// GPIO configuration
gpio_config_t io_conf = {
    .intr_type = GPIO_INTR_DISABLE,
    .mode = GPIO_MODE_INPUT,
    .pin_bit_mask = (1ULL << BUTTON_GPIO),
    .pull_up_en = GPIO_PULLUP_ENABLE,    // Internal pull-up enabled
    .pull_down_en = GPIO_PULLDOWN_DISABLE,
};
```

### **How It Works:**

1. **Internal Pull-up Enabled:**
   - GPIO5 is pulled HIGH (3.3V) by default
   - No external resistor needed

2. **Button Pressed:**
   - GPIO5 is connected to GND
   - GPIO5 reads LOW (0V)

3. **Button Released:**
   - GPIO5 is pulled HIGH by internal resistor
   - GPIO5 reads HIGH (3.3V)

---

## 🧪 **Testing the Button**

### **1. Flash the Firmware:**

```powershell
cd firmware\endpoint-node
idf.py -p COM6 flash monitor
```

### **2. Watch Serial Monitor:**

When you press the button, you should see:

```
I (5000) ENDPOINT_NODE: Button pressed - hold for 10 seconds to factory reset
```

### **3. Test Factory Reset:**

Hold button for 10 seconds:

```
I (5000) ENDPOINT_NODE: Button pressed - hold for 10 seconds to factory reset
W (8000) ENDPOINT_NODE: ⚠️  Factory reset in 7 seconds...
W (12000) ENDPOINT_NODE: 🔴 FACTORY RESET IN 3 SECONDS! Release button to cancel!
W (15000) ENDPOINT_NODE: 🔴 FACTORY RESET TRIGGERED!
```

---

## 🔍 **Troubleshooting**

### **Problem: Button not detected**

**Check:**
1. ✅ Button is connected to GPIO5 and GND (not other pins)
2. ✅ Button is working (test with multimeter)
3. ✅ Wires are properly connected
4. ✅ No loose connections

**Test with multimeter:**
- Set multimeter to continuity mode
- Press button → should beep (short circuit)
- Release button → should not beep (open circuit)

### **Problem: Button always reads as pressed**

**Check:**
1. ✅ Button is normally open (not normally closed)
2. ✅ Wiring is correct (GPIO5 to one side, GND to other)
3. ✅ No short circuit between GPIO5 and GND

### **Problem: Factory reset triggers immediately**

**Check:**
1. ✅ Button is not stuck
2. ✅ GPIO5 is not shorted to GND
3. ✅ Pull-up resistor is enabled in code

---

## 📊 **Pin Compatibility**

### **Why GPIO5?**

- ✅ **Available** - Not used by other peripherals
- ✅ **Safe** - Not a strapping pin
- ✅ **Reliable** - No conflicts with NeoPixel or other components

### **Pins to Avoid:**

- ❌ **GPIO9** - Used by NeoPixel LED and Boot button (conflict!)
- ❌ **GPIO20** - Used by NeoPixel power control
- ❌ **GPIO15** - Used by onboard Red LED
- ⚠️ **GPIO0, GPIO8** - Strapping pins (can cause boot issues)

### **Alternative Pins (if needed):**

If GPIO5 is not available, you can use:
- ✅ **GPIO1** - Safe alternative
- ✅ **GPIO2** - Safe alternative
- ✅ **GPIO3** - Safe alternative
- ✅ **GPIO4** - Safe alternative
- ✅ **GPIO6** - Safe alternative
- ✅ **GPIO7** - Safe alternative

To change pin, edit `firmware/endpoint-node/main/main.c`:
```c
#define BUTTON_GPIO GPIO_NUM_X  // Change X to desired GPIO number
```

---

## 🎨 **Production Considerations**

### **For Enclosure:**

1. **Panel-mount button:**
   - Drill hole in enclosure
   - Mount button securely
   - Wire to GPIO5 and GND inside enclosure

2. **Label the button:**
   - "FACTORY RESET"
   - "HOLD 10 SEC TO RESET"

3. **Recessed button (optional):**
   - Prevents accidental presses
   - Requires tool or paperclip to press

### **For PCB Design:**

1. **Add button footprint** on PCB
2. **Connect to GPIO5 and GND**
3. **Optional: Add external pull-up resistor** (10kΩ)
   - Not required (internal pull-up is sufficient)
   - But can improve reliability

---

## 📚 **Related Documentation**

- **[FACTORY_RESET_METHODS.md](FACTORY_RESET_METHODS.md)** - Complete factory reset guide
- **[TEST_FACTORY_RESET.md](TEST_FACTORY_RESET.md)** - Testing guide
- **[FACTORY_RESET_IMPLEMENTATION.md](FACTORY_RESET_IMPLEMENTATION.md)** - Implementation details

---

## ✅ **Quick Reference**

| Item | Value |
|------|-------|
| **GPIO Pin** | GPIO5 |
| **Active Level** | LOW (0) |
| **Pull-up** | Internal (enabled) |
| **Button Type** | Momentary, Normally Open |
| **Hold Time** | 10 seconds |
| **Warnings** | 3s and 7s |

---

## 🎉 **Summary**

**Simple 2-wire connection:**
- GPIO5 → Button → GND
- Internal pull-up enabled
- Press and hold 10 seconds to factory reset

Easy! 🚀

