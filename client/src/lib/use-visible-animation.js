import { useEffect, useRef } from 'react';

export function useVisibleAnimation(enabled = true) {
  const element = useRef(null);
  useEffect(() => {
    const node = element.current;
    if (!enabled || !node) return;
    let visible = true;
    const update = () => { node.dataset.animate = String(visible && !document.hidden); };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer?.observe(node);
    document.addEventListener('visibilitychange', update);
    update();
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, [enabled]);
  return element;
}
