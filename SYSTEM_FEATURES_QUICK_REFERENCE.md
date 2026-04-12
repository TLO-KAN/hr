# 📊 HR System - Quick Reference & Feature Map
**Last Updated:** April 1, 2026

---

## 🎯 System Overview

ระบบ HR Management นี้มี **4 ส่วนหลัก**:
1. **Authentication** - Login, OAuth, Password Reset
2. **Employee Management** - ข้อมูลพนักงาน, แผนกงาน, ตำแหน่ง
3. **Leave Management** - ขอลา, อนุมัติ, สิทธิ์ลา, ปฏิทิน
4. **Settings & Reports** - การตั้งค่าระบบ, รายงาน, สถิติ

---

## 🔐 ใครสามารถเข้าระบบได้

| Role | ชื่อ | สามารถเข้า | Permissions |
|------|------|-----------|---|
| **Employee** | พนักงาน | `/dashboard`, `/leave-request`, `/profile` | ขอลา, ดูสิทธิ์, ดูปฏิทิน, แก้ไขข้อมูลตัวเอง |
| **Supervisor** | หัวหน้างาน | ↑ + `/leave-approval` | ↑ + อนุมัติการลาของทีม, ดูรายงานทีม |
| **HR** | HR Manager | ↑ + `/leave-settings`, `/settings` | ↑ + จัดการนโยบายลา, ตั้งค่าระบบทั้งหมด |
| **Admin** | Administrator | ทั้งหมด | ตั้งค่า user, ลบข้อมูล, เข้า backend DB |

---

## 📄 หน้า (Pages) - ฟังก์ชันและตำแหน่ง

### 🔐 Authentication Pages
Located: `frontend/src/pages/`

| หน้า | URL | ฟังก์ชัน | อยู่ที่ |
|------|-----|---------|--------|
| **Auth** | `/auth` | Login, Forgot Password, Reset Password | [Auth.tsx](frontend/src/pages/Auth.tsx) |
| **OAuth Callback** | `/auth/callback` | จัดการการเข้า Office365 | [AuthCallback.tsx](frontend/src/pages/AuthCallback.tsx) |
| **Reset Password** | `/reset-password?token=XXX` | รีเซ็ตรหัสผ่าน | [ResetPassword.tsx](frontend/src/pages/ResetPassword.tsx) |

### 👤 Employee Pages

| หน้า | URL | ฟังก์ชัน | อยู่ที่ | ใครเข้าได้ |
|------|-----|---------|--------|-----------|
| **Dashboard** | `/dashboard` | สรุปข้อมูล พนักงาน, ลาล่าสุด, ปฏิทิน | [Dashboard.tsx](frontend/src/pages/Dashboard.tsx) | All roles |
| **Leave Request** | `/leave-request` | ขอลา, ดูสิทธิ์ลา, ปฏิทินทีม | [LeaveRequest.tsx](frontend/src/pages/LeaveRequest.tsx) | Employee+ |
| **Profile** | `/profile` | แก้ไขข้อมูล, เปลี่ยนรหัสผ่าน, upload avatar | [Profile.tsx](frontend/src/pages/Profile.tsx) | All authenticated |

### 👨‍💼 Supervisor/Manager Pages

| หน้า | URL | ฟังก์ชัน | อยู่ที่ | ใครเข้าได้ |
|------|-----|---------|--------|-----------|
| **Leave Approval** | `/leave-approval` | อนุมัติ/ปฏิเสธการลาของทีม | [LeaveApproval.tsx](frontend/src/pages/LeaveApproval.tsx) | Supervisor+ |

### 🏢 HR/Admin Management Pages

| หน้า | URL | ฟังก์ชัน | อยู่ที่ | ใครเข้าได้ |
|------|-----|---------|--------|-----------|
| **Employees** | `/employees` | CRUD พนักงาน, assign role, upload avatar | [Employees.tsx](frontend/src/pages/Employees.tsx) | HR+ |
| **Departments** | `/departments` | CRUD แผนกงาน | [Departments.tsx](frontend/src/pages/Departments.tsx) | HR+ |
| **Positions** | `/positions` | CRUD ตำแหน่ง | [Positions.tsx](frontend/src/pages/Positions.tsx) | HR+ |
| **Holidays** | `/holidays` | CRUD วันหยุดบริษัท | [Holidays.tsx](frontend/src/pages/Holidays.tsx) | HR+ |
| **Leave Settings** | `/leave-settings` | ตั้งค่านโยบายลา, workflow, quota | [LeaveSettings.tsx](frontend/src/pages/LeaveSettings.tsx) | HR+ |
| **Leave Balance** | `/leave-balance` | ดูสิทธิ์ลาทั้งบริษัท, recalculate | [LeaveBalanceDashboard.tsx](frontend/src/pages/LeaveBalanceDashboard.tsx) | HR+ |
| **Settings** | `/settings` | ตั้งค่า notification, email, workflow | [Settings.tsx](frontend/src/pages/Settings.tsx) | HR+ |
| **Reports** | `/reports` | สถิติการลา, charts, analysis | [Reports.tsx](frontend/src/pages/Reports.tsx) | HR+ |

---

## 🔌 Backend API Endpoints - จากน้อยไปมาก

Located: `backend/server.js`

### 🔐 Auth API
```
POST   /api/auth/login                      → เข้าสู่ระบบ
POST   /api/auth/office365-login           → เข้าด้วย email เฉพาะ
GET    /api/auth/azure-oauth-start         → เริ่มต้น Azure OAuth
POST   /api/auth/azure-oauth-callback      → รับ callback จาก Azure
POST   /api/auth/forgot-password           → ส่งลิงก์รีเซ็ตรหัสผ่าน
POST   /api/auth/reset-password            → รีเซ็ตรหัสผ่าน
POST   /api/auth/change-password           → เปลี่ยนรหัสผ่าน (authenticated)
GET    /api/auth/me                        → ดูข้อมูลผู้ใช้ปัจจุบัน
POST   /api/auth/upload-avatar             → UploadProfile pic
POST   /api/auth/delete-avatar             → ลบProfile pic
```

### 👥 Employee API
```
GET    /api/employees                      → ดูรายชื่อพนักงาน
GET    /api/employees/:id                  → ดูพนักงาน 1 คน
POST   /api/employees                      → เพิ่มพนักงาน (HR)
PUT    /api/employees/:id                  → แก้ไขพนักงาน (HR)
DELETE /api/employees/:id                  → ลบพนักงาน (HR)
PUT    /api/employees/:id/role             → เปลี่ยน role (HR)
POST   /api/employees/:id/reset-password   → รีเซ็ตรหัส (HR)
```

### 🏢 Department & Position API
```
GET    /api/departments                    → ดูแผนก
POST   /api/departments                    → เพิ่มแผนก (HR)
PUT    /api/departments/:id                → แก้ไขแผนก (HR)
DELETE /api/departments/:id                → ลบแผนก (HR)

GET    /api/positions                      → ดูตำแหน่ง
POST   /api/positions                      → เพิ่มตำแหน่ง (HR)
PUT    /api/positions/:id                  → แก้ไขตำแหน่ง (HR)
DELETE /api/positions/:id                  → ลบตำแหน่ง (HR)
```

### 📅 Leave Request API
```
GET    /api/leave-requests                 → ดูคำขอลา
POST   /api/leave-requests                 → ขอลา
PUT    /api/leave-requests/:id             → แก้ไขคำขอลา
PUT    /api/leave-requests/:id/approve     → อนุมัติลา (Supervisor/HR)
PUT    /api/leave-requests/:id/reject      → ปฏิเสธลา (Supervisor/HR)
```

### 📊 Leave Policy & Entitlement API
```
GET    /api/leave-types                    → ดูประเภทการลา
GET    /api/leave-policies                 → ดูนโยบายลา
POST   /api/leave-policies                 → สร้างนโยบาย (HR)
PUT    /api/leave-policies/:id             → แก้ไขนโยบาย (HR)
DELETE /api/leave-policies/:id             → ลบนโยบาย (HR)
GET    /api/leave-entitlements             → ดูสิทธิ์ลาของฉัน
GET    /api/admin/leave-entitlements       → ดูสิทธิ์ลาทั้งบริษัท (HR)
POST   /api/leave/calculate                → คำนวณสิทธิ์ลา prorated
POST   /api/leave-balances/run-annual-update → รีเซ็ตสิทธิ์ประจำปี (HR)
```

### 🎉 Holiday & Notification API
```
GET    /api/holidays                       → ดูวันหยุด
POST   /api/holidays                       → เพิ่มวันหยุด (HR)
PUT    /api/holidays/:id                   → แก้ไขวันหยุด (HR)
DELETE /api/holidays/:id                   → ลบวันหยุด (HR)

POST   /api/notification-settings          → ตั้งค่า email (HR)
POST   /api/notification-settings/test-send/:dept/:type → ส่งทดสอบ (HR)
```

---

## 🗂️ Directory Structure

```
/Applications/HR/
├── backend/
│   ├── server.js                 ← ทั้งหมด API endpoints (58 routes)
│   ├── package.json
│   ├── .env                      ← Database credentials
│   └── src/
│       └── config/
│           └── database.js       ← PostgreSQL connection pool
├── frontend/
│   ├── src/
│   │   ├── pages/                ← 17 pages (Auth, Employee, HR, etc.)
│   │   ├── components/
│   │   │   ├── layout/           ← DashboardLayout, Sidebar
│   │   │   ├── leave/            ← Leave components (balance, calendar, etc.)
│   │   │   ├── notifications/    ← Holiday & notification bells
│   │   │   └── ui/               ← Button, Input, Dialog, etc.
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx   ← User auth state & functions
│   │   ├── types/
│   │   │   └── hr.ts             ← TypeScript interfaces
│   │   └── lib/
│   │       └── leaveCalculation.ts ← Working day calculation logic
│   ├── package.json
│   └── .env                      ← Frontend config (API URL)
│
├── Documentation/
│   ├── README.md
│   ├── SYSTEM_AUDIT.md           ← Complete feature audit
│   ├── DASHBOARD_UPDATES.md      ← Dashboard role updates
│   ├── AZURE_AD_SETUP.md         ← Office365 OAuth setup
│   ├── OFFICE365_README.md       ← Email SMTP setup
│   ├── CREDENTIALS_MANAGEMENT.md
│   ├── QUICK_START.md            ← How to start servers
│   └── [20+ more guides]
```

---

## 🎨 Main Features at a Glance

| Feature | ที่ Location | ใครใช้ | Status |
|---------|---------|--------|--------|
| **Authentication** | Auth.tsx | All | ✅ Supports Azure AD OAuth + Password |
| **Employee Profile** | Profile.tsx | All | ✅ Edit info, change password, avatar |
| **Leave Request** | LeaveRequest.tsx | Employees | ✅ Submit leave, view balance, half-day |
| **Leave Approval** | LeaveApproval.tsx | Supervisor+ | ✅ Multi-level workflow (Sup→HR→CEO) |
| **Leave Policies** | LeaveSettings.tsx | HR+ | ✅ Dynamic quotas, pro-rate by service year |
| **Holiday Calendar** | Holidays.tsx | HR+ | ✅ CRUD holidays, view on calendar |
| **Team Calendar** | LeaveRequest.tsx Tab | Employees+ | ✅ See team members' leaves |
| **Employee Management** | Employees.tsx | HR+ | ✅ CRUD, role assignment, avatar upload |
| **Department Mgmt** | Departments.tsx | HR+ | ✅ Create/edit departments |
| **Position Mgmt** | Positions.tsx | HR+ | ✅ Create/edit job titles |
| **Reporting** | Reports.tsx | HR+ | ✅ Leave stats, charts, analysis |
| **Email Notifications** | Settings.tsx | HR+ | ✅ Configure by dept + leave type |
| **Dark/Light Theme** | ThemeToggle.tsx | All | ✅ Persist user preference |
| **Mobile Responsive** | All | All | ✅ Works on phone/tablet |

---

## 🔄 Main Workflows

### 1️⃣ Employee Request Leave
```
Employee
   │
   ├─→ LeaveRequest.tsx
   │   ├─ Check leave balance (/api/leave-entitlements)
   │   ├─ Select dates & type
   │   ├─ Add reason
   │   └─ Submit (POST /api/leave-requests)
   │
   └─→ Dashboard shows "Pending approval"
```

### 2️⃣ Supervisor Approves
```
Supervisor
   │
   ├─→ LeaveApproval.tsx
   │   ├─ View pending requests
   │   ├─ Check employee info & balance
   │   ├─ Approve/Reject (PUT /api/leave-requests/:id/approve)
   │   └─ Add comment
   │
   └─→ System sends email to employee
```

### 3️⃣ HR Manages System
```
HR Admin
   │
   ├─→ LeaveSettings.tsx
   │   ├─ Create leave policies
   │   ├─ Set quotas per employee type
   │   ├─ Configure approval workflow
   │   └─ Annual reset of balances
   │
   ├─→ Holidays.tsx
   │   ├─ Add/edit public holidays
   │   └─ View holiday calendar
   │
   ├─→ Settings.tsx
   │   ├─ Email notification config
   │   └─ Test send emails
   │
   └─→ Reports.tsx
       ├─ Leave statistics
       └─ Department/Employee analysis
```

---

## 📊 Database Tables (18 Main Tables)

Located: PostgreSQL database

```
Authentication:      user_auth, user_roles, password_reset_tokens
Employees:          employees, departments, positions
Leave Management:   leave_requests, leave_entitlements, leave_types, 
                    company_holidays, leave_policy_rules, 
                    approval_workflows
Notifications:      notification_settings, email_logs
Audit:              audit_trails
```

---

## 🔍 How to Find Specific Features

**❓ Want to change something?**

| What | Where | Type |
|------|-------|------|
| **Login page look** | `frontend/src/pages/Auth.tsx` | Frontend |
| **Add new role** | `backend/server.js` (PUT `/api/employees/:id/role`) | Backend API |
| **Change leave quota** | `frontend/src/pages/LeaveSettings.tsx` | Frontend |
| **Add email notification** | `frontend/src/pages/Settings.tsx` | Frontend |
| **Modify approval workflow** | `backend/server.js` (/api/approval-workflows) | Backend API |
| **Change dashboard layout** | `frontend/src/pages/Dashboard.tsx` | Frontend |
| **Update holiday calendar** | `frontend/src/pages/Holidays.tsx` | Frontend |
| **Modify leave calculation** | `frontend/src/lib/leaveCalculation.ts` | Frontend |
| **Change password requirement** | `backend/server.js` (auth routes) | Backend |
| **Add new employee field** | `backend/server.js` & PostgreSQL | Backend |

---

## 🎯 Common Tasks & Where to Do Them

| Task | Page | API | Role |
|------|------|-----|------|
| ขอลา | LeaveRequest.tsx | POST /api/leave-requests | Employee |
| อนุมัติลา | LeaveApproval.tsx | PUT /api/leave-requests/:id/approve | Supervisor |
| เพิ่มพนักงาน | Employees.tsx | POST /api/employees | HR |
| ตั้งค่าการลา | LeaveSettings.tsx | POST /api/leave-policies | HR |
| ตั้งค่าอีเมล | Settings.tsx | POST /api/notification-settings | HR |
| ดูรายงาน | Reports.tsx | GET /api/reports | HR |
| เปลี่ยนรหัสผ่าน | Profile.tsx | POST /api/auth/change-password | All |
| ดูปฏิทินทีม | LeaveRequest.tsx (tab) | GET leave_requests | All |

---

## ✅ Complete Feature Checklist

### Authentication
- ✅ Email + Password login
- ✅ Azure AD OAuth (Office365)
- ✅ Forgot Password
- ✅ Reset Password
- ✅ Change Password
- ✅ User Avatar Upload

### Employee Management
- ✅ View all employees
- ✅ Add/Edit/Delete employees
- ✅ Assign roles
- ✅ Employee profiles
- ✅ Department management
- ✅ Position management

### Leave Management
- ✅ Submit leave requests
- ✅ View leave balance by type
- ✅ Half-day leave support
- ✅ Team leave calendar
- ✅ Holiday calendar
- ✅ Leave policy configuration
- ✅ Multi-level approval workflow
- ✅ Annual automatic reset
- ✅ Prorated entitlements

### Notifications
- ✅ Email notifications
- ✅ Configurable by department & type
- ✅ Holiday alerts
- ✅ Notification bell with count

### Reporting
- ✅ Leave statistics
- ✅ Department analysis
- ✅ Monthly summary charts
- ✅ Employee ranking

### System
- ✅ Dark/Light theme
- ✅ Mobile responsive
- ✅ Role-based access control
- ✅ PostgreSQL database
- ✅ JWT authentication
- ✅ Password encryption (bcrypt)

---

## 🚀 Getting Started

```bash
# Terminal 1 - Backend
cd /Applications/HR/backend
npm run dev          # Runs on http://localhost:3002

# Terminal 2 - Frontend
cd /Applications/HR/frontend
npm run dev          # Runs on http://localhost:5173

# Access
http://localhost:5173/auth   # Login page
http://localhost:5173/dashboard # Dashboard
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| [SYSTEM_AUDIT.md](SYSTEM_AUDIT.md) | Complete technical audit |
| [DASHBOARD_UPDATES.md](DASHBOARD_UPDATES.md) | Dashboard role-based changes |
| [AZURE_AD_SETUP.md](AZURE_AD_SETUP.md) | Azure OAuth configuration |
| [OFFICE365_README.md](OFFICE365_README.md) | Email SMTP setup |
| [QUICK_START.md](QUICK_START.md) | How to start the app |

---

**Next Step:** Choose what you want to modify or add, and I'll help you! 😊
