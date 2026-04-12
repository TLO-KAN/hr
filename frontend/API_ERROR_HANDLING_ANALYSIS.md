# Frontend API Error Handling Analysis

## Overview
Analysis of error handling patterns in 4 leave-related frontend pages.

---

## 1. LeaveBalanceDashboard.tsx

### API Methods Used
- **api.get()** - For entitlements and departments
- **Direct fetch()** - For annual update recalculation

### Try-Catch Blocks: **2**

#### Block 1: `fetchData()`
```typescript
try {
  const response = await api.get(`/leave-entitlements?year=${selectedYear}`);
  const entitlements = response?.data || [];
  
  if (!Array.isArray(entitlements)) {
    throw new Error('Invalid response format: expected array');
  }
  // ... processing
} catch (error: any) {
  toast error with error?.message
  setData([])
} finally {
  setLoading(false)
}
```

**Issues Identified:**
- ✅ Validates response is array
- ⚠️ Does NOT validate field presence in array items
- ⚠️ Unchecked optional fields: `department_name`, `position_name`, `start_date` (defaults to empty string)
- ⚠️ `parseFloat()` on fields that might not exist - no null check

**Expected vs Potential Issues:**
```
Expected:
  - employee_id, employee_code, first_name, last_name
  - leave_type, entitled_days, used_days, remaining_days
  - department_name, position_name, start_date (optional)
  - years_of_service

Risk: If backend returns different leave_type format or missing fields,
the mapping logic silently fails (no error thrown):
  if (leaveType === 'vacation' || leaveType === 'annual' || leaveType === 'พักร้อน') { ... }
```

#### Block 2: `fetchDepartments()`
```typescript
try {
  const response = await api.get('/departments');
  const data = response?.data || [];
  setDepartments(Array.isArray(data) ? data : []);
} catch (error: any) {
  console.error (does NOT show toast)
  setDepartments([])
}
```

**Issues Identified:**
- ✅ Silently fails without user notification (might be intentional)
- ⚠️ No validation of department structure
- ⚠️ No error toast shown to user

#### Block 3: `handleRecalculateAll()` - Direct Fetch
```typescript
const response = await fetch('/api/leave-balances/run-annual-update', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
});

if (!response.ok) throw new Error('Failed to recalculate');
const result = await response.json();
toast with result.updated_employees || 0
```

**Issues Identified:**
- ✅ Checks response.ok status
- ⚠️ No token existence check before sending
- ⚠️ Generic error message
- ⚠️ Assumes `result.updated_employees` exists - no field validation

---

## 2. LeaveApproval.tsx

### API Methods Used
- **api.get()** - Fetch leave requests
- **api.put()** - Approve/reject requests

### Try-Catch Blocks: **3**

#### Block 1: `fetchLeaveRequests()`
```typescript
try {
  const response = await api.get('/leave-requests');
  const data = response?.data || [];
  
  const transformedData = (Array.isArray(data) ? data : []).map((item: any) => ({
    ...item,
    employee: item?.employee || {
      id: item?.employee_id,
      first_name: item?.first_name || '',
      last_name: item?.last_name || '',
      email: item?.email || '',
      user_id: item?.user_id,
    }
  }));
  
  setLeaveRequests(transformedData as LeaveWithEmployee[]);
} catch (error: any) {
  toast error
  setLeaveRequests([])
} finally {
  setLoading(false)
}
```

**Issues Identified:**
- ✅ Validates is array
- ✅ Provides fallback employee object with null coalescing
- ⚠️ Type casting `as LeaveWithEmployee[]` without actual validation
- ⚠️ NO field validation for leave request properties
- ⚠️ Assumes optional fields exist: `start_date`, `end_date`, `leave_type`, `reason`, `status`
- ⚠️ Uses `leave?.employee?.prefix` without checking if prefix exists (can render undefined)

**Expected Fields:**
```javascript
Expected:
  - id, status (pending/approved/rejected)
  - leave_type, start_date, end_date, total_days
  - reason, rejection_reason (optional)
  - employee: { id, first_name, last_name, user_id, email, prefix, department?, position? }
  - workflow_status (optional)

Risk Output:
  <p>{leave.employee.prefix} {leave.employee.first_name}</p>
  // If prefix is missing: "undefined John Doe"
```

#### Block 2: `handleApprove()`
```typescript
try {
  try {
    const response = await api.put(`/leave-requests/${leave?.id}/approve`, {});
    const result = response?.data || {};
    
    // Uses email/name formatting without validation
    if (leave?.employee?.user_id) {
      const startDate = leave?.start_date ? format(new Date(leave.start_date), ...) : '';
      // No check if start_date is valid ISO date
    }
    
    toast(result?.message || 'อนุมัติการลาของ...')
  } catch (apiError: any) {
    throw apiError; // Re-throw to outer catch
  }
} catch (error: any) {
  toast error
}
```

**Issues Identified:**
- ⚠️ **Nested try-catch** (inner try catches and rethrows to outer)
- ⚠️ Uses `format(new Date(leave.start_date), ...)` - no ISO date validation
- ⚠️ Assumes `result?.message` is a string
- ⚠️ No validation that API returned success

#### Block 3: `handleReject()`
```typescript
try {
  try {
    await api.put(`/leave-requests/${selectedLeave.id}/reject`, {
      rejection_reason: rejectionReason,
    });
    // Similar date formatting without validation
  } catch (apiError: any) {
    throw apiError;
  }
} catch (error: any) {
  toast error
}
```

**Issues Identified:**
- ⚠️ **Nested try-catch** (same pattern as handleApprove)
- ⚠️ Same date formatting issues

---

## 3. LeaveSettings.tsx

### API Methods Used
- **api.get()** - Fetch rules, entitlements
- **api.post()** - Create rules
- **api.put()** - Update rules
- **api.put()** - Delete rules
- **api.delete()** - Delete rules
- **api.post()** - Recalculate

### Try-Catch Blocks: **5**

#### Block 1: `fetchEntitlements()`
```typescript
try {
  setEntitlementLoading(true);
  const response = await api.get(`/admin/leave-entitlements?year=${year}`);
  const data = response?.data || [];
  setEntitlements((Array.isArray(data) ? data : []) as EmployeeEntitlementRow[]);
} catch (error: any) {
  toast error
  setEntitlements([])
} finally {
  setEntitlementLoading(false)
}
```

**Issues Identified:**
- ✅ Validates is array
- ⚠️ Type casting `as EmployeeEntitlementRow[]` without validation
- ⚠️ No field validation

**Expected Fields:**
```
employee_id, employee_code, first_name, last_name
employee_type, years_of_service, year, leave_type
entitled_days, used_days, remaining_days
```

#### Block 2: `fetchRules()`
```typescript
try {
  setLoading(true);
  const response = await api.get('/leave-policies');
  const data = response?.data || [];
  setRules((Array.isArray(data) ? data : []) as LeavePolicyRule[]);
} catch (error: any) {
  toast error
  setRules([])
} finally {
  setLoading(false)
}
```

**Issues Identified:**
- ✅ Validates is array
- ⚠️ Type casting without validation
- ⚠️ No field validation

#### Block 3: `handleSaveRule()`
```typescript
try {
  try {
    if (editingRule?.id) {
      await api.put(`/leave-policies/${editingRule.id}`, ruleData);
    } else {
      await api.post('/leave-policies', ruleData);
    }
  } catch (apiError: any) {
    throw apiError;
  }
  
  setIsDialogOpen(false);
  fetchRules();
} catch (error: any) {
  toast error with error?.message
}
```

**Issues Identified:**
- ⚠️ **Nested try-catch** (inner re-throws)
- ✅ Success response not checked for content
- ⚠️ No validation of what backend returns

#### Block 4: `handleDeleteRule()`
```typescript
try {
  try {
    await api.delete(`/leave-policies/${rule?.id}`);
  } catch (apiError: any) {
    throw apiError;
  }
  
  fetchRules();
} catch (error: any) {
  toast error
}
```

**Issues Identified:**
- ⚠️ **Nested try-catch**

#### Block 5: `handleRecalculateAll()`
```typescript
try {
  try {
    const currentYear = new Date().getFullYear();
    const response = await api.post('/leave-balances/run-annual-update', { year: currentYear });
    const data = response?.data || {};
    
    await fetchEntitlements(entitlementYear);
    toast with `updated ${data?.updated_employees || 0} คน`
  } catch (apiError: any) {
    throw apiError;
  }
} catch (error: any) {
  toast error
}
```

**Issues Identified:**
- ⚠️ **Nested try-catch**
- ⚠️ Assumes `data?.updated_employees` is a number

---

## 4. Holidays.tsx

### API Methods Used
- **api.get()** - Fetch holidays
- **api.post()** - Create holiday
- **api.put()** - Update holiday
- **api.delete()** - Delete holiday
- **Direct fetch()** - Import, copy holidays

### Try-Catch Blocks: **4**

#### Block 1: `fetchHolidays()`
```typescript
setLoading(true);
try {
  const response = await api.get(`/holidays?year=${selectedYear}`);
  const data = response?.data || [];
  const mapped = (Array.isArray(data) ? data : []).map((h: any) => ({
    id: h?.id,
    holiday_date: h?.date || h?.holiday_date,  // ⚠️ Tries two fields
    name: h?.name || '',
    description: h?.description || null,
    year: new Date(h?.date || h?.holiday_date || '').getFullYear(),
  }));
  setHolidays(mapped);
} catch (error: any) {
  toast error
  setHolidays([])
} finally {
  setLoading(false)
}
```

**Issues Identified:**
- ✅ Validates is array
- ✅ Maps data with fallbacks (date vs holiday_date)
- ⚠️ `new Date('').getFullYear()` could return NaN if both missing
- ⚠️ No validation that id, name exist

#### Block 2: `handleSaveHoliday()`
```typescript
try {
  try {
    if (editingHoliday?.id) {
      await api.put(`/holidays/${editingHoliday.id}`, {...});
    } else {
      await api.post('/holidays', {...});
    }
  } catch (apiError: any) {
    throw apiError;
  }
  
  setIsDialogOpen(false);
  fetchHolidays();
} catch (error: any) {
  toast({
    description: error.message?.includes('duplicate') 
      ? 'วันหยุดนี้มีอยู่ในระบบแล้ว' 
      : error.message
  })
}
```

**Issues Identified:**
- ⚠️ **Nested try-catch**
- ✅ Checks for specific error message (duplicate)
- ⚠️ Assumes error has message property

#### Block 3: `handleDeleteHoliday()`
```typescript
try {
  try {
    await api.delete(`/holidays/${deletingId}`);
  } catch (apiError: any) {
    throw apiError;
  }
  
  fetchHolidays();
} catch (error: any) {
  toast error
}
```

**Issues Identified:**
- ⚠️ **Nested try-catch**

#### Block 4: `handleImportFile()` - Direct Fetch
```typescript
for (const holiday of holidaysToInsert) {
  const res = await fetch('/api/holidays', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({...})
  });

  if (res.ok) {
    successCount += 1;
    continue;
  }

  const errData = await res.json();
  if (res.status === 409) {
    continue;  // ⚠️ Silently skip conflicts
  }
  errors.push(`เพิ่ม... ไม่สำเร็จ: ${errData?.error || 'unknown error'}`);
}
```

**Issues Identified:**
- ⚠️ **No outer try-catch** for direct fetch calls
- ✅ Handles 409 (conflict) specially
- ⚠️ Assumes `errData?.error` exists
- ⚠️ Could fail if `res.json()` throws (invalid JSON response)

#### Block 5: `handleCopyHolidays()` - Direct Fetch
```typescript
try {
  const sourceRes = await fetch(`/api/holidays?year=${copyFromYear}`);
  if (!sourceRes.ok) {
    const data = await sourceRes.json();
    throw new Error(data?.error || 'ไม่สามารถโหลด...');
  }

  const sourceHolidaysRaw = await sourceRes.json();
  // ... process data

  for (const holiday of newHolidays) {
    const res = await fetch('/api/holidays', {
      method: 'POST',
      ...
    });

    if (res.ok || res.status === 409) {
      if (res.ok) copiedCount += 1;
      continue;  // ⚠️ Silently skip failures
    }
  }
} catch (error: any) {
  toast error
}
```

**Issues Identified:**
- ⚠️ `await sourceRes.json()` called twice (wasteful)
- ⚠️ Assumes `data?.error` exists as string
- ⚠️ In copy loop: status !== ok AND !== 409 means error, but no logging
- ⚠️ Silently skips items if not ok/409

---

## Summary Table

| File | API Method Type | Try-Catch Blocks | Validation | Issues |
|------|---|---|---|---|
| **LeaveBalanceDashboard** | api + fetch | 2 | Array only | No field validation, unsafe optional field access |
| **LeaveApproval** | api | 3 | Array only | Type casting without validation, nested try-catch, unsafe date formatting |
| **LeaveSettings** | api | 5 | Array only | Type casting without validation, nested try-catch patterns |
| **Holidays** | api + fetch | 4 | Array + fallbacks | Double fetch, silent error skipping in loops, no null checks |

---

## Critical Issues Found

### 1. **Nested Try-Catch Anti-Pattern**
Multiple files use `try { try { ... } catch { throw } } catch { ... }`
- **Files:** LeaveApproval, LeaveSettings, Holidays
- **Why bad:** Inner catch re-throws, making inner catch useless
- **Fix:** Remove inner try-catch or handle specifically there

### 2. **Type Casting Without Validation**
```typescript
// Bad - casts as type without checking
setRules((Array.isArray(data) ? data : []) as LeavePolicyRule[]);
```
- **Files:** LeaveSettings, LeaveApproval, Holidays
- **Risk:** Backend could return invalid structure, no runtime validation
- **Fix:** Add field validation or use schema validation library

### 3. **Unsafe Field Access**
```typescript
// In LeaveApproval
<p>{leave.employee.prefix} {leave.employee.first_name}</p>
// If prefix missing: "undefined John Doe"
```
- **Files:** All files
- **Risk:** Undefined values render as "undefined" in UI
- **Fix:** Always use optional chaining and provide fallbacks

### 4. **Direct Fetch Inconsistency**
Some API calls use `api` service, others use direct `fetch()`
- **Files:** LeaveBalanceDashboard, Holidays
- **Risk:** Different error handling, no centralized interceptors
- **Fix:** Use api service consistently

### 5. **Silent Error Skipping in Loops**
```typescript
// Holidays.handleImportFile
if (res.status === 409) {
  continue;  // No logging of conflict
}
```
- **Files:** Holidays (import/copy functions)
- **Risk:** User doesn't know items were skipped
- **Fix:** Log skipped items, show in UI which ones failed

### 6. **Missing Token Validation**
- **Files:** LeaveBalanceDashboard, Holidays
- **Risk:** Could lose token between check and fetch
- **Fix:** Let fetch fail naturally with 401, handle globally

### 7. **Date String Not Validated**
```typescript
format(new Date(leave.start_date), 'd MMM', { locale: th })
// If start_date is invalid ISO: NaN error
```
- **Files:** LeaveApproval, LeaveSettings, Holidays
- **Risk:** Crashes on invalid dates
- **Fix:** Validate ISO format before formatting

---

## Recommended Fixes Priority

1. **High:** Remove nested try-catch patterns (leaveApproval, leaveSettings)
2. **High:** Add field validation after API responses
3. **Medium:** Consolidate on `api` service (remove direct fetch)
4. **Medium:** Add date validation before formatting
5. **Low:** Improve optional field handling with consistent fallbacks

