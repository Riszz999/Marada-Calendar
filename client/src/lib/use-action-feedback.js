import { useEffect, useRef, useState } from 'react';
import { createActionFeedback } from './action-feedback';

export function useActionFeedback(onClose, { closeOnSuccess = true } = {}) {
  const [status, setStatus] = useState({ phase: 'idle', action: null });
  const close = useRef(onClose);
  close.current = onClose;
  const controller = useRef(null);
  if (!controller.current) controller.current = createActionFeedback({ closeOnSuccess, onChange: setStatus, onClose: () => close.current() });
  useEffect(() => {
    controller.current.activate();
    return () => controller.current.dispose();
  }, []);
  return { ...controller.current, status, busy: status.phase !== 'idle' };
}
