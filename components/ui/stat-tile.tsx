import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "./card";

export type StatDelta = {
  value: ReactNode;
  direction?: "up" | "down" | "flat";
  label?: string;
};

export function StatTile({ label, value, delta, hint, className }: {
  label: string;
  value: ReactNode | number | null | undefined;
  delta?: StatDelta;
  hint?: ReactNode;
  className?: string;
}) {
  const display = value == null
    ? "—"
    : typeof value === "number"
      ? new Intl.NumberFormat("en-IN").format(value)
      : value;
  const deltaTone = delta?.direction === "up"
    ? "text-[var(--success)]"
    : delta?.direction === "down"
      ? "text-[var(--danger)]"
      : "text-[var(--text-muted)]";
  return (
    <Card className={cn("p-4", className)}>
      <p className="type-micro text-[var(--text-muted)]">{label}</p>
      <p className="num mt-2 font-display text-[clamp(1.4rem,2.2vw,2rem)] font-semibold leading-none text-[var(--text-primary)]">{display}</p>
      {(delta || hint) && (
        <p className={cn("mt-2 flex flex-wrap items-center gap-2 text-[11px]", deltaTone)}>
          {delta && <span className="num font-semibold">{delta.value}{delta.label ? ` ${delta.label}` : ""}</span>}
          {hint && <span className="text-[var(--text-muted)]">{hint}</span>}
        </p>
      )}
    </Card>
  );
}
