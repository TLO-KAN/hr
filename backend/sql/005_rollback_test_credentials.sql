-- Rollback test credential changes made during troubleshooting
-- Safe to run in production (idempotent for target emails)

BEGIN;

-- 1) Restore admin@hrdb.local password hash in user_auth (password: admin123)
UPDATE user_auth
SET password_hash = '$2b$10$bJI/kGGK45WbYeHqMZhCXu7jzNFDLwJk.N1/bvE9qh1XFiX.TL1Ty',
    updated_at = NOW()
WHERE email = 'admin@hrdb.local';

-- 2) Restore admin@system.com password hash in legacy users table
UPDATE users
SET password_hash = '$2b$10$O2tu1oWlpLeG2LWwbGntReBSo4PWysoACTjA1teIxeZ2jqwkP70nC'
WHERE email = 'admin@system.com';

COMMIT;

-- Verification query
SELECT 'user_auth' AS table_name, email, LEFT(password_hash, 20) AS hash_preview
FROM user_auth
WHERE email = 'admin@hrdb.local'
UNION ALL
SELECT 'users' AS table_name, email, LEFT(password_hash, 20) AS hash_preview
FROM users
WHERE email = 'admin@system.com';
