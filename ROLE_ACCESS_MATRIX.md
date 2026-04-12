# ROLE_ACCESS_MATRIX

อัปเดตล่าสุด: 2026-04-03

## บทบาทที่ระบบรองรับ

- admin
- ceo
- hr
- manager
- supervisor
- employee

## เมนูที่เข้าถึงได้ (Frontend Sidebar)

| เมนู | admin | ceo | hr | manager | supervisor | employee |
|---|---|---|---|---|---|---|
| /dashboard | Y | Y | Y | Y | Y | Y |
| /employees | Y | Y | Y | Y | Y | N |
| /leave/request | Y | Y | Y | Y | Y | Y |
| /leave/approval | Y | Y | Y | Y | Y | N |
| /leave/balance | Y | Y | Y | N | N | N |
| /leave/settings | Y | Y | Y | N | N | N |
| /holidays | Y | Y | Y | N | N | N |
| /reports | Y | Y | Y | Y | Y | N |
| /departments | Y | Y | Y | N | N | N |
| /positions | Y | Y | Y | N | N | N |
| /profile | Y | Y | Y | Y | Y | Y |
| /settings | Y | Y | N | N | N | N |

## สิทธิ์ระดับ API ที่สำคัญ (Backend)

### กลุ่ม Admin-like

- admin
- ceo

### Endpoint สำคัญ

- GET /api/auth/me: ผู้ใช้ที่ล็อกอินทุก role
- GET /api/auth/permissions: ผู้ใช้ที่ล็อกอินทุก role
- GET /api/employees: ผู้ใช้ที่ล็อกอินทุก role
- POST/PUT/DELETE /api/employees: admin, ceo, hr
- GET/POST/PUT/DELETE /api/departments: admin, ceo, hr
- GET/POST/PUT/DELETE /api/positions: admin, ceo, hr
- GET/POST/PUT/DELETE /api/holidays: admin, ceo, hr
- GET /api/leave-requests: admin, ceo, hr
- POST /api/leave-requests/:id/approve: admin, ceo, hr, manager, supervisor
- POST /api/leave-requests/:id/reject: admin, ceo, hr, manager, supervisor
- POST /api/user-roles: admin, ceo, hr
- DELETE /api/user-roles: admin, ceo, hr
- POST /api/notifications (for other users): admin, ceo, hr, manager

## หมายเหตุ

- ระบบ role ปัจจุบันอิงค่าจาก user_auth.role เป็นหลัก (single-role ต่อ user ใน runtime)
- ฝั่ง frontend มี route guard ตาม role ที่ App.tsx เพื่อกันการเข้าผ่าน URL โดยตรง
- หากเปลี่ยน policy เพิ่มเติม ให้ปรับทั้ง 3 จุดพร้อมกัน:
  - frontend/src/components/layout/Sidebar.tsx
  - frontend/src/App.tsx
  - backend/src/routes/*.js
