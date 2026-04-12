import positionService from '../services/positionService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

class PositionController {
  getAll = asyncHandler(async (req, res) => {
    const { limit = 100, offset = 0 } = req.query;

    const positions = await positionService.getAllPositions(
      parseInt(limit),
      parseInt(offset)
    );

    const total = await positionService.getPositionCount();

    res.json({
      success: true,
      data: positions,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  });

  getById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const position = await positionService.getPositionById(id);
    res.json({
      success: true,
      data: position
    });
  });

  create = asyncHandler(async (req, res) => {
    const { name, description, departmentId, department_id } = req.body;
    const resolvedDepartmentId = departmentId ?? department_id ?? null;

    if (!name) {
      return res.status(400).json({
        error: 'Name is required',
        code: 'MISSING_FIELDS'
      });
    }

    const position = await positionService.createPosition(name, description, resolvedDepartmentId);
    res.status(201).json({
      success: true,
      message: 'สร้างตำแหน่งสำเร็จ',
      data: position
    });
  });

  update = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updatePayload = {
      ...req.body,
      departmentId: req.body.departmentId ?? req.body.department_id ?? undefined,
    };

    const updated = await positionService.updatePosition(id, updatePayload);
    res.json({
      success: true,
      message: 'อัพเดตตำแหน่งสำเร็จ',
      data: updated
    });
  });

  delete = asyncHandler(async (req, res) => {
    const { id } = req.params;

    await positionService.deletePosition(id);
    res.json({
      success: true,
      message: 'ลบตำแหน่งสำเร็จ'
    });
  });
}

export default new PositionController();