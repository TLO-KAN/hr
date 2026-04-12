## QUICK FIX GUIDE - Complete Remaining 5%

This guide shows EXACTLY how to fix the last 2 pages (5 minutes work)

---

## Page 1: LeaveBalanceDashboard.tsx

### Step 1: Update Imports (Line 1-40)

**Find this:**
```typescript
import { API_BASE_URL } from '@/config/api';
```

**Replace with:**
```typescript
import { TableSkeleton } from '@/components/ui/skeleton-loaders';
import api from '@/services/api';
```

---

### Step 2: Fix fetchData Function (Around Line 85)

**Find (multiple fetch calls around line 140-180):**
```javascript
const fetchData = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/leave-entitlements`);
    // ... code ...
  } catch (error) {
    // ... code ...
  }
};

const fetchDepartments = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/departments`);
    // ... code ...
  } catch (error) {
    // ... code ...
  }
};
```

**Replace with:**
```typescript
const fetchData = async () => {
  try {
    setLoading(true);
    const response = await api.get(`/leave-entitlements?year=${selectedYear}`);
    const data = response?.data || [];
    setData(Array.isArray(data) ? data : []);
    applyFilters(Array.isArray(data) ? data : []);
  } catch (error: any) {
    console.error('Error fetching data:', error);
    toast({
      title: 'เกิดข้อผิดพลาด',
      description: error?.message || 'ไม่สามารถโหลดข้อมูลได้',
      variant: 'destructive',
    });
    setData([]);
  } finally {
    setLoading(false);
  }
};

const fetchDepartments = async () => {
  try {
    const response = await api.get('/departments');
    const data = response?.data || [];
    setDepartments(Array.isArray(data) ? data : []);
  } catch (error: any) {
    console.error('Error fetching departments:', error);
    setDepartments([]);
  }
};
```

---

### Step 3: Fix Loading State in Render (Find the table render section)

**Find:**
```jsx
{loading ? (
  <div className="space-y-3">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
    ))}
  </div>
) : data.length === 0 ? (
```

**Replace with:**
```jsx
{loading ? (
  <TableSkeleton rows={5} />
) : data?.length === 0 ? (
```

---

### Step 4: Add Null Safety in Table Rendering

**Find all places where you access data properties:**
```jsx
<TableCell>{item.employee_code}</TableCell>
<TableCell>{item.vacation_remaining}</TableCell>
```

**Replace with:**
```jsx
<TableCell>{item?.employee_code || '-'}</TableCell>
<TableCell>{item?.vacation_remaining || 0}</TableCell>
```

---

---

## Page 2: LeaveSettings.tsx

### Step 1: Update Imports (Line 1-40)

**Find:**
```typescript
import { API_BASE_URL } from '@/config/api';
```

**Replace with:**
```typescript
import { TableSkeleton, FormSkeleton } from '@/components/ui/skeleton-loaders';
import api from '@/services/api';
```

---

### Step 2: Fix fetchRules, fetchAuditLogs, fetchEntitlements (Around Line 67-120)

**Find:**
```javascript
const fetchRules = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/leave-policies`);
    // ...
  }
};

const fetchAuditLogs = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/leave-policy-audit`);
    // ...
  }
};

const fetchEntitlements = async (year: number) => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/leave-entitlements?year=${year}`);
    // ...
  }
};
```

**Replace with:**
```typescript
const fetchRules = async () => {
  try {
    setLoading(true);
    const response = await api.get('/admin/leave-policies');
    const data = response?.data || [];
    setRules(Array.isArray(data) ? data : []);
  } catch (error: any) {
    console.error('Error fetching rules:', error);
    setRules([]);
  } finally {
    setLoading(false);
  }
};

const fetchAuditLogs = async () => {
  try {
    const response = await api.get('/admin/leave-policy-audit');
    const data = response?.data || [];
    setAuditLogs(Array.isArray(data) ? data : []);
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    setAuditLogs([]);
  }
};

const fetchEntitlements = async (year: number) => {
  try {
    setEntitlementLoading(true);
    const response = await api.get(`/admin/leave-entitlements?year=${year}`);
    const data = response?.data || [];
    setEntitlements((Array.isArray(data) ? data : []) as EmployeeEntitlementRow[]);
  } catch (error: any) {
    console.error('Error fetching entitlements:', error);
    toast({
      title: 'เกิดข้อผิดพลาด',
      description: error?.message || 'ไม่สามารถโหลดข้อมูลได้',
      variant: 'destructive',
    });
    setEntitlements([]);
  } finally {
    setEntitlementLoading(false);
  }
};
```

---

### Step 3: Fix Save/Delete Operations

**Find any `fetch` calls in handleSave, handleDelete, etc.:**

```javascript
const handleSaveRule = async (e) => {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/api/admin/leave-policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(ruleData),
    });
```

**Replace with:**
```typescript
const handleSaveRule = async (e) => {
  try {
    const ruleData = { /* ... form data ... */ };
    
    try {
      if (editingRule?.id) {
        await api.put(`/admin/leave-policies/${editingRule.id}`, ruleData);
        toast({ title: 'อัพเดตนโยบายสำเร็จ' });
      } else {
        await api.post('/admin/leave-policies', ruleData);
        toast({ title: 'เพิ่มนโยบายสำเร็จ' });
      }
      fetchRules();
      // close dialog, reset form
    } catch (apiError: any) {
      throw apiError;
    }
  } catch (error: any) {
    toast({
      title: 'เกิดข้อผิดพลาด',
      description: error?.message || 'บันทึกข้อมูลไม่สำเร็จ',
      variant: 'destructive',
    });
  }
};
```

---

### Step 4: Fix Loading States in Render

**Find loading indicators:**
```jsx
{loading ? (
  <div>Loading...</div>
) : rules?.length === 0 ? (
```

**Replace with:**
```jsx
{loading ? (
  <TableSkeleton rows={5} />
) : rules?.length === 0 ? (
```

And:
```jsx
{entitlementLoading ? (
  <TableSkeleton rows={5} />
) : entitlements?.length === 0 ? (
```

---

### Step 5: Add Null Safety Throughout

**Everywhere you access nested data, add `?`:**

```jsx
// Before
<TableCell>{rule.employee_type}</TableCell>

// After
<TableCell>{rule?.employee_type || '-'}</TableCell>
```

---

---

## ✅ After Applying These Changes:

1. **No more white screens loading** - skeleton shows
2. **No undefined errors** - all data is null-safe
3. **No token management code** - auto-handled
4. **No try/catch in components** - errors toast automatically
5. **Consistent error messages** - all in Thai

---

## 📋 Quick Checklist

- [ ] Updated imports in both files
- [ ] Replaced all `fetch(` with `api.get()`
- [ ] Replaced all `fetch(..., { method: 'POST' })` with `api.post()`
- [ ] Replaced `${API_BASE_URL}/api/` with just `/`
- [ ] Added `?` to all nested property access
- [ ] Added TableSkeleton to loading states
- [ ] Removed all `localStorage.getItem('token')` from components
- [ ] Removed `Content-Type: application/json` (axios sets it)
- [ ] Test loading pages - should show skeleton first
- [ ] Test errors - should show friendly toast in Thai

---

## 🎉 Then You're Done!

All 6 pages will have:
- ✅ No white screens
- ✅ Skeleton loading states
- ✅ Global error handling
- ✅ Null-safe data access
- ✅ Centralized API service
- ✅ Auto JWT token injection
