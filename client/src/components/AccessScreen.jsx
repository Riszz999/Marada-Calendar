import PendingButton from "./PendingButton";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { errorMessage } from "../lib/errors";
import Icon from "./Icon";
import { watchFormViewport } from "../lib/form-viewport";

export default function AccessScreen() {
  const screen = useRef(null);
  useEffect(() => watchFormViewport(screen.current), []);
  const { t } = useLang();
  const { login, staffLogin } = useAuth();
  const [role, setRole] = useState("admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const secretInput = useRef(null);
  const visibilityButton = (id) => (
    <button
      type="button"
      className="password-toggle"
      disabled={busy}
      aria-controls={id}
      aria-label={t(showSecret ? 'hidePassword' : 'showPassword')}
      onPointerDown={(event) => {
        if (document.activeElement === secretInput.current) event.preventDefault();
      }}
      onClick={() => setShowSecret(value => !value)}
    >{t(showSecret ? 'hide' : 'show')}</button>
  );
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    setShowSecret(false);
    try {
      if (role === "admin") await login(username.trim(), password);
      else await staffLogin(key.trim());
    } catch (err) {
      setError(
        errorMessage(
          err,
          t,
          role === "staff" ? { throttleKey: "staffKeyThrottled" } : {},
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="access-screen" ref={screen}>
      <h1>{t("accessTitle")}</h1>
      <p className="access-subtitle">{t("accessSubtitle")}</p>
      <div className="access-tabs" role="group" aria-label={t("accessRole")}>
        {["admin", "staff"].map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={role === value}
            disabled={busy}
            onClick={() => {
              setRole(value);
              setShowSecret(false);
              setError("");
            }}
          >
            {t(value === "admin" ? "adminLogin" : "staffLogin")}
          </button>
        ))}
      </div>
      <form onSubmit={submit}>
        {role === "admin" ? (
          <>
            <div className="field">
              <label htmlFor="access-user">{t("username")}</label>
              <input
                id="access-user"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <div className="field">
              <label htmlFor="access-password">{t("password")}</label>
              <div className="password-input">
              <input
                id="access-password"
                ref={secretInput}
                type={showSecret ? 'text' : 'password'}
                autoCapitalize="none"
                spellCheck={false}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={busy}
              />
              {visibilityButton('access-password')}
              </div>
            </div>
          </>
        ) : (
          <div className="field">
            <label htmlFor="access-key">{t("staffKeyLabel")}</label>
            <div className="password-input">
            <input
              id="access-key"
              ref={secretInput}
              type={showSecret ? 'text' : 'password'}
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              disabled={busy}
            />
            {visibilityButton('access-key')}
            </div>
            <p className="hint">{t("staffKeyHint")}</p>
          </div>
        )}
        {error && (
          <p className="toast error" role="alert">
            {error}
          </p>
        )}
        <PendingButton pending={busy} pendingLabel={t("signingIn")} type="submit" className="submit-btn" disabled={busy}>
          {t("login")}
        </PendingButton>
      </form>
      <p className="access-note">
        <Icon name="lock" width="15" height="15" />
        {t("accessNote")}
      </p>
    </main>
  );
}
