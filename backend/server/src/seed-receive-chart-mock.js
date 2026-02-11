const path = require('path');
const Database = require('./database');

const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg, err) => console.error(`[ERROR] ${msg}`, err),
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const buildWeeklyPlan = (variation = 0) => {
  // 12 weekly slots (from oldest -> newest) for a 3M step chart.
  // Shape target:
  // 100 -> 87 -> 73 -> 59 -> 59 -> 26 -> 26 -> 105 -> 101 -> 97 -> 95 -> 95 -> 95
  return [
    { pick: 13 + variation }, // W1
    { pick: 14 }, // W2
    { pick: 14 }, // W3 (cross reorder)
    {}, // W4 (order placed / waiting)
    { pick: 33 - variation }, // W5 (touch safety)
    {}, // W6 (expedited waiting)
    { receive: 79 + variation }, // W7 (order arrives jump)
    { pick: 4 }, // W8
    { pick: 4 }, // W9
    { pick: 2 }, // W10
    {}, // W11
    {}, // W12 (today close)
  ];
};

async function waitForReady(db) {
  await new Promise((resolve) => {
    const timer = setInterval(() => {
      if (db.isReady()) {
        clearInterval(timer);
        resolve();
      }
    }, 100);
  });
}

async function seedReceiveChartMock() {
  const dbPath = path.join(__dirname, '../data/warehouse.db');
  const db = new Database(dbPath, logger);
  db.initialize();
  await waitForReady(db);

  const items = await db.all(
    `SELECT id, sku, quantity, reorder_point, reorder_quantity, safety_stock, lead_time_days
     FROM items
     ORDER BY id ASC`
  );

  if (!items.length) {
    logger.info('No items found. Seed base data first.');
    return;
  }

  await db.run(`DELETE FROM stock_transactions WHERE notes LIKE 'MOCK_CHART_%'`);

  const today = startOfDay(new Date());
  const startDate = addDays(today, -84);
  let insertCount = 0;
  let updateCount = 0;

  for (const item of items) {
    const variation = item.id % 3; // subtle variance while keeping the same shape
    const weeklyPlan = buildWeeklyPlan(variation);
    const finalOnHand = 95 + variation;
    const reorderPoint = 60;
    const safetyStock = 26;
    const reorderQty = 80 + variation;
    const leadTimeDays = 14;

    await db.run(
      `UPDATE items
       SET quantity = ?, reorder_point = ?, safety_stock = ?, reorder_quantity = ?, lead_time_days = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [finalOnHand, reorderPoint, safetyStock, reorderQty, leadTimeDays, item.id]
    );
    updateCount += 1;

    for (let week = 1; week <= weeklyPlan.length; week += 1) {
      const pointDate = week === weeklyPlan.length ? today : addDays(startDate, week * 7);
      const plan = weeklyPlan[week - 1];
      const pickQty = Number(plan.pick || 0);
      const receiveQty = Number(plan.receive || 0);

      if (pickQty > 0) {
        const pickDate = new Date(pointDate.getFullYear(), pointDate.getMonth(), pointDate.getDate(), 10, 15, 0).toISOString();
        await db.run(
          `INSERT INTO stock_transactions
           (item_id, location_id, transaction_type, quantity, reference_number, notes, user_id, created_at)
           VALUES (?, NULL, 'pick', ?, ?, ?, 1, ?)`,
          [
            item.id,
            -Math.abs(pickQty),
            `MOCK-PICK-${item.id}-W${week}`,
            `MOCK_CHART_PICK_${item.sku || item.id}`,
            pickDate,
          ]
        );
        insertCount += 1;
      }

      if (receiveQty > 0) {
        const receiveDate = new Date(pointDate.getFullYear(), pointDate.getMonth(), pointDate.getDate(), 15, 20, 0).toISOString();
        await db.run(
          `INSERT INTO stock_transactions
           (item_id, location_id, transaction_type, quantity, reference_number, notes, user_id, created_at)
           VALUES (?, NULL, 'receive', ?, ?, ?, 1, ?)`,
          [
            item.id,
            receiveQty,
            `MOCK-RECV-${item.id}-W${week}`,
            `MOCK_CHART_RECEIVE_${item.sku || item.id}`,
            receiveDate,
          ]
        );
        insertCount += 1;
      }
    }
  }

  logger.info(`Updated ${updateCount} items and inserted ${insertCount} mock stock transactions for receive chart.`);
  db.close();
}

seedReceiveChartMock()
  .then(() => {
    console.log('✅ Done seeding receive chart mock data');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to seed receive chart mock data', error);
    process.exit(1);
  });
