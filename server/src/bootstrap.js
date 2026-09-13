import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { BCRYPT_ROUNDS } from './config.js';

const CREATE_ADMIN_USERS = `
  CREATE TABLE IF NOT EXISTS admin_users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(64)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    token_version INT UNSIGNED NOT NULL DEFAULT 0,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_username (username)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

/**
 * access key ของพนักงาน — แถวเดียวตายตัว (id = 1)
 * ไม่สร้างแถวเริ่มต้นให้: ไม่มีแถว = ปิดโหมดพนักงานไปเลย
 * (ไม่สุ่ม key ให้อัตโนมัติเพราะไม่อยากให้ความลับโผล่ใน log ตอนบูต)
 */
const CREATE_STAFF_KEY = `
  CREATE TABLE IF NOT EXISTS staff_key (
    id          TINYINT UNSIGNED PRIMARY KEY,
    key_hash    VARCHAR(255) NOT NULL,
    key_ciphertext TEXT NULL,
    key_version INT UNSIGNED NOT NULL DEFAULT 0,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_staff_key_single_row CHECK (id = 1)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

/**
 * sql/schema.sql ทำงานผ่าน docker-entrypoint-initdb.d ซึ่ง MySQL รันครั้งเดียว
 * ตอน data directory ยังว่าง — เครื่องที่มีข้อมูลอยู่แล้วจะไม่ได้ตารางใหม่
 * ฟังก์ชันนี้จึงต้องรันทุกครั้งที่ server บูต เพื่อให้ทั้งเครื่องเก่าและเครื่องใหม่ตรงกัน
 */
export async function ensureSchema() {
  const requestColumns = {
    status:"VARCHAR(20) NOT NULL DEFAULT 'confirmed'", source:"VARCHAR(16) NOT NULL DEFAULT 'admin'",
    admin_note:"VARCHAR(2000) NOT NULL DEFAULT ''",requested_at:'DATETIME NULL',reviewed_at:'DATETIME NULL',revision:'INT UNSIGNED NOT NULL DEFAULT 0',
  };
  for(const [column,definition] of Object.entries(requestColumns)) {
    const [found]=await pool.query('SHOW COLUMNS FROM reservations LIKE ?',[column]);
    if(!found.length) await pool.query(`ALTER TABLE reservations ADD COLUMN ${column} ${definition}`);
  }
  const [requestIndex]=await pool.query("SHOW INDEX FROM reservations WHERE Key_name='idx_requests_status_date'");
  if(!requestIndex.length) await pool.query('CREATE INDEX idx_requests_status_date ON reservations(source,status,reserved_date)');
  await pool.query(CREATE_ADMIN_USERS);
  await pool.query(CREATE_STAFF_KEY);
  const [cipherColumns] = await pool.query("SHOW COLUMNS FROM staff_key LIKE 'key_ciphertext'");
  if (!cipherColumns.length) await pool.query('ALTER TABLE staff_key ADD COLUMN key_ciphertext TEXT NULL');

  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM admin_users');
  if (total > 0) return;

  const username = (process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin').trim();
  const hash = process.env.ADMIN_PASSWORD_HASH;

  if (!hash) {
    throw new Error(
      'ยังไม่มีบัญชีแอดมินในฐานข้อมูล และไม่พบ ADMIN_PASSWORD_HASH ใน .env — ' +
      'สร้าง hash ด้วย `npm run hash-password -- "รหัสผ่าน"` แล้วใส่ใน .env ก่อนเริ่ม server'
    );
  }

  await pool.execute(
    'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
    [username, hash]
  );
  console.log(`สร้างบัญชีแอดมินแรกแล้ว: "${username}" (รหัสผ่านตาม ADMIN_PASSWORD_HASH ใน .env)`);
  console.log('แนะนำให้เปลี่ยนรหัสผ่านจากหน้าเว็บหลังล็อกอินครั้งแรก');
}

/**
 * ใช้เทียบเวลาแบบหลอกเมื่อไม่พบ username เพื่อไม่ให้เดาได้จากความเร็วในการตอบ
 * cost ต้องเท่ากับ BCRYPT_ROUNDS เป๊ะ ไม่งั้นสองเส้นทางใช้เวลาต่างกันจนเดาได้
 * ซึ่งจะย้อนแย้งกับเหตุผลที่มีตัวแปรนี้ตั้งแต่แรก
 */
export const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);
