"use client";

import { cn } from "@/lib/utils";

export type DateRangePreset = "today" | "yesterday" | "7d" | "30d" | "month" | "lifetime" | "custom";
export type DateRangeValue = { preset: DateRangePreset; from?: string; to?: string };

const PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "month", label: "This month" },
  { id: "lifetime", label: "Lifetime" },
  { id: "custom", label: "Custom" },
];

export function DateRangePicker({ value, onChange, className }: {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div role="group" aria-label="Date range" className="flex flex-wrap gap-1 rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] p-0.5">
        {PRESETS.map((preset) => {
          const active = value.preset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ ...value, preset: preset.id })}
              className={cn(
                "min-h-10 rounded-[calc(var(--radius-control)-3px)] px-2.5 text-[11.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brass)]",
                active ? "bg-[var(--surface-panel)] text-[var(--text-primary)] shadow-[var(--shadow-soft)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      {value.preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
            From
            <input
              type="date"
              value={value.from ?? ""}
              onChange={(event) => onChange({ ...value, from: event.target.value })}
              className="min-h-10 rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-2 text-[12px] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brass)]"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
            To
            <input
              type="date"
              value={value.to ?? ""}
              onChange={(event) => onChange({ ...value, to: event.target.value })}
              className="min-h-10 rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-2 text-[12px] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brass)]"
            />
          </label>
        </div>
      )}
    </div>
  );
}
