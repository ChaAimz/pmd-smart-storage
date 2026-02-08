/**
 * Purchase Requisition & Purchase Order Service
 * แยก PR (ขอซื้อ) ออกจาก PO (สั่งซื้อ)
 */
class PRService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  // ==================== PURCHASE REQUISITIONS (PR) ====================

  async createPR(data) {
    const { store_id, requester_id, priority, required_date, notes, items } = data;

    // Generate PR Number: PR-YYYYMMDD-XXXX
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countResult = await this.db.get(
      `SELECT COUNT(*) as count FROM purchase_requisitions WHERE created_at >= date('now')`
    );
    const sequence = String(countResult.count + 1).padStart(4, '0');
    const prNumber = `PR-${today}-${sequence}`;

    const sql = `
      INSERT INTO purchase_requisitions 
      (pr_number, store_id, requester_id, priority, required_date, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `;

    const result = await this.db.run(sql, [
      prNumber, store_id, requester_id, priority || 'normal', required_date, notes
    ]);

    const prId = result.id;

    // Add PR items
    if (items && items.length > 0) {
      for (const item of items) {
        await this.db.run(
          `INSERT INTO pr_items (pr_id, master_item_id, quantity, estimated_unit_cost, notes)
           VALUES (?, ?, ?, ?, ?)`,
          [prId, item.master_item_id, item.quantity, item.estimated_unit_cost, item.notes]
        );
      }
    }

    this.logger.info(`Created PR ${prNumber} for store ${store_id}`);
    return { id: prId, pr_number: prNumber };
  }

  async getPRById(id) {
    const pr = await this.db.get(
      `SELECT pr.*, 
              s.name as store_name, d.name as department_name,
              u.full_name as requester_name,
              au.full_name as approver_name
       FROM purchase_requisitions pr
       JOIN stores s ON pr.store_id = s.id
       JOIN departments d ON s.department_id = d.id
       JOIN users u ON pr.requester_id = u.id
       LEFT JOIN users au ON pr.approved_by = au.id
       WHERE pr.id = ?`,
      [id]
    );

    if (pr) {
      pr.items = await this.db.all(
        `SELECT pri.*, mi.sku, mi.name as item_name, mi.unit
         FROM pr_items pri
         JOIN master_items mi ON pri.master_item_id = mi.id
         WHERE pri.pr_id = ?`,
        [id]
      );
    }

    return pr;
  }

  async getPRsByStore(storeId, filters = {}) {
    let sql = `
      SELECT pr.*, 
             s.name as store_name,
             u.full_name as requester_name,
             COUNT(pri.id) as item_count,
             SUM(pri.quantity * COALESCE(pri.estimated_unit_cost, 0)) as estimated_total
      FROM purchase_requisitions pr
      JOIN stores s ON pr.store_id = s.id
      JOIN users u ON pr.requester_id = u.id
      LEFT JOIN pr_items pri ON pr.id = pri.pr_id
      WHERE pr.store_id = ?
    `;
    const params = [storeId];

    if (filters.status) {
      sql += ` AND pr.status = ?`;
      params.push(filters.status);
    }

    sql += ` GROUP BY pr.id ORDER BY pr.created_at DESC`;
    return await this.db.all(sql, params);
  }

  async approvePR(prId, approverId, notes = null) {
    const sql = `
      UPDATE purchase_requisitions 
      SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP, notes = COALESCE(?, notes)
      WHERE id = ?
    `;
    await this.db.run(sql, [approverId, notes, prId]);
    this.logger.info(`Approved PR ${prId} by user ${approverId}`);
    return true;
  }

  async rejectPR(prId, approverId, reason) {
    const sql = `
      UPDATE purchase_requisitions 
      SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP, notes = ?
      WHERE id = ?
    `;
    await this.db.run(sql, [approverId, reason, prId]);
    this.logger.info(`Rejected PR ${prId} by user ${approverId}`);
    return true;
  }

  // ==================== PURCHASE ORDERS (PO) ====================

  async createPOFromPR(prId, data) {
    const { supplier_name, supplier_contact, expected_delivery_date, created_by } = data;

    // Get PR details
    const pr = await this.getPRById(prId);
    if (!pr) throw new Error('PR not found');
    if (pr.status !== 'approved') throw new Error('PR must be approved first');

    // Generate PO Number: PO-YYYYMMDD-XXXX
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countResult = await this.db.get(
      `SELECT COUNT(*) as count FROM purchase_orders WHERE created_at >= date('now')`
    );
    const sequence = String(countResult.count + 1).padStart(4, '0');
    const poNumber = `PO-${today}-${sequence}`;

    // Create PO
    const sql = `
      INSERT INTO purchase_orders 
      (po_number, pr_id, store_id, supplier_name, supplier_contact, expected_delivery_date, created_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `;

    const result = await this.db.run(sql, [
      poNumber, prId, pr.store_id, supplier_name, supplier_contact, expected_delivery_date, created_by
    ]);

    const poId = result.id;
    let totalAmount = 0;

    // Create PO items from PR items
    for (const item of pr.items) {
      const unitCost = item.estimated_unit_cost || 0;
      const totalCost = item.quantity * unitCost;
      totalAmount += totalCost;

      await this.db.run(
        `INSERT INTO po_items (po_id, master_item_id, quantity, unit_cost, total_cost)
         VALUES (?, ?, ?, ?, ?)`,
        [poId, item.master_item_id, item.quantity, unitCost, totalCost]
      );
    }

    // Update PO total
    await this.db.run(
      `UPDATE purchase_orders SET total_amount = ? WHERE id = ?`,
      [totalAmount, poId]
    );

    // Update PR status to converted_to_po
    await this.db.run(
      `UPDATE purchase_requisitions SET status = 'converted_to_po' WHERE id = ?`,
      [prId]
    );

    // Create delivery schedule
    await this.db.run(
      `INSERT INTO delivery_schedules (po_id, scheduled_date, status) VALUES (?, ?, 'scheduled')`,
      [poId, expected_delivery_date]
    );

    this.logger.info(`Created PO ${poNumber} from PR ${pr.pr_number}`);
    return { id: poId, po_number: poNumber };
  }

  async getPOById(id) {
    const po = await this.db.get(
      `SELECT po.*, 
              s.name as store_name, d.name as department_name,
              u.full_name as created_by_name,
              pr.pr_number as reference_pr
       FROM purchase_orders po
       JOIN stores s ON po.store_id = s.id
       JOIN departments d ON s.department_id = d.id
       JOIN users u ON po.created_by = u.id
       LEFT JOIN purchase_requisitions pr ON po.pr_id = pr.id
       WHERE po.id = ?`,
      [id]
    );

    if (po) {
      po.items = await this.db.all(
        `SELECT poi.*, mi.sku, mi.name as item_name, mi.unit
         FROM po_items poi
         JOIN master_items mi ON poi.master_item_id = mi.id
         WHERE poi.po_id = ?`,
        [id]
      );
    }

    return po;
  }

  async getPOsByStore(storeId, filters = {}) {
    let sql = `
      SELECT po.*, 
             s.name as store_name,
             u.full_name as created_by_name,
             COUNT(poi.id) as item_count
      FROM purchase_orders po
      JOIN stores s ON po.store_id = s.id
      JOIN users u ON po.created_by = u.id
      LEFT JOIN po_items poi ON po.id = poi.po_id
      WHERE po.store_id = ?
    `;
    const params = [storeId];

    if (filters.status) {
      sql += ` AND po.status = ?`;
      params.push(filters.status);
    }

    sql += ` GROUP BY po.id ORDER BY po.created_at DESC`;
    return await this.db.all(sql, params);
  }

  /**
   * รับของเข้าจาก PO
   * สร้าง inventory lot และอัปเดต stock
   */
  async receivePO(poId, data) {
    const { items, received_date, invoice_number, user_id } = data;

    const po = await this.getPOById(poId);
    if (!po) throw new Error('PO not found');

    const masterItemService = require('./masterItemService');
    const inventoryService = new masterItemService(this.db, this.logger);

    for (const receivedItem of items) {
      const poItem = po.items.find(i => i.id === receivedItem.po_item_id);
      if (!poItem) continue;

      // Get or create store_item
      let storeItem = await this.db.get(
        `SELECT id FROM store_items WHERE store_id = ? AND master_item_id = ?`,
        [po.store_id, poItem.master_item_id]
      );

      let storeItemId;
      if (!storeItem) {
        const result = await this.db.run(
          `INSERT INTO store_items (store_id, master_item_id, quantity) VALUES (?, ?, 0)`,
          [po.store_id, poItem.master_item_id]
        );
        storeItemId = result.id;
      } else {
        storeItemId = storeItem.id;
      }

      // Create inventory lot
      const lotNumber = `LOT-${received_date.replace(/-/g, '')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
      
      await this.db.run(
        `INSERT INTO inventory_lots 
         (store_item_id, lot_number, quantity, unit_cost, total_cost, remaining_quantity,
          received_date, po_id, supplier_name, invoice_number)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          storeItemId, lotNumber, receivedItem.quantity, receivedItem.unit_cost,
          receivedItem.quantity * receivedItem.unit_cost, receivedItem.quantity,
          received_date, poId, po.supplier_name, invoice_number
        ]
      );

      // Update store item quantity
      await this.db.run(
        `UPDATE store_items SET quantity = quantity + ? WHERE id = ?`,
        [receivedItem.quantity, storeItemId]
      );

      // Record transaction
      await this.db.run(
        `INSERT INTO stock_transactions 
         (store_id, store_item_id, transaction_type, quantity, unit_cost, 
          reference_type, reference_id, user_id, notes)
         VALUES (?, ?, 'receive', ?, ?, 'po', ?, ?, ?)`,
        [po.store_id, storeItemId, receivedItem.quantity, receivedItem.unit_cost, poId, user_id, `PO Receive: ${lotNumber}`]
      );

      // Update PO item received quantity
      await this.db.run(
        `UPDATE po_items SET received_quantity = received_quantity + ? WHERE id = ?`,
        [receivedItem.quantity, receivedItem.id]
      );
    }

    // Check if PO fully received
    const poItems = await this.db.all(`SELECT * FROM po_items WHERE po_id = ?`, [poId]);
    const allReceived = poItems.every(item => item.received_quantity >= item.quantity);
    const partialReceived = poItems.some(item => item.received_quantity > 0);

    let newStatus = 'pending';
    if (allReceived) newStatus = 'received';
    else if (partialReceived) newStatus = 'partially_received';

    await this.db.run(
      `UPDATE purchase_orders SET status = ?, actual_delivery_date = ? WHERE id = ?`,
      [newStatus, received_date, poId]
    );

    // Update delivery schedule
    await this.db.run(
      `UPDATE delivery_schedules SET status = 'delivered' WHERE po_id = ?`,
      [poId]
    );

    this.logger.info(`Received PO ${po.po_number} with status ${newStatus}`);
    return { status: newStatus };
  }

  // ==================== DASHBOARD QUERIES ====================

  /**
   * ดึงข้อมูลของที่ต้องเข้าในอาทิตย์นี้
   */
  async getUpcomingDeliveries(storeId = null, days = 7) {
    let sql = `
      SELECT 
        ds.*,
        po.po_number,
        po.supplier_name,
        po.expected_delivery_date,
        s.name as store_name,
        d.name as department_name,
        CASE 
          WHEN ds.scheduled_date < date('now') THEN 'overdue'
          WHEN ds.scheduled_date = date('now') THEN 'today'
          WHEN ds.scheduled_date <= date('now', '+1 day') THEN 'tomorrow'
          ELSE 'upcoming'
        END as urgency
      FROM delivery_schedules ds
      JOIN purchase_orders po ON ds.po_id = po.id
      JOIN stores s ON po.store_id = s.id
      JOIN departments d ON s.department_id = d.id
      WHERE ds.status = 'scheduled'
        AND ds.scheduled_date <= date('now', '+${days} days')
    `;
    const params = [];

    if (storeId) {
      sql += ` AND po.store_id = ?`;
      params.push(storeId);
    }

    sql += ` ORDER BY ds.scheduled_date ASC, urgency DESC`;
    return await this.db.all(sql, params);
  }

  /**
   * ดึงข้อมูล PO ที่เกินกำหนด (overdue)
   */
  async getOverdueDeliveries(storeId = null) {
    let sql = `
      SELECT 
        po.*,
        s.name as store_name,
        d.name as department_name,
        julianday('now') - julianday(po.expected_delivery_date) as days_overdue
      FROM purchase_orders po
      JOIN stores s ON po.store_id = s.id
      JOIN departments d ON s.department_id = d.id
      WHERE po.status IN ('pending', 'ordered', 'partially_received')
        AND po.expected_delivery_date < date('now')
    `;
    const params = [];

    if (storeId) {
      sql += ` AND po.store_id = ?`;
      params.push(storeId);
    }

    sql += ` ORDER BY po.expected_delivery_date ASC`;
    return await this.db.all(sql, params);
  }

  /**
   * PR ที่รออนุมัติ (สำหรับ dashboard)
   */
  async getPendingApprovals(storeId = null) {
    let sql = `
      SELECT 
        pr.*,
        s.name as store_name,
        d.name as department_name,
        u.full_name as requester_name,
        SUM(pri.quantity * COALESCE(pri.estimated_unit_cost, 0)) as estimated_total,
        julianday('now') - julianday(pr.created_at) as days_pending
      FROM purchase_requisitions pr
      JOIN stores s ON pr.store_id = s.id
      JOIN departments d ON s.department_id = d.id
      JOIN users u ON pr.requester_id = u.id
      JOIN pr_items pri ON pr.id = pri.pr_id
      WHERE pr.status = 'pending'
    `;
    const params = [];

    if (storeId) {
      sql += ` AND pr.store_id = ?`;
      params.push(storeId);
    }

    sql += ` GROUP BY pr.id ORDER BY pr.created_at ASC`;
    return await this.db.all(sql, params);
  }
}

module.exports = PRService;
