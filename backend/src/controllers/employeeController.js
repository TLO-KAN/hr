import employeeService from '../services/employeeService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AVATAR_DIR = path.resolve(__dirname, '../../uploads/avatars');

class EmployeeController {
  getAll = asyncHandler(async (req, res) => {
    const { departmentId, status, search, limit = 100, offset = 0 } = req.query;
    const parsedLimit = Number.parseInt(String(limit), 10);
    const parsedOffset = Number.parseInt(String(offset), 10);
    const safeLimit = Number.isNaN(parsedLimit) ? 100 : parsedLimit;
    const safeOffset = Number.isNaN(parsedOffset) ? 0 : parsedOffset;

    const filters = {
      departmentId: departmentId ? String(departmentId) : undefined,
      status,
      search
    };

    const employees = await employeeService.getAllEmployees(
      filters,
      safeLimit,
      safeOffset
    );

    const total = await employeeService.getEmployeeCount();

    res.json({
      success: true,
      data: employees,
      pagination: {
        total,
        limit: safeLimit,
        offset: safeOffset,
        pages: Math.ceil(total / safeLimit)
      }
    });
  });

  getById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const employee = await employeeService.getEmployeeById(id);
    res.json({
      success: true,
      data: employee
    });
  });

  create = asyncHandler(async (req, res) => {
    const { email, first_name, last_name } = req.body;

    if (!email || !first_name || !last_name) {
      return res.status(400).json({
        error: 'Email, first_name, and last_name are required',
        code: 'MISSING_FIELDS'
      });
    }

    const employee = await employeeService.createEmployee(req.body);
    res.status(201).json({
      success: true,
      message: 'สร้างพนักงานสำเร็จ',
      data: employee
    });
  });

  update = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const updated = await employeeService.updateEmployee(id, req.body);
    res.json({
      success: true,
      message: 'อัพเดตพนักงานสำเร็จ',
      data: updated
    });
  });

  delete = asyncHandler(async (req, res) => {
    const { id } = req.params;

    await employeeService.deleteEmployee(id);
    res.json({
      success: true,
      message: 'ลบพนักงานสำเร็จ'
    });
  });

  uploadAvatar = asyncHandler(async (req, res) => {
    const avatarFile = req.file;

    if (!avatarFile) {
      return res.status(400).json({
        error: 'กรุณาเลือกไฟล์รูปภาพ',
        code: 'MISSING_FIELDS'
      });
    }

    const extension = avatarFile.mimetype.split('/')[1] || 'png';
    const safeExt = extension === 'jpeg' ? 'jpg' : extension;
    const fileName = `avatar-${req.user.id}-${Date.now()}.${safeExt}`;
    const filePath = path.join(AVATAR_DIR, fileName);

    await fs.mkdir(AVATAR_DIR, { recursive: true });
    await fs.writeFile(filePath, avatarFile.buffer);

    const avatarPath = `/uploads/avatars/${fileName}`;
    const avatarUrl = `${req.protocol}://${req.get('host')}${avatarPath}`;

    const result = await employeeService.updateAvatar(req.user.id, avatarUrl);
    res.json({
      success: true,
      message: 'อัปโหลดรูปโปรไฟล์สำเร็จ',
      data: result
    });
  });

  deleteAvatar = asyncHandler(async (req, res) => {
    const employee = await employeeService.getEmployeeByUserId(req.user.id);

    if (!employee) {
      return res.status(404).json({
        error: 'ไม่พบข้อมูลพนักงาน',
        code: 'NOT_FOUND'
      });
    }

    const currentAvatarUrl = employee.avatar_url;

    if (currentAvatarUrl) {
      try {
        const parsed = new URL(currentAvatarUrl);
        if (parsed.pathname.startsWith('/uploads/avatars/')) {
          const storedFilePath = path.resolve(__dirname, `../../${parsed.pathname.replace(/^\//, '')}`);
          await fs.unlink(storedFilePath).catch(() => {});
        }
      } catch {
        // Ignore invalid URL and continue clearing DB value.
      }
    }

    await employeeService.updateAvatar(req.user.id, null);

    res.json({
      success: true,
      message: 'ลบรูปโปรไฟล์สำเร็จ'
    });
  });

  resetPassword = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await employeeService.resetPassword(id);
    res.json({
      success: true,
      ...result
    });
  });

  sendWelcomeEmail = asyncHandler(async (req, res) => {
    const { email, first_name, last_name, password } = req.body;

    if (!email || !first_name || !last_name || !password) {
      return res.status(400).json({
        error: 'ข้อมูลไม่ครบสำหรับการส่งอีเมลต้อนรับ',
        code: 'MISSING_FIELDS',
      });
    }

    const result = await employeeService.sendWelcomeEmailManual(req.body);
    res.json({
      success: true,
      ...result,
    });
  });

  getMe = asyncHandler(async (req, res) => {
    const employee = await employeeService.getEmployeeByUserId(req.user.id);
    res.json({
      success: true,
      data: employee
    });
  });
}

export default new EmployeeController();