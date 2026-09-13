import { useEffect, useRef, useState } from 'react';
import { RequestSkeleton, RefreshIndicator } from './Skeleton';
import Modal from './Modal';
import BookingRequestList from './BookingRequestList';
import BookingRequestDetail from './BookingRequestDetail';
import { useLang } from '../context/LangContext';
import { useRequestData } from '../lib/use-request-data';
import { longDate } from '../i18n';

export default function BookingRequestsModal({onClose,onChanged,initialDate='',readOnly=false}) {
  const {lang,t}=useLang();
  const [filter,setFilter]=useState('active'),[page,setPage]=useState(1),[date,setDate]=useState(initialDate),[selected,setSelected]=useState(null);
  const lastSelected=useRef(null);
  const query=new URLSearchParams({state:filter,page:String(page),...(date?{date}:{})}).toString();
  const feed=useRequestData('list',query,true,readOnly?'staff':'admin');
  useEffect(()=>{
    if(feed.data && page>Math.max(1,Math.ceil(feed.data.total/30))) setPage(Math.max(1,Math.ceil(feed.data.total/30)));
  },[feed.data,page]);
  useEffect(()=>{
    if(!selected && lastSelected.current) requestAnimationFrame(()=>document.querySelector('[data-request-id="'+lastSelected.current+'"]')?.focus({preventScroll:true}));
  },[selected]);
  if(selected) return <BookingRequestDetail readOnly={readOnly} request={selected} onClose={()=>setSelected(null)} onChanged={r=>{feed.refresh({invalidate:true});onChanged(r);}} />;
  return <Modal title={t('requestInbox')} subtitle={t('requestInboxHint')} onClose={onClose}>
    <div className="request-inbox" aria-busy={feed.loading || feed.refreshing}>
      <RefreshIndicator active={feed.refreshing}/>
      <div className="agenda-tabs" role="group" aria-label={t('requestFilter')}>
        <button type="button" aria-pressed={filter==='active'} onClick={()=>{setFilter('active');setPage(1);}}><span className="status-dot pending-dot" />{t('requestPending')}</button>
        {!readOnly && <button type="button" aria-pressed={filter==='history'} onClick={()=>{setFilter('history');setPage(1);}}>{t('requestHistory')}</button>}
      </div>
      {feed.error && feed.data && <p className="toast error" role="alert">{t('requestLoadError')} <button type="button" className="detail-link" onClick={feed.refresh}>{t('retry')}</button></p>}
      {date && <div className="request-date-filter"><span>{longDate(lang,date)}</span><button type="button" className="detail-link" onClick={()=>{setDate('');setPage(1);}}>{t('requestAllDates')}</button></div>}
      {feed.error && !feed.data ? <div className="empty-state" role="alert"><p>{t('requestLoadError')}</p><button type="button" className="ghost-btn" onClick={feed.refresh}>{t('retry')}</button></div>
        :feed.loading?<RequestSkeleton />
        :<><BookingRequestList items={feed.data?.items || []} showDate history={filter==='history'} onOpen={r=>{lastSelected.current=r.id;setSelected(r);}} />
          {feed.data?.total>30 && <div className="request-pagination"><button className="cancel-btn" disabled={page===1} onClick={()=>setPage(n=>n-1)}>{t('requestPrevious')}</button><span>{page} / {Math.ceil(feed.data.total/30)}</span><button className="cancel-btn" disabled={page*30>=feed.data.total} onClick={()=>setPage(n=>n+1)}>{t('requestNext')}</button></div>}</>}
    </div>
  </Modal>;
}
