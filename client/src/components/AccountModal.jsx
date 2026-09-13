import { useState } from 'react';
import Modal from './Modal';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { errorMessage } from '../lib/errors';
import ActionButton from './ActionButton';
import { useActionFeedback } from '../lib/use-action-feedback';

/** ตั้งค่าบัญชีของตัวเอง — เปลี่ยน username และ/หรือ รหัสผ่าน ในฟอร์มเดียว */
export default function AccountModal({ onClose }) {
  const { t } = useLang();
  const { admin, applySession } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const { status, busy, begin, succeed, fail } = useActionFeedback(onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError('');

    const wantsUsername = username.trim() !== '' && username.trim() !== admin.username;
    const wantsPassword = newPassword !== '';

    if (!wantsUsername && !wantsPassword) return setError(t('nothingToUpdate'));
    if (!currentPassword) return setError(t('currentPasswordErr'));
    if (wantsPassword && newPassword !== confirm) return setError(t('confirmMismatch'));
    if (wantsPassword && newPassword.length < 8) return setError(t('passwordTooShort'));

    if (!begin()) return;
    try {
      const body = { currentPassword };
      if (wantsUsername) body.username = username.trim();
      if (wantsPassword) body.newPassword = newPassword;

      // server คืน token ใบใหม่มาด้วยเสมอ — ต้องสลับมาใช้ทันที
      // ไม่งั้นการเปลี่ยนรหัส (ซึ่ง bump token_version) จะเตะเครื่องตัวเองออกไปด้วย
      const { user, token } = await api.updateMe(body);
      applySession(token, user);
      succeed(t('doneUpdated'), 'success');
    } catch (err) {
      setError(errorMessage(err, t));
      fail();
    }
  }

  return (
    <Modal title={t('accountTitle')} subtitle={t('accountSub')} onClose={onClose} busy={busy}>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="a-current">{t('currentPassword')}</label>
          <input
            id="a-current" type="password" autoComplete="current-password" autoFocus disabled={busy}
            value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={t('currentPasswordPh')}
          />
        </div>

        <div className="field">
          <label htmlFor="a-username">{t('newUsername')}</label>
          <input
            id="a-username" type="text" autoComplete="username" disabled={busy}
            value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder={admin?.username}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="a-new">{t('newPassword')}</label>
            <input
              id="a-new" type="password" autoComplete="new-password" disabled={busy}
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('newPasswordPh')}
            />
          </div>
          <div className="field">
            <label htmlFor="a-confirm">{t('confirmPassword')}</label>
            <input
              id="a-confirm" type="password" autoComplete="new-password" disabled={busy}
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </div>

        {error && <div className="toast error" role="alert"><span>!</span><span>{error}</span></div>}

        <div className="btn-row">
          <ActionButton type="submit" status={status} pendingLabel={t('saving')}>{t('save')}</ActionButton>
        </div>
      </form>
    </Modal>
  );
}
