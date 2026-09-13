const FOCUSABLE = 'input, textarea, select, button';

// A field that fits should include its label and validation/help text.
export function scrollDelta(target, top, bottom) {
  if (target.top < top) return target.top - top;
  if (target.bottom > bottom) return Math.min(target.bottom - bottom, target.top - top);
  return 0;
}

export function watchFormViewport(surface, { modal = false } = {}) {
  const win = surface.ownerDocument.defaultView;
  const doc = surface.ownerDocument;
  const viewport = win.visualViewport;
  let frame = 0;
  let reveal = false;
  let notice = null;
  let disposed = false;
  let settleTimers = [];
  const set = (key, value) => {
    if (surface.style.getPropertyValue(key) !== value) surface.style.setProperty(key, value);
  };

  function update() {
    frame = 0;
    if (disposed) return;
    const height = viewport?.height ?? win.innerHeight;
    const offset = viewport?.offsetTop ?? 0;
    const active = doc.activeElement;
    const hasFocus = surface.contains(active) && active.matches(FOCUSABLE);
    let top = offset + 16;
    let bottom = offset + height - 20;

    if (modal) {
      const fullscreen = surface.getAttribute?.('role') !== 'alertdialog' && (win.innerWidth <= 600 || height < 500);
      surface.dataset.viewportFullscreen = String(fullscreen);
      // Keep this independent of focus: focusing Save must not move the
      // button between pointerdown and click as the input loses focus.
      surface.dataset.viewportCompact = String(height < 600);
      set('--modal-viewport-height', `${height}px`);
      const inset = fullscreen ? 0 : 32;
      set('--modal-max-height', `${Math.max(0, height - inset * 2)}px`);
      set('--modal-viewport-top', `${offset + (fullscreen ? 0 : Math.max(inset, (height - surface.getBoundingClientRect().height) / 2))}px`);
      const bounds = surface.getBoundingClientRect();
      const stickyHeight = selector => {
        const node = surface.querySelector(selector);
        return node && win.getComputedStyle(node).position === 'sticky' ? node.getBoundingClientRect().height : 0;
      };
      const header = stickyHeight('.modal-head');
      const footer = stickyHeight('.form-footer');
      top = Math.max(offset, bounds.top) + header + 12;
      bottom = Math.min(offset + height, bounds.bottom) - footer - 16;
      set('--form-scroll-top', `${header + 12}px`);
      set('--form-scroll-bottom', `${footer + 16}px`);
    } else {
      // iOS/Android may shrink only the visual viewport, leaving the document
      // too short to scroll the final field/button clear of the keyboard.
      set('--keyboard-inset', `${hasFocus ? Math.max(0, win.innerHeight - height) : 0}px`);
    }

    const noticeBox = notice?.isConnected ? notice.getBoundingClientRect() : null;
    if ((noticeBox || reveal && hasFocus) && (viewport?.scale ?? 1) <= 1.05) {
      const chrome = active.closest('.modal-head, .form-footer');
      if (!noticeBox && chrome && win.getComputedStyle(chrome).position === 'sticky') {
        reveal = false;
        return;
      }
      const field = hasFocus ? active.getBoundingClientRect() : null;
      const group = hasFocus ? active.closest('.field')?.getBoundingClientRect() : null;
      let target = group && group.height <= bottom - top ? group : field;
      if (noticeBox) {
        const combined = target && {top:Math.min(target.top,noticeBox.top),bottom:Math.max(target.bottom,noticeBox.bottom)};
        target = combined && combined.bottom-combined.top <= bottom-top ? combined : noticeBox;
      }
      const delta = scrollDelta(target, top, bottom);
      if (Math.abs(delta) > 1) {
        if (modal) surface.scrollTop += delta;
        else win.scrollBy({ top: delta, behavior: 'instant' });
      }
    }
    reveal = false;
    notice = null;
  }
  function schedule(shouldReveal = true) {
    if (disposed) return;
    reveal ||= shouldReveal;
    if (!frame) frame = win.requestAnimationFrame(update);
  }
  const onResize = () => schedule(true);
  // Do not move a pointer-pressed button between pointerdown and click.
  function cancelSettling() {
    settleTimers.forEach(timer => win.clearTimeout(timer));
    settleTimers = [];
  }
  const onFocusIn = event => {
    cancelSettling();
    schedule(!event.target.matches('button') || event.target.matches(':focus-visible'));
    if (event.target.matches('input, textarea, select')) {
      // Native keyboard animation/auto-pan can finish after the resize event.
      // Recheck briefly, never poll continuously or fight manual scrolling.
      settleTimers = [300, 700].map(delay => win.setTimeout(() => schedule(true), delay));
    }
  };
  // Let users scroll away from the focused field to inspect other content.
  const onPan = () => schedule(false);
  const onFocusOut = () => { cancelSettling(); schedule(false); };
  viewport?.addEventListener('resize', onResize);
  viewport?.addEventListener('scroll', onPan);
  win.addEventListener('resize', onResize);
  surface.addEventListener('focusin', onFocusIn);
  surface.addEventListener('focusout', onFocusOut);
  surface.addEventListener('input', onResize);
  surface.addEventListener('change', onResize);
  surface.addEventListener('touchmove', cancelSettling, { passive: true });
  surface.addEventListener('wheel', cancelSettling, { passive: true });
  surface.addEventListener('pointerdown', cancelSettling, { passive: true });
  const observer = win.ResizeObserver ? new win.ResizeObserver(onResize) : null;
  observer?.observe(surface);
  function observeContent(records = []) {
    const error = surface.querySelector('.toast.error');
    if (error && records.some(record => error.contains(record.target) || [...record.addedNodes].some(node => node === error || node.contains?.(error)))) notice = error;
    surface.querySelectorAll('form, .field, .modal-head, .form-footer').forEach(node => observer?.observe(node));
    schedule(true);
  }
  const mutations = win.MutationObserver ? new win.MutationObserver(observeContent) : null;
  mutations?.observe(surface, { childList: true, subtree: true, characterData: true });
  observeContent();
  // showModal()/React autofocus can focus a field before these listeners exist.
  if (surface.contains(doc.activeElement) && doc.activeElement.matches('input, textarea, select')) {
    onFocusIn({ target: doc.activeElement });
  }
  return () => {
    disposed = true;
    cancelSettling();
    win.cancelAnimationFrame(frame);
    viewport?.removeEventListener('resize', onResize);
    viewport?.removeEventListener('scroll', onPan);
    win.removeEventListener('resize', onResize);
    surface.removeEventListener('focusin', onFocusIn);
    surface.removeEventListener('focusout', onFocusOut);
    surface.removeEventListener('input', onResize);
    surface.removeEventListener('change', onResize);
    surface.removeEventListener('touchmove', cancelSettling);
    surface.removeEventListener('wheel', cancelSettling);
    surface.removeEventListener('pointerdown', cancelSettling);
    observer?.disconnect();
    mutations?.disconnect();
  };
}
