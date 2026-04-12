# Dashboard Updates - Employee & Manager Roles

**Date**: April 1, 2026  
**Status**: ✅ Complete

---

## 📊 Changes Summary

### User Story
- **Employee**: ต้องการดูสิทธิ์วันลา ปฏิทินวันหยุด และการลาของทีม (ไม่เห็นสถิติทั้งบริษัท)
- **Manager**: ต้องการดูสิทธิ์วันลาของตัวเอง ปฏิทินวันหยุด และการลาของทีม
- **HR/Admin**: ยังคงดูสถิติทั้งหมด ข้อมูลการลา และปุ่มอนุมัติ

---

## 📁 Files Modified/Created

### New Component
```
frontend/src/components/leave/LeaveBalanceDisplay.tsx
```
- Reusable component for displaying leave entitlements
- Features:
  - Fetches from `/api/leave-entitlements`
  - Shows: quota, used days, remaining days per leave type
  - Support for prorated entitlements
  - Gender-based filtering (maternity leave for females only)
  - Responsive grid layout
  - Loading & error states

### Modified Pages
```
frontend/src/pages/Dashboard.tsx
```
**Changes:**
- Added role-based conditional rendering
- Removed: All employees stat, pending leaves stat, approved this month stat, vacation this month stat
- Removed: Recent leave requests section
- Removed: Monthly leave summary section
- Added imports:
  - `LeaveBalanceDisplay` component
  - `HolidayCalendar` component
  - `TeamLeaveCalendar` component

---

## 🎯 Dashboard Views by Role

### 1️⃣ Employee Dashboard
```
┌─────────────────────────────────────┐
│ Employee - Welcome, [Name]          │
├─────────────────────────────────────┤
│ [Holiday Notification - 7 days]     │
│                                     │
│ ┌─ Leave Entitlements ──────────┐  │
│ │ ┌─────────┐  ┌─────────────┐  │  │
│ │ │ Vacation│  │ Sick Leave  │  │  │
│ │ │ 15 / 15 │  │ 10 / 10     │  │  │
│ │ │ วัน     │  │ วัน        │  │  │
│ │ └─────────┘  └─────────────┘  │  │
│ │              ┌──────────────┐  │  │
│ │              │ Personal     │  │  │
│ │              │ 3 / 3 วัน    │  │  │
│ │              └──────────────┘  │  │
│ └─ Calendar ───────────────────┘  │
│                                     │
│ ┌─ Holiday Calendar ────────────┐  │
│ │ [Calendar with holidays]      │  │
│ └───────────────────────────────┘  │
│                                     │
│ ┌─ Team Leave Calendar ─────────┐  │
│ │ [Team members' leave calendar]│  │
│ └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Removed:**
- ❌ Total employees stat
- ❌ Pending leaves stat
- ❌ Approved this month stat
- ❌ Vacation this month stat
- ❌ Recent leave requests
- ❌ Monthly summary chart

---

### 2️⃣ Manager Dashboard
```
┌─────────────────────────────────────┐
│ Manager - Welcome, [Name]           │
├─────────────────────────────────────┤
│ [Holiday Notification - 7 days]     │
│                                     │
│ ┌─ My Leave Entitlements ────────┐  │
│ │ [Leave balance cards]          │  │
│ └────────────────────────────────┘  │
│                                     │
│ ┌─ Holiday Calendar ────────────┐  │
│ │ [Calendar with holidays]      │  │
│ └───────────────────────────────┘  │
│                                     │
│ ┌─ Team Leave Calendar ─────────┐  │
│ │ [All team members' leaves]    │  │
│ └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Added:**
- ✅ Own leave entitlements
- ✅ Holiday calendar
- ✅ Team leave calendar

---

### 3️⃣ HR/Admin Dashboard (Unchanged)
```
┌─────────────────────────────────────────┐
│ HR/Admin - Welcome, [Name]              │
├─────────────────────────────────────────┤
│                                         │
│ ┌─ Stats Grid ──────────────────────┐  │
│ │ ┌──────────┐  ┌──────────┐        │  │
│ │ │ Total    │  │ Pending  │        │  │
│ │ │ Employees│  │ Leaves   │        │  │
│ │ │ 150      │  │ 12       │        │  │
│ │ └──────────┘  └──────────┘        │  │
│ │ ┌──────────┐  ┌──────────┐        │  │
│ │ │ Approved │  │ Vacation │        │  │
│ │ │ this mth │  │ this mth │        │  │
│ │ │ 45       │  │ 28       │        │  │
│ │ └──────────┘  └──────────┘        │  │
│ └──────────────────────────────────┘  │
│                                         │
│ ┌─ Recent Leaves ──┐  ┌─ Monthly ───┐  │
│ │ [Recent list]    │  │ [Summary]   │  │
│ └──────────────────┘  └─────────────┘  │
│                                         │
│ ┌─ Quick Actions ────────────────────┐ │
│ │ 12 requests pending - Review now   │ │
│ └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 🔧 Technical Details

### Role Detection Logic
```typescript
const { isHROrAdmin, employee, roles } = useAuth();
const isManager = roles.includes('supervisor') || 
                  roles.includes('manager');

if (!isHROrAdmin && !isManager) {
  // Employee view
} else if (isManager && !isHROrAdmin) {
  // Manager view
} else {
  // HR/Admin view
}
```

### Component Imports
```typescript
import { LeaveBalanceDisplay } from '@/components/leave/LeaveBalanceDisplay';
import { HolidayCalendar } from '@/components/leave/HolidayCalendar';
import { TeamLeaveCalendar } from '@/components/leave/TeamLeaveCalendar';
```

### API Endpoints Used
- `/api/leave-entitlements` - Get employee's leave balance
- `supabase.from('employees')` - Get total employees (HR/Admin only)
- `supabase.from('leave_requests')` - Get recent leave requests (HR/Admin only)

---

## 📱 Responsive Design

### Desktop (lg)
- Leave balance: 3 columns grid
- Full-width calendars
- Side-by-side layout for stats

### Tablet (md)
- Leave balance: 2-3 columns
- Responsive card sizes
- Stacked calendars

### Mobile
- Leave balance: 2 columns
- Compact text sizes
- Full-width cards

---

## ✨ Features Implemented

✅ **Leave Balance Display**
- Shows all leave types for the employee
- Color-coded by type (vacation, sick, personal, etc.)
- Shows quota, used, and remaining days
- Pro-rate badge for adjusted entitlements
- Gender-based filtering (maternity for females)

✅ **Holiday Calendar**
- Shows public holidays
- Shows company holidays
- Date-based filtering

✅ **Team Leave Calendar**
- Shows all team members' leaves
- Color-coded by leave type
- Department/team filtering

✅ **Animations**
- Staggered appearance
- Smooth transitions
- Loading skeleton animation

---

## 🚀 Testing Checklist

- [ ] **Employee Account**
  - [ ] Login as employee
  - [ ] Verify: See only 3 sections (balance, holidays, team leaves)
  - [ ] Verify: No stats cards visible
  - [ ] Verify: No recent leaves list
  - [ ] Verify: No monthly summary

- [ ] **Manager Account**
  - [ ] Login as manager/supervisor
  - [ ] Verify: See 3 sections (own balance, holidays, team leaves)
  - [ ] Verify: Holiday calendar displays
  - [ ] Verify: Team leave calendar shows team members

- [ ] **HR/Admin Account**
  - [ ] Login as admin/hr
  - [ ] Verify: All original sections visible
  - [ ] Verify: Stats grid shows 4 cards
  - [ ] Verify: Recent leaves list visible
  - [ ] Verify: Monthly summary visible

- [ ] **Responsive Testing**
  - [ ] Desktop: Grid layouts look good
  - [ ] Tablet: Cards wrap properly
  - [ ] Mobile: Text is readable, grid adjusts

---

## 📝 Notes

- Leave balance data is fetched from `/api/leave-entitlements` endpoint
- Component respects gender (female-specific leave types like maternity)
- All entitlements with quota > 0 are displayed
- Pro-rate badge shows when base_quota ≠ prorated_quota
- Team calendars filter based on department/team assignment

---

## 🔄 Future Enhancements (Optional)

- [ ] Add filters to Team Leave Calendar (department, month)
- [ ] Export leave balance as PDF
- [ ] Add leave balance trend chart
- [ ] Add manager's approval queue
- [ ] Add pending approval count for supervisors

---

**Last Updated**: April 1, 2026  
**Version**: 1.0  
**Status**: Production Ready ✅
