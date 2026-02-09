const Database = require('./database');
const { seedAdditionalItems } = require('./seedData');
const path = require('path');

// Simple logger
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg, err) => console.error(`[ERROR] ${msg}`, err),
};

async function runExtraSeed() {
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

    // Seed additional 100 items
    console.log('🌱 Starting additional seeding...\n');
    await seedAdditionalItems(db, 100);

    console.log('\n✅ Additional seeding completed!');
    console.log('\n📊 Total items in database: ~300');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
}

runExtraSeed();
