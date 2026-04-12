# 📧 Email Configuration - Centralized Setup

## ✅ ทำเสร็จแล้ว!

ผมได้สร้างไฟล์ config แบบ **centralized** เพื่อให้ easy to maintain:

```
supabase/functions/
├── config/
│   └── email-config.ts          ← ไฟล์ config ที่เดียว!
├── create-employee-user/
│   └── index.ts                 ← import from config
├── reset-user-password/
│   └── index.ts                 ← import from config
├── utils/
│   └── office365-email.ts       ← import from config
└── test-office365-smtp.ts       ← import from config
```

---

## 🎯 ข้อดี

### ❌ ก่อนหน้านี้ (ปัญหา)
```
credentials อยู่ใน 4 ไฟล์:
  - create-employee-user/index.ts
  - reset-user-password/index.ts
  - utils/office365-email.ts
  - test-office365-smtp.ts

⚠️ ต้องแก้ไข 4 ที่ เมื่อเปลี่ยน password
⚠️ ไม่ manual, ง่าย forget ไฟล์บางไฟล์
```

### ✅ ตอนนี้ (ดีกว่า)
```
credentials อยู่เพียง 1 ไฟล์:
  - config/email-config.ts

✅ แก้ 1 ที่เท่านั้น
✅ SPA (Single Point of Authority)
✅ ง่าย maintain
```

---

## 📝 File: Email Config

**ตำแหน่ง:** `supabase/functions/config/email-config.ts`

```typescript
export function getEmailConfig(): EmailConfig {
  return {
    smtpHost: Deno.env.get("OFFICE365_SMTP_HOST") || "smtp.office365.com",
    smtpPort: parseInt(Deno.env.get("OFFICE365_SMTP_PORT") || "587"),
    smtpUsername: Deno.env.get("OFFICE365_EMAIL") || "allsolution@tlogical.com",
    smtpPassword: Deno.env.get("OFFICE365_PASSWORD") || "RA28d8Jj",
    tlsEnabled: Deno.env.get("OFFICE365_TLS_ENABLED") !== "false",
    appUrl: Deno.env.get("APP_URL") || "http://localhost:5173",
  };
}
```

**Props:**
- `smtpHost` - SMTP server address
- `smtpPort` - SMTP port number
- `smtpUsername` - Email address for SMTP
- `smtpPassword` - Email password
- `tlsEnabled` - Use TLS encryption
- `appUrl` - App URL for email links

---

## 🔧 ขั้นตอนการแก้ไข Credentials

### ขั้นที่ 1: เปิดไฟล์ config

```bash
supabase/functions/config/email-config.ts
```

### ขั้นที่ 2: แก้ไข fallback values

```typescript
// ตำแหน่ง: บรรทัด 18-23
export function getEmailConfig(): EmailConfig {
  return {
    smtpHost: Deno.env.get("OFFICE365_SMTP_HOST") || "smtp.office365.com",  // ← ไม่ต้องแก้
    smtpPort: parseInt(Deno.env.get("OFFICE365_SMTP_PORT") || "587"),       // ← ไม่ต้องแก้
    smtpUsername: Deno.env.get("OFFICE365_EMAIL") || "allsolution@tlogical.com",  // ← แก้ที่นี่
    smtpPassword: Deno.env.get("OFFICE365_PASSWORD") || "RA28d8Jj",        // ← แก้ที่นี่
    // ...
  };
}
```

### ขั้นที่ 3: Deploy

```bash
supabase functions deploy create-employee-user
supabase functions deploy reset-user-password
```

---

## 📚 วิธีใช้ในไฟล์อื่น

### ก่อนหน้านี้ (Duplicated):
```typescript
// create-employee-user/index.ts
const smtpUsername = Deno.env.get("OFFICE365_EMAIL") || "allsolution@tlogical.com";
const smtpPassword = Deno.env.get("OFFICE365_PASSWORD") || "RA28d8Jj";

// reset-user-password/index.ts
const smtpUsername = Deno.env.get("OFFICE365_EMAIL") || "allsolution@tlogical.com";
const smtpPassword = Deno.env.get("OFFICE365_PASSWORD") || "RA28d8Jj";

// ❌ ซ้ำกัน!
```

### ตอนนี้ (Centralized):
```typescript
// create-employee-user/index.ts
import { getEmailConfig } from "../config/email-config.ts";

const config = getEmailConfig();
const client = new SMTPClient({
  connection: {
    hostname: config.smtpHost,
    port: config.smtpPort,
    tls: config.tlsEnabled,
    auth: {
      username: config.smtpUsername,
      password: config.smtpPassword,
    },
  },
});

// reset-user-password/index.ts
import { getEmailConfig } from "../config/email-config.ts";

const config = getEmailConfig();
// ... same usage

// ✅ Clean & DRY!
```

---

## 🔐 Environment Variables

Config อ่านจาก environment variables ก่อน แล้วจึง fallback:

```typescript
smtpUsername: Deno.env.get("OFFICE365_EMAIL") || "allsolution@tlogical.com"
             ^                                 ^
        environment variable              fallback value
```

### ไฟล์ที่อัปเดต:

| ไฟล์ | ก่อน | ตอนนี้ |
|------|------|--------|
| create-employee-user/index.ts | Deno.env.get() + hardcode | ✅ getEmailConfig() |
| reset-user-password/index.ts | Deno.env.get() + hardcode | ✅ getEmailConfig() |
| utils/office365-email.ts | Deno.env.get() + hardcode | ✅ getEmailConfig() |
| test-office365-smtp.ts | Deno.env.get() + hardcode | ✅ getEmailConfig() |
| **config/email-config.ts** | ❌ ไม่มี | ✅ **Created!** |

---

## 🚀 ขั้นตอนถัดไป

### 1. ตรวจสอบ Config File

```bash
cat supabase/functions/config/email-config.ts
```

### 2. ทดสอบ SMTP

```bash
deno run --allow-env --allow-net supabase/functions/test-office365-smtp.ts
```

### 3. Deploy Functions

```bash
supabase functions deploy create-employee-user
supabase functions deploy reset-user-password
```

### 4. ทดสอบระบบ

- สร้าง employee ใหม่ → ตรวจสอบเมล
- Reset password → ตรวจสอบเมล
- Office365 login

---

## 💡 เคล็ดลับ

### ⚡ ถ้าต้องเปลี่ยน credentials บ่อยๆ

ใช้ environment variables ใน Supabase Secrets:

```bash
# Set in Supabase
supabase secrets set OFFICE365_EMAIL=newemail@example.com
supabase secrets set OFFICE365_PASSWORD=newpass123

# Code จะอ่านจาก environment variables แล้วใช้
# ไม่ต้อง edit config file เลย
```

### 📝 แสดง Config สำหรับ Debug

```typescript
import { logEmailConfig } from "./config/email-config.ts";

// ที่ไหนสักแห่งใน function
logEmailConfig();  // จะพิมพ์ config values
```

Output:
```
📧 Email Configuration:
  SMTP Host: smtp.office365.com
  SMTP Port: 587
  Username: allsolution@tlogical.com
  TLS: Enabled
  App URL: http://localhost:5173
```

---

## ✅ Status

| Component | Status |
|-----------|--------|
| Config File | ✅ Created |
| create-employee-user | ✅ Updated |
| reset-user-password | ✅ Updated |
| office365-email.ts | ✅ Updated |
| test-office365-smtp | ✅ Updated |
| Centralized Creds | ✅ Yes |
| Easy to Maintain | ✅ Yes |

**Next:** Deploy and test! 🚀
