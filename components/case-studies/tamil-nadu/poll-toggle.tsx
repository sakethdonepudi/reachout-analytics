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
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Poll type</p>
      <div
        role="radiogroup"
        aria-label="Poll type"
        className="relative grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1"
      >
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
                "relative rounded-xl px-3 py-2 text-[13px] font-semibold tracking-tight transition-colors duration-300 outline-none",
                "focus-visible:ring-2 focus-visible:ring-saffron/60",
                active ? "text-[#07122e]" : "text-white/60 hover:text-white/90",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-0 rounded-xl transition-all duration-300",
                  active ? "opacity-100" : "opacity-0",
                )}
                style={{ background: "linear-gradient(120deg,#ffc078,#ff9933 60%,#ff7a1a)" }}
              />
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
