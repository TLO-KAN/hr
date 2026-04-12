import PositionRepository from '../repositories/PositionRepository.js';
import DepartmentRepository from '../repositories/DepartmentRepository.js';

class PositionService {
  async getAllPositions(limit = 100, offset = 0) {
    return await PositionRepository.getAll(limit, offset);
  }

  async getPositionById(positionId) {
    const position = await PositionRepository.findById(positionId);
    if (!position) {
      const error = new Error('ไม่พบข้อมูลตำแหน่ง');
      error.statusCode = 404;
      throw error;
    }
    return position;
  }

  async createPosition(name, description = null, departmentId = null) {
    if (!name) {
      const error = new Error('ชื่อตำแหน่งต้องระบุ');
      error.statusCode = 400;
      throw error;
    }

    if (!departmentId) {
      const error = new Error('ต้องระบุแผนกสำหรับตำแหน่ง');
      error.statusCode = 400;
      throw error;
    }

    const dept = await DepartmentRepository.findById(departmentId);
    if (!dept) {
      const error = new Error('ไม่พบแผนกที่ระบุ');
      error.statusCode = 400;
      throw error;
    }

    return await PositionRepository.create(name, description, departmentId);
  }

  async updatePosition(positionId, data) {
    const position = await this.getPositionById(positionId);
    
    const updated = await PositionRepository.update(positionId, data);
    if (!updated) {
      const error = new Error('ไม่มีข้อมูลให้อัพเดต');
      error.statusCode = 400;
      throw error;
    }
    return updated;
  }

  async deletePosition(positionId) {
    const position = await this.getPositionById(positionId);
    
    return await PositionRepository.delete(positionId);
  }

  async getPositionCount() {
    return await PositionRepository.count();
  }
}

export default new PositionService();