/**
 * Shared requestAnimationFrame driver that freezes while the tab is hidden
 * and resumes when it becomes visible again. The callback must be
 * self-contained: scheduling and visibility gating live here, so every
 * component stops paying for rAF wakeups the user cannot see.
 */
export function rafLoop(fn: (now: number) => void): () => void {
  let raf = 0;
  const tick: FrameRequestCallback = (now) => {
    if (document.hidden) {
      raf = 0;
      return; // frozen; resumed by the visibilitychange listener below
    }
    fn(now);
    raf = requestAnimationFrame(tick);
  };
  const onVisible = () => {
    if (!document.hidden && !raf) raf = requestAnimationFrame(tick);
  };
  document.addEventListener("visibilitychange", onVisible);
  raf = requestAnimationFrame(tick);
  return () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    document.removeEventListener("visibilitychange", onVisible);
  };
}
