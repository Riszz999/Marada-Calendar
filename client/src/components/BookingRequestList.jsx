import { useLang } from '../context/LangContext';
import { longDate } from '../i18n';
import Icon from './Icon';

export function requestStatusKey(status) {
  return {pending:'requestPending',follow_up:'requestFollowUp',confirmed:'requestConfirmed',rejected:'requestRejected'}[status] || 'requestPending';
}
export function requestTimestamp(value, lang) {
  if (!value) return '—';
  const normalized=/^\d{4}-\d\d-\d\d \d\d:/.test(value)?value.replace(' ','T')+'Z':value;
  return new Date(normalized).toLocaleString(lang==='th'?'th-TH':'en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
}

export default function BookingRequestList({items, onOpen, showDate=false, history=false}) {
  const {lang,t}=useLang();
  if (!items.length) return <div className="empty-state request-empty"><h3>{t(history?'requestHistoryEmpty':'requestEmpty')}</h3><p>{t(history?'requestHistoryHint':'requestEmptyHint')}</p></div>;
  return <div className="request-list">
    {items.map(r=><button type="button" className="request-row" key={r.id} onClick={()=>onOpen(r)} data-request-id={r.id}>
      <span className="request-row-main">
        {showDate && <span className="request-date">{longDate(lang,r.date)}</span>}
        <span className="request-row-arrival"><strong>{r.time}</strong><span>{r.seats} <span className="muted">{t('peopleUnit')}</span></span></span>
        <span className="request-customer">{r.name}</span>
        <span className="request-received">{t('requestReceived')} {requestTimestamp(r.requestedAt,lang)}</span>
        {r.status==='follow_up' && r.note && <span className="request-note-preview">{r.note}</span>}
      </span>
      <span className="request-row-side"><span className={'request-status status-'+r.status}>{t(requestStatusKey(r.status))}</span><Icon name="right" width="16" height="16" /></span>
    </button>)}
  </div>;
}
