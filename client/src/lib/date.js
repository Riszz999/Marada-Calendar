export function pad(n) {
  return n.toString().padStart(2, '0');
}

export function dateKey(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/** ช่วงเวลาให้บริการ 10:30 - 20:30 ทุกครึ่งชั่วโมง (ยกมาจาก prototype เดิม) */
export function timeSlots() {
  const slots = [];
  for (let h = 10; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 10 && m === 0) continue;
      slots.push(`${pad(h)}:${pad(m)}`);
    }
  }
  return slots;
}

/** วันแรกและวันสุดท้ายของเดือน สำหรับ query ช่วงวันที่ */
export function monthRange(year, month) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return { from: dateKey(year, month, 1), to: dateKey(year, month, lastDay) };
}

export function todayKey() {
  const t = new Date();
  return dateKey(t.getFullYear(), t.getMonth(), t.getDate());
}
