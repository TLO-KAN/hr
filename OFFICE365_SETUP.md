# Office365 Integration Setup Guide

## 1. Set Environment Variables in Supabase

สำหรับให้ Edge Functions สามารถใช้ Office365 SMTP ได้ ต้องตั้งค่าตัวแปรในอุณหภูมิ:

### ขั้นตอน:
1. เข้า Supabase Dashboard
2. ไปที่ Project Settings
3. ไปที่ tabของ "Secrets / Environment"
4. เพิ่ม secrets ตามนี้:

```
OFFICE365_EMAIL = kanjung@tlogical.com
OFFICE365_PASSWORD = kanjung
APP_URL = https://your-domain.com (หรือ http://localhost:5173 สำหรับ local)
```

## 2. Deployed Functions That Use Office365

### ✅ create-employee-user
- **ไฟล์:** `/supabase/functions/create-employee-user/index.ts`
- **ใช้:** Office365 SMTP เพื่อส่งอีเมล welcome
- **Request body:**
```json
{
  "email": "employee@example.com",
  "firstName": "สมชาย",
  "lastName": "ใจดี",
  "employeeCode": "EMP001",
  "send_email": true
}
```

### ✅ reset-user-password
- **ไฟล์:** `/supabase/functions/reset-user-password/index.ts`
- **ใช้:** Office365 SMTP เพื่อส่งรหัสผ่านใหม่
- **Request body:**
```json
{
  "user_id": "uuid-of-user",
  "new_password": "NewPassword123!",
  "email": "user@example.com",
  "send_email": true
}
```

### ✅ update-user-role
- **ไฟล์:** `/supabase/functions/update-user-role/index.ts`
- **ใช้:** ไม่ส่งอีเมล เพียงแค่อัปเดต role

### ✅ create-admin-user
- **ไฟล์:** `/supabase/functions/create-admin-user/index.ts`
- **ใช้:** ไม่ส่งอีเมล เพียงแค่สร้าง admin account

## 3. Office365 SMTP Configuration

```
Server: smtp.office365.com
Port: 587
Encryption: TLS
Username: kanjung@tlogical.com
Password: kanjung
```

## 4. Testing Checklist

### Testing Office365 SMTP Email Sending
```bash
# 1. Deploy functions to Supabase
cd your-project
supabase functions deploy create-employee-user
supabase functions deploy reset-user-password

# 2. Create a test employee account (to trigger email)
# Use Employees page in app: Add New Employee → Check "ส่งอีเมล"

# 3. Check email inbox for welcome email
```

### Testing Office365 OAuth
```
1. Go to Auth page (หน้า login)
2. Click "เข้าสู่ระบบด้วย Office365"
3. Login with Office365 account
4. System should:
   - Check if email exists in employees table
   - If exists: Create/link account and redirect to dashboard
   - If not exists: Show error "อีเมล xxx ไม่มีในระบบ"
```

### Testing Email Validation in OAuth
```
1. Create an employee with email: test@example.com
2. Try to login with Office365 account: test@example.com
3. Should succeed and redirect to dashboard
4. Try login with unregistered email: unregistered@example.com
5. Should fail with error message
```

## 5. Common Issues & Solutions

### Issue: "Email sending failed" when creating employees
**Solution:** Check that OFFICE365_EMAIL and OFFICE365_PASSWORD secrets are set correctly in Supabase

### Issue: Office365 OAuth shows "Email not in system" error
**Solution:** The email used in Office365 must exist in the employees table first. Create the employee record before trying to login via Office365

### Issue: SMTP connection timeout
**Solution:** 
- Verify network allows outbound connection to smtp.office365.com:587
- Check that TLS is enabled (port 587, not 465)
- Verify credentials are correct (kanjung@tlogical.com / kanjung)

## 6. Helper Functions (Advanced)

If you want to send emails from other functions, use the utility functions in `/supabase/functions/utils/office365-email.ts`:

```typescript
import { sendOffice365Email, createWelcomeEmailTemplate } from "./utils/office365-email.ts";

// Send welcome email
const htmlContent = createWelcomeEmailTemplate(
  "สมชาย",
  "ใจดี", 
  "somchai@example.com",
  "Password123!",
  "https://hr-system.example.com"
);

await sendOffice365Email({
  to: "somchai@example.com",
  subject: "ยินดีต้อนรับ",
  html: htmlContent,
});
```

## 7. Deployment Steps

```bash
# 1. Ensure environment secrets are set (step 1 above)

# 2. Deploy all updated functions
supabase functions deploy create-employee-user
supabase functions deploy reset-user-password
supabase functions deploy update-user-role
supabase functions deploy create-admin-user

# 3. Build and deploy frontend
npm run build
# Deploy to your hosting (Vercel, Netlify, Docker, etc.)

# 4. Test the complete flow
```

## Notes

- 🔒 Keep Office365 credentials secure - never commit to git
- 📧 Office365 SMTP has rate limits - be mindful of bulk operations
- 🔑 Users created via create-employee-user are automatically added to employees table
- 👤 Office365 OAuth automatically validates email against employees table via validate-oauth-email function
