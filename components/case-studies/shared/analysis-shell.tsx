"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* =====================================================================
   Shared presentation shell for the expanded analysis views.

   Full-bleed canvas, slim sticky header, one controlled content column.
   The shell owns Escape, backdrop close, focus trapping, scroll locking
   and the short scale/fade entrance. Content is responsible for the
   charts and the state it needs to return to the map unchanged.
   ===================================================================== */

export type AnalysisShellProps = {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  subtitle: string;
  headerTabs?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
};

export default function AnalysisShell({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  headerTabs,
  children,
  contentClassName,
}: AnalysisShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 30);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab" && dialogRef.current) {
        const nodes = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="analysis-shell fixed inset-0 z-[140] flex"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="analysis-enter flex h-[100svh] w-full flex-col overflow-hidden"
      >
        <header className="analysis-header sticky top-0 z-30 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--a-border)] bg-[color-mix(in_srgb,var(--a-canvas)_92%,transparent)] px-4 py-2.5 backdrop-blur-xl sm:px-6 lg:px-10">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {eyebrow && <span className="hidden text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--a-brass)] sm:inline">{eyebrow}</span>}
              <h2 id={headingId} className="truncate font-display text-[16px] font-semibold leading-tight text-[var(--a-ink)] sm:text-[19px]">{title}</h2>
            </div>
            <p className="mt-0.5 truncate text-[10px] font-medium text-[var(--a-muted)] sm:text-[10.5px]">{subtitle}</p>
          </div>

          {headerTabs && <div className="order-3 w-full sm:order-none sm:w-auto">{headerTabs}</div>}

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close analysis"
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-[var(--a-border)] bg-[var(--a-panel)] px-3 py-1.5 text-[11px] sm:min-h-8 font-semibold text-[var(--a-ink)] transition-colors hover:border-[var(--a-brass)]/60 hover:text-[var(--a-brass)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-brass)]/45"
          >
            <X className="size-3.5" aria-hidden /> Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={cn("mx-auto w-full max-w-[1180px] px-4 pb-12 pt-5 sm:px-6 lg:px-10", contentClassName)}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
