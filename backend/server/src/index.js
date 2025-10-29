const express = require('express');
const mqtt = require('mqtt');
const cors = require('cors');
const bodyParser = require('body-parser');
const winston = require('winston');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const Database = require('./database');
const InventoryService = require('./services/inventoryService');
const MqttHandler = require('./services/mqttHandler');

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Express app setup
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize database
const db = new Database('./data/warehouse.db', logger);
db.initialize();

// Initialize services
const inventoryService = new InventoryService(db, logger);
const mqttHandler = new MqttHandler(inventoryService, logger);

// Connect to MQTT broker
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883', {
  clientId: `smart-storage-server-${Math.random().toString(16).slice(2, 8)}`,
  clean: true,
  reconnectPeriod: 5000
});

mqttClient.on('connect', () => {
  logger.info('Connected to MQTT broker');
  mqttHandler.subscribe(mqttClient);
});

mqttClient.on('message', (topic, message) => {
  mqttHandler.handleMessage(mqttClient, topic, message);
});

mqttClient.on('error', (error) => {
  logger.error('MQTT error:', error);
});

// REST API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mqtt: mqttClient.connected,
    database: db.isReady(),
    timestamp: new Date().toISOString()
  });
});

// Get all storage locations
app.get('/api/locations', async (req, res) => {
  try {
    const locations = await inventoryService.getAllLocations();
    res.json({ success: true, data: locations });
  } catch (error) {
    logger.error('Error getting locations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get location by address
app.get('/api/locations/:address', async (req, res) => {
  try {
    const location = await inventoryService.getLocationByAddress(req.params.address);
    if (location) {
      res.json({ success: true, data: location });
    } else {
      res.status(404).json({ success: false, error: 'Location not found' });
    }
  } catch (error) {
    logger.error('Error getting location:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new storage location
app.post('/api/locations', async (req, res) => {
  try {
    const { node_address, zone, shelf, row, column, description } = req.body;
    
    if (!node_address) {
      return res.status(400).json({ success: false, error: 'node_address is required' });
    }
    
    const locationId = await inventoryService.createLocation({
      node_address,
      zone,
      shelf,
      row,
      column,
      description
    });
    
    res.status(201).json({ success: true, data: { id: locationId } });
  } catch (error) {
    logger.error('Error creating location:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update storage location
app.put('/api/locations/:address', async (req, res) => {
  try {
    const updated = await inventoryService.updateLocation(req.params.address, req.body);
    if (updated) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Location not found' });
    }
  } catch (error) {
    logger.error('Error updating location:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Control LED at location
app.post('/api/locations/:address/led', async (req, res) => {
  try {
    const { state } = req.body;
    const nodeAddress = parseInt(req.params.address, 16);
    
    const command = {
      node_addr: nodeAddress,
      led_state: state === 'on' || state === true
    };
    
    mqttClient.publish('smart-storage/command', JSON.stringify(command));
    logger.info(`LED command sent to node 0x${nodeAddress.toString(16)}: ${command.led_state ? 'ON' : 'OFF'}`);
    
    res.json({ success: true, message: 'Command sent' });
  } catch (error) {
    logger.error('Error sending LED command:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pick events
app.get('/api/events', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const events = await inventoryService.getPickEvents(parseInt(limit), parseInt(offset));
    res.json({ success: true, data: events });
  } catch (error) {
    logger.error('Error getting events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get events for specific location
app.get('/api/locations/:address/events', async (req, res) => {
  try {
    const events = await inventoryService.getEventsByAddress(req.params.address);
    res.json({ success: true, data: events });
  } catch (error) {
    logger.error('Error getting location events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await inventoryService.getStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error getting statistics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Authentication - Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }

    const user = await new Promise((resolve, reject) => {
      db.db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Return user without password
    const { password_hash, ...userWithoutPassword } = user;
    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatar_url
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all items
app.get('/api/items', async (req, res) => {
  try {
    const items = await new Promise((resolve, reject) => {
      db.db.all('SELECT * FROM items ORDER BY name', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.json({ success: true, data: items });
  } catch (error) {
    logger.error('Error getting items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search items
app.get('/api/items/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: 'Query parameter q is required' });
    }

    const items = await new Promise((resolve, reject) => {
      db.db.all(`
        SELECT * FROM items
        WHERE name LIKE ? OR sku LIKE ? OR description LIKE ?
        ORDER BY name
        LIMIT 50
      `, [`%${q}%`, `%${q}%`, `%${q}%`], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.json({ success: true, data: items });
  } catch (error) {
    logger.error('Error searching items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get items with low stock (below reorder point)
app.get('/api/items/low-stock', async (req, res) => {
  try {
    const items = await new Promise((resolve, reject) => {
      db.db.all(`
        SELECT i.*,
          CASE
            WHEN i.quantity = 0 THEN 'critical'
            WHEN i.quantity <= (i.reorder_point * 0.5) THEN 'critical'
            WHEN i.quantity <= i.reorder_point THEN 'high'
            ELSE 'medium'
          END as urgency
        FROM items i
        WHERE i.quantity <= i.reorder_point
        ORDER BY urgency DESC, i.quantity ASC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.json({ success: true, data: items });
  } catch (error) {
    logger.error('Error getting low stock items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create item
app.post('/api/items', async (req, res) => {
  try {
    const {
      sku, name, description, category, unit, min_quantity,
      reorder_point, reorder_quantity, safety_stock, lead_time_days,
      unit_cost, supplier_name, supplier_contact
    } = req.body;

    if (!sku || !name || !category) {
      return res.status(400).json({ success: false, error: 'SKU, name, and category are required' });
    }

    const result = await new Promise((resolve, reject) => {
      db.db.run(`
        INSERT INTO items (
          sku, name, description, category, unit, min_quantity,
          reorder_point, reorder_quantity, safety_stock, lead_time_days,
          unit_cost, supplier_name, supplier_contact
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        sku, name, description, category, unit || 'pcs', min_quantity || 0,
        reorder_point || 0, reorder_quantity || 0, safety_stock || 0, lead_time_days || 7,
        unit_cost || 0, supplier_name, supplier_contact
      ], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });

    logger.info(`Created item: ${name} (${sku})`);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error creating item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update item
app.put('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'sku', 'name', 'description', 'category', 'unit', 'quantity',
      'min_quantity', 'reorder_point', 'reorder_quantity', 'safety_stock',
      'lead_time_days', 'unit_cost', 'supplier_name', 'supplier_contact'
    ];

    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => updates[f]);
    values.push(id);

    await new Promise((resolve, reject) => {
      db.db.run(
        `UPDATE items SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    logger.info(`Updated item ID: ${id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete item
app.delete('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await new Promise((resolve, reject) => {
      db.db.run('DELETE FROM items WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });

    logger.info(`Deleted item ID: ${id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get purchase orders
app.get('/api/purchase-orders', async (req, res) => {
  try {
    const orders = await new Promise((resolve, reject) => {
      db.db.all(`
        SELECT po.*, u.full_name as created_by_name
        FROM purchase_orders po
        LEFT JOIN users u ON po.created_by = u.id
        ORDER BY po.created_at DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.json({ success: true, data: orders });
  } catch (error) {
    logger.error('Error getting purchase orders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create purchase order
app.post('/api/purchase-orders', async (req, res) => {
  try {
    const { items, supplier_name, created_by } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Items array is required' });
    }

    const total_cost = items.reduce((sum, item) => sum + (item.unit_cost * item.quantity), 0);

    const result = await new Promise((resolve, reject) => {
      db.db.run(`
        INSERT INTO purchase_orders (supplier_name, total_cost, status, created_by, items_json)
        VALUES (?, ?, 'pending', ?, ?)
      `, [supplier_name, total_cost, created_by || 1, JSON.stringify(items)], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('Error creating purchase order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get stock transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const transactions = await new Promise((resolve, reject) => {
      db.db.all(`
        SELECT st.*, i.name as item_name, i.sku, u.full_name as user_name
        FROM stock_transactions st
        LEFT JOIN items i ON st.item_id = i.id
        LEFT JOIN users u ON st.user_id = u.id
        ORDER BY st.created_at DESC
        LIMIT ?
      `, [parseInt(limit)], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.json({ success: true, data: transactions });
  } catch (error) {
    logger.error('Error getting transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create stock transaction
app.post('/api/transactions', async (req, res) => {
  try {
    const { item_id, location_id, transaction_type, quantity, reference_number, notes, user_id } = req.body;

    if (!item_id || !transaction_type || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'item_id, transaction_type, and quantity are required'
      });
    }

    if (!['receive', 'pick', 'adjust'].includes(transaction_type)) {
      return res.status(400).json({
        success: false,
        error: 'transaction_type must be receive, pick, or adjust'
      });
    }

    // Start transaction
    const result = await new Promise((resolve, reject) => {
      db.db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Insert transaction record
    const transactionId = await new Promise((resolve, reject) => {
      db.db.run(`
        INSERT INTO stock_transactions (
          item_id, location_id, transaction_type, quantity,
          reference_number, notes, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [item_id, location_id, transaction_type, quantity, reference_number, notes, user_id],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    // Update item quantity
    const quantityChange = transaction_type === 'pick' ? -Math.abs(quantity) :
                          transaction_type === 'receive' ? Math.abs(quantity) :
                          quantity;

    await new Promise((resolve, reject) => {
      db.db.run(
        'UPDATE items SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [quantityChange, item_id],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    // Commit transaction
    await new Promise((resolve, reject) => {
      db.db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    logger.info(`Created ${transaction_type} transaction for item ${item_id}: ${quantity} units`);
    res.json({ success: true, data: { id: transactionId } });
  } catch (error) {
    // Rollback on error
    await new Promise((resolve) => {
      db.db.run('ROLLBACK', () => resolve());
    });
    logger.error('Error creating transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Find item by query (zone, shelf, description)
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
    }

    const results = await inventoryService.searchLocations(q);
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('Error searching locations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Indicate item location (turn on LED)
app.post('/api/indicate', async (req, res) => {
  try {
    const { query, duration = 10000 } = req.body;
    
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }
    
    const locations = await inventoryService.searchLocations(query);
    
    if (locations.length === 0) {
      return res.status(404).json({ success: false, error: 'No locations found' });
    }
    
    // Turn on LEDs for all matching locations
    for (const location of locations) {
      const nodeAddress = parseInt(location.node_address, 16);
      const command = {
        node_addr: nodeAddress,
        led_state: true
      };
      mqttClient.publish('smart-storage/command', JSON.stringify(command));
      logger.info(`Indicating location: 0x${location.node_address}`);
    }
    
    // Schedule LED turn-off
    setTimeout(() => {
      for (const location of locations) {
        const nodeAddress = parseInt(location.node_address, 16);
        const command = {
          node_addr: nodeAddress,
          led_state: false
        };
        mqttClient.publish('smart-storage/command', JSON.stringify(command));
      }
      logger.info(`Turned off ${locations.length} indication LEDs`);
    }, duration);
    
    res.json({
      success: true,
      message: `Indicating ${locations.length} location(s)`,
      locations: locations.map(l => l.node_address)
    });
  } catch (error) {
    logger.error('Error indicating locations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Smart Storage Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  mqttClient.end();
  db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  mqttClient.end();
  db.close();
  process.exit(0);
});