# HR System - Authentication Implementation Audit

**Audit Date:** April 1, 2026  
**System:** HR Management Platform  
**Status:** ✅ Comprehensive audit completed

---

## 📋 Executive Summary

The HR system has a **hybrid authentication system** supporting:
- ✅ Traditional email/password login
- ✅ Office365 OAuth (seamless SSO)
- ✅ Role-based access control (RBAC)
- ✅ Password reset flow
- ⚠️ Ready for enhanced Microsoft SSO integration

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React)                            │
├─────────────────────────────────────────────────────────────────┤
│  Auth.tsx                     │    AuthContext.tsx              │
│  ├── Login Form              │    ├── State Management          │
│  ├── Office365 Button        │    ├── JWT Decode & Validation   │
│  ├── Forgot Password         │    ├── Store token in localStorage
│  └── Theme Toggle            │    └── Role-based checks         │
└───────────────┬──────────────────────────────┬──────────────────┘
                │                              │
                │              ┌───────────────┴────────────┐
                │              │                            │
         ┌──────┴──────┐  ┌────┴─────────┐  ┌──────────────┴──────┐
         │ localStorage│  │   Supabase   │  │   API Endpoints     │
         │  (JWT)      │  │   (OAuth)    │  │  /api/auth/*       │
         └──────────────┘  └────┬─────────┘  └──────────────┬──────┘
                               │                             │
                ┌──────────────┴─────────────────────────────┘
                │
        ┌───────┴────────────────────────────────────────┐
        │     Backend API (Express.js)                   │
        ├────────────────────────────────────────────────┤
        │ Authentication Middleware                      │
        │ ├── JWT Verification (HS256)                   │
        │ ├── Bearer Token Extraction                    │
        │ └── User Extraction from JWT Payload           │
        │                                                 │
        │ Auth Endpoints                                 │
        │ ├── POST /api/auth/login                       │
        │ ├── POST /api/auth/office365-login             │
        │ ├── POST /api/auth/validate-office365-email    │
        │ ├── GET /api/auth/me                           │
        │ ├── POST /api/auth/change-password             │
        │ └── POST /api/auth/forgot-password             │
        └────────────────────┬────────────────────────────┘
                             │
        ┌────────────────────┴──────────────────────────┐
        │      PostgreSQL Database                      │
        ├───────────────────────────────────────────────┤
        │ user_auth (UUID, email, password_hash, role)  │
        │ user_roles (user_id, role)                    │
        │ employees (id, user_id, email, dept, pos...)  │
        │ password_reset_tokens (...)                   │
        └───────────────────────────────────────────────┘
```

---

## 📁 File Locations

### Backend Authentication Files

| File | Location | Purpose |
|------|----------|---------|
| **Main Auth Logic** | [backend/server.js](backend/server.js#L360-L1400) | All auth endpoints & middleware |
| **JWT Configuration** | [backend/server.js#L12](backend/server.js#L12) | `JWT_SECRET` env variable |
| **Password Utils** | [backend/server.js#L1328](backend/server.js#L1328) | `generateStrongPassword()` function |
| **DB Connection** | [backend/src/config/db-pool.js](backend/src/config/db-pool.js) | PostgreSQL connection pool |
| **Database Schema** | [init-db.sql](init-db.sql#L24-L41) | Initial schema creation |

### Frontend Authentication Files

| File | Location | Purpose |
|------|----------|---------|
| **Auth Context** | [frontend/src/contexts/AuthContext.tsx](frontend/src/contexts/AuthContext.tsx) | State management, JWT decode |
| **Login Page** | [frontend/src/pages/Auth.tsx](frontend/src/pages/Auth.tsx) | Login UI, dual-mode login |
| **Profile Page** | [frontend/src/pages/Profile.tsx#L135-L195](frontend/src/pages/Profile.tsx#L135-L195) | Change password endpoint |
| **API Config** | [frontend/src/config/api.ts](frontend/src/config/api.ts) | Base API URL |
| **Types** | [frontend/src/types/hr.ts](frontend/src/types/hr.ts) | AuthUser, AuthContext types |

### Configuration Files

| File | Purpose |
|------|---------|
| `.env` | JWT_SECRET, OFFICE365_SMTP_HOST, OFFICE365_EMAIL, etc. |
| [OFFICE365_SETUP.md](OFFICE365_SETUP.md) | Office365 OAuth setup instructions |
| [EMAIL_CONFIG_GUIDE.md](EMAIL_CONFIG_GUIDE.md) | Email/SMTP configuration |

---

## 🔐 Current Auth Flow

### 1️⃣ Traditional Login (Email + Password)

```
┌──────────────────────────────────────────────────────┐
│ User enters email + password in Auth.tsx             │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ signIn() calls POST /api/auth/login                  │
│ Body: { email, password }                            │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ Backend:                                             │
│ 1. Query user_auth table (case-insensitive email)   │
│ 2. bcrypt.compare(password, password_hash)          │
│ 3. Query user_roles table for roles                 │
│ 4. Query employees table for profile                │
│ 5. Generate JWT with { id, email, roles }           │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ Response: { token, user: { id, email, roles } }     │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ Frontend:                                            │
│ 1. Store token in localStorage                      │
│ 2. Decode JWT & extract roles                       │
│ 3. Update AuthContext state                         │
│ 4. Redirect to /dashboard                           │
└──────────────────────────────────────────────────────┘
```

### 2️⃣ Office365 OAuth (Seamless SSO)

```
┌──────────────────────────────────────────────────────┐
│ User clicks "Sign in with Office365"                 │
│ signInWithOAuth() initiates OAuth flow               │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ Supabase Azure Provider Redirect                     │
│ User authenticates with Microsoft credentials        │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ OAuth Callback → /auth/callback                      │
│ AuthContext detects: supabase.auth.onAuthStateChange │
│ Event: SIGNED_IN with session.user                   │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ POST /api/auth/validate-office365-email              │
│ Body: { email: session.user.email, oauthUserId }    │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ Backend Validation:                                  │
│ 1. Check employees table for email                   │
│ 2. Create/link user_auth record                      │
│ 3. Get roles from user_roles table                   │
│ 4. Generate JWT token                               │
│ 5. Return { token, user: {...} }                     │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ Frontend:                                            │
│ 1. Store JWT token in localStorage                  │
│ 2. Decode & update AuthContext                      │
│ 3. Dispatch 'oauth-login-success' event             │
│ 4. Auto-redirect to /dashboard                      │
└──────────────────────────────────────────────────────┘
```

### 3️⃣ Password Reset Flow

```
┌──────────────────────────────────────────────────────┐
│ User clicks "Forgot Password"                        │
│ Enters email in Auth.tsx                             │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ POST /api/auth/forgot-password                       │
│ Body: { email }                                      │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ Backend:                                             │
│ 1. Generate crypto random token (32 bytes)           │
│ 2. Hash token with SHA256                            │
│ 3. Store token_hash in password_reset_tokens         │
│    (expires_at = NOW() + 30 minutes)                 │
│ 4. Send email with reset link:                       │
│    /reset-password?token={rawToken}                  │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ User clicks email link → /reset-password page        │
│ Frontend extracts token from URL                     │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ POST /api/auth/reset-password                        │
│ Body: { token, newPassword }                         │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ Backend Validation:                                  │
│ 1. Hash token & look up in password_reset_tokens     │
│ 2. Verify not expired & not used_at                  │
│ 3. Hash new password with bcrypt                     │
│ 4. Update user_auth.password_hash                    │
│ 5. Mark token as used (used_at = NOW())              │
│ 6. Return success message                            │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ Frontend: Show success message                       │
│ User can login with new password                     │
└──────────────────────────────────────────────────────┘
```

---

## 🔑 Key Authentication Components

### JWT Token Structure

```javascript
// Header
{
  "alg": "HS256",
  "typ": "JWT"
}

// Payload
{
  "id": "550e8400-e29b-41d4-a716-446655440000",  // UUID from user_auth
  "email": "user@example.com",
  "roles": ["admin", "hr"],
  "iat": 1712059500,
  "exp": 1712664300  // 7 days
}

// Signature (HMAC SHA256)
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  JWT_SECRET
)
```

### Password Hashing

```javascript
// Input password → bcrypt hash (rounds: 10)
const password = "MyPassword123!";
const hash = await bcrypt.hash(password, 10);
// $2b$10$... (bcrypt format with salt embedded)

// Verification during login
const isValid = await bcrypt.compare(password, hash);
```

### Database Relationships

```sql
-- User authentication
user_auth
  ├── id (UUID, PK)
  ├── email (UNIQUE)
  ├── password_hash
  └── role (fallback)

-- Role assignments
user_roles (user_id FK → user_auth.id)
  ├── user_id (FK)
  └── role

-- Employee profile linking
employees (user_id FK → user_auth.id)
  ├── id (SERIAL, PK)
  ├── user_id (FK)
  ├── email (UNIQUE)
  ├── first_name, last_name
  ├── department_id
  └── position_id

-- Password reset
password_reset_tokens (user_id FK → user_auth.id)
  ├── id (BIGSERIAL, PK)
  ├── user_id (FK)
  ├── token_hash (SHA256 hashed)
  ├── expires_at (30 min TTL)
  └── used_at (single-use enforced)
```

---

## 🎯 Authentication Middleware Flow

### Request → authenticate() Middleware

```javascript
const authenticate = async (req, res, next) => {
  // 1. Extract Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Extract token
  const token = authHeader.split(' ')[1];
  
  // 3. Verify JWT signature and expiry
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;  // { id, email, roles }
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Usage in protected endpoints
app.get('/api/protected', authenticate, (req, res) => {
  const userId = req.user.id;      // From JWT
  const email = req.user.email;    // From JWT
  const roles = req.user.roles;    // From JWT
  // ...
});
```

---

## 💾 Database Schema

### user_auth Table

```sql
CREATE TABLE user_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'employee',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Purpose:** Stores authentication credentials
**Key Column:** `password_hash` = bcrypt-hashed password
**Fallback:** `role` column used when user_roles is empty

### password_reset_tokens Table

```sql
CREATE TABLE password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_auth(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Purpose:** One-time password reset tokens
**TTL:** 30 minutes (expires_at)
**Single-use:** Enforced via `used_at` check

### user_roles Table

```sql
CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES user_auth(id) ON DELETE CASCADE,
  role VARCHAR NOT NULL
);
```

**Purpose:** Maps users to roles (many-to-many)
**Valid Roles:** 'admin', 'hr', 'manager', 'employee', 'supervisor'

### employees Table (Auth Relevant Columns)

```sql
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES user_auth(id),
  email VARCHAR(100) UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  department_id INT REFERENCES departments(id),
  position_id INT REFERENCES positions(id),
  status VARCHAR(50) DEFAULT 'active',
  role VARCHAR(50) DEFAULT 'employee',
  -- ... other columns
);
```

**Linking:** `employees.user_id` → `user_auth.id`
**Email Match:** Used for Office365 OAuth validation

---

## 🔌 Current OAuth Integration

### Supabase Azure Configuration

**Provider:** Supabase (uses Azure AD as provider)
**Status:** ✅ Already configured
**Location:** [frontend/src/integrations/supabase/client.ts](frontend/src/integrations/supabase/client.ts)

```typescript
// OAuth initiated in AuthContext.tsx
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'azure',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    queryParams: { prompt: 'login' },
    scopes: 'openid profile email',
  },
});
```

**Flow:**
1. User clicks "Sign in with Office365"
2. Redirected to Supabase → Azure AD login
3. User authenticates with Microsoft credentials
4. Supabase returns auth session
5. Frontend calls `/api/auth/validate-office365-email`
6. Backend creates user_auth record if needed
7. JWT token generated and stored

---

## 🛡️ Security Implementation

### ✅ Implemented

| Feature | Details |
|---------|---------|
| **JWT Signing** | HS256 with JWT_SECRET from environment |
| **Token Expiry** | 7 days (604800 seconds) |
| **Password Hashing** | bcrypt with 10 rounds |
| **Email Normalization** | `.toLowerCase().trim()` before queries |
| **Token Single-use** | Password reset tokens marked as `used_at` |
| **Token TTL** | Password reset tokens expire after 30 minutes |
| **CORS** | Enabled for frontend origin |
| **Bearer Auth** | Required `Authorization: Bearer <token>` header |

### ⚠️ Recommendations

| Issue | Severity | Fix |
|-------|----------|-----|
| JWT_SECRET in code fallback | 🔴 Critical | Always use `.env` JWT_SECRET |
| Password minimum length (6 chars) | 🟡 Medium | Increase to 12+ chars |
| No rate limiting on login | 🟡 Medium | Add rate limiting middleware |
| No refresh token mechanism | 🟡 Medium | Implement refresh tokens for UX |
| localStorage token storage | 🟡 Medium | Consider HttpOnly cookies |
| No token revocation | 🟡 Medium | Add logout/revocation list |
| No brute-force protection | 🟡 Medium | Add attempt counter & lockout |

---

## 🔄 API Endpoints Detailed

### POST /api/auth/login

**Purpose:** Traditional email/password authentication
**Requires:** None (public endpoint)
**Body:**
```json
{
  "email": "user@example.com",
  "password": "MyPassword123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "roles": ["employee"],
    "employee": {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "department_name": "Engineering",
      "position_name": "Developer"
    }
  }
}
```

**Errors:**
- 400: `{ error: 'Email ต้องระบุ' }`
- 401: `{ error: 'รหัสผ่านหรืออีเมลไม่ถูกต้อง' }`
- 500: Server error

---

### POST /api/auth/office365-login

**Purpose:** Office365 email-only login (no password)
**Requires:** None
**Body:**
```json
{
  "email": "user@company.onmicrosoft.com"
}
```

**Response (200):** Same as `/api/auth/login`

**Errors:** 401 if email not in employees table

---

### POST /api/auth/validate-office365-email

**Purpose:** Seamless OAuth callback validation
**When Called:** After Azure AD authentication in OAuth flow
**Requires:** None (called from frontend after OAuth)
**Body:**
```json
{
  "email": "user@company.onmicrosoft.com",
  "oauthUserId": "supabase-user-id"
}
```

**Process:**
1. Validates email exists in employees table
2. Creates/links user_auth record
3. Loads user roles from user_roles table
4. Returns JWT token

---

### POST /api/auth/change-password

**Purpose:** Authenticated user changes their password
**Requires:** `Authorization: Bearer <token>` header
**Body:**
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword456"
}
```

**Validation:**
- Current password must match bcrypt hash
- New password minimum 6 characters
- New password hashed with bcrypt before storing

---

### GET /api/auth/me

**Purpose:** Get current authenticated user's profile
**Requires:** `Authorization: Bearer <token>` header
**Response (200):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "roles": ["employee", "manager"],
    "employee": { /* full employee record */ }
  }
}
```

**Errors:** 401 if token invalid or user missing

---

## 🎨 Frontend Auth State Management

### AuthContext State

```typescript
interface AuthUser {
  id: string;                    // user_auth.id (UUID)
  email: string;                 // user_auth.email
  roles: AppRole[];              // ['admin', 'hr', 'manager', 'employee']
  employee: Employee | null;     // Full employee record
  profile: Profile | null;       // Profile subset
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;          // JWT stored in localStorage
  roles: AppRole[];              // Copy of user.roles
  loading: boolean;              // Loading state
  
  signIn: (email, password) => Promise<void>;
  signUp: (email, password, firstName, lastName) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithOAuth: () => Promise<void>;
  signInWithOffice365: (email) => Promise<void>;
  
  hasRole: (role: AppRole) => boolean;
  isHROrAdmin: boolean;
  isManager: boolean;
}
```

### JWT Decoding

```typescript
function decodeJWT(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = JSON.parse(atob(parts[1]));
    return decoded;  // { id, email, roles, iat, exp }
  } catch (error) {
    return null;
  }
}
```

### Token Storage

```typescript
// Store on login
localStorage.setItem('token', data.token);

// Retrieve on app load
const token = localStorage.getItem('token');

// Clear on logout
localStorage.removeItem('token');
```

---

## 🚀 Microsoft SSO Integration Points

### Current Integration ✅

1. **Supabase Azure Provider**
   - Location: `frontend/src/contexts/AuthContext.tsx` line ~260
   - Scopes: `openid profile email`
   - Redirect: `/auth/callback`

2. **OAuth Email Validation**
   - Endpoint: `POST /api/auth/validate-office365-email`
   - Location: [backend/server.js#L1024](backend/server.js#L1024)
   - Creates user_auth record if needed
   - Links employee record

3. **Seamless OAuth Flow**
   - Frontend listens: `supabase.auth.onAuthStateChange()`
   - Detects: `SIGNED_IN` event
   - Calls: `/api/auth/validate-office365-email`
   - Auto-login without additional UI

### Integration Enhancement Opportunities

```typescript
// Current: Basic OAuth
✅ Email-based validation
✅ Auto user creation from employee record
✅ Role inheritance from system

// Recommended Enhancements
⬜ Profile picture from Azure AD
⬜ Department from Azure AD groups
⬜ Manager relationship from Azure AD
⬜ License/subscription tracking
⬜ MFA enforcement
⬜ Conditional access policies
⬜ Admin consent flow
⬜ Token refresh logic
⬜ Revocation on employee termination
```

---

## 💡 Quick Reference

### Environment Variables Required

```bash
JWT_SECRET=your-256-bit-secret-here
BACKEND_PORT=3002
FRONTEND_URL=http://localhost:5173
OFFICE365_SMTP_HOST=smtp.office365.com
OFFICE365_SMTP_PORT=587
OFFICE365_EMAIL=your-email@company.com
OFFICE365_PASSWORD=your-app-password
```

### Test Credentials Flow

```bash
# Traditional Login
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Get Current User
curl -X GET http://localhost:3002/api/auth/me \
  -H "Authorization: Bearer <JWT_TOKEN>"

# Change Password
curl -X POST http://localhost:3002/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{"currentPassword":"old","newPassword":"new"}'
```

### Common Error Codes

| Code | Message | Cause |
|------|---------|-------|
| 400 | `Email ต้องระบุ` | Missing email in request |
| 401 | `รหัสผ่านหรืออีเมลไม่ถูกต้อง` | Invalid credentials |
| 401 | `Unauthorized` | Missing Bearer token |
| 401 | `Invalid token` | JWT signature/expiry invalid |
| 404 | `ไม่พบข้อมูลผู้ใช้` | User not found in user_auth |
| 500 | `เกิดข้อผิดพลาด` | Server error |

---

## 📊 Auth Statistics

- **Files Modified:** 4 core auth files
- **Database Tables:** 4 tables for authentication
- **API Endpoints:** 9 authentication endpoints
- **Auth Methods:** 3 (password, Office365 OAuth, seamless SSO)
- **Token Expiry:** 7 days
- **Password Reset TTL:** 30 minutes
- **Security Algorithm:** HS256 (JWT), bcrypt (passwords)

---

## ✅ Recommendations for Next Steps

1. **Enhance Password Policy**
   - Minimum 12 characters
   - Require uppercase, lowercase, numbers, symbols
   - Historical password checking

2. **Add Rate Limiting**
   - 5 login attempts per 15 minutes
   - Progressive backoff
   - Captcha after failed attempts

3. **Implement Refresh Tokens**
   - Shorter access token lifetime (15 min)
   - Long refresh token lifetime (7 days)
   - Refresh endpoint for token rotation

4. **Secure Token Storage**
   - Migrate from localStorage to HttpOnly cookies
   - CSRF protection with SameSite

5. **Enhanced Logging**
   - Log all login attempts (success/failure)
   - IP tracking
   - Device fingerprinting

6. **MFA Support**
   - TOTP (Authenticator apps)
   - SMS or email verification
   - Backup codes

7. **Azure AD Advanced**
   - Conditional access
   - Device compliance
   - Admin consent for permissions
   - Application roles in Azure

---

**Document Version:** 1.0  
**Last Updated:** April 1, 2026  
**Next Review:** After Microsoft SSO implementation
