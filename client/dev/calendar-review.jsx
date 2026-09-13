// Development-only visual fixture. Uses the production Calendar, no API or auth.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Calendar from "../src/components/Calendar";
import { SessionSkeleton } from '../src/components/Skeleton';
import { LangProvider, useLang } from "../src/context/LangContext";
import { dateKey } from "../src/lib/date";
import { longDate } from "../src/i18n";
import "../src/theme.css";

function Review() {
  const now = new Date();
  const { lang, setLang, t } = useLang();
  const [skeleton, setSkeleton] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [loadState, setLoadState] = useState('ready');
  const [theme, setTheme] = useState("dark");
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState(dateKey(now.getFullYear(), now.getMonth(), 11));
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  function move(delta) {
    const next = new Date(view.year, view.month + delta, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
    setSelected(dateKey(next.getFullYear(), next.getMonth(), 1));
  }
  return <>
    <header className="app-header">
      <div className="header-inner">
        <span className="wordmark">Marada<span className="brand-period">.</span></span>
        <div className="header-actions">
          <div className="lang-toggle">
            <button type="button" aria-pressed={lang === "th"} onClick={() => setLang("th")}>ไทย</button>
            <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
          </div>
          <button type="button" className="ghost-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </div>
    </header>
    {skeleton ? <SessionSkeleton {...view} isStaff={isStaff} /> : <main className="workspace">
      <div className="page-heading">
        <div>
          <h1>{lang === "th" ? "ปฏิทินการจอง" : "Calendar"}</h1>
          {isStaff && <p className="role-note">{t('staffRole')}</p>}
        </div>
        <div className="page-heading-actions">
          <button className="request-inbox-btn" type="button">{lang === 'th' ? 'รอยืนยัน' : 'Pending'} <span className="request-inbox-count">0</span></button>
          {!isStaff && <button className="primary-btn" type="button">{t('addReservation')}</button>}
        </div>
      </div>
      <Calendar {...view} selectedDate={selected}
        loading={loadState==='loading'} loadError={loadState==='error'}
        bookedDates={new Set((loadState==='empty'?[]:[2, 6, 11, 20, 28]).map(day => dateKey(view.year, view.month, day)))}
        onSelect={key => {
          const [year, month] = key.split("-").map(Number);
          setSelected(key);
          setView({ year, month: month - 1 });
        }} onPrev={() => move(-1)} onNext={() => move(1)} />
      <section className="agenda" aria-live="polite">
        <h2>{longDate(lang, selected)}</h2>
        <p className="role-note">{lang === "th" ? "แตะวันที่เพื่อดูการเลือกและสถานะของปฏิทิน" : "Select a date to inspect calendar states."}</p>
      </section>
    </main>}
    <aside aria-label="Isolated calendar checks" style={{display:'flex',flexWrap:'wrap',gap:12,padding:20}}>
      <p>Local fixture · no API or production data</p>
      <button type="button" onClick={()=>setSkeleton(!skeleton)}>{skeleton?'Show calendar':'Show skeleton'}</button>
      <button type="button" onClick={()=>setIsStaff(!isStaff)}>{isStaff?'Use admin':'Use staff'}</button>
      <select aria-label="Test month" value={`${view.year}-${view.month}`} onChange={e=>{const [year,month]=e.target.value.split('-').map(Number);setView({year,month});setSelected(dateKey(year,month,1));}}>
        <option value="2026-1">February 2026 · 4 rows</option><option value="2026-8">September 2026 · 5 rows</option><option value="2026-7">August 2026 · 6 rows</option><option value="2028-1">February 2028 · leap year</option><option value="2026-11">December 2026</option>
      </select>
      <select aria-label="Data state" value={loadState} onChange={e=>setLoadState(e.target.value)}>{['ready','loading','empty','error'].map(s=><option key={s}>{s}</option>)}</select>
    </aside>
  </>;
}
createRoot(document.getElementById("root")).render(<LangProvider><Review /></LangProvider>);
