# System V2.0 Migration Guide

## การเปลี่ยนแปลงที่สำคัญ

### 🏢 1. Multi-Store System (แยกตามแผนก)

**แก้ไขปัญหา**: แต่ละแผนกมี store เป็นของตัวเอง

```
Departments
├── Production
│   ├── Store A (PROD-A)
│   └── Store B (PROD-B)
├── Maintenance
│   └── Store (MAINT-01)
├── QC
│   └── Lab Store (QC-LAB)
└── Admin
    └── Office Store (ADMIN-01)
```

**Database**: 
- `departments` table - เก็บข้อมูลแผนก
- `stores` table - เก็บข้อมูล store เชื่อมกับแผนก
- `users.store_id` - user เชื่อมกับ store

**API**:
- `GET /api/stores` - ดึง store ตามสิทธิ์ user
- `GET /api/inventory?store_id=xxx` - ดึงสต็อกเฉพาะ store

---

### 📦 2. Master Items (แก้ปัญหาของซ้ำ)

**แก้ไขปัญหา**: แผนกต่างกันซื้อของชื่อไม่统一

```
Master Items (Global Catalog)
├── SKU: SCREW-001, Name: "Stainless Steel Screw M4x20"
├── SKU: BEARING-001, Name: "Ball Bearing 6204"
└── ...

Store Items (Inventory per Store)
├── Store A: Master Item 001 + Quantity 100
├── Store B: Master Item 001 + Quantity 50
└── ...
```

**การทำงาน**:
1. สร้าง Master Item ที่เป็น global (ไม่มี quantity)
2. เพิ่ม Master Item เข้า Store (สร้าง Store Item พร้อม quantity)
3. แต่ละ Store มีสต็อกแยกกัน

**Database**:
- `master_items` - Catalog ทั้งหมด
- `store_items` - Inventory แยกตาม store

**API**:
- `GET /api/master-items` - ดู catalog
- `POST /api/inventory` - เพิ่มของเข้า store

---

### 🔍 3. Cross-Department Picking (เบิกข้ามแผนก)

**แก้ไขปัญหา**: ต้องการของจาก store อื่น

**Workflow**:
```
1. Search: ค้นหาของจากทุก store
   GET /api/cross-pick/search?q=bearing
   → แสดงของที่มี พร้อม store, quantity, คะแนนความใกล้เคียง

2. Request: สร้างคำขอเบิก
   POST /api/cross-pick
   { source_store_id, master_item_id, quantity }
   → สร้าง request status: pending

3. Approve: ผู้จัดการ store ต้นทางอนุมัติ
   POST /api/cross-pick/:id/approve
   → status: approved

4. Execute: ดำเนินการเบิก
   POST /api/cross-pick/:id/execute
   → ย้าย quantity จาก store ต้นทาง → ปลายทาง
   → สร้าง transaction record
```

---

### 📝 4. PR (Purchase Requisition) - Simplified Workflow

**แก้ไขปัญหา**: ลดขั้นตอน approval ในระบบ ย้ายไปข้างนอก

```
┌─────────┐    Export Excel      ┌─────────────┐
│ Create  │ ───────────────────→ │   Send to   │
│   PR    │                      │  Purchasing │
└─────────┘                      │  (External) │
     │                           └──────┬──────┘
     │                                  │ Approval
     │                                  │ (External)
     │                                  ▼
     │                           ┌─────────────┐
     │                           │ Order from  │
     │                           │  Supplier   │
     │                           └──────┬──────┘
     │                                  │
     ▼                                  ▼
┌─────────┐    Enter PO Number   ┌─────────────┐
│ Receive │ ←─────────────────── │ Goods       │
│ Goods   │    Actual Price      │ Arrived     │
└─────────┘    Actual Qty        └─────────────┘
```

**PR Status Flow** (No approval in system):
```
ordered → partially_received → fully_received
    ↘ cancelled
```

**Key Changes**:
- PR สร้างแล้วมี status `ordered` ทันที
- ไม่ต้อง approve ในระบบ (approval ข้างนอก)
- Export Excel อัตโนมัติเพื่อส่งให้จัดซื้อ
- PO number มาจากผู้ขาย (ใส่ตอนรับของ)

**API**:
- `POST /api/prs` - สร้าง PR (status: ordered)
- `GET /api/prs/:id/export` - Export PR เป็น Excel
- `POST /api/prs/:id/receive` - รับของ (ใส่ PO number จากผู้ขาย)

---

### 💰 5. FIFO Cost Tracking (Lot-based)

**แก้ไขปัญหา**: ราคาซื้อไม่เท่ากันในแต่ละ lot

```
Inventory Lots (FIFO)
├── Lot 1: 100 pcs @ 50 THB (เข้า 1 Jan)
├── Lot 2: 50 pcs @ 55 THB (เข้า 15 Jan)
└── Lot 3: 200 pcs @ 48 THB (เข้า 1 Feb)

เมื่อเบิก 120 pcs:
→ เบิกจาก Lot 1: 100 pcs @ 50 THB = 5,000
→ เบิกจาก Lot 2: 20 pcs @ 55 THB = 1,100
→ ต้นทุนรวม: 6,100 (avg 50.83 THB/pc)
```

**Database**: `inventory_lots` table

**Fields สำคัญ**:
- `quantity` - จำนวนตอนรับเข้า
- `remaining_quantity` - จำนวนคงเหลือ
- `unit_cost` - ราคาต่อหน่วย
- `received_date` - วันที่รับ

---

### 📊 6. Dashboard Alerts

**Alerts ที่แสดง**:

| Alert | Endpoint | รายละเอียด |
|-------|----------|------------|
| ของเข้าวันนี้ | `/api/dashboard/deliveries/today` | PO ที่กำหนดส่งวันนี้ |
| ของเข้าสัปดาห์นี้ | `/api/dashboard/deliveries/week` | PO ที่กำหนดส่งใน 7 วัน |
| ของเกินกำหนด | `/api/dashboard/alerts` | PO ที่เลยกำหนดยังไม่ได้รับ |
| ของรอรับ | `/api/dashboard/alerts` | PR status ordered/partially_received |
| สต็อกต่ำ | `/api/dashboard/alerts` | Item ที่ถึงจุดสั่งซื้อ |

**Status Colors**:
- 🔴 Overdue - เกินกำหนด
- 🟡 Today - วันนี้
- 🟢 Upcoming - กำลังจะมา

---

## 🔧 การ Migration

### Step 1: Backup ข้อมูลเดิม
```bash
cp backend/server/data/warehouse.db backend/server/data/warehouse.db.backup
```

### Step 2: อัปเดต Database
```bash
# ลบ database เก่า (หรือ rename)
mv backend/server/data/warehouse.db backend/server/data/warehouse-old.db

# รัน server ใหม่ (จะสร้าง database ใหม่)
cd backend/server
node src/index-new.js
```

### Step 3: Seed Data
```bash
# Database ใหม่จะ auto-seed ด้วยข้อมูลเริ่มต้น
# หรือรัน seed แยก
node -e "require('./src/seed-new')(require('./src/database-new'), console)"
```

### Step 4: ทดสอบ
```bash
# Login
POST /api/auth/login
{ "username": "admin", "password": "admin123" }

# ดู stores
GET /api/stores

# ดู inventory ของ store
GET /api/inventory
```

---

## 📚 API Reference

### Authentication
```bash
# Login
POST /api/auth/login
Body: { username, password }

# Get current user
GET /api/auth/me
Header: Authorization: Bearer <token>
```

### Departments & Stores
```bash
GET /api/departments
GET /api/stores
GET /api/stores/:id
```

### Master Items
```bash
GET /api/master-items?search=&category=
GET /api/master-items/search?q=bearing
POST /api/master-items (admin/manager)
```

### Inventory
```bash
GET /api/inventory?store_id=&category=&low_stock=true
POST /api/inventory
GET /api/inventory/low-stock
```

### PR (Purchase Requisition)
```bash
GET /api/prs?status=
POST /api/prs
Body: { items: [{master_item_id, quantity, estimated_unit_cost}], priority, required_date, notes }

GET /api/prs/:id
GET /api/prs/:id/export    # Export to Excel
POST /api/prs/:id/receive  # Receive goods with PO number
Body: { 
  po_number: "PO-XXX",           # From supplier document
  invoice_number: "INV-XXX",     # Tax invoice
  supplier_name: "Company",      # Supplier name
  received_date: "2024-02-10",
  items: [{
    pr_item_id: 1,
    received_quantity: 100,
    actual_unit_cost: 48.50,     # Real price for FIFO
    batch_number: "LOT-2024-A",
    expiry_date: "2025-02-10"
  }]
}
```

### Cross-Department Picking
```bash
GET /api/cross-pick/search?q=screw
POST /api/cross-pick
Body: { source_store_id, master_item_id, quantity, notes }

GET /api/cross-pick
POST /api/cross-pick/:id/approve
POST /api/cross-pick/:id/execute
```

### Dashboard
```bash
GET /api/dashboard/alerts
GET /api/dashboard/deliveries/today
GET /api/dashboard/deliveries/week
```

---

## 🔐 Permissions

| Role | Permissions |
|------|-------------|
| **admin** | ทุกอย่าง |
| **manager** | จัดการ store ตัวเอง, approve cross-pick |
| **user** | สร้าง PR, เบิกของ, ดู inventory ของตัวเอง |

---

## 📝 Notes

- User จะเห็นเฉพาะ store ของตัวเอง (ยกเว้น admin)
- Cross-pick ต้องผ่านการอนุมัติจาก store ต้นทาง
- Cost คำนวณแบบ FIFO อัตโนมัติ
- PR สร้างแล้วพร้อมใช้ทันที (ไม่ต้อง approve ในระบบ)
