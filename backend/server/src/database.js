const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
  constructor(dbPath, logger) {
    this.dbPath = dbPath;
    this.logger = logger;
    this.db = null;
    this.ready = false;
  }

  initialize() {
    // Ensure directory exists
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        this.logger.error('Database connection error:', err);
        return;
      }
      this.logger.info('Connected to SQLite database');
      this.createTables();
    });
  }

  createTables() {
    const schema = `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'user',
        avatar_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      );

      -- Items table (enhanced with inventory planning fields)
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        quantity INTEGER DEFAULT 0,
        unit TEXT DEFAULT 'pcs',
        min_quantity INTEGER DEFAULT 0,
        reorder_point INTEGER DEFAULT 0,
        reorder_quantity INTEGER DEFAULT 0,
        safety_stock INTEGER DEFAULT 0,
        lead_time_days INTEGER DEFAULT 7,
        unit_cost REAL DEFAULT 0,
        supplier_name TEXT,
        supplier_contact TEXT,
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Locations table
      CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_address TEXT UNIQUE NOT NULL,
        zone TEXT,
        shelf TEXT,
        row INTEGER,
        column INTEGER,
        description TEXT,
        capacity INTEGER DEFAULT 100,
        current_utilization INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Item locations (many-to-many relationship)
      CREATE TABLE IF NOT EXISTS item_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        location_id INTEGER NOT NULL,
        quantity INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
        UNIQUE(item_id, location_id)
      );

      -- Stock transactions (receive, pick, adjust)
      CREATE TABLE IF NOT EXISTS stock_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        location_id INTEGER,
        transaction_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        reference_number TEXT,
        notes TEXT,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      -- Purchase orders
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_number TEXT UNIQUE NOT NULL,
        item_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_cost REAL DEFAULT 0,
        total_cost REAL DEFAULT 0,
        supplier_name TEXT,
        status TEXT DEFAULT 'pending',
        expected_date DATE,
        received_date DATE,
        notes TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      );

      -- Pick events (from hardware)
      CREATE TABLE IF NOT EXISTS pick_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_address TEXT NOT NULL,
        event_type TEXT DEFAULT 'button_press',
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (node_address) REFERENCES locations(node_address)
      );

      -- Gateway status
      CREATE TABLE IF NOT EXISTS gateway_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gateway_id TEXT,
        status TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_items_sku ON items(sku);
      CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
      CREATE INDEX IF NOT EXISTS idx_locations_address ON locations(node_address);
      CREATE INDEX IF NOT EXISTS idx_locations_zone ON locations(zone);
      CREATE INDEX IF NOT EXISTS idx_events_address ON pick_events(node_address);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON pick_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_transactions_item ON stock_transactions(item_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON stock_transactions(transaction_type);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON stock_transactions(created_at);
      CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `;

    this.db.exec(schema, (err) => {
      if (err) {
        this.logger.error('Error creating tables:', err);
      } else {
        this.logger.info('Database schema initialized');
        this.ready = true;
      }
    });
  }

  isReady() {
    return this.ready;
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          this.logger.error('Error closing database:', err);
        } else {
          this.logger.info('Database connection closed');
        }
      });
    }
  }
}

module.exports = Database;