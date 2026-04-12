# 🏢 HR Management System - Backend API

A comprehensive Human Resources Management System built with **Node.js**, **Express**, and **PostgreSQL**.

## ✨ Features

### 👥 Employee Management
- ✅ Employee profiles with detailed information
- ✅ Department and position management
- ✅ Employee status tracking (active, inactive, on leave, terminated)
- ✅ Avatar/profile picture upload support

### 🏖️ Leave Management
- ✅ Multiple leave types (annual, sick, personal, maternity, paternity)
- ✅ Leave request submission and tracking
- ✅ Multi-level approval workflow
- ✅ Leave balance management
- ✅ Auto-calculation of leave entitlements
- ✅ Holiday calendar management

### 🔔 Approval Workflows
- ✅ Customizable approval flows
- ✅ Supervisor, HR, and CEO approval levels
- ✅ Leave policy configuration per employee type
- ✅ Approval history tracking

### 📧 Notifications
- ✅ Email notifications for leave requests
- ✅ Customizable notification recipients
- ✅ Leave policy and holiday notifications

### 🔐 Authentication & Authorization
- ✅ JWT-based authentication
- ✅ Role-based access control (RBAC)
- ✅ Password hashing with bcrypt
- ✅ Password reset functionality
- ✅ Secure session management

### 📊 Data Management
- ✅ Pagination support
- ✅ Advanced filtering and search
- ✅ Automatic leave balance calculation
- ✅ Database transaction support

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js |
| **Framework** | Express.js |
| **Database** | PostgreSQL |
| **Authentication** | JWT |
| **Password Hashing** | Bcrypt |
| **Email** | Nodemailer |
| **Scheduling** | Node-cron |
| **CORS** | Cors |

---

## 📦 Installation

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed installation instructions.

Quick start:
\`\`\`bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings

# 3. Start development server
npm run dev
\`\`\`

---

## 🚀 Running the Server

### Development Mode
\`\`\`bash
npm run dev
\`\`\`

### Production Mode
\`\`\`bash
npm start
\`\`\`

### Run Tests
\`\`\`bash
npm test
\`\`\`

---

## 📚 API Documentation

### Base URL
\`\`\`
http://localhost:3322/api
\`\`\`

### Authentication
All authenticated endpoints require:
\`\`\`
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
\`\`\`

### Example: Login
\`\`\`bash
curl -X POST http://localhost:3322/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "password": "password123"}'
\`\`\`

Response:
\`\`\`json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "employee"
  }
}
\`\`\`

---

## 🗄️ Database Schema

The system automatically creates all necessary tables on startup:

- **user_auth** - User accounts and authentication
- **employees** - Employee information
- **departments** - Department information
- **positions** - Job positions
- **leave_types** - Types of leave
- **leave_policies** - Leave entitlement policies
- **leave_requests** - Leave request records
- **employee_leave_balances** - Leave balance tracking
- **approval_workflows** - Approval process configuration
- **holidays** - Public holidays calendar
- **notification_settings** - Email notification configuration
- **password_reset_tokens** - Password reset tokens

---

## 🔄 Automated Processes

### Annual Leave Balance Reset
- **Schedule**: January 1st at 00:00 every year
- **Function**: Resets annual leave balances based on employee type and tenure
- **Pro-ration**: Supports first-year pro-ration

### Password Token Cleanup
- **Schedule**: Daily at 03:00 AM
- **Function**: Deletes expired password reset tokens

---

## 📋 Project Structure

\`\`\`
src/
├── config/
│   ├── constants.js         # Constants and enums
│   └── db-pool.js          # Database connection pool
├── controllers/
│   ├── authController.js
│   ├── employeeController.js
│   ├── leaveRequestController.js
│   ├── departmentController.js
│   └── positionController.js
├── middlewares/
│   ├── authMiddleware.js      # JWT authentication
│   ├── validationMiddleware.js # Input validation
│   ├── errorHandler.js        # Error handling
│   ├── loggingMiddleware.js   # Request logging
│   ├── rateLimitMiddleware.js  # Rate limiting
│   ├── payloadValidator.js    # Payload validation
│   ├── corsMiddleware.js      # CORS configuration
│   └── urlRewriter.js         # URL path rewriting
├── repositories/
│   ├── UserRepository.js
│   ├── EmployeeRepository.js
│   ├── LeaveRequestRepository.js
│   ├── DepartmentRepository.js
│   └── PositionRepository.js
├── routes/
│   ├── authRoutes.js
│   ├── employeeRoutes.js
│   ├── leaveRequestRoutes.js
│   ├── departmentRoutes.js
│   ├── positionRoutes.js
│   ├── leaveTypeRoutes.js
│   ├── leavePolicyRoutes.js
│   ├── approvalWorkflowRoutes.js
│   ├── holidayRoutes.js
│   ├── leaveEntitlementRoutes.js
│   └── notificationSettingRoutes.js
├── services/
│   ├── authService.js
│   ├── employeeService.js
│   ├── leaveRequestService.js
│   ├── departmentService.js
│   └── positionService.js
└── utils/
    ├── logger.js           # Logging utility
    ├── emailService.js     # Email service
    ├── dbInitializer.js    # Database initialization
    └── annualLeaveScheduler.js # Cron jobs
\`\`\`

---

## 🔒 Security Features

- ✅ JWT token-based authentication
- ✅ Bcrypt password hashing
- ✅ Role-based access control (RBAC)
- ✅ Rate limiting on sensitive endpoints
- ✅ CORS protection
- ✅ Input validation and sanitization
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS protection
- ✅ Secure password reset mechanism
- ✅ Automatic token expiration

---

## 📈 Performance

- Connection pooling for database efficiency
- Indexed database queries
- Request logging and monitoring
- Pagination support for large datasets
- Caching strategies implemented

---

## 🐛 Error Handling

All errors are caught and returned in consistent format:
\`\`\`json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
\`\`\`

---

## 📝 Logging

Logs are stored in `logs/` directory:
- `info.log` - Info level logs
- `warn.log` - Warning level logs
- `error.log` - Error level logs
- `debug.log` - Debug level logs (development only)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📄 License

MIT License - See LICENSE file for details

---

## 👨‍💼 Author

Your Name / Your Organization

---

**Version**: 1.0.0  
**Last Updated**: January 2024