"use client";

import { useEffect, useRef, useState } from "react";

/* =====================================================================
   Chart motion primitives.

   - entrance animations run once per page visit (module-level Set), not on
     every scroll;
   - value changes interpolate from the currently displayed numbers;
   - reduced motion snaps to final values and returns progress 1 immediately;
   - all loops are rAF-driven and stop when finished (no idle rendering).
   ===================================================================== */

const seen = new Set<string>();

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Fires once when its element first enters the viewport, once per page visit. */
export function useEnterOnce(id: string) {
  const already = useRef(seen.has(id)).current;
  const [entered, setEntered] = useState(already);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (entered) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        seen.add(id);
        setEntered(true);
        io.disconnect();
      },
      { threshold: 0.18 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [entered, id]);

  return { ref, entered, already };
}

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

/**
 * Animates a list of numbers from zero (first entrance) or from their current
 * displayed values (later data changes) to the new targets.
 */
export function useAnimatedNumbers(
  targets: number[],
  animate: boolean,
  initialZero = false,
  duration = 680,
): number[] {
  const key = targets.join("|");
  const [vals, setVals] = useState<number[]>(() => (initialZero ? targets.map(() => 0) : targets));
  const current = useRef<number[]>(initialZero ? targets.map(() => 0) : targets);
  const raf = useRef(0);

  useEffect(() => {
    if (!animate) {
      if (!initialZero) { current.current = targets; setVals(targets); }
      return;
    }
    const from = current.current;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - t0) / duration));
      const e = easeOut(p);
      const next = targets.map((v, i) => from[i] + (v - (from[i] ?? 0)) * e);
      current.current = next;
      setVals(next);
      if (p < 1) raf.current = requestAnimationFrame(step);
      else { current.current = targets; setVals(targets); }
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, animate, initialZero, duration]);

  return vals;
}

/** 0→1 entrance progress for draw-on effects. */
export function useChartProgress(animate: boolean, duration = 720): number {
  const [p, setP] = useState(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) { setP(1); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const v = Math.min(1, (now - t0) / duration);
      setP(v);
      if (v < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [animate, duration]);
  return p;
}

export const clampP = (v: number) => Math.max(0, Math.min(1, v));

/** Measured content width so SVG charts keep a fixed height at any width. */
export function useMeasuredWidth(fallback = 660) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.max(320, Math.round(e.contentRect.width));
      setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}
