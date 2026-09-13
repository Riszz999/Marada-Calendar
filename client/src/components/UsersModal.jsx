import { useEffect, useState } from "react";
import { UsersSkeleton } from "./Skeleton";
import { validateRead } from '../lib/read-state';
import Modal from "./Modal";
import Icon from "./Icon";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { errorMessage } from "../lib/errors";
import ActionButton from "./ActionButton";
import { useActionFeedback } from "../lib/use-action-feedback";

export default function UsersModal({ onClose }) {
  const { t, lang } = useLang();
  const { admin } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [readFailed, setReadFailed] = useState(false);
  const [error, setError] = useState("");

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const { status, busy, begin, succeed, fail } = useActionFeedback(onClose);

  const [resetTarget, setResetTarget] = useState(null); // ผู้ใช้ที่กำลังรีเซ็ตรหัสให้
  const [resetPassword, setResetPassword] = useState("");

  async function load() {
    setLoading(true);
    try {
      setUsers(validateRead('users',await api.listUsers()));
      setReadFailed(false);
      setError("");
    } catch (err) {
      setReadFailed(true);
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (newPassword.length < 8) return setError(t("passwordTooShort"));
    if (!begin('create')) return;
    try {
      await api.createUser(newUsername.trim(), newPassword);
      succeed(t('doneSaved'));
    } catch (err) {
      setError(errorMessage(err, t));
      fail();
    }
  }

  async function handleDelete(user) {
    if (busy) return;
    if (
      !window.confirm(t("confirmDeleteUser").replace("{name}", user.username))
    )
      return;
    setError("");
    if (!begin('delete:' + user.id)) return;
    try {
      await api.deleteUser(user.id);
      succeed(t('doneDeleted'), 'danger');
    } catch (err) {
      setError(errorMessage(err, t));
      fail();
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (resetPassword.length < 8) return setError(t("passwordTooShort"));
    if (!begin('reset')) return;
    try {
      await api.updateUser(resetTarget.id, { newPassword: resetPassword });
      succeed(t('doneReset'), 'success');
    } catch (err) {
      setError(errorMessage(err, t));
      fail();
    }
  }

  const locale = lang === "th" ? "th-TH" : "en-GB";

  return (
    <Modal title={t("usersTitle")} subtitle={t("usersSub")} onClose={resetTarget ? () => setResetTarget(null) : onClose} busy={busy}>
      {loading && !users.length ? (
        <UsersSkeleton />
      ) : (
        <ul className="user-list">
          {users.map((u) => (
            <li className="user-row" key={u.id}>
              <div className="user-info">
                <span className="user-name">
                  {u.username}
                  {u.id === admin?.id && (
                    <span className="masked-note">{t("youBadge")}</span>
                  )}
                </span>
                <span className="user-date">
                  {t("createdAt")}{" "}
                  {new Date(u.createdAt).toLocaleDateString(locale)}
                </span>
              </div>
              <div className="user-actions">
                <button
                  type="button"
                  className="icon-btn"
                  disabled={busy}
                  title={t("resetPassword")}
                  aria-label={t("resetPassword")}
                  onClick={() => {
                    setResetTarget(u);
                    setResetPassword("");
                    setError("");
                  }}
                >
                  <Icon name="lock" />
                </button>
                {/* ลบบัญชีตัวเองไม่ได้ — ซ่อนปุ่มไปเลยแทนที่จะให้กดแล้วค่อยขึ้น error */}
                {u.id !== admin?.id && (
                  <ActionButton
                    type="button"
                    className="icon-btn danger"
                    status={status} action={'delete:' + u.id} pendingLabel={t('deleting')}
                    title={t("remove")}
                    aria-label={t("remove")}
                    onClick={() => handleDelete(u)}
                  >
                    <Icon name="close" />
                  </ActionButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {readFailed && !loading && <p className="toast error" role="alert">{error} <button type="button" className="detail-link" onClick={load}>{t('retry')}</button></p>}
      {!loading && !readFailed && (resetTarget ? (
        <form onSubmit={handleReset} className="sub-form">
          <div className="sub-form-title">
            {t("resetPasswordFor").replace("{name}", resetTarget.username)}
          </div>
          <div className="hint" style={{ marginBottom: 10 }}>
            {t("resetPasswordNote")}
          </div>
          <div className="field">
            <label htmlFor="u-reset">{t("newPassword")}</label>
            <input
              id="u-reset"
              type="password"
              autoComplete="new-password"
              autoFocus
              disabled={busy}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder={t("newPasswordPh")}
            />
          </div>
          {error && <div className="toast error" role="alert">{error}</div>}
          <div className="btn-row">
            <ActionButton type="submit" status={status} action="reset" pendingLabel={t('saving')}>{t('save')}</ActionButton>
          </div>
        </form>
      ) : (
        <form onSubmit={handleCreate} className="sub-form">
          <div className="sub-form-title">{t("addUser")}</div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="u-name">{t("username")}</label>
              <input
                id="u-name"
                disabled={busy}
                type="text"
                autoComplete="off"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder={t("usernamePh")}
              />
            </div>
            <div className="field">
              <label htmlFor="u-pass">{t("password")}</label>
              <input
                id="u-pass"
                disabled={busy}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("newPasswordPh")}
              />
            </div>
          </div>
          {error && <div className="toast error" role="alert">{error}</div>}
          <ActionButton
            type="submit"
            className="submit-btn"
            status={status} action="create" pendingLabel={t('saving')}
            disabled={busy || !newUsername || !newPassword}
          >
            {t("createUser")}
          </ActionButton>
        </form>
      ) )}
    </Modal>
  );
}
