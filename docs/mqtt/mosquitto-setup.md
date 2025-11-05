# Mosquitto MQTT Broker Setup Guide

This guide will help you set up a local Mosquitto MQTT broker on Windows for the Smart Storage system.

## Overview

Mosquitto is a lightweight, open-source MQTT broker that will handle communication between:
- **Gateway Node** (ESP32-C6) → MQTT → **Backend Server**
- **Backend Server** → MQTT → **Gateway Node**

## Installation on Windows

### Method 1: Using Official Installer (Recommended)

1. **Download Mosquitto**
   - Visit: https://mosquitto.org/download/
   - Download the Windows 64-bit installer (e.g., `mosquitto-2.0.18-install-windows-x64.exe`)

2. **Install Mosquitto**
   ```powershell
   # Run the installer as Administrator
   # Default installation path: C:\Program Files\mosquitto
   ```

3. **Install as Windows Service**
   - The installer will automatically set up Mosquitto as a Windows service
   - Service name: `Mosquitto Broker`

4. **Verify Installation**
   ```powershell
   # Open PowerShell as Administrator
   cd "C:\Program Files\mosquitto"
   .\mosquitto.exe -v
   ```
   
   Expected output:
   ```
   mosquitto version 2.0.18
   ```

### Method 2: Using Chocolatey

```powershell
# Install Chocolatey first (if not installed)
# Then install Mosquitto
choco install mosquitto -y
```

## Configuration

### 1. Create Configuration File

Create a configuration file at `C:\Program Files\mosquitto\mosquitto.conf`:

```conf
# Mosquitto Configuration for Smart Storage System
# Port: 1883 (default MQTT)

# Network Settings
listener 1883
protocol mqtt

# Allow anonymous connections (for development)
# WARNING: Disable this in production!
allow_anonymous true

# Persistence
persistence true
persistence_location C:/Program Files/mosquitto/data/

# Logging
log_dest file C:/Program Files/mosquitto/logs/mosquitto.log
log_dest stdout
log_type error
log_type warning
log_type notice
log_type information
log_timestamp true
log_timestamp_format %Y-%m-%dT%H:%M:%S

# Connection settings
max_connections -1
max_queued_messages 1000

# Message size limit (10MB)
message_size_limit 10485760

# Keep alive
max_keepalive 65535
```

### 2. Create Required Directories

```powershell
# Open PowerShell as Administrator
cd "C:\Program Files\mosquitto"
mkdir data
mkdir logs
```

### 3. Set Permissions

```powershell
# Grant write permissions to the mosquitto directories
icacls "C:\Program Files\mosquitto\data" /grant Users:F
icacls "C:\Program Files\mosquitto\logs" /grant Users:F
```

## Starting Mosquitto

### Option 1: As Windows Service (Recommended)

```powershell
# Start the service
net start mosquitto

# Stop the service
net stop mosquitto

# Restart the service
net stop mosquitto && net start mosquitto
```

Or use Services Manager:
1. Press `Win + R`
2. Type `services.msc`
3. Find "Mosquitto Broker"
4. Right-click → Start/Stop/Restart

### Option 2: Manual Start (for testing)

```powershell
# Open PowerShell as Administrator
cd "C:\Program Files\mosquitto"
.\mosquitto.exe -c mosquitto.conf -v
```

## Testing the Broker

### 1. Test with Mosquitto Clients

Open **two separate PowerShell windows**:

**Window 1 - Subscribe to all topics:**
```powershell
cd "C:\Program Files\mosquitto"
.\mosquitto_sub.exe -h localhost -t '#' -v
```

**Window 2 - Publish a test message:**
```powershell
cd "C:\Program Files\mosquitto"
.\mosquitto_pub.exe -h localhost -t 'test/topic' -m 'Hello MQTT!'
```

You should see the message appear in Window 1.

### 2. Test Smart Storage Topics

**Subscribe to Smart Storage topics:**
```powershell
.\mosquitto_sub.exe -h localhost -t 'smart-storage/#' -v
```

**Publish a test button press:**
```powershell
.\mosquitto_pub.exe -h localhost -t 'smart-storage/button' -m '{"node_addr":1,"event":"button_press","timestamp":1234567890}'
```

**Publish a test LED command:**
```powershell
.\mosquitto_pub.exe -h localhost -t 'smart-storage/command' -m '{"node_addr":1,"led_state":true}'
```

## Firewall Configuration

If you want to access the broker from other devices on your network:

```powershell
# Allow incoming connections on port 1883
netsh advfirewall firewall add rule name="Mosquitto MQTT" dir=in action=allow protocol=TCP localport=1883
```

## Connecting Your Gateway Node

Update your gateway firmware configuration:

1. **Get your PC's IP address:**
   ```powershell
   ipconfig
   ```
   Look for "IPv4 Address" (e.g., `192.168.1.100`)

2. **Update gateway-node/main/main.c:**
   ```c
   #define MQTT_BROKER_URL "mqtt://192.168.1.100:1883"
   ```

3. **Rebuild and flash:**
   ```bash
   cd firmware/gateway-node
   idf.py build flash monitor
   ```

## Connecting Your Backend Server

1. **Navigate to backend server:**
   ```powershell
   cd backend/server
   ```

2. **Create/update `.env` file:**
   ```env
   PORT=3000
   NODE_ENV=development
   LOG_LEVEL=info
   MQTT_BROKER_URL=mqtt://localhost:1883
   MQTT_CLIENT_ID=smart-storage-server
   DATABASE_PATH=./data/inventory.db
   ```

3. **Start the server:**
   ```powershell
   npm install
   npm start
   ```

## Monitoring MQTT Traffic

### Real-time Monitoring

```powershell
# Monitor all topics
.\mosquitto_sub.exe -h localhost -t '#' -v

# Monitor only Smart Storage topics
.\mosquitto_sub.exe -h localhost -t 'smart-storage/#' -v

# Monitor specific topic
.\mosquitto_sub.exe -h localhost -t 'smart-storage/button' -v
```

### Check Logs

```powershell
# View log file
Get-Content "C:\Program Files\mosquitto\logs\mosquitto.log" -Tail 50 -Wait
```

## Troubleshooting

### Service Won't Start

**Check if port 1883 is already in use:**
```powershell
netstat -ano | findstr :1883
```

**Check the log file:**
```powershell
Get-Content "C:\Program Files\mosquitto\logs\mosquitto.log" -Tail 20
```

**Restart the service:**
```powershell
net stop mosquitto
net start mosquitto
```

### Gateway Can't Connect

1. **Verify broker is running:**
   ```powershell
   netstat -ano | findstr :1883
   ```

2. **Check firewall settings**

3. **Verify IP address is correct**

4. **Test from gateway's network:**
   ```powershell
   # From another device on the same network
   .\mosquitto_pub.exe -h YOUR_PC_IP -t 'test' -m 'hello'
   ```

### No Messages Received

1. **Check topic names match exactly**
2. **Verify QoS settings**
3. **Check broker logs**
4. **Test with mosquitto_sub/pub first**

## Security (Production)

For production deployment, enable authentication:

### 1. Create Password File

```powershell
cd "C:\Program Files\mosquitto"
.\mosquitto_passwd.exe -c passwords.txt admin
# Enter password when prompted
```

### 2. Update mosquitto.conf

```conf
# Disable anonymous access
allow_anonymous false

# Enable password file
password_file C:/Program Files/mosquitto/passwords.txt
```

### 3. Update Clients

Update connection strings to include credentials:
```
mqtt://admin:password@192.168.1.100:1883
```

## Next Steps

1. ✅ Mosquitto installed and running
2. ✅ Test with mosquitto_sub/pub
3. 🔲 Configure gateway node with broker IP
4. 🔲 Start backend server
5. 🔲 Test end-to-end communication
6. 🔲 Deploy to production with authentication

## Useful Commands Reference

```powershell
# Start service
net start mosquitto

# Stop service
net stop mosquitto

# Subscribe to all topics
.\mosquitto_sub.exe -h localhost -t '#' -v

# Publish test message
.\mosquitto_pub.exe -h localhost -t 'test' -m 'hello'

# View logs
Get-Content "C:\Program Files\mosquitto\logs\mosquitto.log" -Tail 50 -Wait

# Check if running
netstat -ano | findstr :1883
```

## Additional Resources

- [Mosquitto Documentation](https://mosquitto.org/documentation/)
- [MQTT Protocol Specification](https://mqtt.org/mqtt-specification/)
- [Eclipse Paho MQTT Clients](https://www.eclipse.org/paho/)

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: Smart Storage Team

