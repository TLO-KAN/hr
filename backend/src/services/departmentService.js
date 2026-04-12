import DepartmentRepository from '../repositories/DepartmentRepository.js';

class DepartmentService {
  async getAllDepartments(limit = 100, offset = 0) {
    return await DepartmentRepository.getAll(limit, offset);
  }

  async getDepartmentById(departmentId) {
    const department = await DepartmentRepository.findById(departmentId);
    if (!department) {
      const error = new Error('ไม่พบข้อมูลแผนก');
      error.statusCode = 404;
      throw error;
    }
    return department;
  }

  async createDepartment(name, description = null) {
    if (!name) {
      const error = new Error('ชื่อแผนกต้องระบุ');
      error.statusCode = 400;
      throw error;
    }

    // Check for duplicate department name
    const existing = await DepartmentRepository.findByName(name);
    if (existing) {
      const error = new Error('มีแผนกนี้อยู่แล้ว');
      error.statusCode = 409;
      throw error;
    }

    return await DepartmentRepository.create(name, description);
  }

  async updateDepartment(departmentId, data) {
    const department = await this.getDepartmentById(departmentId);
    
    const updated = await DepartmentRepository.update(departmentId, data);
    if (!updated) {
      const error = new Error('ไม่มีข้อมูลให้อัพเดต');
      error.statusCode = 400;
      throw error;
    }
    return updated;
  }

  async deleteDepartment(departmentId) {
    const department = await this.getDepartmentById(departmentId);
    
    return await DepartmentRepository.delete(departmentId);
  }

  async getDepartmentCount() {
    return await DepartmentRepository.count();
  }
}

export default new DepartmentService();