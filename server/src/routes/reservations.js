import { Router } from 'express';
import { pool } from '../db.js';
import { optionalAuth, requireAdmin } from '../middleware/auth.js';
import { VIEW_ADMIN, serializeReservation } from '../lib/mask.js';
import { checkDateRange, validateReservationBody } from '../lib/validate.js';
import { readRateLimit } from '../middleware/rateLimit.js';

export const reservationsRouter = Router();

const SELECT_COLUMNS = `
  id, reserved_date, reserved_time, customer_name,
  seats, phone, zone, food_order
`;

/** GET /api/reservations?from=YYYY-MM-DD&to=YYYY-MM-DD — ดึงทั้งช่วง (ปกติคือทั้งเดือน) */
reservationsRouter.get('/', readRateLimit, optionalAuth, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const rangeError = checkDateRange(from, to);
    if (rangeError) return res.status(400).json({ error: rangeError });

    const [rows] = await pool.execute(
      `SELECT ${SELECT_COLUMNS} FROM reservations
       WHERE status='confirmed' AND reserved_date BETWEEN ? AND ?
       ORDER BY reserved_date ASC, reserved_time ASC, id ASC`,
      [from, to]
    );
    res.json(rows.map((row) => serializeReservation(row, req.viewLevel)));
  } catch (err) {
    next(err);
  }
});

/** GET /api/reservations/:id — รายละเอียดรายการเดียว */
reservationsRouter.get('/:id', readRateLimit, optionalAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ${SELECT_COLUMNS} FROM reservations WHERE id = ? AND status='confirmed'`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
    res.json(serializeReservation(rows[0], req.viewLevel));
  } catch (err) {
    next(err);
  }
});

/** POST /api/reservations — แอดมินเท่านั้น */
reservationsRouter.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { data, errors } = validateReservationBody(req.body);
    if (errors) return res.status(400).json({ error: 'validation_failed', fields: errors });

    const [result] = await pool.execute(
      `INSERT INTO reservations
         (reserved_date, reserved_time, customer_name, seats, phone, zone, food_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.date, data.time, data.name, data.seats, data.phone, data.zone || null, data.food || null]
    );

    const [rows] = await pool.execute(
      `SELECT ${SELECT_COLUMNS} FROM reservations WHERE id = ?`,
      [result.insertId]
    );
    res.status(201).json(serializeReservation(rows[0], VIEW_ADMIN));
  } catch (err) {
    next(err);
  }
});

/** PUT /api/reservations/:id — แอดมินเท่านั้น แก้ได้ทุกฟิลด์รวมจำนวนที่นั่ง */
reservationsRouter.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { data, errors } = validateReservationBody(req.body);
    if (errors) return res.status(400).json({ error: 'validation_failed', fields: errors });

    const [result] = await pool.execute(
      `UPDATE reservations SET
         reserved_date = ?, reserved_time = ?, customer_name = ?,
         seats = ?, phone = ?, zone = ?, food_order = ?, revision=revision+1
       WHERE id = ? AND status='confirmed'`,
      [
        data.date, data.time, data.name, data.seats,
        data.phone, data.zone || null, data.food || null,
        req.params.id,
      ]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'not_found' });

    const [rows] = await pool.execute(
      `SELECT ${SELECT_COLUMNS} FROM reservations WHERE id = ?`,
      [req.params.id]
    );
    res.json(serializeReservation(rows[0], VIEW_ADMIN));
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/reservations/:id — แอดมินเท่านั้น */
reservationsRouter.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const [result] = await pool.execute("DELETE FROM reservations WHERE id = ? AND status='confirmed'", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'not_found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
