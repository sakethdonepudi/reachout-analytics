import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "border-[var(--border-hairline)] bg-[var(--surface-raised)] text-[var(--text-muted)]",
  accent: "border-[var(--accent-brass)]/45 bg-[var(--accent-brass-soft)] text-[var(--accent-brass-strong)]",
  success: "border-[var(--success)]/40 bg-[var(--success-bg)] text-[var(--success)]",
  warning: "border-[var(--warning)]/40 bg-[var(--warning-bg)] text-[var(--warning)]",
  danger: "border-[var(--danger)]/40 bg-[var(--danger-bg)] text-[var(--danger)]",
};

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
