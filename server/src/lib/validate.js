const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const USERNAME_RE = /^[a-zA-Z0-9._-]+$/;

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 64;
export const PASSWORD_MIN = 8;

/** คืน error code หรือ null ถ้าผ่าน */
export function checkUsername(value) {
  const username = String(value ?? '').trim();
  if (!username) return 'required';
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) return 'length';
  if (!USERNAME_RE.test(username)) return 'charset';
  return null;
}

/** คืน error code หรือ null ถ้าผ่าน */
export function checkPassword(value) {
  const password = String(value ?? '');
  if (!password) return 'required';
  if (password.length < PASSWORD_MIN) return 'too_short';
  return null;
}

export const STAFF_KEY_MIN = 8;
export const STAFF_KEY_MAX = 128;

/**
 * ตรวจ access key ของพนักงาน — คืน error code หรือ null ถ้าผ่าน
 * ไม่จำกัดชุดตัวอักษรแบบ username เพราะ key ถูกสุ่มมา ไม่ได้เอาไว้พิมพ์ค้นหา
 */
export function checkStaffKey(value) {
  const key = String(value ?? '').trim();
  if (!key) return 'required';
  if (key.length < STAFF_KEY_MIN) return 'too_short';
  if (key.length > STAFF_KEY_MAX) return 'too_long';
  return null;
}

// เพดานของ INT UNSIGNED — ไม่ใช่กฎทางธุรกิจ แต่เป็นขีดจำกัดของชนิดข้อมูล
const SEATS_MAX = 4294967295;

/**
 * เพดานความกว้างของช่วงวันที่ดึงได้ในครั้งเดียว
 * หน้าเว็บดึงทีละเดือนอยู่แล้ว ค่านี้จึงไม่กระทบการใช้งานปกติ
 * แต่กันไม่ให้ยิงครั้งเดียวดูดข้อมูลทั้งฐานออกไป
 */
export const MAX_RANGE_DAYS = 366;

export function isValidDateKey(value) {
  if (!DATE_RE.test(String(value || ''))) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** คืน error code หรือ null ถ้าช่วงวันใช้ได้ */
export function checkDateRange(from, to) {
  if (!isValidDateKey(from) || !isValidDateKey(to)) return 'invalid_range';
  if (from > to) return 'invalid_range';

  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  if (days > MAX_RANGE_DAYS) return 'range_too_wide';
  return null;
}

/**
 * ตรวจ body ของการจอง คืน { data } ถ้าผ่าน หรือ { errors } ถ้าไม่ผ่าน
 * จำนวนที่นั่ง: ไม่มีขอบบนเชิงธุรกิจ ขอแค่เป็นจำนวนเต็ม >= 1
 */
export function validateReservationBody(body = {}) {
  const errors = {};

  const name = String(body.name ?? '').trim();
  if (!name) errors.name = 'required';
  else if (name.length > 120) errors.name = 'too_long';

  const seatsRaw = body.seats;
  const seats = Number(seatsRaw);
  if (seatsRaw === '' || seatsRaw === null || seatsRaw === undefined || !Number.isFinite(seats)) {
    errors.seats = 'required';
  } else if (!Number.isInteger(seats) || seats < 1) {
    errors.seats = 'min_1';
  } else if (seats > SEATS_MAX) {
    errors.seats = 'too_large';
  }

  const date = String(body.date ?? '').trim();
  if (!isValidDateKey(date)) errors.date = 'invalid';

  const time = String(body.time ?? '').trim();
  if (!TIME_RE.test(time)) errors.time = 'invalid';

  const phone = String(body.phone ?? '').trim();
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 9 || phoneDigits.length > 10) errors.phone = 'invalid';

  // โต๊ะเป็นข้อความอิสระ ไม่บังคับ — แอดมินพิมพ์เองตอนรับสาย
  const zone = String(body.zone ?? '').trim();
  if (zone.length > 120) errors.zone = 'too_long';

  const food = String(body.food ?? '').trim();

  if (Object.keys(errors).length > 0) return { errors };

  return { data: { name, seats, date, time, phone, zone, food } };
}
