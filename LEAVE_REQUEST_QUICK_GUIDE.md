# 🎯 Quick Reference: Leave Request Dashboard Improvements

## 🚀 What's New - Visual Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    LEAVE REQUEST DASHBOARD                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⚠️  [YEAR-END BANNER - Nov/Dec Only]                           │
│      สิทธิ์ลาพักร้อนจะรีเซ็ตเป็น 0 ในวันที่ 1 มกราคม           │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                    LEAVE BALANCE CARDS                          │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ ลาพักร้อน       │  │ ลาป่วย            │  │ ลากิจ       │  │
│  │ [Pro-rate] ✓     │  │                   │  │              │  │
│  │                  │  │                   │  │              │  │
│  │ 12.5 / 15 วัน    │  │ 28 / 30 วัน       │  │ 2.5 / 3 วัน  │  │
│  │ ════════════════ │  │ ════════════════  │  │ ════════════ │  │
│  │ ใช้ไปแล้ว 2.5    │  │ ใช้ไปแล้ว 2 วัน   │  │ ใช้ไปแล้ว 0.5│  │
│  │ รอการอนุมัติ: 3  │  │ [No pending]      │  │ [No pending] │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│   🟢 Normal Usage      🟠 Moderate Usage     🔴 High Usage       │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                    SUBMIT LEAVE REQUEST                         │
│                                                                  │
│  [✓ Request Leave Button]  [Dialog with form]                  │
│                            - Leave Type Selector                │
│  Probation Employee:       - Vacation: ✓ [Eligible 2026-05-12] │
│  ✓ Sick              - Date Range                               │
│  ✓ Personal          - Reason                                   │
│  ✗ Vacation (until 119 days)                                    │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                    LEAVE HISTORY TABLE                          │
│                                                                  │
│  ┌──────┬─────────────────┬─────┬────────┬──────────────┬────┐ │
│  │ Type │ Dates           │Days │ Status │ Approver     │ ... │ │
│  ├──────┼─────────────────┼─────┼────────┼──────────────┼────┤ │
│  │ ลาพัก│ 24 Mar-26 Mar   │ 2   │ ✓ Appr │ John Smith   │ -  │ │
│  │ ลาป่วย│15 Mar-15 Mar   │ 1   │ ⏳ Pend │ รอการอนุมัติ │ ✕  │ │
│  │ ลากิจ│10 Mar-11 Mar   │ 2   │ ✓ Appr │ Jane Doe     │ -  │ │
│  └──────┴─────────────────┴─────┴────────┴──────────────┴────┘ │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│              CALENDAR SECTION (Desktop/Tablet)                 │
│                                                                  │
│  [Holiday Calendar]              [Team Calendar]               │
│  ┌──────────────┐                ┌──────────────┐              │
│  │  SUN MON TUE │ [Legend:       │ Department:  │              │
│  │      1   2   │  🔴 Holiday    │ Select ▼ All │              │
│  │   3   4   5  │  ⬜ Weekend]   │              │              │
│  │   6   7   8  │                │ [Calendar]   │              │
│  └──────────────┘ [Upcoming]   │              │              │
│  • Apr 13 (Thai N)              │ • John: Sick │              │
│  • May 1 (Labour)               │ • Jane: Vaca │              │
│                                 └──────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## 🎨 Color Coding Guide

### Progress Bar Status
- 🟢 **Green (0-49%)** - Normal usage, plenty remaining
- 🟠 **Amber (50-74%)** - Moderate usage, starting to use up quota
- 🔴 **Red (75%+)** - High usage, alert to use remaining days
- ⚫ **Gray** - No quota available for this leave type

### Calendar Highlighting
- 🔴 **Red/Destructive** - Company holidays (วันหยุดบริษัท)
- ⬜ **Gray/Secondary** - Weekends (วันหยุดสุดสัปดาห์)
- 🔵 **Primary** - Team leave dates

### Leave Status
- ✅ **Approved** - Shows approver name
- ⏳ **Pending** - Shows "รอการอนุมัติ" + Cancel button
- ❌ **Rejected/Cancelled** - Read-only, no actions

## 🛠️ Key Features by Use Case

### I'm a Probation Employee (< 119 days)
```
What I see:
✓ All leave types except vacation
✓ Message: "ลาพักร้อนพร้อมใช้ได้เมื่อครบ 119 วัน (วันที่ 15/06/2026)"
✓ Other leaves work normally
```

### I'm a Permanent Employee
```
What I see:
✓ All leave types including vacation
✓ Pro-rated balance if just hired mid-year
✓ Pending leave count updates real-time
```

### It's November or December
```
What I see:
⚠️ Banner at top: Year-end notice about Jan 1 reset
📋 Reminder to use vacation days before it resets
```

### I'm Looking at Team Schedule
```
What I see:
📅 Holiday Calendar: Red dots = Company holidays
📅 Team Calendar: Only my department's leaves (unless HR)
💼 See who's on leave to coordinate work
```

## ⚙️ Technical Details

### State Management
```typescript
// Pending leaves tracking
const [pendingLeavesByType, setPendingLeavesByType] = useState<Record<string, number>>({});

// Calculated on every fetch
data.forEach(leave => {
  if (leave.status === 'pending') {
    pendingCounts[leave.leave_type] += leave.total_days;
  }
});
```

### Responsive Breakpoints
| Screen Size | Layout |
|------------|--------|
| Mobile | Tabs for balance/team, card layout for history |
| Tablet | 2-col grid, full table, side calendars |
| Desktop | 3-col main + sidebar, all features visible |

### API Data Requirements
- `/api/leave-requests` includes `approver_first_name`, `approver_last_name`
- `/api/holidays` returns `id`, `date`, `name`, `is_recurring`
- `/api/departments` returns `id`, `name`

## 📱 Mobile Experience

### Screens < 640px
```
┌─────────────────────────────┐
│  MOBILE VIEW                │
├─────────────────────────────┤
│ [Balance] [Team] [Calendar] │  ← Tabs instead of layout
├─────────────────────────────┤
│                             │
│ Balance Cards (2 per row)   │
│                             │
│ Leave History (Card Layout) │
│ - Type: Vacation            │
│ - Dates: 24-26 Mar          │
│ - Status: Approved          │
│ - Approver: John Smith      │
│ [Cancel]                    │
│                             │
│ [Holiday Calendar] (Tab)    │
│ [Team Calendar] (Tab)       │
│                             │
└─────────────────────────────┘
```

## 🎯 Testing Scenarios

### Test Probation Control
```gherkin
Scenario: Probation employee cannot select vacation
  Given: Employee with status "probation" AND < 119 days tenure
  When: Opens "Request Leave" dialog
  Then: Vacation option is disabled
  And: Shows "พร้อมใช้ได้เมื่อครบ 119 วัน (15 Jun 2026)"
```

### Test Pending Count
```gherkin
Scenario: Pending leaves show under progress bar
  Given: Employee has submitted pending leave request for 3 days
  When: Loads Leave Request page
  Then: Shows "รอการอนุมัติ: 3 วัน" below progress bar
  And: Count updates when request approved/rejected
```

### Test Progress Colors
```gherkin
Scenario: Progress bar color changes based on usage
  Given: Leave quota = 15 days
  When: Used = 5 days (33%) → Progress bar is 🟢 Green
  And: Used = 10 days (67%) → Progress bar is 🟠 Amber
  And: Used = 13 days (87%) → Progress bar is 🔴 Red
```

## 📊 Performance Metrics

- **Build Time:** 3.76 seconds
- **CSS Bundle:** 79.37 KB (13.48 KB gzip)
- **JS Bundle:** 1,480.96 KB (420.70 KB gzip)
- **Modules:** 3,862 transformed
- **Load Time:** ~400-600ms typical (depends on API)

## 🔗 File References

### Main components
- [LeaveRequest.tsx](src/pages/LeaveRequest.tsx) - Main page
- [HolidayCalendar.tsx](src/components/leave/HolidayCalendar.tsx) - Holiday display
- [TeamLeaveCalendar.tsx](src/components/leave/TeamLeaveCalendar.tsx) - Team leaves
- [NotificationSettings.tsx](src/components/leave/NotificationSettings.tsx) - Email config

### Backend
- [server.js API endpoints](backend/server.js#L2030-L2680) - Leave management

---

**Status:** ✅ Ready for Production
**Browser Support:** Chrome, Firefox, Safari, Edge (modern versions)
**Mobile Support:** iOS Safari, Chrome Android
**Date Implemented:** March 31, 2026 🎉
