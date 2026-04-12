# TIER 3 & TIER 4 COMPREHENSIVE AUDIT
**Date:** April 6, 2026 | **Medium Thoroughness** | **Update Status**

---

## 📊 TIER 3 REMAINING (7 of 15) - 4 HOURS

### **T3-007: Mobile Responsiveness Gaps (25 min)**

**Actual Issues:**
1. ❌ Table layouts break on mobile < 640px
2. ❌ Data columns not responsive (missing `hidden sm:block`)
3. ❌ Form inputs lose focus state styling on mobile
4. ⚠️ Avatar/image elements not properly constrained

**Files:**
- [LeaveBalanceDashboard.tsx](frontend/src/pages/LeaveBalanceDashboard.tsx#L523) - Table render section (no mobile card layout)
- [LeaveApproval.tsx](frontend/src/pages/LeaveApproval.tsx#L150) - Leave request table (lines 150-200)
- [LeaveSettings.tsx](frontend/src/pages/LeaveSettings.tsx#L250) - Rules/entitlements tables
- [Positions.tsx](frontend/src/pages/Positions.tsx#L239) - Position table not responsive
- [Employees.tsx](frontend/src/pages/Employees.tsx) - Employee list table
- [tailwind.config.ts](frontend/tailwind.config.ts) - Breakpoints configured correctly, but not all pages use them

**Root Cause:**
Tables use `<table>` tag which doesn't reflow. Need card-based layout fallback for mobile via `hidden sm:block` CSS pattern.

**Fix Time:** 25 minutes (apply pattern to 5 components)

**Implementation:**
```tsx
// Replace table render with responsive version
{/* Desktop table */}
{!isMobile && (
  <Table>
    {/* existing table code */}
  </Table>
)}

{/* Mobile cards */}
{isMobile && (
  <div className="space-y-3">
    {data.map(item => (
      <Card key={item.id}>
        {/* Card layout */}
      </Card>
    ))}
  </div>
)}
```

---

### **T3-010: Leave Balance Calculation Bugs (30 min)**

**Actual Issues:**
1. ❌ Pro-rate calculation inconsistent between backend & frontend
   - Backend: `Math.round(proRateDays * 2) / 2` (lines 609-640 server.js)
   - Frontend: Uses `calculateLeaveEntitlement()` but doesn't validate result
2. ❌ Probation period (119 days) validation not enforced on frontend
3. ❌ Annual leave balance reset not synced to UI after Dec 31
4. ⚠️ `remaining_days` calculation doesn't account for pending approvals
5. ⚠️ Leave type normalization: 'vacation' vs 'annual' vs 'พักร้อน' inconsistency

**Files:**
- [backend/server.js](backend/server.js#L383-L400) - `calculateLeave()` function (pro-rate logic)
- [backend/server.js](backend/server.js#L609-L640) - `runAnnualLeaveBalanceUpdate()` (annual reset)
- [backend/server.js](backend/server.js#L2288) - Leave request validation
- [frontend/src/lib/leaveCalculation.ts](frontend/src/lib/leaveCalculation.ts#L181-L240) - `validateLeaveRequest()`
- [frontend/src/pages/LeaveBalanceDashboard.tsx](frontend/src/pages/LeaveBalanceDashboard.tsx#L158) - Summary mapping (leave_type normalization)
- [frontend/src/pages/LeaveRequest.tsx](frontend/src/pages/LeaveRequest.tsx#L113) - Validation real-time check

**Root Cause:**
Pro-rate calculation precision differs; probation check skipped on frontend; no validation of annual balance reset timing.

**Fix Time:** 30 minutes

**Implementation:**
```typescript
// Frontend: Add probation validation
const isProbationConflict = async (employeeId: string) => {
  const employee = await getEmployee(employeeId);
  const serviceDays = Math.floor(
    (new Date().getTime() - new Date(employee.start_date).getTime()) / 
    (1000 * 60 * 60 * 24)
  );
  return serviceDays < 119;
};

// Standardize leave type mapping
const normalizeLeaveType = (type: string): string => {
  const mapping: Record<string, string> = {
    'vacation': 'vacation',
    'annual': 'vacation', // Alias
    'พักร้อน': 'vacation', // Thai
    'sick': 'sick',
    'ป่วย': 'sick',
    'personal': 'personal',
    'กิจ': 'personal',
  };
  return mapping[type.toLowerCase()] || type;
};
```

---

### **T3-011: API Response Validation/Schema Checks (35 min)**

**Actual Issues:**
1. ❌ No runtime validation - pages type-cast without checking fields
2. ❌ Missing fields cause silent failures:
   - `leave_type_name` not returned (shows code not name)
   - `employee_name` not calculated
   - `approver_name` missing on leave requests
3. ❌ No validation before `parseFloat()` on balance fields
4. ⚠️ Bad data structure can crash loops in maps

**Files:**
- [frontend/src/pages/LeaveBalanceDashboard.tsx](frontend/src/pages/LeaveBalanceDashboard.tsx#L130-L165) - Response mapping without validation
- [frontend/src/pages/LeaveApproval.tsx](frontend/src/pages/LeaveApproval.tsx#L53) - Data transformation without field validation
- [frontend/src/pages/LeaveRequest.tsx](frontend/src/pages/LeaveRequest.tsx#L237) - Entitlements fetch without schema
- [frontend/src/pages/LeaveSettings.tsx](frontend/src/pages/LeaveSettings.tsx#L208) - Rules/entitlements type casting
- [frontend/src/pages/Holidays.tsx](frontend/src/pages/Holidays.tsx#L334) - Holiday date field inconsistency (date vs holiday_date)
- [backend/src/routes/](backend/src/routes/) - All GET endpoints missing JOINs for display names

**Root Cause:**
No schema validation library. Backend doesn't return display name fields. Frontend doesn't validate structure.

**Fix Time:** 35 minutes

**Implementation Approach:**

1. **Install Zod (part of T3-015)**
```bash
npm install zod
```

2. **Create validation schemas:**
```typescript
// frontend/src/lib/schemas.ts
import { z } from 'zod';

export const LeaveRequestSchema = z.object({
  id: z.string().uuid(),
  employee_id: z.string().uuid(),
  leave_type: z.string(),
  leave_type_name: z.string().optional(),
  start_date: z.string().refine(d => !isNaN(Date.parse(d))),
  end_date: z.string().refine(d => !isNaN(Date.parse(d))),
  status: z.enum(['pending', 'approved', 'rejected']),
  approver_name: z.string().optional(),
});
```

3. **Use in pages:**
```typescript
const response = await api.get('/leave-requests');
const validated = z.array(LeaveRequestSchema).parse(response?.data);
```

---

### **T3-012: Cache Invalidation Strategy (40 min)**

**Actual Issues:**
1. ❌ No cache layer - every page refetch all data on mount
2. ❌ Stale data possible: Update leave request, balance page doesn't refresh
3. ❌ localStorage used for temporary data but no invalidation strategy
4. ⚠️ No React Query (TanStack Query) cache management
5. ⚠️ Manual `fetchData()` calls don't deduplicate requests

**Files:**
- [frontend/src/services/api.js](frontend/src/services/api.js) - No cache headers set
- [frontend/src/pages/LeaveBalanceDashboard.tsx](frontend/src/pages/LeaveBalanceDashboard.tsx#L50) - Manual fetch on mount, no caching
- [frontend/src/pages/LeaveRequest.tsx](frontend/src/pages/LeaveRequest.tsx#L150) - Multiple fetches without deduplication
- [frontend/src/pages/Dashboard.tsx](frontend/src/pages/Dashboard.tsx#L21) - Dashboard data not cached
- [frontend/src/contexts/AuthContext.tsx](frontend/src/contexts/AuthContext.tsx#L89) - Token cached in localStorage but no invalidation

**Root Cause:**
Manual fetch-based architecture without caching strategy. No invalidation on mutations.

**Fix Time:** 40 minutes

**Implementation:**
```typescript
// Option 1: React Query (2-3 hours full implementation)
// Option 2: Simple cache wrapper (40 min quick fix)

// frontend/src/lib/queryCache.ts
class QueryCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private TTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, data: any) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  invalidate(key: string) {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) this.cache.delete(key);
    }
  }
}

export const queryCache = new QueryCache();
```

Usage:
```typescript
// In fetch function
const cached = queryCache.get('leaves');
if (cached) return cached;
const data = await api.get('/leaves');
queryCache.set('leaves', data);

// On mutation
await api.post('/leaves', leaveData);
queryCache.invalidatePattern('leaves'); // Refresh
```

---

### **T3-013: Loading States Missing (45 min)**

**Actual Issues:**
1. ❌ No skeleton loaders on slow API endpoints
2. ❌ Some pages show spinning icon but wrong UI state
3. ❌ Forms don't disable button during submission
4. ⚠️ Async data pages don't show progress

**Files:**
- [frontend/src/pages/Dashboard.tsx](frontend/src/pages/Dashboard.tsx#L21) - No skeleton loaders for stats
- [frontend/src/pages/Reports.tsx](frontend/src/pages/Reports.tsx#L39) - Has loading state but missing skeleton (lines 171-222)
- [frontend/src/pages/Employees.tsx](frontend/src/pages/Employees.tsx) - List page missing skeleton
- [frontend/src/pages/Departments.tsx](frontend/src/pages/Departments.tsx) - Missing skeleton
- [frontend/src/components/leave/LeaveBalanceDisplay.tsx](frontend/src/components/leave/LeaveBalanceDisplay.tsx) - No loading variant
- [frontend/src/components/ui/skeleton-loaders.tsx](frontend/src/components/ui/skeleton-loaders.tsx) - Created but not imported everywhere

**Root Cause:**
Skeleton loader components exist but not consistently imported/used across pages.

**Fix Time:** 45 minutes

**Implementation:**
```tsx
// Add to each page with async data:
import { PageSkeleton, TableSkeleton } from '@/components/ui/skeleton-loaders';

export default function Page() {
  const [loading, setLoading] = useState(true);

  // In render:
  {loading ? (
    <PageSkeleton />
  ) : (
    <div>
      {/* existing content */}
    </div>
  )}
}
```

Apply to:
- Dashboard.tsx (5 skeleton cards)
- Employees.tsx (table skeleton)
- Departments.tsx (table skeleton)
- Reports.tsx (already partially done, add FormSkeleton)
- LeaveSettings.tsx (already uses skeleton)

---

### **T3-014: Emoji/Encoding Issues in Forms (20 min)**

**Actual Issues:**
1. ⚠️ Form inputs don't handle emoji correctly in reason fields
2. ⚠️ Thai characters might be double-encoded in some fields
3. ⚠️ Copy-paste from Word documents includes hidden formatting

**Files:**
- [frontend/src/pages/LeaveRequest.tsx](frontend/src/pages/LeaveRequest.tsx#L400) - Reason textarea field
- [frontend/src/pages/Holidays.tsx](frontend/src/pages/Holidays.tsx#L173) - CSV import parsing
- [backend/server.js](backend/server.js#L2217) - Accept header missing for unicode

**Root Cause:**
No explicit UTF-8 encoding headers. Form inputs not sanitized before API call.

**Fix Time:** 20 minutes

**Implementation:**
```typescript
// frontend/src/lib/textSanitizer.ts
export const sanitizeFormText = (text: string): string => {
  if (!text) return '';
  
  // Normalize Unicode (NFC form)
  const normalized = text.normalize('NFC');
  
  // Remove hidden formatting (zero-width chars)
  const cleaned = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  // Trim
  return cleaned.trim();
};

// In form submission:
const sanitizedReason = sanitizeFormText(reason);
await leaveService.createLeaveRequest({
  ...data,
  reason: sanitizedReason
});
```

Backend headers:
```javascript
// server.js - ensure middleware sets:
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});
```

---

### **T3-015: Schema Validation - Zod Integration (60 min)**

**Actual Issues:**
1. ❌ No type-safe API responses - any = unsafe
2. ❌ Frontend trusts backend completely, no validation
3. ❌ Error messages vague ("Invalid response format")

**Files:**
- [frontend/src/services/](frontend/src/services/) - All services lack response types
- [frontend/src/pages/](frontend/src/pages/) - All pages type-cast with `as Type[]`
- [frontend/package.json](frontend/package.json) - zod not in dependencies

**Root Cause:**
No schema validation library. Manual type assertions instead of runtime validation.

**Fix Time:** 60 minutes

**Implementation - COMPLETE SOLUTION:**

```bash
cd frontend
npm install zod
```

Create schemas file:
```typescript
// frontend/src/lib/apiSchemas.ts
import { z } from 'zod';

// Leave Request Schema
export const LeaveRequestSchema = z.object({
  id: z.string().uuid(),
  employee_id: z.string().uuid(),
  leave_type: z.string(),
  start_date: z.string().date(),
  end_date: z.string().date(),
  reason: z.string(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']),
  created_at: z.string().datetime().optional(),
  approver_id: z.string().uuid().nullable(),
  approver_first_name: z.string().optional(),
  approver_last_name: z.string().optional(),
});

export const LeaveEntitlementSchema = z.object({
  id: z.string().uuid(),
  employee_id: z.string().uuid(),
  leave_type: z.string(),
  entitled_days: z.number().min(0),
  used_days: z.number().min(0),
  remaining_days: z.number().min(0),
  year: z.number(),
});

export const EmployeeSchema = z.object({
  id: z.string().uuid(),
  employee_code: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string().email(),
  department_id: z.string().uuid().optional(),
  department_name: z.string().optional(),
  position_id: z.string().uuid().optional(),
  position_name: z.string().optional(),
  start_date: z.string().date(),
  gender: z.enum(['male', 'female', 'other']).optional(),
});

// Helper for parsing lists
export const parseListResponse = <T,>(schema: z.ZodSchema<T>, data: any): T[] => {
  const arraySchema = z.array(schema);
  return arraySchema.parse(data);
};
```

Update all pages:
```typescript
// Before:
const response = await api.get('/leave-requests');
const data = response?.data || [];
setLeaveRequests(data);

// After:
const response = await api.get('/leave-requests');
const data = parseListResponse(LeaveRequestSchema, response?.data || []);
setLeaveRequests(data);
```

---

## 🎨 TIER 4 POLISH (6 Nice-To-Have Features) - 2 HOURS

### **T4-001: Advanced Table Sorting & Filtering (30 min)**

**Issue:** Tables don't support multi-column sort or advanced filters  
**Files:**
- [LeaveApproval.tsx](frontend/src/pages/LeaveApproval.tsx#L100) - Leave requests table
- [LeaveBalanceDashboard.tsx](frontend/src/pages/LeaveBalanceDashboard.tsx#L365) - Employee balance table
- [Employees.tsx](frontend/src/pages/Employees.tsx) - Employee list

**Implementation:**
- Add column headers with sort icons
- Add date range picker for date filters
- Add department dropdown filter
- Add search by name/ID

**Estimate:** 30 min (1 component as template, replicate to others)

---

### **T4-002: Export to CSV/PDF (25 min)**

**Issue:** No way to export reports  
**Files:**
- [Reports.tsx](frontend/src/pages/Reports.tsx) - Add export button
- New: `frontend/src/lib/exportUtils.ts` - Create helper
- [LeaveBalanceDashboard.tsx](frontend/src/pages/LeaveBalanceDashboard.tsx) - Add export

**Implementation:**
```typescript
const exportToCSV = (data: any[], filename: string) => {
  const csv = [
    Object.keys(data[0]).join(','),
    ...data.map(row => Object.values(row).join(','))
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
};
```

**Estimate:** 25 min

---

### **T4-003: Bulk Operations (40 min)**

**Issue:** Can only approve/reject one leave at a time  
**Files:**
- [LeaveApproval.tsx](frontend/src/pages/LeaveApproval.tsx) - Add checkbox column + bulk actions
- [backend/server.js](backend/server.js#L2300) - Add batch endpoint

**Implementation:**
- Add checkbox to table header (select all)
- Show action bar when items selected
- Add "Approve Selected" + "Reject Selected" buttons
- Backend: POST `/api/leaves/batch-approve` endpoint

**Estimate:** 40 min

---

### **T4-004: Advanced Date Range Filtering (20 min)**

**Issue:** Can only filter by year, not flexible date ranges  
**Files:**
- [LeaveBalanceDashboard.tsx](frontend/src/pages/LeaveBalanceDashboard.tsx#L50) - Add date pickers
- [Reports.tsx](frontend/src/pages/Reports.tsx) - Add date filtering

**Implementation:**
- Add DateRangePicker component (using shadcn/ui if available)
- Allow "This Month", "This Quarter", "Last 30 Days", "Custom Range"

**Estimate:** 20 min

---

### **T4-005: Department/Team Analytics Dashboard (25 min)**

**Issue:** No team-level metrics  
**Files:**
- New: `frontend/src/pages/TeamAnalytics.tsx`

**Features:**
- Chart: Leave approvals by department
- Chart: Leave balance distribution
- Table: Department summary stats

**Estimate:** 25 min

---

### **T4-006: Performance Optimization (20 min)**

**Issues:**
1. Large lists not paginated frontend-side
2. Images not lazy-loaded
3. Components not memoized

**Files:**
- [Employees.tsx](frontend/src/pages/Employees.tsx) - Add pagination UI
- [LeaveBalanceDashboard.tsx](frontend/src/pages/LeaveBalanceDashboard.tsx) - Add virtualization for large lists
- [LeaveBalanceDisplay.tsx](frontend/src/components/leave/LeaveBalanceDisplay.tsx) - Memoize with React.memo()

**Implementation:**
```typescript
// Add pagination
const [page, setPage] = useState(1);
const pageSize = 25;
const paginatedData = data.slice((page - 1) * pageSize, page * pageSize);

// Memoize components
export default React.memo(MyComponent);
```

**Estimate:** 20 min

---

## 📋 PRIORITIZATION MATRIX

| # | Issue | T3/T4 | Severity | Time | Impact | Priority |
|---|-------|-------|----------|------|--------|----------|
| 1 | Mobile responsiveness | T3-007 | High | 25m | All mobile users | **NOW** |
| 2 | Leave balance calc | T3-010 | High | 30m | Financial accuracy | **NOW** |
| 3 | API validation | T3-011 | High | 35m | System stability | **HIGH** |
| 4 | Loading states | T3-013 | Medium | 45m | UX polish | **MEDIUM** |
| 5 | Schema validation (Zod) | T3-015 | High | 60m | Type safety | **MEDIUM** |
| 6 | Cache strategy | T3-012 | Medium | 40m | Performance | **MEDIUM** |
| 7 | Emoji/encoding | T3-014 | Low | 20m | Data integrity | **LOW** |
| 8 | Bulk operations | T4-003 | Low | 40m | User convenience | **POLISH** |
| 9 | Export CSV | T4-002 | Low | 25m | Reporting | **POLISH** |
| 10 | Analytics | T4-005 | Low | 25m | Insights | **POLISH** |

---

## ⏱️ EXECUTION TIMELINE

**IMMEDIATE (TODAY - 2 hours):**
- ✅ T3-007 (Mobile) - 25 min
- ✅ T3-010 (Leave Balance) - 30 min
- ✅ T3-011 (API Validation) - 35 min
- ✅ T3-013 (Loading States) - 45 min

**FOLLOW-UP (NEXT 2 hours):**
- ⏳ T3-015 (Zod) - 60 min
- ⏳ T3-012 (Cache) - 40 min
- ⏳ T3-014 (Emoji) - 20 min

**POLISH (OPTIONAL - 2 hours):**
- 🎨 T4-003 (Bulk ops) - 40 min
- 🎨 T4-002 (Export) - 25 min
- 🎨 T4-005 (Analytics) - 25 min
- 🎨 T4-004 (Date filter) - 20 min
- 🎨 T4-001 (Sort filter) - 30 min
- 🎨 T4-006 (Performance) - 20 min

**Total TIER 3:** 4 hours  
**Total TIER 4:** 2 hours  
**Grand Total:** 6 hours to completion

---

## ✅ FILES TO MODIFY SUMMARY

**Backend (3 files):**
- server.js - Add batch endpoints, ensure JOINs for display names
- Add rate limiting headers
- Ensure UTF-8 encoding

**Frontend (15+ files):**
- Core: api.js, leave.service.js (add cache integration)
- Pages: LeaveApproval, LeaveBalanceDashboard, LeaveRequest, LeaveSettings, Dashboard, Employees, Departments, Holidays, Reports
- Components: LeaveBalanceDisplay, AvatarUpload
- New: Create apiSchemas.ts, queryCache.ts, textSanitizer.ts
- Config: tailwind verified, package.json (add zod)

---

**End of Comprehensive Audit**
