# MQTT Broker Setup - Quick Reference

This directory contains everything you need to set up and test a local Mosquitto MQTT broker for the Smart Storage system.

## 📁 Files

| File | Description |
|------|-------------|
| `mosquitto-setup.md` | Complete installation and configuration guide |
| `mosquitto.conf` | Ready-to-use Mosquitto configuration file |
| `setup-mosquitto.ps1` | Automated setup script for Windows |
| `test-mqtt.ps1` | Test script to verify broker is working |

## 🚀 Quick Start (Windows)

### Step 1: Install Mosquitto

**Option A: Download Installer**
1. Visit https://mosquitto.org/download/
2. Download Windows 64-bit installer
3. Run as Administrator
4. Install to default location: `C:\Program Files\mosquitto`

**Option B: Use Chocolatey**
```powershell
choco install mosquitto -y
```

### Step 2: Run Setup Script

```powershell
# Open PowerShell as Administrator
cd docs/mqtt
.\setup-mosquitto.ps1
```

This script will:
- ✅ Verify Mosquitto installation
- ✅ Create required directories
- ✅ Set permissions
- ✅ Copy configuration file
- ✅ Configure Windows Firewall
- ✅ Start the service

### Step 3: Test the Broker

```powershell
# Run the test script
.\test-mqtt.ps1
```

### Step 4: Monitor Messages

Open a new PowerShell window:

```powershell
cd "C:\Program Files\mosquitto"

# Monitor all Smart Storage topics
.\mosquitto_sub.exe -h localhost -t 'smart-storage/#' -v
```

## 🔧 Configuration

### Gateway Node

Update `firmware/gateway-node/main/main.c`:

```c
// Replace YOUR_PC_IP with your actual IP address
#define MQTT_BROKER_URL "mqtt://192.168.1.100:1883"
```

To find your IP:
```powershell
ipconfig
# Look for "IPv4 Address"
```

### Backend Server

Update `backend/server/.env`:

```env
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_CLIENT_ID=smart-storage-server
```

## 📊 MQTT Topics

### Published by Gateway

| Topic | Direction | Description | Example Payload |
|-------|-----------|-------------|-----------------|
| `smart-storage/status` | Gateway → Server | Gateway status | `{"type":"gateway","status":"online"}` |
| `smart-storage/button` | Gateway → Server | Button press events | `{"node_addr":1,"event":"button_press","timestamp":1234567890}` |

### Subscribed by Gateway

| Topic | Direction | Description | Example Payload |
|-------|-----------|-------------|-----------------|
| `smart-storage/command` | Server → Gateway | LED control | `{"node_addr":1,"led_state":true}` |

## 🧪 Testing Commands

### Subscribe to All Topics
```powershell
cd "C:\Program Files\mosquitto"
.\mosquitto_sub.exe -h localhost -t '#' -v
```

### Subscribe to Smart Storage Topics Only
```powershell
.\mosquitto_sub.exe -h localhost -t 'smart-storage/#' -v
```

### Publish Test Button Press
```powershell
.\mosquitto_pub.exe -h localhost -t 'smart-storage/button' -m '{"node_addr":1,"event":"button_press","timestamp":1234567890}'
```

### Publish Test LED Command
```powershell
.\mosquitto_pub.exe -h localhost -t 'smart-storage/command' -m '{"node_addr":1,"led_state":true}'
```

### Publish Gateway Status
```powershell
.\mosquitto_pub.exe -h localhost -t 'smart-storage/status' -m '{"type":"gateway","status":"online"}'
```

## 🛠️ Service Management

### Start Service
```powershell
net start mosquitto
```

### Stop Service
```powershell
net stop mosquitto
```

### Restart Service
```powershell
net stop mosquitto
net start mosquitto
```

### Check Service Status
```powershell
Get-Service mosquitto
```

### View Logs
```powershell
Get-Content "C:\Program Files\mosquitto\logs\mosquitto.log" -Tail 50 -Wait
```

## 🔍 Troubleshooting

### Service Won't Start

**Check if port is in use:**
```powershell
netstat -ano | findstr :1883
```

**View error logs:**
```powershell
Get-Content "C:\Program Files\mosquitto\logs\mosquitto.log" -Tail 20
```

**Restart service:**
```powershell
net stop mosquitto
net start mosquitto
```

### Gateway Can't Connect

1. **Verify broker is running:**
   ```powershell
   Get-Service mosquitto
   ```

2. **Check firewall:**
   ```powershell
   Get-NetFirewallRule -DisplayName "Mosquitto MQTT"
   ```

3. **Test from command line:**
   ```powershell
   cd "C:\Program Files\mosquitto"
   .\mosquitto_pub.exe -h YOUR_PC_IP -t 'test' -m 'hello'
   ```

4. **Verify IP address is correct in gateway firmware**

### No Messages Received

1. **Check topic names match exactly** (case-sensitive!)
2. **Verify both publisher and subscriber are connected**
3. **Check broker logs for errors**
4. **Test with mosquitto_sub/pub first**

## 🔐 Security (Production)

For production deployment, enable authentication:

### Create Password File
```powershell
cd "C:\Program Files\mosquitto"
.\mosquitto_passwd.exe -c passwords.txt admin
# Enter password when prompted
```

### Update mosquitto.conf
```conf
allow_anonymous false
password_file C:/Program Files/mosquitto/passwords.txt
```

### Update Connection Strings
```
mqtt://admin:password@192.168.1.100:1883
```

## 📈 Monitoring

### Real-time Message Monitoring
```powershell
# All topics
.\mosquitto_sub.exe -h localhost -t '#' -v

# Smart Storage only
.\mosquitto_sub.exe -h localhost -t 'smart-storage/#' -v

# Specific topic
.\mosquitto_sub.exe -h localhost -t 'smart-storage/button' -v
```

### Log Monitoring
```powershell
# Follow logs in real-time
Get-Content "C:\Program Files\mosquitto\logs\mosquitto.log" -Tail 50 -Wait
```

### Connection Statistics
Check the log file for connection/disconnection events:
```powershell
Get-Content "C:\Program Files\mosquitto\logs\mosquitto.log" | Select-String "New connection"
```

## 🌐 Network Access

### Allow Remote Connections

1. **Configure firewall:**
   ```powershell
   New-NetFirewallRule -DisplayName "Mosquitto MQTT" -Direction Inbound -Protocol TCP -LocalPort 1883 -Action Allow
   ```

2. **Update mosquitto.conf:**
   ```conf
   listener 1883
   # bind_address 0.0.0.0  # Listen on all interfaces
   ```

3. **Use your PC's IP address in clients:**
   ```
   mqtt://192.168.1.100:1883
   ```

## 📚 Additional Resources

- [Mosquitto Documentation](https://mosquitto.org/documentation/)
- [MQTT Protocol Specification](https://mqtt.org/)
- [Eclipse Paho Clients](https://www.eclipse.org/paho/)
- [HiveMQ MQTT Essentials](https://www.hivemq.com/mqtt-essentials/)

## 🎯 Next Steps

After setting up Mosquitto:

1. ✅ Install and configure Mosquitto
2. ✅ Test with mosquitto_sub/pub
3. 🔲 Update gateway firmware with broker IP
4. 🔲 Flash gateway firmware
5. 🔲 Start backend server
6. 🔲 Test end-to-end communication
7. 🔲 Deploy endpoint nodes

## 💡 Tips

- **Always test with mosquitto_sub/pub first** before debugging application code
- **Use wildcards** (`#` for multi-level, `+` for single-level) when subscribing
- **Monitor logs** when troubleshooting connection issues
- **Keep topics organized** with a clear hierarchy
- **Use QoS 1** for important messages that must be delivered
- **Enable persistence** to retain messages across restarts

## 🆘 Getting Help

If you encounter issues:

1. Check the troubleshooting section in `mosquitto-setup.md`
2. Review Mosquitto logs
3. Test with command-line tools first
4. Verify network connectivity
5. Check firewall settings

---

**Last Updated**: 2024  
**Maintained By**: Smart Storage Team

