import test from "node:test";
import assert from "node:assert/strict";
import { bookingErrors } from "./booking-form.js";
import { dateKey, monthRange, timeSlots } from "./date.js";

const valid = {
  date: "2026-09-06",
  time: "18:00",
  name: "ตัวอย่าง",
  seats: "4",
  phone: "000-000-0000",
  zone: "",
  food: "",
};

test("optional seating and food do not block a booking", () => {
  assert.deepEqual(bookingErrors(valid), {});
});
test("missing required fields are identified in form order", () => {
  assert.deepEqual(Object.keys(bookingErrors({})), [
    "date",
    "time",
    "name",
    "seats",
    "phone",
  ]);
});
test("calendar dates reject rollover and allow leap days", () => {
  assert.equal(bookingErrors({ ...valid, date: "2026-02-29" }).date, "dateErr");
  assert.equal(bookingErrors({ ...valid, date: "2026-09-31" }).date, "dateErr");
  assert.equal(bookingErrors({ ...valid, date: "2028-02-29" }).date, undefined);
});
test("party size remains a positive integer without a small business cap", () => {
  for (const seats of ["", "0", "-1", "1.5", "NaN", "4294967296"]) {
    assert.equal(bookingErrors({ ...valid, seats }).seats, "seatsErr");
  }
  assert.equal(bookingErrors({ ...valid, seats: "150" }).seats, undefined);
});
test("phone validation accepts formatting but rejects the wrong number of digits", () => {
  assert.equal(
    bookingErrors({ ...valid, phone: "000 000 000" }).phone,
    undefined,
  );
  assert.equal(bookingErrors({ ...valid, phone: "0000" }).phone, "phoneErr");
  assert.equal(
    bookingErrors({ ...valid, phone: "00000000000" }).phone,
    "phoneErr",
  );
});
test("time validation supports existing API records outside the default slots", () => {
  assert.equal(bookingErrors({ ...valid, time: "18:15" }).time, undefined);
  assert.equal(bookingErrors({ ...valid, time: "24:00" }).time, "timeErr");
  assert.equal(bookingErrors({ ...valid, time: "18:60" }).time, "timeErr");
});
test("blank names are rejected and food text is not rewritten by validation", () => {
  const form = { ...valid, food: "กุ้งแม่น้ำ 1 กก.\nต้มยำกุ้ง 1 หม้อ" };
  const before = { ...form };
  assert.deepEqual(bookingErrors(form), {});
  assert.deepEqual(form, before);
  assert.equal(bookingErrors({ ...valid, name: "   " }).name, "nameErr");
});
test("month bounds cover year changes and leap years using local dates", () => {
  assert.deepEqual(monthRange(2026, 11), {
    from: "2026-12-01",
    to: "2026-12-31",
  });
  assert.deepEqual(monthRange(2028, 1), {
    from: "2028-02-01",
    to: "2028-02-29",
  });
  assert.equal(dateKey(2026, 8, 6), "2026-09-06");
  assert.equal(timeSlots()[0], "10:30");
  assert.equal(timeSlots().at(-1), "20:30");
  assert.equal(timeSlots().length, 21);
});
