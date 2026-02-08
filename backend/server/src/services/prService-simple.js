/**
 * Simplified PR Service (No PO)
 * PR อนุมัติแล้ว → รับของเข้าได้เลย
 */
class PRService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  generatePRNumber() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `PR-${today}-${random}`;
  }

  async createPR(data) {
    const { store_id, requester_id, priority, required_date, notes, items, supplier_name, supplier_contact } = data;

    const prNumber = this.generatePRNumber();

    const sql = `
      INSERT INTO purchase_requisitions 
      (pr_number, store_id, requester_id, priority, required_date, notes, 
       supplier_name, supplier_contact, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `;

    const result = await this.db.run(sql, [
      prNumber, store_id, requester_id, priority || 'normal', 
      required_date, notes, supplier_name, supplier_contact
    ]);

    const prId = result.id;

    // Add PR items
    if (items && items.length > 0) {
      for (const item of items) {
        await this.db.run(
          `INSERT INTO pr_items (pr_id, master_item_id, quantity, estimated_unit_cost, notes)
           VALUES (?, ?, ?, ?, ?)`,
          [prId, item.master_item_id, item.quantity, item.estimated_unit_cost || 0, item.notes]
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

  /**
   * รับของเข้าจาก PR โดยตรง (ไม่ผ่าน PO)
   */
  async receiveFromPR(prId, data) {
    const { items, received_date, invoice_number, user_id } = data;

    const pr = await this.getPRById(prId);
    if (!pr) throw new Error('PR not found');
    if (pr.status !== 'approved') throw new Error('PR must be approved before receiving');

    for (const receivedItem of items) {
      const prItem = pr.items.find(i => i.id === receivedItem.pr_item_id);
      if (!prItem) continue;

      // Get or create store_item
      let storeItem = await this.db.get(
        `SELECT id FROM store_items WHERE store_id = ? AND master_item_id = ?`,
        [pr.store_id, prItem.master_item_id]
      );

      let storeItemId;
      if (!storeItem) {
        const result = await this.db.run(
          `INSERT INTO store_items (store_id, master_item_id, quantity) VALUES (?, ?, 0)`,
          [pr.store_id, prItem.master_item_id]
        );
        storeItemId = result.id;
      } else {
        storeItemId = storeItem.id;
      }

      // Create inventory lot
      const lotNumber = `LOT-${received_date.replace(/-/g, '')}-${Math.floor(Math.random() * 10000)}`;
      const unitCost = receivedItem.unit_cost || prItem.estimated_unit_cost || 0;
      
      await this.db.run(
        `INSERT INTO inventory_lots 
         (store_item_id, lot_number, quantity, unit_cost, total_cost, remaining_quantity,
          received_date, pr_id, supplier_name, invoice_number)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          storeItemId, lotNumber, receivedItem.quantity, unitCost,
          receivedItem.quantity * unitCost, receivedItem.quantity,
          received_date, prId, pr.supplier_name, invoice_number
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
         VALUES (?, ?, 'receive', ?, ?, 'pr', ?, ?, ?)`,
        [pr.store_id, storeItemId, receivedItem.quantity, unitCost, prId, user_id, `PR Receive: ${lotNumber}`]
      );

      // Update PR item received quantity
      await this.db.run(
        `UPDATE pr_items SET received_quantity = COALESCE(received_quantity, 0) + ? WHERE id = ?`,
        [receivedItem.quantity, receivedItem.id]
      );
    }

    // Check if PR fully received
    const prItems = await this.db.all(`SELECT * FROM pr_items WHERE pr_id = ?`, [prId]);
    const allReceived = prItems.every(item => (item.received_quantity || 0) >= item.quantity);
    const partialReceived = prItems.some(item => (item.received_quantity || 0) > 0);

    let newStatus = 'approved';
    if (allReceived) newStatus = 'fully_received';
    else if (partialReceived) newStatus = 'partially_received';

    await this.db.run(
      `UPDATE purchase_requisitions SET status = ? WHERE id = ?`,
      [newStatus, prId]
    );

    this.logger.info(`Received PR ${pr.pr_number} with status ${newStatus}`);
    return { status: newStatus };
  }

  // ==================== EXPORT ====================

  /**
   * Export PR เป็น Excel format data (ส่งไปให้ frontend สร้าง Excel)
   */
  async exportPRToExcel(prId) {
    const pr = await this.getPRById(prId);
    if (!pr) throw new Error('PR not found');

    return {
      pr_number: pr.pr_number,
      status: pr.status,
      created_at: pr.created_at,
      required_date: pr.required_date,
      store_name: pr.store_name,
      department_name: pr.department_name,
      requester_name: pr.requester_name,
      approver_name: pr.approver_name,
      approved_at: pr.approved_at,
      supplier_name: pr.supplier_name,
      supplier_contact: pr.supplier_contact,
      notes: pr.notes,
      items: pr.items.map(item => ({
        sku: item.sku,
        item_name: item.item_name,
        unit: item.unit,
        quantity: item.quantity,
        estimated_unit_cost: item.estimated_unit_cost,
        estimated_total: item.quantity * (item.estimated_unit_cost || 0),
        received_quantity: item.received_quantity || 0,
        pending_quantity: item.quantity - (item.received_quantity || 0)
      })),
      total_amount: pr.items.reduce((sum, item) => sum + (item.quantity * (item.estimated_unit_cost || 0)), 0)
    };
  }

  /**
   * Export PR List ตามช่วงเวลา
   */
  async exportPRList(storeId, startDate, endDate) {
    const sql = `
      SELECT 
        pr.pr_number,
        pr.status,
        pr.created_at,
        pr.required_date,
        pr.supplier_name,
        s.name as store_name,
        d.name as department_name,
        u.full_name as requester_name,
        COUNT(pri.id) as item_count,
        SUM(pri.quantity * COALESCE(pri.estimated_unit_cost, 0)) as total_amount
      FROM purchase_requisitions pr
      JOIN stores s ON pr.store_id = s.id
      JOIN departments d ON s.department_id = d.id
      JOIN users u ON pr.requester_id = u.id
      LEFT JOIN pr_items pri ON pr.id = pri.pr_id
      WHERE pr.store_id = ?
        AND date(pr.created_at) BETWEEN ? AND ?
      GROUP BY pr.id
      ORDER BY pr.created_at DESC
    `;
    
    return await this.db.all(sql, [storeId, startDate, endDate]);
  }

  // ==================== DASHBOARD ====================

  async getUpcomingDeliveries(storeId = null, days = 7) {
    let sql = `
      SELECT 
        pr.*,
        s.name as store_name,
        d.name as department_name,
        SUM(pri.quantity * COALESCE(pri.estimated_unit_cost, 0)) as total_amount,
        CASE 
          WHEN pr.required_date < date('now') THEN 'overdue'
          WHEN pr.required_date = date('now') THEN 'today'
          WHEN pr.required_date <= date('now', '+1 day') THEN 'tomorrow'
          ELSE 'upcoming'
        END as urgency
      FROM purchase_requisitions pr
      JOIN stores s ON pr.store_id = s.id
      JOIN departments d ON s.department_id = d.id
      LEFT JOIN pr_items pri ON pr.id = pri.pr_id
      WHERE pr.status = 'approved'
        AND pr.required_date <= date('now', '+${days} days')
    `;
    const params = [];

    if (storeId) {
      sql += ` AND pr.store_id = ?`;
      params.push(storeId);
    }

    sql += ` GROUP BY pr.id ORDER BY pr.required_date ASC`;
    return await this.db.all(sql, params);
  }

  async getOverdueDeliveries(storeId = null) {
    let sql = `
      SELECT 
        pr.*,
        s.name as store_name,
        d.name as department_name,
        SUM(pri.quantity * COALESCE(pri.estimated_unit_cost, 0)) as total_amount,
        julianday('now') - julianday(pr.required_date) as days_overdue
      FROM purchase_requisitions pr
      JOIN stores s ON pr.store_id = s.id
      JOIN departments d ON s.department_id = d.id
      LEFT JOIN pr_items pri ON pr.id = pri.pr_id
      WHERE pr.status = 'approved'
        AND pr.required_date < date('now')
    `;
    const params = [];

    if (storeId) {
      sql += ` AND pr.store_id = ?`;
      params.push(storeId);
    }

    sql += ` GROUP BY pr.id ORDER BY pr.required_date ASC`;
    return await this.db.all(sql, params);
  }

  async getPendingApprovals(storeId = null) {
    let sql = `
      SELECT 
        pr.*,
        s.name as store_name,
        d.name as department_name,
        u.full_name as requester_name,
        SUM(pri.quantity * COALESCE(pri.estimated_unit_cost, 0)) as total_amount,
        julianday('now') - julianday(pr.created_at) as days_pending
      FROM purchase_requisitions pr
      JOIN stores s ON pr.store_id = s.id
      JOIN departments d ON s.department_id = d.id
      JOIN users u ON pr.requester_id = u.id
      LEFT JOIN pr_items pri ON pr.id = pri.pr_id
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
