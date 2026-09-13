import PendingButton from "./PendingButton";
import { useState } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { errorMessage } from '../lib/errors';

/** พนักงานกรอก access key ที่แอดมินให้มา เพื่อดูรายละเอียดการจอง */
export default function StaffKeyModal({ onClose }) {
  const { t } = useLang();
  const { staffLogin } = useAuth();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await staffLogin(key.trim());
      onClose();
    } catch (err) {
      setError(errorMessage(err, t, { throttleKey: 'staffKeyThrottled' }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t('staffKeyTitle')} subtitle={t('staffKeySub')} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className={`field${error ? ' invalid' : ''}`}>
          <label htmlFor="s-key">{t('staffKeyLabel')}</label>
          <input
            id="s-key"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={t('staffKeyPh')}
            autoComplete="off"
            autoFocus
          />
          {error ? <div className="err">{error}</div> : <div className="hint">{t('staffKeyHint')}</div>}
        </div>
        <div className="btn-row">
          <PendingButton pending={busy} pendingLabel={t("signingIn")} type="submit" className="submit-btn" disabled={busy || !key.trim()}>
            {t("staffKeyEnter")}
          </PendingButton>
        </div>
      </form>
    </Modal>
  );
}
