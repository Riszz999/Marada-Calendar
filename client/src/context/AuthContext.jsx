import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '../api';
import { watchStaffSession } from '../lib/session-watch';

const AuthContext = createContext(null);

/** ต้องตรงกับค่าใน server/src/lib/mask.js */
export const LEVEL_GUEST = 'guest';
export const LEVEL_STAFF = 'staff';
export const LEVEL_ADMIN = 'admin';

export function AuthProvider({ children }) {
  const [level, setLevel] = useState(LEVEL_GUEST);
  const [admin, setAdmin] = useState(null);   // { id, username } เฉพาะตอน level = admin
  const [checking, setChecking] = useState(true);
  const [expiredNotice, setExpiredNotice] = useState(false);

  useEffect(() => {
    if (level !== LEVEL_STAFF) return undefined;
    const watchedToken = getToken();
    return watchStaffSession({
      check: api.session,
      getToken,
      onExpired: () => {
        if (getToken() === watchedToken) setToken(null);
        setAdmin(null);
        setLevel(LEVEL_GUEST);
        setExpiredNotice(true);
      },
    });
  }, [level]);

  const logout = useCallback(() => {
    setToken(null);
    setAdmin(null);
    setLevel(LEVEL_GUEST);
  }, []);

  // token ใน localStorage อาจหมดอายุหรือถูกยกเลิกไปแล้ว (token_version / key_version เดินหน้า)
  // ต้องถาม server ก่อนว่าตอนนี้ token ใบนี้ให้สิทธิ์ระดับไหน
  useEffect(() => {
    let cancelled = false;
    if (!getToken()) {
      setChecking(false);
      return undefined;
    }
    api.session()
      .then(({ level: lv, user }) => {
        if (cancelled) return;
        if (lv === LEVEL_GUEST) {
          // token ตายแล้ว — ทิ้งไปเงียบ ๆ ไม่ต้องขึ้นเตือน เพราะผู้ใช้ยังไม่ได้ทำอะไร
          setToken(null);
          return;
        }
        setLevel(lv);
        setAdmin(user ?? null);
      })
      .catch(() => !cancelled && logout())
      .finally(() => !cancelled && setChecking(false));
    return () => { cancelled = true; };
  }, [logout]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (getToken()) setExpiredNotice(true);
      logout();
    });
  }, [logout]);

  const login = useCallback(async (username, password) => {
    const { token, user } = await api.login(username, password);
    setToken(token);
    setAdmin(user);
    setLevel(LEVEL_ADMIN);
    setExpiredNotice(false);
  }, []);

  /** พนักงานกรอก access key — ใช้ token slot เดียวกับแอดมิน (เข้าโหมดไหนก็ทับของเดิม) */
  const staffLogin = useCallback(async (key) => {
    const { token } = await api.staffLogin(key);
    setToken(token);
    setAdmin(null);
    setLevel(LEVEL_STAFF);
    setExpiredNotice(false);
  }, []);

  /**
   * รับ token ใบใหม่หลังเปลี่ยนรหัสผ่าน/ชื่อผู้ใช้
   * เปลี่ยนรหัสจะทำให้ token เก่าทุกใบใช้ไม่ได้ เครื่องนี้จึงต้องสลับมาใช้ใบใหม่ทันที
   */
  const applySession = useCallback((token, user) => {
    if (token) setToken(token);
    if (user) setAdmin(user);
  }, []);

  const value = useMemo(
    () => ({
      level,
      admin,
      isAdmin: level === LEVEL_ADMIN,
      isStaff: level === LEVEL_STAFF,
      /** เห็นรายละเอียดการจองไหม (ชื่อ/ที่นั่ง/เบอร์/โซน/อาหาร) — guest ไม่เห็น */
      canSeeDetails: level === LEVEL_STAFF || level === LEVEL_ADMIN,
      checking,
      login,
      staffLogin,
      logout,
      applySession,
      expiredNotice,
      clearExpiredNotice: () => setExpiredNotice(false),
    }),
    [level, admin, checking, login, staffLogin, logout, applySession, expiredNotice]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
