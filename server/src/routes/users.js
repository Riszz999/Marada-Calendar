import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { BCRYPT_ROUNDS } from '../config.js';
import { checkPassword, checkUsername } from '../lib/validate.js';

export const usersRouter = Router();

usersRouter.use(requireAdmin);

usersRouter.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, created_at FROM admin_users ORDER BY id ASC'
    );
    res.json(rows.map((r) => ({ id: r.id, username: r.username, createdAt: r.created_at })));
  } catch (err) {
    next(err);
  }
});

usersRouter.post('/', async (req, res, next) => {
  try {
    const fields = {};
    const usernameErr = checkUsername(req.body?.username);
    if (usernameErr) fields.username = usernameErr;
    const passwordErr = checkPassword(req.body?.password);
    if (passwordErr) fields.password = passwordErr;
    if (Object.keys(fields).length) {
      return res.status(400).json({ error: 'validation_failed', fields });
    }

    const username = String(req.body.username).trim();
    const hash = await bcrypt.hash(String(req.body.password), BCRYPT_ROUNDS);

    // ดักที่ UNIQUE ของ MySQL แทนการ SELECT เช็คก่อน insert ซึ่งมีช่องว่างให้เกิด race
    let insertId;
    try {
      const [result] = await pool.execute(
        'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
        [username, hash]
      );
      insertId = result.insertId;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'username_taken' });
      throw err;
    }

    const [rows] = await pool.execute(
      'SELECT id, username, created_at FROM admin_users WHERE id = ?',
      [insertId]
    );
    res.status(201).json({ id: rows[0].id, username: rows[0].username, createdAt: rows[0].created_at });
  } catch (err) {
    next(err);
  }
});

/** แก้บัญชีคนอื่น — เปลี่ยนชื่อ และ/หรือ รีเซ็ตรหัสผ่าน (รีเซ็ตแล้วคนนั้นหลุดจากระบบทันที) */
usersRouter.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });

    const hasUsername = req.body?.username !== undefined && String(req.body.username).trim() !== '';
    const hasPassword = req.body?.newPassword !== undefined && String(req.body.newPassword) !== '';
    if (!hasUsername && !hasPassword) {
      return res.status(400).json({ error: 'nothing_to_update' });
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

    const sets = Object.keys(fields).map((k) => `${k} = ?`);
    if (hasPassword) sets.push('token_version = token_version + 1');

    let result;
    try {
      [result] = await pool.execute(
        `UPDATE admin_users SET ${sets.join(', ')} WHERE id = ?`,
        [...Object.values(fields), id]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'username_taken' });
      throw err;
    }
    if (result.affectedRows === 0) return res.status(404).json({ error: 'not_found' });

    const [rows] = await pool.execute(
      'SELECT id, username, created_at FROM admin_users WHERE id = ?',
      [id]
    );
    res.json({ id: rows[0].id, username: rows[0].username, createdAt: rows[0].created_at });
  } catch (err) {
    next(err);
  }
});

usersRouter.delete('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });

  // ลบตัวเองแล้วจะแก้อะไรต่อไม่ได้เลย — กันไว้ก่อนแตะฐานข้อมูล
  if (id === req.admin.id) {
    return res.status(400).json({ error: 'cannot_delete_self' });
  }

  const conn = await pool.getConnection();
  try {
    // นับและลบใน transaction เดียวกัน กันสองคำขอลบพร้อมกันจนไม่เหลือบัญชีสักคน
    await conn.beginTransaction();

    const [target] = await conn.execute('SELECT id FROM admin_users WHERE id = ? FOR UPDATE', [id]);
    if (target.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'not_found' });
    }

    // ในทางปฏิบัติ cannot_delete_self จะดักไว้ก่อนเสมอ (บัญชีสุดท้ายที่เหลือย่อมเป็นตัวเอง)
    // ด่านนี้เป็นกันชนชั้นสุดท้ายเผื่อมีคำขอลบพร้อมกันหลายรายการ
    const [[{ total }]] = await conn.query('SELECT COUNT(*) AS total FROM admin_users FOR UPDATE');
    if (total <= 1) {
      await conn.rollback();
      return res.status(400).json({ error: 'cannot_delete_last_admin' });
    }

    await conn.execute('DELETE FROM admin_users WHERE id = ?', [id]);
    await conn.commit();
    res.status(204).end();
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
});
