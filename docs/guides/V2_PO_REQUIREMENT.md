# PR Workflow with External PO

## ✅ การเปลี่ยนแปลงล่าสุด

> **Note:** ระบบ Approval ถูกย้ายไปอยู่ข้างนอกระบบ (เอกสาร/อีเมล/อื่นๆ)
> PR ที่สร้างจะมีสถานะ `ordered` ทันที พร้อมส่งให้ฝ่ายจัดซื้อ

### Workflow ที่ถูกต้อง

```
1. Create PR (ขอซื้อภายใน)
   → Status: ordered (พร้อมส่งให้จัดซื้อทันที)
   → Export Excel อัตโนมัติ

2. ส่ง Excel ให้ฝ่ายจัดซื้อ (นอกระบบ)
   → Approval ทำข้างนอกระบบ (เอกสาร/อีเมล)

3. สั่งซื้อจากผู้ขาย (นอกระบบ)
   → ได้เลข PO จากผู้ขาย

4. ของมาถึง พร้อมเอกสาร PO/Invoice

5. Receive Goods (รับของเข้าระบบ)
   → ใส่เลข PO ที่ได้จากผู้ขาย (บังคับ)
   → บันทึกราคาจริงที่ซื้อได้ (FIFO)
   → Status: partially_received / fully_received
```

---

## 📝 ตัวอย่างการใช้งาน

### 1. สร้าง PR
```json
POST /api/prs
{
  "priority": "normal",
  "required_date": "2024-02-15",
  "notes": "ขอซื้อตามแผน",
  "items": [
    {
      "master_item_id": 1,
      "quantity": 100,
      "estimated_unit_cost": 50
    }
  ]
}

Response:
{
  "success": true,
  "data": {
    "id": 123,
    "pr_number": "PR-20240208-0001",
    "status": "ordered"
  }
}
```

### 2. Export Excel (อัตโนมัติ)
```
GET /api/prs/123/export
→ Download: PR-20240208-0001.xlsx
```

Excel ประกอบด้วย:
- ข้อมูล PR
- รายการ items
- ช่องสำหรับฝ่ายจัดซื้อกรอก (PO number, supplier, etc.)

### 3. ส่งให้ฝ่ายจัดซื้อ (นอกระบบ)
- ส่งไฟล์ Excel ให้ฝ่ายจัดซื้อ
- รออนุมัติ (ข้างนอกระบบ)
- ฝ่ายจัดซื้อสั่งซื้อจากผู้ขาย
- **ได้เลข PO: PO-SUPPLIER-2024-001**

### 4. รับของเข้า (ต้องใส่เลข PO)
```json
POST /api/prs/123/receive
{
  "po_number": "PO-SUPPLIER-2024-001",     // ← บังคับ!
  "invoice_number": "INV-001",              // ← ใบกำกับภาษี
  "supplier_name": "บริษัท กขค จำกัด",      // ← ชื่อผู้ขาย
  "received_date": "2024-02-10",            // ← วันที่รับของ
  "items": [
    {
      "pr_item_id": 1,
      "received_quantity": 100,              // ← จำนวนที่รับจริง
      "actual_unit_cost": 48.50,             // ← ราคาจริง (FIFO)
      "batch_number": "LOT-2024-A",          // ← Lot number (ถ้ามี)
      "expiry_date": "2025-02-10"            // ← วันหมดอายุ (ถ้ามี)
    }
  ]
}
```

---

## 🔐 Validation

- **เลข PO บังคับกรอก** - ถ้าไม่ใส่จะ error
- **ชื่อผู้ขายบังคับกรอก** - ต้องระบุ supplier
- **วันที่รับของบังคับ** - ต้องระบุ received_date
- **ราคาจริงบันทึกลง FIFO** - ใช้คำนวนต้นทุนขาย

---

## 📊 ข้อมูลที่บันทึก

### PR (Purchase Requisition)
| Field | คำอธิบาย |
|-------|---------|
| pr_number | เลขที่ PR (auto-generate) |
| status | ordered → partially_received / fully_received |
| requester | ผู้ขอซื้อ |
| required_date | วันที่ต้องการ |
| items | รายการสินค้า |
| estimated_cost | ราคาประมาณ |

### PO Record (สร้างตอนรับของ)
| Field | คำอธิบาย |
|-------|---------|
| po_number | เลข PO จากผู้ขาย |
| supplier_name | ชื่อผู้ขาย |
| invoice_number | เลขใบกำกับภาษี |
| received_date | วันที่รับของ |

### Inventory Lot (FIFO)
| Field | คำอธิบาย |
|-------|---------|
| lot_number | รันหมายเลขอัตโนมัติ |
| po_number | อ้างอิง PO |
| unit_cost | ราคาต้นทุนจริง |
| received_date | วันรับเข้า |

---

## 🔍 ตรวจสอบประวัติ

```
GET /api/prs/123
Response:
{
  "pr_number": "PR-20240208-0001",
  "status": "fully_received",
  "items": [...],
  "purchase_orders": [
    {
      "po_number": "PO-SUPPLIER-2024-001",
      "supplier_name": "บริษัท กขค จำกัด",
      "invoice_number": "INV-001",
      "received_date": "2024-02-10"
    }
  ]
}
```

---

## 📤 Export Excel

Excel จะแสดง:
- ข้อมูล PR (เลขที่, วันที่, ผู้ขอ)
- รายการ items (SKU, ชื่อ, จำนวน, ราคาประมาณ)
- **ช่องสำหรับฝ่ายจัดซื้อ:**
  - เลข PO
  - ชื่อผู้ขาย
  - วันที่สั่งซื้อ
  - วันที่รับของ
  - เบอร์โทรผู้ขาย

---

## ⚠️ Error Messages

| กรณี | Error |
|-------|-------|
| ไม่ใส่เลข PO | "กรุณาระบุเลข PO" |
| ไม่ใส่ชื่อผู้ขาย | "กรุณาระบุชื่อผู้ขาย" |
| ไม่ใส่วันที่รับของ | "กรุณาระบุวันที่รับของ" |
| จำนวนเกิน | "Quantity exceeds pending amount" |
| PR ยกเลิก | "Cannot receive for cancelled PR" |

---

## 🔄 PR Status Flow

```
┌─────────┐     Export Excel      ┌─────────────┐
│ ordered │ ────────────────────→ │ Send to     │
│         │                       │ Purchasing  │
└────┬────┘                       │ (External)  │
     │                             └──────┬──────┘
     │                                    │
     │ Receive                            │ Order
     │ with PO                            │
     │                                    │
     ▼                                    ▼
┌──────────────┐                  ┌──────────────┐
│ partially_   │                  │   Goods      │
│ received     │ ←─────────────── │   Arrived    │
└──────┬───────┘                  └──────────────┘
       │
       │ Receive more
       │
       ▼
┌──────────────┐
│   fully_     │
│   received   │
└──────────────┘
```

---

## 📝 Notes

- Approval workflow อยู่ข้างนอกระบบ (เอกสาร/อีเมล/อื่นๆ)
- PR สร้างแล้วมี status `ordered` ทันที
- ไม่ต้องรอ approve ในระบบ
- PO number มาจากผู้ขาย (ไม่ใช่ระบบสร้าง)
- ราคาจริงบันทึกตอนรับของ (FIFO costing)
