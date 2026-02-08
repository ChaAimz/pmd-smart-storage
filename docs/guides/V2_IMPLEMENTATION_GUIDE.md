# Smart Storage V2.0 - Implementation Guide

## 📋 สรุปการเปลี่ยนแปลง

### ✅ 1. Multi-Store System
- User login → ไปยัง store ของตัวเองอัตโนมัติ
- ไม่ต้องเลือก store (user ถูก assign ไว้แล้วตอน create)
- API ทุกตัว filter ตาม store_id ของ user โดยอัตโนมัติ

### ✅ 2. PR-Only System (ไม่มี PO)
- สร้าง PR → ได้เลข PR ทันที
- Export Excel ส่งให้ฝ่ายจัดซื้อ (ข้างนอกระบบ)
- ไม่ต้องสร้าง PO ในระบบ
- Track สถานะ: `ordered` → `partially_received`/`fully_received`
- ระบบ Approval อยู่ข้างนอก (เอกสาร/อีเมล)

### ✅ 3. Notification + Sonner
- ใช้ **Sonner** (shadcn/ui) สำหรับ toast notifications
- Real-time notifications ผ่าน SSE
- Dashboard alerts auto-check ทุก 5 นาที

---

## 🔧 Installation Steps

### Step 1: Install Dependencies

```bash
cd frontend
npm install sonner xlsx

# หรือถ้าใช้ pnpm
pnpm add sonner xlsx
```

### Step 2: Update Main.tsx (Add Sonner + Notification Provider)

```tsx
// frontend/src/main.tsx
import { Toaster } from '@/components/ui/sonner';
import { NotificationProvider } from '@/contexts/NotificationContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NotificationProvider>
      <App />
      <Toaster position="top-right" richColors />
    </NotificationProvider>
  </React.StrictMode>,
);
```

### Step 3: Update App.tsx (Add DashboardAlerts)

```tsx
// frontend/src/App.tsx
import { DashboardAlerts } from '@/components/dashboard/DashboardAlerts';

function App() {
  return (
    <>
      <DashboardAlerts /> {/* Auto-check alerts */}
      <Routes>
        {/* ... routes */}
      </Routes>
    </>
  );
}
```

### Step 4: Update API Service

เพิ่ม header authorization สำหรับทุก request:

```ts
// frontend/src/services/api.ts
export async function get(url: string, params?: Record<string, any>) {
  const token = localStorage.getItem('token');
  
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  const response = await fetch(`${API_BASE_URL}${url}${queryString}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    }
  });
  return response.json();
}

export async function post(url: string, data: any) {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    },
    body: JSON.stringify(data)
  });
  return response.json();
}
```

### Step 5: Update Routes

```tsx
// frontend/src/App.tsx routes
<Route path="/prs" element={<PRList />} />
<Route path="/prs/create" element={<CreatePR />} />
<Route path="/prs/:id" element={<PRDetail />} />
<Route path="/prs/:id/receive" element={<PRReceive />} />
<Route path="/cross-pick" element={<CrossPick />} />
```

---

## 🗄️ Database Migration

### Option A: Fresh Database (Recommended for testing)

```bash
cd backend/server
mv data/warehouse.db data/warehouse-v1.db
npm start
# Server จะสร้าง database ใหม่พร้อม seed data
```

### Option B: Migration Script (Keep old data)

```bash
# Run migration (ถ้ามี script ในอนาคต)
node scripts/migrate-v1-to-v2.js
```

---

## 🔄 API Changes

### New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stores/my-store` | Get user's store |
| GET | `/api/inventory` | Get my store inventory (auto-filter) |
| POST | `/api/prs` | Create PR (no supplier needed) |
| POST | `/api/prs/:id/receive` | Receive items with PO number |
| GET | `/api/prs/:id/export` | Export PR to Excel |
| GET | `/api/cross-pick/search` | Search items across stores |
| POST | `/api/cross-pick` | Request cross-dept pick |
| GET | `/api/notifications` | Get notifications |
| GET | `/api/notifications/stream` | SSE for real-time |
| POST | `/api/notifications/read-all` | Mark all as read |

### Removed Endpoints

| Endpoint | Reason |
|----------|--------|
| `POST /api/pos` | No PO system |
| `GET /api/pos` | No PO system |
| `POST /api/pos/from-pr/:id` | No PO system |
| `POST /api/prs/:id/approve` | Approval is external |
| `POST /api/prs/:id/reject` | Approval is external |

---

## 🎨 Using Sonner Notifications

### Basic Toast

```tsx
import { toast } from 'sonner';

// Success
toast.success('สร้าง PR สำเร็จ');

// Error
toast.error('เกิดข้อผิดพลาด');

// Info
toast.info('มีการแจ้งเตือนใหม่');

// With description
toast.success('รับของเข้าสำเร็จ', {
  description: 'PR-20240208-0001'
});

// With action
toast.info('รออนุมัติ PR', {
  action: {
    label: 'อนุมัติ',
    onClick: () => navigate('/prs/123/approve')
  }
});
```

### Dashboard Notification Hook

```tsx
import { useDashboardNotifications } from '@/components/dashboard/DashboardAlerts';

function MyComponent() {
  const { showSuccess, showError, showInfo } = useDashboardNotifications();
  
  const handleSave = () => {
    showSuccess('บันทึกสำเร็จ');
  };
}
```

---

## 📊 Excel Export

### Export Single PR

```tsx
const exportPR = async (prId: number) => {
  const response = await api.get(`/prs/${prId}/export`);
  const data = response.data;
  
  // Create Excel using xlsx library
  const ws = XLSX.utils.json_to_sheet([
    ['PR Number', data.pr_number],
    ['Status', data.status],
    // ...
  ]);
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PR');
  XLSX.writeFile(wb, `PR-${data.pr_number}.xlsx`);
};
```

---

## 🔐 Authentication Flow

```
1. User Login
   POST /api/auth/login
   → Returns: { token, user: { storeId, ... } }

2. Token Storage
   localStorage.setItem('token', token)
   localStorage.setItem('user', JSON.stringify(user))

3. Auto Redirect
   if (user.storeId) {
     navigate('/dashboard'); // Auto to user's store
   }

4. API Calls
   All API calls include: Authorization: Bearer <token>
   Backend auto-filters by user's store_id
```

---

## 🧪 Testing Checklist

### Store & User
- [ ] Login → auto redirect to store dashboard
- [ ] User เห็นเฉพาะ inventory ของตัวเอง
- [ ] API กรองข้อมูลตาม store ถูกต้อง

### PR System
- [ ] สร้าง PR (เลือก items จาก master catalog)
- [ ] Export Excel อัตโนมัติ
- [ ] ส่ง Excel ให้ฝ่ายจัดซื้อ (ข้างนอกระบบ)
- [ ] รับของเข้า (ใส่เลข PO จากผู้ขาย)
- [ ] บันทึกราคาจริง (FIFO costing)
- [ ] Track status ถูกต้อง (ordered → partially/fully received)

### Cross-Department Pick
- [ ] ค้นหาของจาก store อื่น
- [ ] สร้างคำขอเบิกข้ามแผนก
- [ ] Manager อนุมัติ
- [ ] ดำเนินการเบิก

### Notifications
- [ ] Toast แสดงเมื่อมีเหตุการณ์
- [ ] Dashboard alerts auto-check
- [ ] Real-time notifications (SSE)
- [ ] Badge แสดงจำนวน unread

### Dashboard
- [ ] แจ้งเตือนของเข้าวันนี้
- [ ] แจ้งเตือนของเลยกำหนด
- [ ] แจ้งเตือนสต็อกต่ำ
- [ ] แจ้งเตือนรออนุมัติ

---

## 📁 File Structure

```
backend/server/src/
├── database-new.js              # Updated schema
├── index-new.js                 # New server entry
├── services/
│   ├── departmentService.js     # Dept/Store management
│   ├── masterItemService.js     # Master items + FIFO
│   ├── prService-simple.js      # PR-only (no PO)
│   ├── crossPickService.js      # Cross-dept picking
│   └── notificationService.js   # Notifications
└── routes/
    └── api-v2.js                # New API routes

frontend/src/
├── components/
│   ├── ui/sonner.tsx            # Sonner component
│   └── dashboard/
│       └── DashboardAlerts.tsx  # Auto alerts
├── contexts/
│   └── NotificationContext.tsx  # Notification provider
├── pages/
│   ├── PRList.tsx               # PR list with export
│   ├── CreatePR.tsx             # Create PR (with supplier)
│   ├── PRReceive.tsx            # Receive items
│   └── ...
└── services/
    └── api.ts                   # Updated API service
```

---

## 🚀 Deployment

```bash
# Backend
cd backend/server
npm install
npm start

# Frontend
cd frontend
npm install
npm run build
npm run preview
```

---

## 📝 Notes

- Default login: `admin` / `admin123`
- All routes require authentication (except /login)
- Store assignment is mandatory for users
- No approval in system (external workflow)
- FIFO cost tracking automatic
