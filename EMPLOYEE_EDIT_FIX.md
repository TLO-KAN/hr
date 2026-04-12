# แก้ไข Bug - แก้ไขข้อมูลพนักงานและ Dropdown Dependencies

## ปัญหาที่แก้ไข

### 1. ❌ แก้ไขข้อมูลพนักงาน (Edit) ไม่สามารถบันทึกได้
**Root Cause**: PUT /api/employees/:id ไม่มี JWT Authentication
- Frontend ส่ง Authorization token แต่ Backend ไม่ได้ require `authenticate` middleware
- Request ถูก reject หรือ error

### 2. ❌ Dropdown ไม่สอดคล้องกัน (Dependent Dropdown)
**Root Cause**: ตำแหน่ง dropdown แสดงทั้งหมด ไม่ filter ตามแผนก
- เลือกแผนก A แต่ตำแหน่งยังแสดง B, C, D ด้วย
- ต้องการ: เลือก "IT" → แสดงแค่ "Software Engineer", "DevOps Engineer"

## สิ่งที่แก้ไข

### 1. Backend Server (server.js)
✅ เพิ่ม `authenticate` middleware ให้ PUT /api/employees/:id
```javascript
app.put('/api/employees/:id', authenticate, async (req, res) => {
  // ... update logic
});
```
**ผลกระทบ**: ต้อง include JWT token ในการแก้ไขข้อมูล

### 2. Frontend - Employees.tsx 

#### A. เพิ่ม filteredPositions state
```typescript
const [filteredPositions, setFilteredPositions] = useState<typeof positions>([]);
```

#### B. เพิ่ม useEffect สำหรับ filter positions ตามแผนก
```typescript
useEffect(() => {
  if (selectedDepartmentId && selectedDepartmentId !== 'none') {
    const filtered = positions.filter(pos => 
      String(pos.department_id) === selectedDepartmentId
    );
    setFilteredPositions(filtered);
    // Clear position if not in filtered list
    if (selectedPositionId && !filtered.some(p => String(p.id) === selectedPositionId)) {
      setSelectedPositionId('');
    }
  } else {
    setFilteredPositions(positions);
  }
}, [selectedDepartmentId, positions]);
```

#### C. ใช้ filteredPositions ในตำแหน่ง dropdown
```typescript
<SelectContent>
  <SelectItem value="none">-- ไม่ระบุ --</SelectItem>
  {filteredPositions.length > 0 ? (
    filteredPositions.map((pos) => (
      <SelectItem key={pos.id} value={String(pos.id)}>
        {pos.name}
      </SelectItem>
    ))
  ) : (
    <p className="p-2 text-sm text-muted-foreground">
      ไม่มีตำแหน่งสำหรับแผนกนี้
    </p>
  )}
</SelectContent>
```

#### D. เพิ่ม JWT token ให้ PUT request
```typescript
if (editingEmployee) {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/employees/${editingEmployee.id}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(employeeData),
  });
```

## ใช้งาน

### Workflow การแก้ไขข้อมูลพนักงาน
1. ✅ คลิก **Edit** ในแถวพนักงาน → เปิด Form
2. ✅ เลือก **แผนก** → ตำแหน่ง dropdown **อัตโนมัติ update**
3. ✅ แก้ไขข้อมูลอื่นๆตามต้องการ
4. ✅ คลิก **Save** → ส่ง PUT request พร้อม JWT token
5. ✅ บันทึกสำเร็จ → ข้อมูลในตารางอัพเดต

### ตัวอย่างการเลือก
```
แผนก: IT ────────────────────┐
                               ├───> ตำแหน่ง: [
                               │       - Software Engineer ✓
                               │       - DevOps Engineer ✓
                               │     ]

แผนก: Sales ──────────────────┤
                               ├───> ตำแหน่ง: [
                               │       - Sales Executive ✓
                               │     ]

แผนก: ไม่ระบุ ────────────────┤
                               └───> ตำแหน่ง: [ทั้งหมด]
```

## Features

✅ **JWT Protection**: ต้อง login แล้วจึงแก้ไขได้
✅ **Dependent Dropdown**: ตำแหน่งอัตโนมัติกรองตามแผนก
✅ **Smart Clear**: ถ้าเลือกตำแหน่ง A ของแผนก X แล้วเปลี่ยนเป็นแผนก Y → ตำแหน่งจะ clear
✅ **No Results Message**: "ไม่มีตำแหน่งสำหรับแผนกนี้" (ถ้าแผนกไม่มีตำแหน่ง)
✅ **Error Handling**: Toast notification สำหรับ success/error

## API

### GET /api/positions (Response includes)
```json
{
  "id": 1,
  "name": "Software Engineer",
  "department_id": 1,
  "department_name": "IT",
  "description": "Software Development",
  "employee_count": "0"
}
```

### PUT /api/employees/:id (Requires JWT)
```bash
Authorization: Bearer {token}
Content-Type: application/json

{
  "first_name": "สมชาย",
  "last_name": "ใจดี",
  "department_id": "1",
  "position_id": "2",
  ...
}
```

## Testing
1. ✅ Backend API accepts JWT token for PUT
2. ✅ Frontend sends token with PUT request
3. ✅ Dropdown filters correctly when department changes
4. ✅ Position clears if no longer valid
5. ✅ Edit form saves successfully
6. ✅ Table refreshes after edit

## Files Modified
- `/Applications/HR/backend/server.js` - Added authenticate to PUT /api/employees/:id
- `/Applications/HR/frontend/src/pages/Employees.tsx` - Dependent dropdown + JWT for PUT
