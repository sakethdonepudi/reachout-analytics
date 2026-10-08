"use client";

import { cn } from "@/lib/utils";
import type { PollType } from "@/lib/data/tamil-nadu-poll-data";

const OPTIONS: { value: PollType; label: string }[] = [
  { value: "exit", label: "Exit Poll" },
  { value: "opinion", label: "Opinion Poll" },
];

export default function PollToggle({
  value,
  onChange,
}: {
  value: PollType;
  onChange: (v: PollType) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Poll type</p>
      <div role="radiogroup" aria-label="Poll type" className="relative grid grid-cols-2 gap-1 rounded-2xl border border-border bg-elevated/60 p-1">
        {OPTIONS.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "relative rounded-xl px-3 py-2 text-[13px] font-semibold tracking-tight outline-none transition-colors duration-200",
                "focus-visible:ring-2 focus-visible:ring-saffron/60",
                active ? "text-[#241203]" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn("absolute inset-0 rounded-xl transition-opacity duration-200", active ? "opacity-100" : "opacity-0")}
                style={{ background: "linear-gradient(120deg,#ffc078,#f58a24 60%,#e07617)" }}
              />
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
