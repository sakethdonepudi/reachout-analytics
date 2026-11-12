import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "report-pill soon",
  accent: "report-pill live",
  success: "report-pill live",
  warning: "report-pill",
  danger: "report-pill",
};

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center px-2.5 py-0.5",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
