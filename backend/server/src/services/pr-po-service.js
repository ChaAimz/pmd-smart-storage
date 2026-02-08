/**
 * PR + PO Service
 * - PR: ขอซื้อภายใน (internal)
 * - PO: สั่งซื้อจากผู้ขาย (external) - เก็บเลข PO ตอนรับของ
 */
class PRPOService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  generatePRNumber() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `PR-${today}-${random}`;
  }

  // ==================== PR (Purchase Requisition) ====================

  async createPR(data) {
    const { store_id, requester_id, priority, required_date, notes, items } = data;

    const prNumber = this.generatePRNumber();

    const sql = `
      INSERT INTO purchase_requisitions 
      (pr_number, store_id, requester_id, priority, required_date, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ordered')
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
              u.full_name as requester_name
       FROM purchase_requisitions pr
       JOIN stores s ON pr.store_id = s.id
       JOIN departments d ON s.department_id = d.id
       JOIN users u ON pr.requester_id = u.id
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

  // ==================== PO (Purchase Order) - Simplified ====================
  // PO ถูกสร้าง/บันทึกตอนรับของเข้า (เก็บเลข PO จากผู้ขาย)

  async createPO(data) {
    const { pr_id, store_id, po_number, supplier_name, supplier_contact, order_date, expected_date, notes, created_by } = data;

    const sql = `
      INSERT INTO purchase_orders 
      (pr_id, store_id, po_number, supplier_name, supplier_contact, order_date, expected_delivery_date, notes, created_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ordered')
    `;

    const result = await this.db.run(sql, [
      pr_id, store_id, po_number, supplier_name, supplier_contact, 
      order_date, expected_date, notes, created_by
    ]);

    this.logger.info(`Created PO ${po_number} for PR ${pr_id}`);
    return { id: result.id };
  }

  async getPOById(id) {
    return await this.db.get(
      `SELECT po.*, pr.pr_number, s.name as store_name
       FROM purchase_orders po
       JOIN purchase_requisitions pr ON po.pr_id = pr.id
       JOIN stores s ON po.store_id = s.id
       WHERE po.id = ?`,
      [id]
    );
  }

  async getPOsByPR(prId) {
    return await this.db.all(
      `SELECT * FROM purchase_orders WHERE pr_id = ? ORDER BY created_at DESC`,
      [prId]
    );
  }

  // ==================== RECEIVING (with PO Number) ====================

  /**
   * รับของเข้า - ต้องใส่เลข PO
   */
  async receiveFromPR(prId, data) {
    const { 
      items, 
      received_date, 
      invoice_number, 
      po_number,  // ← บังคับใส่เลข PO
      supplier_name,
      user_id,
      notes 
    } = data;

    if (!po_number || po_number.trim() === '') {
      throw new Error('กรุณาระบุเลข PO');
    }

    const pr = await this.getPRById(prId);
    if (!pr) throw new Error('PR not found');
    if (pr.status === 'cancelled') {
      throw new Error('Cannot receive for cancelled PR');
    }
    if (pr.status !== 'ordered' && !pr.status.includes('received')) {
      throw new Error('PR must be ordered before receiving');
    }

    // สร้าง/หา PO record
    let po = await this.db.get(
      `SELECT id FROM purchase_orders WHERE po_number = ? AND pr_id = ?`,
      [po_number, prId]
    );

    let poId;
    if (!po) {
      // สร้าง PO record ใหม่ถ้ายังไม่มี
      const poResult = await this.createPO({
        pr_id: prId,
        store_id: pr.store_id,
        po_number: po_number,
        supplier_name: supplier_name || pr.supplier_name,
        order_date: received_date,
        expected_date: received_date,
        notes: notes,
        created_by: user_id
      });
      poId = poResult.id;
    } else {
      poId = po.id;
    }

    // บันทึกการรับของ
    const receiveRecords = [];

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

      // Create inventory lot with PO reference
      const lotNumber = `LOT-${received_date.replace(/-/g, '')}-${Math.floor(Math.random() * 10000)}`;
      const unitCost = receivedItem.unit_cost || prItem.estimated_unit_cost || 0;
      
      await this.db.run(
        `INSERT INTO inventory_lots 
         (store_item_id, lot_number, quantity, unit_cost, total_cost, remaining_quantity,
          received_date, pr_id, po_id, supplier_name, invoice_number, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          storeItemId, lotNumber, receivedItem.quantity, unitCost,
          receivedItem.quantity * unitCost, receivedItem.quantity,
          received_date, prId, poId, supplier_name || pr.supplier_name, 
          invoice_number, notes
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
        [pr.store_id, storeItemId, receivedItem.quantity, unitCost, poId, user_id, 
         `Receive PO:${po_number} Lot:${lotNumber}`]
      );

      // Update PR item received quantity
      await this.db.run(
        `UPDATE pr_items SET received_quantity = COALESCE(received_quantity, 0) + ? WHERE id = ?`,
        [receivedItem.quantity, prItem.id]
      );

      receiveRecords.push({
        item_name: prItem.item_name,
        quantity: receivedItem.quantity,
        lot_number: lotNumber
      });
    }

    // Update PR status
    const prItems = await this.db.all(`SELECT * FROM pr_items WHERE pr_id = ?`, [prId]);
    const allReceived = prItems.every(item => (item.received_quantity || 0) >= item.quantity);
    const partialReceived = prItems.some(item => (item.received_quantity || 0) > 0);

    let newStatus;
    if (allReceived) newStatus = 'fully_received';
    else if (partialReceived) newStatus = 'partially_received';
    else newStatus = 'approved';

    await this.db.run(
      `UPDATE purchase_requisitions SET status = ? WHERE id = ?`,
      [newStatus, prId]
    );

    // Update PO status
    await this.db.run(
      `UPDATE purchase_orders SET status = 'received', actual_delivery_date = ? WHERE id = ?`,
      [received_date, poId]
    );

    this.logger.info(`Received PR ${pr.pr_number} with PO ${po_number}, status: ${newStatus}`);
    
    return { 
      status: newStatus, 
      po_number,
      receiveRecords 
    };
  }

  // ==================== EXPORT ====================

  async exportPRToExcel(prId) {
    const pr = await this.getPRById(prId);
    if (!pr) throw new Error('PR not found');

    // Get PO info
    const pos = await this.getPOsByPR(prId);

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
      total_amount: pr.items.reduce((sum, item) => sum + (item.quantity * (item.estimated_unit_cost || 0)), 0),
      purchase_orders: pos.map(po => ({
        po_number: po.po_number,
        supplier_name: po.supplier_name,
        order_date: po.order_date,
        received_date: po.actual_delivery_date
      }))
    };
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
      WHERE pr.status IN ('approved', 'partially_received')
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
      WHERE pr.status IN ('approved', 'partially_received')
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

module.exports = PRPOService;
