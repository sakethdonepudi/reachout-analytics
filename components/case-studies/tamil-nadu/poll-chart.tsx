"use client";

import { PARTY_META, PARTY_ORDER, type PartyKey, type PartyResult } from "@/lib/data/tamil-nadu-poll-data";
import { cn } from "@/lib/utils";

const CIRC = 2 * Math.PI * 42;

/** Compact donut + legend. Theme-aware via tokens; party colours are constant. */
export default function PollChart({ results, centerLabel, className }: { results: PartyResult; centerLabel?: string; className?: string }) {
  const total = PARTY_ORDER.reduce((a, k) => a + results[k], 0) || 1;
  const lead = PARTY_ORDER.reduce<PartyKey>((b, k) => (results[k] > results[b] ? k : b), "aiadmk");
  let offset = 0;

  return (
    <div className={cn("flex items-center gap-5", className)}>
      <div className="relative size-[116px] shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--map-line)" strokeOpacity="0.25" strokeWidth="9" />
          {PARTY_ORDER.map((k) => {
            const frac = results[k] / total;
            const dash = frac * CIRC;
            const el = (
              <circle
                key={k}
                cx="50" cy="50" r="42" fill="none"
                stroke={PARTY_META[k].color}
                strokeWidth="9"
                strokeDasharray={`${dash} ${CIRC - dash}`}
                strokeDashoffset={-offset * CIRC}
                style={{ transition: "stroke-dasharray .6s cubic-bezier(.4,0,.2,1), stroke-dashoffset .6s cubic-bezier(.4,0,.2,1)" }}
              />
            );
            offset += frac;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{centerLabel ?? PARTY_META[lead].label}</span>
          <span className="font-display text-2xl font-semibold leading-none text-foreground">{results[lead]}%</span>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {PARTY_ORDER.map((k) => (
          <li key={k} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: PARTY_META[k].color }} aria-hidden />
            <span className="truncate font-medium text-foreground/85">{PARTY_META[k].label}</span>
            <span className="ml-auto tabular-nums font-semibold text-foreground">{results[k]}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
