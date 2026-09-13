import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4_unicode_ci',
  // คืน DATE/TIME เป็น string ดิบ ไม่ให้ไดรเวอร์แปลงเป็น Date object
  // (กัน timezone เลื่อนวันเวลาส่ง JSON กลับไปหน้าเว็บ)
  dateStrings: true,
});

export async function assertConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}
