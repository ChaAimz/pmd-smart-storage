/**
 * Master Item & Store Inventory Service
 * จัดการ Global Catalog และ Store-specific Inventory
 */
class MasterItemService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  // ==================== MASTER ITEMS (Global Catalog) ====================

  async createMasterItem(data) {
    const { sku, barcode, name, description, category, sub_category, unit, specifications, image_url } = data;
    const sql = `
      INSERT INTO master_items (sku, barcode, name, description, category, sub_category, unit, specifications, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await this.db.run(sql, [
      sku, barcode, name, description, category, sub_category, 
      unit || 'pcs', JSON.stringify(specifications || {}), image_url
    ]);
    this.logger.info(`Created master item: ${name} (${sku})`);
    return result.id;
  }

  async getAllMasterItems(filters = {}) {
    let sql = `
      SELECT mi.*, 
             GROUP_CONCAT(DISTINCT mia.alias_name) as aliases
      FROM master_items mi
      LEFT JOIN master_item_aliases mia ON mi.id = mia.master_item_id
      WHERE mi.is_active = 1
    `;
    const params = [];

    if (filters.category) {
      sql += ` AND mi.category = ?`;
      params.push(filters.category);
    }

    if (filters.search) {
      sql += ` AND (mi.name LIKE ? OR mi.sku LIKE ? OR mi.description LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    sql += ` GROUP BY mi.id ORDER BY mi.name`;
    return await this.db.all(sql, params);
  }

  async getMasterItemById(id) {
    const sql = `
      SELECT mi.*, 
             GROUP_CONCAT(DISTINCT mia.alias_name) as aliases
      FROM master_items mi
      LEFT JOIN master_item_aliases mia ON mi.id = mia.master_item_id
      WHERE mi.id = ?
      GROUP BY mi.id
    `;
    return await this.db.get(sql, [id]);
  }

  async getMasterItemBySku(sku) {
    const sql = `SELECT * FROM master_items WHERE sku = ?`;
    return await this.db.get(sql, [sku]);
  }

  // ==================== SIMILAR ITEMS SEARCH ====================
  // แก้ปัญหา: หา items ที่คล้ายกันตอนเบิกข้ามแผนก

  async findSimilarItems(searchTerm, excludeStoreId = null) {
    const sql = `
      SELECT DISTINCT mi.*, 
                      si.store_id,
                      s.name as store_name,
                      d.name as department_name,
                      si.quantity as available_quantity,
                      CASE 
                        WHEN mi.name LIKE ? THEN 100
                        WHEN mi.name LIKE ? THEN 80
                        WHEN mia.alias_name LIKE ? THEN 60
                        ELSE 40
                      END as similarity_score
      FROM master_items mi
      LEFT JOIN master_item_aliases mia ON mi.id = mia.master_item_id
      LEFT JOIN store_items si ON mi.id = si.master_item_id AND si.is_active = 1
      LEFT JOIN stores s ON si.store_id = s.id
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE mi.is_active = 1
        AND (mi.name LIKE ? OR mi.sku LIKE ? OR mia.alias_name LIKE ?)
        ${excludeStoreId ? 'AND si.store_id != ?' : ''}
      ORDER BY similarity_score DESC, mi.name
      LIMIT 20
    `;
    
    const exactMatch = searchTerm;
    const partialMatch = `%${searchTerm}%`;
    const params = [
      exactMatch, partialMatch, partialMatch,  // สำหรับ CASE
      partialMatch, partialMatch, partialMatch // สำหรับ WHERE
    ];
    
    if (excludeStoreId) params.push(excludeStoreId);
    
    return await this.db.all(sql, params);
  }

  async addItemAlias(masterItemId, aliasName, departmentId = null) {
    const sql = `
      INSERT INTO master_item_aliases (master_item_id, alias_name, source_department_id)
      VALUES (?, ?, ?)
    `;
    await this.db.run(sql, [masterItemId, aliasName, departmentId]);
    this.logger.info(`Added alias '${aliasName}' to item ${masterItemId}`);
    return true;
  }

  // ==================== STORE ITEMS (Store-specific Inventory) ====================

  async addItemToStore(data) {
    const {
      store_id, master_item_id, local_sku, local_name,
      min_quantity, reorder_point, reorder_quantity, safety_stock, lead_time_days
    } = data;

    const sql = `
      INSERT INTO store_items (
        store_id, master_item_id, local_sku, local_name,
        min_quantity, reorder_point, reorder_quantity, safety_stock, lead_time_days
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(store_id, master_item_id) DO UPDATE SET
        local_sku = excluded.local_sku,
        local_name = excluded.local_name,
        updated_at = CURRENT_TIMESTAMP
    `;

    const result = await this.db.run(sql, [
      store_id, master_item_id, local_sku, local_name,
      min_quantity || 0, reorder_point || 0, reorder_quantity || 0,
      safety_stock || 0, lead_time_days || 7
    ]);

    this.logger.info(`Added/updated item ${master_item_id} in store ${store_id}`);
    return result.id;
  }

  async getStoreItems(storeId, filters = {}) {
    let sql = `
      SELECT 
        si.*,
        mi.sku as master_sku,
        mi.barcode,
        mi.name as master_name,
        mi.description,
        mi.category,
        mi.sub_category,
        mi.unit,
        mi.image_url,
        COALESCE(SUM(il.remaining_quantity), 0) as total_quantity
      FROM store_items si
      JOIN master_items mi ON si.master_item_id = mi.id
      LEFT JOIN inventory_lots il ON si.id = il.store_item_id AND il.status = 'active'
      WHERE si.store_id = ? AND si.is_active = 1
    `;
    const params = [storeId];

    if (filters.category) {
      sql += ` AND mi.category = ?`;
      params.push(filters.category);
    }

    if (filters.low_stock) {
      sql += ` AND si.quantity <= si.reorder_point`;
    }

    if (filters.search) {
      sql += ` AND (mi.name LIKE ? OR mi.sku LIKE ? OR si.local_name LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    sql += ` GROUP BY si.id ORDER BY mi.name`;
    return await this.db.all(sql, params);
  }

  async getStoreItemById(storeItemId) {
    const sql = `
      SELECT 
        si.*,
        mi.sku as master_sku,
        mi.barcode,
        mi.name as master_name,
        mi.description,
        mi.category,
        mi.unit,
        mi.image_url,
        s.name as store_name,
        d.name as department_name
      FROM store_items si
      JOIN master_items mi ON si.master_item_id = mi.id
      JOIN stores s ON si.store_id = s.id
      JOIN departments d ON s.department_id = d.id
      WHERE si.id = ?
    `;
    return await this.db.get(sql, [storeItemId]);
  }

  // ==================== INVENTORY LOTS (ราคาตาม Lot - FIFO) ====================

  async createInventoryLot(data) {
    const {
      store_item_id, lot_number, quantity, unit_cost,
      received_date, expiry_date, pr_id, po_id, supplier_name, invoice_number
    } = data;

    const total_cost = quantity * unit_cost;

    const sql = `
      INSERT INTO inventory_lots (
        store_item_id, lot_number, quantity, unit_cost, total_cost,
        remaining_quantity, received_date, expiry_date,
        pr_id, po_id, supplier_name, invoice_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await this.db.run(sql, [
      store_item_id, lot_number, quantity, unit_cost, total_cost,
      quantity, // remaining = quantity ตอนเริ่ม
      received_date, expiry_date, pr_id, po_id, supplier_name, invoice_number
    ]);

    // Update store_items quantity
    await this.db.run(
      `UPDATE store_items SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [quantity, store_item_id]
    );

    this.logger.info(`Created lot ${lot_number} for store_item ${store_item_id}`);
    return result.id;
  }

  async getInventoryLots(storeItemId, status = 'active') {
    const sql = `
      SELECT * FROM inventory_lots
      WHERE store_item_id = ? AND status = ?
      ORDER BY received_date ASC
    `;
    return await this.db.all(sql, [storeItemId, status]);
  }

  /**
   * FIFO Cost Calculation
   * คำนวณต้นทุนเมื่อเบิกของออก โดยใช้วิธี FIFO
   */
  async calculateFIFOCost(storeItemId, quantityToPick) {
    const lots = await this.getInventoryLots(storeItemId, 'active');
    
    let remainingQty = quantityToPick;
    let totalCost = 0;
    const usedLots = [];

    for (const lot of lots) {
      if (remainingQty <= 0) break;

      const qtyFromLot = Math.min(remainingQty, lot.remaining_quantity);
      totalCost += qtyFromLot * lot.unit_cost;
      remainingQty -= qtyFromLot;

      usedLots.push({
        lot_id: lot.id,
        quantity: qtyFromLot,
        unit_cost: lot.unit_cost
      });
    }

    if (remainingQty > 0) {
      throw new Error(`Insufficient stock. Need ${quantityToPick} more ${remainingQty}`);
    }

    const avgCost = totalCost / quantityToPick;
    return { totalCost, avgCost, usedLots };
  }

  /**
   * Deduct from lots (FIFO)
   */
  async deductFromLots(storeItemId, quantityToDeduct) {
    const lots = await this.getInventoryLots(storeItemId, 'active');
    let remaining = quantityToDeduct;

    for (const lot of lots) {
      if (remaining <= 0) break;

      const deductQty = Math.min(remaining, lot.remaining_quantity);
      const newRemaining = lot.remaining_quantity - deductQty;
      const status = newRemaining === 0 ? 'depleted' : 'active';

      await this.db.run(
        `UPDATE inventory_lots SET remaining_quantity = ?, status = ? WHERE id = ?`,
        [newRemaining, status, lot.id]
      );

      remaining -= deductQty;
    }

    // Update store_items quantity
    await this.db.run(
      `UPDATE store_items SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [quantityToDeduct, storeItemId]
    );

    return true;
  }

  // ==================== LOW STOCK ALERTS ====================

  async getLowStockItems(storeId = null) {
    let sql = `
      SELECT 
        si.*,
        mi.sku,
        mi.name,
        mi.category,
        s.name as store_name,
        d.name as department_name,
        CASE 
          WHEN si.quantity <= si.safety_stock THEN 'critical'
          WHEN si.quantity <= si.reorder_point THEN 'warning'
          ELSE 'normal'
        END as urgency
      FROM store_items si
      JOIN master_items mi ON si.master_item_id = mi.id
      JOIN stores s ON si.store_id = s.id
      JOIN departments d ON s.department_id = d.id
      WHERE si.quantity <= si.reorder_point
        AND si.is_active = 1
    `;
    const params = [];

    if (storeId) {
      sql += ` AND si.store_id = ?`;
      params.push(storeId);
    }

    sql += ` ORDER BY urgency DESC, si.quantity ASC`;
    return await this.db.all(sql, params);
  }

  // ==================== BACKWARD COMPATIBILITY ====================
  
  // Alias for addItemToStore with storeId as first parameter
  async createStoreItem(storeId, data) {
    return await this.addItemToStore({ ...data, store_id: storeId });
  }
  
  // Update store item
  async updateStoreItem(storeItemId, data) {
    const allowedFields = ['local_sku', 'local_name', 'min_quantity', 'reorder_point', 'reorder_quantity', 'safety_stock', 'lead_time_days'];
    const updates = [];
    const values = [];
    
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    }
    
    if (updates.length === 0) {
      throw new Error('No fields to update');
    }
    
    values.push(storeItemId);
    const sql = `UPDATE store_items SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await this.db.run(sql, values);
    this.logger.info(`Updated store item ${storeItemId}`);
    return true;
  }
  
  // Delete store item (soft delete)
  async deleteStoreItem(storeItemId) {
    const sql = `UPDATE store_items SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await this.db.run(sql, [storeItemId]);
    this.logger.info(`Deleted store item ${storeItemId}`);
    return true;
  }
}

module.exports = MasterItemService;
