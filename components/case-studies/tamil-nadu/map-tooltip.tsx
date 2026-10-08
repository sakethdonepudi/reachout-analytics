"use client";

import { PARTY_META, PARTY_ORDER, type PartyResult } from "@/lib/data/tamil-nadu-poll-data";

export type MapTooltipData =
  | { kind: "district"; name: string; samples: number; results: PartyResult }
  | { kind: "pincode"; pincode: string; district: string; samples: number; results: PartyResult; pollType: "exit" | "opinion" };

/** Glass tooltip anchored to the pointer. Always spells out party names + %. */
export default function MapTooltip({ data, x, y }: { data: MapTooltipData; x: number; y: number }) {
  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-[60] w-[220px]"
      style={{ transform: `translate(${x + 16}px, ${y + 16}px)` }}
      role="status"
    >
      <div className="glass relative rounded-2xl p-3.5">
        <span className="tricolor-line absolute inset-x-4 top-0 h-px opacity-70" aria-hidden />
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {data.kind === "pincode" ? `Pincode · ${data.district}` : "District"}
        </p>
        <p className="font-display text-base font-semibold leading-tight text-foreground">
          {data.kind === "pincode" ? data.pincode : data.name}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Samples: <b className="font-semibold text-foreground">{data.samples.toLocaleString("en-IN")}</b>
        </p>
        {data.kind === "pincode" && (
          <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-saffron-2">
            {data.pollType === "exit" ? "Exit Poll" : "Opinion Poll"}
          </p>
        )}
        <ul className="mt-2 space-y-1 border-t border-border pt-2">
          {PARTY_ORDER.map((k) => (
            <li key={k} className="flex items-center gap-2 text-[12px]">
              <span className="size-2 rounded-sm" style={{ background: PARTY_META[k].color }} aria-hidden />
              <span className="text-muted-foreground">{PARTY_META[k].label}</span>
              <span className="ml-auto tabular-nums font-semibold text-foreground">{data.results[k]}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
