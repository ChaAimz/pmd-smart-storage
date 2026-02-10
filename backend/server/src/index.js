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
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

async function tableExists(tableName) {
  const row = await new Promise((resolve, reject) => {
    db.db.get(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      [tableName],
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
  });

  return !!row;
}

// Initialize database
const db = new Database('./data/warehouse.db', logger);
db.initialize();
bootstrapCategoryMaster().catch((error) => logger.error('Category bootstrap failed:', error));

// Initialize services
const inventoryService = new InventoryService(db, logger);
const mqttHandler = new MqttHandler(inventoryService, logger);

const DEFAULT_CATEGORY_DEFINITIONS = [
  { name: 'Electronics', color: '#2563EB' },
  { name: 'Clothing', color: '#DB2777' },
  { name: 'Food', color: '#D97706' },
  { name: 'Tools', color: '#7C3AED' },
  { name: 'Hardware', color: '#475569' },
  { name: 'Office Supplies', color: '#0891B2' },
  { name: 'Other', color: '#64748B' }
];

function isHexColor(value) {
  return typeof value === 'string' && /^#([0-9a-fA-F]{6})$/.test(value.trim());
}

function colorFromName(name) {
  const normalized = String(name || '').trim().toLowerCase();
  const predefined = DEFAULT_CATEGORY_DEFINITIONS.find((entry) => entry.name.toLowerCase() === normalized);
  if (predefined) return predefined.color;

  const palette = ['#2563EB', '#7C3AED', '#D97706', '#DB2777', '#0891B2', '#16A34A', '#475569'];
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) % 2147483647;
  }
  return palette[Math.abs(hash) % palette.length];
}

async function bootstrapCategoryMaster(retriesLeft = 20) {
  if (!db.isReady()) {
    if (retriesLeft <= 0) {
      logger.warn('Skipped category bootstrap because database is not ready');
      return;
    }
    setTimeout(() => {
      bootstrapCategoryMaster(retriesLeft - 1).catch((error) => {
        logger.error('Category bootstrap retry failed:', error);
      });
    }, 250);
    return;
  }

  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        color TEXT DEFAULT '#64748B',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const category of DEFAULT_CATEGORY_DEFINITIONS) {
      await db.run(
        `INSERT OR IGNORE INTO categories (name, color, is_active) VALUES (?, ?, 1)`,
        [category.name, category.color]
      );
    }

    const legacyCategories = await db.all(`
      SELECT DISTINCT TRIM(category) AS category_name
      FROM items
      WHERE category IS NOT NULL AND TRIM(category) <> ''
    `);

    for (const row of legacyCategories) {
      await db.run(
        `INSERT OR IGNORE INTO categories (name, color, is_active) VALUES (?, ?, 1)`,
        [row.category_name, colorFromName(row.category_name)]
      );
    }

    logger.info(`Category master bootstrapped (${legacyCategories.length} legacy categories merged)`);
  } catch (error) {
    logger.error('Failed to bootstrap category master:', error);
  }
}

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

    const categoryRecord = await getActiveCategoryByName(category);
    if (!categoryRecord) {
      return res.status(400).json({ success: false, error: 'Invalid category. Please select an active category from Settings > Category.' });
    }

    const result = await new Promise((resolve, reject) => {
      db.db.run(`
        INSERT INTO items (
          sku, name, description, category, unit, min_quantity,
          reorder_point, reorder_quantity, safety_stock, lead_time_days,
          unit_cost, supplier_name, supplier_contact
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        sku, name, description, categoryRecord.name, unit || 'pcs', min_quantity || 0,
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

    if (Object.prototype.hasOwnProperty.call(updates, 'category')) {
      const categoryRecord = await getActiveCategoryByName(updates.category);
      if (!categoryRecord) {
        return res.status(400).json({ success: false, error: 'Invalid category. Please select an active category from Settings > Category.' });
      }
      updates.category = categoryRecord.name;
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
app.listen(PORT, HOST, () => {
  logger.info(`Smart Storage Server running on ${HOST}:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// ==================== PR (Compatibility endpoints for Receive/PR pages) ====================
app.get('/api/prs', async (req, res) => {
  try {
    const hasPrTable = await tableExists('purchase_requisitions');
    const hasPrItemsTable = await tableExists('pr_items');

    if (!hasPrTable || !hasPrItemsTable) {
      return res.json({ success: true, data: [] });
    }

    const params = [];
    let whereClause = '';
    if (req.query.status) {
      whereClause = 'WHERE pr.status = ?';
      params.push(req.query.status);
    }

    const prs = await new Promise((resolve, reject) => {
      db.db.all(
        `
          SELECT
            pr.*,
            COALESCE(u.full_name, 'Unknown') AS requester_name,
            COUNT(pri.id) AS item_count,
            COALESCE(SUM(pri.quantity * COALESCE(pri.estimated_unit_cost, 0)), 0) AS estimated_total
          FROM purchase_requisitions pr
          LEFT JOIN users u ON u.id = pr.requester_id
          LEFT JOIN pr_items pri ON pri.pr_id = pr.id
          ${whereClause}
          GROUP BY pr.id
          ORDER BY date(pr.required_date) ASC, pr.created_at DESC
        `,
        params,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({ success: true, data: prs });
  } catch (error) {
    logger.error('Error getting PRs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Category Master ====================
app.get('/api/categories', async (req, res) => {
  try {
    const includeInactive = String(req.query.include_inactive || 'false').toLowerCase() === 'true';
    const rows = await db.all(
      `
        SELECT
          c.id,
          c.name,
          c.color,
          c.is_active,
          c.created_at,
          c.updated_at,
          COALESCE(ic.item_count, 0) AS item_count
        FROM categories c
        LEFT JOIN (
          SELECT category, COUNT(*) AS item_count
          FROM items
          GROUP BY category
        ) ic ON ic.category = c.name
        ${includeInactive ? '' : 'WHERE c.is_active = 1'}
        ORDER BY c.is_active DESC, c.name ASC
      `
    );

    res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        is_active: !!row.is_active,
        item_count: Number(row.item_count || 0)
      }))
    });
  } catch (error) {
    logger.error('Error getting categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const color = isHexColor(req.body?.color) ? req.body.color.trim() : colorFromName(name);
    const isActive = req.body?.is_active === undefined ? 1 : (req.body.is_active ? 1 : 0);

    if (!name) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }

    await db.run(
      `
        INSERT INTO categories (name, color, is_active)
        VALUES (?, ?, ?)
      `,
      [name, color, isActive]
    );

    const created = await db.get('SELECT * FROM categories WHERE LOWER(name) = LOWER(?)', [name]);
    res.status(201).json({ success: true, data: { ...created, is_active: !!created.is_active, item_count: 0 } });
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE constraint failed')) {
      return res.status(409).json({ success: false, error: 'Category name already exists' });
    }
    logger.error('Error creating category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id, 10);
    if (Number.isNaN(categoryId)) {
      return res.status(400).json({ success: false, error: 'Invalid category id' });
    }

    const existing = await getCategoryById(categoryId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    const nextName = req.body?.name !== undefined ? String(req.body.name || '').trim() : existing.name;
    const nextColor = req.body?.color !== undefined ? String(req.body.color || '').trim() : existing.color;
    const nextIsActive = req.body?.is_active !== undefined ? (req.body.is_active ? 1 : 0) : existing.is_active;

    if (!nextName) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }

    if (!isHexColor(nextColor)) {
      return res.status(400).json({ success: false, error: 'Color must be in hex format (#RRGGBB)' });
    }

    const duplicate = await db.get(
      'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id <> ?',
      [nextName, categoryId]
    );
    if (duplicate) {
      return res.status(409).json({ success: false, error: 'Category name already exists' });
    }

    await db.run(
      `
        UPDATE categories
        SET name = ?, color = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [nextName, nextColor, nextIsActive, categoryId]
    );

    if (nextName !== existing.name) {
      await db.run('UPDATE items SET category = ? WHERE category = ?', [nextName, existing.name]);
    }

    const updated = await db.get(
      `
        SELECT
          c.*,
          (SELECT COUNT(*) FROM items i WHERE i.category = c.name) AS item_count
        FROM categories c
        WHERE c.id = ?
      `,
      [categoryId]
    );

    res.json({
      success: true,
      data: {
        ...updated,
        is_active: !!updated.is_active,
        item_count: Number(updated.item_count || 0)
      }
    });
  } catch (error) {
    logger.error('Error updating category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id, 10);
    const replacementCategoryId = req.query.replacement_category_id
      ? parseInt(req.query.replacement_category_id, 10)
      : null;

    if (Number.isNaN(categoryId)) {
      return res.status(400).json({ success: false, error: 'Invalid category id' });
    }

    const category = await getCategoryById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    const usageCount = await countItemsByCategoryName(category.name);

    if (usageCount > 0 && !replacementCategoryId) {
      return res.status(400).json({
        success: false,
        error: `Category "${category.name}" is in use by ${usageCount} item(s). Replacement category is required.`,
        requires_replacement: true,
        usage_count: usageCount
      });
    }

    let replacement = null;
    if (replacementCategoryId) {
      if (Number.isNaN(replacementCategoryId) || replacementCategoryId === categoryId) {
        return res.status(400).json({ success: false, error: 'Invalid replacement category' });
      }

      replacement = await getCategoryById(replacementCategoryId);
      if (!replacement || !replacement.is_active) {
        return res.status(400).json({ success: false, error: 'Replacement category must exist and be active' });
      }
    }

    if (usageCount > 0 && replacement) {
      await db.run('UPDATE items SET category = ? WHERE category = ?', [replacement.name, category.name]);
    }

    const remainingUsage = await countItemsByCategoryName(category.name);
    if (remainingUsage > 0) {
      return res.status(400).json({
        success: false,
        error: `Category "${category.name}" still has ${remainingUsage} linked item(s) and cannot be deleted`
      });
    }

    await db.run('DELETE FROM categories WHERE id = ?', [categoryId]);
    res.json({ success: true, data: { deleted_id: categoryId, migrated_to: replacement?.id || null } });
  } catch (error) {
    logger.error('Error deleting category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function getCategoryById(categoryId) {
  return db.get('SELECT * FROM categories WHERE id = ?', [categoryId]);
}

async function getActiveCategoryByName(categoryName) {
  const normalized = String(categoryName || '').trim();
  if (!normalized) return null;

  return db.get(
    'SELECT * FROM categories WHERE LOWER(name) = LOWER(?) AND is_active = 1',
    [normalized]
  );
}

async function countItemsByCategoryName(categoryName) {
  const row = await db.get(
    'SELECT COUNT(*) AS item_count FROM items WHERE category = ?',
    [categoryName]
  );
  return Number(row?.item_count || 0);
}

app.get('/api/prs/:id', async (req, res) => {
  try {
    const hasPrTable = await tableExists('purchase_requisitions');
    const hasPrItemsTable = await tableExists('pr_items');

    if (!hasPrTable || !hasPrItemsTable) {
      return res.status(404).json({ success: false, error: 'PR feature not initialized' });
    }

    const pr = await new Promise((resolve, reject) => {
      db.db.get(
        `
          SELECT
            pr.*,
            COALESCE(u.full_name, 'Unknown') AS requester_name,
            COALESCE(s.name, 'Main Store') AS store_name,
            COALESCE(d.name, 'General') AS department_name
          FROM purchase_requisitions pr
          LEFT JOIN users u ON u.id = pr.requester_id
          LEFT JOIN stores s ON s.id = pr.store_id
          LEFT JOIN departments d ON d.id = s.department_id
          WHERE pr.id = ?
        `,
        [req.params.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!pr) {
      return res.status(404).json({ success: false, error: 'PR not found' });
    }

    const items = await new Promise((resolve, reject) => {
      db.db.all(
        `
          SELECT
            pri.id,
            pri.pr_id,
            pri.master_item_id,
            COALESCE(mi.sku, 'N/A') AS sku,
            COALESCE(mi.name, 'Unknown') AS name,
            COALESCE(mi.name, 'Unknown') AS item_name,
            COALESCE(mi.unit, 'pcs') AS unit,
            pri.quantity AS requested_quantity,
            pri.quantity AS quantity,
            COALESCE(pri.received_quantity, 0) AS received_quantity,
            COALESCE(pri.estimated_unit_cost, 0) AS estimated_unit_cost,
            pri.notes
          FROM pr_items pri
          LEFT JOIN master_items mi ON mi.id = pri.master_item_id
          WHERE pri.pr_id = ?
          ORDER BY pri.id ASC
        `,
        [req.params.id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    pr.items = items;
    res.json({ success: true, data: pr });
  } catch (error) {
    logger.error('Error getting PR detail:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/prs/:id/receive', async (req, res) => {
  try {
    const { items = [], po_number, received_date } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'items array is required' });
    }

    const prId = parseInt(req.params.id, 10);
    if (Number.isNaN(prId)) {
      return res.status(400).json({ success: false, error: 'Invalid PR id' });
    }

    await new Promise((resolve, reject) => {
      db.db.run('BEGIN TRANSACTION', (err) => (err ? reject(err) : resolve()));
    });

    let receivedCount = 0;
    for (const item of items) {
      const prItemId = parseInt(item.pr_item_id, 10);
      const receivedQty = parseInt(item.received_quantity, 10);

      if (Number.isNaN(prItemId) || Number.isNaN(receivedQty) || receivedQty <= 0) {
        continue;
      }

      await new Promise((resolve, reject) => {
        db.db.run(
          `
            UPDATE pr_items
            SET received_quantity = COALESCE(received_quantity, 0) + ?
            WHERE id = ? AND pr_id = ?
          `,
          [receivedQty, prItemId, prId],
          function(err) {
            if (err) reject(err);
            else resolve(this.changes);
          }
        );
      });

      receivedCount += 1;
    }

    const prItems = await new Promise((resolve, reject) => {
      db.db.all(
        'SELECT quantity, COALESCE(received_quantity, 0) as received_quantity FROM pr_items WHERE pr_id = ?',
        [prId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    const hasAny = prItems.some((row) => row.received_quantity > 0);
    const allDone = prItems.length > 0 && prItems.every((row) => row.received_quantity >= row.quantity);
    const status = allDone ? 'fully_received' : hasAny ? 'partially_received' : 'ordered';

    await new Promise((resolve, reject) => {
      db.db.run(
        'UPDATE purchase_requisitions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, prId],
        (err) => (err ? reject(err) : resolve())
      );
    });

    await new Promise((resolve, reject) => {
      db.db.run('COMMIT', (err) => (err ? reject(err) : resolve()));
    });

    res.json({
      success: true,
      data: {
        status,
        po_number: po_number || null,
        received_date: received_date || new Date().toISOString().split('T')[0],
        received_count: receivedCount
      }
    });
  } catch (error) {
    await new Promise((resolve) => db.db.run('ROLLBACK', () => resolve()));
    logger.error('Error receiving PR items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/prs/:id/eta', async (req, res) => {
  try {
    const hasPrTable = await tableExists('purchase_requisitions');
    if (!hasPrTable) {
      return res.status(404).json({ success: false, error: 'PR feature not initialized' });
    }

    const prId = parseInt(req.params.id, 10);
    if (Number.isNaN(prId)) {
      return res.status(400).json({ success: false, error: 'Invalid PR id' });
    }

    const { required_date, reason } = req.body || {};
    if (!required_date || !/^\d{4}-\d{2}-\d{2}$/.test(required_date)) {
      return res.status(400).json({ success: false, error: 'required_date must be YYYY-MM-DD' });
    }

    const existingPr = await new Promise((resolve, reject) => {
      db.db.get(
        'SELECT id, pr_number, required_date, notes FROM purchase_requisitions WHERE id = ?',
        [prId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!existingPr) {
      return res.status(404).json({ success: false, error: 'PR not found' });
    }

    const cleanReason = typeof reason === 'string' ? reason.trim() : '';
    let nextNotes = existingPr.notes || null;
    if (cleanReason) {
      const previousDate = existingPr.required_date || 'N/A';
      const auditLine = `[ETA Updated ${previousDate} -> ${required_date}] ${cleanReason}`;
      nextNotes = nextNotes ? `${nextNotes}\n${auditLine}` : auditLine;
    }

    await new Promise((resolve, reject) => {
      db.db.run(
        'UPDATE purchase_requisitions SET required_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [required_date, nextNotes, prId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });

    const updatedPr = await new Promise((resolve, reject) => {
      db.db.get(
        'SELECT id, pr_number, status, required_date, notes, updated_at FROM purchase_requisitions WHERE id = ?',
        [prId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    logger.info(`Updated ETA for PR ${updatedPr.pr_number}: ${existingPr.required_date} -> ${required_date}`);
    res.json({ success: true, data: updatedPr });
  } catch (error) {
    logger.error('Error updating PR ETA:', error);
    res.status(500).json({ success: false, error: error.message });
  }
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
