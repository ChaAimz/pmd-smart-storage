class MqttHandler {
  constructor(inventoryService, logger) {
    this.inventoryService = inventoryService;
    this.logger = logger;
    this.topics = {
      status: 'smart-storage/status',
      command: 'smart-storage/command',
      button: 'smart-storage/button'
    };
  }

  // Subscribe to MQTT topics
  subscribe(client) {
    client.subscribe(this.topics.status, (err) => {
      if (err) {
        this.logger.error('Failed to subscribe to status topic:', err);
      } else {
        this.logger.info(`Subscribed to ${this.topics.status}`);
      }
    });

    client.subscribe(this.topics.button, (err) => {
      if (err) {
        this.logger.error('Failed to subscribe to button topic:', err);
      } else {
        this.logger.info(`Subscribed to ${this.topics.button}`);
      }
    });
  }

  // Handle incoming MQTT messages
  async handleMessage(client, topic, message) {
    try {
      const payload = JSON.parse(message.toString());
      this.logger.info(`Message received on ${topic}:`, payload);

      switch (topic) {
        case this.topics.status:
          await this.handleStatusMessage(payload);
          break;

        case this.topics.button:
          await this.handleButtonMessage(payload);
          break;

        default:
          this.logger.warn(`Unknown topic: ${topic}`);
      }
    } catch (error) {
      this.logger.error('Error handling MQTT message:', error);
    }
  }

  // Handle gateway status messages
  async handleStatusMessage(payload) {
    try {
      const { type, status } = payload;
      
      if (type === 'gateway') {
        await this.inventoryService.recordGatewayStatus('gateway', status);
        this.logger.info(`Gateway status updated: ${status}`);
      }
    } catch (error) {
      this.logger.error('Error handling status message:', error);
    }
  }

  // Handle button press events
  async handleButtonMessage(payload) {
    try {
      const { node_addr, event, timestamp } = payload;
      
      if (event === 'button_press') {
        // Convert node address to hex string
        const nodeAddress = `0x${node_addr.toString(16).padStart(4, '0')}`;
        
        // Record the pick event
        await this.inventoryService.recordPickEvent(nodeAddress, timestamp);
        
        // Get location details
        const location = await this.inventoryService.getLocationByAddress(nodeAddress);
        
        if (location) {
          this.logger.info(
            `Pick event at ${nodeAddress}: ${location.zone || 'N/A'} - ` +
            `${location.shelf || 'N/A'} - ${location.description || 'N/A'}`
          );
        } else {
          this.logger.warn(`Pick event at unknown location: ${nodeAddress}`);
        }
      }
    } catch (error) {
      this.logger.error('Error handling button message:', error);
    }
  }

  // Publish LED control command
  publishLedCommand(client, nodeAddress, ledState) {
    try {
      const command = {
        node_addr: parseInt(nodeAddress, 16),
        led_state: ledState
      };
      
      client.publish(this.topics.command, JSON.stringify(command), { qos: 1 });
      this.logger.info(`LED command published: ${nodeAddress} -> ${ledState ? 'ON' : 'OFF'}`);
    } catch (error) {
      this.logger.error('Error publishing LED command:', error);
    }
  }
}

module.exports = MqttHandler;