const bcrypt = require('bcryptjs');

/**
 * Seed data for new multi-store system
 */
async function seedDatabase(db, logger) {
  try {
    logger.info('Starting database seeding...');

    // Check if already seeded
    const existing = await db.get('SELECT COUNT(*) as count FROM departments');
    if (existing.count > 0) {
      logger.info('Database already seeded, skipping...');
      return;
    }

    // ==================== DEPARTMENTS ====================
    logger.info('Creating departments...');
    
    const departments = [
      { code: 'PROD', name: 'Production', description: 'Production department' },
      { code: 'MAINT', name: 'Maintenance', description: 'Maintenance department' },
      { code: 'QC', name: 'Quality Control', description: 'QC department' },
      { code: 'ADMIN', name: 'Administration', description: 'Admin department' }
    ];

    for (const dept of departments) {
      await db.run(
        'INSERT INTO departments (code, name, description) VALUES (?, ?, ?)',
        [dept.code, dept.name, dept.description]
      );
    }

    // Get department IDs
    const prodDept = await db.get("SELECT id FROM departments WHERE code = 'PROD'");
    const maintDept = await db.get("SELECT id FROM departments WHERE code = 'MAINT'");
    const qcDept = await db.get("SELECT id FROM departments WHERE code = 'QC'");
    const adminDept = await db.get("SELECT id FROM departments WHERE code = 'ADMIN'");

    // ==================== STORES ====================
    logger.info('Creating stores...');
    
    const stores = [
      { deptId: prodDept.id, code: 'PROD-A', name: 'Production Store A', description: 'Main production storage' },
      { deptId: prodDept.id, code: 'PROD-B', name: 'Production Store B', description: 'Secondary production storage' },
      { deptId: maintDept.id, code: 'MAINT-01', name: 'Maintenance Store', description: 'Maintenance parts storage' },
      { deptId: qcDept.id, code: 'QC-LAB', name: 'QC Lab Store', description: 'QC testing materials' },
      { deptId: adminDept.id, code: 'ADMIN-01', name: 'Admin Store', description: 'Office supplies' }
    ];

    for (const store of stores) {
      await db.run(
        'INSERT INTO stores (department_id, code, name, description) VALUES (?, ?, ?, ?)',
        [store.deptId, store.code, store.name, store.description]
      );
    }

    // Get store IDs
    const stores_map = {};
    for (const store of stores) {
      const row = await db.get('SELECT id FROM stores WHERE code = ?', [store.code]);
      stores_map[store.code] = row.id;
    }

    // ==================== USERS ====================
    logger.info('Creating users...');
    
    const passwordHash = await bcrypt.hash('admin123', 10);
    
    const users = [
      { username: 'admin', fullName: 'Administrator', email: 'admin@company.com', role: 'admin', deptId: adminDept.id, storeId: null },
      { username: 'prod-manager', fullName: 'Production Manager', email: 'prod@company.com', role: 'manager', deptId: prodDept.id, storeId: stores_map['PROD-A'] },
      { username: 'prod-user', fullName: 'Production User', email: 'produser@company.com', role: 'user', deptId: prodDept.id, storeId: stores_map['PROD-A'] },
      { username: 'maint-manager', fullName: 'Maintenance Manager', email: 'maint@company.com', role: 'manager', deptId: maintDept.id, storeId: stores_map['MAINT-01'] },
      { username: 'qc-user', fullName: 'QC Staff', email: 'qc@company.com', role: 'user', deptId: qcDept.id, storeId: stores_map['QC-LAB'] }
    ];

    for (const user of users) {
      await db.run(
        `INSERT INTO users (username, password_hash, full_name, email, role, department_id, store_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [user.username, passwordHash, user.fullName, user.email, user.role, user.deptId, user.storeId]
      );
    }

    // ==================== MASTER ITEMS ====================
    logger.info('Creating master items...');
    
    const masterItems = [
      { sku: 'SCREW-001', name: 'Stainless Steel Screw M4x20', category: 'Hardware', unit: 'pcs' },
      { sku: 'SCREW-002', name: 'Stainless Steel Screw M5x25', category: 'Hardware', unit: 'pcs' },
      { sku: 'BOLT-001', name: 'Hex Bolt M8x40', category: 'Hardware', unit: 'pcs' },
      { sku: 'NUT-001', name: 'Hex Nut M8', category: 'Hardware', unit: 'pcs' },
      { sku: 'WASHER-001', name: 'Flat Washer M8', category: 'Hardware', unit: 'pcs' },
      { sku: 'CABLE-001', name: 'Power Cable 3x1.5mm²', category: 'Electrical', unit: 'meters' },
      { sku: 'CABLE-002', name: 'Control Cable 2x0.75mm²', category: 'Electrical', unit: 'meters' },
      { sku: 'SWITCH-001', name: 'Limit Switch', category: 'Electrical', unit: 'pcs' },
      { sku: 'RELAY-001', name: 'Relay 24VDC', category: 'Electrical', unit: 'pcs' },
      { sku: 'BEARING-001', name: 'Ball Bearing 6204', category: 'Mechanical', unit: 'pcs' },
      { sku: 'BEARING-002', name: 'Ball Bearing 6205', category: 'Mechanical', unit: 'pcs' },
      { sku: 'BELT-001', name: 'Timing Belt 10mm', category: 'Mechanical', unit: 'pcs' },
      { sku: 'FILTER-001', name: 'Air Filter', category: 'Consumable', unit: 'pcs' },
      { sku: 'OIL-001', name: 'Lubricating Oil 5L', category: 'Consumable', unit: 'cans' },
      { sku: 'GREASE-001', name: 'Bearing Grease 1kg', category: 'Consumable', unit: 'cans' },
      { sku: 'PAPER-A4', name: 'A4 Paper 500 sheets', category: 'Office', unit: 'reams' },
      { sku: 'TONER-BK', name: 'Toner Cartridge Black', category: 'Office', unit: 'pcs' },
      { sku: 'GLOVE-S', name: 'Safety Gloves Size S', category: 'Safety', unit: 'pairs' },
      { sku: 'GLOVE-M', name: 'Safety Gloves Size M', category: 'Safety', unit: 'pairs' },
      { sku: 'GLASSES-001', name: 'Safety Glasses', category: 'Safety', unit: 'pcs' }
    ];

    for (const item of masterItems) {
      await db.run(
        'INSERT INTO master_items (sku, name, category, unit) VALUES (?, ?, ?, ?)',
        [item.sku, item.name, item.category, item.unit]
      );
    }

    logger.info('Database seeding completed successfully!');
    logger.info('Default login: admin / admin123');
    
  } catch (error) {
    logger.error('Error seeding database:', error);
    throw error;
  }
}

module.exports = seedDatabase;
