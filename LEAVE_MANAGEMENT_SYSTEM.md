# Leave Management System Documentation
## Pro-rate & Annual Increment Implementation

### Table of Contents
1. [Overview](#overview)
2. [Business Rules](#business-rules)
3. [Database Schema](#database-schema)
4. [Services & Logic](#services--logic)
5. [API Endpoints](#api-endpoints)
6. [Cron Jobs](#cron-jobs)
7. [Admin Functions](#admin-functions)
8. [Usage Examples](#usage-examples)

---

## 1. Overview

The Leave Management System is a comprehensive solution for calculating and managing employee leave entitlements with the following features:

- **Step-up Policy**: Automatic increase in leave quota based on years of service
- **Pro-rate Calculation**: Automated pro-rating for new hires and work anniversaries
- **Probation Period**: 119-day probation lock before employees can request leave
- **No Carry Over**: Leave balances reset on January 1st with no rollover to next year
- **Annual Automation**: Cron jobs handle yearly quota calculations and resets
- **Real-time Calculation**: Live preview of pro-rates during employee onboarding

---

## 2. Business Rules

### 2.1 Step-up Policy (Annual Leave)

Implements progressive increase in leave entitlements based on tenure:

| Year of Service | Annual Leave Quota |
|---|---|
| Year 1 (0-1 years) | 6 days |
| Year 2 (1-2 years) | 7 days |
| Year 3 (2-3 years) | 8 days |
| Year 4 (3-4 years) | 9 days |
| Year 5 (4-5 years) | 10 days |
| Year 6 (5-6 years) | 11 days |
| Year 7 (6-7 years) | 12 days |
| Year 8 (7-8 years) | 13 days |
| Year 9 (8-9 years) | 14 days |
| Year 10 (9-10 years) | 15 days |
| Year 11+ (10+ years) | 15 days (capped) |

**Other Leave Types** (Fixed):
- Sick Leave: 10 days/year
- Personal Leave: 5 days/year
- Maternity Leave: 90 days (per incident)
- Paternity Leave: 7 days (per incident)

### 2.2 Pro-rate Calculation

**Monthly Average Method**: When an employee's tenure changes within a calendar year, the system calculates a weighted average based on the number of months at each rate.

**Formula**:
```
Entitled Days = (Days_OldRate / 12 × Months_Before_Anniversary) + (Days_NewRate / 12 × Months_After_Anniversary)
```

**Example**:
- Employee starts: April 1, 2026
- Calendar year 2026:
  - April-December (9 months) at Year 1 rate (6 days): 6 / 12 × 9 = 4.5 days
  - Total for 2026: **4.5 days** (rounded down to nearest 0.5)

- Calendar year 2027 (reaches 1-year anniversary April 1):
  - January-March (3 months) at Year 1 rate (6 days): 6 / 12 × 3 = 1.5 days
  - April-December (9 months) at Year 2 rate (7 days): 7 / 12 × 9 = 5.25 days
  - Total for 2027: **6.75 → 6.5 days** (rounded down to 0.5)

### 2.3 Rounding

- All decimal values are rounded DOWN to the nearest **0.5 day**
- Example: 6.75 days → 6.5 days, 6.25 days → 6.0 days

### 2.4 Probation Period

- **Duration**: 119 days from start date
- **Effect**: Employee accumulates leave quota from day 1, but **cannot request leave** until after 119 days are completed
- **Probation End Date**: Automatically calculated as `start_date + 119 days`
- **Status Update**: System automatically updates employee status from `on_probation` to `active` after period ends

### 2.5 No Carry Over Policy

- All unused leave **must be used by December 31st**
- On January 1st each year:
  - Previous year's unused leave is **forfeited** (remaining_days set to 0)
  - New year's quotas are created based on updated tenure
  - `used_days` is reset to 0

---

## 3. Database Schema

### 3.1 leave_policies Table

Stores leave policy templates by employee type and tenure level:

```sql
CREATE TABLE leave_policies (
  id UUID PRIMARY KEY,
  policy_name VARCHAR(255),           -- e.g., "Permanent - Year 3"
  employee_type VARCHAR(50),          -- permanent, contract, parttime
  tenure_year_from INT,               -- Min years of service
  tenure_year_to INT,                 -- Max years of service (NULL = no limit)
  annual_leave_quota DECIMAL(5,2),    -- Annual leave days
  sick_leave_quota INT,               -- Sick leave days
  personal_leave_quota INT,           -- Personal leave days
  maternity_leave_quota INT,          -- Maternity leave days
  paternity_leave_quota INT,          -- Paternity leave days
  is_prorated_first_year BOOLEAN,     -- Apply pro-rate in first year
  description TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  created_by UUID,                    -- References employees(id)
  updated_by UUID                     -- References employees(id)
);
```

### 3.2 employee_leave_balances Table

Tracks yearly leave balance per employee per leave type:

```sql
CREATE TABLE employee_leave_balances (
  id UUID PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  leave_type VARCHAR(50),             -- 'annual', 'sick', 'personal', 'maternity', 'paternity'
  balance_days INTEGER,               -- Legacy field
  year INTEGER,                       -- Calendar year
  entitled_days DECIMAL(5,2),         -- Total entitled for the year
  used_days DECIMAL(5,2),             -- Days already used
  remaining_days DECIMAL(5,2),        -- Days available = entitled - used
  carried_over_days DECIMAL(5,2),     -- Days from previous year (if allowed)
  pro_rated_percent DECIMAL(5,2),     -- Pro-rate percentage (100 = full year)
  is_utilized BOOLEAN,                -- Mark as used up
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(employee_id, leave_type, year)
);
```

### 3.3 leave_balance_history Table

Auditing table tracking all changes to leave balances:

```sql
CREATE TABLE leave_balance_history (
  id UUID PRIMARY KEY,
  employee_id UUID REFERENCES employees,
  year INTEGER,
  leave_type VARCHAR(50),
  previous_entitled_days DECIMAL(5,2),
  previous_used_days DECIMAL(5,2),
  previous_remaining_days DECIMAL(5,2),
  new_entitled_days DECIMAL(5,2),
  new_used_days DECIMAL(5,2),
  new_remaining_days DECIMAL(5,2),
  change_reason VARCHAR(255),         -- 'pro_rate', 'manual_adjustment', 'reset', etc.
  changed_by UUID,                    -- HR/Admin who made change
  changed_at TIMESTAMP,
  created_at TIMESTAMP
);
```

### 3.4 leave_calculation_log Table

Tracks all leave calculation operations performed:

```sql
CREATE TABLE leave_calculation_log (
  id UUID PRIMARY KEY,
  employee_id UUID REFERENCES employees,  -- NULL for batch operations
  calculation_type VARCHAR(50),           -- 'new_hire_prorate', 'anniversary_update', 'yearly_reset'
  calculation_date DATE,
  years_of_service INT,
  tenure_year_for_policy INT,             -- Which tier policy was selected
  policy_id UUID REFERENCES leave_policies,
  base_quota DECIMAL(5,2),                -- Before pro-rate
  pro_rate_percent DECIMAL(5,2),          -- 0-100
  final_entitled_days DECIMAL(5,2),       -- After pro-rate and rounding
  calculation_details JSONB,              -- Full calc breakdown
  calculated_by VARCHAR(50),              -- 'system', 'system - cron', 'hr_user'
  calculated_at TIMESTAMP,
  created_at TIMESTAMP
);
```

### 3.5 leave_entitlement_config Table

Business rule configuration (modifiable by admin):

```sql
CREATE TABLE leave_entitlement_config (
  id UUID PRIMARY KEY,
  config_key VARCHAR(100) UNIQUE,
  config_value VARCHAR(255),
  data_type VARCHAR(50),              -- 'string', 'integer', 'decimal', 'boolean'
  description TEXT,
  last_updated_by UUID,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Default Configurations**:
- `probation_days` = 119
- `yearly_reset_date` = 2026-01-01
- `rounding_method` = 0.5 (round to 0.5 day)
- `max_carry_over_days` = 0 (no carry over)
- `pro_rate_calculation_enabled` = true
- `step_up_policy_enabled` = true

### 3.6 Enhanced employees Table

Added fields for leave calculation:

```sql
ALTER TABLE employees ADD COLUMN IF NOT EXISTS (
  probation_end_date DATE,            -- Auto-calculated: start_date + 119 days
  pro_rate_applied_for_year INT,      -- Which year was pro-rate applied
  last_leave_calculation_date DATE    -- Last time calculations were run
);
```

---

## 4. Services & Logic

### 4.1 LeaveCalculationService

**File**: `src/services/LeaveCalculationService.js`

Main service handling all leave calculation logic. Key methods:

#### `calculateYearsOfService(hireDate, referenceDate)`
```javascript
// Calculate years of service from hire date
const years = LeaveCalculationService.calculateYearsOfService('2020-04-15');
// Returns: 6 (if current date is 2026-04-15)
```

#### `isEmployeeInProbation(employeeId, referenceDate)`
```javascript
// Check if employee is still in probation (< 119 days)
const inProbation = await LeaveCalculationService.isEmployeeInProbation(employeeId);
// Returns: boolean
```

#### `getApplicableLeavePolicy(employeeType, yearsOfService)`
```javascript
// Get the correct policy tier based on tenure
const policy = await LeaveCalculationService.getApplicableLeavePolicy('permanent', 3);
// Returns: { annual_leave_quota: 9, sick_leave_quota: 10, ... }
```

#### `calculateProratedLeave(params)`
```javascript
// Calculate pro-rated leave for hire year or anniversary year
const result = await LeaveCalculationService.calculateProratedLeave({
  startDate: '2026-04-01',
  employeeType: 'permanent',
  calendarYear: 2026
});
// Returns: { entitledDays: 4.5, proRatePercent: 75, calculationDetails: {...} }
```

#### `calculateEmployeeLeaveEntitlements(employeeId, year)`
```javascript
// Calculate full entitlements for employee for a specific year
const entitlements = await LeaveCalculationService.calculateEmployeeLeaveEntitlements(empId, 2026);
// Returns: { entitledDays: 8, proRatePercent: 100, policy: {...}, ... }
```

#### `createLeaveBalancesForNewEmployee(employeeId, startYear, yearsToCreate = 2)`
```javascript
// Create balance records for new hire (typically 2 years into future)
const balances = await LeaveCalculationService.createLeaveBalancesForNewEmployee(empId, 2026, 2);
// Creates entries for 2026 and 2027 for: annual, sick, personal, maternity, paternity
```

#### `updateAllEmployeeLeaveBalancesForYear(targetYear)`
```javascript
// Update all employees' quotas for a given year (Cron Job)
const result = await LeaveCalculationService.updateAllEmployeeLeaveBalancesForYear(2027);
// Returns: { totalEmployees: 150, totalCreated: 145, totalFailed: 5 }
```

#### `deductLeaveBalance(employeeId, leaveType, year, deductDays)`
```javascript
// Deduct days from employee's balance when leave is approved
const updated = await LeaveCalculationService.deductLeaveBalance(empId, 'annual', 2026, 1.5);
```

#### `getEmployeeLeaveSummary(employeeId, year)`
```javascript
// Get complete leave summary (balance for all types + probation status)
const summary = await LeaveCalculationService.getEmployeeLeaveSummary(empId, 2026);
// Returns: { employee: {...}, balances: [...], totalEntitledDays: X, ... }
```

#### `getProratePreviewForNewHire(startDate, employeeType, year)`
```javascript
// Real-time preview during HR form while entering start date
const preview = await LeaveCalculationService.getProratePreviewForNewHire('2026-04-01', 'permanent');
// Returns: { 
//   entitledDays: 4.5, 
//   probationEndDate: '2026-08-28',
//   calculationDetails: {...}
// }
```

### 4.2 PostgreSQL Functions

Custom database functions for calculations:

#### `calculate_years_of_service(start_date, reference_date)`
```sql
SELECT calculate_years_of_service('2020-04-15'::DATE);
-- Returns: 6
```

#### `get_applicable_leave_policy(employee_type, years_of_service)`
```sql
SELECT * FROM get_applicable_leave_policy('permanent', 3);
-- Returns: Policy record with 9 days annual leave
```

#### `calculate_prorated_leave_days(start_date, employee_type, calendar_year)`
```sql
SELECT * FROM calculate_prorated_leave_days('2026-04-01'::DATE, 'permanent', 2026);
-- Returns: (entitled_days: 4.5, pro_rate_percent: 75, calculation_details: JSON)
```

#### `is_employee_in_probation(employee_id, reference_date)`
```sql
SELECT is_employee_in_probation('550e8400-e29b-41d4-a716-446655440000'::UUID);
-- Returns: true/false
```

---

## 5. API Endpoints

### 5.1 Leave Calculation Endpoints

**Base Path**: `/api/leave-calculation`

#### GET `/prorate-preview`
Get pro-rate preview for new hire during form entry

**Query Parameters**:
- `startDate` (required): YYYY-MM-DD format
- `employeeType` (required): permanent, contract, parttime
- `year` (optional): Calendar year (default: current year)

**Response**:
```json
{
  "success": true,
  "data": {
    "startDate": "2026-04-01",
    "employeeType": "permanent",
    "year": 2026,
    "baseQuotaDays": 6,
    "proratePercent": 75,
    "entitledDays": 4.5,
    "probationEndDate": "2026-08-28",
    "canRequestLeaveAfter": "2026-08-28",
    "calculationDetails": { ... }
  }
}
```

#### GET `/employee/:employeeId/summary`
Get leave summary for an employee

**Response**:
```json
{
  "success": true,
  "data": {
    "employee": {
      "id": "550e...",
      "name": "John Doe",
      "employeeType": "permanent",
      "yearsOfService": 3,
      "inProbation": false
    },
    "year": 2026,
    "balances": [
      {
        "leave_type": "annual",
        "entitled_days": 8,
        "used_days": 2.5,
        "remaining_days": 5.5,
        "pro_rated_percent": 100
      },
      ...
    ],
    "totalEntitledDays": 8,
    "totalUsedDays": 2.5,
    "totalRemainingDays": 5.5
  }
}
```

#### GET `/employee/:employeeId/history`
Get leave balance change history

**Query Parameters**:
- `year` (required): Calendar year

**Response**:
```json
{
  "success": true,
  "year": 2026,
  "data": [
    {
      "id": "550e...",
      "change_reason": "pro_rate",
      "previous_entitled_days": 8,
      "new_entitled_days": 8,
      "changed_by": "550e...",
      "changed_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

#### POST `/create-balances`
Create leave balance records for new employee

**Request Body**:
```json
{
  "employeeId": "550e...",
  "startYear": 2026,
  "yearsToCreate": 2
}
```

**Response**: Array of created balance records

#### GET `/years-of-service/:employeeId`
Get employee's years of service

**Response**:
```json
{
  "success": true,
  "data": {
    "yearsOfService": 3,
    "inProbation": false
  }
}
```

#### GET `/policy/:employeeType/:yearsOfService`
Get applicable policy for employee type and tenure

**Response**:
```json
{
  "success": true,
  "data": {
    "policy_name": "Permanent - Year 3",
    "annual_leave_quota": 8,
    "sick_leave_quota": 10,
    ...
  }
}
```

#### POST `/check-eligibility/:employeeId`
Check if employee can request leave (not in probation)

**Response**:
```json
{
  "success": true,
  "data": {
    "isEligible": true,
    "inProbation": false,
    "message": "Employee is eligible to request leave"
  }
}
```

### 5.2 Admin Cron Management Endpoints

**Base Path**: `/api/admin/cron` (Admin/CEO only)

#### POST `/yearly-leave-update`
Manually trigger yearly quota update

**Request Body**:
```json
{
  "targetYear": 2027
}
```

#### POST `/probation-check`
Manually trigger probation status check

#### POST `/reset-employee-year`
Reset specific employee's leave balance (end of year)

**Request Body**:
```json
{
  "employeeId": "550e...",
  "year": 2026
}
```

#### GET `/leave-stats/:year`
Get leave utilization statistics for year

**Response**:
```json
{
  "success": true,
  "year": 2026,
  "data": [
    {
      "leave_type": "annual",
      "total_employees": 150,
      "avg_entitled_days": 8.5,
      "avg_used_days": 6.2,
      "avg_remaining_days": 2.3,
      "utilization_percent": 73
    }
  ]
}
```

#### GET `/employees-in-probation`
Get list of employees still in probation period

#### GET `/upcoming-anniversaries`
Get employees with work anniversaries in next 30 days

---

## 6. Cron Jobs

### 6.1 Automatic Execution Schedule

**File**: `src/jobs/leaveCronJobs.js`

#### Task 1: Yearly Leave Quota Update
- **Schedule**: 0 0 1 1 * (00:00 on January 1st)
- **Action**: 
  - Calculate new year quotas for ALL employees
  - Apply pro-rate for employees with anniversaries in January
  - Include calculation logs
- **Logs**: `leave_calculation_log` table

#### Task 2: Probation Status Check
- **Schedule**: 0 1 * * * (01:00 every day)
- **Action**:
  - Find employees approaching probation end (5-119 days)
  - Update status from `on_probation` → `active` when complete
  - Optional: Send notifications to HR
- **Notification**: Could trigger alerts for approaching probation end

#### Task 3: Leave Balance Reminders
- **Schedule**: 0 9 * * 5 (09:00 every Friday)
- **Action**:
  - Find employees with ≤2 days remaining leave
  - Generate list for HR review
  - Optional: Send email reminders

#### Task 4: Calculation Log Archival
- **Schedule**: 0 3 1 * * (03:00 on 1st of month)
- **Action**:
  - Archive logs older than 12 months (except new_hire_prorate)
  - Reduces database size for better performance

### 6.2 Disabling/Enabling Cron Jobs

Cron jobs are **automatically disabled in development mode** and only run in production.

**To trigger manually in development**:
```bash
curl -X POST http://localhost:3322/api/admin/cron/yearly-leave-update \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetYear": 2027}'
```

---

## 7. Admin Functions

### 7.1 Employee Creation Flow

When HR adds a new employee:

```
1. HR enters: First Name, Last Name, Start Date, Employee Type
2. System calls: GET /api/leave-calculation/prorate-preview
3. Response shows:
   - Entitled Days: 4.5 (pro-rated)
   - Probation End Date: 2026-08-28
   - "Cannot request leave until: 2026-08-28"
4. HR confirms and creates employee
5. System calls: POST /api/leave-calculation/create-balances
6. Result: Balance records created for 2026 and 2027 for all leave types
```

### 7.2 Policy Management

HR can modify policies:

```sql
UPDATE leave_policies
SET annual_leave_quota = 7
WHERE policy_name = 'Permanent - Year 2' AND is_active = true;
-- Future calculations will use new value
```

### 7.3 Manual Leave Adjustments

Admin can manually adjust balances:

```
1. Call: POST /api/admin/cron/reset-employee-year
2. Provide: employeeId, year
3. Effect: remaining_days → 0, used_days → entitled_days
4. Record: Entry created in leave_balance_history with reason
```

---

## 8. Usage Examples

### 8.1 Calculate Pro-rate During Hire

**Scenario**: HR is adding new employee starting April 1, 2026

```bash
curl -X GET "http://localhost:3322/api/leave-calculation/prorate-preview?startDate=2026-04-01&employeeType=permanent" \
  -H "Authorization: Bearer $TOKEN"
```

**Response**: Shows employee will get 4.5 days in 2026, probation ends August 28

### 8.2 Get Leave Summary for Employee

**Scenario**: Employee wants to see their remaining leave

```bash
curl -X GET "http://localhost:3322/api/leave-calculation/employee/550e8400-.../summary?year=2026" \
  -H "Authorization: Bearer $TOKEN"
```

**Response**: Shows all leave types with entitled/used/remaining days

### 8.3 Check Eligibility to Request Leave

**Scenario**: Before letting employee request leave

```bash
curl -X POST "http://localhost:3322/api/leave-calculation/check-eligibility/550e8400-..." \
  -H "Authorization: Bearer $TOKEN"
```

**Response**: 
- If ≥119 days: `{ isEligible: true }`
- If <119 days: `{ isEligible: false, message: "Still in probation" }`

### 8.4 Trigger Yearly Update (Manual)

**Scenario**: Testing on development, or retrying failed batch:

```bash
curl -X POST "http://localhost:3322/api/admin/cron/yearly-leave-update" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetYear": 2027}'
```

**Response**: 
```json
{
  "success": true,
  "message": "Completed yearly leave balance update for 2027",
  "stats": {
    "totalEmployees": 150,
    "totalCreated": 147,
    "totalFailed": 3
  }
}
```

### 8.5 View Leave Statistics

**Scenario**: HR wants to see leave utilization

```bash
curl -X GET "http://localhost:3322/api/admin/cron/leave-stats/2026" \
  -H "Authorization: Bearer $TOKEN"
```

**Response**: Shows utilization percentage and averages by leave type

---

## 9. Integration Checklist

### Database Setup
- [ ] Run: `psql -f backend/sql/001_enhanced_leave_management_system.sql`
- [ ] Verify: `leave_policies` table has 12 records
- [ ] Verify: `leave_calculation_log` table created
- [ ] Verify: PostgreSQL functions created (test with `SELECT * FROM get_applicable_leave_policy(...)`)

### Backend Integration
- [ ] Import LeaveCalculationService in employee creation
- [ ] Import leaveCalculationRoutes in index.ts
- [ ] Import leaveCronJobs in index.ts
- [ ] Test endpoints with curl or Postman
- [ ] Verify cron jobs initialize on startup (check console logs)

### Frontend Integration
- [ ] Add pro-rate preview display in employee creation form
- [ ] Show "Probation ends: YYYY-MM-DD" message
- [ ] Add leave summary component to employee dashboard
- [ ] Add mechanism to fetch and display balance per leave type

### Testing
- [ ] Test pro-rate calculation with different start dates
- [ ] Test step-up policy (employees with 1, 5, 10, 11+ years)
- [ ] Test probation period (119 days)
- [ ] Test no carry over (balance resets Jan 1)
- [ ] Test cron job manually in development

---

## 10. Troubleshooting

### Issue: Cron jobs not running

**Solution**: 
- Ensure `NODE_ENV=production` environment variable is set
- In development, use manual API calls to `/api/admin/cron/*`
- Check server logs for: "Initializing leave management cron jobs..."

### Issue: Pro-rate calculations incorrect

**Solution**:
- Check `leave_policies` table has all 12 records for permanent staff
- Verify calculation using: `SELECT * FROM calculate_prorated_leave_days('2026-04-01'::DATE, 'permanent', 2026);`
- Ensure rounding is applied (down to 0.5)

### Issue: Employee can request leave during probation

**Solution**:
- Add probation check in leave request endpoint: `isEmployeeInProbation(employeeId)`
- Return 400 error if employee is in probation
- Test with: `POST /api/leave-calculation/check-eligibility/:employeeId`

### Issue: Missing balances after Jan 1

**Solution**:
- Check if cron job ran: Look for log entry at midnight Jan 1
- Manually trigger: `POST /api/admin/cron/yearly-leave-update`
- Verify all employees created with `leave_policies` defined
- Check `leave_calculation_log` for errors

---

## Appendix: Database Migration Script

**File**: `backend/sql/001_enhanced_leave_management_system.sql`

Run on first deployment:

```bash
cd backend
psql -U postgres -d hrdb -f sql/001_enhanced_leave_management_system.sql
```

Verify migration:
```bash
psql -U postgres -d hrdb -c "
  SELECT COUNT(*) as policies FROM leave_policies;
  SELECT COUNT(*) as configs FROM leave_entitlement_config;
  \df calculate_years_of_service
"
```

Expected output:
```
 policies
----------
       12
(1 row)

 configs
----------
        6
(1 row)

Found function calculate_years_of_service
```

---

**Version**: 1.0  
**Last Updated**: April 2026  
**System**: HR Management System - Leave Management  
**Status**: Production Ready
