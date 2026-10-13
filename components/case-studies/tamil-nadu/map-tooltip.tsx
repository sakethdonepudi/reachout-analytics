"use client";

import type { PartyResult } from "@/lib/data/tamil-nadu-poll-data";

export type MapTooltipData =
  | { kind: "district"; name: string; samples: number; results: PartyResult; valid?: number; leader?: string | null; leaderPct?: number; empty?: boolean }
  | { kind: "pincode"; pincode: string; district: string; samples: number; results: PartyResult; pollType: "exit" | "opinion"; survey?: boolean; valid?: number; postalPlace?: string | null; leader?: string | null; leaderPct?: number };

const TIP_W = 236;
const TIP_H = 132;

/** Compact glass tooltip anchored to the pointer, kept inside the viewport. */
export default function MapTooltip({ data, x, y }: { data: MapTooltipData; x: number; y: number }) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
  const vh = typeof window !== "undefined" ? window.innerHeight : 1080;
  const left = Math.max(8, Math.min(x + 16, vw - TIP_W - 8));
  const top = Math.max(8, Math.min(y + 16, vh - TIP_H - 8));

  return (
    <div className="pointer-events-none fixed left-0 top-0 z-[60] w-[236px]" style={{ transform: `translate(${left}px, ${top}px)` }} role="status">
      <div className="glass relative rounded-2xl p-3.5">
        <span className="tricolor-line absolute inset-x-4 top-0 h-px opacity-70" aria-hidden />

        {data.kind === "district" ? (
          <>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">District</p>
            <p className="font-display text-base font-semibold leading-tight text-foreground">{data.name}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Survey responses: <b className="font-semibold text-foreground">{(data.valid ?? 0).toLocaleString("en-IN")}</b>
            </p>
            {(data.valid ?? 0) === 0 || data.empty ? (
              <p className="mt-1 text-[11px] text-muted-foreground">No survey responses available.</p>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Leading: <b className="font-semibold text-foreground">{data.leader ?? "—"}</b>
                {data.leaderPct !== undefined ? <span className="text-muted-foreground"> · {data.leaderPct.toFixed(1)}%</span> : null}
              </p>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Click to explore district and PIN codes.</p>
          </>
        ) : (
          <>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">PIN code · {data.district || "—"}</p>
            <p className="font-display text-base font-semibold leading-tight tabular-nums text-foreground">{data.pincode}</p>
            {data.postalPlace && <p className="text-[11px] text-muted-foreground">{data.postalPlace}</p>}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Allocated responses: <b className="font-semibold text-foreground">{(data.valid ?? 0).toLocaleString("en-IN")}</b>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Leading: <b className="font-semibold text-foreground">{data.leader ?? "—"}</b>
              {data.leaderPct !== undefined ? <span className="text-muted-foreground"> · {data.leaderPct.toFixed(1)}%</span> : null}
            </p>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">Based on district survey totals.</p>
          </>
        )}
      </div>
    </div>
  );
}
