# 🏛️ HR Management System - Complete System Audit
**Date:** April 1, 2026  
**Version:** 1.0

---

## 📋 Table of Contents
1. [Frontend Routes & Pages](#frontend-routes--pages)
2. [Frontend Components](#frontend-components)
3. [Backend API Endpoints](#backend-api-endpoints)
4. [Database Tables & Schema](#database-tables--schema)
5. [User Roles & Permissions](#user-roles--permissions)
6. [Key Features Summary](#key-features-summary)

---

## 🎨 Frontend Routes & Pages

### Location: `/frontend/src/pages/`

All pages extend `DashboardLayout` which provides sidebar navigation and shared header.

| Page | Route | Purpose | Key Functions | Access Control |
|------|-------|---------|---|---|
| **Auth.tsx** | `/auth` | User authentication | `signIn()`, `signInWithOAuth()` (Office365), forgot password, reset password | Public |
| **AuthCallback.tsx** | `/auth/callback` | OAuth callback handler | Handle Office365 OAuth response | Public |
| **Dashboard.tsx** | `/dashboard` | Main dashboard | Display stats (employees, pending leaves), leave summarymonthly charts | HR/Admin/Supervisor/Employee |
| **Employees.tsx** | `/employees` | Employee management | CRUD employees, search, filter, upload avatar | HR/Admin only |
| **Departments.tsx** | `/departments` | Department management | CRUD departments, assign employees | HR/Admin only |
| **Positions.tsx** | `/positions` | Position management | CRUD positions, manage job titles | HR/Admin only |
| **LeaveRequest.tsx** | `/leave-request` | Create & view leave requests | Submit leave, view balance, check calendar, half-day support | Employees |
| **LeaveApproval.tsx** | `/leave-approval` | Leave approval workflow | Approve/reject leaves, multi-level workflow | Supervisor/HR/CEO |
| **LeaveBalanceDashboard.tsx** | `/leave-balance` | Leave balance tracking | View entitlements, annual quotas, remaining days | HR/Admin only |
| **LeaveSettings.tsx** | `/leave-settings` | Leave policy management | Create/edit leave policies, approve/rejection workflows | HR/Admin only |
| **Holidays.tsx** | `/holidays` | Holiday management | CRUD holidays, view holiday calendar | HR/Admin only |
| **Profile.tsx** | `/profile` | Employee profile | View/edit personal info, change password, upload avatar | Self & HR/Admin |
| **ResetPassword.tsx** | `/reset-password` | Password reset | Reset password using token from email | Public |
| **Settings.tsx** | `/settings` | System settings | Notification settings by department & leave type | HR/Admin only |
| **Reports.tsx** | `/reports` | Leave statistics & reporting | Monthly leave charts, department stats, employee ranking | HR/Admin only |
| **Index.tsx** | `/` | Home/redirect | Redirects to `/dashboard` or `/auth` | All |
| **NotFound.tsx** | `*` | 404 page | Handle missing routes | All |

---

## 🧩 Frontend Components

### Location: `/frontend/src/components/`

#### Top-level Components
- **NavLink.tsx** - Navigation link wrapper with active state
- **ThemeToggle.tsx** - Dark/Light theme switcher

#### Layout Components (`layout/`)
- **DashboardLayout.tsx** - Main dashboard wrapper with sidebar, header, notifications
- **Sidebar.tsx** - Navigation menu with role-based menu items

#### Leave Management Components (`leave/`)
- **LeaveBalanceDisplay.tsx** - Shows vacation/sick/personal/maternity leave quotas
- **LeaveRulesInfo.tsx** - Display leave policy rules and requirements
- **LeaveTimeSelector.tsx** - Half-day time selection (AM/PM) picker
- **ApprovalWorkflowSettings.tsx** - Configure approval chain (supervisor→HR→CEO)
- **HolidayCalendar.tsx** - Interactive holiday calendar view
- **TeamLeaveCalendar.tsx** - Team calendar showing all employee leaves
- **NotificationSettings.tsx** - Email notification configuration per department

#### Notification Components (`notifications/`)
- **HolidayNotification.tsx** - Holiday alerts and notifications
- **NotificationBell.tsx** - Bell icon with notification badge

#### UI Components (`ui/`)
- Standard components (Button, Input, Dialog, Select, etc.) - Shadcn UI library

---

## 🔌 Backend API Endpoints

### Location: `/backend/server.js`

#### **Auth Endpoints** (Authentication & Authorization)

| Method | Endpoint | Auth | Purpose | Role Restrictions |
|--------|----------|------|---------|---|
| POST | `/api/auth/login` | No | Email & password login | None |
| POST | `/api/auth/office365-login` | No | Office365 email-only login | Employees table required |
| POST | `/api/auth/validate-office365-email` | No | OAuth email validation & auto-user creation | Public |
| POST | `/api/auth/forgot-password` | No | Send password reset email | None |
| POST | `/api/auth/reset-password` | No | Reset password with token | None |
| POST | `/api/auth/change-password` | ✅ | Authenticated user changes own password | All authenticated users |
| GET | `/api/auth/me` | ✅ | Get current user profile & roles | All authenticated |
| POST | `/api/auth/register` | No | Registration (disabled - Admin only) | Disabled |
| POST | `/api/auth/upload-avatar` | ✅ | Upload user avatar image | All authenticated |
| POST | `/api/auth/delete-avatar` | ✅ | Delete user avatar | All authenticated |
| GET | `/api/auth/azure-oauth-start` | No | Start Azure OAuth flow | None |
| POST | `/api/auth/azure-oauth-callback` | No | Handle Azure OAuth callback | None |

---

#### **Employee Management Endpoints**

| Method | Endpoint | Auth | Purpose | Role Restrictions |
|--------|----------|------|---------|---|
| GET | `/api/employees` | No | Get all employees (public list) | None |
| GET | `/api/employees/:id` | No | Get single employee details | None |
| GET | `/api/employees/user/:user_id` | No | Get employee by user_id | None |
| POST | `/api/employees` | ✅ | Create new employee | Admin/HR only |
| PUT | `/api/employees/:id` | ✅ | Update employee info | Admin/HR only |
| DELETE | `/api/employees/:id` | No | Delete employee (soft delete) | Admin/HR only |
| POST | `/api/employees/:id/reset-password` | ✅ | Admin reset employee password | Admin/HR only |
| PUT | `/api/employees/:id/role` | ✅ | Change employee role | Admin/HR only |
| POST | `/api/employees/send-welcome-email` | No | Send welcome email to new employee | Backend automation |

---

#### **Department Management Endpoints**

| Method | Endpoint | Auth | Purpose | Role Restrictions |
|--------|----------|------|---------|---|
| GET | `/api/departments` | No | Get all departments | None |
| POST | `/api/departments` | ✅ | Create department | Admin/HR only |
| PUT | `/api/departments/:id` | ✅ | Update department | Admin/HR only |
| DELETE | `/api/departments/:id` | ✅ | Delete department | Admin/HR only |

---

#### **Position Management Endpoints**

| Method | Endpoint | Auth | Purpose | Role Restrictions |
|--------|----------|------|---------|---|
| GET | `/api/positions` | No | Get all positions | None |
| POST | `/api/positions` | ✅ | Create position | Admin/HR only |
| PUT | `/api/positions/:id` | ✅ | Update position | Admin/HR only |
| DELETE | `/api/positions/:id` | ✅ | Delete position | Admin/HR only |

---

#### **Leave Request Endpoints**

| Method | Endpoint | Auth | Purpose | Role Restrictions |
|--------|----------|------|---------|---|
| GET | `/api/leave-requests` | ✅ | Get leave requests (filtered by role) | All authenticated |
| POST | `/api/leave-requests` | ✅ | Submit new leave request | All authenticated |
| PUT | `/api/leave-requests/:id` | ✅ | Update/edit leave request | Employee or HR/Admin |
| PUT | `/api/leave-requests/:id/approve` | ✅ | Approve leave (multi-level workflow) | Supervisor/HR/CEO |
| PUT | `/api/leave-requests/:id/reject` | ✅ | Reject leave request | Supervisor/HR/CEO |

---

#### **Leave Type & Policy Endpoints**

| Method | Endpoint | Auth | Purpose | Role Restrictions |
|--------|----------|------|---------|---|
| GET | `/api/leave-types` | No | Get all leave types (vacation, sick, personal, maternity, paternity) | None |
| GET | `/api/leave-policies` | ✅ | Get active leave policies | Admin/HR/Supervisor |
| POST | `/api/leave-policies` | ✅ | Create leave policy | Admin/HR only |
| PUT | `/api/leave-policies/:id` | ✅ | Update leave policy | Admin/HR only |
| DELETE | `/api/leave-policies/:id` | ✅ | Deactivate leave policy | Admin/HR only |
| POST | `/api/leave/calculate` | ✅ | Calculate prorated leave days | Admin/HR/Supervisor |
| POST | `/api/leave-balances/preview` | ✅ | Preview leave balance calculation | Admin/HR/Supervisor |
| POST | `/api/leave-balances/run-annual-update` | ✅ | Manually run annual leave reset | Admin/HR only |

---

#### **Leave Entitlements & Allowances Endpoints**

| Method | Endpoint | Auth | Purpose | Role Restrictions |
|--------|----------|------|---------|---|
| GET | `/api/leave-entitlements` | ✅ | Get employee's leave entitlements | Employees view own; HR/Admin view all |
| GET | `/api/admin/leave-entitlements` | ✅ | Admin view all entitlements with audit | Admin/HR only |

---

#### **Holiday Management Endpoints**

| Method | Endpoint | Auth | Purpose | Role Restrictions |
|--------|----------|------|---------|---|
| GET | `/api/holidays` | No | Get all holidays | None |
| POST | `/api/holidays` | ✅ | Create holiday | Admin/HR only |
| PUT | `/api/holidays/:id` | ✅ | Update holiday | Admin/HR only |
| DELETE | `/api/holidays/:id` | ✅ | Delete holiday | Admin/HR only |

---

#### **Approval Workflow Configuration Endpoints**

| Method | Endpoint | Auth | Purpose | Role Restrictions |
|--------|----------|------|---------|---|
| GET | `/api/approval-workflows` | ✅ | Get approval workflows | Admin/HR/Supervisor |
| POST | `/api/approval-workflows` | ✅ | Create approval workflow | Admin/HR only |
| PUT | `/api/approval-workflows/:id` | ✅ | Update workflow | Admin/HR only |
| DELETE | `/api/approval-workflows/:id` | ✅ | Delete workflow | Admin/HR only |

---

#### **Notification & Email Settings Endpoints**

| Method | Endpoint | Auth | Purpose | Role Restrictions |
|--------|----------|------|---------|---|
| GET | `/api/notification-settings` | ✅ | Get email notification settings | Admin/HR only |
| POST | `/api/notification-settings` | ✅ | Create notification settings | Admin/HR only |
| DELETE | `/api/notification-settings/:id` | ✅ | Delete notification setting | Admin/HR only |
| POST | `/api/notification-settings/test-send/:dept_id/:leave_type` | ✅ | Send test notification email | Admin/HR only |

---

#### **User Roles Management Endpoints**

| Method | Endpoint | Auth | Purpose | Role Restrictions |
|--------|----------|------|---------|---|
| GET | `/api/user_roles/user/:user_id` | No | Get roles for user | None |

---

#### **System Health Endpoint**

| Method | Endpoint | Auth | Purpose | Role Restrictions |
|--------|----------|------|---------|---|
| GET | `/api/health` | No | API health check | None |

---

## 🗄️ Database Tables & Schema

### Location: PostgreSQL Database

#### **Authentication & User Management**

##### `user_auth` Table
```
Columns:
  - id (UUID, PK) - User ID
  - email (TEXT, UNIQUE) - Email address
  - password_hash (TEXT) - Bcrypt hashed password
  - role (TEXT) - Default role (employee, hr, admin)
  - created_at (TIMESTAMPTZ) - Account creation time
```

##### `user_roles` Table
```
Columns:
  - user_id (UUID, FK to user_auth)
  - role (TEXT) - Role assignment (admin, hr, supervisor, employee)
```

##### `password_reset_tokens` Table
```
Columns:
  - id (BIGSERIAL, PK)
  - user_id (UUID, FK to user_auth)
  - token_hash (TEXT) - SHA-256 hashed reset token
  - expires_at (TIMESTAMPTZ) - Token expiration (30 min)
  - used_at (TIMESTAMPTZ) - When token was used
  - created_at (TIMESTAMPTZ)
```

---

#### **Employee Management**

##### `employees` Table
```
Columns:
  - id (INT, PK)
  - user_id (UUID, FK to user_auth) - Link to auth
  - first_name (TEXT)
  - last_name (TEXT)
  - email (TEXT, UNIQUE)
  - phone (TEXT)
  - department_id (INT, FK to departments)
  - position_id (INT, FK to positions)
  - start_date (DATE) - Used for leave calculation
  - end_date (DATE) - Resignation date (if any)
  - status (VARCHAR) - active, resigned, terminated
  - employee_type (VARCHAR) - permanent, contract, parttime, probation
  - salary (NUMERIC)
  - avatar_url (TEXT)
  - created_at, updated_at (TIMESTAMPTZ)
```

##### `departments` Table
```
Columns:
  - id (INT, PK)
  - name (VARCHAR) - Department name
  - description (TEXT)
  - created_at, updated_at (TIMESTAMPTZ)
```

##### `positions` Table
```
Columns:
  - id (INT, PK)
  - name (VARCHAR) - Job title
  - description (TEXT)
  - salary_range (TEXT)
  - created_at, updated_at (TIMESTAMPTZ)
```

---

#### **Leave Management**

##### `leave_requests` Table
```
Columns:
  - id (INT, PK)
  - employee_id (INT, FK to employees)
  - leave_type (VARCHAR) - vacation, sick, personal, maternity, paternity
  - start_date (DATE)
  - end_date (DATE)
  - start_time (TIME) - For half-day leaves
  - end_time (TIME)
  - is_half_day (BOOLEAN) - True if half-day
  - half_day_period (VARCHAR) - morning, afternoon
  - total_days (NUMERIC) - Calculated days
  - status (VARCHAR) - pending, approved, rejected, withdrawn
  - workflow_status (VARCHAR) - pending, supervisor_approved, hr_approved, ceo_approved
  - reason (TEXT)
  - attachment_url (TEXT) - Medical cert, etc.
  
  -- Multi-level Approval Tracking:
  - supervisor_approved_by (INT, FK to employees)
  - supervisor_approved_at (TIMESTAMP)
  - hr_approved_by (INT, FK to employees)
  - hr_approved_at (TIMESTAMP)
  - ceo_approved_by (INT, FK to employees)
  - ceo_approved_at (TIMESTAMP)
  
  - created_at, updated_at (TIMESTAMPTZ)
```

##### `leave_types` Table
```
Columns:
  - id (INT, PK)
  - name (VARCHAR) - vacation, sick, personal, maternity, paternity
  - description (TEXT)
  - is_paid (BOOLEAN)
```

##### `leave_policies` Table - **Core Leave Quota Rules**
```
Columns:
  - id (BIGSERIAL, PK)
  - employee_type (VARCHAR) - permanent, contract, parttime, probation
  - employee_status (VARCHAR) - active, resigned
  - min_years_of_service (INT) - Service years from
  - max_years_of_service (INT) - Service years to
  - annual_leave_quota (NUMERIC) - Vacation days
  - sick_leave_quota (NUMERIC) - Sick days (default 30)
  - personal_leave_quota (NUMERIC) - Personal days
  - maternity_leave_quota (NUMERIC) - Maternity (default 120 days)
  - paternity_leave_quota (NUMERIC) - Paternity (default 15 days)
  - is_prorated (BOOLEAN) - Prorate for first year
  - active (BOOLEAN) - Policy is active
  - created_at, updated_at (TIMESTAMPTZ)

Example Quotas (Permanent):
  0-1 years: 6 vacation, 30 sick, 3 personal
  2 years: 7 vacation, 30 sick, 3 personal
  5 years: 10 vacation, 30 sick, 3 personal
  10+ years: 15 vacation, 30 sick, 3 personal
```

##### `employee_leave_balances` Table
```
Columns:
  - id (BIGSERIAL, PK)
  - employee_id (INT, FK to employees)
  - year (INT) - Calendar year
  - leave_type (VARCHAR) - vacation, sick, personal, maternity
  - entitled_days (NUMERIC) - Initial allocation
  - used_days (NUMERIC) - Days used
  - remaining_days (NUMERIC) - Entitled - Used
  - policy_id (BIGINT, FK to leave_policies)
  - calculated_at (TIMESTAMPTZ) - Auto-calculated on Jan 1
  - created_at, updated_at (TIMESTAMPTZ)
  
UNIQUE (employee_id, year, leave_type)
```

##### `leave_entitlements` Table
```
Columns:
  - id (BIGSERIAL, PK)
  - employee_id (INT, FK to employees)
  - leave_type_id (INT, FK to leave_types)
  - year (INT)
  - base_quota (NUMERIC)
  - prorated_quota (NUMERIC) - Adjusted for joining mid-year
  - used_days (NUMERIC)
  - remaining_days (NUMERIC)
  - policy_version_id (BIGINT)
  - calculation_run_at (TIMESTAMPTZ)
  - created_at (TIMESTAMPTZ)
```

---

#### **Approval Workflows**

##### `approval_workflows` Table
```
Columns:
  - id (UUID, PK)
  - leave_type (VARCHAR) - 'all' (universal rules)
  - approval_levels (INT) - How many approval steps (1-3)
  - min_days (INT) - Minimum days for this rule
  - max_days (INT) - Maximum days for this rule
  - requires_hr (BOOLEAN) - Does path include HR approval
  - flow_pattern (VARCHAR) - supervisor, supervisor_hr, supervisor_ceo, supervisor_hr_ceo, ceo
  - description (TEXT) - Thai description

Example Workflows:
  1. 0-1 days: supervisor only
  2. 2-3 days: supervisor → HR
  3. 4-7 days: supervisor → CEO
  4. 8-14 days: supervisor → HR → CEO
  5. 15+ days: CEO only
```

---

#### **Holiday Management**

##### `holidays` Table
```
Columns:
  - id (INT, PK)
  - name (VARCHAR)
  - date (DATE)
  - description (TEXT)
  - is_paid (BOOLEAN)
  - created_at, updated_at (TIMESTAMPTZ)
```

---

#### **Notification & Email**

##### `notification_settings` Table
```
Columns:
  - id (BIGSERIAL, PK)
  - dept_id (INT, FK to departments)
  - leave_type (VARCHAR)
  - to_list (TEXT) - Email recipients
  - cc_list (TEXT)
  - bcc_list (TEXT)
  - is_active (BOOLEAN)
  - created_at, updated_at (TIMESTAMPTZ)
  
UNIQUE (dept_id, leave_type)
```

##### `email_logs` Table
```
Columns:
  - id (BIGSERIAL, PK)
  - recipient_email (TEXT)
  - subject (TEXT)
  - leave_request_id (INT, FK to leave_requests)
  - status (VARCHAR) - sent, failed, error
  - error_message (TEXT)
  - sent_at (TIMESTAMPTZ)
  - created_at (TIMESTAMPTZ)
```

##### `email_reminders` Table
```
Columns:
  - id (BIGSERIAL, PK)
  - leave_request_id (INT, FK to leave_requests)
  - reminder_type (VARCHAR)
  - sent_at (TIMESTAMPTZ)
  - created_at (TIMESTAMPTZ)
  
UNIQUE (leave_request_id, reminder_type)
```

##### `leave_request_log` Table
```
Columns:
  - id (BIGSERIAL, PK)
  - employee_id (INT, FK to employees)
  - leave_type (VARCHAR)
  - start_date (DATE)
  - end_date (DATE)
  - notify_to (TEXT)
  - notify_cc (TEXT)
  - notify_bcc (TEXT)
  - email_sent_at (TIMESTAMPTZ)
  - email_status (VARCHAR)
  - error_message (TEXT)
  - created_at (TIMESTAMPTZ)
```

---

#### **Audit & Compliance**

##### `policy_audit_logs` Table
```
Columns:
  - id (BIGSERIAL, PK)
  - policy_id (BIGINT)
  - action (VARCHAR) - create, update, delete
  - old_values (JSONB) - Previous values
  - new_values (JSONB) - New values
  - changed_by (UUID, FK to user_auth)
  - changed_at (TIMESTAMPTZ)
```

---

#### **Views**

##### `leave_allowance` View
```
SELECT from employee_leave_balances
Shows: id, employee_id, year, leave_type, 
       entitled_days, used_days, remaining_days, 
       policy_id, calculated_at, created_at, updated_at
```

---

## 👥 User Roles & Permissions

### Role Hierarchy

```
Admin (Superuser)
  ├── System configuration
  ├── All HR functions
  ├── All approval rights
  └── User management

HR
  ├── Employee management
  ├── Leave policy management
  ├── All approvals
  ├── Approval workflows
  ├── Notification settings
  └── Reports

Supervisor/Manager
  ├── Approve team's leaves
  ├── View team's calendar
  ├── View reports
  └── Limited employee info

Employee
  ├── Own profile
  ├── Submit leave requests
  ├── View own balance
  ├── View company calendar
  └── Change own password
```

---

### Permission Matrix

| Feature | Admin | HR | Supervisor | Employee |
|---------|-------|----|----|----------|
| **Employee Management** |
| View all employees | ✅ | ✅ | ❌ | ❌ |
| Create employee | ✅ | ✅ | ❌ | ❌ |
| Edit employee info | ✅ | ✅ | ❌ | ❌ (own only) |
| Delete employee | ✅ | ✅ | ❌ | ❌ |
| Reset password | ✅ | ✅ | ❌ | ❌ |
| Assign role | ✅ | ✅ | ❌ | ❌ |
| **Department Management** |
| View departments | ✅ | ✅ | ✅ | ✅ |
| Create department | ✅ | ✅ | ❌ | ❌ |
| Edit department | ✅ | ✅ | ❌ | ❌ |
| Delete department | ✅ | ✅ | ❌ | ❌ |
| **Leave Requests** |
| Submit leave | ✅ | ❌ | ✅ | ✅ |
| View own leaves | ✅ | ✅ | ✅ | ✅ |
| View all leaves | ✅ | ✅ | ❌ (team only) | ❌ |
| Edit own leave | ✅ | ✅ | ✅ | ✅ (pending only) |
| **Leave Approvals** |
| Approve leaves (Supervisor level) | ✅ | ✅ | ✅ | ❌ |
| Approve leaves (HR level) | ✅ | ✅ | ❌ | ❌ |
| Approve leaves (CEO level) | ✅ | ❌ | ❌ | ❌ |
| Reject leaves | ✅ | ✅ | ✅ | ❌ |
| **Leave Policy Management** |
| View policies | ✅ | ✅ | ✅ | ❌ |
| Create policy | ✅ | ✅ | ❌ | ❌ |
| Edit policy | ✅ | ✅ | ❌ | ❌ |
| Delete policy | ✅ | ✅ | ❌ | ❌ |
| **Approval Workflows** |
| View workflows | ✅ | ✅ | ✅ | ❌ |
| Configure workflows | ✅ | ✅ | ❌ | ❌ |
| **Holidays** |
| View holidays | ✅ | ✅ | ✅ | ✅ |
| Create holiday | ✅ | ✅ | ❌ | ❌ |
| Edit holiday | ✅ | ✅ | ❌ | ❌ |
| Delete holiday | ✅ | ✅ | ❌ | ❌ |
| **Notifications** |
| View settings | ✅ | ✅ | ❌ | ❌ |
| Configure notifications | ✅ | ✅ | ❌ | ❌ |
| Test email send | ✅ | ✅ | ❌ | ❌ |
| **Reports** |
| View reports | ✅ | ✅ | ❌ | ❌ |
| Export data | ✅ | ✅ | ❌ | ❌ |
| **System Settings** |
| View dashboard | ✅ | ✅ | ✅ | ✅ |
| Change own password | ✅ | ✅ | ✅ | ✅ |
| Upload avatar | ✅ | ✅ | ✅ | ✅ |

---

## 📊 Key Features Summary

### 1. **Authentication & Authorization**
- ✅ Email/Password login
- ✅ Office365 OAuth integration (seamless SSO)
- ✅ JWT token-based authentication (7-day expiry)
- ✅ Password reset via email
- ✅ Role-based access control (Admin, HR, Supervisor, Employee)
- ✅ Multi-user role support
- ✅ Avatar upload/management

---

### 2. **Employee Management**
- ✅ Complete employee database (CRUD)
- ✅ Employee types: Permanent, Contract, Part-time, Probation
- ✅ Department & position assignment
- ✅ Start/end dates for accurate leave calculation
- ✅ Status tracking (Active, Resigned, Terminated)
- ✅ Employee search & filtering
- ✅ Welcome email automation

---

### 3. **Leave Management System**
**Leave Types:**
- Vacation/Annual Leave (varies by years of service)
- Sick Leave (30 days, paid)
- Personal Leave (2-3 days)
- Maternity Leave (120 days)
- Paternity Leave (15 days, for permanent staff)

**Features:**
- ✅ Automatic quota calculation based on:
  - Employee type (permanent, contract, parttime, probation)
  - Years of service
  - Proration for mid-year joiners
- ✅ Half-day leave support (morning/afternoon)
- ✅ Time-based leaves (specific hours)
- ✅ Multi-level approval workflow
- ✅ Holiday calendar integration
- ✅ Team leave calendar view
- ✅ Leave balance tracking & forecasting
- ✅ Annual leave auto-reset (Jan 1)
- ✅ Attachment support (medical cert, etc.)

---

### 4. **Leave Approval Workflows**
**Configurable approval chains based on days:**
- 0-1 days: Supervisor approval only
- 2-3 days: Supervisor → HR approval
- 4-7 days: Supervisor → CEO approval
- 8-14 days: Supervisor → HR → CEO approval
- 15+ days: CEO direct approval

**Features:**
- ✅ Multi-level approval tracking
- ✅ Approval status workflow (pending → supervisor_approved → hr_approved → final)
- ✅ Rejection with reason
- ✅ Email notifications at each step
- ✅ Approval reminders

---

### 5. **Leave Policy Management**
- ✅ Policy creation/editing by year of service
- ✅ Different policies per employee type
- ✅ Quota customization (vacation, sick, personal, maternity)
- ✅ Proration rules for first year
- ✅ Policy versioning for audit trail
- ✅ Approval workflow configuration
- ✅ Policy audit logs

---

### 6. **Organization Management**
- ✅ Department CRUD
- ✅ Position/Job Title CRUD
- ✅ Department-specific notification settings
- ✅ Employee-department assignment

---

### 7. **Holiday Management**
- ✅ Create public holidays
- ✅ Mark as paid/unpaid
- ✅ Holiday calendar view
- ✅ Integration with leave calculations
- ✅ Holiday blocking for leave requests

---

### 8. **Notification System**
- ✅ Email notifications via Office365 SMTP
- ✅ Configurable recipients per department
- ✅ CC/BCC support
- ✅ Send on: leave submit, approve, reject
- ✅ Test email functionality
- ✅ Email log & error tracking
- ✅ Reminder tracking

---

### 9. **Reporting & Analytics**
- ✅ Monthly leave statistics by type
- ✅ Department leave summary
- ✅ Employee leave usage ranking
- ✅ Leave trend charts
- ✅ Pie charts by leave type
- ✅ Monthly/yearly comparisons
- ✅ Export capabilities

---

### 10. **Dashboard & UI**
- ✅ Admin/HR dashboard: stats, pending leaves, monthly summary
- ✅ Employee dashboard: balance, recent leaves, team calendar
- ✅ Supervisor dashboard: team approval queue
- ✅ Dark/Light theme toggle
- ✅ Responsive design (mobile-friendly)
- ✅ Real-time notifications
- ✅ Loading states & error handling
- ✅ Thai language support

---

### 11. **Security Features**
- ✅ Password hashing (bcrypt)
- ✅ JWT token validation
- ✅ Endpoint authentication middleware
- ✅ SQL injection protection (parameterized queries)
- ✅ CORS configuration
- ✅ File upload validation (avatar max 10MB)
- ✅ Password complexity requirements (min 6 chars)
- ✅ Rate limiting on auth endpoints
- ✅ Email verification for Office365
- ✅ Secure password reset (token-based, 30 min expiry)

---

### 12. **Data Management**
- ✅ PostgreSQL relational database
- ✅ Connection pooling (pg library)
- ✅ Automatic schema initialization
- ✅ Foreign key relationships
- ✅ Constraint validation
- ✅ Audit logging for policies

---

## 🔧 Technology Stack

### Frontend
- React 18+ with TypeScript
- React Router for navigation
- Vite as build tool
- Tailwind CSS for styling
- Framer Motion for animations
- Recharts for data visualization
- Date-fns for date handling
- Shadcn UI components
- Supabase client library

### Backend
- Node.js + Express.js
- PostgreSQL database
- JWT authentication
- Bcrypt for password hashing
- Nodemailer with Office365 SMTP
- CORS middleware
- Environment-based configuration

### Deployment Ready
- Office365 OAuth integration
- Supabase Edge Functions
- Docker-ready backend
- Environment variable management

---

## 📈 Database Growth Estimates

| Table | Est. Rows/User | Notes |
|-------|---|---|
| employees | 1 | Per active employee |
| user_auth | 1 | Per user account |
| user_roles | 0.5 | Multiple roles possible |
| leave_requests | 10-20 | ~15 leaves/year per employee |
| employee_leave_balances | 4 | Per year, per employee (4 leave types) |
| leave_policies | 15-30 | Policy matrix (type × service years) |
| approval_workflows | 5 | Global rules |
| email_logs | 20 | Per employee per year |
| policy_audit_logs | 5 | Per policy change |

---

## 🎯 System Strengths

1. ✅ **Flexible Leave Policies** - Supports diverse employee types & service years
2. ✅ **Thai Compliance** - Labor law compliant leave system
3. ✅ **Multi-level Approvals** - Configurable approval chains
4. ✅ **Security** - JWT, bcrypt, parameterized queries
5. ✅ **Scalability** - Connection pooling, indexed tables
6. ✅ **User Experience** - Real-time notifications, dark theme, mobile-friendly
7. ✅ **Automation** - Annual leave resets, auto-email, welcome emails
8. ✅ **Reporting** - Comprehensive leave analytics
9. ✅ **Integration** - Office365 OAuth + SMTP

---

## ⚠️ Considerations

- Password reset emails require Office365 SMTP configuration
- Leave calculations are complex (proration, service years) - well-tested
- Email delivery depends on external SMTP (Office365)
- OAuth flow requires Azure AD app registration

---

## 📚 Documentation Files

- `OFFICE365_README.md` - OAuth & SMTP setup
- `OFFICE365_SETUP.md` - Detailed configuration
- `ENV_SETUP.md` - Environment variables
- `TESTING_GUIDE.md` - Test procedures
- `DATABASE_CONFIG.md` - DB setup
- `EMAIL_CONFIG_GUIDE.md` - Email settings

---

**End of System Audit**
