/**
 * ตรวจค่า config ตอนบูต แล้วล้มทันทีถ้าขึ้น production ด้วยค่าตัวอย่าง
 * ความผิดพลาดคลาสสิกของการ deploy คือลืมเปลี่ยนค่า default ที่ติดมากับ .env.example
 * ล้มตอนบูตดังกว่าและปลอดภัยกว่าการรันต่อไปเงียบ ๆ ด้วย secret ที่ใคร ๆ ก็เดาได้
 */

const PLACEHOLDER_SECRETS = [
  'change-this-to-a-long-random-string',
  'secret',
  'changeme',
];

const EXAMPLE_DB_PASSWORDS = ['reservation_pw', 'rootpass', 'password'];

/**
 * ต้นทุนการ hash รหัสผ่าน — ใช้ร่วมกันทุกจุด (login, เปลี่ยนรหัส, สร้างผู้ใช้,
 * hash หลอกกันเดา username และสคริปต์ hash-password)
 * อยู่ในไฟล์นี้เพราะไม่ผูกกับฐานข้อมูล สคริปต์ CLI จึง import ได้โดยไม่ลาก pool มาด้วย
 */
export const BCRYPT_ROUNDS = 12;

export const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * ค่าที่จะส่งให้ app.set('trust proxy', ...)
 *
 * ต้องเข้าใจข้อจำกัดของกลไกนี้: Express เชื่อ X-Forwarded-For จาก "ใครก็ตามที่ต่อเข้ามาตรง ๆ"
 * เมื่อเปิด trust proxy ไว้ ดังนั้นขอบเขตความปลอดภัยจริงคือ "ต้องมีแต่ nginx เท่านั้นที่ต่อพอร์ตนี้ได้"
 * (BIND_HOST=127.0.0.1 + firewall) ไม่ใช่ตัวเลข hop ที่ตั้งไว้ตรงนี้
 *
 * บน development จึงตั้งเป็น false ไว้ — เครื่อง dev เปิดพอร์ตให้ต่อตรงได้
 * ถ้าเชื่อ header ด้วยจะกลายเป็นว่าใครก็ปลอม IP ข้าม rate limit ได้ฟรี ๆ
 */
export function trustProxySetting() {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined || raw === '') return isProduction() ? 1 : false;
  if (raw === 'false' || raw === '0') return false;
  if (raw === 'true') return true;
  const hops = Number(raw);
  return Number.isInteger(hops) ? hops : raw; // ตัวเลข = จำนวน hop, ข้อความ = IP/subnet ที่เชื่อ
}

export function validateConfig() {
  const problems = [];
  const prod = isProduction();

  const jwtSecret = process.env.JWT_SECRET || '';
  if (!jwtSecret) {
    problems.push('JWT_SECRET ยังไม่ได้ตั้งค่า');
  } else if (prod) {
    if (jwtSecret.length < 32) {
      problems.push('JWT_SECRET สั้นเกินไป (ต้องอย่างน้อย 32 ตัวอักษร)');
    }
    if (PLACEHOLDER_SECRETS.includes(jwtSecret)) {
      problems.push('JWT_SECRET ยังเป็นค่าตัวอย่าง — ต้องเปลี่ยนเป็นค่าสุ่มของตัวเอง');
    }
  }

  if (prod) {
    const origin = process.env.CLIENT_ORIGIN || '';
    if (!origin) {
      problems.push('CLIENT_ORIGIN ยังไม่ได้ตั้งค่า (ต้องเป็นโดเมนจริงของหน้าเว็บ)');
    } else if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      problems.push(`CLIENT_ORIGIN ยังชี้ไปที่ localhost (${origin})`);
    } else if (!origin.startsWith('https://')) {
      problems.push('CLIENT_ORIGIN ต้องขึ้นต้นด้วย https:// บน production');
    }

    if (EXAMPLE_DB_PASSWORDS.includes(process.env.DB_PASSWORD || '')) {
      problems.push('DB_PASSWORD ยังเป็นรหัสตัวอย่างจาก docker-compose');
    }

    if (!process.env.ADMIN_PASSWORD_HASH && !process.env.BOOTSTRAP_ADMIN_USERNAME) {
      // ไม่ใช่ปัญหาถ้ามีบัญชีใน DB อยู่แล้ว — bootstrap.js จะโยน error เองถ้าจำเป็นต้องใช้
    }
  }

  if (problems.length > 0) {
    const list = problems.map((p) => `  - ${p}`).join('\n');
    throw new Error(`ค่าตั้งค่าไม่ปลอดภัยสำหรับการใช้งานจริง:\n${list}\n\nแก้ไฟล์ .env แล้วเริ่มใหม่`);
  }
}
