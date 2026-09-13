export function beginRead(previous, key, invalidate = false) {
  return { key, data: !invalidate && previous.key === key ? previous.data ?? null : null, error: false, fetching: true };
}

export function readPhase(state, key, enabled = true) {
  if (!enabled) return 'idle';
  if (state.key !== key) return 'loading';
  if (state.error) return 'error';
  if (state.data == null) return 'loading';
  return state.fetching ? 'refreshing' : 'ready';
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const booking = row => object(row) && Number.isSafeInteger(row.id) && date(row.date) && typeof row.time === 'string';
const bookingRequest = row => booking(row) && ['pending','follow_up','confirmed','rejected'].includes(row.status) && count(row.revision) && typeof row.name === 'string' && typeof row.phone === 'string';

export function validateRead(kind, data) {
  const valid = {
    reservations: () => Array.isArray(data) && data.every(booking),
    list: () => object(data) && Array.isArray(data.items) && data.items.every(bookingRequest) && count(data.total) && Number.isSafeInteger(data.page) && data.page > 0 && Number.isSafeInteger(data.pageSize) && data.pageSize > 0,
    summary: () => object(data) && count(data.total) && Array.isArray(data.days) && data.days.every(day => object(day) && date(day.date) && count(day.count)),
    users: () => Array.isArray(data) && data.every(user => object(user) && Number.isSafeInteger(user.id) && typeof user.username === 'string' && typeof user.createdAt === 'string'),
    staffKey: () => object(data) && typeof data.configured === 'boolean' && (data.key == null || typeof data.key === 'string') && (!data.configured || typeof data.updatedAt === 'string'),
  }[kind];
  if (!valid || !valid()) throw new Error('invalid_response');
  return data;
}
