import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { VIEW_ADMIN, VIEW_GUEST, VIEW_STAFF } from '../lib/mask.js';

function readToken(req) {
  const header = req.get('authorization') || '';
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/** ออก token ให้แอดมิน — ผูก token_version ปัจจุบันไว้ในตัว token */
export function signToken(user) {
  return jwt.sign({ sub: user.id, tv: user.token_version }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

/**
 * ออก token ให้พนักงานที่กรอก access key ถูก
 * อายุยาวกว่าของแอดมินมาก เพราะเป็นสิทธิ์อ่านอย่างเดียวและไม่อยากให้พนักงานต้องกรอก key บ่อย
 * ถ้าต้องเตะพนักงานออกทั้งหมด ให้แอดมินเปลี่ยน key (key_version เดินหน้า token ทุกใบตายทันที)
 */
export function signStaffToken(keyRow) {
  return jwt.sign({ role: 'staff', kv: keyRow.key_version }, process.env.JWT_SECRET, {
    expiresIn: process.env.STAFF_TOKEN_EXPIRES_IN || '30d',
  });
}

const GUEST = { level: VIEW_GUEST, admin: null };

/**
 * ตรวจ token แล้วบอกว่าผู้เรียกอยู่ระดับไหน — คืน { level, admin }
 *
 * ต้องอ่าน DB ทุกครั้งเพราะทั้งสองระดับใช้ "version column" เป็นกลไกยกเลิก token:
 *   admin -> admin_users.token_version เดินหน้าเมื่อเปลี่ยน/รีเซ็ตรหัสผ่าน
 *   staff -> staff_key.key_version     เดินหน้าเมื่อแอดมินเปลี่ยน key
 * token ที่ถือ version เก่าจึงใช้ไม่ได้ทันที
 *
 * ทุกเส้นทางที่ตรวจไม่ผ่านต้องตกมาเป็น guest ไม่ใช่โยน error (fail closed)
 */
async function loadPrincipal(token) {
  if (!token) return GUEST;

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return GUEST;
  }

  if (payload?.role === 'staff') {
    const [rows] = await pool.query('SELECT key_hash, key_version FROM staff_key WHERE id = 1');
    const keyRow = rows[0];
    // ไม่มี key แล้ว (แอดมินลบทิ้ง) หรือ key ถูกเปลี่ยน = token ใบนี้ใช้ไม่ได้
    if (!keyRow?.key_hash || keyRow.key_version !== payload.kv) return GUEST;
    return { level: VIEW_STAFF, admin: null };
  }

  if (!payload?.sub) return GUEST;

  const [rows] = await pool.execute(
    'SELECT id, username, token_version FROM admin_users WHERE id = ?',
    [payload.sub]
  );
  const user = rows[0];
  if (!user || user.token_version !== payload.tv) return GUEST;
  return { level: VIEW_ADMIN, admin: user };
}

/** ไม่บังคับล็อกอิน — แค่ตั้ง req.viewLevel ให้ route ตัดสินใจว่าจะส่งข้อมูลระดับไหน */
export async function optionalAuth(req, _res, next) {
  try {
    const { level, admin } = await loadPrincipal(readToken(req));
    req.viewLevel = level;
    req.admin = admin;
    req.isAdmin = level === VIEW_ADMIN;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * บังคับสิทธิ์แอดมิน — ใช้กับทุก route ที่เขียนข้อมูลและทุก route ใต้ /api/admin
 * token ของพนักงานต้องผ่านด่านนี้ไม่ได้ (level ต้องเป็น admin เท่านั้น)
 */
export async function requireAdmin(req, res, next) {
  try {
    const { level, admin } = await loadPrincipal(readToken(req));
    if (level !== VIEW_ADMIN) return res.status(401).json({ error: 'unauthorized' });
    req.viewLevel = level;
    req.admin = admin;
    req.isAdmin = true;
    next();
  } catch (err) {
    next(err);
  }
}
