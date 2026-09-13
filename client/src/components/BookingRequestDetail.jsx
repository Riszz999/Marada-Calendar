import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';
import ReservationForm from './ReservationForm';
import ActionButton from './ActionButton';
import { useActionFeedback } from '../lib/use-action-feedback';
import { useLang } from '../context/LangContext';
import { api } from '../api';
import { errorMessage } from '../lib/errors';
import { longDate } from '../i18n';
import { requestStatusKey, requestTimestamp } from './BookingRequestList';

export default function BookingRequestDetail({request, onClose, onChanged, readOnly=false}) {
  const {lang,t}=useLang();
  const [record,setRecord]=useState(request);
  const [note,setNote]=useState(request.note || '');
  const [rejecting,setRejecting]=useState(false);
  const [reason,setReason]=useState('');
  const [error,setError]=useState('');
  const [conflict,setConflict]=useState(false);
  const [editing,setEditing]=useState(false);
  const cancel=useRef(null),actions=useRef(null);
  const {status,busy,begin,succeed,fail}=useActionFeedback(onClose);
  const active=!readOnly && ['pending','follow_up'].includes(record.status);
  useEffect(()=>{if(rejecting) cancel.current?.focus({preventScroll:true});},[rejecting]);
  function cancelReject() {
    setRejecting(false);setError('');
    requestAnimationFrame(()=>actions.current?.querySelector('[data-reject]')?.focus({preventScroll:true}));
  }
  async function decide(action) {
    if(busy || conflict || !active) return;
    if(action==='reject' && !reason.trim()) {setError(t('requestReasonRequired'));return;}
    if(!begin(action)) return;
    setError('');
    try {
      const saved=await api.reviewBookingRequest(record.id,{action,revision:record.revision,note:action==='reject'?reason.trim():note.trim()});
      // Keep the current buttons mounted for their two-second success feedback.
      onChanged(saved);
      succeed(t({approve:'requestApproved',follow_up:'doneSaved',reject:'requestRejectedDone'}[action]));
    } catch(err) {
      setConflict(err?.status===409);
      setError(err?.status===409?t('requestChanged'):errorMessage(err,t));fail();
    }
  }
  async function refresh() {
    if(!begin('refresh')) return;
    try {
      const fresh=await api.getBookingRequest(record.id);
      setRecord(fresh);setNote(fresh.note || '');setRejecting(false);setConflict(false);setError('');onChanged(fresh);
    } catch(err) {setError(errorMessage(err,t));}
    finally {fail();}
  }
  async function editRequest(values) {
    if(readOnly) return;
    try {
      const saved=await api.reviewBookingRequest(record.id,{...values,action:'edit',revision:record.revision});
      setRecord(saved);setError('');setConflict(false);onChanged(saved);
    } catch(err) {
      setConflict(err?.status===409);
      setError(err?.status===409?t('requestChanged'):errorMessage(err,t));
      throw err;
    }
  }
  if(editing) return <ReservationForm mode="edit" title={lang==='th'?'แก้ไขคำขอจอง':'Edit booking request'} date={record.date} initial={record} onSubmit={editRequest} onCancel={()=>setEditing(false)} submitError={error} />;
  return <Modal className="request-detail-modal" title={t(rejecting?'requestRejectTitle':'requestDetailTitle')} subtitle={rejecting?longDate(lang,record.date):`${t('requestReceived')} ${requestTimestamp(record.requestedAt,lang)}`} onClose={rejecting?cancelReject:onClose} busy={busy}
    role={rejecting?'alertdialog':undefined} describedBy={rejecting?'request-reject-description':undefined}>
    {rejecting ? <div className="request-detail-body">
      <p id="request-reject-description">{t('requestRejectDescription').replace('{name}',record.name)}</p>
      <div className="field"><label htmlFor="request-reason">{t('requestReason')}</label><textarea id="request-reason" rows="3" maxLength="2000" value={reason} disabled={busy} onChange={e=>setReason(e.target.value)} placeholder={t('requestReasonPlaceholder')} /></div>
      {error && <p className="toast error" role="alert">{error}</p>}
      <div className="delete-confirm-actions"><button ref={cancel} className="cancel-btn" disabled={busy} onClick={cancelReject}>{t('cancel')}</button>
        {conflict?<ActionButton status={status} action="refresh" onClick={refresh}>{t('requestReload')}</ActionButton>:<ActionButton className="danger-btn" status={status} action="reject" pendingLabel={t('requestRejecting')} onClick={()=>decide('reject')}>{t('requestReject')}</ActionButton>}
      </div>
    </div> : <>
      <div className="request-detail-meta"><span className={'request-status status-'+record.status}>{t(requestStatusKey(record.status))}</span><span className="request-booking-date">{longDate(lang,record.date)}</span></div>
      <div className="request-arrival-heading"><div className="detail-arrival"><strong>{record.time}</strong><span><strong>{record.seats}</strong> <span className="muted">{t('peopleUnit')}</span></span></div>
        {active && <button type="button" className="request-edit-btn" disabled={busy || conflict} onClick={()=>{setError('');setEditing(true);}}><Icon name="edit" width="17" height="17" />{t('edit')}</button>}
      </div>
      <dl className="detail-data">
        <div className="detail-row"><dt>{t('name')}</dt><dd>{record.name}</dd></div>
        <div className="detail-row"><dt>{t('phone')}</dt><dd>{record.phoneMasked ? <>{record.phone}<span className="masked-note">{t('phoneMasked')}</span></> : <a className="request-call" href={'tel:'+record.phone.replace(/[^+\d]/g,'')}>{record.phone}</a>}</dd></div>
        <div className="detail-row"><dt>{t('zone')}</dt><dd>{record.zone || t('noZone')}</dd></div>
        <div className="detail-row"><dt>{t('food')}</dt><dd>{record.food || t('noFood')}</dd></div>
      </dl>
      <div className="request-detail-body">
        {active ? <div className="field"><label htmlFor="request-note">{t('requestContactNote')}</label><textarea id="request-note" rows="3" maxLength="2000" disabled={busy} value={note} onChange={e=>setNote(e.target.value)} placeholder={t('requestContactPlaceholder')} /></div>
          :record.note && <div className="request-final-note"><span className="data-label">{t(record.status==='rejected'?'requestReason':'requestContactNote')}</span><p>{record.note}</p></div>}
        {record.reviewedAt && <p className="hint">{t('requestLastUpdate')} {requestTimestamp(record.reviewedAt,lang)}</p>}
        {error && <p className="toast error" role="alert">{error}</p>}
        {conflict && <ActionButton status={status} action="refresh" pendingLabel={t('loading')} onClick={refresh}>{t('requestReload')}</ActionButton>}
        {active && !conflict && <div ref={actions} className="request-decision-actions">
          <p className="hint">{t('requestApproveHint')}</p>
          <ActionButton status={status} action="approve" pendingLabel={t('requestApproving')} onClick={()=>decide('approve')}>{t('requestApprove')}</ActionButton>
          <div className="btn-row"><ActionButton className="cancel-btn" status={status} action="follow_up" pendingLabel={t('saving')} onClick={()=>decide('follow_up')}>{t('requestFollowUpAction')}</ActionButton>
            <button data-reject type="button" className="cancel-btn request-reject-btn" disabled={busy} onClick={()=>{setRejecting(true);setError('');}}>{t('requestReject')}</button></div>
        </div>}
      </div>
    </>}
  </Modal>;
}
