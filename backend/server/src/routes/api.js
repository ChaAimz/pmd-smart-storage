const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Services
const DepartmentService = require('../services/departmentService');
const MasterItemService = require('../services/masterItemService');
const PRService = require('../services/prService');
const CrossPickService = require('../services/crossPickService');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'smart-storage-secret-key';

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'Access token required' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, error: 'Invalid token' });
    req.user = user;
    next();
  });
};

const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  }
  next();
};

// ==================== AUTH ====================
router.post('/auth/login', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { username, password } = req.body;
    
    const user = await db.get(
      `SELECT u.*, s.name as store_name, d.name as department_name
       FROM users u
       LEFT JOIN stores s ON u.store_id = s.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.username = ? AND u.is_active = 1`, [username]
    );

    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    await db.run(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`, [user.id]);

    const token = jwt.sign({
      userId: user.id, username: user.username, role: user.role,
      storeId: user.store_id, departmentId: user.department_id
    }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, username: user.username, fullName: user.full_name,
                email: user.email, role: user.role, storeId: user.store_id,
                storeName: user.store_name, departmentId: user.department_id,
                departmentName: user.department_name }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DEPARTMENTS & STORES ====================
router.get('/departments', authenticateToken, async (req, res) => {
  try {
    const service = new DepartmentService(req.app.locals.db, req.app.locals.logger);
    res.json({ success: true, data: await service.getAllDepartments() });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/stores', authenticateToken, async (req, res) => {
  try {
    const service = new DepartmentService(req.app.locals.db, req.app.locals.logger);
    const stores = req.user.role === 'admin' 
      ? await service.getAllStores()
      : await service.getStoresByDepartment(req.user.departmentId);
    res.json({ success: true, data: stores });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== MASTER ITEMS ====================
router.get('/master-items', authenticateToken, async (req, res) => {
  try {
    const service = new MasterItemService(req.app.locals.db, req.app.locals.logger);
    res.json({ success: true, data: await service.getAllMasterItems(req.query) });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/master-items/search', authenticateToken, async (req, res) => {
  try {
    const { q, exclude_store } = req.query;
    if (!q) return res.status(400).json({ success: false, error: 'Search query required' });
    
    const service = new MasterItemService(req.app.locals.db, req.app.locals.logger);
    res.json({ success: true, data: await service.findSimilarItems(q, exclude_store) });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== INVENTORY ====================
router.get('/inventory', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id || req.user.storeId;
    if (!storeId) return res.status(400).json({ success: false, error: 'Store ID required' });
    
    const service = new MasterItemService(req.app.locals.db, req.app.locals.logger);
    res.json({ success: true, data: await service.getStoreItems(storeId, req.query) });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/inventory/low-stock', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id || req.user.storeId;
    const service = new MasterItemService(req.app.locals.db, req.app.locals.logger);
    res.json({ success: true, data: await service.getLowStockItems(storeId) });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== PR & PO ====================
router.get('/prs', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id || req.user.storeId;
    const service = new PRService(req.app.locals.db, req.app.locals.logger);
    res.json({ success: true, data: await service.getPRsByStore(storeId, req.query) });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/prs', authenticateToken, async (req, res) => {
  try {
    const service = new PRService(req.app.locals.db, req.app.locals.logger);
    const result = await service.createPR({
      ...req.body, requester_id: req.user.userId, store_id: req.body.store_id || req.user.storeId
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/prs/:id/approve', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const service = new PRService(req.app.locals.db, req.app.locals.logger);
    await service.approvePR(req.params.id, req.user.userId, req.body.notes);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/pos', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id || req.user.storeId;
    const service = new PRService(req.app.locals.db, req.app.locals.logger);
    res.json({ success: true, data: await service.getPOsByStore(storeId, req.query) });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== CROSS-DEPARTMENT PICK ====================
router.get('/cross-pick/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, error: 'Search query required' });
    
    const service = new CrossPickService(req.app.locals.db, req.app.locals.logger);
    res.json({ success: true, data: await service.searchItemsAcrossStores(q, { excludeStoreId: req.user.storeId }) });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/cross-pick', authenticateToken, async (req, res) => {
  try {
    const service = new CrossPickService(req.app.locals.db, req.app.locals.logger);
    const result = await service.createCrossDepartmentPick({
      ...req.body, request_store_id: req.user.storeId, requested_by: req.user.userId
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== DASHBOARD ====================
router.get('/dashboard/alerts', authenticateToken, async (req, res) => {
  try {
    const storeId = req.query.store_id || req.user.storeId;
    const prService = new PRService(req.app.locals.db, req.app.locals.logger);
    const itemService = new MasterItemService(req.app.locals.db, req.app.locals.logger);

    const [upcoming, overdue, pendingApprovals, lowStock] = await Promise.all([
      prService.getUpcomingDeliveries(storeId, 7),
      prService.getOverdueDeliveries(storeId),
      prService.getPendingApprovals(storeId),
      itemService.getLowStockItems(storeId)
    ]);

    res.json({
      success: true,
      data: {
        upcomingDeliveries: upcoming,
        overdueDeliveries: overdue,
        pendingApprovals: pendingApprovals,
        lowStockItems: lowStock,
        summary: {
          deliveriesThisWeek: upcoming.length,
          overdueCount: overdue.length,
          pendingApprovalCount: pendingApprovals.length,
          lowStockCount: lowStock.length
        }
      }
    });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

module.exports = router;
