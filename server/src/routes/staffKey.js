import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { BCRYPT_ROUNDS } from '../config.js';
import { checkStaffKey } from '../lib/validate.js';
import { createHash } from 'node:crypto';
import { encryptStaffKey, decryptStaffKey } from '../lib/staff-key-cipher.js';
import { createRateLimit } from '../middleware/rateLimit.js';

const confirmLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: 10, mode: 'all' });
function encryptionKey() {
  if (process.env.STAFF_KEY_ENCRYPTION_KEY) return process.env.STAFF_KEY_ENCRYPTION_KEY;
  if (!process.env.JWT_SECRET) throw new Error('Server encryption secret is missing');
  return createHash('sha256').update('marada/staff-key/v1:' + process.env.JWT_SECRET).digest('hex');
}

export const staffKeyRouter = Router();

staffKeyRouter.use(requireAdmin);

/**
 * สถานะของ key — ตั้งไว้แล้วหรือยัง และแก้ล่าสุดเมื่อไหร่
 * เฉพาะแอดมินเท่านั้นที่อ่านรหัสปัจจุบันได้; ไม่ส่ง hash หรือ ciphertext ออกไป
 */
staffKeyRouter.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT key_hash, key_ciphertext, updated_at FROM staff_key WHERE id = 1');
    res.set('Cache-Control', 'no-store');
    res.json({
      configured: !!rows[0]?.key_hash,
      updatedAt: rows[0]?.key_hash ? rows[0].updated_at : null,
      key: rows[0]?.key_hash ? await decryptStaffKey(rows[0].key_ciphertext, encryptionKey()) : null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * ตั้ง key ใหม่ (หรือเปลี่ยนของเดิม)
 * key_version เดินหน้าเสมอ -> token ของพนักงานทุกเครื่องที่ถือ key เดิมตายทันที
 * ใช้ ON DUPLICATE KEY UPDATE เพื่อให้ครั้งแรกกับครั้งถัด ๆ ไปเป็นคำสั่งเดียวกัน
 */
staffKeyRouter.put('/', confirmLimit, async (req, res, next) => {
  try {
    const [admins] = await pool.execute('SELECT password_hash FROM admin_users WHERE id = ?', [req.admin.id]);
    const password = String(req.body?.currentPassword ?? '');
    if (!admins[0] || Buffer.byteLength(password) > 72 || !(await bcrypt.compare(password, admins[0].password_hash))) {
      return res.status(400).json({ error: 'invalid_current_password' });
    }
    const err = checkStaffKey(req.body?.key);
    if (err) return res.status(400).json({ error: 'validation_failed', fields: { key: err } });
    if (Buffer.byteLength(String(req.body.key).trim()) > 72) return res.status(400).json({ error: 'validation_failed', fields: { key: 'too_long' } });

    const hash = await bcrypt.hash(String(req.body.key).trim(), BCRYPT_ROUNDS);
    const ciphertext = await encryptStaffKey(String(req.body.key).trim(), encryptionKey());

    await pool.execute(
      `INSERT INTO staff_key (id, key_hash, key_ciphertext, key_version) VALUES (1, ?, ?, 1)
       ON DUPLICATE KEY UPDATE key_hash = VALUES(key_hash), key_ciphertext = VALUES(key_ciphertext), key_version = key_version + 1`,
      [hash, ciphertext]
    );

    const [rows] = await pool.query('SELECT updated_at FROM staff_key WHERE id = 1');
    res.set('Cache-Control', 'no-store');
    res.json({ configured: true, updatedAt: rows[0]?.updated_at ?? null, key: String(req.body.key).trim() });
  } catch (err) {
    next(err);
  }
});

/** ลบ key = ปิดโหมดพนักงานทั้งหมด ทุกคนที่ไม่ใช่แอดมินกลับไปเห็นแค่วัน/เวลา */
staffKeyRouter.delete('/', async (_req, res, next) => {
  try {
    const [result] = await pool.query("UPDATE staff_key SET key_hash='', key_ciphertext=NULL, key_version=key_version+1 WHERE id=1 AND key_hash<>''");
    if (result.affectedRows === 0) return res.status(404).json({ error: 'not_found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
