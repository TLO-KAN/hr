import { getPool } from '../src/config/db-pool.js';
import leaveRequestService from '../src/services/leaveRequestService.js';

const pool = getPool();

function deriveFlowPattern(workflow) {
  if (workflow?.flow_pattern) return workflow.flow_pattern;
  if (workflow?.approval_levels === 0) return 'ceo';
  if (workflow?.approval_levels >= 2 && workflow?.requires_hr) return 'supervisor_hr_ceo';
  if (workflow?.approval_levels >= 2) return 'supervisor_ceo';
  if (workflow?.requires_hr) return 'supervisor_hr';
  return 'supervisor';
}

function flowPatternToRoles(flowPattern) {
  switch (flowPattern) {
    case 'supervisor_hr':
      return ['manager', 'supervisor', 'hr'];
    case 'supervisor_hr_ceo':
      return ['manager', 'supervisor', 'hr', 'ceo'];
    case 'supervisor_ceo':
      return ['manager', 'supervisor', 'ceo'];
    case 'ceo':
      return ['ceo'];
    case 'supervisor':
    default:
      return ['manager', 'supervisor'];
  }
}

function flowPatternToFirstStepRoles(flowPattern) {
  switch (flowPattern) {
    case 'ceo':
      return ['ceo'];
    case 'supervisor':
    case 'supervisor_hr':
    case 'supervisor_hr_ceo':
    case 'supervisor_ceo':
    default:
      return ['manager', 'supervisor'];
  }
}

function nextBusinessDate(daysAhead = 1) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysAhead);

  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }

  return date.toISOString().slice(0, 10);
}

async function getExpectedRolesForLeave(leaveType, totalDays) {
  const wf = await pool.query(
    `SELECT *
     FROM approval_workflows
     WHERE (leave_type = $1 OR leave_type = 'all')
       AND (min_days IS NULL OR min_days <= $2)
       AND (max_days IS NULL OR max_days >= $2)
     ORDER BY
       CASE WHEN leave_type = $1 THEN 0 ELSE 1 END,
       CASE WHEN min_days IS NULL THEN 1 ELSE 0 END,
       COALESCE(min_days, 0) DESC,
       updated_at DESC NULLS LAST,
       id DESC
     LIMIT 1`,
    [leaveType, totalDays]
  );

  const workflow = wf.rows[0] || null;
  const flowPattern = deriveFlowPattern(workflow);
  return {
    flowPattern,
    roles: flowPatternToRoles(flowPattern),
    firstStepRoles: flowPatternToFirstStepRoles(flowPattern),
  };
}

async function getNotificationsByLeaveId(leaveId) {
  const result = await pool.query(
    `SELECT n.id, n.user_id, n.title, n.message, n.type, ua.role
     FROM notifications n
     LEFT JOIN user_auth ua ON ua.id = n.user_id
     WHERE n.message LIKE $1
     ORDER BY n.created_at ASC`,
    [`%#${leaveId}%`]
  );

  return result.rows;
}

async function waitForNotifications(leaveId, predicate, timeoutMs = 12000, intervalMs = 400) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rows = await getNotificationsByLeaveId(leaveId);
    if (predicate(rows)) return rows;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return getNotificationsByLeaveId(leaveId);
}

async function pickEmployeeWithApprover(leaveType = 'unpaid', totalDays = 1) {
  const result = await pool.query(
    `SELECT id, user_id, first_name, last_name, department_id, department
     FROM employees
     WHERE user_id IS NOT NULL
     ORDER BY created_at ASC
     LIMIT 200`
  );

  if (result.rows.length === 0) {
    throw new Error('ไม่พบ employee ที่ผูก user_id สำหรับทดสอบ');
  }

  for (const employee of result.rows) {
    const resolved = await leaveRequestService.resolveApproverUserIds({
      departmentId: employee.department_id,
      department: employee.department,
      leaveType,
      totalDays,
      requesterUserId: employee.user_id,
    });

    if (resolved.approverUserIds.length > 0) {
      return employee;
    }
  }

  throw new Error('ไม่พบ employee ที่มี first-step approver ตาม workflow สำหรับการทดสอบ');
}

async function run() {
  const createdLeaveIds = [];
  try {
    const employee = await pickEmployeeWithApprover('unpaid', 1);
    const requestDate = nextBusinessDate(1);

    console.log('=== E2E In-App Notification Test ===');
    console.log('Employee:', employee.id, employee.first_name, employee.last_name);
    console.log('Request date:', requestDate);

    // 1) Submit + Reject flow
    const leaveReject = await leaveRequestService.createLeaveRequest({
      employee_id: employee.id,
      leave_type: 'unpaid',
      start_date: requestDate,
      end_date: requestDate,
      reason: '[E2E] submit->reject',
    });
    createdLeaveIds.push(leaveReject.id);

    const expectedSubmit1 = await getExpectedRolesForLeave(leaveReject.leave_type, leaveReject.total_days);
    const submitNotif1 = await waitForNotifications(
      leaveReject.id,
      (rows) => rows.some((n) => n.title === 'มีคำขอลาใหม่รออนุมัติ')
    );
    const submitRoles1 = submitNotif1
      .filter((n) => n.title === 'มีคำขอลาใหม่รออนุมัติ')
      .map((n) => n.role)
      .filter(Boolean);

    if (submitRoles1.length === 0) {
      throw new Error('Submit flow: ไม่พบ notification สำหรับผู้อนุมัติ');
    }

    const outOfWorkflowRole = submitRoles1.find((role) => !expectedSubmit1.firstStepRoles.includes(role));
    if (outOfWorkflowRole) {
      throw new Error(`Submit flow: พบผู้รับ role นอก workflow (${outOfWorkflowRole})`);
    }

    await leaveRequestService.rejectLeaveRequest(leaveReject.id, '[E2E] reject reason');
    const rejectNotif = await waitForNotifications(
      leaveReject.id,
      (rows) => rows.some((n) => n.user_id === employee.user_id && n.title === 'คำขอลาถูกปฏิเสธ')
    );
    const employeeRejectNotif = rejectNotif.find(
      (n) => n.user_id === employee.user_id && n.title === 'คำขอลาถูกปฏิเสธ'
    );

    if (!employeeRejectNotif) {
      throw new Error('Reject flow: ไม่พบ notification แจ้งพนักงาน');
    }

    // 2) Submit + Approve flow
    const leaveApprove = await leaveRequestService.createLeaveRequest({
      employee_id: employee.id,
      leave_type: 'unpaid',
      start_date: requestDate,
      end_date: requestDate,
      reason: '[E2E] submit->approve',
    });
    createdLeaveIds.push(leaveApprove.id);

    const submitNotif2 = await waitForNotifications(
      leaveApprove.id,
      (rows) => rows.some((n) => n.title === 'มีคำขอลาใหม่รออนุมัติ')
    );
    const approverUser = submitNotif2.find((n) => n.title === 'มีคำขอลาใหม่รออนุมัติ');
    if (!approverUser?.user_id) {
      throw new Error('Approve flow: ไม่พบ approver notification เพื่อใช้ทดสอบอนุมัติ');
    }

    await leaveRequestService.approveLeaveRequest(leaveApprove.id, approverUser.role || 'manager', approverUser.user_id);
    const approveNotif = await waitForNotifications(
      leaveApprove.id,
      (rows) => rows.some((n) => n.user_id === employee.user_id && n.title === 'คำขอลาได้รับการอนุมัติ')
    );
    const employeeApproveNotif = approveNotif.find(
      (n) => n.user_id === employee.user_id && n.title === 'คำขอลาได้รับการอนุมัติ'
    );

    if (!employeeApproveNotif) {
      throw new Error('Approve flow: ไม่พบ notification แจ้งพนักงาน');
    }

    // 3) Submit + Cancel flow
    const leaveCancel = await leaveRequestService.createLeaveRequest({
      employee_id: employee.id,
      leave_type: 'unpaid',
      start_date: requestDate,
      end_date: requestDate,
      reason: '[E2E] submit->cancel',
    });
    createdLeaveIds.push(leaveCancel.id);

    await leaveRequestService.cancelLeaveRequest(leaveCancel.id, '[E2E] cancel by employee');
    const cancelNotif = await waitForNotifications(
      leaveCancel.id,
      (rows) => rows.some((n) => n.title === 'มีการยกเลิกคำขอลา')
    );
    const cancelApproverNotif = cancelNotif.filter((n) => n.title === 'มีการยกเลิกคำขอลา');

    if (cancelApproverNotif.length === 0) {
      throw new Error('Cancel flow: ไม่พบ notification สำหรับผู้อนุมัติ');
    }

    const expectedSubmit3 = await getExpectedRolesForLeave(leaveCancel.leave_type, leaveCancel.total_days);
    const outOfWorkflowCancelRole = cancelApproverNotif
      .map((n) => n.role)
      .find((role) => role && !expectedSubmit3.firstStepRoles.includes(role));

    if (outOfWorkflowCancelRole) {
      throw new Error(`Cancel flow: พบผู้รับ role นอก workflow (${outOfWorkflowCancelRole})`);
    }

    console.log('\nPASS: submit/approve/reject/cancel notification flows are working.');
    console.log('Submit workflow roles:', expectedSubmit1.roles.join(', '));
    console.log('Submit first-step roles:', expectedSubmit1.firstStepRoles.join(', '));
    console.log('Submit recipients roles:', submitRoles1.join(', '));
    console.log('Approve employee notification: OK');
    console.log('Reject employee notification: OK');
    console.log('Cancel recipients count:', cancelApproverNotif.length);
  } catch (error) {
    console.error('\nFAIL:', error.message);
    process.exitCode = 1;
  } finally {
    if (createdLeaveIds.length > 0) {
      await pool.query(
        'DELETE FROM notifications WHERE message LIKE ANY($1::text[])',
        [createdLeaveIds.map((id) => `%#${id}%`)]
      );
      await pool.query(
        'DELETE FROM leave_requests WHERE id = ANY($1::uuid[])',
        [createdLeaveIds]
      );
    }

    await pool.end();
  }
}

run();
