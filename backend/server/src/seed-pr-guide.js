require('dotenv').config();
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

function formatDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function openDb(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function close(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function tableExists(db, tableName) {
  const row = await get(
    db,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [tableName]
  );
  return !!row;
}

async function getColumns(db, tableName) {
  try {
    return await all(db, `PRAGMA table_info(${tableName})`);
  } catch {
    return [];
  }
}

async function ensureColumn(db, tableName, columnName, definition) {
  const columns = await getColumns(db, tableName);
  if (!columns.find((column) => column.name === columnName)) {
    await run(db, `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function ensureCoreTables(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  const hasMasterItems = await tableExists(db, 'master_items');
  if (!hasMasterItems) {
    await run(
      db,
      `CREATE TABLE master_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT,
        unit TEXT DEFAULT 'pcs',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    );
  } else {
    await ensureColumn(db, 'master_items', 'is_active', 'INTEGER DEFAULT 1');
  }

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS purchase_requisitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pr_number TEXT UNIQUE NOT NULL,
      store_id INTEGER NOT NULL,
      requester_id INTEGER NOT NULL,
      status TEXT DEFAULT 'ordered',
      priority TEXT DEFAULT 'normal',
      required_date DATE,
      notes TEXT,
      approved_by INTEGER,
      approved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS pr_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pr_id INTEGER NOT NULL,
      master_item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      estimated_unit_cost REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      received_quantity INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await ensureColumn(db, 'users', 'department_id', 'INTEGER');
  await ensureColumn(db, 'users', 'store_id', 'INTEGER');
  await ensureColumn(db, 'users', 'is_active', 'INTEGER DEFAULT 1');
  await ensureColumn(db, 'pr_items', 'received_quantity', 'INTEGER DEFAULT 0');
}

async function ensureBaseRefs(db) {
  let department = await get(db, "SELECT id FROM departments WHERE code = 'DEMO'");
  if (!department) {
    const result = await run(
      db,
      "INSERT INTO departments (code, name, description, is_active) VALUES ('DEMO', 'Demo Department', 'PR Guide seed data', 1)"
    );
    department = { id: result.id };
  }

  let store = await get(db, "SELECT id FROM stores WHERE code = 'DEMO-STORE'");
  if (!store) {
    const result = await run(
      db,
      'INSERT INTO stores (department_id, code, name, description, is_active) VALUES (?, ?, ?, ?, 1)',
      [department.id, 'DEMO-STORE', 'Demo Store', 'Used for PR receive guide']
    );
    store = { id: result.id };
  }

  let user = await get(db, 'SELECT id FROM users WHERE store_id = ? LIMIT 1', [store.id]);
  if (!user) {
    user = await get(db, 'SELECT id FROM users ORDER BY id LIMIT 1');
  }

  if (!user) {
    const hash = await bcrypt.hash('admin123', 10);
    const result = await run(
      db,
      `INSERT INTO users (username, password_hash, full_name, email, role, department_id, store_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      ['admin', hash, 'Administrator', 'admin@smartstorage.local', 'admin', department.id, store.id]
    );
    user = { id: result.id };
  } else {
    await run(
      db,
      'UPDATE users SET department_id = ?, store_id = ?, is_active = 1 WHERE id = ?',
      [department.id, store.id, user.id]
    );
  }

  return { departmentId: department.id, storeId: store.id, userId: user.id };
}

async function ensureMasterItems(db) {
  const hasAny = await get(
    db,
    'SELECT COUNT(*) as count FROM master_items WHERE COALESCE(is_active, 1) = 1'
  );

  if (hasAny && hasAny.count >= 8) {
    return;
  }

  const hasLegacyItems = await tableExists(db, 'items');
  if (hasLegacyItems) {
    const legacy = await all(
      db,
      'SELECT sku, name, category, unit FROM items WHERE sku IS NOT NULL AND name IS NOT NULL ORDER BY id LIMIT 12'
    );

    for (const item of legacy) {
      await run(
        db,
        `INSERT OR IGNORE INTO master_items (sku, name, category, unit, is_active)
         VALUES (?, ?, ?, COALESCE(?, 'pcs'), 1)`,
        [item.sku, item.name, item.category || 'General', item.unit || 'pcs']
      );
    }
  }

  const fallbackItems = [
    ['MOCK-GLV-001', 'Safety Gloves', 'Safety', 'pairs'],
    ['MOCK-TAPE-010', 'Packaging Tape', 'Packaging', 'rolls'],
    ['MOCK-LBL-007', 'Barcode Labels', 'Packaging', 'packs'],
    ['MOCK-WRP-021', 'Pallet Wrap', 'Packaging', 'rolls'],
    ['MOCK-BAT-032', 'Battery Pack AA', 'Electrical', 'boxes'],
    ['MOCK-BXM-111', 'Carton Box M', 'Packaging', 'pcs'],
    ['MOCK-TAG-015', 'Pallet Tag', 'Office', 'pcs'],
    ['MOCK-MRK-006', 'Warehouse Marker', 'Office', 'pcs'],
  ];

  for (const [sku, name, category, unit] of fallbackItems) {
    await run(
      db,
      `INSERT OR IGNORE INTO master_items (sku, name, category, unit, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [sku, name, category, unit]
    );
  }
}

async function upsertPrGuideData(db, storeId, userId) {
  const sourceItems = await all(
    db,
    'SELECT id, sku, name FROM master_items WHERE COALESCE(is_active, 1) = 1 ORDER BY id LIMIT 8'
  );

  if (sourceItems.length < 4) {
    throw new Error('Not enough master_items for PR guide seeding');
  }

  const today = new Date();
  const templates = [
    {
      prNumber: 'PR-DEMO-TODAY-001',
      status: 'ordered',
      priority: 'high',
      requiredDate: formatDateOnly(today),
      notes: 'Demo incoming today (DB seed)',
      items: [
        { itemId: sourceItems[0].id, qty: 120, unitCost: 12.5, receivedQty: 0 },
        { itemId: sourceItems[1].id, qty: 48, unitCost: 35, receivedQty: 0 },
      ],
    },
    {
      prNumber: 'PR-DEMO-TODAY-002',
      status: 'partially_received',
      priority: 'normal',
      requiredDate: formatDateOnly(today),
      notes: 'Demo partially received today (DB seed)',
      items: [
        { itemId: sourceItems[2].id, qty: 300, unitCost: 4.2, receivedQty: 120 },
        { itemId: sourceItems[3].id, qty: 24, unitCost: 16, receivedQty: 8 },
      ],
    },
    {
      prNumber: 'PR-DEMO-WEEK-001',
      status: 'ordered',
      priority: 'normal',
      requiredDate: formatDateOnly(addDays(today, 2)),
      notes: 'Demo incoming this week (DB seed)',
      items: [
        { itemId: sourceItems[4].id, qty: 96, unitCost: 28.9, receivedQty: 0 },
        { itemId: sourceItems[5].id, qty: 220, unitCost: 2.4, receivedQty: 0 },
      ],
    },
    {
      prNumber: 'PR-DEMO-WEEK-002',
      status: 'ordered',
      priority: 'normal',
      requiredDate: formatDateOnly(addDays(today, 4)),
      notes: 'Demo incoming later this week (DB seed)',
      items: [
        { itemId: sourceItems[6].id, qty: 500, unitCost: 1.2, receivedQty: 0 },
        { itemId: sourceItems[7].id, qty: 36, unitCost: 44, receivedQty: 0 },
      ],
    },
  ];

  for (const template of templates) {
    let pr = await get(
      db,
      'SELECT id FROM purchase_requisitions WHERE pr_number = ?',
      [template.prNumber]
    );

    if (!pr) {
      const created = await run(
        db,
        `INSERT INTO purchase_requisitions
         (pr_number, store_id, requester_id, status, priority, required_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          template.prNumber,
          storeId,
          userId,
          template.status,
          template.priority,
          template.requiredDate,
          template.notes,
        ]
      );
      pr = { id: created.id };
    } else {
      await run(
        db,
        `UPDATE purchase_requisitions
         SET store_id = ?, requester_id = ?, status = ?, priority = ?, required_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          storeId,
          userId,
          template.status,
          template.priority,
          template.requiredDate,
          template.notes,
          pr.id,
        ]
      );
    }

    await run(db, 'DELETE FROM pr_items WHERE pr_id = ?', [pr.id]);

    for (const line of template.items) {
      await run(
        db,
        `INSERT INTO pr_items
         (pr_id, master_item_id, quantity, estimated_unit_cost, notes, status, received_quantity)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        [pr.id, line.itemId, line.qty, line.unitCost, 'Seeded for Receive page', line.receivedQty]
      );
    }
  }
}

async function printSummary(db) {
  const rows = await all(
    db,
    `SELECT pr.pr_number, pr.status, pr.required_date, COUNT(pri.id) AS item_count
     FROM purchase_requisitions pr
     LEFT JOIN pr_items pri ON pri.pr_id = pr.id
     WHERE pr.pr_number LIKE 'PR-DEMO-%'
     GROUP BY pr.id
     ORDER BY pr.required_date ASC, pr.pr_number ASC`
  );

  console.log('[INFO] Seeded PR guide records:');
  for (const row of rows) {
    console.log(`  - ${row.pr_number} | ${row.status} | ${row.required_date} | ${row.item_count} items`);
  }
}

async function runSeed() {
  const dbPath = process.env.DATABASE_PATH
    ? path.resolve(__dirname, '..', process.env.DATABASE_PATH)
    : path.join(__dirname, '../data/warehouse.db');

  console.log(`[INFO] Using database: ${dbPath}`);
  const db = await openDb(dbPath);

  try {
    await ensureCoreTables(db);
    const refs = await ensureBaseRefs(db);
    await ensureMasterItems(db);
    await upsertPrGuideData(db, refs.storeId, refs.userId);
    await printSummary(db);
    console.log('[INFO] PR guide data seeding completed.');
  } finally {
    await close(db);
  }
}

runSeed().catch((error) => {
  console.error('[ERROR] Failed to seed PR guide data:', error);
  process.exit(1);
});

