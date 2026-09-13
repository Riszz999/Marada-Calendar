import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { DUMMY_HASH } from '../bootstrap.js';
import { BCRYPT_ROUNDS } from '../config.js';
import { optionalAuth, requireAdmin, signStaffToken, signToken } from '../middleware/auth.js';
import {
  clearLoginAttempts,
  clearStaffKeyAttempts,
  loginRateLimit,
  recordLoginFailure,
  recordStaffKeyFailure,
  staffKeyRateLimit,
} from '../middleware/rateLimit.js';
import { checkPassword, checkUsername } from '../lib/validate.js';
import { VIEW_ADMIN } from '../lib/mask.js';

export const authRouter = Router();

function publicUser(row) {
  return { id: row.id, username: row.username };
}

authRouter.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'admin_not_configured' });
    }

    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');

    const [rows] = await pool.execute(
      'SELECT id, username, password_hash, token_version FROM admin_users WHERE username = ?',
      [username]
    );
    const user = rows[0];

    // ไม่พบผู้ใช้ก็ยังเทียบ hash หลอกหนึ่งครั้ง ให้เวลาตอบสนองใกล้เคียงกับกรณีรหัสผิด
    // และตอบ error code เดียวกันทั้งสองกรณี เพื่อไม่ให้เดาได้ว่ามี username นี้อยู่จริงไหม
    const ok = user
      ? await bcrypt.compare(password, user.password_hash)
      : (await bcrypt.compare(password, DUMMY_HASH), false);

    if (!ok) {
      recordLoginFailure(req);
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    clearLoginAttempts(req);
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

/**
 * แลก access key เป็น token ของพนักงาน
 * ตอบ error code เดียวกันทั้งกรณี key ผิดและกรณียังไม่ได้ตั้ง key เลย
 * เพื่อไม่ให้คนนอกเดาได้ว่าร้านนี้เปิดโหมดพนักงานไว้หรือไม่
 */
authRouter.post('/staff', staffKeyRateLimit, async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'admin_not_configured' });
    }

    const key = String(req.body?.key ?? '').trim();

    const [rows] = await pool.query('SELECT key_hash, key_version FROM staff_key WHERE id = 1');
    const keyRow = rows[0];

    // ยังไม่ได้ตั้ง key ก็ยังเทียบ hash หลอกหนึ่งครั้ง ให้เวลาตอบสนองใกล้เคียงกัน
    const ok = keyRow
      ? await bcrypt.compare(key, keyRow.key_hash)
      : (await bcrypt.compare(key, DUMMY_HASH), false);

    if (!ok) {
      recordStaffKeyFailure(req);
      return res.status(401).json({ error: 'invalid_key' });
    }

    clearStaffKeyAttempts(req);
    res.json({ token: signStaffToken(keyRow), level: 'staff' });
  } catch (err) {
    next(err);
  }
});

/**
 * บอกว่า token ที่ client ถืออยู่ตอนนี้ให้สิทธิ์ระดับไหน
 * client เรียกตอนบูตเพื่อรู้ว่า token ที่ค้างใน localStorage ยังใช้ได้หรือหมดอายุไปแล้ว
 * ใช้ optionalAuth จึงตอบ 200 เสมอ ไม่ใช่ 401 (ไม่มี token ก็แค่เป็น guest)
 */
authRouter.get('/session', optionalAuth, (req, res) => {
  res.json({
    level: req.viewLevel,
    user: req.viewLevel === VIEW_ADMIN ? publicUser(req.admin) : null,
  });
});

authRouter.get('/me', requireAdmin, (req, res) => {
  res.json(publicUser(req.admin));
});

/**
 * แก้บัญชีตัวเอง — รองรับทั้งเปลี่ยน username และเปลี่ยนรหัสผ่านในคำขอเดียว
 * ต้องยืนยันด้วยรหัสผ่านปัจจุบันเสมอ และคืน token ใบใหม่กลับไปเสมอ
 * เพื่อให้เครื่องที่กดเปลี่ยนเองไม่หลุดตอน token_version เดินหน้า
 */
authRouter.patch('/me', requireAdmin, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword ?? '');
    const hasUsername = req.body?.username !== undefined && String(req.body.username).trim() !== '';
    const hasPassword = req.body?.newPassword !== undefined && String(req.body.newPassword) !== '';

    if (!hasUsername && !hasPassword) {
      return res.status(400).json({ error: 'nothing_to_update' });
    }

    const [rows] = await pool.execute(
      'SELECT id, username, password_hash, token_version FROM admin_users WHERE id = ?',
      [req.admin.id]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'not_found' });

    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(401).json({ error: 'invalid_current_password' });
    }

    const fields = {};
    if (hasUsername) {
      const err = checkUsername(req.body.username);
      if (err) return res.status(400).json({ error: 'validation_failed', fields: { username: err } });
      fields.username = String(req.body.username).trim();
    }
    if (hasPassword) {
      const err = checkPassword(req.body.newPassword);
      if (err) return res.status(400).json({ error: 'validation_failed', fields: { newPassword: err } });
      fields.password_hash = await bcrypt.hash(String(req.body.newPassword), BCRYPT_ROUNDS);
    }

    // เปลี่ยนรหัสผ่าน = ยกเลิก token เก่าทุกใบของบัญชีนี้
    const bumpVersion = hasPassword;
    const sets = Object.keys(fields).map((k) => `${k} = ?`);
    if (bumpVersion) sets.push('token_version = token_version + 1');

    try {
      await pool.execute(
        `UPDATE admin_users SET ${sets.join(', ')} WHERE id = ?`,
        [...Object.values(fields), user.id]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'username_taken' });
      throw err;
    }

    const [updated] = await pool.execute(
      'SELECT id, username, token_version FROM admin_users WHERE id = ?',
      [user.id]
    );
    res.json({ user: publicUser(updated[0]), token: signToken(updated[0]) });
  } catch (err) {
    next(err);
  }
});
