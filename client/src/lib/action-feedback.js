export function createActionFeedback({ onChange, onClose, closeOnSuccess = true, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let active = true;
  let state = { phase: 'idle', action: null };
  let timer;
  const update = next => { state = next; onChange(next); };
  return {
    activate() { active = true; },
    begin(action = 'save', replaceCompleted = false) {
      if (!active || (state.phase !== 'idle' && !(replaceCompleted && state.phase === 'success'))) return false;
      clearTimer(timer);
      update({ phase: 'pending', action });
      return true;
    },
    succeed(message, tone = 'success') {
      if (!active || state.phase !== 'pending') return;
      update({ ...state, phase: 'success', message, tone });
      timer = setTimer(() => {
        if (!active) return;
        if (closeOnSuccess) onClose();
        else update({ phase: 'idle', action: null });
      }, 2000);
    },
    fail() {
      if (active && state.phase === 'pending') update({ phase: 'idle', action: null });
    },
    dispose() { active = false; clearTimer(timer); },
  };
}
