const bcrypt = require('bcryptjs');

// Categories for items
const categories = [
  'Electronics', 'Tools', 'Office Supplies', 'Hardware', 'Safety Equipment',
  'Cleaning Supplies', 'Packaging Materials', 'Raw Materials', 'Components', 'Consumables'
];

// Suppliers
const suppliers = [
  { name: 'Tech Supply Co.', contact: 'tech@supply.com' },
  { name: 'Industrial Parts Ltd.', contact: 'sales@industrial.com' },
  { name: 'Office Depot', contact: 'orders@officedepot.com' },
  { name: 'Hardware Solutions', contact: 'info@hwsolutions.com' },
  { name: 'Safety First Inc.', contact: 'contact@safetyfirst.com' },
  { name: 'Clean Pro Supplies', contact: 'sales@cleanpro.com' },
  { name: 'Pack & Ship', contact: 'orders@packship.com' },
  { name: 'Material Masters', contact: 'info@materialmaster.com' }
];

// Item name templates
const itemPrefixes = [
  'Premium', 'Standard', 'Heavy Duty', 'Professional', 'Industrial',
  'Compact', 'Deluxe', 'Economy', 'Advanced', 'Basic'
];

const itemTypes = [
  'Screwdriver', 'Wrench', 'Hammer', 'Drill Bit', 'Cable', 'Connector',
  'Switch', 'Sensor', 'Motor', 'Battery', 'Capacitor', 'Resistor',
  'LED Light', 'Power Supply', 'Adapter', 'Bracket', 'Mounting Plate',
  'Screw Set', 'Bolt Kit', 'Washer Pack', 'Nut Assortment', 'Spring Set',
  'Bearing', 'Gear', 'Pulley', 'Belt', 'Chain', 'Hose', 'Valve', 'Fitting',
  'Tape', 'Adhesive', 'Lubricant', 'Cleaner', 'Polish', 'Coating',
  'Wire', 'Tube', 'Rod', 'Sheet', 'Panel', 'Frame', 'Housing', 'Cover',
  'Filter', 'Gasket', 'Seal', 'O-Ring', 'Clamp', 'Clip', 'Pin', 'Rivet'
];

// Generate random item name
function generateItemName() {
  const prefix = itemPrefixes[Math.floor(Math.random() * itemPrefixes.length)];
  const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
  const size = ['Small', 'Medium', 'Large', 'XL'][Math.floor(Math.random() * 4)];
  return `${prefix} ${type} ${size}`;
}

// Generate SKU
function generateSKU(index) {
  const category = categories[index % categories.length].substring(0, 3).toUpperCase();
  const num = String(index + 1).padStart(5, '0');
  return `${category}-${num}`;
}

// Generate random date in the past
function randomPastDate(daysBack) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  return date.toISOString();
}

// Seed users
async function seedUsers(db) {
  console.log('Seeding users...');
  
  const users = [
    {
      username: 'admin',
      password: 'admin123',
      full_name: 'Admin User',
      email: 'admin@smartstorage.com',
      role: 'admin',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin'
    },
    {
      username: 'manager',
      password: 'manager123',
      full_name: 'Warehouse Manager',
      email: 'manager@smartstorage.com',
      role: 'manager',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=manager'
    },
    {
      username: 'operator',
      password: 'operator123',
      full_name: 'Warehouse Operator',
      email: 'operator@smartstorage.com',
      role: 'user',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=operator'
    },
    {
      username: 'john',
      password: 'john123',
      full_name: 'John Smith',
      email: 'john@smartstorage.com',
      role: 'user',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john'
    },
    {
      username: 'sarah',
      password: 'sarah123',
      full_name: 'Sarah Johnson',
      email: 'sarah@smartstorage.com',
      role: 'user',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah'
    }
  ];

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await db.run(
      `INSERT OR IGNORE INTO users (username, password_hash, full_name, email, role, avatar_url, last_login)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.username, passwordHash, user.full_name, user.email, user.role, user.avatar_url, new Date().toISOString()]
    );
  }
  
  console.log(`✓ Seeded ${users.length} users`);
}

// Seed items (200 items)
async function seedItems(db) {
  console.log('Seeding items...');
  
  const itemCount = 200;
  
  for (let i = 0; i < itemCount; i++) {
    const category = categories[i % categories.length];
    const supplier = suppliers[i % suppliers.length];
    const sku = generateSKU(i);
    const name = generateItemName();
    
    // Random inventory levels
    const quantity = Math.floor(Math.random() * 500);
    const reorderPoint = Math.floor(Math.random() * 50) + 20;
    const reorderQuantity = Math.floor(Math.random() * 100) + 50;
    const safetyStock = Math.floor(Math.random() * 30) + 10;
    const minQuantity = Math.floor(reorderPoint * 0.5);
    const leadTimeDays = Math.floor(Math.random() * 14) + 3;
    const unitCost = (Math.random() * 500 + 10).toFixed(2);
    
    await db.run(
      `INSERT OR IGNORE INTO items (
        sku, name, description, category, quantity, unit,
        min_quantity, reorder_point, reorder_quantity, safety_stock,
        lead_time_days, unit_cost, supplier_name, supplier_contact,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sku,
        name,
        `High-quality ${name.toLowerCase()} for industrial use`,
        category,
        quantity,
        'pcs',
        minQuantity,
        reorderPoint,
        reorderQuantity,
        safetyStock,
        leadTimeDays,
        unitCost,
        supplier.name,
        supplier.contact,
        randomPastDate(180),
        new Date().toISOString()
      ]
    );
  }
  
  console.log(`✓ Seeded ${itemCount} items`);
}

// Seed locations
async function seedLocations(db) {
  console.log('Seeding locations...');
  
  const zones = ['A', 'B', 'C', 'D'];
  const shelves = ['1', '2', '3', '4', '5'];
  let locationCount = 0;
  
  for (const zone of zones) {
    for (const shelf of shelves) {
      for (let row = 1; row <= 5; row++) {
        for (let col = 1; col <= 4; col++) {
          const nodeAddress = `${zone}${shelf}${row}${col}`;
          const capacity = Math.floor(Math.random() * 50) + 50;
          const utilization = Math.floor(Math.random() * capacity);
          
          await db.run(
            `INSERT OR IGNORE INTO locations (
              node_address, zone, shelf, row, column, description,
              capacity, current_utilization, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              nodeAddress,
              zone,
              shelf,
              row,
              col,
              `Zone ${zone}, Shelf ${shelf}, Row ${row}, Col ${col}`,
              capacity,
              utilization,
              randomPastDate(365),
              new Date().toISOString()
            ]
          );
          locationCount++;
        }
      }
    }
  }
  
  console.log(`✓ Seeded ${locationCount} locations`);
}

// Seed stock transactions
async function seedTransactions(db) {
  console.log('Seeding stock transactions...');
  
  const transactionTypes = ['receive', 'pick', 'adjust'];
  const transactionCount = 500;
  
  for (let i = 0; i < transactionCount; i++) {
    const itemId = Math.floor(Math.random() * 200) + 1;
    const locationId = Math.floor(Math.random() * 400) + 1;
    const type = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
    const quantity = type === 'pick' ? -Math.floor(Math.random() * 20) - 1 : Math.floor(Math.random() * 50) + 1;
    const userId = Math.floor(Math.random() * 5) + 1;
    
    await db.run(
      `INSERT INTO stock_transactions (
        item_id, location_id, transaction_type, quantity,
        reference_number, notes, user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        locationId,
        type,
        quantity,
        `TXN-${String(i + 1).padStart(6, '0')}`,
        `${type.charAt(0).toUpperCase() + type.slice(1)} transaction`,
        userId,
        randomPastDate(90)
      ]
    );
  }
  
  console.log(`✓ Seeded ${transactionCount} transactions`);
}

// Seed purchase orders
async function seedPurchaseOrders(db) {
  console.log('Seeding purchase orders...');
  
  const statuses = ['pending', 'approved', 'ordered', 'received', 'cancelled'];
  const poCount = 50;
  
  for (let i = 0; i < poCount; i++) {
    const itemId = Math.floor(Math.random() * 200) + 1;
    const quantity = Math.floor(Math.random() * 100) + 20;
    const unitCost = (Math.random() * 500 + 10).toFixed(2);
    const totalCost = (quantity * unitCost).toFixed(2);
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
    
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + Math.floor(Math.random() * 30));
    
    await db.run(
      `INSERT INTO purchase_orders (
        po_number, item_id, quantity, unit_cost, total_cost,
        supplier_name, status, expected_date, notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `PO-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`,
        itemId,
        quantity,
        unitCost,
        totalCost,
        supplier.name,
        status,
        expectedDate.toISOString().split('T')[0],
        `Purchase order for restocking`,
        Math.floor(Math.random() * 2) + 1, // admin or manager
        randomPastDate(60)
      ]
    );
  }
  
  console.log(`✓ Seeded ${poCount} purchase orders`);
}

// Main seed function
async function seedDatabase(db) {
  console.log('🌱 Starting database seeding...\n');
  
  try {
    await seedUsers(db);
    await seedItems(db);
    await seedLocations(db);
    await seedTransactions(db);
    await seedPurchaseOrders(db);
    
    console.log('\n✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

module.exports = { seedDatabase };

