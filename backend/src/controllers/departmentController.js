import departmentService from '../services/departmentService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

class DepartmentController {
  getAll = asyncHandler(async (req, res) => {
    const { limit = 100, offset = 0 } = req.query;

    const departments = await departmentService.getAllDepartments(
      parseInt(limit),
      parseInt(offset)
    );

    const total = await departmentService.getDepartmentCount();

    res.json({
      success: true,
      data: departments,
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

    const department = await departmentService.getDepartmentById(id);
    res.json({
      success: true,
      data: department
    });
  });

  create = asyncHandler(async (req, res) => {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Name is required',
        code: 'MISSING_FIELDS'
      });
    }

    const department = await departmentService.createDepartment(name, description);
    res.status(201).json({
      success: true,
      message: 'สร้างแผนกสำเร็จ',
      data: department
    });
  });

  update = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const updated = await departmentService.updateDepartment(id, req.body);
    res.json({
      success: true,
      message: 'อัพเดตแผนกสำเร็จ',
      data: updated
    });
  });

  delete = asyncHandler(async (req, res) => {
    const { id } = req.params;

    await departmentService.deleteDepartment(id);
    res.json({
      success: true,
      message: 'ลบแผนกสำเร็จ'
    });
  });
}

export default new DepartmentController();