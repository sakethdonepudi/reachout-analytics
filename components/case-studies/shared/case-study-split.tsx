"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/* =====================================================================
   Shared case-study split view.

   Desktop: controls | map | grip | comparison panel.
   Mobile:  controls, map, panel stacked; the grip is hidden.

   The panel width is remembered per state, clamped to the available
   space, and adjustable with pointer drag, arrow keys, or a double
   click to restore the default. The map is *not* remounted while the
   divider moves; dashboards can refit the camera on `onResizeEnd`.
   ===================================================================== */

const GRIP_WIDTH = 14;

export type CaseStudySplitProps = {
  storageKey: string;
  controlsWidth: number;
  defaultPanelWidth: number;
  minPanelWidth: number;
  maxPanelWidth: number;
  minMapWidth?: number;
  controls: ReactNode;
  map: ReactNode;
  panel: (width: number) => ReactNode;
  onResizeEnd?: (width: number) => void;
  controlsLabel?: string;
  panelLabel?: string;
  className?: string;
};

const storageKeyFor = (key: string) => `reachout:case-study:${key}:panel-width`;

export default function CaseStudySplit({
  storageKey,
  controlsWidth,
  defaultPanelWidth,
  minPanelWidth,
  maxPanelWidth,
  minMapWidth = 320,
  controls,
  map,
  panel,
  onResizeEnd,
  controlsLabel = "Map controls",
  panelLabel = "Comparison panel",
  className,
}: CaseStudySplitProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(defaultPanelWidth);
  const [measured, setMeasured] = useState(defaultPanelWidth);
  const [dragging, setDragging] = useState(false);
  const widthRef = useRef(width);
  widthRef.current = width;
  const dragRef = useRef<{ startX: number; startWidth: number; pointerId: number } | null>(null);
  const restored = useRef(false);
  const onResizeEndRef = useRef(onResizeEnd);
  onResizeEndRef.current = onResizeEnd;

  const maxForContainer = useCallback(() => {
    const containerWidth = rootRef.current?.clientWidth ?? 1280;
    return Math.max(minPanelWidth, Math.min(maxPanelWidth, Math.round(containerWidth - controlsWidth - GRIP_WIDTH - minMapWidth)));
  }, [controlsWidth, maxPanelWidth, minMapWidth, minPanelWidth]);

  const clamp = useCallback(
    (value: number) => Math.min(maxForContainer(), Math.max(minPanelWidth, Math.round(value))),
    [maxForContainer, minPanelWidth],
  );

  /* Restore the remembered width once, after mount. */
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const next = (() => {
      try {
        const raw = window.localStorage.getItem(storageKeyFor(storageKey));
        const stored = raw == null ? NaN : Number(raw);
        return clamp(Number.isFinite(stored) ? stored : defaultPanelWidth);
      } catch {
        return clamp(defaultPanelWidth);
      }
    })();
    setWidth(next);
    widthRef.current = next;
    const timer = window.setTimeout(() => onResizeEndRef.current?.(next), 80);
    return () => window.clearTimeout(timer);
  }, [clamp, defaultPanelWidth, storageKey]);

  /* Keep the desktop split inside the window as it narrows. */
  useEffect(() => {
    let timer = 0;
    const onResize = () => {
      const next = clamp(widthRef.current);
      setWidth(next);
      widthRef.current = next;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => onResizeEndRef.current?.(widthRef.current), 180);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
    };
  }, [clamp]);

  /* Measure the real panel width so its contents can adapt. Bucket the
     value so dragging does not recreate every chart option per frame. */
  useEffect(() => {
    const element = panelRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const bucket = Math.max(280, Math.round(entry.contentRect.width / 32) * 32);
      setMeasured((current) => (current === bucket ? current : bucket));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const persist = useCallback((value: number) => {
    try {
      window.localStorage.setItem(storageKeyFor(storageKey), String(value));
    } catch {
      /* storage can be unavailable in private mode */
    }
  }, [storageKey]);

  const finish = useCallback((value: number, notify = true) => {
    const next = clamp(value);
    setWidth(next);
    widthRef.current = next;
    persist(next);
    if (notify) onResizeEndRef.current?.(next);
  }, [clamp, persist]);

  const stopDragging = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startWidth: widthRef.current, pointerId: event.pointerId };
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = clamp(drag.startWidth - (event.clientX - drag.startX));
    widthRef.current = next;
    setWidth(next);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    try { event.currentTarget.releasePointerCapture(drag.pointerId); } catch { /* already released */ }
    stopDragging();
    finish(widthRef.current);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 64 : 24;
    let next = widthRef.current;
    if (event.key === "ArrowLeft") next += step;
    else if (event.key === "ArrowRight") next -= step;
    else if (event.key === "Home") next = minPanelWidth;
    else if (event.key === "End") next = maxForContainer();
    else return;
    event.preventDefault();
    finish(next);
  };

  useEffect(() => () => {
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const gridStyle = {
    gridTemplateColumns: `${controlsWidth}px minmax(0, 1fr) ${GRIP_WIDTH}px ${width}px`,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={cn("relative flex flex-col lg:grid lg:h-full lg:min-h-0", dragging && "select-none", className)}
      style={gridStyle}
      data-resizing={dragging || undefined}
    >
      <aside
        aria-label={controlsLabel}
        className="relative z-30 min-w-0 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]"
      >
        {controls}
      </aside>

      <div className="relative z-0 mt-4 h-[52svh] min-h-[360px] min-w-0 overflow-hidden rounded-2xl border border-border bg-card lg:mt-0 lg:h-full lg:min-h-0 lg:rounded-none lg:border-0 lg:bg-transparent">
        {map}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the comparison panel"
        aria-valuemin={minPanelWidth}
        aria-valuemax={maxForContainer()}
        aria-valuenow={width}
        aria-valuetext={`Comparison panel ${Math.round(width)} pixels wide. Use the arrow keys to resize, or double-click to reset.`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={(event) => { onPointerUp(event); }}
        onKeyDown={onKeyDown}
        onDoubleClick={() => finish(defaultPanelWidth)}
        className="group relative hidden cursor-col-resize touch-none select-none items-center justify-center focus-visible:outline-none lg:flex"
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-border transition-colors duration-150",
            dragging && "bg-[#a67c3e] dark:bg-[#c9a25e]",
            !dragging && "group-hover:bg-[#a67c3e]/70 group-focus-visible:bg-[#a67c3e] dark:group-hover:bg-[#c9a25e]/70 dark:group-focus-visible:bg-[#c9a25e]",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-1/2 w-[7px] -translate-x-1/2 rounded-full bg-transparent transition-opacity duration-150",
            dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
          )}
        >
          <span className="absolute inset-x-[2px] inset-y-4 rounded-full bg-[#a67c3e]/15 dark:bg-[#c9a25e]/15" />
        </span>
        <span
          className={cn(
            "relative z-10 grid size-6 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-all duration-150",
            "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
            "group-hover:border-[#a67c3e]/60 group-hover:text-[#a67c3e] dark:group-hover:border-[#c9a25e]/60 dark:group-hover:text-[#c9a25e]",
            "group-focus-visible:ring-2 group-focus-visible:ring-[#a67c3e]/40 dark:group-focus-visible:ring-[#c9a25e]/40",
            dragging && "border-[#a67c3e]/70 text-[#a67c3e] dark:border-[#c9a25e]/70 dark:text-[#c9a25e]",
          )}
        >
          <GripVertical className="size-3" aria-hidden />
        </span>
      </div>

      <section
        ref={panelRef}
        aria-label={panelLabel}
        className="relative z-20 mt-4 min-w-0 lg:mt-0 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:py-0.5 lg:pr-1 lg:[scrollbar-width:thin]"
      >
        {panel(measured)}
      </section>
    </div>
  );
}
