import { useEffect, useRef } from 'react';
import { PendingContent } from './PendingButton';
import { useLang } from '../context/LangContext';

export default function ActionButton({ status, action = 'save', pendingLabel, children, className = 'submit-btn', disabled, allowAfterSuccess = false, ...props }) {
  const { t } = useLang();
  const phase = status.action === action ? status.phase : 'idle';
  const button = useRef(null);
  useEffect(() => {
    if (phase === 'success') button.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [phase]);
  return <button type="button" {...props} ref={button}
    className={className + ' pending-button' + (phase === 'success' ? ' action-complete' : '')}
    data-state={phase} data-tone={phase === 'success' ? status.tone : undefined}
    disabled={disabled || (status.phase !== 'idle' && !(allowAfterSuccess && status.phase === 'success'))}
    aria-label={phase === 'success' ? status.message : phase === 'pending' ? pendingLabel || t('loading') : props['aria-label']}
    aria-live="polite" aria-atomic="true" aria-busy={phase === 'pending'}>
    <PendingContent pending={phase === 'pending'} pendingLabel={pendingLabel || t('loading')}>{phase === 'success' ? status.message : children}</PendingContent>
  </button>;
}
