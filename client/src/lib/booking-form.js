export function isValidBookingDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const parts = value.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return (
    date.getFullYear() === parts[0] &&
    date.getMonth() === parts[1] - 1 &&
    date.getDate() === parts[2]
  );
}

export function bookingErrors(form) {
  const errors = {};
  if (!isValidBookingDate(form.date)) errors.date = "dateErr";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time || ""))
    errors.time = "timeErr";
  if (!String(form.name || "").trim()) errors.name = "nameErr";
  const seats = Number(form.seats);
  if (!Number.isInteger(seats) || seats < 1 || seats > 4294967295)
    errors.seats = "seatsErr";
  const digits = String(form.phone || "").replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 10) errors.phone = "phoneErr";
  return errors;
}
