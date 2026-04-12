#!/bin/bash
# PostgreSQL Database Connection Test Script
# ทดสอบการเชื่อมต่อ PostgreSQL Database

set -e

echo "🔍 Testing PostgreSQL Database Connection..."
echo ""

# ดึงค่าจาก .env
if [ -f .env ]; then
  echo "📝 Loading .env configuration..."
  export $(cat .env | grep -v '^#' | xargs)
  echo "✅ .env loaded"
else
  echo "❌ .env file not found!"
  exit 1
fi

# แสดงค่า configuration
echo ""
echo "📋 Database Configuration:"
echo "  Host: ${DB_HOST:-localhost}"
echo "  Port: ${DB_PORT:-5432}"
echo "  Database: ${DB_NAME:-hr_management}"
echo "  User: ${DB_USER:-postgres}"
echo ""

# ทดสอบการเชื่อมต่อ
echo "🔌 Attempting to connect to PostgreSQL..."

PGPASSWORD="${DB_PASSWORD:-postgres}" psql \
  -h "${DB_HOST:-localhost}" \
  -U "${DB_USER:-postgres}" \
  -d "${DB_NAME:-hr_management}" \
  -c "SELECT version();"

echo ""
echo "✅ Database connection successful!"
echo ""

# ดูตารางที่มี
echo "📊 Tables in database:"
PGPASSWORD="${DB_PASSWORD:-postgres}" psql \
  -h "${DB_HOST:-localhost}" \
  -U "${DB_USER:-postgres}" \
  -d "${DB_NAME:-hr_management}" \
  -c "\dt"

echo ""
echo "🎉 All tests passed!"
