"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/** Measures the active tab so an underline can slide between items. */
export function useSlidingUnderline(
  container: RefObject<HTMLElement | null>,
  activeKey: string,
): { left: number; width: number } | null {
  const [rect, setRect] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => {
      const active = element.querySelector<HTMLElement>('[data-tab-active="true"]');
      if (!active) { setRect(null); return; }
      setRect({ left: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [container, activeKey]);

  return rect;
}
