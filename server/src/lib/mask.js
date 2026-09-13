/**
 * ระดับการมองเห็นข้อมูลการจอง — เรียงจากเห็นน้อยไปมาก
 *   guest = ลูกค้าทั่วไป เห็นแค่ว่าเวลาไหนถูกจองไปแล้ว
 *   staff = พนักงานที่กรอก access key เห็นทุกอย่างแต่เบอร์ถูกปิดบัง
 *   admin = ล็อกอินด้วยบัญชีผู้ดูแล เห็นเบอร์เต็ม
 */
export const VIEW_GUEST = 'guest';
export const VIEW_STAFF = 'staff';
export const VIEW_ADMIN = 'admin';

/**
 * ปิดบังเบอร์โทร: เก็บ 3 ตัวแรกและ 4 ตัวท้าย -> 081-xxx-5678
 * เบอร์ที่สั้นเกินกว่าจะปิดบังได้อย่างปลอดภัย จะถูกซ่อนทั้งหมด
 */
export function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 8) return 'xxx-xxx-xxxx';
  return `${digits.slice(0, 3)}-xxx-${digits.slice(-4)}`;
}

/**
 * จุดเดียวที่แถวจากฐานข้อมูลถูกแปลงเป็น JSON สำหรับส่งออก
 * ทุก route ต้องเรียกผ่านฟังก์ชันนี้ เพื่อไม่ให้ข้อมูลหลุดไปหาคนที่ไม่มีสิทธิ์เห็น
 *
 * สำคัญ: ระดับที่ต่ำกว่าต้องไม่มีฟิลด์นั้นอยู่ใน object เลย ไม่ใช่ส่งไปแล้วให้ client ซ่อน
 * และ level ที่ไม่รู้จักต้องตกมาเป็น guest เสมอ (fail closed)
 */
export function serializeReservation(row, level) {
  const base = {
    id: row.id,
    date: row.reserved_date,
    time: String(row.reserved_time).slice(0, 5), // 'HH:MM:SS' -> 'HH:MM'
    // ร้านมีหลายโต๊ะ ลูกค้าจึงต้องเห็นว่าโต๊ะไหนถูกจองไปแล้ว ไม่งั้นรู้แค่เวลาก็วางแผนไม่ได้
    // เป็นข้อความที่แอดมินพิมพ์เอง (ร้านมีโต๊ะเยอะเกินกว่าจะลงทะเบียนไว้ล่วงหน้า)
    // ผลตามมา: ช่องนี้เป็นข้อมูลสาธารณะ — ฟอร์มฝั่งแอดมินจึงต้องเตือนไว้
    zone: row.zone || '',
  };

  if (level !== VIEW_STAFF && level !== VIEW_ADMIN) return base;

  return {
    ...base,
    name: row.customer_name,
    seats: row.seats,
    phone: level === VIEW_ADMIN ? row.phone : maskPhone(row.phone),
    phoneMasked: level !== VIEW_ADMIN,
    food: row.food_order || '',
  };
}
