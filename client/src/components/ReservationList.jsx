import { useLang } from "../context/LangContext";
import { longDate } from "../i18n";
import { ReservationSkeleton, RefreshIndicator } from "./Skeleton";
import Icon from "./Icon";

export default function ReservationList({
  date,
  items,
  isAdmin,
  loading,
  refreshing = false,
  loadError,
  onRetry,
  onOpenDetail,
  onEdit,
  children,
}) {
  const { lang, t } = useLang();
  return (
    <section
      className="agenda"
      aria-labelledby="agenda-title"
      aria-busy={loading || refreshing}
    >
      <div className="agenda-heading">
        <div>
          <h2 id="agenda-title">{t("listTitle")}</h2>
          <p className="agenda-date">{longDate(lang, date)}</p>
        </div>
        {!loading && !loadError && (
          <span className="agenda-count">
            {items.length} {t("bookingUnit")}
          </span>
        )}
      </div>
      <RefreshIndicator active={refreshing}/>
      {loadError ? (
        <div className="empty-state" role="alert">
          <Icon name="calendar" />
          <h3>{t("calendarUnavailable")}</h3>
          <p>{t("loadError")}</p>
          <button className="ghost-btn" type="button" onClick={onRetry}>
            {t("retry")}
          </button>
        </div>
      ) : loading ? (
        <ReservationSkeleton />
      ) : children || (items.length === 0 ? (
        <div className="empty-state">
          <Icon name="calendar" width="28" height="28" />
          <h3>{t("listEmpty")}</h3>
          <p>{isAdmin ? t("emptyAdmin") : t("emptyStaff")}</p>
        </div>
      ) : (
        <div className="reservation-list">
          {items.map((r) => (
            <article
              className="reservation"
              key={r.id}
              aria-label={r.time + " · " + r.name}
            >
              <div className="reservation-heading">
                <div className="reservation-time">
                  <span className="data-label">
                    <Icon name="clock" width="16" height="16" />
                    {t("timeShort")}
                  </span>
                  <strong>{r.time}</strong>
                </div>
                <div className="reservation-seats">
                  <span className="data-label">
                    <Icon name="people" width="17" height="17" />
                    {t("partySize")}
                  </span>
                  <strong>
                    {r.seats}
                    <span> {t("peopleUnit")}</span>
                  </strong>
                </div>
              </div>
              <dl className="reservation-info">
                <div className="reservation-guest">
                  <dt>
                    <Icon name="user" width="17" height="17" />
                    {t("name")}
                  </dt>
                  <dd>{r.name}</dd>
                </div>
                <div className="reservation-phone">
                  <dt>
                    <Icon name="phone" width="17" height="17" />
                    {t("phone")}
                  </dt>
                  <dd>
                    {r.phoneMasked ? (
                      r.phone
                    ) : (
                      <a href={"tel:" + r.phone.replace(/[^+\d]/g, "")}>
                        {r.phone}
                      </a>
                    )}
                    {r.phoneMasked && (
                      <span className="masked-note">{t("phoneMasked")}</span>
                    )}
                  </dd>
                </div>
                <div className="reservation-zone">
                  <dt>
                    <Icon name="seating" width="17" height="17" />
                    {t("zone")}
                  </dt>
                  <dd>{r.zone || t("noZone")}</dd>
                </div>
                <div className="reservation-food">
                  <dt>
                    <Icon name="food" width="17" height="17" />
                    {t("food")}
                  </dt>
                  <dd className={r.food ? "" : "muted"}>
                    {r.food || t("noFood")}
                  </dd>
                </div>
              </dl>
              <footer className="reservation-actions">
                <button
                  type="button"
                  className="detail-link"
                  onClick={() => onOpenDetail(r)}
                  aria-label={t("viewDetails") + " " + r.name}
                >
                  {t("viewDetails")}
                  <Icon name="right" width="16" height="16" />
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    className="edit-btn"
                    onClick={() => onEdit(r)}
                    aria-label={t("edit") + " " + r.name}
                  >
                    <Icon name="edit" width="17" height="17" />
                    {t("edit")}
                  </button>
                )}
              </footer>
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}
