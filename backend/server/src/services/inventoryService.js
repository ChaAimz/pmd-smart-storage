class InventoryService {
  constructor(database, logger) {
    this.db = database;
    this.logger = logger;
  }

  // Get all storage locations
  async getAllLocations() {
    try {
      const locations = await this.db.all(
        'SELECT * FROM locations ORDER BY zone, shelf, row, column'
      );
      return locations;
    } catch (error) {
      this.logger.error('Error getting all locations:', error);
      throw error;
    }
  }

  // Get location by node address
  async getLocationByAddress(address) {
    try {
      const location = await this.db.get(
        'SELECT * FROM locations WHERE node_address = ?',
        [address]
      );
      return location;
    } catch (error) {
      this.logger.error('Error getting location by address:', error);
      throw error;
    }
  }

  // Create new storage location
  async createLocation(locationData) {
    try {
      const { node_address, zone, shelf, row, column, description } = locationData;
      
      const result = await this.db.run(
        `INSERT INTO locations (node_address, zone, shelf, row, column, description)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [node_address, zone, shelf, row, column, description]
      );
      
      this.logger.info(`Created location: ${node_address}`);
      return result.id;
    } catch (error) {
      this.logger.error('Error creating location:', error);
      throw error;
    }
  }

  // Update storage location
  async updateLocation(address, updates) {
    try {
      const fields = [];
      const values = [];
      
      const allowedFields = ['zone', 'shelf', 'row', 'column', 'description'];
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          fields.push(`${field} = ?`);
          values.push(updates[field]);
        }
      }
      
      if (fields.length === 0) {
        return false;
      }
      
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(address);
      
      const result = await this.db.run(
        `UPDATE locations SET ${fields.join(', ')} WHERE node_address = ?`,
        values
      );
      
      this.logger.info(`Updated location: ${address}`);
      return result.changes > 0;
    } catch (error) {
      this.logger.error('Error updating location:', error);
      throw error;
    }
  }

  // Record pick event
  async recordPickEvent(nodeAddress, timestamp) {
    try {
      const result = await this.db.run(
        `INSERT INTO pick_events (node_address, event_type, timestamp)
         VALUES (?, 'button_press', ?)`,
        [nodeAddress, timestamp]
      );
      
      this.logger.info(`Recorded pick event for ${nodeAddress} at ${timestamp}`);
      return result.id;
    } catch (error) {
      this.logger.error('Error recording pick event:', error);
      throw error;
    }
  }

  // Get pick events
  async getPickEvents(limit = 100, offset = 0) {
    try {
      const events = await this.db.all(
        `SELECT pe.*, l.zone, l.shelf, l.row, l.column, l.description
         FROM pick_events pe
         LEFT JOIN locations l ON pe.node_address = l.node_address
         ORDER BY pe.timestamp DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      return events;
    } catch (error) {
      this.logger.error('Error getting pick events:', error);
      throw error;
    }
  }

  // Get events by node address
  async getEventsByAddress(address) {
    try {
      const events = await this.db.all(
        `SELECT * FROM pick_events
         WHERE node_address = ?
         ORDER BY timestamp DESC`,
        [address]
      );
      return events;
    } catch (error) {
      this.logger.error('Error getting events by address:', error);
      throw error;
    }
  }

  // Search locations by query
  async searchLocations(query) {
    try {
      const searchPattern = `%${query}%`;
      const locations = await this.db.all(
        `SELECT * FROM locations
         WHERE zone LIKE ? OR shelf LIKE ? OR description LIKE ? OR node_address LIKE ?
         ORDER BY zone, shelf, row, column`,
        [searchPattern, searchPattern, searchPattern, searchPattern]
      );
      return locations;
    } catch (error) {
      this.logger.error('Error searching locations:', error);
      throw error;
    }
  }

  // Get statistics
  async getStatistics() {
    try {
      const totalLocations = await this.db.get(
        'SELECT COUNT(*) as count FROM locations'
      );
      
      const totalEvents = await this.db.get(
        'SELECT COUNT(*) as count FROM pick_events'
      );
      
      const recentEvents = await this.db.get(
        `SELECT COUNT(*) as count FROM pick_events
         WHERE timestamp > ?`,
        [Date.now() / 1000 - 86400] // Last 24 hours
      );
      
      const mostActiveLocations = await this.db.all(
        `SELECT pe.node_address, l.zone, l.shelf, l.description, COUNT(*) as pick_count
         FROM pick_events pe
         LEFT JOIN locations l ON pe.node_address = l.node_address
         GROUP BY pe.node_address
         ORDER BY pick_count DESC
         LIMIT 10`
      );
      
      return {
        total_locations: totalLocations.count,
        total_events: totalEvents.count,
        events_last_24h: recentEvents.count,
        most_active_locations: mostActiveLocations
      };
    } catch (error) {
      this.logger.error('Error getting statistics:', error);
      throw error;
    }
  }

  // Record gateway status
  async recordGatewayStatus(gatewayId, status) {
    try {
      const result = await this.db.run(
        `INSERT INTO gateway_status (gateway_id, status)
         VALUES (?, ?)`,
        [gatewayId, status]
      );
      
      this.logger.info(`Gateway ${gatewayId} status: ${status}`);
      return result.id;
    } catch (error) {
      this.logger.error('Error recording gateway status:', error);
      throw error;
    }
  }
}

module.exports = InventoryService;