import Modal from "./Modal";
import { useLang } from "../context/LangContext";
import { longDate } from "../i18n";

export default function ReservationDetail({ reservation: r, onClose }) {
  const { lang, t } = useLang();
  return (
    <Modal title={t("detailTitle")} subtitle={longDate(lang, r.date)} onClose={onClose}>
      <div className="detail-arrival">
        <strong>{r.time}</strong>
        <span>
          <strong>{r.seats}</strong> <span className="muted">{t("peopleUnit")}</span>
        </span>
      </div>
      <dl className="detail-data">
        <div className="detail-row">
          <dt>{t("name")}</dt>
          <dd>{r.name}</dd>
        </div>
        <div className="detail-row">
          <dt>{t("phone")}</dt>
          <dd>
            {r.phone}
            {r.phoneMasked && (
              <span className="masked-note">{t("phoneMasked")}</span>
            )}
          </dd>
        </div>
        <div className="detail-row">
          <dt>{t("zone")}</dt>
          <dd>{r.zone || t("noZone")}</dd>
        </div>
        <div className="detail-row">
          <dt>{t("food")}</dt>
          <dd>{r.food || t("noFood")}</dd>
        </div>
      </dl>
    </Modal>
  );
}
