import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const REQUIRED_ENV = ['TEST_API_BASE_URL', 'TEST_ADMIN_EMAIL', 'TEST_ADMIN_PASSWORD'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnv.join(', ')}`);
  console.error('Set them before running this script.');
  process.exit(1);
}

const BASE_URL = process.env.TEST_API_BASE_URL;

const testUsers = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD,
  },
};

let tokens = {};

async function login(role) {
  try {
    const user = testUsers[role];
    console.log(`\n📝 Logging in as ${role}...`);
    
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        password: user.password
      })
    });

    if (!res.ok) {
      console.error(`❌ Login failed for ${role}: ${res.status} ${await res.text()}`);
      return false;
    }

    const data = await res.json();
    tokens[role] = data.token;
    console.log(`✅ Successfully logged in as ${role}`);
    console.log(`   Token: ${data.token.substring(0, 20)}...`);
    return true;
  } catch (error) {
    console.error(`❌ Login error for ${role}:`, error.message);
    return false;
  }
}

async function testCreateEmployee(role, employeeData) {
  try {
    if (!tokens[role]) {
      console.log(`⏭️  Skipping ${role} - not logged in`);
      return null;
    }

    console.log(`\n👤 Creating employee as ${role}...`);
    const res = await fetch(`${BASE_URL}/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens[role]}`
      },
      body: JSON.stringify(employeeData)
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.log(`❌ Failed to create employee as ${role}: ${res.status} - ${errorText}`);
      return null;
    }

    const data = await res.json();
    console.log(`✅ Successfully created employee as ${role}: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error(`❌ Create employee error for ${role}:`, error.message);
    return null;
  }
}

async function testChangeRole(role, userId, newRole) {
  try {
    if (!tokens[role]) {
      console.log(`⏭️  Skipping ${role} - not logged in`);
      return false;
    }

    console.log(`\n🔐 Changing role as ${role}...`);
    const res = await fetch(`${BASE_URL}/employees/${userId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens[role]}`
      },
      body: JSON.stringify({ role: newRole })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.log(`❌ Failed to change role as ${role}: ${res.status} - ${errorText}`);
      return false;
    }

    console.log(`✅ Successfully changed role as ${role}`);
    return true;
  } catch (error) {
    console.error(`❌ Change role error for ${role}:`, error.message);
    return false;
  }
}

async function testGetLeaveRequests(role) {
  try {
    if (!tokens[role]) {
      console.log(`⏭️  Skipping ${role} - not logged in`);
      return [];
    }

    console.log(`\n📋 Getting leave requests as ${role}...`);
    const res = await fetch(`${BASE_URL}/leave-requests`, {
      headers: {
        'Authorization': `Bearer ${tokens[role]}`
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.log(`❌ Failed to get leave requests as ${role}: ${res.status} - ${errorText}`);
      return [];
    }

    const data = await res.json();
    console.log(`✅ Successfully retrieved ${data.length} leave requests as ${role}`);
    return data;
  } catch (error) {
    console.error(`❌ Get leave requests error for ${role}:`, error.message);
    return [];
  }
}

async function testCreateLeaveRequest(role, leaveData) {
  try {
    if (!tokens[role]) {
      console.log(`⏭️  Skipping ${role} - not logged in`);
      return null;
    }

    console.log(`\n✏️  Creating leave request as ${role}...`);
    const res = await fetch(`${BASE_URL}/leave-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens[role]}`
      },
      body: JSON.stringify(leaveData)
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.log(`❌ Failed to create leave request as ${role}: ${res.status} - ${errorText}`);
      return null;
    }

    const data = await res.json();
    console.log(`✅ Successfully created leave request as ${role}: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error(`❌ Create leave request error for ${role}:`, error.message);
    return null;
  }
}

async function runTests() {
  console.log('🧪 ===== HR SYSTEM FUNCTIONALITY TEST =====\n');
  console.log('⏳ Starting tests... (make sure servers are running on port 3322 and 5173)\n');

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 1: Login tests
  console.log('\n===== PHASE 1: LOGIN TESTS =====');
  await login('admin');

  // Test 2: Employee creation tests
  console.log('\n\n===== PHASE 2: EMPLOYEE CREATION TESTS =====');
  
  const newEmployeeAdmin = {
    first_name: 'Test',
    last_name: 'Created by Admin',
    email: `test.admin.${Date.now()}@example.com`,
    phone: '0891234567',
    position: 'Developer',
    department: 'Engineering',
    hire_date: new Date().toISOString().split('T')[0],
    status: 'active',
    role: 'employee',
    annual_leave_quota: 15,
    sick_leave_quota: 10,
    personal_leave_quota: 3
  };

  console.log('\n--- Testing employee creation authorization ---');
  const empByAdmin = await testCreateEmployee('admin', newEmployeeAdmin);

  // Test 3: Leave request tests
  console.log('\n\n===== PHASE 3: LEAVE REQUEST TESTS =====');
  
  console.log('\n--- Getting existing leave requests ---');
  await testGetLeaveRequests('admin');

  console.log('\n--- Creating leave requests ---');
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  
  const leaveRequestData = {
    leave_type: 'vacation',
    start_date: futureDate.toISOString().split('T')[0],
    end_date: futureDate.toISOString().split('T')[0],
    total_days: 1,
    reason: 'Test leave request for admin',
    is_half_day: false
  };

  const leaveId = await testCreateLeaveRequest('admin', leaveRequestData);
  
  // Test 4: Cancel leave request
  if (leaveId) {
    console.log('\n--- Canceling leave request ---');
    try {
      const token = tokens['admin'];
      console.log(`\n🚫 Canceling leave request as admin...`);
      const res = await fetch(`${BASE_URL}/leave-requests/${leaveId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'cancelled' })
      });

      if (res.ok) {
        console.log(`✅ Successfully cancelled leave request`);
      } else {
        const errorText = await res.text();
        console.log(`❌ Failed to cancel leave request: ${res.status} - ${errorText}`);
      }
    } catch (error) {
      console.error(`❌ Cancel error:`, error.message);
    }
  }

  console.log('\n\n===== TEST SUMMARY =====');
  console.log('✅ Tests completed!');
  console.log('\nExpected results:');
  console.log('✓ Admin should create employees successfully');
  console.log('✓ Admin should be able to view leave requests');
  console.log('✓ Admin should be able to create and cancel leave requests');
}

// Run tests
runTests().catch(console.error);
