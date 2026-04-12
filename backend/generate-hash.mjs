import bcrypt from 'bcrypt';

const password = 'admin123';
bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  console.log('Password: admin123');
  console.log('Hash:', hash);
});
