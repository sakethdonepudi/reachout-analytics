"use client";

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * A viewport-safe tooltip rendered in a portal. It prefers the space below the
 * trigger, flips above when needed, and then moves to the side so it never
 * covers the value directly above a Target pill.
 */
export default function PortalTip({ open, anchorRef, children }: { open: boolean; anchorRef: RefObject<HTMLElement | null>; children: ReactNode }) {
  const tipRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) { setStyle(null); return; }
    const anchor = anchorRef.current;
    const tip = tipRef.current;
    if (!anchor || !tip) return;
    const rect = anchor.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    const margin = 8;
    const width = window.innerWidth;
    const height = window.innerHeight;
    let left = rect.left + rect.width / 2 - box.width / 2;
    let top = rect.bottom + margin;
    if (top + box.height > height - margin) {
      const right = rect.right + margin;
      const leftSide = rect.left - box.width - margin;
      if (right + box.width <= width - margin) {
        left = right;
        top = Math.max(margin, Math.min(rect.top, height - box.height - margin));
      } else if (leftSide >= margin) {
        left = leftSide;
        top = Math.max(margin, Math.min(rect.top, height - box.height - margin));
      } else {
        top = Math.max(margin, rect.top - box.height - margin);
      }
    }
    left = Math.max(margin, Math.min(width - box.width - margin, left));
    setStyle({ left, top });
  }, [anchorRef, open]);

  if (!open) return null;
  return createPortal(
    <div
      ref={tipRef}
      role="tooltip"
      className="portal-tip pointer-events-none fixed z-[var(--z-tooltip,90)] max-w-[min(320px,calc(100vw-16px))] rounded-lg px-2.5 py-1.5 text-[12px] font-semibold shadow-xl"
      style={style ?? { left: 0, top: 0, visibility: "hidden" }}
    >
      {children}
    </div>,
    document.body,
  );
}
