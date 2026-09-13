import { useEffect, useRef, useState } from 'react';
import { StaffKeySkeleton } from './Skeleton';
import { validateRead } from '../lib/read-state';
import Modal from './Modal';
import { api } from '../api';
import { useLang } from '../context/LangContext';
import { errorMessage } from '../lib/errors';
import ActionButton from './ActionButton';
import { useActionFeedback } from '../lib/use-action-feedback';

/**
 * สุ่ม key ที่อ่านและบอกต่อทางโทรศัพท์ได้ — ตัด 0/O/1/l/I ออกกันอ่านผิด
 * ใช้ crypto.getRandomValues ไม่ใช่ Math.random เพราะนี่คือความลับจริง
 */
function randomKey() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  const chars = [...bytes].map((n) => alphabet[n % alphabet.length]);
  // คั่นเป็นกลุ่มละ 4 ให้อ่านออกเสียงง่าย
  return chars.join('').replace(/(.{4})(?=.)/g, '$1-');
}

/**
 * แอดมินตั้ง/เปลี่ยน/ลบ access key ของพนักงาน
 * key ถูกเก็บเป็น bcrypt hash — ย้อนดูของเดิมไม่ได้ จึงต้องโชว์ตอนตั้งครั้งนั้นครั้งเดียว
 */
export default function StaffKeyAdminModal({ onClose }) {
  const { t } = useLang();

  const [status, setStatus] = useState(null);   // { configured, updatedAt }
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState('');
  const [savedKey, setSavedKey] = useState(''); // key ที่เพิ่งบันทึก — โชว์ครั้งเดียว
  const [editing, setEditing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const cancelClearButton = useRef(null);
  const overview = useRef(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { status: feedback, busy, begin, succeed, fail } = useActionFeedback(onClose, { closeOnSuccess: false });

  async function load() {
    setLoading(true);
    try {
      const current = validateRead('staffKey',await api.getStaffKey());
      setStatus(current);
      setSavedKey(current.key || '');
      setError('');
    } catch (err) {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (confirmingClear) cancelClearButton.current?.focus({ preventScroll: true });
  }, [confirmingClear]);

  function returnToOverview() {
    setConfirmingClear(false);
    setError('');
    requestAnimationFrame(() => {
      const container = overview.current;
      (container?.querySelector('[data-action="clear"]') || container?.querySelector('button'))?.focus({ preventScroll: true });
    });
  }

  useEffect(() => {
    if (confirmingClear && status && !status.configured && feedback.phase === 'idle') returnToOverview();
  }, [confirmingClear, status, feedback.phase]);

  async function handleSave(e) {
    e.preventDefault();
    if (busy || loading || !status) return;
    setError('');
    if (key.trim().length < 8) return setError(t('staffKeyTooShort'));
    if (!begin()) return;
    try {
      setStatus(await api.setStaffKey(key.trim(), currentPassword));
      setSavedKey(key.trim());
      setKey('');
      setEditing(false);
      setCurrentPassword('');
      setShowPassword(false);
      succeed(t('doneSaved'));
    } catch (err) {
      setError(errorMessage(err, t));
      setCurrentPassword('');
      fail();
    }
  }

  async function handleClear() {
    if (busy || loading || !status?.configured || !confirmingClear) return;
    setError('');
    if (!begin('clear')) return;
    try {
      await api.clearStaffKey();
      setStatus({ configured: false, updatedAt: null });
      setSavedKey('');
      setKey('');
      succeed(t('staffKeyCleared'), 'danger');
    } catch (err) {
      setError(errorMessage(err, t));
      fail();
    }
  }

  async function handleCopy() {
    const afterSave = feedback.phase === 'success' && feedback.action === 'save';
    if (busy && !afterSave) return;
    if (!navigator.clipboard) return setError(t('staffKeyCopyFailed'));
    if (!begin('copy', afterSave)) return;
    setError('');
    try {
      await navigator.clipboard.writeText(savedKey);
      succeed(t('doneCopied'), 'success');
    } catch { setError(t('staffKeyCopyFailed')); fail(); }
  }

  return (
    <Modal title={t(confirmingClear ? 'staffKeyConfirmClearTitle' : 'staffKeyAdminTitle')}
      subtitle={confirmingClear ? undefined : t('staffKeyAdminSub')}
      className={confirmingClear ? 'staff-clear-modal' : ''}
      role={confirmingClear ? 'alertdialog' : undefined}
      describedBy={confirmingClear ? 'staff-clear-description' : undefined}
      onClose={confirmingClear ? returnToOverview : editing ? () => { setEditing(false); setError(''); setCurrentPassword(''); setShowPassword(false); } : onClose}
      busy={confirmingClear ? busy : feedback.phase === 'pending'}>
      {confirmingClear ? <div className="staff-clear-confirmation">
        <p id="staff-clear-description">{t('staffKeyConfirmClear')}</p>
        <p className="hint">{t('staffKeyClearRecovery')}</p>
        {error && <div className="toast error" role="alert">{error}</div>}
        <div className="delete-confirm-actions">
          <button ref={cancelClearButton} type="button" className="cancel-btn" disabled={busy} onClick={returnToOverview}>{t('cancel')}</button>
          <ActionButton className="danger-btn staff-clear-submit" status={feedback} action="clear" pendingLabel={t('staffKeyClearing')} onClick={handleClear}>{t('staffKeyClear')}</ActionButton>
        </div>
      </div> : <>
      {loading && !status ? (
        <StaffKeySkeleton />
      ) : status && (
        <div className="key-status">
          {status?.configured ? (
            <>
              <span className="key-status-on">{t('staffKeyOn')}</span>
              <span className="hint">{t('staffKeyUpdatedAt')} {new Date(status.updatedAt).toLocaleString()}</span>
            </>
          ) : (
            <>
              <span className="key-status-off">{t('staffKeyOff')}</span>
              <span className="hint">{t('staffKeyOffHint')}</span>
            </>
          )}
        </div>
      )}

      {!editing && savedKey && (
        <div className="key-reveal">
          <div className="sub-form-title">{t('staffKeyReveal')}</div>
          <div className="key-copy-row">
            <code className="key-reveal-value">{savedKey}</code>
            <ActionButton className="primary-btn key-copy-btn" status={feedback} action="copy" pendingLabel={t('copying')} allowAfterSuccess={feedback.action === 'save'} onClick={handleCopy}>
              {t('staffKeyCopy')}
            </ActionButton>
          </div>
          <div className="hint">{t('staffKeyRevealHint')}</div>
        </div>
      )}

      {!loading && status && !editing && (
        <div ref={overview} className="staff-key-overview staff-key-form">
          {status.configured && !savedKey && <p className="hint">{t('staffKeyExistingHint')}</p>}
          <div className="btn-row">
            <ActionButton className={savedKey ? 'cancel-btn' : 'submit-btn'} status={feedback} onClick={() => { setEditing(true); setError(''); }}>
              {t(status.configured ? 'staffKeyChange' : 'staffKeySet')}
            </ActionButton>
            {(status.configured || (feedback.action === 'clear' && feedback.phase === 'success')) && (
              <ActionButton className="cancel-btn danger-btn" status={feedback} action="clear" data-action="clear" onClick={() => { setError(''); setConfirmingClear(true); }}>
                {t('staffKeyClear')}
              </ActionButton>
            )}
          </div>
        </div>
      )}

      {editing && <form onSubmit={handleSave} className="sub-form staff-key-form">
        <div className="sub-form-title">{status?.configured ? t('staffKeyChange') : t('staffKeySet')}</div>
        {status?.configured && <div className="hint" style={{ marginBottom: 10 }}>{t('staffKeyChangeNote')}</div>}
        <div className="field">
          <label htmlFor="k-new">{t('staffKeyLabel')}</label>
          <input
            id="k-new" type="text" autoComplete="off" autoFocus disabled={busy || loading || !status}
            value={key} onChange={(e) => setKey(e.target.value)}
            placeholder={t('staffKeyNewPh')}
          />
        </div>
        <div className="field">
          <label htmlFor="k-admin-password">{t('staffKeyAdminPassword')}</label>
          <div className="password-input">
            <input id="k-admin-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
              required disabled={busy} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
            <button type="button" className="password-toggle" disabled={busy}
              onPointerDown={e => e.preventDefault()} onClick={() => setShowPassword(value => !value)}
              aria-label={t(showPassword ? 'hidePassword' : 'showPassword')}
              aria-pressed={showPassword}>{t(showPassword ? 'hide' : 'show')}</button>
          </div>
        </div>
        <div className="btn-row">
          <ActionButton type="submit" status={feedback} pendingLabel={t('saving')} disabled={loading || !status || !currentPassword || key.trim().length < 8 || key.trim() === savedKey}>{t(status?.configured ? 'staffKeyChange' : 'save')}</ActionButton>
          <button type="button" className="cancel-btn" disabled={busy || loading || !status} onClick={() => setKey(randomKey())}>
            {t('staffKeyGenerate')}
          </button>
        </div>
      </form>}
      {error && <div className="toast error" role="alert">{error}{!status && <button type="button" className="cancel-btn" onClick={load}>{t('retry')}</button>}</div>}
      </>}
    </Modal>
  );
}
