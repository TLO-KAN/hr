# 🚀 PostgreSQL Database Setup Guide

## Quick Setup Steps

### 1️⃣ Check if PostgreSQL is Running

**macOS (Homebrew)**:
```bash
brew services list | grep postgres
```

If not running:
```bash
brew services start postgresql@15
# or
brew services start postgres
```

**macOS (Docker)**:
```bash
docker ps | grep postgres
```

**Linux**:
```bash
sudo systemctl status postgresql
sudo systemctl start postgresql
```

---

### 2️⃣ Connect to PostgreSQL

```bash
# Default PostgreSQL user
psql -U postgres
```

If you get a password prompt, try these default passwords:
- `postgres` (common default)
- `<leave blank>` (just press Enter)
- Your macOS username

---

### 3️⃣ Create Database & User

Once inside `psql` console:

```sql
-- Create database
CREATE DATABASE hr_system;

-- Check if user exists, if not create it
CREATE USER postgres WITH PASSWORD 'postgres';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE hr_system TO postgres;

-- Exit
\q
```

---

### 4️⃣ Verify Connection

```bash
psql -h localhost -U postgres -d hr_system -c "SELECT NOW();"
```

Expected output: Current timestamp

---

### 5️⃣ Update `.env` if Needed

If PostgreSQL uses different credentials, update:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres          # Your database user
DB_PASSWORD=postgres      # Your database password
DB_NAME=hr_system         # Your database name
```

---

## Troubleshooting

### "postgres: command not found"
PostgreSQL is not installed
```bash
# macOS
brew install postgresql@15

# Linux
sudo apt-get install postgresql postgresql-contrib
```

### "password authentication failed"
Wrong password in `.env`
```bash
# Try connecting without password
psql -h localhost -U postgres -d hr_system

# If this works, leave password empty in .env:
DB_PASSWORD=
```

### "database does not exist"
Create it with:
```bash
psql -U postgres -c "CREATE DATABASE hr_system;"
```

### "permission denied"
Grant privileges:
```bash
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE hr_system TO postgres;"
```

---

## Default Credentials

If you haven't set a password during PostgreSQL installation:
```
User: postgres
Password: (empty or your OS password)
Host: localhost
Port: 5432
Database: hr_system
```

---

## Next Steps

1. Set up PostgreSQL with the guide above
2. Update `.env` with correct credentials
3. Create database tables (see `CREATE_TABLES.sql` below)
4. Run: `npm run dev`

