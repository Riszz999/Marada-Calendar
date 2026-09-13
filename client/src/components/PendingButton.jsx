import '../skeleton.css';
import { useLang } from '../context/LangContext';

export function PendingContent({ pending, pendingLabel, children }) {
  return <span className="pending-content">
    <span className="pending-original" aria-hidden={pending || undefined} style={{ visibility: pending ? 'hidden' : 'visible' }}>{children}</span>
    <span className="pending-label" aria-hidden={!pending || undefined} style={{ visibility: pending ? 'visible' : 'hidden' }}>{pendingLabel}</span>
  </span>;
}

export default function PendingButton({ pending, pendingLabel, children, className = 'submit-btn', disabled, ...props }) {
  const { t } = useLang();
  const label = pendingLabel || t('loading');
  return <button {...props} className={className + ' pending-button'} data-state={pending?'pending':'idle'} disabled={disabled || pending} aria-busy={pending} aria-label={pending?label:props['aria-label']}>
    <PendingContent pending={pending} pendingLabel={label}>{children}</PendingContent>
  </button>;
}
