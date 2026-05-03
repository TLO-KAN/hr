import attendanceService from '../services/attendanceService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

const validateAttendancePayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return 'รูปแบบข้อมูลไม่ถูกต้อง';
  }

  if (!payload.employee_id) {
    return 'employee_id ห้ามเป็นค่าว่าง';
  }

  if (!payload.access_datetime) {
    return 'access_datetime ห้ามเป็นค่าว่าง';
  }

  if (payload.local_id !== undefined && payload.local_id !== null && !Number.isInteger(payload.local_id)) {
    return 'local_id ต้องเป็น Integer';
  }

  return null;
};

class AttendanceController {
  create = asyncHandler(async (req, res) => {
    const payload = req.body;

    if (Array.isArray(payload)) {
      if (payload.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Array ต้องมีอย่างน้อย 1 รายการ',
          code: 'INVALID_PAYLOAD',
        });
      }

      for (let i = 0; i < payload.length; i += 1) {
        const error = validateAttendancePayload(payload[i]);
        if (error) {
          return res.status(400).json({
            success: false,
            error: `${error} (รายการที่ ${i + 1})`,
            code: 'INVALID_PAYLOAD',
          });
        }
      }

      const rows = await attendanceService.createBulk(payload);
      return res.status(201).json({
        success: true,
        message: 'บันทึกข้อมูลเวลาเข้างานแบบหลายรายการสำเร็จ',
        data: rows,
        count: rows.length,
      });
    }

    const error = validateAttendancePayload(payload);
    if (error) {
      return res.status(400).json({
        success: false,
        error,
        code: 'INVALID_PAYLOAD',
      });
    }

    const row = await attendanceService.createOne(payload);
    return res.status(201).json({
      success: true,
      message: 'บันทึกข้อมูลเวลาเข้างานสำเร็จ',
      data: row,
    });
  });
}

export default new AttendanceController();
