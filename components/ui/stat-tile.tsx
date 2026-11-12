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
  const noteTone = delta?.direction === "up" ? "good" : delta?.direction === "down" ? "bad" : "";
  return (
    <div className={cn("report-stat", className)}>
      <p className="report-stat-label">{label}</p>
      <p className="report-stat-value">{display}</p>
      {(delta || hint) && (
        <p className={cn("report-stat-note", noteTone)}>
          {delta && <span className="num font-semibold">{delta.value}{delta.label ? ` ${delta.label}` : ""}</span>}
          {hint && <span>{delta ? " · " : ""}{hint}</span>}
        </p>
      )}
    </div>
  );
}
