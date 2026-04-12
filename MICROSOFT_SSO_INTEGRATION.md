# Microsoft SSO Integration Guide for HR System

**Date:** April 1, 2026  
**Prepared For:** Development Team  
**Status:** Ready for Implementation

---

## 🎯 Overview

The HR system already has **foundational Microsoft SSO support** through Supabase Azure OAuth provider. This guide outlines:
1. Current OAuth implementation status
2. How to validate and test the existing setup
3. Enhancement opportunities for production
4. Integration points with the current auth system

---

## ✅ Current Implementation Status

### What's Already Done

```javascript
// ✅ Frontend: OAuth configured in AuthContext.tsx (line ~260)
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'azure',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    queryParams: { prompt: 'login' },
    scopes: 'openid profile email',
  },
});

// ✅ Backend: Seamless validation endpoint at /api/auth/validate-office365-email
// Automatically creates user_auth record
// Validates email against employees table
// Assigns roles from user_roles table
// Returns JWT token for immediate access

// ✅ Frontend: OAuth state listener (AuthContext.tsx line ~130)
const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    // Call validation endpoint
    // Auto-login without additional UI
  }
});
```

### What's Working

| Component | Status | Details |
|-----------|--------|---------|
| **Supabase Setup** | ✅ | Azure AD provider configured |
| **OAuth Flow** | ✅ | Redirect to Microsoft login working |
| **Email Validation** | ✅ | Employees table lookup working |
| **User Auto-creation** | ✅ | Creates user_auth on first login |
| **Role Assignment** | ✅ | Pulls from user_roles table |
| **Token Generation** | ✅ | JWT token created with 7-day expiry |
| **Seamless Login** | ✅ | No manual UI needed after OAuth |

---

## 🔍 Testing Current Implementation

### 1. Verify Supabase Configuration

```bash
# Check Supabase environment variables are set
grep -E "SUPABASE_URL|SUPABASE_ANON_KEY" .env

# Expected output:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
```

### 2. Test Login Button

```typescript
// In Auth.tsx, verify the Office365 button works
<Button 
  onClick={async () => {
    await signInWithOAuth();  // Should redirect to Microsoft login
  }}
>
  Sign in with Office365
</Button>
```

**Expected Flow:**
1. Click button
2. Redirected to `login.microsoft.com`
3. User enters Microsoft credentials
4. Redirected back to `/auth/callback`
5. Auto-logged in to HR system

### 3. Verify Backend Validation

```bash
# Test email validation endpoint manually
curl -X POST http://localhost:3002/api/auth/validate-office365-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@company.onmicrosoft.com",
    "oauthUserId": "azure-user-id"
  }'

# Expected response:
{
  "token": "eyJhbGc...",
  "user": {
    "id": "550e8400-...",
    "email": "john.doe@company.onmicrosoft.com",
    "roles": ["employee"],
    "employee": { /* full employee record */ }
  }
}
```

### 4. Check Database Linking

```sql
-- Verify employee records have emails matching Office365
SELECT id, email, user_id, first_name, last_name
FROM employees
WHERE email LIKE '%@company.onmicrosoft.com%'
LIMIT 10;

-- Verify user_auth records created
SELECT id, email, role, created_at
FROM user_auth
WHERE email LIKE '%@company.onmicrosoft.com%'
LIMIT 10;

-- Verify user_roles assigned
SELECT u.email, 
       string_agg(r.role, ', ') as roles
FROM user_auth u
LEFT JOIN user_roles r ON u.id = r.user_id
GROUP BY u.id, u.email;
```

---

## 🔐 How Microsoft SSO Integrates with Current System

### Data Flow Diagram

```
Microsoft
 Login
   │
   ▼
┌─────────────────────────────────────┐
│ Supabase OAuth (Azure Provider)    │
│ - Handles Microsoft authentication  │
│ - Returns session with user email   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│ Frontend: supabase.auth.onAuthStateChange()        │
│ - Detects SIGNED_IN event                          │
│ - Extracts session.user.email                      │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│ Frontend: POST /api/auth/validate-office365-email   │
│ Body: { email, oauthUserId }                       │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│ Backend: Email Validation                           │
│                                                     │
│ 1. Query employees WHERE email = ?                 │
│    (must exist to grant access)                    │
│                                                     │
│ 2. Check/Create user_auth record                   │
│    - If new: INSERT with office365_oauth hash     │
│    - If exists: USE existing                      │
│                                                     │
│ 3. Query user_roles for email                      │
│    - Load all assigned roles                       │
│    - Fallback to user_auth.role if empty           │
│                                                     │
│ 4. Generate JWT with roles                         │
│    - Payload: { id, email, roles }                 │
│    - Signed: HS256 with JWT_SECRET                │
│    - Expiry: 7 days                               │
│                                                     │
│ 5. Return { token, user }                         │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│ Frontend: Receive JWT Token                         │
│                                                     │
│ 1. Store in localStorage('token')                 │
│ 2. Decode JWT payload                             │
│ 3. Extract roles array                            │
│ 4. Update AuthContext state                       │
│ 5. Dispatch 'oauth-login-success' event           │
│ 6. Auto-redirect to /dashboard                    │
└─────────────────────────────────────────────────────┘
```

### Key Integration Points

#### 1. Email-Based Auth Link

```typescript
// Microsoft OAuth provides email via session.user.email
const email = session.user.email;  // john.doe@company.onmicrosoft.com

// Matched against employees table
SELECT user_id FROM employees WHERE LOWER(email) = LOWER(?)

// This is the KEY LINK:
// Microsoft Account → Employee Record → user_auth record → JWT token
```

#### 2. Automatic User Creation

```javascript
// If user_auth doesn't exist, system creates it
try {
  const userAuthRes = await pool.query(
    `INSERT INTO user_auth (email, password_hash, role) 
     VALUES ($1, $2, $3) 
     RETURNING id, email, role`,
    [email, await bcrypt.hash('office365_oauth', 10), 'employee']
  );
  userId = userAuthRes.rows[0].id;
} catch (error) {
  if (error.code === '23505') {
    // Email already exists, use it
    const existing = await pool.query(
      'SELECT id FROM user_auth WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    userId = existing.rows[0].id;
  }
}
```

#### 3. Role Mapping

```javascript
// User roles are loaded from user_roles table
SELECT role FROM user_roles WHERE user_id = ?

// Result: ['admin', 'hr', 'manager'] etc.
// These determine access within HR system
// Independent of Microsoft account type

// Role assignment done by Admin in HR system UI
// Not pulled from Azure AD groups (future enhancement)
```

#### 4. JWT Token Creation

```javascript
const token = jwt.sign(
  { 
    id: userId,                    // UUID from user_auth
    email: normalizedEmail,         // Microsoft email
    roles: rolesArray              // From user_roles table
  },
  JWT_SECRET,
  { expiresIn: '7d' }
);

// Token used in all protected endpoints
// Verified by authenticate() middleware
// RE-extracted from localStorage on page load
```

---

## 🚀 Enhancing Microsoft SSO for Production

### Level 1: Current Implementation (Working)
- ✅ Email-based authentication
- ✅ Automatic user creation
- ✅ Role assignment from HR system
- ✅ Seamless login flow

### Level 2: Security Hardening (Recommended)

```typescript
// 1. Add MFA for Office365 accounts
const options = {
  redirectTo: `${window.location.origin}/auth/callback`,
  queryParams: {
    prompt: 'login',
    mfa_level: 'required'  // ← Add MFA enforcement
  },
  scopes: 'openid profile email'
};

// 2. Add tenant verification
// Ensure users only login from company tenant
const companyTenant = process.env.MICROSOFT_TENANT_ID;
// Validate: session.user.aud contains company tenant

// 3. Revoke tokens on employee termination
async function revokeUserTokens(userId) {
  await pool.query(
    'UPDATE user_auth SET revoked = TRUE WHERE id = ?',
    [userId]
  );
}

// 4. Log all OAuth login attempts
await pool.query(
  `INSERT INTO auth_logs (user_id, method, success, ip, timestamp)
   VALUES (?, ?, ?, ?, NOW())`,
  [userId, 'microsoft_oauth', true, req.ip]
);
```

### Level 3: Advanced Features

```typescript
// 1. Azure AD Groups Mapping
// Sync roles from Azure AD groups instead of manual assignment
async function syncRolesFromAzureGroups(userId, azureGroups) {
  const roleMapping = {
    'HR-Admins': 'admin',
    'HR-Team': 'hr',
    'Team-Leads': 'manager'
  };
  
  for (const group of azureGroups) {
    const role = roleMapping[group];
    if (role) {
      await assignRole(userId, role);
    }
  }
}

// 2. Profile Picture from Azure AD
// Get user's profile picture during OAuth
const profilePictureUrl = session.user.user_metadata?.picture;
await pool.query(
  'UPDATE employees SET avatar_url = ? WHERE user_id = ?',
  [profilePictureUrl, userId]
);

// 3. Department from Azure AD
// Sync employee's department from Azure AD organizational unit
const department = session.user.user_metadata?.department;
// Link to departments table

// 4. Manager Relationship from Azure AD
// Auto-set manager based on Azure AD hierarchy
const managerEmail = session.user.user_metadata?.manager;
// Lookup employee by email and set manager_id

// 5. License Tracking
// Track Microsoft 365 licenses assigned to user
// Disable HR access if license removed
const licenses = session.user.user_metadata?.licenses;
```

### Level 4: Enterprise Features

```typescript
// 1. Conditional Access
// Enforce access policies based on conditions
async function checkConditionalAccess(session) {
  // Deny from untrusted networks
  if (isVPN && !isCompanyNetwork) return false;
  
  // Deny from outdated devices
  if (deviceAge > 5 && !deviceCompliant) return false;
  
  // Require MFA for sensitive roles
  if (roles.includes('admin') && !hasMFA) return false;
  
  return true;
}

// 2. Device Compliance Check
// Verify device meets security requirements
const deviceCompliant = await checkDeviceCompliance(session.user.id);

// 3. Application Consent
// Request admin consent for organization-wide permissions
// Allow scopes like:
// - Mail.Read (read emails)
// - Calendar.Read (read calendar)
// - Files.Read.All (read shared files)
```

---

## 🔧 Implementation Checklist

### Phase 1: Validate Current Setup (Day 1)
- [ ] Verify Supabase credentials in .env
- [ ] Test Microsoft login button
- [ ] Confirm email validation working
- [ ] Check JWT tokens being generated
- [ ] Verify role assignment in user_roles table
- [ ] Test seamless auto-login

### Phase 2: Security Hardening (Week 1)
- [ ] Enable MFA for OAuth scopes
- [ ] Add tenant ID validation
- [ ] Implement auth logging
- [ ] Add token revocation on logout
- [ ] Set up rate limiting on login
- [ ] Add IP whitelisting for admin accounts

### Phase 3: Enhanced Integration (Week 2)
- [ ] Setup Azure AD groups mapping
- [ ] Implement profile picture sync
- [ ] Add department/manager sync
- [ ] Implement license tracking
- [ ] Add device compliance checks
- [ ] Create tenant verification middleware

### Phase 4: Enterprise Features (Week 3)
- [ ] Setup conditional access policies
- [ ] Implement application consent flow
- [ ] Add advanced scopes (Mail, Calendar, Files)
- [ ] Setup admin approval workflow
- [ ] Create feature flags for gradual rollout
- [ ] Add comprehensive audit logging

---

## 📝 Configuration Checklist

### Required Environment Variables

```bash
# Frontend (.env)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Backend (.env)
JWT_SECRET=your-256-bit-secret-here
MICROSOFT_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  # Optional

# Optional: Azure AD Advanced
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
AZURE_AD_SCOPE=openid profile email mail.read
```

### Supabase Configuration

```sql
-- In Supabase Auth settings, verify:
-- 1. Provider: Azure (OAuth)
-- 2. Client ID: Your Azure app registration
-- 3. Client Secret: From Azure app
-- 4. Tenant: common or your specific tenant
-- 5. Redirect URLs: http://localhost:5173/auth/callback, https://yourdomain.com/auth/callback
```

### Azure AD Application Registration

```
Register Application:
├── Name: HR System
├── Supported Account Types: Accounts in your organizational directory
├── Redirect URIs: 
│   ├── http://localhost:5173/auth/callback (development)
│   ├── https://yourdomain.com/auth/callback (production)
│   └── https://yourdomain.com/auth/callback/ (with trailing slash)
├── Certificates & Secrets:
│   └── Client Secret: Keep secure in .env
└── API Permissions:
    ├── OpenID Connect Permissions
    │   ├── openid
    │   ├── profile
    │   └── email
    └── Optional (for enhanced features)
        ├── Mail.Read
        ├── Calendar.Read
        └── Files.Read.All
```

---

## 🔒 Security Considerations

### Current Security Measures ✅

| Feature | Implementation | Status |
|---------|-----------------|--------|
| **Email Validation** | Must exist in employees table | ✅ |
| **Token Expiry** | 7 days with JWT exp claim | ✅ |
| **Password Hashing** | bcrypt 10 rounds for OAuth fallback | ✅ |
| **HTTPS** | Redirects in production required | ✅ |
| **CORS** | Configured for frontend origin | ✅ |
| **Bearer Auth** | Required for protected endpoints | ✅ |

### Recommended Security Enhancements ⚠️

| Feature | Benefit | Effort |
|---------|---------|--------|
| **Token Revocation List** | Logout/termination enforcement | Medium |
| **Shorter Token Lifetime** | Reduced exposure (15min access) | Low |
| **Refresh Token Rotation** | Automatic token renewal | Medium |
| **Device Fingerprinting** | Detect suspicious logins | Medium |
| **Audit Logging** | Track all auth events | Low |
| **IP Whitelisting** | Restrict admin access | Low |
| **Tenant Verification** | Confirm organization| Low |
| **MFA Enforcement** | Multi-factor authentication | Medium |

### Known Risks ⚠️

1. **localStorage Token Storage**
   - Risk: XSS attacks can steal token
   - Mitigation: Use HttpOnly cookies instead
   - Impact: Medium damage if compromised

2. **No Token Revocation**
   - Risk: Logged-out users can't access until token expires (7 days)
   - Mitigation: Implement revocation list
   - Impact: Low for most users, high for terminated employees

3. **Role Changes Not Immediate**
   - Risk: User keeps old roles until token refresh
   - Mitigation: Clear token on role change, use shorter expiry
   - Impact: Low risk, medium inconvenience

4. **No Rate Limiting**
   - Risk: Brute force attacks possible
   - Mitigation: Add rate limit middleware
   - Impact: Low if using Microsoft OAuth (they handle it)

5. **Password-less for OAuth Users**
   - Feature: Office365 users don't need password
   - Security: Relies entirely on Microsoft Auth
   - Impact: Good for security if properly configured

---

## 📊 Monitoring & Analytics

### Key Metrics to Track

```sql
-- Daily OAuth login count
SELECT 
  DATE(created_at) as date,
  COUNT(*) as oauth_logins,
  COUNT(DISTINCT user_id) as unique_users
FROM user_logins
WHERE method = 'microsoft_oauth'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Failed login attempts
SELECT 
  method,
  COUNT(*) as failures,
  MAX(error_message) as last_error
FROM auth_logs
WHERE success = FALSE
GROUP BY method
ORDER BY failures DESC;

-- Users by authentication method
SELECT 
  method,
  COUNT(DISTINCT user_id) as user_count,
  COUNT(*) as total_logins
FROM auth_logs
GROUP BY method;

-- Average session duration
SELECT 
  AVG(EXTRACT(EPOCH FROM (logout_time - login_time))) / 3600 as avg_hours
FROM user_sessions
WHERE logout_time IS NOT NULL;
```

### Alerts to Setup

```typescript
// Alert: Multiple failed logins from same user
if (failedAttempts > 5 && timeWindow < 15 * 60 * 1000) {
  await sendAlert('Suspicious login activity: ' + email);
  // Optionally: lockAccount(email)
}

// Alert: New login location
if (geoDistance(currentIP, lastLoginIP) > 1000) {
  await sendAlert('Login from new location: ' + location);
}

// Alert: Login outside business hours
if (hour < 6 || hour > 20) {
  await sendAlert('Off-hours login: ' + email);
}

// Alert: Terminated employee attempts login
if (employee.status === 'terminated' && loginAttempt) {
  await sendAlert('Terminated employee login attempt: ' + email);
}
```

---

## 👥 Support & Troubleshooting

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Email not found in system" | Employee email doesn't exist | Admin adds employee record with matching email |
| "Invalid token" | JWT signature mismatch | Verify JWT_SECRET matches |
| "Redirect URI mismatch" | URI not in Azure config | Add exact redirect URI to Azure app |
| "Tenant not configured" | Azure setup incomplete | Complete Azure AD app registration |
| "Can't decode JWT" | Malformed token | Check localStorage, refresh page |
| "User not found" | user_auth record missing | Check /api/auth/validate-office365-email |

### Debug Logging

```typescript
// Enable debug logs in AuthContext.tsx
// Look for these patterns in console:
// "[AuthContext]" - Frontend auth state
// "[Login]" - Traditional login attempt
// "[Office365 SSO]" - Seamless OAuth
// "[Office365 Login]" - Email-only login

// Backend logs (check server output):
// "user_auth not found" - User doesn't exist
// "invalid password" - Wrong password
// "Email validated" - OAuth success
// "Error occurred" - Server-side issue
```

---

## 📚 References

| Document | Location | Purpose |
|----------|----------|---------|
| **Auth Implementation** | [AUTHENTICATION_AUDIT.md](AUTHENTICATION_AUDIT.md) | Comprehensive audit |
| **Office365 Setup** | [OFFICE365_SETUP.md](OFFICE365_SETUP.md) | Initial setup guide |
| **Email Config** | [EMAIL_CONFIG_GUIDE.md](EMAIL_CONFIG_GUIDE.md) | SMTP configuration |
| **Backend Auth** | [backend/server.js#L1024](backend/server.js#L1024) | OAuth validation code |
| **Frontend Auth** | [frontend/src/contexts/AuthContext.tsx](frontend/src/contexts/AuthContext.tsx) | OAuth flow code |
| **Database Schema** | [init-db.sql](init-db.sql) | Auth tables schema |

---

## 🎓 Next Steps

1. **Review Current Status** - Run test scenarios above
2. **Implement Phase 1** - Validate configuration
3. **Plan Phase 2** - Security hardening roadmap
4. **Communicate with Users** - Inform about OAuth capability
5. **Monitor & Iterate** - Track adoption and issues

---

**Document Version:** 1.0  
**Status:** Ready for Review  
**Next Update:** After Phase 2 implementation
