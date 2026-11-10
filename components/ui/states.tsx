import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ title, action, className }: { title: string; action?: ReactNode; className?: string }) {
  return (
    <div role="status" className={cn("rounded-[var(--radius-card)] border border-dashed border-[var(--border-hairline)] p-5", className)}>
      <p className="type-small text-[var(--text-muted)]">{title}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = "Something went wrong.", onRetry, className }: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("rounded-[var(--radius-card)] border border-[var(--danger)]/40 bg-[var(--danger-bg)] p-5", className)}>
      <p className="type-small text-[var(--danger)]">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-[var(--danger)]/40 px-3 text-[12px] font-semibold text-[var(--danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brass)]"
        >
          Retry
        </button>
      )}
    </div>
  );
}
