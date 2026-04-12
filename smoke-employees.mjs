const baseUrl = 'http://localhost:3322';

async function req(path, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  const login = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      email: 'admin@tlogical.com',
      password: 'Admin@123',
    },
  });

  const token = login?.data?.token || login?.data?.data?.token;
  if (!token) {
    console.log(JSON.stringify({ step: 'login', ok: false, status: login.status, data: login.data }, null, 2));
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${token}` };
  const departments = await req('/api/departments', { headers: auth });
  const positions = await req('/api/positions', { headers: auth });

  const deptList = Array.isArray(departments.data) ? departments.data : (departments.data?.data || []);
  const posList = Array.isArray(positions.data) ? positions.data : (positions.data?.data || []);

  const deptId = deptList[0]?.id;
  const posId = (posList.find((p) => String(p.department_id) === String(deptId)) || posList[0])?.id;

  if (!deptId || !posId) {
    console.log(JSON.stringify({
      step: 'lookup',
      ok: false,
      deptCount: deptList.length,
      posCount: posList.length,
      deptId,
      posId,
    }, null, 2));
    process.exit(1);
  }

  const stamp = Date.now();
  const createPayload = {
    employee_code: `SMK${stamp}`,
    prefix: 'นาย',
    first_name: 'Smoke',
    last_name: 'Test',
    email: `smoke.${stamp}@example.com`,
    phone: '0800000000',
    department_id: deptId,
    position_id: posId,
    employee_type: 'permanent',
    start_date: '2026-04-01',
    status: 'active',
    leave_adjustments: { annual: 1, sick: 0.5, personal: 0 },
  };

  const created = await req('/api/employees', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: createPayload,
  });

  const employeeId = created?.data?.data?.id;
  if (!employeeId) {
    console.log(JSON.stringify({ step: 'create', ok: false, status: created.status, data: created.data }, null, 2));
    process.exit(1);
  }

  const updated = await req(`/api/employees/${employeeId}`, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: {
      phone: '0899999999',
      status: 'active',
      leave_adjustments: { annual: 0, sick: 1, personal: 0.5 },
    },
  });

  const deleted = await req(`/api/employees/${employeeId}`, {
    method: 'DELETE',
    headers: auth,
  });

  console.log(JSON.stringify({
    login: { ok: login.ok, status: login.status },
    departments: { ok: departments.ok, count: deptList.length },
    positions: { ok: positions.ok, count: posList.length },
    create: { ok: created.ok, status: created.status, id: employeeId },
    update: { ok: updated.ok, status: updated.status, message: updated.data?.message },
    delete: { ok: deleted.ok, status: deleted.status, message: deleted.data?.message },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
