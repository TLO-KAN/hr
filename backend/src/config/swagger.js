// Swagger / OpenAPI 3.0 specification
// ใช้งานผ่าน GET /api-docs

export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'HR Management System API',
    version: '1.0.0',
    description: `
## HR Management System — REST API Documentation

**Base URL:** \`/api/v1\`

### การ Authentication
ทุก endpoint (ยกเว้น login/register/forgot-password) ต้องส่ง JWT token ใน header:
\`\`\`
Authorization: Bearer <token>
\`\`\`

### Role ที่มีในระบบ
| Role | คำอธิบาย |
|------|----------|
| \`admin\` | ผู้ดูแลระบบ |
| \`ceo\` | ผู้บริหาร |
| \`hr\` | ฝ่ายบุคคล |
| \`manager\` | ผู้จัดการ |
| \`supervisor\` | หัวหน้างาน |
| \`employee\` | พนักงานทั่วไป |
    `,
    contact: {
      name: 'HR System Support',
    },
  },
  servers: [
    { url: '/api/v1', description: 'Production / Development (primary)' },
    { url: '/api', description: 'Compatibility prefix' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
        },
      },
      Employee: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          prefix: { type: 'string', example: 'นาย' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          department_id: { type: 'string', format: 'uuid' },
          position_id: { type: 'string', format: 'uuid' },
          department_name: { type: 'string' },
          position_name: { type: 'string' },
          employee_type: { type: 'string', enum: ['full_time', 'part_time', 'contract', 'probation'] },
          status: { type: 'string', enum: ['active', 'inactive', 'terminated', 'resigned', 'suspended'] },
          employment_status: { type: 'string' },
          start_date: { type: 'string', format: 'date' },
          avatar_url: { type: 'string' },
          annual_leave_quota: { type: 'number' },
        },
      },
      Department: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
        },
      },
      Position: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          department_id: { type: 'string', format: 'uuid' },
        },
      },
      LeaveRequest: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          employee_id: { type: 'string', format: 'uuid' },
          leave_type_id: { type: 'string', format: 'uuid' },
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' },
          days_requested: { type: 'number' },
          reason: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'cancelled'] },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      LeaveType: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          name_th: { type: 'string' },
          max_days_per_year: { type: 'number' },
          requires_approval: { type: 'boolean' },
          is_paid: { type: 'boolean' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          message: { type: 'string' },
          type: { type: 'string' },
          is_read: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    // ─────────────────────────────────────────────────────────
    // AUTH
    // ─────────────────────────────────────────────────────────
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'สมัครบัญชีใหม่',
        description: 'ใช้ใน: หน้า Register (ถ้าเปิดใช้)',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  fullName: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'สร้างบัญชีสำเร็จ' },
          409: { description: 'Email ซ้ำในระบบ' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'เข้าสู่ระบบ',
        description: 'ใช้ใน: หน้า Login (`/login`) — คืน JWT token สำหรับ request อื่นๆ\n\n**บล็อค:** พนักงานที่พ้นสภาพ (status: inactive/terminated/resigned/suspended) จะ login ไม่ได้',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@company.com' },
                  password: { type: 'string', example: 'Admin@1234' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Login สำเร็จ',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    user: { type: 'object' },
                  },
                },
              },
            },
          },
          401: { description: 'Email หรือ password ไม่ถูกต้อง' },
          403: { description: 'บัญชีถูกระงับการใช้งาน (พนักงานพ้นสภาพ)' },
        },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'ขอลิงก์รีเซ็ตรหัสผ่าน',
        description: 'ใช้ใน: หน้า Forgot Password — ส่ง email reset link',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: { 200: { description: 'ส่ง email สำเร็จ (หรือ email ไม่มีในระบบ ก็คืน 200 เพื่อความปลอดภัย)' } },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'รีเซ็ตรหัสผ่านด้วย token',
        description: 'ใช้ใน: หน้า Reset Password (จาก link ใน email)',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'newPassword'],
                properties: {
                  token: { type: 'string' },
                  newPassword: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'รีเซ็ตสำเร็จ' },
          400: { description: 'Token หมดอายุหรือใช้แล้ว' },
        },
      },
    },
    '/auth/change-password': {
      post: {
        tags: ['Auth'],
        summary: 'เปลี่ยนรหัสผ่าน (ต้อง login ก่อน)',
        description: 'ใช้ใน: หน้า Profile → ส่วนเปลี่ยนรหัสผ่าน',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  currentPassword: { type: 'string' },
                  newPassword: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'เปลี่ยนรหัสผ่านสำเร็จ' },
          401: { description: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'ดึงข้อมูลผู้ใช้ปัจจุบัน',
        description: 'ใช้ใน: ทุกหน้า — AuthContext โหลด user info ตอน app เริ่มต้น / refresh',
        responses: {
          200: {
            description: 'ข้อมูล user + employee ปัจจุบัน',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Employee' },
                    { type: 'object', properties: { role: { type: 'string' }, email: { type: 'string' } } },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/auth/permissions': {
      get: {
        tags: ['Auth'],
        summary: 'ดึง permissions ของ role ปัจจุบัน',
        description: 'ใช้ใน: Frontend ตรวจสิทธิ์การเข้าถึงเมนู/ฟีเจอร์',
        responses: { 200: { description: 'รายการ permissions' } },
      },
    },

    // ─────────────────────────────────────────────────────────
    // EMPLOYEES
    // ─────────────────────────────────────────────────────────
    '/employees': {
      get: {
        tags: ['Employees'],
        summary: 'ดึงรายชื่อพนักงานทั้งหมด',
        description: 'ใช้ใน: หน้า Employee List (`/employees`)',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'ค้นหาชื่อ/email' },
          { name: 'department', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: {
            description: 'รายชื่อพนักงาน',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Employee' } } } },
          },
        },
      },
      post: {
        tags: ['Employees'],
        summary: 'สร้างพนักงานใหม่',
        description: 'ใช้ใน: หน้า Add Employee — **Role ที่ใช้ได้:** admin, hr, ceo',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Employee' } },
          },
        },
        responses: {
          201: { description: 'สร้างพนักงานสำเร็จ' },
          403: { description: 'ไม่มีสิทธิ์' },
        },
      },
    },
    '/employees/me': {
      get: {
        tags: ['Employees'],
        summary: 'ดึงข้อมูลพนักงานของตัวเอง',
        description: 'ใช้ใน: หน้า Profile (`/profile`) — ดึงข้อมูลพนักงานที่ผูกกับ user ปัจจุบัน',
        responses: { 200: { description: 'ข้อมูลพนักงาน', content: { 'application/json': { schema: { $ref: '#/components/schemas/Employee' } } } } },
      },
    },
    '/employees/upload-avatar': {
      post: {
        tags: ['Employees'],
        summary: 'อัปโหลดรูปโปรไฟล์',
        description: 'ใช้ใน: หน้า Profile → ส่วนรูปโปรไฟล์ — รับ multipart/form-data ฟิลด์ชื่อ `avatar`',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { avatar: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'อัปโหลดสำเร็จ คืน avatar_url (relative path)' },
        },
      },
    },
    '/employees/delete-avatar': {
      post: {
        tags: ['Employees'],
        summary: 'ลบรูปโปรไฟล์',
        description: 'ใช้ใน: หน้า Profile → ปุ่มลบรูป',
        responses: { 200: { description: 'ลบรูปสำเร็จ' } },
      },
    },
    '/employees/send-welcome-email': {
      post: {
        tags: ['Employees'],
        summary: 'ส่ง welcome email ให้พนักงาน',
        description: 'ใช้ใน: หน้า Employee Detail — ปุ่ม "ส่ง email ยินดีต้อนรับ" — **Role:** admin, hr, ceo',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['employeeId'], properties: { employeeId: { type: 'string', format: 'uuid' } } },
            },
          },
        },
        responses: { 200: { description: 'ส่ง email สำเร็จ' } },
      },
    },
    '/employees/{id}': {
      get: {
        tags: ['Employees'],
        summary: 'ดึงข้อมูลพนักงานตาม ID',
        description: 'ใช้ใน: หน้า Employee Detail (`/employees/:id`)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'ข้อมูลพนักงาน', content: { 'application/json': { schema: { $ref: '#/components/schemas/Employee' } } } } },
      },
      put: {
        tags: ['Employees'],
        summary: 'แก้ไขข้อมูลพนักงาน',
        description: 'ใช้ใน: หน้า Edit Employee / Profile edit — **Role:** admin, hr, ceo (หรือ employee แก้ข้อมูลตัวเอง)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Employee' } } },
        },
        responses: { 200: { description: 'อัปเดตสำเร็จ' } },
      },
      delete: {
        tags: ['Employees'],
        summary: 'ลบพนักงาน',
        description: 'ใช้ใน: หน้า Employee List → ปุ่มลบ — **Role:** admin, ceo\n\n**หมายเหตุ:** ลบข้อมูลใน leave_requests, employee_leave_balances และ user_auth ไปด้วย',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'ลบสำเร็จ' }, 404: { description: 'ไม่พบพนักงาน' } },
      },
    },
    '/employees/{id}/reset-password': {
      post: {
        tags: ['Employees'],
        summary: 'รีเซ็ตรหัสผ่านพนักงาน (โดย HR/Admin)',
        description: 'ใช้ใน: หน้า Employee Detail — ปุ่ม "รีเซ็ตรหัสผ่าน" — **Role:** admin, hr, ceo',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['newPassword'], properties: { newPassword: { type: 'string', minLength: 8 } } },
            },
          },
        },
        responses: { 200: { description: 'รีเซ็ตสำเร็จ' } },
      },
    },

    // ─────────────────────────────────────────────────────────
    // DEPARTMENTS
    // ─────────────────────────────────────────────────────────
    '/departments': {
      get: {
        tags: ['Departments'],
        summary: 'ดึงรายการแผนกทั้งหมด',
        description: 'ใช้ใน: Dropdown เลือกแผนก (หน้า Add/Edit Employee, Filter)',
        responses: { 200: { description: 'รายการแผนก', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Department' } } } } } },
      },
      post: {
        tags: ['Departments'],
        summary: 'สร้างแผนกใหม่',
        description: 'ใช้ใน: หน้า Department Management — **Role:** admin, hr, ceo',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Department' } } } },
        responses: { 201: { description: 'สร้างสำเร็จ' } },
      },
    },
    '/departments/{id}': {
      get: {
        tags: ['Departments'],
        summary: 'ดึงข้อมูลแผนกตาม ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'ข้อมูลแผนก' } },
      },
      put: {
        tags: ['Departments'],
        summary: 'แก้ไขแผนก',
        description: '**Role:** admin, hr, ceo',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Department' } } } },
        responses: { 200: { description: 'อัปเดตสำเร็จ' } },
      },
      delete: {
        tags: ['Departments'],
        summary: 'ลบแผนก',
        description: '**Role:** admin, ceo',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'ลบสำเร็จ' } },
      },
    },

    // ─────────────────────────────────────────────────────────
    // POSITIONS
    // ─────────────────────────────────────────────────────────
    '/positions': {
      get: {
        tags: ['Positions'],
        summary: 'ดึงรายการตำแหน่งทั้งหมด',
        description: 'ใช้ใน: Dropdown เลือกตำแหน่ง (หน้า Add/Edit Employee)',
        parameters: [{ name: 'department_id', in: 'query', schema: { type: 'string' }, description: 'filter ตามแผนก' }],
        responses: { 200: { description: 'รายการตำแหน่ง', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Position' } } } } } },
      },
      post: {
        tags: ['Positions'],
        summary: 'สร้างตำแหน่งใหม่',
        description: '**Role:** admin, hr, ceo',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Position' } } } },
        responses: { 201: { description: 'สร้างสำเร็จ' } },
      },
    },
    '/positions/{id}': {
      get: { tags: ['Positions'], summary: 'ดึงตำแหน่งตาม ID', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'ข้อมูลตำแหน่ง' } } },
      put: { tags: ['Positions'], summary: 'แก้ไขตำแหน่ง', description: '**Role:** admin, hr, ceo', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Position' } } } }, responses: { 200: { description: 'อัปเดตสำเร็จ' } } },
      delete: { tags: ['Positions'], summary: 'ลบตำแหน่ง', description: '**Role:** admin, ceo', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'ลบสำเร็จ' } } },
    },

    // ─────────────────────────────────────────────────────────
    // LEAVE REQUESTS
    // ─────────────────────────────────────────────────────────
    '/leave-requests': {
      get: {
        tags: ['Leave Requests'],
        summary: 'ดึงคำขอลาทั้งหมด (สำหรับ HR/Manager)',
        description: 'ใช้ใน: หน้า Leave Management (`/leave-management`) — **Role:** admin, ceo, hr, manager, supervisor',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'approved', 'rejected', 'cancelled'] } },
          { name: 'employee_id', in: 'query', schema: { type: 'string' } },
          { name: 'start_date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'end_date', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'รายการคำขอลา', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/LeaveRequest' } } } } } },
      },
      post: {
        tags: ['Leave Requests'],
        summary: 'ยื่นคำขอลา',
        description: 'ใช้ใน: หน้า My Leave (`/my-leaves`) → ปุ่มยื่นคำขอลา — รองรับ multipart/form-data สำหรับ attachments',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['leave_type_id', 'start_date', 'end_date'],
                properties: {
                  leave_type_id: { type: 'string', format: 'uuid' },
                  start_date: { type: 'string', format: 'date' },
                  end_date: { type: 'string', format: 'date' },
                  reason: { type: 'string' },
                  attachments: { type: 'array', items: { type: 'string', format: 'binary' } },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'ยื่นคำขอสำเร็จ' }, 400: { description: 'วันลาไม่เพียงพอหรือข้อมูลไม่ครบ' } },
      },
    },
    '/leave-requests/my-requests': {
      get: {
        tags: ['Leave Requests'],
        summary: 'ดึงคำขอลาของตัวเอง',
        description: 'ใช้ใน: หน้า My Leave (`/my-leaves`) — แสดงประวัติคำขอลา',
        responses: { 200: { description: 'รายการคำขอลาของตัวเอง' } },
      },
    },
    '/leave-requests/bulk-approve': {
      post: {
        tags: ['Leave Requests'],
        summary: 'อนุมัติคำขอลาหลายรายการพร้อมกัน',
        description: '**Role:** admin, ceo, hr, manager, supervisor',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string', format: 'uuid' } } } } } } },
        responses: { 200: { description: 'อนุมัติสำเร็จ' } },
      },
    },
    '/leave-requests/bulk-reject': {
      post: {
        tags: ['Leave Requests'],
        summary: 'ปฏิเสธคำขอลาหลายรายการพร้อมกัน',
        description: '**Role:** admin, ceo, hr, manager, supervisor',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string', format: 'uuid' } }, reason: { type: 'string' } } } } } },
        responses: { 200: { description: 'ปฏิเสธสำเร็จ' } },
      },
    },
    '/leave-requests/{id}': {
      get: {
        tags: ['Leave Requests'],
        summary: 'ดึงรายละเอียดคำขอลา',
        description: 'ใช้ใน: หน้า Leave Detail',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'รายละเอียดคำขอลา' } },
      },
      put: {
        tags: ['Leave Requests'],
        summary: 'แก้ไขคำขอลา (เจ้าของคำขอ)',
        description: 'ใช้ใน: หน้า Edit Leave Request — รองรับ attachments',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'แก้ไขสำเร็จ' } },
      },
    },
    '/leave-requests/{id}/cancel': {
      post: {
        tags: ['Leave Requests'],
        summary: 'ยกเลิกคำขอลา',
        description: 'ใช้ใน: หน้า My Leave → ปุ่มยกเลิก',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'ยกเลิกสำเร็จ' } },
      },
    },
    '/leave-requests/{id}/approve': {
      post: {
        tags: ['Leave Requests'],
        summary: 'อนุมัติคำขอลา',
        description: '**Role:** admin, ceo, hr, manager, supervisor',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'อนุมัติสำเร็จ' } },
      },
    },
    '/leave-requests/{id}/reject': {
      post: {
        tags: ['Leave Requests'],
        summary: 'ปฏิเสธคำขอลา',
        description: '**Role:** admin, ceo, hr, manager, supervisor',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { reason: { type: 'string' } } } } } },
        responses: { 200: { description: 'ปฏิเสธสำเร็จ' } },
      },
    },
    '/leave-requests/{id}/attachments/{attachmentId}': {
      delete: {
        tags: ['Leave Requests'],
        summary: 'ลบ attachment จากคำขอลา',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'attachmentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'ลบสำเร็จ' } },
      },
    },

    // ─────────────────────────────────────────────────────────
    // LEAVE ENTITLEMENTS
    // ─────────────────────────────────────────────────────────
    '/leave-entitlements/my': {
      get: {
        tags: ['Leave Entitlements'],
        summary: 'ดึงสิทธิ์ลาของตัวเอง',
        description: 'ใช้ใน: หน้า My Leave → แสดงวันลาคงเหลือแต่ละประเภท',
        responses: { 200: { description: 'สิทธิ์ลาปีปัจจุบัน' } },
      },
    },
    '/leave-entitlements/employee/{employeeId}': {
      get: {
        tags: ['Leave Entitlements'],
        summary: 'ดึงสิทธิ์ลาของพนักงานตาม ID',
        description: 'ใช้ใน: หน้า Employee Detail → แท็บสิทธิ์ลา / Leave Management',
        parameters: [{ name: 'employeeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'สิทธิ์ลาของพนักงาน' } },
      },
    },
    '/leave-entitlements': {
      get: {
        tags: ['Leave Entitlements'],
        summary: 'ดึงสิทธิ์ลาทั้งหมด (HR)',
        description: '**Role:** admin, ceo, hr',
        responses: { 200: { description: 'สิทธิ์ลาทั้งหมด' } },
      },
      post: {
        tags: ['Leave Entitlements'],
        summary: 'สร้าง/ปรับสิทธิ์ลาพนักงาน',
        description: '**Role:** admin, ceo, hr',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['employee_id', 'leave_type_id', 'year', 'entitled_days'],
                properties: {
                  employee_id: { type: 'string', format: 'uuid' },
                  leave_type_id: { type: 'string', format: 'uuid' },
                  year: { type: 'integer' },
                  entitled_days: { type: 'number' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'สร้างสำเร็จ' } },
      },
    },
    '/leave-entitlements/{id}': {
      put: {
        tags: ['Leave Entitlements'],
        summary: 'แก้ไขสิทธิ์ลา',
        description: '**Role:** admin, ceo, hr',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { entitled_days: { type: 'number' } } } } } },
        responses: { 200: { description: 'อัปเดตสำเร็จ' } },
      },
    },

    // ─────────────────────────────────────────────────────────
    // LEAVE TYPES
    // ─────────────────────────────────────────────────────────
    '/leave-types': {
      get: {
        tags: ['Leave Types'],
        summary: 'ดึงประเภทการลาทั้งหมด',
        description: 'ใช้ใน: Dropdown ประเภทลา (หน้ายื่นคำขอลา)',
        responses: { 200: { description: 'รายการประเภทลา', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/LeaveType' } } } } } },
      },
      post: { tags: ['Leave Types'], summary: 'สร้างประเภทลาใหม่', description: '**Role:** admin, ceo', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LeaveType' } } } }, responses: { 201: { description: 'สร้างสำเร็จ' } } },
    },
    '/leave-types/{id}': {
      get: { tags: ['Leave Types'], summary: 'ดึงประเภทลาตาม ID', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'ข้อมูลประเภทลา' } } },
      put: { tags: ['Leave Types'], summary: 'แก้ไขประเภทลา', description: '**Role:** admin, ceo', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'อัปเดตสำเร็จ' } } },
      delete: { tags: ['Leave Types'], summary: 'ลบประเภทลา', description: '**Role:** admin, ceo', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'ลบสำเร็จ' } } },
    },

    // ─────────────────────────────────────────────────────────
    // LEAVE POLICIES
    // ─────────────────────────────────────────────────────────
    '/leave-policies': {
      get: { tags: ['Leave Policies'], summary: 'ดึง Policy การลาทั้งหมด', description: 'ใช้ใน: หน้า Leave Policy Settings', responses: { 200: { description: 'รายการ policy' } } },
      post: { tags: ['Leave Policies'], summary: 'สร้าง Policy ใหม่', description: '**Role:** admin, ceo', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 201: { description: 'สร้างสำเร็จ' } } },
    },
    '/leave-policies/{id}': {
      get: { tags: ['Leave Policies'], summary: 'ดึง policy ตาม ID', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'ข้อมูล policy' } } },
      put: { tags: ['Leave Policies'], summary: 'แก้ไข policy', description: '**Role:** admin, ceo', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'อัปเดตสำเร็จ' } } },
      delete: { tags: ['Leave Policies'], summary: 'ลบ policy', description: '**Role:** admin, ceo', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'ลบสำเร็จ' } } },
    },

    // ─────────────────────────────────────────────────────────
    // LEAVE CALCULATION
    // ─────────────────────────────────────────────────────────
    '/leave-calculation/prorate-preview': {
      get: {
        tags: ['Leave Calculation'],
        summary: 'Preview การคำนวณสิทธิ์ลาแบบ Prorate',
        description: '**Role:** admin, hr, ceo',
        parameters: [
          { name: 'employee_type', in: 'query', schema: { type: 'string' } },
          { name: 'start_date', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'ผลการคำนวณ prorate' } },
      },
    },
    '/leave-calculation/employee/{employeeId}/summary': {
      get: {
        tags: ['Leave Calculation'],
        summary: 'สรุปสิทธิ์ลาของพนักงาน',
        description: 'ใช้ใน: หน้า Employee Detail → แท็บสิทธิ์ลา',
        parameters: [{ name: 'employeeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'สรุปสิทธิ์ลา' } },
      },
    },
    '/leave-calculation/employee/{employeeId}/history': {
      get: {
        tags: ['Leave Calculation'],
        summary: 'ประวัติการคำนวณสิทธิ์ลา',
        description: '**Role:** admin, hr, ceo',
        parameters: [{ name: 'employeeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'ประวัติการคำนวณ' } },
      },
    },
    '/leave-calculation/years-of-service/{employeeId}': {
      get: {
        tags: ['Leave Calculation'],
        summary: 'คำนวณอายุงาน',
        parameters: [{ name: 'employeeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'จำนวนปีที่ทำงาน' } },
      },
    },
    '/leave-calculation/create-balances': {
      post: {
        tags: ['Leave Calculation'],
        summary: 'สร้าง leave balances ให้พนักงาน',
        description: '**Role:** admin, hr, ceo',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { employee_id: { type: 'string', format: 'uuid' }, year: { type: 'integer' } } } } } },
        responses: { 200: { description: 'สร้างสำเร็จ' } },
      },
    },
    '/leave-calculation/update-yearly-quotas': {
      post: {
        tags: ['Leave Calculation'],
        summary: 'อัปเดต quota วันลาประจำปีทุกคน',
        description: '**Role:** admin, ceo',
        responses: { 200: { description: 'อัปเดตสำเร็จ' } },
      },
    },

    // ─────────────────────────────────────────────────────────
    // HOLIDAYS
    // ─────────────────────────────────────────────────────────
    '/holidays': {
      get: {
        tags: ['Holidays'],
        summary: 'ดึงรายการวันหยุดนักขัตฤกษ์',
        description: 'ใช้ใน: Calendar ในหน้ายื่นคำขอลา',
        parameters: [{ name: 'year', in: 'query', schema: { type: 'integer' } }],
        responses: { 200: { description: 'รายการวันหยุด' } },
      },
      post: { tags: ['Holidays'], summary: 'เพิ่มวันหยุด', description: '**Role:** admin, hr, ceo', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'date'], properties: { name: { type: 'string' }, date: { type: 'string', format: 'date' } } } } } }, responses: { 201: { description: 'สร้างสำเร็จ' } } },
    },
    '/holidays/{id}': {
      get: { tags: ['Holidays'], summary: 'ดึงวันหยุดตาม ID', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'ข้อมูลวันหยุด' } } },
      put: { tags: ['Holidays'], summary: 'แก้ไขวันหยุด', description: '**Role:** admin, hr, ceo', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'อัปเดตสำเร็จ' } } },
      delete: { tags: ['Holidays'], summary: 'ลบวันหยุด', description: '**Role:** admin, hr, ceo', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'ลบสำเร็จ' } } },
    },

    // ─────────────────────────────────────────────────────────
    // NOTIFICATIONS
    // ─────────────────────────────────────────────────────────
    '/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'ดึง notification ของตัวเอง',
        description: 'ใช้ใน: bell icon ใน header — แสดงจำนวนที่ยังไม่ได้อ่าน',
        responses: { 200: { description: 'รายการ notification', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Notification' } } } } } },
      },
      post: {
        tags: ['Notifications'],
        summary: 'สร้าง notification ใหม่ (manual)',
        description: 'ใช้ใน: ระบบส่ง notification เมื่อมีการอนุมัติ/ปฏิเสธลา',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['title', 'message'], properties: { title: { type: 'string' }, message: { type: 'string' }, type: { type: 'string' }, user_id: { type: 'string', format: 'uuid' } } } } } },
        responses: { 201: { description: 'สร้างสำเร็จ' } },
      },
    },
    '/notifications/{id}/read': {
      put: {
        tags: ['Notifications'],
        summary: 'ทำเครื่องหมายว่าอ่านแล้ว',
        description: 'ใช้ใน: คลิก notification รายการ',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'อัปเดตสำเร็จ' } },
      },
    },
    '/notifications/read-all': {
      put: {
        tags: ['Notifications'],
        summary: 'ทำเครื่องหมายทั้งหมดว่าอ่านแล้ว',
        description: 'ใช้ใน: ปุ่ม "อ่านทั้งหมด" ใน notification panel',
        responses: { 200: { description: 'อัปเดตสำเร็จ' } },
      },
    },
    '/notifications/{id}': {
      delete: {
        tags: ['Notifications'],
        summary: 'ลบ notification',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'ลบสำเร็จ' } },
      },
    },

    // ─────────────────────────────────────────────────────────
    // NOTIFICATION SETTINGS
    // ─────────────────────────────────────────────────────────
    '/notification-settings': {
      get: { tags: ['Notification Settings'], summary: 'ดึงการตั้งค่า notification', description: '**Role:** admin, ceo, hr', responses: { 200: { description: 'รายการ settings' } } },
      post: { tags: ['Notification Settings'], summary: 'สร้าง setting ใหม่', description: '**Role:** admin, ceo, hr', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 201: { description: 'สร้างสำเร็จ' } } },
    },
    '/notification-settings/{id}': {
      get: { tags: ['Notification Settings'], summary: 'ดึง setting ตาม ID', description: '**Role:** admin, ceo, hr', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'ข้อมูล setting' } } },
      put: { tags: ['Notification Settings'], summary: 'แก้ไข setting', description: '**Role:** admin, ceo, hr', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'อัปเดตสำเร็จ' } } },
      delete: { tags: ['Notification Settings'], summary: 'ลบ setting', description: '**Role:** admin, ceo, hr', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'ลบสำเร็จ' } } },
    },

    // ─────────────────────────────────────────────────────────
    // APPROVAL WORKFLOWS
    // ─────────────────────────────────────────────────────────
    '/approval-workflows': {
      get: { tags: ['Approval Workflows'], summary: 'ดึง workflow การอนุมัติทั้งหมด', description: 'ใช้ใน: หน้า Approval Workflow Settings', responses: { 200: { description: 'รายการ workflow' } } },
      post: { tags: ['Approval Workflows'], summary: 'สร้าง workflow ใหม่', description: '**Role:** admin, ceo', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 201: { description: 'สร้างสำเร็จ' } } },
    },
    '/approval-workflows/{id}': {
      get: { tags: ['Approval Workflows'], summary: 'ดึง workflow ตาม ID', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'ข้อมูล workflow' } } },
      put: { tags: ['Approval Workflows'], summary: 'แก้ไข workflow', description: '**Role:** admin, ceo', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'อัปเดตสำเร็จ' } } },
      delete: { tags: ['Approval Workflows'], summary: 'ลบ workflow', description: '**Role:** admin, ceo', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'ลบสำเร็จ' } } },
    },

    // ─────────────────────────────────────────────────────────
    // USER ROLES
    // ─────────────────────────────────────────────────────────
    '/user-roles/user/{userId}': {
      get: {
        tags: ['User Roles'],
        summary: 'ดึง roles ของ user',
        description: 'ใช้ใน: หน้า Employee Detail → แท็บสิทธิ์',
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'roles ของ user' } },
      },
    },
    '/user-roles': {
      post: {
        tags: ['User Roles'],
        summary: 'กำหนด role ให้ user',
        description: '**Role:** admin, ceo, hr',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['user_id', 'role'], properties: { user_id: { type: 'string', format: 'uuid' }, role: { type: 'string' } } } } } },
        responses: { 201: { description: 'กำหนด role สำเร็จ' } },
      },
      delete: {
        tags: ['User Roles'],
        summary: 'ลบ role ออกจาก user',
        description: '**Role:** admin, ceo, hr',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['user_id', 'role'], properties: { user_id: { type: 'string', format: 'uuid' }, role: { type: 'string' } } } } } },
        responses: { 200: { description: 'ลบ role สำเร็จ' } },
      },
    },

    // ─────────────────────────────────────────────────────────
    // ADMIN - CRON
    // ─────────────────────────────────────────────────────────
    '/admin/cron/yearly-leave-update': {
      post: {
        tags: ['Admin - Cron'],
        summary: 'อัปเดต quota วันลาประจำปี (manual trigger)',
        description: '**Role:** admin, ceo',
        responses: { 200: { description: 'ทำงานสำเร็จ' } },
      },
    },
    '/admin/cron/probation-check': {
      post: {
        tags: ['Admin - Cron'],
        summary: 'ตรวจสอบพนักงาน probation ที่ผ่านช่วงทดลองงาน',
        description: '**Role:** admin, ceo',
        responses: { 200: { description: 'ทำงานสำเร็จ' } },
      },
    },
    '/admin/cron/reset-employee-year': {
      post: {
        tags: ['Admin - Cron'],
        summary: 'รีเซ็ตสถิติการลาประจำปีสำหรับพนักงาน',
        description: '**Role:** admin, hr, ceo',
        responses: { 200: { description: 'รีเซ็ตสำเร็จ' } },
      },
    },
    '/admin/cron/leave-stats/{year}': {
      get: {
        tags: ['Admin - Cron'],
        summary: 'สถิติการลาของปีที่ระบุ',
        description: '**Role:** admin, hr, ceo',
        parameters: [{ name: 'year', in: 'path', required: true, schema: { type: 'integer', example: 2026 } }],
        responses: { 200: { description: 'สถิติการลา' } },
      },
    },
    '/admin/cron/employees-in-probation': {
      get: {
        tags: ['Admin - Cron'],
        summary: 'รายชื่อพนักงานที่อยู่ในช่วงทดลองงาน',
        description: '**Role:** admin, hr, ceo',
        responses: { 200: { description: 'รายชื่อพนักงาน probation' } },
      },
    },
    '/admin/cron/upcoming-anniversaries': {
      get: {
        tags: ['Admin - Cron'],
        summary: 'พนักงานที่ครบรอบทำงานในเร็วๆ นี้',
        description: '**Role:** admin, hr, ceo',
        responses: { 200: { description: 'รายชื่อพนักงาน' } },
      },
    },
  },
};
