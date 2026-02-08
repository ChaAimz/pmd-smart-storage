/**
 * Notification Service
 * จัดการการแจ้งเตือนต่างๆ ในระบบ
 */
class NotificationService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
    this.clients = new Map(); // SSE clients
  }

  // ==================== NOTIFICATION TYPES ====================

  TYPES = {
    PR_APPROVED: 'pr_approved',
    PR_REJECTED: 'pr_rejected',
    PR_RECEIVED: 'pr_received',
    LOW_STOCK: 'low_stock',
    DELIVERY_TODAY: 'delivery_today',
    DELIVERY_OVERDUE: 'delivery_overdue',
    PENDING_APPROVAL: 'pending_approval',
    CROSS_PICK_REQUEST: 'cross_pick_request',
    CROSS_PICK_APPROVED: 'cross_pick_approved',
    SYSTEM: 'system'
  };

  // ==================== CREATE NOTIFICATIONS ====================

  async createNotification(data) {
    const { user_id, type, title, message, data: payload, link } = data;

    const sql = `
      INSERT INTO notifications 
      (user_id, type, title, message, data, link, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `;

    const result = await this.db.run(sql, [
      user_id, type, title, message, 
      JSON.stringify(payload || {}), link
    ]);

    const notification = await this.getNotificationById(result.id);
    
    // Send real-time notification via SSE
    this.sendToUser(user_id, notification);

    return notification;
  }

  async createNotificationForStore(storeId, notificationData) {
    // หา users ทั้งหมดใน store
    const users = await this.db.all(
      `SELECT id FROM users WHERE store_id = ? AND is_active = 1`,
      [storeId]
    );

    const notifications = [];
    for (const user of users) {
      const notif = await this.createNotification({
        ...notificationData,
        user_id: user.id
      });
      notifications.push(notif);
    }

    return notifications;
  }

  async createNotificationForRole(role, notificationData) {
    // หา users ตาม role
    const users = await this.db.all(
      `SELECT id FROM users WHERE role = ? AND is_active = 1`,
      [role]
    );

    const notifications = [];
    for (const user of users) {
      const notif = await this.createNotification({
        ...notificationData,
        user_id: user.id
      });
      notifications.push(notif);
    }

    return notifications;
  }

  // ==================== SPECIFIC NOTIFICATIONS ====================

  async notifyPRApproved(prId, approverName) {
    const pr = await this.db.get(
      `SELECT pr.*, s.name as store_name, u.full_name as requester_name
       FROM purchase_requisitions pr
       JOIN stores s ON pr.store_id = s.id
       JOIN users u ON pr.requester_id = u.id
       WHERE pr.id = ?`,
      [prId]
    );

    await this.createNotification({
      user_id: pr.requester_id,
      type: this.TYPES.PR_APPROVED,
      title: 'PR ได้รับการอนุมัติ',
      message: `PR ${pr.pr_number} ได้รับการอนุมัติจาก ${approverName}`,
      data: { pr_id: prId, pr_number: pr.pr_number },
      link: `/prs/${prId}`
    });
  }

  async notifyPRRejected(prId, rejectorName, reason) {
    const pr = await this.db.get(
      `SELECT * FROM purchase_requisitions WHERE id = ?`, [prId]
    );

    await this.createNotification({
      user_id: pr.requester_id,
      type: this.TYPES.PR_REJECTED,
      title: 'PR ถูกปฏิเสธ',
      message: `PR ${pr.pr_number} ถูกปฏิเสธ: ${reason}`,
      data: { pr_id: prId, pr_number: pr.pr_number, reason },
      link: `/prs/${prId}`
    });
  }

  async notifyLowStock(storeItemId) {
    const item = await this.db.get(
      `SELECT si.*, mi.name as item_name, mi.sku, s.name as store_name, s.id as store_id
       FROM store_items si
       JOIN master_items mi ON si.master_item_id = mi.id
       JOIN stores s ON si.store_id = s.id
       WHERE si.id = ?`,
      [storeItemId]
    );

    const urgency = item.quantity <= item.safety_stock ? 'critical' : 'warning';

    await this.createNotificationForStore(item.store_id, {
      type: this.TYPES.LOW_STOCK,
      title: urgency === 'critical' ? '⚠️ สต็อกวิกฤต' : '⚡ สต็อกต่ำ',
      message: `${item.item_name} (${item.sku}) เหลือ ${item.quantity} ${item.unit}`,
      data: { 
        store_item_id: storeItemId, 
        sku: item.sku, 
        quantity: item.quantity,
        reorder_point: item.reorder_point,
        urgency
      },
      link: `/inventory?low_stock=true`
    });
  }

  async notifyDeliveryToday(prId) {
    const pr = await this.db.get(
      `SELECT pr.*, s.name as store_name, s.id as store_id
       FROM purchase_requisitions pr
       JOIN stores s ON pr.store_id = s.id
       WHERE pr.id = ?`,
      [prId]
    );

    await this.createNotificationForStore(pr.store_id, {
      type: this.TYPES.DELIVERY_TODAY,
      title: '📦 ของเข้าวันนี้',
      message: `PR ${pr.pr_number} กำหนดรับของวันนี้`,
      data: { pr_id: prId, pr_number: pr.pr_number },
      link: `/prs/${prId}`
    });
  }

  async notifyDeliveryOverdue(prId) {
    const pr = await this.db.get(
      `SELECT pr.*, s.name as store_name, s.id as store_id,
              julianday('now') - julianday(pr.required_date) as days_overdue
       FROM purchase_requisitions pr
       JOIN stores s ON pr.store_id = s.id
       WHERE pr.id = ?`,
      [prId]
    );

    await this.createNotificationForStore(pr.store_id, {
      type: this.TYPES.DELIVERY_OVERDUE,
      title: '⏰ ของเลยกำหนด',
      message: `PR ${pr.pr_number} เลยกำหนด ${Math.floor(pr.days_overdue)} วัน`,
      data: { pr_id: prId, pr_number: pr.pr_number, days_overdue: pr.days_overdue },
      link: `/prs/${prId}`
    });
  }

  async notifyPendingApproval(prId, managerId) {
    const pr = await this.db.get(
      `SELECT pr.*, u.full_name as requester_name, s.name as store_name
       FROM purchase_requisitions pr
       JOIN users u ON pr.requester_id = u.id
       JOIN stores s ON pr.store_id = s.id
       WHERE pr.id = ?`,
      [prId]
    );

    await this.createNotification({
      user_id: managerId,
      type: this.TYPES.PENDING_APPROVAL,
      title: '📝 รออนุมัติ PR',
      message: `${pr.requester_name} ขออนุมัติ PR ${pr.pr_number} จาก ${pr.store_name}`,
      data: { pr_id: prId, pr_number: pr.pr_number },
      link: `/prs/${prId}/approve`
    });
  }

  async notifyCrossPickRequest(pickId) {
    const pick = await this.db.get(
      `SELECT cdp.*, 
              mi.name as item_name,
              req_s.name as request_store_name,
              req_u.full_name as requester_name,
              src_s.name as source_store_name
       FROM cross_department_picks cdp
       JOIN master_items mi ON cdp.master_item_id = mi.id
       JOIN stores req_s ON cdp.request_store_id = req_s.id
       JOIN stores src_s ON cdp.source_store_id = src_s.id
       JOIN users req_u ON cdp.requested_by = req_u.id
       WHERE cdp.id = ?`,
      [pickId]
    );

    // แจ้งเตือน manager ของ store ต้นทาง
    const managers = await this.db.all(
      `SELECT id FROM users WHERE store_id = ? AND role IN ('manager', 'admin')`,
      [pick.source_store_id]
    );

    for (const manager of managers) {
      await this.createNotification({
        user_id: manager.id,
        type: this.TYPES.CROSS_PICK_REQUEST,
        title: '🔄 ขอเบิกข้ามแผนก',
        message: `${pick.requester_name} ขอเบิก ${pick.item_name} จาก ${pick.source_store_name}`,
        data: { pick_id: pickId, quantity: pick.quantity },
        link: `/cross-pick/${pickId}`
      });
    }
  }

  // ==================== GET NOTIFICATIONS ====================

  async getNotificationById(id) {
    const sql = `
      SELECT n.*, 
             json_extract(n.data, '$') as parsed_data
      FROM notifications n
      WHERE n.id = ?
    `;
    return await this.db.get(sql, [id]);
  }

  async getUserNotifications(userId, filters = {}) {
    let sql = `
      SELECT n.*
      FROM notifications n
      WHERE n.user_id = ?
    `;
    const params = [userId];

    if (filters.unread_only) {
      sql += ` AND n.is_read = 0`;
    }

    if (filters.type) {
      sql += ` AND n.type = ?`;
      params.push(filters.type);
    }

    sql += ` ORDER BY n.created_at DESC`;

    if (filters.limit) {
      sql += ` LIMIT ?`;
      params.push(filters.limit);
    }

    return await this.db.all(sql, params);
  }

  async getUnreadCount(userId) {
    const result = await this.db.get(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );
    return result.count;
  }

  async markAsRead(notificationId, userId) {
    const sql = `
      UPDATE notifications 
      SET is_read = 1, read_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `;
    await this.db.run(sql, [notificationId, userId]);
    return true;
  }

  async markAllAsRead(userId) {
    await this.db.run(
      `UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [userId]
    );
    return true;
  }

  // ==================== REAL-TIME (SSE) ====================

  addClient(userId, res) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId).add(res);

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Remove on close
    res.on('close', () => {
      this.removeClient(userId, res);
    });
  }

  removeClient(userId, res) {
    if (this.clients.has(userId)) {
      this.clients.get(userId).delete(res);
      if (this.clients.get(userId).size === 0) {
        this.clients.delete(userId);
      }
    }
  }

  sendToUser(userId, notification) {
    if (this.clients.has(userId)) {
      const message = JSON.stringify({
        type: 'notification',
        data: notification
      });

      this.clients.get(userId).forEach(res => {
        res.write(`data: ${message}\n\n`);
      });
    }
  }

  // ==================== CLEANUP ====================

  async deleteOldNotifications(days = 30) {
    await this.db.run(
      `DELETE FROM notifications WHERE created_at < date('now', '-${days} days')`,
    );
    this.logger.info(`Deleted notifications older than ${days} days`);
  }
}

module.exports = NotificationService;
