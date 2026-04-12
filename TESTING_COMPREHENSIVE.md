# HR SYSTEM COMPREHENSIVE TEST GUIDE

## Test Credentials
```
Admin Account:
Email: admin@tlogical.com
Password: Admin@123

Supervisor Account (kan@tlogical.com):
Email: kan@tlogical.com
Password: Password@123
```

## Test Scenarios

### PHASE 1: LOGIN & AUTHORIZATION

#### Test 1.1: Admin Login
1. Open http://localhost:5173
2. Click "Login with Email"
3. Enter: admin@tlogical.com / Admin@123
4. ✅ Should successfully login and see Admin dashboard

#### Test 1.2: Supervisor Login
1. Logout (if needed)
2. Click "Login with Email"
3. Enter: kan@tlogical.com / Password@123
4. ✅ Should successfully login and see Supervisor dashboard
5. ✅ Sidebar should show: Dashboard, Employees, Leave/Request, Leave/Approval, Reports, Profile

---

### PHASE 2: EMPLOYEE CREATION TESTS

#### Test 2.1: Create Employee as Admin
1. Login as admin@tlogical.com
2. Navigate to "Employees" page
3. Click "+" button to create new employee
4. Fill in form:
   - First Name: Test
   - Last Name: AdminCreated
   - Email: test.admin.created@example.com
   - Position: Developer
   - Department: Engineering
   - Status: Active
   - Role: Employee
   - Annual Leave: 15 days
5. Click "Create Employee"
6. ✅ Employee should be created successfully
7. ✅ Welcome email should be sent

#### Test 2.2: Create Employee as Supervisor
1. Logout and login as kan@tlogical.com (supervisor)
2. Navigate to "Employees" page
3. Click "+" button to create new employee  
4. Fill in form with different email (test.supervisor.created@example.com)
5. Click "Create Employee"
6. ✅ Employee should be created successfully (supervisor has permission)
7. ✅ Welcome email should be sent

#### Test 2.3: Try to Create as Non-Permission User
- If possible, try with a basic employee account
- ❌ Should fail with permission denied message

---

### PHASE 3: ROLE MANAGEMENT TESTS

#### Test 3.1: Change Role as Admin
1. Login as admin@tlogical.com
2. Navigate to "Employees" page
3. Find an employee to modify
4. Click the employee row to open details
5. Look for "Change Role" button or similar
6. Change role from Employee to Supervisor
7. ✅ Role should change successfully
8. ✅ User should see new menu items when logging back in with that account

#### Test 3.2: Try to Change Role as Supervisor
1. Login as kan@tlogical.com (supervisor)
2. Navigate to "Employees" page
3. Try to click "Change Role" on another employee
4. ❌ Should fail with "Permission Denied" or "Unauthorized" message
5. ✅ Only Admin and HR should be able to change roles

---

### PHASE 4: LEAVE REQUEST TESTS

#### Test 4.1: View Leave Balance as Supervisor
1. Login as kan@tlogical.com
2. Click "ขอลางาน" (Leave Request) in sidebar
3. ✅ Page should load (NOT show blank screen!)
4. ✅ Should see balance cards:
   - ลาพักร้อน (vacation)
   - ลาป่วย (sick leave)
   - ลากิจ (personal leave)
   - ลาอื่นๆ (other leave)
5. ✅ Each card should show quota and remaining days

#### Test 4.2: Create Leave Request
1. On Leave Request page, click "ยื่นคำขอลา" (Submit Leave Request)
2. Fill in:
   - Leave Type: ลาพักร้อน (Vacation)
   - Start Date: Pick a future date
   - End Date: Same or later date
   - Reason: "Test leave request"
3. Click "ยื่นคำขอ" (Submit)
4. ✅ Request should be created successfully
5. ✅ Toast message: "ยื่นคำขอลาสำเร็จ" (Leave request submitted successfully)

#### Test 4.3: View Created Leave Request
1. On Leave Request page, under "คำขอลาของฉัน" (My Leave Requests)
2. ✅ Should see the newly created request with:
   - Status: "รออนุมัติ" (Pending Approval)
   - Leave type icon and name
   - Date range
   - Days requested
3. Find the request in the list

#### Test 4.4: Cancel Leave Request
1. On the created leave request
2. Click "ยกเลิก" (Cancel) button
3. Confirm: "คุณแน่ใจหรือไม่ที่จะยกเลิกคำขอลานี้?" (Are you sure?)
4. Click "ใช่" (Yes)
5. ✅ Request status should change to "ยกเลิก" (Cancelled)
6. ✅ Toast message: "ยกเลิกคำขอลาสำเร็จ" (Successfully cancelled)

---

### PHASE 5: LEAVE APPROVAL TESTS

#### Test 5.1: View Leave Requests for Approval (Supervisor)
1. Login as kan@tlogical.com (supervisor)
2. Click "อนุมัติลา" (Leave Approval) in sidebar
3. ✅ Should see list of team members' leave requests
4. ✅ Should see pending requests waiting for approval

#### Test 5.2: Approve Leave Request
1. On Leave Approval page
2. Find a pending leave request
3. Click "Approve" button
4. ✅ Status should change to "อนุมัติ" (Approved)
5. ✅ Toast message: "ทำการอนุมัติสำเร็จ" (Approved successfully)

#### Test 5.3: Reject Leave Request  
1. Create another leave request as supervisor (if needed)
2. On Leave Approval page
3. Click "Reject" button on a request
4. Enter rejection reason (optional)
5. ✅ Status should change to "ไม่อนุมัติ" (Rejected)
6. ✅ Toast message: "ปฏิเสธสำเร็จ" (Rejected successfully)

---

### PHASE 6: SIDEBAR ROLE-BASED MENU TEST

#### Test 6.1: Login as Admin - Check Visible Menus
1. Login as admin@tlogical.com
2. Check sidebar shows:
   - ✅ Dashboard
   - ✅ Employees (with edit/create)
   - ✅ ขอลางาน (Leave Request)
   - ✅ อนุมัติลา (Leave Approval)  
   - ✅ Reports
   - ✅ Settings (Admin only)
   - ✅ Profile

#### Test 6.2: Login as Supervisor - Check Visible Menus
1. Logout and login as kan@tlogical.com
2. Check sidebar shows:
   - ✅ Dashboard
   - ✅ Employees (create/manage team)
   - ✅ ขอลางาน (Leave Request)
   - ✅ อนุมัติลา (Leave Approval)
   - ✅ Reports
   - ❌ Settings (should NOT show - admin only)
   - ✅ Profile

---

## Expected Results Summary

### ✅ All Tests Should Pass:

| Feature | Admin | Supervisor | Employee |
|---------|-------|-----------|----------|
| Login | ✅ | ✅ | ✅ |
| View Dashboard | ✅ | ✅ | ✅ |
| Create Employee | ✅ | ✅ | ❌ |
| Change Employee Role | ✅ | ❌ | ❌ |
| View Leave Balance | ✅ | ✅ | ✅ |
| Create Leave Request | ✅ | ✅ | ✅ |
| Cancel Leave Request | ✅ | ✅ | ✅ |
| Approve Leave | ✅ | ✅ | ❌ |
| Reject Leave | ✅ | ✅ | ❌ |
| Access Settings | ✅ | ❌ | ❌ |

---

## Issues to Watch For

1. **Blank Leave Request Page**: 
   - Should now be FIXED - page loads with balance cards
   - If still blank, check browser console for errors

2. **Permission Denied Errors**:
   - Admin/HR should always have access
   - Supervisor should have limited permissions
   - Regular employees most restricted

3. **Leave Request Not Canceling**:
   - New endpoint added: PUT /api/leave-requests/:id
   - Should accept `{status: 'cancelled'}`

4. **Password/Login Issues**:
   - Admin password set to: Admin@123
   - Supervisor password set to: Password@123
   - Check database with: `node check-passwords.mjs`

---

## Backend Endpoints Reference

All requests require `Authorization: Bearer {token}` header

### Auth
- POST /api/auth/login
- POST /api/auth/register
- POST /api/auth/forgot-password

### Employees  
- GET /api/employees
- POST /api/employees (requires: admin, hr, supervisor)
- PUT /api/employees/:id
- PUT /api/employees/:id/role (requires: admin, hr only)

### Leave Requests
- GET /api/leave-requests (authenticated)
- POST /api/leave-requests (authenticated)
- PUT /api/leave-requests/:id (cancel request - authenticated)
- PUT /api/leave-requests/:id/approve (requires: admin, hr, supervisor)
- PUT /api/leave-requests/:id/reject (requires: admin, hr, supervisor)

### Holidays
- GET /api/holidays

---

## Test Checklist

Use this to track your testing:

- [ ] Admin can login
- [ ] Supervisor can login
- [ ] Admin can create employee
- [ ] Supervisor can create employee
- [ ] Employee page loads without errors
- [ ] Leave Request page loads (no blank screen)
- [ ] Can view leave balance
- [ ] Can create leave request
- [ ] Can cancel leave request
- [ ] Can approve leave request
- [ ] Can reject leave request
- [ ] Sidebar shows correct menus per role
- [ ] Permission checks work correctly
- [ ] Email sends on employee creation
- [ ] UI is responsive and no console errors

---

## Troubleshooting

If tests fail, check:

1. **Backend running**: `curl http://localhost:3002/api/health`
2. **Frontend running**: Check http://localhost:5173
3. **Database connected**: `node check-tables.mjs` in backend directory
4. **Passwords work**: `node check-passwords.mjs`
5. **Server logs**: Check `/tmp/backend.log` for errors

