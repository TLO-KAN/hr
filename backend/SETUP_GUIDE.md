# 🚀 HR Management System - Backend Setup Guide

## 📋 Prerequisites

- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: v12 or higher
- **npm** or **yarn**: Package manager
- **Git**: Version control

---

## 🔧 Installation Steps

### 1️⃣ **Clone the Repository**

\`\`\`bash
cd /Applications/HR/backend
\`\`\`

### 2️⃣ **Install Dependencies**

\`\`\`bash
npm install
# or
yarn install
\`\`\`

### 3️⃣ **Setup PostgreSQL Database**

#### Create Database User (if not exists)
\`\`\`sql
CREATE USER postgres WITH PASSWORD 'postgres';
ALTER USER postgres CREATEDB;
\`\`\`

#### Create Database
\`\`\`sql
CREATE DATABASE hr_system OWNER postgres;
\`\`\`

#### Verify Connection
\`\`\`bash
psql -h localhost -U postgres -d hr_system
\`\`\`

### 4️⃣ **Environment Configuration**

Copy the example environment file:
\`\`\`bash
cp .env.example .env
\`\`\`

Edit `.env` file with your credentials:
\`\`\`
BACKEND_PORT=3322
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=hr_system

JWT_SECRET=your_secure_secret_key_here_min_32_chars

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
\`\`\`

### 5️⃣ **Initialize Database Schema**

The database schema will be **automatically created** when the server starts for the first time.

To manually initialize:
\`\`\`bash
npm run db:init
\`\`\`

### 6️⃣ **Start the Server**

#### Development Mode (with auto-reload)
\`\`\`bash
npm run dev
\`\`\`

#### Production Mode
\`\`\`bash
npm start
\`\`\`

You should see:
\`\`\`
============================================================
🚀 Backend API Server
============================================================
📍 URL: http://localhost:3322
🗄️  Database: PostgreSQL
🔄 Annual Leave Scheduler: Active
🧹 Token Cleanup Scheduler: Active
⏰ Timezone: Asia/Bangkok (or your timezone)
============================================================
\`\`\`

### 7️⃣ **Verify Installation**

\`\`\`bash
curl http://localhost:3322/api/health
\`\`\`

Expected response:
\`\`\`json
{
  "status": "OK",
  "message": "Backend API ทำงานปกติ",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 45.123
}
\`\`\`

---

## 📚 API Endpoints

### Authentication
- **POST** `/api/auth/register` - Register new user
- **POST** `/api/auth/login` - Login user
- **POST** `/api/auth/forgot-password` - Forgot password
- **POST** `/api/auth/reset-password` - Reset password
- **POST** `/api/auth/change-password` - Change password (requires auth)
- **GET** `/api/auth/me` - Get current user info (requires auth)

### Employees
- **GET** `/api/employees` - Get all employees (requires auth)
- **GET** `/api/employees/:id` - Get employee by ID (requires auth)
- **GET** `/api/employees/me` - Get current employee (requires auth)
- **POST** `/api/employees` - Create employee (requires admin/hr)
- **PUT** `/api/employees/:id` - Update employee (requires admin/hr)
- **DELETE** `/api/employees/:id` - Delete employee (requires admin/hr)
- **POST** `/api/employees/:id/reset-password` - Reset password (requires admin/hr)

### Leave Requests
- **GET** `/api/leave-requests` - Get all requests (requires admin/hr)
- **GET** `/api/leave-requests/:id` - Get request by ID (requires auth)
- **GET** `/api/leave-requests/my-requests` - Get my requests (requires auth)
- **POST** `/api/leave-requests` - Create request (requires auth)
- **PUT** `/api/leave-requests/:id` - Update request (requires auth)
- **POST** `/api/leave-requests/:id/cancel` - Cancel request (requires auth)
- **POST** `/api/leave-requests/:id/approve` - Approve request (requires approver role)
- **POST** `/api/leave-requests/:id/reject` - Reject request (requires approver role)

### Departments
- **GET** `/api/departments` - Get all departments (requires auth)
- **GET** `/api/departments/:id` - Get department by ID (requires auth)
- **POST** `/api/departments` - Create department (requires admin/hr)
- **PUT** `/api/departments/:id` - Update department (requires admin/hr)
- **DELETE** `/api/departments/:id` - Delete department (requires admin/hr)

### Positions
- **GET** `/api/positions` - Get all positions (requires auth)
- **GET** `/api/positions/:id` - Get position by ID (requires auth)
- **POST** `/api/positions` - Create position (requires admin/hr)
- **PUT** `/api/positions/:id` - Update position (requires admin/hr)
- **DELETE** `/api/positions/:id` - Delete position (requires admin/hr)

### Leave Types
- **GET** `/api/leave-types` - Get all leave types (requires auth)
- **GET** `/api/leave-types/:id` - Get leave type by ID (requires auth)
- **POST** `/api/leave-types` - Create leave type (requires admin/hr)
- **PUT** `/api/leave-types/:id` - Update leave type (requires admin/hr)
- **DELETE** `/api/leave-types/:id` - Delete leave type (requires admin/hr)

### And More... (See routes files for full documentation)

---

## 🧪 Testing

### Run All Tests
\`\`\`bash
npm test
\`\`\`

### Run Tests in Watch Mode
\`\`\`bash
npm run test:watch
\`\`\`

### Run Tests with Coverage
\`\`\`bash
npm test -- --coverage
\`\`\`

---

## 📧 Email Configuration (Gmail)

### Steps to Enable Gmail SMTP:

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate App Password**:
   - Go to myaccount.google.com
   - Click "Security" in left menu
   - Under "How you sign in to Google", enable 2-Step Verification
   - Go back to Security > App passwords
   - Select "Mail" and "Windows Computer"
   - Copy the generated password
3. **Update .env**:
   \`\`\`
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-specific-password
   \`\`\`

---

## 🔐 Security Best Practices

- ✅ **Never commit .env file** to git
- ✅ **Use strong JWT_SECRET** (minimum 32 characters)
- ✅ **Keep dependencies updated**: \`npm update\`
- ✅ **Use HTTPS in production**
- ✅ **Implement rate limiting** (already configured)
- ✅ **Validate all inputs** (validators in place)
- ✅ **Hash passwords** (bcrypt configured)

---

## 🐛 Troubleshooting

### Database Connection Error
\`\`\`
Error: connect ECONNREFUSED 127.0.0.1:5432
\`\`\`
**Solution**: Ensure PostgreSQL is running
\`\`\`bash
# macOS
brew services start postgresql@14

# Linux
sudo service postgresql start

# Windows
pg_ctl -D "C:\\Program Files\\PostgreSQL\\14\\data" start
\`\`\`

### Port Already in Use
\`\`\`
Error: listen EADDRINUSE: address already in use :::3322
\`\`\`
**Solution**: Change port in .env or kill the process
\`\`\`bash
# Find and kill process using port 3322
lsof -i :3322
kill -9 <PID>
\`\`\`

### JWT Token Invalid
**Solution**: Verify JWT_SECRET is set correctly in .env

### Email Not Sending
**Solution**: 
- Verify SMTP credentials in .env
- Check if app password is correct for Gmail
- Ensure ENABLE_EMAIL_NOTIFICATIONS=true in .env

---

## 📖 Project Structure

\`\`\`
backend/
├── src/
│   ├── config/           # Configuration files
│   ├── controllers/       # Request handlers
│   ├── middlewares/       # Express middlewares
│   ├── repositories/      # Database operations
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   └── utils/             # Utilities (logger, email, etc)
├── logs/                  # Log files
├── .env                   # Environment variables
├── .env.example           # Example env file
├── .gitignore             # Git ignore rules
├── package.json           # Dependencies
└── server.js              # Entry point
\`\`\`

---

## 🚀 Deployment

### Production Deployment Steps

1. **Build & Optimize**
   \`\`\`bash
   npm install --production
   \`\`\`

2. **Set Environment Variables**
   \`\`\`bash
   export NODE_ENV=production
   export BACKEND_PORT=3322
   # ... set other variables
   \`\`\`

3. **Start Server**
   \`\`\`bash
   npm start
   \`\`\`

4. **Use Process Manager** (pm2 recommended)
   \`\`\`bash
   npm install -g pm2
   pm2 start server.js --name "hr-backend"
   pm2 save
   pm2 startup
   \`\`\`

---

## 📞 Support & Documentation

- **API Documentation**: See routes in \`src/routes/\`
- **Database Schema**: Auto-initialized on startup
- **Logs**: Check \`logs/\` directory

---

## 📝 License

MIT License - Feel free to use this project

---

**Last Updated**: January 2024
**Version**: 1.0.0