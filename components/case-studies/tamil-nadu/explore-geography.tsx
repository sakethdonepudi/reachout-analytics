"use client";

import { useRef } from "react";
import { Map as MapIcon, MapPin, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MapMode } from "./tamil-nadu-map";

const TABS: { id: MapMode; label: string; Icon: typeof MapIcon }[] = [
  { id: "state", label: "State", Icon: MapIcon },
  { id: "district", label: "District", Icon: MapPin },
  { id: "pincode", label: "PIN Code", Icon: Navigation },
];

/**
 * Compact geography switcher. One tablist drives the map mode, the
 * breadcrumb and the right-hand list, so they can never disagree.
 * Roving tabindex + arrow/Home/End keys, comfortable touch targets.
 */
export default function ExploreGeography({
  mode,
  onChange,
  pincodeDisabled,
}: {
  mode: MapMode;
  onChange: (m: MapMode) => void;
  pincodeDisabled: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const guidance =
    mode === "state"
      ? "Entire Tamil Nadu — statewide results. Clears district and PIN selections."
      : mode === "district"
        ? "Pick districts on the map or in the list. Results combine."
        : pincodeDisabled
          ? "PIN-code data is not available for this dataset."
          : "Select a district, then choose a PIN code.";

  const enabled = TABS.map((_, i) => i).filter((i) => TABS[i].id !== "pincode" || !pincodeDisabled);
  const move = (from: number, dir: number) => {
    const pos = enabled.indexOf(from);
    const next = enabled[(pos + dir + enabled.length) % enabled.length];
    refs.current[next]?.focus();
    onChange(TABS[next].id);
  };
  const first = enabled[0];
  const last = enabled[enabled.length - 1];

  return (
    <div>
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Explore geography</p>
      <div
        role="tablist"
        aria-label="Geography view"
        className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-elevated/50 p-1"
      >
        {TABS.map(({ id, label, Icon }, i) => {
          const active = mode === id;
          const unavailable = id === "pincode" && pincodeDisabled;
          return (
            <button
              key={id}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="tab"
              id={`geo-tab-${id}`}
              aria-selected={active}
              aria-disabled={unavailable}
              aria-controls="geo-panel"
              title={unavailable ? "PIN-code data is not available for this dataset." : undefined}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(i, 1); }
                else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(i, -1); }
                else if (e.key === "Home") { e.preventDefault(); refs.current[first]?.focus(); onChange(TABS[first].id); }
                else if (e.key === "End") { e.preventDefault(); refs.current[last]?.focus(); onChange(TABS[last].id); }
              }}
              className={cn(
                "flex min-h-[40px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11.5px] font-semibold leading-tight outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-saffron/60",
                active ? "bg-saffron/15 text-saffron-2 ring-1 ring-inset ring-saffron/50" : "text-muted-foreground hover:bg-elevated hover:text-foreground",
                unavailable && !active && "opacity-45",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
      <p className={cn("mt-2 px-1 text-[11px] leading-relaxed", mode === "pincode" && pincodeDisabled ? "text-saffron-2" : "text-muted-foreground")}>
        {guidance}
      </p>
    </div>
  );
}
