"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type DistrictRow = { name: string; samples: number };

/** Searchable, multi-select district list. */
export default function DistrictFilter({
  rows,
  selected,
  activeDistrict,
  onToggle,
  onSelectAll,
  onClear,
  onHover,
  onActivate,
}: {
  rows: DistrictRow[];
  selected: string[];
  activeDistrict: string | null;
  onToggle: (name: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onHover: (name: string | null) => void;
  onActivate: (name: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => rows.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase())), [rows, q]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Districts</p>
        <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em]">
          <button type="button" onClick={onSelectAll} className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
            Select all
          </button>
          <button type="button" onClick={onClear} className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
            Clear
          </button>
        </div>
      </div>

      <label className="relative mb-3 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search district..."
          aria-label="Search districts"
          className="w-full rounded-xl border border-border bg-elevated/60 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-saffron/60 focus:ring-2 focus:ring-saffron/20"
        />
      </label>

      <div className="-mr-1 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
        <ul className="space-y-0.5">
          {filtered.map((r) => {
            const on = selectedSet.has(r.name);
            const active = activeDistrict === r.name;
            return (
              <li key={r.name}>
                <button
                  type="button"
                  onMouseEnter={() => onHover(r.name)}
                  onMouseLeave={() => onHover(null)}
                  onClick={() => { onToggle(r.name); onActivate(r.name); }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60",
                    active ? "bg-saffron/15 text-foreground" : "text-foreground/75 hover:bg-elevated hover:text-foreground",
                  )}
                >
                  <span className={cn("grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors", on ? "border-saffron bg-saffron text-[#241203]" : "border-border bg-transparent")} aria-hidden>
                    {on && <Check className="size-3" strokeWidth={3.5} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <span className="shrink-0 tabular-nums text-[12px] text-muted-foreground">{r.samples.toLocaleString("en-IN")}</span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">No districts found.</li>}
        </ul>
      </div>

      <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
        No selection = all Tamil Nadu. Pick one or more districts to focus the map and chart.
      </p>
    </div>
  );
}
