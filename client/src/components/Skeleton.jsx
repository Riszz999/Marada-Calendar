import '../skeleton.css';
import { useVisibleAnimation } from '../lib/use-visible-animation';
import { useLang } from '../context/LangContext';
import Calendar from './Calendar';
import { dateKey } from '../lib/date';
import { longDate } from '../i18n';

export function Skeleton({ className = '' }) {
  return <span aria-hidden="true" className={'skeleton ' + className} />;
}

export function RefreshIndicator({ active }) {
  const { t } = useLang();
  const element = useVisibleAnimation(active);
  return <div className="refresh-slot" aria-busy={active}>
    {active && <div ref={element} className="data-refresh" role="status"><span className="sr-only">{t('loading')}</span><span aria-hidden="true" className="data-refresh-track"><span/></span></div>}
  </div>;
}

export function SkeletonGroup({ children, className = '' }) {
  const { t } = useLang();
  const element = useVisibleAnimation();
  return <div ref={element} className={'skeleton-group ' + className} role="status" aria-busy="true">
    <span className="sr-only">{t('loading')}</span><div aria-hidden="true">{children}</div>
  </div>;
}

export function ReservationSkeleton() {
  return <SkeletonGroup className="reservation-skeleton"><div className="reservation-list">
    {[0,1].map(i=><div className="skeleton-reservation" key={i}>
      <div className="skeleton-arrival"><Skeleton className="sk-time"/><Skeleton className="sk-time"/></div>
      <div className="skeleton-fields">{[0,1,2,3].map(n=><div key={n}><Skeleton className="sk-label"/><Skeleton className="sk-value"/></div>)}</div>
      <div className="skeleton-actions"><Skeleton className="sk-label"/><Skeleton className="sk-label"/></div>
    </div>)}
  </div></SkeletonGroup>;
}

export function RequestSkeleton() {
  return <SkeletonGroup className="request-skeleton">{[0,1,2].map(i=><div className="skeleton-request" key={i}>
    <Skeleton className="sk-date"/><div className="skeleton-inline"><Skeleton className="sk-time"/><Skeleton className="sk-label"/></div>
    <Skeleton className="sk-value"/><Skeleton className="sk-date"/>
  </div>)}</SkeletonGroup>;
}

export function StaffKeySkeleton() {
  return <SkeletonGroup className="staff-key-skeleton"><Skeleton className="sk-value"/><Skeleton className="sk-date"/>
    <div className="skeleton-key-row"><Skeleton className="sk-key"/><Skeleton className="sk-control"/></div>
    <Skeleton className="sk-date"/><div className="skeleton-inline"><Skeleton className="sk-control"/><Skeleton className="sk-control"/></div>
  </SkeletonGroup>;
}

export function UsersSkeleton() {
  return <SkeletonGroup className="users-skeleton">{[0,1,2].map(i=><div className="skeleton-user" key={i}>
    <div><Skeleton className="sk-value"/><Skeleton className="sk-date"/></div><Skeleton className="sk-control"/>
  </div>)}</SkeletonGroup>;
}

export function SessionSkeleton({ year = new Date().getFullYear(), month = new Date().getMonth(), date = dateKey(year, month, 1), isStaff = false }) {
  const { lang, t } = useLang();
  return <main className="workspace"><SkeletonGroup className="session-skeleton">
    <div className="page-heading">
      <div><h1 className="skeleton-text">{t('title')}</h1>{isStaff && <p className="role-note skeleton-text">{t('staffRole')}</p>}</div>
      <div className="page-heading-actions"><Skeleton className="sk-control" /></div>
    </div>
    <Calendar year={year} month={month} skeleton />
  </SkeletonGroup><section className="agenda">
    <SkeletonGroup className="session-agenda-skeleton"><div className="agenda-heading">
      <div><h2 className="skeleton-text">{t('listTitle')}</h2><p className="agenda-date skeleton-text">{longDate(lang,date)}</p></div>
    </div></SkeletonGroup>
    <div className="refresh-slot" aria-hidden="true" />
    <ReservationSkeleton/>
  </section></main>;
}
