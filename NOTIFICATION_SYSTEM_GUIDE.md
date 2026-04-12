# 📧 Notification System Implementation Guide

## System Overview

The leave request notification system has **THREE components**:

1. **Email Notifications** - Auto-sent emails via Office365 SMTP
2. **In-App Notifications** - Bell icon (Supabase real-time)
3. **Email Logs** - Track all email sending attempts

---

## Component 1: Email Submission Trigger

### 🔔 When Leave is Submitted (Status = Pending)

**File:** `/Applications/HR/backend/leave-request-endpoints.js`  
**Function:** `app.post('/api/leave-requests')`

#### What Happens:

1. ✅ **Email sent** to configured recipients (To, CC, BCC)
   - Email uses notification_settings from LeaveSettings page
   - Dynamic tags replaced: `{manager_email}`, `{hr_email}`, `{dept_head_email}`
   - Fallback: if no setting for dept, use HR default email

2. ✅ **Email contains:**
   - Employee name, leave type, dates, reason
   - Action buttons: "อนุมัติ" and "ปฏิเสธ" with deep links
   - Professional HTML template

3. ✅ **In-app notification** sent to Manager/Approvers
   - Message: "คุณมีคำขอลาใหม่จาก {employee_name} รอการพิจารณา"
   - Bell icon shows red dot (unread count +1)

4. ✅ **Email logged** in `email_logs` table
   - Tracks: recipient_email, subject, send status, error message

---

## Component 2: Approval/Rejection Trigger

### 🟢 When Leave is APPROVED

**File:** `/Applications/HR/backend/server.js`  
**Endpoint:** `app.put('/api/leave-requests/:id/approve')`

#### What Happens:

1. ✅ **Email to Employee**
   - Status message: "✓ ใบลาของคุณได้รับการอนุมัติแล้ว"
   - Include leave details, approver name, effective date

2. ✅ **Email to CC list** (HR)
   - Notify HR for payroll/attendance records
   - Subject: "📌 ใบลาอนุมัติ: {employee_name}"

3. ✅ **In-app notification to Employee**
   - Message: "คำขอลา{leave_type}วันที่ {date} ของคุณได้รับการ [อนุมัติ]"
   - Green status indicator
   - Link to leave request details

---

### 🔴 When Leave is REJECTED

**File:** `/Applications/HR/backend/server.js`  
**Endpoint:** `app.put('/api/leave-requests/:id/reject')`

#### What Happens:

1. ✅ **Email to Employee** with rejection reason
   - Status message: "✗ ใบลาของคุณถูกปฏิเสธ"
   - **MUST include** rejection_reason in email and notification

2. ✅ **Email to CC list** (HR)
   - Subject: "📌 ใบลาปฏิเสธ: {employee_name}"
   - Reason: {rejection_reason}

3. ✅ **In-app notification to Employee**
   - Message: "คำขอลา{leave_type}วันที่ {date} ของคุณได้รับการ [ปฏิเสธ]"
   - Red status indicator
   - Show rejection reason

---

## Component 3: Supporting Features

### 📋 Email Logs Table

**Purpose:** Track all email sending attempts

```sql
SELECT * FROM email_logs WHERE leave_request_id = 123;
```

**Columns:**
- `id` - Log entry ID
- `recipient_email` - Who received it
- `subject` - Email subject
- `leave_request_id` - Which leave request
- `status` - 'sent', 'failed', 'error'
- `error_message` - If failed, why
- `sent_at` - Timestamp

### ⏰ 24-Hour Reminder (Optional Feature)

**Purpose:** If leave not approved after 24h, send reminder to approvers

**Implementation:** cron job that runs daily and:
1. Finds all pending leave requests older than 24h
2. Checks `email_reminders` table for duplicate prevention
3. Sends reminder email to same recipients
4. Records in `email_reminders` table

---

## Configuration: Notification Settings

### 📌 How to Configure Notifications

**Location:** Admin > "ตั้งค่าสิทธิ์การลา" > "การแจ้งเตือน" tab

#### Step 1: Set Up Department Rules

Create rules per department and leave_type:

- **Department**: Sales (or leave blank for all)
- **Leave Type**: ลาพักร้อน
- **To**: {manager_email}, manager@example.com
- **CC**: {hr_email}, hr@example.com
- **BCC**: (optional)

#### Step 2: Use Dynamic Tags

| Tag | Resolves To |
|-----|------------|
| `{manager_email}` | Employee's direct manager email |
| `{hr_email}` | HR representative email |
| `{dept_head_email}` | Department head email |

#### Step 3: Test Email

Click "Send Test Email" to verify settings work correctly

---

## Email Template structure

### HTML Email Template

Located in: `/Applications/HR/backend/email-notification-handler.js`

Features:
- Branded header with company colors
- Color-coded status (Orange=pending, Green=approved, Red=rejected)
- Employee info with all leave details
- Action buttons for approval/rejection
- Footer with HR contact

### Email Variables:

```javascript
{
  employeeName: "Rattikanl Kanjaima",
  leaveType: "ลาพักร้อน",
  startDate: "2026-04-06",
  endDate: "2026-04-10",
  reason: "หยุดพักแรม",
  managerName: "Somchai Surachai",
  approvalLink: "https://app.example.com/leave/approval"
}
```

---

## Troubleshooting

### ❌ Emails Not Sending

**Check:**
1. Email configuration in `.env`:
   - `OFFICE365_EMAIL` set?
   - `OFFICE365_PASSWORD` set?
   - `OFFICE365_SMTP_HOST` = `smtp.office365.com`?

2. Check `email_logs` table:
   ```sql
   SELECT * FROM email_logs 
   WHERE status != 'sent' 
   ORDER BY sent_at DESC LIMIT 10;
   ```

3. Test transporter:
   ```bash
   curl -X POST http://localhost:3002/api/test-email \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'
   ```

### ❌ Dynamic Tags Not Replaced

**Check:**
1. Manager is assigned to employee?
2. Tags in notification_settings are spelled correctly?
3. Try hardcoding email address to test settings work

### ❌ In-App Notifications Not Appearing

**Check:**
1. Supabase `notifications` table has RLS enabled for user?
2. User has subscription to `notifications` table?
3. Check browser console for JavaScript errors

---

## Database Schema

### email_logs Table
```sql
CREATE TABLE email_logs (
  id BIGSERIAL PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  leave_request_id INTEGER REFERENCES leave_requests(id),
  status VARCHAR(50) CHECK (status IN ('sent', 'failed', 'error')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### email_reminders Table (for follow-up)
```sql
CREATE TABLE email_reminders (
  id BIGSERIAL PRIMARY KEY,
  leave_request_id INTEGER REFERENCES leave_requests(id),
  reminder_type VARCHAR(50), -- 'submit_24h', 'submit_48h'
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(leave_request_id, reminder_type)
);
```

---

## Implementation Status

### ✅ Completed
- [ ] Email logs table created
- [ ] Email reminder table created
- [ ] Email handler with dynamic tag replacement
- [ ] Leave submission trigger (email + in-app)
- [ ] Email template with HTML formatting

### ⏳ In Progress
- [ ] Approval/rejection email triggers
- [ ] In-app notification creation
- [ ] 24h reminder cron job

### 📋 To Do
- [ ] Socket.io real-time bell updates (WebSocket)
- [ ] Email resend logic if first attempt fails
- [ ] Batch email sending optimization

---

## API Endpoints

### Test Email
```bash
POST /api/notification-settings/test-send/:dept_id/:leave_type
```

### Get Email Logs
```bash
GET /api/email-logs?leave_request_id=123
GET /api/email-logs?status=failed
GET /api/email-logs?days=7
```

### Get Notification Settings
```bash
GET /api/notification-settings
POST /api/notification-settings
PUT /api/notification-settings/:id
```

---

## Next Steps

1. **Restart backend** to apply email_logs table
2. **Test leave submission** to trigger email
3. **Check email_logs table** for send status
4. **Set up notification rules** in admin panel
5. **Test approval/rejection** to verify response emails

