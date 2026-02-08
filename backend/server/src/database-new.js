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
      -- ============================================
      -- 1. DEPARTMENTS & STORES (Multi-tenancy)
      -- ============================================
      
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        department_id INTEGER NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
        UNIQUE(department_id, code)
      );

      -- ============================================
      -- 2. USERS (Linked to Store)
      -- ============================================
      
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'user',
        department_id INTEGER,
        store_id INTEGER,
        avatar_url TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
        FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
      );

      -- ============================================
      -- 3. MASTER ITEMS (Global Catalog)
      -- ============================================
      -- แก้ปัญหา: แผนกต่างกันซื้อของชื่อไม่统一
      
      CREATE TABLE IF NOT EXISTS master_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        barcode TEXT,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        sub_category TEXT,
        unit TEXT DEFAULT 'pcs',
        specifications TEXT, -- JSON: {"color": "red", "size": "M"}
        image_url TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- สำหรับค้นหา items ที่คล้ายกัน (fuzzy search)
      CREATE TABLE IF NOT EXISTS master_item_aliases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        master_item_id INTEGER NOT NULL,
        alias_name TEXT NOT NULL,
        source_department_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (master_item_id) REFERENCES master_items(id) ON DELETE CASCADE,
        FOREIGN KEY (source_department_id) REFERENCES departments(id) ON DELETE SET NULL
      );

      -- ============================================
      -- 4. STORE ITEMS (Store-specific inventory)
      -- ============================================
      -- แต่ละ store มีสต็อกของตัวเอง
      
      CREATE TABLE IF NOT EXISTS store_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL,
        master_item_id INTEGER NOT NULL,
        local_sku TEXT, -- ถ้า store อยากใช้ SKU ของตัวเอง
        local_name TEXT, -- ชื่อที่ store เรียก
        quantity INTEGER DEFAULT 0,
        min_quantity INTEGER DEFAULT 0,
        reorder_point INTEGER DEFAULT 0,
        reorder_quantity INTEGER DEFAULT 0,
        safety_stock INTEGER DEFAULT 0,
        lead_time_days INTEGER DEFAULT 7,
        location_zone TEXT,
        location_shelf TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
        FOREIGN KEY (master_item_id) REFERENCES master_items(id) ON DELETE CASCADE,
        UNIQUE(store_id, master_item_id)
      );

      -- ============================================
      -- 5. INVENTORY LOTS (ราคาตาม lot)
      -- ============================================
      -- แก้ปัญหา: ราคาซื้อไม่เท่ากันในแต่ละ lot
      
      CREATE TABLE IF NOT EXISTS inventory_lots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_item_id INTEGER NOT NULL,
        lot_number TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_cost REAL NOT NULL,
        total_cost REAL NOT NULL,
        received_date DATE NOT NULL,
        expiry_date DATE,
        pr_id INTEGER,
        po_id INTEGER,
        supplier_name TEXT,
        invoice_number TEXT,
        remaining_quantity INTEGER NOT NULL,
        status TEXT DEFAULT 'active', -- active, depleted, expired
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (store_item_id) REFERENCES store_items(id) ON DELETE CASCADE
      );

      -- ============================================
      -- 6. PURCHASE REQUISITIONS (PR)
      -- ============================================
      -- แก้ปัญหา: แยก PR จาก PO
      
      CREATE TABLE IF NOT EXISTS purchase_requisitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_number TEXT UNIQUE NOT NULL,
        store_id INTEGER NOT NULL,
        requester_id INTEGER NOT NULL,
        status TEXT DEFAULT 'draft', -- draft, pending, approved, rejected, converted_to_po
        priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
        required_date DATE,
        notes TEXT,
        approved_by INTEGER,
        approved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
        FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS pr_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_id INTEGER NOT NULL,
        master_item_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        estimated_unit_cost REAL,
        notes TEXT,
        status TEXT DEFAULT 'pending', -- pending, approved, rejected
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pr_id) REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
        FOREIGN KEY (master_item_id) REFERENCES master_items(id) ON DELETE CASCADE
      );

      -- ============================================
      -- 7. PURCHASE ORDERS (PO)
      -- ============================================
      -- PO บันทึกตอนรับของ (เลข PO จากผู้ขาย)
      
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_number TEXT NOT NULL,
        pr_id INTEGER NOT NULL,
        store_id INTEGER NOT NULL,
        supplier_name TEXT,
        supplier_contact TEXT,
        status TEXT DEFAULT 'ordered', -- ordered, received, cancelled
        order_date DATE,
        expected_delivery_date DATE,
        actual_delivery_date DATE,
        notes TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pr_id) REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
        FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(po_number, pr_id)
      );

      CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(po_number);
      CREATE INDEX IF NOT EXISTS idx_po_pr ON purchase_orders(pr_id);

      -- ============================================
      -- 8. STOCK TRANSACTIONS
      -- ============================================
      
      CREATE TABLE IF NOT EXISTS stock_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL,
        store_item_id INTEGER NOT NULL,
        lot_id INTEGER,
        transaction_type TEXT NOT NULL, -- receive, pick, adjust, transfer_in, transfer_out
        quantity INTEGER NOT NULL,
        unit_cost REAL, -- สำหรับ receive
        reference_type TEXT, -- pr, po, invoice, adjustment
        reference_id INTEGER,
        reference_number TEXT,
        notes TEXT,
        user_id INTEGER,
        source_store_id INTEGER, -- สำหรับ transfer
        target_store_id INTEGER, -- สำหรับ transfer
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
        FOREIGN KEY (store_item_id) REFERENCES store_items(id) ON DELETE CASCADE,
        FOREIGN KEY (lot_id) REFERENCES inventory_lots(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (source_store_id) REFERENCES stores(id) ON DELETE SET NULL,
        FOREIGN KEY (target_store_id) REFERENCES stores(id) ON DELETE SET NULL
      );

      -- ============================================
      -- 9. CROSS-DEPARTMENT PICKING
      -- ============================================
      -- เก็บประวัติการเบิกข้ามแผนก
      
      CREATE TABLE IF NOT EXISTS cross_department_picks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_store_id INTEGER NOT NULL,
        source_store_id INTEGER NOT NULL,
        master_item_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        status TEXT DEFAULT 'pending', -- pending, approved, picked, rejected
        requested_by INTEGER NOT NULL,
        approved_by INTEGER,
        picked_at DATETIME,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_store_id) REFERENCES stores(id) ON DELETE CASCADE,
        FOREIGN KEY (source_store_id) REFERENCES stores(id) ON DELETE CASCADE,
        FOREIGN KEY (master_item_id) REFERENCES master_items(id) ON DELETE CASCADE,
        FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
      );

      -- ============================================
      -- 10. DELIVERY SCHEDULES (สำหรับ Dashboard alerts)
      -- ============================================
      
      CREATE TABLE IF NOT EXISTS delivery_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_id INTEGER NOT NULL,
        scheduled_date DATE NOT NULL,
        status TEXT DEFAULT 'scheduled', -- scheduled, delivered, delayed, cancelled
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
      );

      -- ============================================
      -- 11. HARDWARE LOCATIONS (BLE Mesh)
      -- ============================================
      
      CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER,
        node_address TEXT UNIQUE NOT NULL,
        zone TEXT,
        shelf TEXT,
        row INTEGER,
        column INTEGER,
        description TEXT,
        capacity INTEGER DEFAULT 100,
        current_utilization INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS pick_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_address TEXT NOT NULL,
        event_type TEXT DEFAULT 'button_press',
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (node_address) REFERENCES locations(node_address)
      );

      CREATE TABLE IF NOT EXISTS gateway_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gateway_id TEXT,
        status TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- ============================================
      -- INDEXES
      -- ============================================
      
      CREATE INDEX IF NOT EXISTS idx_users_store ON users(store_id);
      CREATE INDEX IF NOT EXISTS idx_users_dept ON users(department_id);
      CREATE INDEX IF NOT EXISTS idx_stores_dept ON stores(department_id);
      
      CREATE INDEX IF NOT EXISTS idx_master_items_sku ON master_items(sku);
      CREATE INDEX IF NOT EXISTS idx_master_items_name ON master_items(name);
      CREATE INDEX IF NOT EXISTS idx_master_items_category ON master_items(category);
      CREATE INDEX IF NOT EXISTS idx_master_item_aliases ON master_item_aliases(alias_name);
      
      CREATE INDEX IF NOT EXISTS idx_store_items_store ON store_items(store_id);
      CREATE INDEX IF NOT EXISTS idx_store_items_master ON store_items(master_item_id);
      CREATE INDEX IF NOT EXISTS idx_store_items_qty ON store_items(quantity);
      
      CREATE INDEX IF NOT EXISTS idx_lots_store_item ON inventory_lots(store_item_id);
      CREATE INDEX IF NOT EXISTS idx_lots_status ON inventory_lots(status);
      CREATE INDEX IF NOT EXISTS idx_lots_received ON inventory_lots(received_date);
      
      CREATE INDEX IF NOT EXISTS idx_pr_store ON purchase_requisitions(store_id);
      CREATE INDEX IF NOT EXISTS idx_pr_status ON purchase_requisitions(status);
      CREATE INDEX IF NOT EXISTS idx_pr_required ON purchase_requisitions(required_date);
      
      CREATE INDEX IF NOT EXISTS idx_po_store ON purchase_orders(store_id);
      CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
      CREATE INDEX IF NOT EXISTS idx_po_expected ON purchase_orders(expected_delivery_date);
      
      CREATE INDEX IF NOT EXISTS idx_transactions_store ON stock_transactions(store_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON stock_transactions(transaction_type);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON stock_transactions(created_at);
      
      CREATE INDEX IF NOT EXISTS idx_delivery_schedule ON delivery_schedules(scheduled_date);
      CREATE INDEX IF NOT EXISTS idx_delivery_status ON delivery_schedules(status);

      -- ============================================
      -- 12. NOTIFICATIONS
      -- ============================================
      
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        data TEXT, -- JSON
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        read_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
      CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
      CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
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
