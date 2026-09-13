// Revalidate idle staff sessions, including suspended tabs when they resume.
export function watchStaffSession({ check, getToken, onExpired, target = window, page = document,
  setTimer = setTimeout, clearTimer = clearTimeout, interval = 1000 }) {
  const token = getToken();
  let stopped = false, inFlight = false, timer, controller;
  const expire = () => { if (!stopped) { stopped = true; clearTimer(timer); onExpired(); } };
  async function verify() {
    if (stopped || inFlight) return;
    clearTimer(timer);
    if (getToken() !== token) { expire(); return; }
    inFlight = true;
    controller = new AbortController();
    const timeout = setTimer(() => controller.abort(), 4000);
    try {
      const session = await check(controller.signal);
      if (!stopped && getToken() === token && session.level !== 'staff') expire();
    } catch {
      // Hide private data if the server can no longer verify this session.
      if (!stopped && getToken() === token) expire();
    } finally {
      clearTimer(timeout);
      inFlight = false;
      if (!stopped) timer = setTimer(verify, interval);
    }
  }
  const resume = () => { if (page.visibilityState !== 'hidden') void verify(); };
  target.addEventListener('focus', resume);
  target.addEventListener('online', resume);
  target.addEventListener('pageshow', resume);
  target.addEventListener('storage', resume);
  page.addEventListener('visibilitychange', resume);
  void verify();
  return () => {
    stopped = true;
    clearTimer(timer);
    controller?.abort();
    target.removeEventListener('focus', resume);
    target.removeEventListener('online', resume);
    target.removeEventListener('pageshow', resume);
    target.removeEventListener('storage', resume);
    page.removeEventListener('visibilitychange', resume);
  };
}
