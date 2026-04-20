import EmployeeRepository from '../repositories/EmployeeRepository.js';
import UserRepository from '../repositories/UserRepository.js';
import { getPool } from '../config/db-pool.js';
import bcrypt from 'bcrypt';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../utils/emailService.js';
import LeaveCalculationService from './LeaveCalculationService.js';

const pool = getPool();

class EmployeeService {
  normalizeLeaveAdjustments(adjustments = {}) {
    const annual = Number(adjustments.annual ?? 0);
    const sick = Number(adjustments.sick ?? 0);
    const personal = Number(adjustments.personal ?? 0);

    return {
      annual: Number.isFinite(annual) ? annual : 0,
      sick: Number.isFinite(sick) ? sick : 0,
      personal: Number.isFinite(personal) ? personal : 0,
    };
  }

  async applyLeaveAdjustments(employeeId, adjustments = {}, year = new Date().getFullYear()) {
    const normalized = this.normalizeLeaveAdjustments(adjustments);
    const mapping = [
      { leaveType: 'annual', delta: normalized.annual },
      { leaveType: 'sick', delta: normalized.sick },
      { leaveType: 'personal', delta: normalized.personal },
    ];

    for (const item of mapping) {
      if (!item.delta) continue;

      const note = `manual-adjustment:${item.leaveType}:${item.delta}:by-${new Date().toISOString()}`;

      const updateResult = await pool.query(
        `UPDATE employee_leave_balances
         SET entitled_days = COALESCE(entitled_days, 0) + $1,
             remaining_days = GREATEST(COALESCE(remaining_days, 0) + $1, 0),
             total_entitlement = COALESCE(total_entitlement, COALESCE(entitled_days, 0)) + $1,
             notes = CASE
               WHEN notes IS NULL OR notes = '' THEN $2
               ELSE notes || E'\n' || $2
             END,
             updated_at = NOW()
         WHERE employee_id = $3 AND leave_type = $4 AND year = $5
         RETURNING id`,
        [item.delta, note, employeeId, item.leaveType, year]
      );

      if (updateResult.rowCount === 0) {
        await pool.query(
          `INSERT INTO employee_leave_balances
            (employee_id, leave_type, year, entitled_days, used_days, remaining_days, total_entitlement, notes)
           VALUES ($1, $2, $3, $4, 0, $4, $4, $5)`,
          [employeeId, item.leaveType, year, item.delta, note]
        );
      }
    }
  }

  async getAllEmployees(filters = {}, limit = 100, offset = 0) {
    return await EmployeeRepository.getAll(filters, limit, offset);
  }

  async getEmployeeById(employeeId) {
    const employee = await EmployeeRepository.findById(employeeId);
    if (!employee) {
      const error = new Error('ไม่พบข้อมูลพนักงาน');
      error.statusCode = 404;
      throw error;
    }
    return employee;
  }

  async getEmployeeByUserId(userId) {
    const employee = await EmployeeRepository.findByUserId(userId);
    if (!employee) {
      const error = new Error('ไม่พบข้อมูลพนักงาน');
      error.statusCode = 404;
      throw error;
    }
    return employee;
  }

  async createEmployee(data) {
    const { 
      email, 
      first_name, 
      last_name, 
      create_user_account, 
      password,
      role = 'employee',
      leave_adjustments,
      annual_leave_quota,
      sick_leave_quota,
      personal_leave_quota,
      manual_leave_override,
      leave_policy_mode,
      ...employeeData 
    } = data;

    // Check if employee email already exists
    const existingEmployee = await EmployeeRepository.findByEmail(email);
    if (existingEmployee) {
      // Check if leave balances exist - if not, this is a partially-created employee, complete setup
      const currentYear = new Date().getFullYear();
      const balanceCheck = await pool.query(
        `SELECT COUNT(*) as cnt FROM employee_leave_balances WHERE employee_id = $1 AND year = $2`,
        [existingEmployee.id, currentYear]
      );
      const hasBalances = parseInt(balanceCheck.rows[0]?.cnt || '0') > 0;

      if (hasBalances) {
        const error = new Error('โปรแกรมพนักงานนี้มีอยู่แล้ว');
        error.statusCode = 409;
        throw error;
      }

      // Employee exists but no leave balances - complete the setup
      console.log(`⚠️ Employee ${existingEmployee.id} exists but has no leave balances - completing setup`);
      await this.calculateLeaveBalances(
        existingEmployee.id,
        employeeData.employee_type || 'permanent',
        employeeData.start_date,
        manual_leave_override ? null : annual_leave_quota
      );
      if (leave_adjustments) {
        await this.applyLeaveAdjustments(existingEmployee.id, leave_adjustments);
      }
      return { ...existingEmployee, _resumed: true };
    }

    let userId = null;

    // Create user account if requested
    if (create_user_account && password && email) {
      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const userResult = await pool.query(
          'INSERT INTO user_auth (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
          [email, hashedPassword, role]
        );
        userId = userResult.rows[0].id;
        console.log(`✅ Created user_auth for ${email}`);
      } catch (error) {
        if (error.code === '23505') {
          const existingUser = await pool.query(
            'SELECT id FROM user_auth WHERE LOWER(email) = LOWER($1)',
            [email]
          );
          userId = existingUser.rows[0]?.id;
        } else {
          throw error;
        }
      }
    }

    const employee = await EmployeeRepository.create({
      userId,
      employeeCode: employeeData.employee_code,
      firstName: first_name,
      lastName: last_name,
      firstNameEn: employeeData.first_name_en,
      lastNameEn: employeeData.last_name_en,
      nickname: employeeData.nickname,
      email,
      phone: employeeData.phone,
      departmentId: employeeData.department_id,
      positionId: employeeData.position_id,
      startDate: employeeData.start_date,
      status: employeeData.status || 'active',
      employeeType: employeeData.employee_type || 'permanent',
      prefix: employeeData.prefix,
      probationEndDate: employeeData.probation_end_date,
    });

    // Always create leave balance rows (all 5 leave types) for the new employee
    // This ensures leave requests don't fail due to missing balance rows
    await this.calculateLeaveBalances(
      employee.id,
      employeeData.employee_type || 'permanent',
      employeeData.start_date,
      manual_leave_override ? null : annual_leave_quota
    );

    // If manual override, overwrite annual/sick/personal with HR-specified values
    if (manual_leave_override && annual_leave_quota != null) {
      const currentYear = new Date().getFullYear();
      const roundHalf = (v) => Math.floor(Number(v) * 2) / 2;
      const overrideTypes = [
        { type: 'annual', quota: roundHalf(annual_leave_quota) },
        { type: 'sick', quota: roundHalf(sick_leave_quota ?? 30) },
        { type: 'personal', quota: roundHalf(personal_leave_quota ?? 3) },
      ];
      for (const { type, quota } of overrideTypes) {
        const existingBalance = await pool.query(
          `SELECT id FROM employee_leave_balances WHERE employee_id = $1 AND leave_type = $2 AND year = $3`,
          [employee.id, type, currentYear]
        );
        if (existingBalance.rows.length > 0) {
          await pool.query(
            `UPDATE employee_leave_balances
             SET entitled_days = $1,
                 remaining_days = GREATEST($1 - COALESCE(used_days, 0), 0),
                 notes = 'manual-override',
                 updated_at = NOW()
             WHERE employee_id = $2 AND leave_type = $3 AND year = $4`,
            [quota, employee.id, type, currentYear]
          );
        } else {
          await pool.query(
            `INSERT INTO employee_leave_balances
              (employee_id, leave_type, year, entitled_days, used_days, remaining_days, notes)
             VALUES ($1, $2, $3, $4, 0, $4, 'manual-override')`,
            [employee.id, type, currentYear, quota]
          );
        }
      }
      console.log(`📊 Leave balances overridden manually for employee ${employee.id}`);
    }

    if (leave_adjustments) {
      await this.applyLeaveAdjustments(employee.id, leave_adjustments);
    }

    // Allow disabling welcome emails on employee creation without disabling account creation.
    const shouldSendWelcomeEmail = !['false', '0', 'no'].includes(
      String(process.env.SEND_WELCOME_EMAIL_ON_EMPLOYEE_CREATE || 'true').toLowerCase()
    );

    // Send welcome email
    if (shouldSendWelcomeEmail && create_user_account && email && password) {
      try {
        await sendWelcomeEmail({
          email,
          firstName: first_name,
          lastName: last_name,
          username: email,
          password,
          role,
          appUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
        });
      } catch (emailError) {
        console.warn('Failed to send welcome email:', emailError.message);
      }
    }

    return employee;
  }

  async updateEmployee(employeeId, data) {
    const { 
      leave_adjustments, 
      annual_leave_quota, 
      sick_leave_quota, 
      personal_leave_quota, 
      manual_leave_override,
      ...employeeData 
    } = data;
    
    // Include leave-related fields in the employee update
    const updateData = {
      ...employeeData,
      annual_leave_quota,
      manual_leave_override: manual_leave_override ?? false,
    };
    
    const updated = await EmployeeRepository.update(employeeId, updateData);
    if (!updated) {
      const error = new Error('ไม่มีข้อมูลให้อัพเดต');
      error.statusCode = 400;
      throw error;
    }

    // If manual override is set, upsert the leave balances for current year
    if (manual_leave_override && annual_leave_quota != null) {
      const currentYear = new Date().getFullYear();
      const roundHalf = (v) => Math.floor(Number(v) * 2) / 2;
      const leaveTypes = [
        { type: 'annual', quota: roundHalf(annual_leave_quota) },
        { type: 'sick', quota: roundHalf(sick_leave_quota ?? 30) },
        { type: 'personal', quota: roundHalf(personal_leave_quota ?? 3) },
      ];
      for (const { type, quota } of leaveTypes) {
        const updateResult = await pool.query(
          `UPDATE employee_leave_balances
           SET entitled_days = $1,
               remaining_days = GREATEST($1 - COALESCE(used_days, 0), 0),
               notes = 'manual-override',
               updated_at = NOW()
           WHERE employee_id = $2 AND leave_type = $3 AND year = $4
           RETURNING id`,
          [quota, employeeId, type, currentYear]
        );

        if (updateResult.rowCount === 0) {
          await pool.query(
            `INSERT INTO employee_leave_balances
              (employee_id, leave_type, year, entitled_days, used_days, remaining_days, notes)
             VALUES ($1, $2, $3, $4, 0, $4, 'manual-override')`,
            [employeeId, type, currentYear, quota]
          );
        }
      }
    }

    if (leave_adjustments) {
      await this.applyLeaveAdjustments(employeeId, leave_adjustments);
    }

    return updated;
  }

  async deleteEmployee(employeeId) {
    // All queries must run on the same client to avoid cross-connection deadlocks
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get user_id before deleting employee (FK will be set null after delete)
      const empRow = await client.query(
        'SELECT user_id FROM employees WHERE id = $1',
        [employeeId]
      );
      const userId = empRow.rows[0]?.user_id ?? null;

      // Delete FK-dependent rows first
      await client.query('DELETE FROM leave_requests WHERE employee_id = $1', [employeeId]);
      await client.query('DELETE FROM employee_leave_balances WHERE employee_id = $1', [employeeId]);

      // Delete the employee on the SAME client (not pool) so FK rows are seen as deleted
      const result = await client.query(
        'DELETE FROM employees WHERE id = $1 RETURNING id',
        [employeeId]
      );

      // Delete auth account (user_roles will cascade automatically)
      if (userId) {
        await client.query('DELETE FROM user_auth WHERE id = $1', [userId]);
      }

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async calculateLeaveBalances(employeeId, employeeType, startDate, overrideAnnualQuota = null) {
    const currentYear = new Date().getFullYear();
    await LeaveCalculationService.createLeaveBalancesForNewEmployee(employeeId, currentYear, 2);

    // If an override quota was supplied by HR, update just the annual leave for current year
    if (overrideAnnualQuota != null) {
      const roundHalf = (v) => Math.floor(Number(v) * 2) / 2;
      const quota = roundHalf(overrideAnnualQuota);
      await pool.query(
        `UPDATE employee_leave_balances
         SET entitled_days = $1,
             remaining_days = GREATEST($1 - COALESCE(used_days, 0), 0),
             notes = COALESCE(notes, '') || ' | hr-adjusted-quota',
             updated_at = NOW()
         WHERE employee_id = $2 AND leave_type = 'annual' AND year = $3`,
        [quota, employeeId, currentYear]
      );
    }

    console.log(`📊 Leave balances calculated via policy engine for employee ${employeeId}`);
  }

  async sendWelcomeEmailManual(data) {
    await sendWelcomeEmail({
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      username: data.username || data.email,
      password: data.password,
      role: data.role || 'employee',
      appUrl: data.app_url || process.env.FRONTEND_URL || 'http://localhost:5173',
    });

    return { message: 'ส่งอีเมลข้อมูลการเข้าสู่ระบบสำเร็จ' };
  }

  async updateAvatar(userId, avatarUrl) {
    const result = await pool.query(
      'UPDATE employees SET avatar_url = $1 WHERE user_id = $2 RETURNING *',
      [avatarUrl, userId]
    );
    if (result.rows.length === 0) {
      const error = new Error('ไม่พบข้อมูลพนักงาน');
      error.statusCode = 404;
      throw error;
    }
    return result.rows[0];
  }

  async resetPassword(employeeId) {
    const employee = await EmployeeRepository.findById(employeeId);
    if (!employee) {
      const error = new Error('ไม่พบพนักงาน');
      error.statusCode = 404;
      throw error;
    }

    if (!employee.user_id) {
      const error = new Error('ผู้ใช้ไม่มีบัญชีในระบบ');
      error.statusCode = 400;
      throw error;
    }

    const newPassword = this.generateStrongPassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE user_auth SET password_hash = $1 WHERE id = $2',
      [hashedPassword, employee.user_id]
    );

    // Send password reset email
    try {
      await sendPasswordResetEmail(employee.email, newPassword);
    } catch (error) {
      console.warn('Failed to send password reset email:', error.message);
    }

    return { 
      message: 'รีเซ็ตรหัสผ่านสำเร็จ',
      newPassword 
    };
  }

  generateStrongPassword() {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    const allChars = uppercase + lowercase + numbers + symbols;
    for (let i = 4; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  async getEmployeeCount() {
    return await EmployeeRepository.count();
  }
}

export default new EmployeeService();