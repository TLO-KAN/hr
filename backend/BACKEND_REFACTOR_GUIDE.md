# 🚀 Backend Refactoring Complete - HR Management System

## 📋 Overview

The backend has been completely refactored using **Clean Architecture** principles with the following structure:

```
backend/
├── src/
│   ├── config/
│   │   ├── db.ts           # PostgreSQL Connection Pool
│   │   └── passport.ts     # Azure AD OAuth Strategy
│   ├── controllers/
│   │   ├── AuthController.ts      # Authentication endpoints
│   │   └── LeaveController.ts     # Leave request endpoints
│   ├── routes/
│   │   ├── auth.ts         # /auth routes
│   │   └── leaves.ts       # /leaves routes
│   ├── services/
│   │   ├── AuthService.ts           # Email/Password & SSO login, JWT
│   │   ├── LeaveService.ts          # Leave calculation, validation
│   │   └── NotificationService.ts   # Email notifications via M365 SMTP
│   └── index.ts            # Main entry point (Port 3322)
├── .env                     # Environment variables
├── package.json             # Dependencies
└── tsconfig.json           # TypeScript configuration
```

---

## ⚙️ Infrastructure Configuration (Strict)

### Server
- **Port**: 3322
- **Environment**: Configurable via `.env` (NODE_ENV)
- **Framework**: Express.js

### Database
- **Type**: PostgreSQL
- **Host**: localhost
- **Port**: 5432
- **Credentials**: postgres / postgres
- **Database**: hr_system
- **Connection Pool**: Max 20 connections, 30s idle timeout

### Email
- **SMTP Host**: smtp.office365.com
- **SMTP Port**: 587
- **TLS**: Enabled
- **From**: Configured in `.env` (SMTP_FROM)
- **Authentication**: Office365 credentials from `.env`

### OAuth
- **Provider**: Azure AD
- **Redirect URI**: http://localhost:3322/auth/microsoft/callback
- **Credentials**: From `.env` (AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID)

---

## 🔐 Authentication Service (`AuthService.ts`)

### Features
1. **Email/Password Login**
   - Hash verification with bcrypt
   - JWT token creation (7-day expiry)

2. **Microsoft SSO (Email-based Identity)**
   - Fetches user profile from Microsoft Graph API
   - **Rule**: Email is the primary user identity
   - If user exists by email → Create JWT immediately
   - If user doesn't exist → Create new user record + JWT
   - Prevents duplicate user records

3. **User Registration**
   - Creates new user with email/password
   - Password hashed with bcrypt (salt rounds: 10)

4. **JWT Management**
   - Token creation: `createToken(payload)`
   - Token verification: `verifyToken(token)`
   - Token extraction from Authorization header

---

## 📅 Leave Service (`LeaveService.ts`)

### Pro-Rate Calculation Logic
- **Formula**: `(serviceDays / 365) × 6` days
- **Rounding**: Round to nearest 0.5
- **Base Entitlement**: 15 days/year for confirmed employees

### 119-Day Probation Rule
- **Probation Period**: First 119 days of employment
- **Eligibility**: 
  - Can only use pro-rated leave (max ~2 days in first 4 months)
  - Must complete 119 days OR be confirmed employee
- **Calculation**: Pro-rate 6 days over 365 days

### Leave Request Validation
1. **Advance Notice**: 3-day minimum advance notice required
2. **Balance Check**: Cannot exceed remaining balance
3. **Date Validation**: Start date before end date, no past dates
4. **Probation Check**: Enforce 119-day rule

### Methods
- `calculateLeaveEntitlement(employeeId)` - Get leave balance
- `validateLeaveRequest(employeeId, startDate, endDate)` - Validate request
- `createLeaveRequest()` - Create new leave request
- `approveLeaveRequest(leaveRequestId)` - Approve (manager only)
- `rejectLeaveRequest(leaveRequestId, reason)` - Reject (manager only)

---

## 📧 Notification Service (`NotificationService.ts`)

### Email Configuration
- **SMTP Transporter**: Nodemailer + Office365
- **Status**: Verified on startup
- **Default Port**: 587 (TLS enabled)

### Template Variable Substitution
Variables in curly braces: `{variable_name}` are replaced with actual values

**Example**:
```
Subject: "คำขอลาของ {employee_name} ได้รับการอนุมัติ"
Body: "Employee: {employee_email}, Leave Type: {leave_type}"
```

### Recipient Lookup from Database
- **Table**: `notification_settings`
- **Filters**:
  - Department (optional)
  - Role (e.g., manager, HR, department head)
  - Notification type (leave_request, approval, rejection)

### Email Notifications
1. **Leave Request**: Sent to managers when employee requests leave
2. **Leave Approval**: Sent to employee + relevant departments
3. **Leave Rejection**: Sent to employee with rejection reason
4. **Custom Emails**: Generic template support for other notifications

---

## 🔗 API Routes

### Authentication Routes (`/auth`)

#### POST /auth/register
```json
{
  "email": "user@company.com",
  "password": "secure_password",
  "displayName": "John Doe"
}
```
**Response**:
```json
{
  "success": true,
  "data": {
    "token": "jwt_token_here",
    "user": { "id", "email", "display_name", "employee_id", "role" }
  }
}
```

#### POST /auth/login
```json
{
  "email": "user@company.com",
  "password": "secure_password"
}
```

#### GET /auth/microsoft
Initiates Microsoft OAuth login flow

#### GET /auth/microsoft/callback
OAuth callback handler (redirects to frontend with token)

#### GET /auth/me
Returns current authenticated user (requires JWT)

#### POST /auth/verify-token
```json
{
  "Authorization": "Bearer <token>"
}
```
Verifies JWT token validity

#### POST /auth/logout
Logout endpoint (client-side JWT invalidation)

---

### Leave Routes (`/leaves`)

#### POST /leaves/request
```json
{
  "leaveType": "annual",
  "startDate": "2026-04-15",
  "endDate": "2026-04-17",
  "reason": "Personal leave"
}
```

#### GET /leaves/balance
Returns leave balance for current employee:
```json
{
  "total_entitled": 15,
  "used_this_year": 3,
  "remaining": 12,
  "annual_allowance": 15,
  "service_days": 250
}
```

#### GET /leaves/requests
Lists all leave requests (filter by status: pending/approved/rejected)

#### GET /leaves/pending
Lists pending leave requests (managers only)

#### POST /leaves/:id/approve
Approves leave request (sends notification to employee)

#### POST /leaves/:id/reject
```json
{
  "reason": "Insufficient coverage"
}
```
Rejects leave request with reason

---

## 📝 Database Schema (Required Tables)

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  display_name VARCHAR(255),
  employee_id UUID REFERENCES employees(id),
  role VARCHAR(50) DEFAULT 'employee',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### employees
```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY,
  email VARCHAR(255),
  display_name VARCHAR(255),
  employment_date DATE NOT NULL,
  employment_status VARCHAR(50) DEFAULT 'probation',
  annual_leave_days INTEGER DEFAULT 15,
  department VARCHAR(100),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### leave_requests
```sql
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id),
  leave_type VARCHAR(50),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### notification_settings
```sql
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY,
  department VARCHAR(100),
  role VARCHAR(50),
  email VARCHAR(255),
  notify_on_leave_request BOOLEAN DEFAULT true,
  notify_on_approval BOOLEAN DEFAULT true,
  notify_on_rejection BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
```bash
# Edit .env file with:
# - DB credentials
# - JWT_SECRET
# - Office365 SMTP credentials
# - Azure AD OAuth credentials
```

### 3. Initialize Database
```bash
# Ensure PostgreSQL is running
psql -U postgres -d hr_system < init-db.sql
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Verify Server
```bash
curl http://localhost:3322/health
```

---

## 📊 File Structure Summary

| File | Purpose |
|------|---------|
| `src/config/db.ts` | PostgreSQL connection pool management |
| `src/config/passport.ts` | Azure AD OAuth strategy configuration |
| `src/services/AuthService.ts` | Authentication & JWT logic |
| `src/services/LeaveService.ts` | Leave calculation & validation |
| `src/services/NotificationService.ts` | Email notifications |
| `src/controllers/AuthController.ts` | Auth API handlers |
| `src/controllers/LeaveController.ts` | Leave API handlers |
| `src/routes/auth.ts` | Authentication routes |
| `src/routes/leaves.ts` | Leave request routes |
| `src/index.ts` | Express app initialization |
| `.env` | Environment configuration |
| `package.json` | Dependencies & scripts |
| `tsconfig.json` | TypeScript configuration |

---

## 🔄 Business Logic Summary

### User Management
- Email is the primary identity
- Microsoft SSO creates/finds users by email
- No duplicate user records

### Leave Workflow
1. Employee submits leave request (min 3 days advance)
2. System validates: balance, probation status, dates
3. Manager reviews and approves/rejects
4. Notification sent to employee & relevant departments
5. Leave balance updated on approval

### Probation Management
- 119-day minimum before full leave eligibility
- Pro-rated entitlement during probation
- Confirmed employees get full annual allowance (15 days)

---

## ✅ Validation Rules

- **Email Format**: Valid email addresses
- **Password**: Secure hash with bcrypt
- **JWT Expiry**: 7 days
- **Leave Notice**: Minimum 3 days advance
- **Probation Period**: 119 days service required
- **Leave Balance**: Cannot exceed remaining days

---

## 📧 SMTP Configuration

**Required in .env**:
```
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@company.com
SMTP_PASS=your-office365-password
SMTP_FROM=noreply@company.com
```

**TLS**: Enabled by default for Office365

---

## 🛠️ Troubleshooting

### Server Won't Start
- Check `.env` file exists and has all required variables
- Verify PostgreSQL is running on localhost:5432
- Check port 3322 is not in use

### Database Connection Failed
- Verify PostgreSQL credentials in `.env`
- Check database `hr_system` exists
- Run `npm run db:init` to initialize schema

### Email Not Sending
- Verify Office365 credentials in `.env`
- Check SMTP_USER is correct Office365 email
- Verify SMTP_PASS is app-specific password
- Check notification_settings table has recipients configured

### OAuth Not Working
- Verify Azure AD credentials in `.env`
- Check AZURE_AD_REDIRECT_URI matches Azure AD configuration
- Verify scopes: `user.read`, `mail.read`

---

## 📝 Notes

- All dates use ISO 8601 format (YYYY-MM-DD)
- Times use Asia/Bangkok timezone (configurable)
- All responses follow REST JSON format
- Error responses include `success: false` and `error` field
- Authorization uses Bearer token in Authorization header

