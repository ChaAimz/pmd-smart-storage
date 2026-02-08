/**
 * Cross-Department Picking Service
 * จัดการการเบิกของข้ามแผนก
 */
class CrossPickService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * ค้นหาของที่ต้องการจากทุก store (สำหรับเบิกข้ามแผนก)
   */
  async searchItemsAcrossStores(searchTerm, options = {}) {
    const { excludeStoreId, minQuantity = 1, category } = options;

    let sql = `
      SELECT 
        mi.id as master_item_id,
        mi.sku,
        mi.name as item_name,
        mi.description,
        mi.category,
        mi.unit,
        mi.image_url,
        si.id as store_item_id,
        si.store_id,
        si.quantity as available_quantity,
        si.local_name,
        s.name as store_name,
        s.code as store_code,
        d.id as department_id,
        d.name as department_name,
        CASE 
          WHEN LOWER(mi.name) = LOWER(?) THEN 100
          WHEN LOWER(mi.name) LIKE LOWER(?) THEN 80
          WHEN LOWER(mi.sku) = LOWER(?) THEN 70
          WHEN LOWER(mi.sku) LIKE LOWER(?) THEN 60
          WHEN LOWER(mia.alias_name) = LOWER(?) THEN 50
          WHEN LOWER(mia.alias_name) LIKE LOWER(?) THEN 40
          WHEN LOWER(mi.description) LIKE LOWER(?) THEN 20
          ELSE 10
        END as match_score
      FROM master_items mi
      LEFT JOIN master_item_aliases mia ON mi.id = mia.master_item_id
      JOIN store_items si ON mi.id = si.master_item_id
      JOIN stores s ON si.store_id = s.id
      JOIN departments d ON s.department_id = d.id
      WHERE si.is_active = 1
        AND si.quantity >= ?
        AND mi.is_active = 1
    `;

    const params = [
      searchTerm,              // exact match name
      `%${searchTerm}%`,       // partial name
      searchTerm,              // exact SKU
      `%${searchTerm}%`,       // partial SKU
      searchTerm,              // exact alias
      `%${searchTerm}%`,       // partial alias
      `%${searchTerm}%`,       // description
      minQuantity
    ];

    if (excludeStoreId) {
      sql += ` AND si.store_id != ?`;
      params.push(excludeStoreId);
    }

    if (category) {
      sql += ` AND mi.category = ?`;
      params.push(category);
    }

    sql += `
      GROUP BY si.id
      HAVING match_score >= 20
      ORDER BY match_score DESC, mi.name ASC
      LIMIT 20
    `;

    return await this.db.all(sql, params);
  }

  /**
   * สร้างคำขอเบิกข้ามแผนก
   */
  async createCrossDepartmentPick(data) {
    const {
      request_store_id,
      source_store_id,
      master_item_id,
      quantity,
      requested_by,
      notes
    } = data;

    // Validate stock availability
    const sourceItem = await this.db.get(
      `SELECT quantity FROM store_items 
       WHERE store_id = ? AND master_item_id = ?`,
      [source_store_id, master_item_id]
    );

    if (!sourceItem || sourceItem.quantity < quantity) {
      throw new Error('Insufficient stock in source store');
    }

    const sql = `
      INSERT INTO cross_department_picks 
      (request_store_id, source_store_id, master_item_id, quantity, requested_by, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `;

    const result = await this.db.run(sql, [
      request_store_id, source_store_id, master_item_id, quantity, requested_by, notes
    ]);

    this.logger.info(`Created cross-department pick request ${result.id}`);
    return { id: result.id };
  }

  /**
   * อนุมัติคำขอเบิกข้ามแผนก
   */
  async approveCrossPick(pickId, approverId) {
    const pick = await this.db.get(
      `SELECT * FROM cross_department_picks WHERE id = ?`,
      [pickId]
    );

    if (!pick || pick.status !== 'pending') {
      throw new Error('Invalid pick request or already processed');
    }

    // Update status
    await this.db.run(
      `UPDATE cross_department_picks 
       SET status = 'approved', approved_by = ?
       WHERE id = ?`,
      [approverId, pickId]
    );

    return true;
  }

  /**
   * ดำเนินการเบิกของ (after approved)
   */
  async executeCrossPick(pickId, userId) {
    const pick = await this.db.get(
      `SELECT * FROM cross_department_picks WHERE id = ?`,
      [pickId]
    );

    if (!pick || pick.status !== 'approved') {
      throw new Error('Pick must be approved first');
    }

    // Get store items
    const sourceItem = await this.db.get(
      `SELECT id, quantity FROM store_items 
       WHERE store_id = ? AND master_item_id = ?`,
      [pick.source_store_id, pick.master_item_id]
    );

    let targetItem = await this.db.get(
      `SELECT id FROM store_items 
       WHERE store_id = ? AND master_item_id = ?`,
      [pick.request_store_id, pick.master_item_id]
    );

    // Create target item if not exists
    if (!targetItem) {
      const result = await this.db.run(
        `INSERT INTO store_items (store_id, master_item_id, quantity) VALUES (?, ?, 0)`,
        [pick.request_store_id, pick.master_item_id]
      );
      targetItem = { id: result.id };
    }

    // Deduct from source
    await this.db.run(
      `UPDATE store_items SET quantity = quantity - ? WHERE id = ?`,
      [pick.quantity, sourceItem.id]
    );

    // Add to target
    await this.db.run(
      `UPDATE store_items SET quantity = quantity + ? WHERE id = ?`,
      [pick.quantity, targetItem.id]
    );

    // Record transactions
    await this.db.run(
      `INSERT INTO stock_transactions 
       (store_id, store_item_id, transaction_type, quantity, reference_type, user_id, target_store_id, notes)
       VALUES (?, ?, 'transfer_out', ?, 'cross_pick', ?, ?, ?)`,
      [pick.source_store_id, sourceItem.id, pick.quantity, userId, pick.request_store_id, `Cross-dept pick #${pickId}`]
    );

    await this.db.run(
      `INSERT INTO stock_transactions 
       (store_id, store_item_id, transaction_type, quantity, reference_type, user_id, source_store_id, notes)
       VALUES (?, ?, 'transfer_in', ?, 'cross_pick', ?, ?, ?)`,
      [pick.request_store_id, targetItem.id, pick.quantity, userId, pick.source_store_id, `Cross-dept pick #${pickId}`]
    );

    // Update pick status
    await this.db.run(
      `UPDATE cross_department_picks 
       SET status = 'picked', picked_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [pickId]
    );

    this.logger.info(`Executed cross-department pick ${pickId}`);
    return true;
  }

  /**
   * ดึงรายการคำขอเบิกข้ามแผนก
   */
  async getCrossPickRequests(storeId, filters = {}) {
    let sql = `
      SELECT 
        cdp.*,
        mi.sku,
        mi.name as item_name,
        mi.unit,
        req_s.name as request_store_name,
        req_d.name as request_department_name,
        src_s.name as source_store_name,
        src_d.name as source_department_name,
        req_u.full_name as requested_by_name,
        app_u.full_name as approved_by_name
      FROM cross_department_picks cdp
      JOIN master_items mi ON cdp.master_item_id = mi.id
      JOIN stores req_s ON cdp.request_store_id = req_s.id
      JOIN departments req_d ON req_s.department_id = req_d.id
      JOIN stores src_s ON cdp.source_store_id = src_s.id
      JOIN departments src_d ON src_s.department_id = src_d.id
      JOIN users req_u ON cdp.requested_by = req_u.id
      LEFT JOIN users app_u ON cdp.approved_by = app_u.id
      WHERE (cdp.request_store_id = ? OR cdp.source_store_id = ?)
    `;
    const params = [storeId, storeId];

    if (filters.status) {
      sql += ` AND cdp.status = ?`;
      params.push(filters.status);
    }

    sql += ` ORDER BY cdp.created_at DESC`;
    return await this.db.all(sql, params);
  }

  /**
   * ดึงสถิติการเบิกข้ามแผนก
   */
  async getCrossPickStatistics(storeId, days = 30) {
    const sql = `
      SELECT 
        status,
        COUNT(*) as count,
        SUM(quantity) as total_quantity
      FROM cross_department_picks
      WHERE (request_store_id = ? OR source_store_id = ?)
        AND created_at >= date('now', '-${days} days')
      GROUP BY status
    `;
    return await this.db.all(sql, [storeId, storeId]);
  }

  /**
   * แนะนำ store ที่น่าจะมีของ (based on history)
   */
  async suggestStoresForItem(masterItemId, excludeStoreId = null) {
    let sql = `
      SELECT 
        s.id as store_id,
        s.name as store_name,
        d.name as department_name,
        si.quantity as available_quantity,
        COUNT(cdp.id) as pick_history_count,
        AVG(cdp.quantity) as avg_pick_quantity
      FROM stores s
      JOIN departments d ON s.department_id = d.id
      JOIN store_items si ON s.id = si.store_id
      LEFT JOIN cross_department_picks cdp 
        ON s.id = cdp.source_store_id 
        AND cdp.master_item_id = ?
        AND cdp.status = 'picked'
      WHERE si.master_item_id = ?
        AND si.quantity > 0
        AND si.is_active = 1
    `;
    const params = [masterItemId, masterItemId];

    if (excludeStoreId) {
      sql += ` AND s.id != ?`;
      params.push(excludeStoreId);
    }

    sql += `
      GROUP BY s.id
      ORDER BY si.quantity DESC, pick_history_count DESC
      LIMIT 5
    `;

    return await this.db.all(sql, params);
  }
}

module.exports = CrossPickService;
