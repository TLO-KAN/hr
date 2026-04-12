# แก้ไข Bug - เมนูจัดการแผนกและตำแหน่ง

## ปัญหาที่แก้ไข
- ❌ เมนูจัดการแผนก (Departments) - ไม่ใช้งานได้ (ยังใช้ Supabase เก่า)
- ❌ เมนูจัดการตำแหน่ง (Positions) - ไม่ใช้งานได้ (ยังใช้ Supabase เก่า)
- ❌ ไม่มีข้อมูลตัวอักษรของทำงาน (Card view แทน Table view)
- ❌ ไม่สามารถเพิ่ม/แก้ไข/ลบ แผนค และตำแหน่งได้

## สิ่งที่แก้ไข

### 1. Backend API Endpoints (server.js)
✅ เพิ่ม **POST /api/departments** - สร้างแผนกใหม่ (require JWT)
✅ เพิ่ม **PUT /api/departments/:id** - แก้ไขแผนก (require JWT)
✅ เพิ่ม **DELETE /api/departments/:id** - ลบแผนก (require JWT)
✅ เพิ่ม **POST /api/positions** - สร้างตำแหน่งใหม่ (require JWT)
✅ เพิ่ม **PUT /api/positions/:id** - แก้ไขตำแหน่ง (require JWT)
✅ เพิ่ม **DELETE /api/positions/:id** - ลบตำแหน่ง (require JWT)

### 2. GET Endpoint Enhancements
✅ **GET /api/departments** - เพิ่ม `employee_count` และ `position_count`
   ```sql
   SELECT d.*, 
          (SELECT COUNT(*) FROM employees WHERE department_id = d.id) as employee_count,
          (SELECT COUNT(*) FROM positions WHERE department_id = d.id) as position_count
   FROM departments d 
   ORDER BY d.name
   ```

✅ **GET /api/positions** - เพิ่ม `department_name` และ `employee_count`
   ```sql
   SELECT p.*, 
          d.name as department_name,
          (SELECT COUNT(*) FROM employees WHERE position_id = p.id) as employee_count
   FROM positions p
   LEFT JOIN departments d ON p.department_id = d.id
   ORDER BY p.name
   ```

### 3. Frontend - Departments.tsx
✅ Migrated from Supabase to Backend REST API
✅ Changed from **Card Grid** layout to **Table** layout
✅ เพิ่ม **Employee Count** column แสดงจำนวนพนักงาน
✅ เพิ่ม **Position Count** column แสดงจำนวนตำแหน่ง
✅ เพิ่ม **JWT Authentication** สำหรับ POST/PUT/DELETE
✅ เพิ่ม error handling และ loading states

### 4. Frontend - Positions.tsx
✅ Migrated from Supabase to Backend REST API
✅ Changed from **Card Grid** layout to **Table** layout
✅ เพิ่ม **Department Name** column
✅ เพิ่ม **Employee Count** column แสดงจำนวนพนักงาน
✅ เพิ่ม **JWT Authentication** สำหรับ POST/PUT/DELETE
✅ Fixed department_id type conversion (String)

## API Request/Response Examples

### Create Department
```bash
POST /api/departments
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Marketing",
  "description": "การตลาด"
}

Response:
{
  "id": 6,
  "name": "Marketing",
  "description": "การตลาด",
  "created_at": "2026-03-29T...",
  "updated_at": "2026-03-29T..."
}
```

### Create Position
```bash
POST /api/positions
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Marketing Manager",
  "department_id": "6",
  "description": "จัดการการตลาด"
}
```

### Get Departments (with counts)
```bash
GET /api/departments

Response:
[
  {
    "id": 4,
    "name": "Finance",
    "description": "Finance Department",
    "employee_count": "2",
    "position_count": "1"
  },
  ...
]
```

## ใช้งาน

### CRUD Operations
- ✅ **Create** - คลิก "เพิ่มแผนก/ตำแหน่ง" เติมข้อมูลและบันทึก
- ✅ **Read** - โหลดข้อมูลอัตโนมัติจาก Backend API
- ✅ **Update** - คลิก Edit ในแถวตาราง แก้ไขและบันทึก
- ✅ **Delete** - คลิก Delete ยืนยันการลบ (ตรวจสอบว่าไม่มีตำแหน่ง/พนักงานใช้)

### Validation
- ❌ ไม่สามารถลบแผนกที่มีตำแหน่งใช้งาน
- ❌ ไม่สามารถลบตำแหน่งที่มีพนักงาน

## Database Relationships
```
Departments (1) ──── (Many) Positions
Departments (1) ──── (Many) Employees
Positions (1) ──── (Many) Employees
```

## Features
✅ Table view แสดงข้อมูลชัดเจน
✅ Employee count / Position count realtime
✅ Responsive design (mobile-friendly)
✅ Loading states และ error handling
✅ Toast notifications สำหรับการทำรายการสำเร็จ/ล้มเหลว
✅ JWT authentication สำหรับทุก mutation operations
✅ Data validation ที่ Backend และ Frontend

## Testing
1. ✅ Backend API returns correct data with counts
2. ✅ Frontend loads departments/positions from Backend API
3. ✅ CRUD operations work with JWT authentication
4. ✅ Table displays all data correctly
5. ✅ Employee/Position counts display accurately

## Files Modified
- `/Applications/HR/backend/server.js` - Added 6 new endpoints
- `/Applications/HR/frontend/src/pages/Departments.tsx` - Migrated to Backend API + Table view
- `/Applications/HR/frontend/src/pages/Positions.tsx` - Migrated to Backend API + Table view
