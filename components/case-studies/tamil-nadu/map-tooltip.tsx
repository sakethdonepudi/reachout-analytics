"use client";

import { PARTY_META, PARTY_ORDER, type PartyResult } from "@/lib/data/tamil-nadu-poll-data";
import { cn } from "@/lib/utils";

export type MapTooltipData =
  | { kind: "district"; name: string; samples: number; results: PartyResult }
  | {
      kind: "pincode";
      pincode: string;
      district: string;
      samples: number;
      results: PartyResult;
      pollType: "exit" | "opinion";
    }
  | { kind: "cluster"; count: number; district: string };

/**
 * Glass tooltip anchored to the pointer. Never relies on colour alone —
 * party names and percentages are always spelled out.
 */
export default function MapTooltip({ data, x, y }: { data: MapTooltipData; x: number; y: number }) {
  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-[60] w-[220px] transition-opacity duration-150"
      style={{ transform: `translate(${x + 16}px, ${y + 16}px)` }}
      role="status"
    >
      <div className="glass rounded-2xl p-3.5">
        <span className="tricolor-line absolute inset-x-4 top-0 h-px opacity-70" aria-hidden />
        {data.kind === "cluster" ? (
          <>
            <p className="font-display text-lg font-semibold leading-tight text-white">{data.count.toLocaleString("en-IN")}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-saffron-2">
              survey points · {data.district}
            </p>
            <p className="mt-1 text-[11px] text-white/50">Zoom in to expand</p>
          </>
        ) : (
          <>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
              {data.kind === "pincode" ? `Pincode · ${data.district}` : "District"}
            </p>
            <p className="font-display text-base font-semibold leading-tight text-white">
              {data.kind === "pincode" ? data.pincode : data.name}
            </p>
            <p className="mt-0.5 text-[11px] text-white/50">
              Samples: <b className="font-semibold text-white/80">{data.samples.toLocaleString("en-IN")}</b>
            </p>
            {data.kind === "pincode" && (
              <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-saffron-2">
                {data.pollType === "exit" ? "Exit Poll" : "Opinion Poll"}
              </p>
            )}
            <ul className="mt-2 space-y-1 border-t border-white/10 pt-2">
              {PARTY_ORDER.map((k) => (
                <li key={k} className="flex items-center gap-2 text-[12px]">
                  <span className="size-2 rounded-sm" style={{ background: PARTY_META[k].color }} aria-hidden />
                  <span className="text-white/60">{PARTY_META[k].label}</span>
                  <span className={cn("ml-auto tabular-nums font-semibold text-white")}>{data.results[k]}%</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
