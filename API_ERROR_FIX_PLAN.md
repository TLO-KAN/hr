# 🛠️ API Error Fix Master Plan

## 📊 Priority Matrix

### **CRITICAL (Fix first) - ⏰ 1-2 hours**
High impact + High likelihood of errors
- [ ] `LeaveBalanceDashboard.tsx` - `GET /leave-entitlements` - ❌ Error: "Server error"
- [ ] `LeaveRequestController.js` - `GET /my-requests` - Check schema
- [ ] `LeaveApproval.tsx` - `GET /leave-requests` - ❌ Nested try-catch
- [ ] Leave Request service endpoints - Check all required fields

### **HIGH (Fix next) - ⏰ 2-3 hours**
Medium impact pages using list endpoints
- [ ] `Employees.tsx` - `GET /employees` - ❌ Already broken
- [ ] `Dashboard.tsx` - `GET /employees`, `GET /leave-requests`
- [ ] `Holidays.tsx` - `GET /holidays` - Silent failures in loops
- [ ] `LeaveSettings.tsx` - Multiple calls + nested try-catch
- [ ] Employee service - validate all fields

### **MEDIUM (Fix after core) - ⏰ 3-4 hours**
Department/Position related + Auth
- [ ] `Positions.tsx` - `GET /positions`, `GET /departments`
- [ ] `Departments.tsx` - `GET /departments`
- [ ] `Profile.tsx` - `GET /employees/{id}` + `POST /change-password`
- [ ] `Settings.tsx` - `GET /employees`, `GET /user-roles`

### **LOW (Nice to have) - ⏰ After core is stable**
Utility/non-critical endpoints
- [ ] `Reports.tsx` - `GET /leave-requests` (analytics only)
- [ ] `PermissionsDebug.tsx` - Debug page
- [ ] Notification components - `GET /notifications`
- [ ] Holiday calendar - `GET /holidays`

---

## 🔧 Systematic Fix Approach

### **Step 1: Standardize API Error Handling** (Frontend)
```javascript
// Create a centralized response validator
src/lib/apiResponseValidator.ts
- Validates all API responses against expected schema
- Throws meaningful errors with field names
```

### **Step 2: Document Expected Responses** (Backend → Frontend)
For each endpoint, document:
```
GET /leaves
Returns: {
  success: boolean,
  data: LeaveRequest[] where each has:
    - id (UUID)
    - employee_id (UUID)
    - leave_type (VARCHAR) ← The problematic field!
    - leave_type_name (VARCHAR) ← Would be helpful
    - start_date (DATE)
    - end_date (DATE)
    - status (VARCHAR)
    - ... other fields
}
```

### **Step 3: Fix Backend Controllers** 
Ensure all endpoints return consistent field names:
- ✅ Add missing required fields (e.g., leave_type_name)
- ✅ Consistent field naming across all endpoints
- ✅ Always include both code AND name for type fields
- ✅ Join with related tables for display names

### **Step 4: Fix Frontend Pages** (In priority order)
For each page:
1. Replace try-catch with proper error handling
2. Add field validation before use
3. Use `api` service consistently (not mixed fetch())
4. Add visual error messages

---

## ✅ Verification Checklist

For each fixed endpoint:
- [ ] Backend returns all expected fields
- [ ] No null/undefined in required fields
- [ ] Frontend validates response schema
- [ ] Error messages are user-facing (Thai)
- [ ] Works with empty data (0 results)
- [ ] Pagination works if applicable
- [ ] Tested with different user roles

---

## 📝 Backend Fields to Check

### Likely Schema Problems (8 endpoints)
1. **leave_requests** 
   - ❌ Missing: leave_type_name, employee_name
   - Solution: Add JOINs in repository

2. **employees**
   - ❌ Check: department_name, position_name returned?
   - Solution: Verify JOINs in service

3. **leave_entitlements**
   - ❌ Check: What fields actually returned?
   - Solution: Compare with LeaveBalanceDashboard expectations

4. **holidays**
   - Check: date format consistency
   - Check: is_public_holiday included?

5. **approval_workflows**
   - Check: Which fields required?

6. **notification_settings**
   - Check: Structure returned?

7. **user_roles**
   - Check: All permission fields?

8. **leave_policies**
   - Check: Full policy details?

---

## 🚀 Quick Wins (Do immediately)

### Backend - 15 minutes
```sql
-- For each GET endpoint returning lists, verify:
SELECT lr.*, 
       lt.name as leave_type_name,  ← Add this
       e.display_name as employee_name  ← Add this
FROM leave_requests lr
LEFT JOIN leave_types lt ON lr.leave_type = lt.code
LEFT JOIN employees e ON lr.employee_id = e.id
```

### Frontend - 30 minutes
```typescript
// In each service file, add response types:
interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  leave_type_name: string;  ← Add
  start_date: string;
  // ... etc
}

// Then in pages, validate:
const response = await leaveService.getLeaveRequests();
if (!Array.isArray(response?.data)) {
  throw new Error('Invalid response format');
}
```

---

## 📊 Estimated Impact

| Category | Count | Impact |
|----------|-------|--------|
| Pages affected | 17 | High |
| Service files | 4 | Critical |
| API endpoints | 40+ | Critical |
| Components affected | 10 | Medium |

**Total time to fix all:** ~6-8 hours
**Your choice:** Fast path (critical only, 2 hours) or complete overhaul

---

## Next Steps

1. **Do you want me to:**
   - [ ] Fix the CRITICAL pages first? (LeaveBalanceDashboard, LeaveApproval, etc.)
   - [ ] Do a complete backend audit first?
   - [ ] Create reusable validation library?

2. **Start with which endpoint:**
   - Most broken now?
   - Most used by users?
   - Easiest to fix?
