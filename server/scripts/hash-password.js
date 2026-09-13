import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../src/config.js';

const password = process.argv[2];

if (!password) {
  console.error('Usage: npm run hash-password -- "your-password"');
  process.exit(1);
}

// ใช้ cost เดียวกับที่แอปใช้ตอนเปลี่ยนรหัสผ่าน เพื่อไม่ให้บัญชีแรกอ่อนกว่าบัญชีอื่น
console.log(bcrypt.hashSync(password, BCRYPT_ROUNDS));
