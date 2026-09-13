import { useEffect, useRef } from "react";
import { useLang } from "../context/LangContext";
import Icon from "./Icon";
import { watchFormViewport } from "../lib/form-viewport";

export default function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
  busy = false,
  className = "",
  role,
  describedBy,
}) {
  const { t } = useLang();
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    const stopWatching = watchFormViewport(element, { modal: true });
    return () => {
      stopWatching();
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={"modal" + (wide ? " modal-wide" : "") + (className ? " " + className : "")}
      role={role}
      aria-label={title}
      aria-describedby={describedBy}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget || busy) return;
        const box = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < box.left ||
          e.clientX > box.right ||
          e.clientY < box.top ||
          e.clientY > box.bottom
        )
          onClose();
      }}
    >
      <div className="modal-head">
        <div>
          <h2 className="modal-title">{title}</h2>
          {subtitle && <p className="modal-sub">{subtitle}</p>}
        </div>
        <button
          type="button"
          className="close-btn"
          onClick={onClose}
          disabled={busy}
          aria-label={t("close")}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
