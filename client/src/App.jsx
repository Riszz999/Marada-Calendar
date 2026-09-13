import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { useAuth } from "./context/AuthContext";
import { useLang } from "./context/LangContext";
import { SessionSkeleton } from "./components/Skeleton";
import { validateRead } from './lib/read-state';
import Calendar from "./components/Calendar";
import ReservationForm from "./components/ReservationForm";
import ReservationList from "./components/ReservationList";
import ReservationDetail from "./components/ReservationDetail";
import LoginModal from "./components/LoginModal";
import AccountModal from "./components/AccountModal";
import UsersModal from "./components/UsersModal";
import StaffKeyAdminModal from "./components/StaffKeyAdminModal";
import AccessScreen from "./components/AccessScreen";
import Icon from "./components/Icon";
import BookingRequestsModal from "./components/BookingRequestsModal";
import { useRequestData } from "./lib/use-request-data";
import { dateKey, monthRange, todayKey } from "./lib/date";

export default function App() {
  const { lang, setLang, t } = useLang();
  const {
    admin,
    level,
    isAdmin,
    isStaff,
    canSeeDetails,
    checking,
    logout,
    expiredNotice,
    clearExpiredNotice,
  } = useAuth();
  const now = new Date();
  const [view, setView] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [reservations, setReservations] = useState([]);
  const [loadedScope, setLoadedScope] = useState("");
  const [readyScope, setReadyScope] = useState("");
  const [loading, setLoading] = useState(true);
  const [bootedLevel, setBootedLevel] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const requestId = useRef(0);
  const successfulScope = useRef('');
  const scope = view.year + "-" + view.month + "-" + level;

  const [theme, setTheme] = useState(() =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );
  const [showLogin, setShowLogin] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showStaffKeyAdmin, setShowStaffKeyAdmin] = useState(false);
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [requestInbox,setRequestInbox]=useState(null);
  const range=monthRange(view.year,view.month);
  const requestSummary=useRequestData('summary',new URLSearchParams(range).toString(),canSeeDetails && !checking,level);
  const accountMenu = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#080808" : "#f5f5f2");
    try {
      localStorage.setItem("marada-ui-theme", theme);
    } catch {
      /* Still usable without storage. */
    }
  }, [theme]);

  useEffect(() => {
    function dismiss(e) {
      if (e.type === "keydown" && e.key !== "Escape") return;
      if (e.type === "pointerdown" && accountMenu.current?.contains(e.target))
        return;
      accountMenu.current?.removeAttribute("open");
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismiss);
    };
  }, []);

  // Ignore responses from a previous month or access level.
  const reload = useCallback(async (options = {}) => {
    const id = ++requestId.current;
    const { from, to } = monthRange(view.year, view.month);
    setLoading(true);
    setLoadError(false);
    if (options.invalidate === true) {
      setReservations([]);setReadyScope('');setLoadedScope('');successfulScope.current='';
    }
    try {
      const rows = validateRead('reservations',await api.listReservations(from, to));
      if (id !== requestId.current) return;
      setReservations(rows);
      setReadyScope(scope);
      successfulScope.current = scope;
      setLoadedScope(scope);
    } catch {
      if (id !== requestId.current) return;
      setLoadError(true);
      if (successfulScope.current !== scope) {
        setReservations([]);
        setReadyScope('');
        successfulScope.current = '';
      }
      setLoadedScope(scope);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [view.year, view.month, scope]);

  useEffect(() => {
    if (!checking && canSeeDetails) reload();
    return () => {
      requestId.current += 1;
    };
  }, [reload, checking, canSeeDetails]);

  useEffect(() => {
    setDetail(null);
    if (!canSeeDetails) {
      setBootedLevel(null);
      setReservations([]);
      setLoadedScope("");
      setReadyScope('');
      successfulScope.current = '';
    }
    if (!isAdmin) {
      setRequestInbox(null);
      setEditing(null);
      setCreating(false);
      setShowAccount(false);
      setShowUsers(false);
      setShowStaffKeyAdmin(false);
    }
  }, [isAdmin, level, canSeeDetails]);

  const rows = loadedScope === scope ? reservations : [];
  const pending = checking || loadedScope !== scope || (loading && readyScope !== scope);
  const refreshing = loading && !pending;
  const startupPending = checking || (canSeeDetails && bootedLevel !== level && (pending || requestSummary.loading));
  useEffect(() => {
    if (!checking && canSeeDetails && !pending && !requestSummary.loading) setBootedLevel(level);
  }, [checking,canSeeDetails,pending,requestSummary.loading,level]);
  const bookedDates = useMemo(() => new Set(rows.map((r) => r.date)), [rows]);
  const dayItems = useMemo(
    () => rows.filter((r) => r.date === selectedDate),
    [rows, selectedDate],
  );
  const requestedDates=useMemo(()=>new Set((requestSummary.data?.days || []).map(d=>d.date)),[requestSummary.data]);
  function requestChanged() {
    requestSummary.refresh({invalidate:true});reload({invalidate:true});
  }

  function selectDate(key) {
    const [year, month] = key.split("-").map(Number);
    setSelectedDate(key);
    setView({ year, month: month - 1 });
  }
  function changeMonth(delta) {
    const next = new Date(view.year, view.month + delta, 1);
    selectDate(dateKey(next.getFullYear(), next.getMonth(), 1));
  }
  async function refreshSavedDate(key) {
    const [year, month] = key.split("-").map(Number);
    selectDate(key);
    if (year === view.year && month - 1 === view.month) await reload({invalidate:true});
  }
  async function handleCreate(data) {
    await api.createReservation(data);
    await refreshSavedDate(data.date);
  }
  async function handleUpdate(data) {
    await api.updateReservation(editing.id, data);
    await refreshSavedDate(data.date);
  }
  async function handleDelete(r) {
    try {
      await api.deleteReservation(r.id);
      await reload({invalidate:true});
      return true;
    } catch {
      return false;
    }
  }
  function menuAction(action) {
    accountMenu.current?.removeAttribute("open");
    accountMenu.current?.querySelector("summary")?.focus();
    action();
  }
  function editReservation(r) {
    setDetail(null);
    setCreating(false);
    setEditing(r);
  }

  return (
    <div className={'app-shell' + (!checking && !canSeeDetails ? ' is-access' : '')}>
      <header className="app-header">
        <div className="header-inner">
          <span className="wordmark">
            Marada<span className="brand-period">.</span>
          </span>
          <div className="header-actions">
            <div
              className="lang-toggle"
              role="group"
              aria-label={t("language")}
            >
              <button
                type="button"
                aria-pressed={lang === "th"}
                onClick={() => setLang("th")}
              >
                ไทย
              </button>
              <button
                type="button"
                aria-pressed={lang === "en"}
                onClick={() => setLang("en")}
              >
                EN
              </button>
            </div>
            <button
              className="icon-btn theme-toggle"
              type="button"
              aria-label={t(theme === "dark" ? "switchLight" : "switchDark")}
              title={t(theme === "dark" ? "switchLight" : "switchDark")}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
            {canSeeDetails && (
              <details className="account-menu" ref={accountMenu}>
                <summary aria-label={t("accountMenu")}>
                  <Icon name="user" width="18" height="18" />
                  <span className="account-name">
                    {isAdmin ? admin?.username : t("staffLogin")}
                  </span>
                  <Icon name="down" width="14" height="14" />
                </summary>
                <div className="account-options">
                  <p>
                    {isAdmin ? admin?.username : t("staffLogin")}
                    <span>{t(isAdmin ? "adminRole" : "staffRole")}</span>
                  </p>
                  {isAdmin ? (
                    <>
                      <button
                        type="button"
                        onClick={() => menuAction(() => setShowAccount(true))}
                      >
                        {t("accountSettings")}
                      </button>
                      <button
                        type="button"
                        onClick={() => menuAction(() => setShowUsers(true))}
                      >
                        {t("manageUsers")}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          menuAction(() => setShowStaffKeyAdmin(true))
                        }
                      >
                        {t("staffKeyMenu")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        menuAction(() => {
                          clearExpiredNotice();
                          setShowLogin(true);
                        })
                      }
                    >
                      {t("loginTitle")}
                    </button>
                  )}
                  <button
                    type="button"
                    className="logout-action"
                    onClick={() => menuAction(logout)}
                  >
                    <Icon name="logout" width="16" height="16" />
                    {t("adminLogout")}
                  </button>
                </div>
              </details>
            )}
          </div>
        </div>
      </header>

      {expiredNotice && (
        <div className="session-notice" role="alert">
          {t("sessionExpired")}
        </div>
      )}
      {startupPending ? (
        <SessionSkeleton year={view.year} month={view.month} date={selectedDate} isStaff={isStaff} />
      ) : !canSeeDetails ? (
        <AccessScreen />
      ) : (
        <main className="workspace">
          <div className="page-heading">
            <div>
              <h1>{t("title")}</h1>
              {isStaff && <p className="role-note">{t("staffRole")}</p>}
            </div>
            <div className="page-heading-actions">
            {canSeeDetails && <button type="button" className="request-inbox-btn" aria-busy={requestSummary.loading || requestSummary.refreshing} onClick={()=>setRequestInbox({date:''})} aria-label={(lang==='th'?'คำขอรออนุมัติ':'Pending requests')+(requestSummary.data ? ` ${requestSummary.data.total}` : '')}>
              {lang==='th'?'รอยืนยัน':'Pending'}
              <span className={'request-inbox-count'+(requestSummary.refreshing?' is-refreshing':'')} aria-hidden="true">{requestSummary.data?.total ?? '—'}</span>
            </button>}
            {isAdmin && (
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  setCreating(true);
                  setEditing(null);
                }}
              >
                <Icon name="plus" width="18" height="18" />
                {t("addReservation")}
              </button>
            )}
            </div>
          </div>
          {loadError && readyScope === scope && <p className="toast error" role="alert">{t('loadError')} <button type="button" className="detail-link" onClick={reload}>{t('retry')}</button></p>}
          <Calendar
            year={view.year}
            month={view.month}
            selectedDate={selectedDate}
            bookedDates={bookedDates}
            requestedDates={requestedDates}
            loading={pending}
            requestLoading={canSeeDetails && requestSummary.loading}
            refreshing={refreshing || requestSummary.refreshing}
            loadError={loadError && readyScope !== scope}
            onSelect={selectDate}
            onPrev={() => changeMonth(-1)}
            onNext={() => changeMonth(1)}
          />
          <ReservationList
            date={selectedDate}
            items={dayItems}
            isAdmin={isAdmin}
            loading={pending}
            refreshing={refreshing}
            loadError={loadError && readyScope !== scope}
            onRetry={reload}
            onOpenDetail={setDetail}
            onEdit={editReservation}
          />
          {canSeeDetails && requestSummary.error && <p className="request-summary-error" role="status">{t('requestCountUnavailable')} <button type="button" className="detail-link" onClick={requestSummary.refresh}>{t('retry')}</button></p>}
        </main>
      )}

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {canSeeDetails && requestInbox && <BookingRequestsModal key={level} readOnly={!isAdmin} initialDate={requestInbox.date} onClose={()=>setRequestInbox(null)} onChanged={requestChanged} />}
      {isAdmin && showAccount && (
        <AccountModal
          onClose={() => setShowAccount(false)}
        />
      )}
      {isAdmin && showUsers && (
        <UsersModal onClose={() => setShowUsers(false)} />
      )}
      {isAdmin && showStaffKeyAdmin && (
        <StaffKeyAdminModal
          onClose={() => setShowStaffKeyAdmin(false)}
        />
      )}
      {canSeeDetails && detail && (
        <ReservationDetail
          reservation={detail}
          onClose={() => setDetail(null)}
        />
      )}
      {isAdmin && (creating || editing) && (
        <ReservationForm
          key={editing?.id || "create"}
          mode={editing ? "edit" : "create"}
          date={editing?.date || selectedDate}
          initial={editing}
          onSubmit={editing ? handleUpdate : handleCreate}
          onDelete={handleDelete}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
