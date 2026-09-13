import { useEffect, useRef, useState } from "react";
import { useLang } from "../context/LangContext";
import { longDate } from "../i18n";
import { timeSlots } from "../lib/date";
import { bookingErrors, isValidBookingDate } from "../lib/booking-form";
import Modal from "./Modal";
import Icon from "./Icon";
import ActionButton from "./ActionButton";
import { useActionFeedback } from "../lib/use-action-feedback";

export default function ReservationForm({
  mode,
  date,
  initial,
  onSubmit,
  onCancel,
  onDelete,
  title,
  submitError,
}) {
  const { lang, t } = useLang();
  const formRef = useRef(null);
  const [form, setForm] = useState(() => ({
    date,
    time: initial?.time || "",
    name: initial?.name || "",
    seats: initial ? String(initial.seats) : "",
    phone: initial?.phone || "",
    zone: initial?.zone || "",
    food: initial?.food || "",
  }));
  const [errors, setErrors] = useState({});
  const { status, busy: saving, begin, succeed, fail } = useActionFeedback(onCancel);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const cancelDeleteButton = useRef(null);
  const deleteButton = useRef(null);
  useEffect(() => {
    if (confirming) cancelDeleteButton.current?.focus({ preventScroll: true });
  }, [confirming]);
  function cancelDelete() {
    setConfirming(false);
    setDeleteFailed(false);
    requestAnimationFrame(() => deleteButton.current?.focus({ preventScroll: true }));
  }
  async function remove() {
    if (mode !== 'edit' || !initial || !onDelete || !confirming || !begin('delete')) return;
    setDeleteFailed(false);
    try {
      if (await onDelete(initial) === false) { setDeleteFailed(true); fail(); }
      else succeed(t('doneDeleted'), 'danger');
    } catch { setDeleteFailed(true); fail(); }
  }
  const slots = timeSlots();
  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
    setFailed(false);
  };
  const fieldClass = (key) => "field" + (errors[key] ? " invalid" : "");
  const inputProps = (key) => ({
    id: "f-" + key,
    value: form[key],
    onChange: set(key),
    disabled: saving,
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? "err-" + key : undefined,
  });
  const errorFor = (key) =>
    errors[key] && (
      <p className="err" id={"err-" + key}>
        {t(errors[key])}
      </p>
    );

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving || confirming) return;
    const next = bookingErrors(form);
    setErrors(next);
    if (Object.keys(next).length) {
      formRef.current?.querySelector("#f-" + Object.keys(next)[0])?.focus();
      return;
    }
    if (!begin()) return;
    setFailed(false);
    try {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        seats: Number(form.seats),
        phone: form.phone.trim(),
        zone: form.zone.trim(),
        food: form.food.trim(),
      });
      succeed(t(mode === "edit" ? "doneUpdated" : "doneSaved"));
    } catch {
      setFailed(true);
      fail();
    }
  }

  return (
    <Modal
      wide
      title={confirming ? t("deleteConfirmTitle") : title || t(mode === "edit" ? "formTitleEdit" : "formTitleCreate")}
      subtitle={confirming ? longDate(lang, initial.date) : t("formSubtitle")}
      onClose={confirming ? cancelDelete : onCancel}
      busy={saving}
    >
      {confirming ? <div className="delete-confirmation">
        <p className="delete-question">{t('confirmDelete').replace('{name}', initial.name)}</p>
        <p className="delete-summary">{longDate(lang, initial.date)} · {initial.time} · {initial.seats} {t('peopleUnit')}</p>
        <p className="delete-warning">{t('deleteWarning')}</p>
        {deleteFailed && <div className="toast error" role="alert">{t('deleteError')}</div>}
        <div className="delete-confirm-actions">
          <button ref={cancelDeleteButton} type="button" className="ghost-btn" disabled={saving} onClick={cancelDelete}>{t('cancel')}</button>
          <ActionButton className="danger-btn" status={status} action="delete" pendingLabel={t('deleting')} onClick={remove}>{t('confirmDeleteAction')}</ActionButton>
        </div>
      </div> : <form
        ref={formRef}
        className="booking-form"
        onSubmit={handleSubmit}
        noValidate
      >
        <fieldset>
          <legend>{t("bookingSection")}</legend>
          <div className="field-row">
            <div className={fieldClass("date")}>
              <label htmlFor="f-date">{t("date")}</label>
              <input
                {...inputProps("date")}
                onInput={set("date")}
                type="date"
                required
              />
              {errorFor("date")}
              {isValidBookingDate(form.date) && (
                <p className="hint date-preview">{longDate(lang, form.date)}</p>
              )}
            </div>
            <div className={fieldClass("time")}>
              <label htmlFor="f-time">{t("time")}</label>
              <div className="time-select">
                <select {...inputProps("time")} required>
                  <option value="">{t("timePh")}</option>
                  {form.time && !slots.includes(form.time) && (
                    <option value={form.time}>{form.time}</option>
                  )}
                  {slots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
                <Icon name="down" width="18" height="18" />
              </div>
              {errorFor("time")}
            </div>
          </div>
          <div className="field-row guest-fields">
            <div className={fieldClass("name")}>
              <label htmlFor="f-name">{t("name")}</label>
              <input
                {...inputProps("name")}
                type="text"
                maxLength={120}
                autoComplete="off"
                placeholder={t("namePh")}
                required
              />
              {errorFor("name")}
            </div>
            <div className={fieldClass("seats")}>
              <label htmlFor="f-seats">{t("partySize")}</label>
              <input
                {...inputProps("seats")}
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                placeholder={t("seatsPh")}
                required
              />
              {errorFor("seats")}
            </div>
          </div>
          <div className={fieldClass("phone")}>
            <label htmlFor="f-phone">{t("phone")}</label>
            <input
              {...inputProps("phone")}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder={t("phonePh")}
              required
            />
            {errorFor("phone")}
          </div>
        </fieldset>
        <fieldset>
          <legend>
            {t("extraSection")}
            <span>{t("optional")}</span>
          </legend>
          <div className="field">
            <label htmlFor="f-zone">{t("zone")}</label>
            <input
              {...inputProps("zone")}
              maxLength={120}
              type="text"
              placeholder={t("zonePh")}
              aria-describedby="zone-hint"
            />
            <p className="hint" id="zone-hint">
              {t("zonePublicWarning")}
            </p>
          </div>
          <div className="field">
            <label htmlFor="f-food">{t("food")}</label>
            <textarea
              {...inputProps("food")}
              rows="4"
              placeholder={t("foodPh")}
            />
          </div>
        </fieldset>
        {failed && (
          <p className="toast error" role="alert">
            {submitError || t("saveError")}
          </p>
        )}
        <div className="form-footer">
          {mode === 'edit' && onDelete && <button
            ref={deleteButton}
            type="button"
            className="cancel-btn text-danger"
            disabled={saving}
            onClick={() => setConfirming(true)}
          >{t('deleteBooking')}</button>}
          <ActionButton type="submit" status={status} pendingLabel={t("saving")}>
            {t(mode === "edit" ? "submitEdit" : "submitCreate")}
          </ActionButton>
        </div>
      </form>}
    </Modal>
  );
}
