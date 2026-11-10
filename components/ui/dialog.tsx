"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Placement = "center" | "bottom" | "right";

const overlayPlacement: Record<Placement, string> = {
  center: "items-center justify-center p-4",
  bottom: "items-end justify-center p-0 sm:p-4",
  right: "items-stretch justify-end p-0 sm:p-4",
};

const panelPlacement: Record<Placement, string> = {
  center: "w-full max-w-lg rounded-[var(--radius-panel)]",
  bottom: "w-full max-w-none rounded-t-[var(--radius-panel)] sm:max-w-lg sm:rounded-[var(--radius-panel)]",
  right: "h-full w-full max-w-sm rounded-none sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:rounded-[var(--radius-panel)]",
};

export function Dialog({ open, onClose, title, description, children, footer, placement = "center", className }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  placement?: Placement;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    panel?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn("fixed inset-0 z-50 flex bg-black/50 backdrop-blur-sm", overlayPlacement[placement])}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "max-h-[calc(100vh-2rem)] overflow-y-auto border border-[var(--border-hairline)] bg-[var(--surface-panel)] shadow-[var(--shadow-soft)] focus:outline-none",
          panelPlacement[placement],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-hairline)] px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="type-h3 text-[var(--text-primary)]">{title}</h2>
            {description && <p id={descriptionId} className="type-small mt-1 text-[var(--text-muted)]">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brass)]"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-hairline)] px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
