# Azure AD OAuth Setup Guide

ระบบ HR นี้ใช้ **Azure AD (Azure Active Directory)** สำหรับการเข้าสู่ระบบแบบ Seamless SSO โดยไม่ผ่าน Supabase

## ขั้นตอนการตั้งค่า

### 1. สร้าง App Registration ใน Azure Portal

1. ไปที่ [Azure Portal](https://portal.azure.com/)
2. ไปที่ **Azure Active Directory** → **App registrations** → **New registration**
3. กรอก:
   - **Name**: `HR Management System` (หรือชื่อโปรแกรมของคุณ)
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: `Web` → `http://localhost:3002/api/auth/azure-oauth-callback`

4. คลิก **Register**

### 2. ดึง Client ID และ Tenant ID

หลังจาก Register แล้ว:
1. ไปที่ **Overview** ของ app registration
2. คัดลอก:
   - **Application (client) ID** → `AZURE_CLIENT_ID`
   - **Directory (tenant) ID** → `AZURE_TENANT_ID`

### 3. สร้าง Client Secret

1. ไปที่ **Certificates & secrets**
2. คลิก **New client secret**
3. กรอก:
   - **Description**: `HR System Secret` (optional)
   - **Expires**: `24 months` (แนะนำ)
4. คลิก **Add**
5. คัดลอก **Value** → `AZURE_CLIENT_SECRET`

> ⚠️ **สำคัญ**: Client Secret จะแสดงเพียงครั้งเดียว บันทึก/สำรองไว้อย่างปลอดภัย

### 4. เปิดใช้ API Permission

1. ไปที่ **API permissions**
2. ทำให้แน่ใจว่ามี permission:
   - `user.read` (default)
3. คลิก **Grant admin consent for [Organization]** (ถ้าต้องการ auto-sync)

### 5. อัปเดต `.env` ไฟล์

**Backend** (`/Applications/HR/backend/.env`):
```env
AZURE_TENANT_ID=<your_directory_tenant_id>
AZURE_CLIENT_ID=<your_application_client_id>
AZURE_CLIENT_SECRET=<your_client_secret>
AZURE_REDIRECT_URI=http://localhost:3002/api/auth/azure-oauth-callback
```

> สำหรับ **Production**:
> ```env
> AZURE_REDIRECT_URI=https://your-domain.com/api/auth/azure-oauth-callback
> ```

## Authentication Flow

```
1. User clicks "Sign in with Azure AD"
   ↓
2. Frontend calls `/api/auth/azure-oauth-start`
   ↓
3. Backend generates Azure OAuth URL and returns it
   ↓
4. Frontend redirects user to Azure AD login page
   ↓
5. User authenticates with Microsoft credentials
   ↓
6. Azure redirects back to `/api/auth/azure-oauth-callback?code=XXX&state=YYY`
   ↓
7. Frontend receives code and sends to backend `/api/auth/azure-oauth-callback`
   ↓
8. Backend exchanges code for access token
   ↓
9. Backend fetches user email from Microsoft Graph API
   ↓
10. Backend validates email exists in HR system
    ↓
11. Backend creates/links user_auth record
    ↓
12. Backend generates JWT token
    ↓
13. Frontend stores JWT and redirects to dashboard
```

## Endpoints

### GET `/api/auth/azure-oauth-start`
**Response:**
```json
{
  "authUrl": "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?..."
}
```

### POST `/api/auth/azure-oauth-callback`
**Request:**
```json
{
  "code": "authorization_code_from_azure",
  "state": "csrf_token"
}
```

**Response (Success):**
```json
{
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "email": "user@company.com",
    "roles": ["employee"],
    "employee": { /* full employee data */ }
  }
}
```

**Response (Error):**
```json
{
  "error": "อีเมล user@company.com ไม่มีสิทธิ์เข้าใช้งาน"
}
```

## Email Requirements

- User **must exist** in `employees` table
- Email must match `userPrincipalName` from Azure AD
- System will automatically create/link `user_auth` record

## Testing

### 1. Test on Local Machine
```bash
# Terminal 1 - Backend
cd /Applications/HR/backend
npm run dev

# Terminal 2 - Frontend
cd /Applications/HR/frontend
npm run dev
```

2. Open http://localhost:5173
3. Click "Sign in with Azure AD"
4. Use your company Microsoft credentials

### 2. Test with curl
```bash
# 1. Get auth URL
curl http://localhost:3002/api/auth/azure-oauth-start

# 2. After getting auth code from Azure, exchange for token
curl -X POST http://localhost:3002/api/auth/azure-oauth-callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "your_auth_code",
    "state": "your_state_token"
  }'
```

## Production Deployment

### Azure Portal Changes

1. **Add Redirect URI**:
   - Go to App Registration → Authentication
   - Add Redirect URI: `https://your-domain.com/api/auth/azure-oauth-callback`

2. **Update API Permissions**:
   - Ensure `User.Read` is granted with admin consent

3. **Certificate Rotation** (if using certificates instead of secret):
   - Plan to rotate every 6-12 months

### Environment Variables
Update in production server:
```env
AZURE_TENANT_ID=<production_tenant_id>
AZURE_CLIENT_ID=<production_client_id>
AZURE_CLIENT_SECRET=<production_secret>
AZURE_REDIRECT_URI=https://your-domain.com/api/auth/azure-oauth-callback
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "OAuth provider not configured" | Check `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` are set |
| "Invalid redirect URI" | Ensure redirect URI in Azure Portal matches backend `.env` |
| "Email not found" | User must exist in `employees` table with matching email |
| "Invalid state token" | State probably expired (valid for short time, not hours) |
| "Access denied" | Check API permissions in Azure Portal |

## Security Notes

✅ Do:
- Keep `AZURE_CLIENT_SECRET` in `.env` (never commit to git)
- Use HTTPS in production
- Validate email domain if needed

❌ Don't:
- Expose `AZURE_CLIENT_SECRET` in frontend code
- Use same redirect URI for multiple environments
- Share access tokens between services

## References

- [Azure AD Documentation](https://learn.microsoft.com/en-us/azure/active-directory/)
- [OAuth 2.0 Authorization Code Flow](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)
- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/overview)

---

**Last Updated**: April 1, 2026
**Status**: ✅ Supabase-free, Direct Azure AD Integration
