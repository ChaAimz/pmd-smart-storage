/**
 * Department & Store Management Service
 */
class DepartmentService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  // ==================== DEPARTMENTS ====================

  async createDepartment(data) {
    const { code, name, description } = data;
    const sql = `
      INSERT INTO departments (code, name, description)
      VALUES (?, ?, ?)
    `;
    const result = await this.db.run(sql, [code, name, description]);
    this.logger.info(`Created department: ${name} (${code})`);
    return result.id;
  }

  async getAllDepartments() {
    const sql = `SELECT * FROM departments WHERE is_active = 1 ORDER BY name`;
    return await this.db.all(sql);
  }

  async getDepartmentById(id) {
    const sql = `SELECT * FROM departments WHERE id = ?`;
    return await this.db.get(sql, [id]);
  }

  // ==================== STORES ====================

  async createStore(data) {
    const { department_id, code, name, description } = data;
    const sql = `
      INSERT INTO stores (department_id, code, name, description)
      VALUES (?, ?, ?, ?)
    `;
    const result = await this.db.run(sql, [department_id, code, name, description]);
    this.logger.info(`Created store: ${name} (${code}) in department ${department_id}`);
    return result.id;
  }

  async getStoresByDepartment(departmentId) {
    const sql = `
      SELECT s.*, d.name as department_name
      FROM stores s
      JOIN departments d ON s.department_id = d.id
      WHERE s.department_id = ? AND s.is_active = 1
      ORDER BY s.name
    `;
    return await this.db.all(sql, [departmentId]);
  }

  async getStoreById(id) {
    const sql = `
      SELECT s.*, d.name as department_name
      FROM stores s
      JOIN departments d ON s.department_id = d.id
      WHERE s.id = ?
    `;
    return await this.db.get(sql, [id]);
  }

  async getAllStores() {
    const sql = `
      SELECT s.*, d.name as department_name, d.code as department_code
      FROM stores s
      JOIN departments d ON s.department_id = d.id
      WHERE s.is_active = 1
      ORDER BY d.name, s.name
    `;
    return await this.db.all(sql);
  }

  // ==================== USER STORE ASSIGNMENT ====================

  async assignUserToStore(userId, storeId) {
    const sql = `UPDATE users SET store_id = ? WHERE id = ?`;
    await this.db.run(sql, [storeId, userId]);
    this.logger.info(`Assigned user ${userId} to store ${storeId}`);
    return true;
  }

  async getUsersByStore(storeId) {
    const sql = `
      SELECT u.id, u.username, u.full_name, u.email, u.role, u.last_login,
             d.name as department_name, s.name as store_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN stores s ON u.store_id = s.id
      WHERE u.store_id = ? AND u.is_active = 1
    `;
    return await this.db.all(sql, [storeId]);
  }
}

module.exports = DepartmentService;
