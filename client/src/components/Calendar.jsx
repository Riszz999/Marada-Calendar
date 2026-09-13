import { useEffect, useRef } from "react";
import { useLang } from "../context/LangContext";
import {
  EN_WD,
  THAI_WD,
  EN_MONTHS,
  THAI_MONTHS,
  longDate,
  monthLabel,
} from "../i18n";
import { dateKey, todayKey } from "../lib/date";
import Icon from "./Icon";

export default function Calendar({
  year,
  month,
  selectedDate,
  bookedDates,
  requestedDates,
  loading,
  requestLoading = false,
  refreshing = false,
  loadError,
  onSelect,
  onPrev,
  onNext,
  skeleton = false,
}) {
  const { lang, t } = useLang();
  const grid = useRef(null);
  const focusAfterMonthChange = useRef(false);
  const weekdays = lang === "th" ? THAI_WD : EN_WD;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const today = todayKey();
  const Nav = skeleton ? 'span' : 'button';
  const focusDate = selectedDate?.startsWith(dateKey(year, month, 1).slice(0, 8))
    ? selectedDate
    : dateKey(year, month, 1);

  useEffect(() => {
    if (!focusAfterMonthChange.current) return;
    grid.current?.querySelector('[tabindex="0"]')?.focus({ preventScroll: true });
    focusAfterMonthChange.current = false;
  }, [year, month, focusDate]);

  function moveFocus(e, day) {
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let target;
    if (e.key in offsets) target = day + offsets[e.key];
    else if (e.key === "Home") target = 1;
    else if (e.key === "End") target = daysInMonth;
    else return;
    e.preventDefault();
    const bounded = Math.max(1, Math.min(target, daysInMonth));
    onSelect(dateKey(year, month, bounded));
    grid.current?.querySelector('[data-day="' + bounded + '"]')?.focus();
  }

  return (
    <section className={'calendar' + (skeleton ? ' is-skeleton' : '')} aria-hidden={skeleton || undefined} aria-labelledby={skeleton ? undefined : 'calendar-month'}>
      <div className="calendar-toolbar">
        <Nav
          type={skeleton ? undefined : 'button'}
          className="calendar-nav"
          onClick={skeleton ? undefined : onPrev}
          aria-label={skeleton ? undefined : t("prevMonth")}
        >
          <Icon name="left" />
        </Nav>
        <h2 id={skeleton ? undefined : 'calendar-month'} aria-live={skeleton ? undefined : 'polite'}>
          <span>{(lang === "th" ? THAI_MONTHS : EN_MONTHS)[month]}</span>{" "}
          <small>{lang === "th" ? `พ.ศ. ${year + 543}` : year}</small>
        </h2>
          <Nav
            type={skeleton ? undefined : 'button'}
            className="calendar-nav"
            onClick={skeleton ? undefined : onNext}
            aria-label={skeleton ? undefined : t("nextMonth")}
          >
            <Icon name="right" />
          </Nav>
      </div>
      <div className="calendar-sheet">
        <div className="weekdays" aria-hidden="true">
          {weekdays.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div
          className="days"
          ref={grid}
          role="group"
          aria-label={monthLabel(lang, year, month)}
          aria-busy={loading || requestLoading || refreshing}
        >
          {Array.from({ length: totalCells }, (_, i) => {
            if (skeleton) return <div className="day" key={i}><span className="day-face skeleton" /></div>;
            const day = i - firstDay + 1;
            if (day < 1 || day > daysInMonth) {
              const adjacent = new Date(year, month, day);
              const adjacentKey = dateKey(adjacent.getFullYear(), adjacent.getMonth(), adjacent.getDate());
              return (
                <button
                  type="button"
                  className="day-empty"
                  key={i}
                  data-date={adjacentKey}
                  aria-label={longDate(lang, adjacentKey)}
                  onClick={() => {
                    focusAfterMonthChange.current = true;
                    onSelect(adjacentKey);
                  }}
                >
                  <span className="day-face">
                    <span className="day-number">{adjacent.getDate()}</span>
                  </span>
                </button>
              );
            }
            const key = dateKey(year, month, day);
            const hasBooking = !loading && !loadError && bookedDates.has(key);
            const hasRequest = requestedDates?.has(key);
            return (
              <button
                key={i}
                type="button"
                data-day={day}
                className={
                  "day" +
                  (key === today ? " is-today" : "") +
                  (key === selectedDate ? " is-selected" : "")
                }
                aria-pressed={key === selectedDate}
                aria-current={key === today ? "date" : undefined}
                aria-label={
                  longDate(lang, key) +
                  " · " +
                  (loading || requestLoading
                    ? t("loading")
                    : loadError
                      ? t("calendarUnavailable")
                      : hasBooking
                        ? t("hasBookings")
                        : t("noBookings")) + (hasRequest?' · '+t('requestPending'):'')
                }
                tabIndex={key === focusDate ? 0 : -1}
                onClick={() => onSelect(key)}
                onKeyDown={(e) => moveFocus(e, day)}
              >
                <span className="day-face">
                  <span className="day-number">{day}</span>
                  <span className="day-markers" aria-hidden="true">
                    {hasBooking && <span className="day-marker has-booking" />}
                    {hasRequest && <span className="day-marker has-request" />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className={"calendar-state" + (!loadError ? " sr-only" : "")} role="status">
        {loadError ? t("calendarUnavailable") : loading || requestLoading ? t("loading") : ""}
      </div>
    </section>
  );
}
