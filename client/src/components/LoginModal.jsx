import PendingButton from "./PendingButton";
import { useState } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { errorMessage } from '../lib/errors';

export default function LoginModal({ onClose }) {
  const { t } = useLang();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username.trim(), password);
      onClose();
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t('loginTitle')} subtitle={t('loginSub')} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className={`field${error ? ' invalid' : ''}`}>
          <label htmlFor="f-username">{t('username')}</label>
          <input
            id="f-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('usernamePh')}
            autoComplete="username"
            autoFocus
          />
        </div>
        <div className={`field${error ? ' invalid' : ''}`}>
          <label htmlFor="f-password">{t('password')}</label>
          <input
            id="f-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('passwordPh')}
            autoComplete="current-password"
          />
          {error && <div className="err">{error}</div>}
        </div>
        <div className="btn-row">
          <PendingButton pending={busy} pendingLabel={t("signingIn")} type="submit" className="submit-btn" disabled={busy || !username || !password}>
            {t("login")}
          </PendingButton>
        </div>
      </form>
    </Modal>
  );
}
