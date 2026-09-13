import { withReadTimeout } from './lib/read-timeout';
const TOKEN_KEY = 'reservation_admin_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

/** ตัวจัดการ 401 ที่ AuthProvider ลงทะเบียนไว้ — token หมดอายุแล้วให้เด้งกลับเป็นโหมดดูอย่างเดียว */
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

function request(path, options = {}) {
  return (options.method || 'GET') === 'GET'
    ? withReadTimeout(signal => performRequest(path, { ...options, signal }), options.signal)
    : performRequest(path, options);
}

async function performRequest(path, { method = 'GET', body, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    signal,
    cache: 'no-store',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // /auth/login กับ /auth/staff คือการ 'พยายามเข้าระบบ' — 401 แปลว่ากรอกผิด ไม่ใช่ session หมดอายุ
  if (res.status === 401 && token === getToken() && path !== '/auth/login' && path !== '/auth/staff') {
    onUnauthorized();
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  bookingRequestFeed: (kind, query, signal) => request('/admin/booking-requests'+(kind==='summary'?'/summary':'')+'?'+query,{signal}),
  getBookingRequest: id => request('/admin/booking-requests/'+id),
  reviewBookingRequest: (id, data) => request('/admin/booking-requests/'+id,{method:'PATCH',body:data}),
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  me: () => request('/auth/me'),
  /** แลก access key ของพนักงานเป็น token -> { token, level } */
  staffLogin: (key) => request('/auth/staff', { method: 'POST', body: { key } }),
  /** token ที่ถืออยู่ให้สิทธิ์ระดับไหน -> { level, user } (ตอบ 200 เสมอ) */
  session: (signal) => request('/auth/session', { signal }),
  /** body: { currentPassword, username?, newPassword? } -> { user, token } */
  updateMe: (body) => request('/auth/me', { method: 'PATCH', body }),

  listUsers: () => request('/admin/users'),
  createUser: (username, password) => request('/admin/users', { method: 'POST', body: { username, password } }),
  updateUser: (id, body) => request(`/admin/users/${id}`, { method: 'PATCH', body }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),

  /** Admin-only: current code decrypted on the server; never cached. */
  getStaffKey: () => request('/admin/staff-key'),
  setStaffKey: (key, currentPassword) => request('/admin/staff-key', { method: 'PUT', body: { key, currentPassword } }),
  clearStaffKey: () => request('/admin/staff-key', { method: 'DELETE' }),

  listReservations: (from, to) => request(`/reservations?from=${from}&to=${to}`),
  createReservation: (data) => request('/reservations', { method: 'POST', body: data }),
  updateReservation: (id, data) => request(`/reservations/${id}`, { method: 'PUT', body: data }),
  deleteReservation: (id) => request(`/reservations/${id}`, { method: 'DELETE' }),
};
