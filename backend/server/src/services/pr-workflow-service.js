/**
 * PR Workflow Service
 * 
 * Workflow:
 * 1. Create PR (internal request) - ไม่ต้องใส่ supplier
 * 2. Export PR to Excel → ส่งให้จัดซื้อ
 * 3. จัดซื้อซื้อของ (นอกระบบ) → ได้เลข PO
 * 4. Key รับของในระบบ → ใส่ PO, Supplier, ราคาจริง, จำนวน
 */
class PRWorkflowService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  generatePRNumber() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `PR-${today}-${random}`;
  }

  // ==================== STEP 1: CREATE PR (Internal Request) ====================
  
  /**
   * สร้าง PR - ขอซื้อภายใน (ยังไม่ต้องใส่ supplier)
   */
  async createPR(data) {
    const { store_id, requester_id, priority, required_date, notes, items } = data;

    const prNumber = this.generatePRNumber();

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
          [prId, item.master_item_id, item.quantity, item.estimated_unit_cost || 0, item.notes]
        );
      }
    }

    this.logger.info(`Created PR ${prNumber} for store ${store_id}`);
    return { id: prId, pr_number: prNumber };
  }

  // ==================== STEP 2: EXPORT TO EXCEL ====================

  /**
   * Export PR เป็น Excel format สำหรับส่งให้จัดซื้อ
   */
  async exportPRForPurchasing(prId) {
    const pr = await this.getPRById(prId);
    if (!pr) throw new Error('PR not found');

    // ข้อมูลสำหรับจัดซื้อ
    return {
      document_type: 'PURCHASE_REQUISITION',
      pr_number: pr.pr_number,
      pr_date: pr.created_at,
      required_date: pr.required_date,
      priority: pr.priority,
      requester: pr.requester_name,
      department: pr.department_name,
      store: pr.store_name,
      notes: pr.notes,
      
      // รายการที่ต้องการ
      items: pr.items.map(item => ({
        no: item.id,
        sku: item.sku,
        item_name: item.item_name,
        description: item.description || '',
        unit: item.unit,
        quantity_requested: item.quantity,
        estimated_price: item.estimated_unit_cost,
        estimated_total: item.quantity * (item.estimated_unit_cost || 0),
        notes: item.notes || ''
      })),

      // Summary
      total_items: pr.items.length,
      total_quantity: pr.items.reduce((sum, item) => sum + item.quantity, 0),
      total_estimated_amount: pr.items.reduce((sum, item) => 
        sum + (item.quantity * (item.estimated_unit_cost || 0)), 0
      ),

      // สำหรับจัดซืองกรอกตอนซื้อ (จะนำกลับมา key ในระบบตอนรับของ)
      purchasing_section: {
        po_number: '', // จัดซื้อกรอก
        supplier_name: '', // จัดซื้อกรอก
        supplier_contact: '', // จัดซื้อกรอก
        order_date: '', // จัดซื้อกรอก
        actual_delivery_date: '', // จัดซื้อกรอก
        actual_prices: [] // ราคาจริงที่ซื้อได้
      }
    };
  }

  // ==================== STEP 5: RECEIVE GOODS (Key in System) ====================

  /**
   * รับของเข้า - ใส่ข้อมูลที่ได้จากจัดซื้อ
   * @param {number} prId - PR ID
   * @param {object} data - ข้อมูลการรับของ
   * @param {string} data.po_number - เลข PO จากผู้ขาย (บังคับ)
   * @param {string} data.supplier_name - ชื่อผู้ขาย
   * @param {string} data.supplier_contact - ข้อมูลติดต่อผู้ขาย
   * @param {string} data.received_date - วันที่รับของ
   * @param {string} data.invoice_number - เลข invoice (ถ้ามี)
   * @param {array} data.items - รายการที่รับ
   * @param {number} data.items[].pr_item_id - ID ของ item ใน PR
   * @param {number} data.items[].quantity - จำนวนที่รับจริง
   * @param {number} data.items[].unit_cost - ราคาต่อหน่วยจริง
   * @param {string} data.notes - หมายเหตุ
   */
  async receiveGoods(prId, data) {
    const { 
      po_number, 
      supplier_name, 
      supplier_contact,
      received_date, 
      invoice_number, 
      items, 
      user_id,
      notes 
    } = data;

    // Validation
    if (!po_number || po_number.trim() === '') {
      throw new Error('กรุณาระบุเลข PO');
    }

    if (!supplier_name || supplier_name.trim() === '') {
      throw new Error('กรุณาระบุชื่อผู้ขาย');
    }

    const pr = await this.getPRById(prId);
    if (!pr) throw new Error('PR not found');
    if (pr.status !== 'approved' && !pr.status.includes('received')) {
      throw new Error('PR must be approved before receiving');
    }

    // สร้าง/หา PO record
    let po = await this.db.get(
      `SELECT id FROM purchase_orders WHERE po_number = ? AND pr_id = ?`,
      [po_number, prId]
    );

    let poId;
    if (!po) {
      // สร้าง PO record ใหม่
      const poResult = await this.db.run(
        `INSERT INTO purchase_orders 
         (po_number, pr_id, store_id, supplier_name, supplier_contact, order_date, actual_delivery_date, notes, created_by, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'received')`,
        [po_number, prId, pr.store_id, supplier_name, supplier_contact, 
         received_date, received_date, notes, user_id]
      );
      poId = poResult.id;
    } else {
      poId = po.id;
      // อัปเดต PO ที่มีอยู่
      await this.db.run(
        `UPDATE purchase_orders 
         SET status = 'received', actual_delivery_date = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [received_date, poId]
      );
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
      const unitCost = receivedItem.unit_cost || 0;
      
      await this.db.run(
        `INSERT INTO inventory_lots 
         (store_item_id, lot_number, quantity, unit_cost, total_cost, remaining_quantity,
          received_date, pr_id, po_id, supplier_name, invoice_number, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          storeItemId, lotNumber, receivedItem.quantity, unitCost,
          receivedItem.quantity * unitCost, receivedItem.quantity,
          received_date, prId, poId, supplier_name, invoice_number, notes
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
        unit_cost: unitCost,
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

    this.logger.info(`Received goods for PR ${pr.pr_number} with PO ${po_number}, status: ${newStatus}`);
    
    return { 
      status: newStatus, 
      po_number,
      supplier_name,
      receiveRecords 
    };
  }

  // ==================== GETTERS ====================

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
        `SELECT pri.*, mi.sku, mi.name as item_name, mi.unit, mi.description
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

  async getPOsByPR(prId) {
    return await this.db.all(
      `SELECT * FROM purchase_orders WHERE pr_id = ? ORDER BY created_at DESC`,
      [prId]
    );
  }

  // ==================== APPROVAL ====================

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

  // ==================== DASHBOARD ====================

  async getPendingApprovals(storeId = null) {
    let sql = `
      SELECT 
        pr.*,
        s.name as store_name,
        d.name as department_name,
        u.full_name as requester_name,
        SUM(pri.quantity * COALESCE(pri.estimated_unit_cost, 0)) as total_amount
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
}

module.exports = PRWorkflowService;
