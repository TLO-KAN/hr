-- Insert Admin User (password: admin123)
-- Hash is generated using: bcrypt('admin123', 10)
INSERT INTO user_auth (email, password_hash, role) VALUES
  ('admin@hrdb.local', '$2b$10$bJI/kGGK45WbYeHqMZhCXu7jzNFDLwJk.N1/bvE9qh1XFiX.TL1Ty', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Get the admin user ID for reference
SELECT id, email, role FROM user_auth WHERE email = 'admin@hrdb.local';
