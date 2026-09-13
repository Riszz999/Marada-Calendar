/**
 * ตัวจำกัดความถี่แบบเก็บในหน่วยความจำ
 *
 * ข้อจำกัดที่ต้องรู้: นับแยกในแต่ละ process หายเมื่อรีสตาร์ต
 * ถ้าวันหนึ่งรันหลาย instance หลัง load balancer ต้องย้ายไปเก็บใน Redis แทน
 *
 * การนับผูกกับ req.ip ซึ่งจะถูกต้องก็ต่อเมื่อ index.js ตั้ง trust proxy ไว้ถูก
 * และ nginx เขียนทับ X-Forwarded-For ด้วย $remote_addr เสมอ
 */

/**
 * @param {object} opts
 * @param {number} opts.windowMs  ความยาวหน้าต่างเวลา
 * @param {number} opts.max       จำนวนครั้งสูงสุดในหน้าต่างนั้น
 * @param {'all'|'failures'} opts.mode
 *   'all'      = นับทุก request ที่ผ่านเข้ามา (ใช้กับ GET สาธารณะ)
 *   'failures' = นับเฉพาะที่ผู้เรียก report ว่าล้มเหลว (ใช้กับ login)
 */
export function createRateLimit({ windowMs, max, mode = 'all' }) {
  /** key = IP, value = { hits, firstAt } */
  const buckets = new Map();

  function current(key) {
    const entry = buckets.get(key);
    if (!entry) return null;
    if (Date.now() - entry.firstAt > windowMs) {
      buckets.delete(key);
      return null;
    }
    return entry;
  }

  function bump(key) {
    const entry = current(key);
    if (entry) entry.hits += 1;
    else buckets.set(key, { hits: 1, firstAt: Date.now() });
  }

  const keyOf = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

  const middleware = (req, res, next) => {
    const key = keyOf(req);
    const entry = current(key);
    if (entry && entry.hits >= max) {
      const retryAfterSeconds = Math.ceil((entry.firstAt + windowMs - Date.now()) / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: 'too_many_attempts', retryAfterSeconds });
    }
    if (mode === 'all') bump(key);
    next();
  };

  middleware.recordFailure = (req) => bump(keyOf(req));
  middleware.clear = (req) => buckets.delete(keyOf(req));

  // กวาดรายการหมดอายุกัน Map โตไม่จำกัด — unref() เพื่อไม่ให้ timer กั้น process ตอนปิด
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (now - entry.firstAt > windowMs) buckets.delete(key);
    }
  }, windowMs).unref();

  return middleware;
}

/** ล็อกอิน: นับเฉพาะครั้งที่ล้มเหลว 5 ครั้ง / 15 นาที */
export const loginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  mode: 'failures',
});

/**
 * กรอก access key ของพนักงาน: 5 ครั้งที่ผิด / 15 นาที
 * ต้องเป็นคนละ bucket กับ loginRateLimit — พนักงานหลายคนมักอยู่ IP เดียวกันที่ร้าน
 * ถ้าใช้ bucket ร่วมกัน พนักงานพิมพ์ key ผิดไม่กี่ครั้งจะทำให้แอดมินล็อกอินไม่ได้ไปด้วย
 */
export const staffKeyRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  mode: 'failures',
});

/** อ่านข้อมูลสาธารณะ: 120 ครั้ง / 5 นาที — ใช้งานปกติไม่ถึง แต่ชะลอการดูดข้อมูลยกชุด */
export const readRateLimit = createRateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  mode: 'all',
});

export const recordLoginFailure = (req) => loginRateLimit.recordFailure(req);
export const clearLoginAttempts = (req) => loginRateLimit.clear(req);

export const recordStaffKeyFailure = (req) => staffKeyRateLimit.recordFailure(req);
export const clearStaffKeyAttempts = (req) => staffKeyRateLimit.clear(req);
