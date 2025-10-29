const Database = require('./database');
const { seedDatabase } = require('./seedData');
const path = require('path');

// Simple logger
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg, err) => console.error(`[ERROR] ${msg}`, err),
};

async function runSeed() {
  const dbPath = path.join(__dirname, '../data/warehouse.db');
  const db = new Database(dbPath, logger);

  try {
    // Initialize database
    db.initialize();

    // Wait for database to be ready
    await new Promise((resolve) => {
      const checkReady = setInterval(() => {
        if (db.isReady()) {
          clearInterval(checkReady);
          resolve();
        }
      }, 100);
    });

    // Run seed
    await seedDatabase(db);

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - 5 users created');
    console.log('   - 200 items created');
    console.log('   - 400 locations created');
    console.log('   - 500 transactions created');
    console.log('   - 50 purchase orders created');
    console.log('\n🔐 Login credentials:');
    console.log('   Admin:    admin / admin123');
    console.log('   Manager:  manager / manager123');
    console.log('   Operator: operator / operator123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
}

runSeed();

