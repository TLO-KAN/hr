#!/bin/bash

# Test Profile Features
# Tests: 1) Edit profile, 2) Upload avatar, 3) Change password

API_URL="http://localhost:3002"

echo "===================="
echo "Profile Features Test"
echo "===================="

# Get a valid JWT token
echo ""
echo "1. Generating test JWT token..."
TOKEN=$(cd /Applications/HR/backend && node -e "
const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_in_production';
const token = jwt.sign(
  { id: '7', email: 'nongkanjung@gmail.com', role: 'employee' },
  secret,
  { expiresIn: '7d' }
);
console.log(token);
" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to generate token"
  exit 1
fi

echo "✓ Token generated: ${TOKEN:0:20}..."

# Test 1: Edit Profile Info
echo ""
echo "2. Testing Edit Profile (address field)..."
PROFILE_UPDATE=$(curl -s -X PUT "$API_URL/api/employees/7" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "first_name": "Rattikanl",
    "last_name": "Kanjaima",
    "phone": "0812345678",
    "address": "123 Sukhumvit Rd, Bangkok, Thailand"
  }')

echo "$PROFILE_UPDATE" | jq '.'
ADDRESS=$(echo "$PROFILE_UPDATE" | jq -r '.address // empty')

if [ "$ADDRESS" = "123 Sukhumvit Rd, Bangkok, Thailand" ]; then
  echo "✅ Profile edit PASSED"
else
  echo "❌ Profile edit FAILED"
fi

# Test 2: Upload Avatar (base64 data URL)
echo ""
echo "3. Testing Avatar Upload..."
# Create a simple 1x1 PNG base64 string
AVATAR_BASE64="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

AVATAR_UPLOAD=$(curl -s -X POST "$API_URL/api/auth/upload-avatar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"avatarUrl\": \"$AVATAR_BASE64\"
  }")

echo "$AVATAR_UPLOAD" | jq '.'
AVATAR_URL=$(echo "$AVATAR_UPLOAD" | jq -r '.employee.avatar_url // empty')

if [ -n "$AVATAR_URL" ] && [ "$AVATAR_URL" != "null" ]; then
  echo "✅ Avatar upload PASSED"
else
  echo "❌ Avatar upload FAILED"
fi

# Test 3: Change Password
echo ""
echo "4. Testing Change Password..."
PASSWORD_CHANGE=$(curl -s -X POST "$API_URL/api/auth/change-password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "currentPassword": "test123",
    "newPassword": "newtest456"
  }')

echo "$PASSWORD_CHANGE" | jq '.'
MESSAGE=$(echo "$PASSWORD_CHANGE" | jq -r '.message // empty')
ERROR=$(echo "$PASSWORD_CHANGE" | jq -r '.error // empty')

if [[ "$MESSAGE" == *"สำเร็จ"* ]] || [[ "$MESSAGE" == *"success"* ]]; then
  echo "✅ Password change PASSED"
else
  echo "⚠️  Password change returned: $MESSAGE $ERROR"
fi

echo ""
echo "===================="
echo "Test Complete"
echo "===================="
