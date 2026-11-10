"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export type SegmentItem = { id: string; label: string };

export function SegmentedControl({ items, value, onChange, ariaLabel, className }: {
  items: SegmentItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowRight"
          ? (index + 1) % items.length
          : (index - 1 + items.length) % items.length;
    const next = items[nextIndex];
    if (!next) return;
    onChange(next.id);
    refs.current[nextIndex]?.focus();
  }

  return (
    <div role="group" aria-label={ariaLabel} className={cn("inline-flex rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] p-0.5", className)}>
      {items.map((item, index) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            ref={(node) => { refs.current[index] = node; }}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "min-h-10 rounded-[calc(var(--radius-control)-3px)] px-3 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brass)]",
              active ? "bg-[var(--surface-panel)] text-[var(--text-primary)] shadow-[var(--shadow-soft)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
