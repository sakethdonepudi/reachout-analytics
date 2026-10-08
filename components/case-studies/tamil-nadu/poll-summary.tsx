"use client";

import { PARTY_META, leadingParty, type PartyResult } from "@/lib/data/tamil-nadu-poll-data";

/** Headline figures for the current geographic selection. */
export default function PollSummary({
  scope,
  samples,
  results,
  chip,
}: {
  scope: string;
  samples: number;
  results: PartyResult;
  chip?: string;
}) {
  const lead = leadingParty(results);
  const noData = samples === 0;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Selected region</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="min-w-0 truncate font-display text-[15px] font-semibold text-foreground">{scope}</p>
        {chip && (
          <span className="shrink-0 rounded-full border border-saffron/40 bg-saffron/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-saffron-2">
            {chip}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Total samples</p>
          <p className="font-display text-3xl font-semibold tabular-nums leading-tight text-foreground">
            {noData ? "—" : samples.toLocaleString("en-IN")}
          </p>
        </div>
        {!noData && (
          <p className="shrink-0 text-right text-[11px] text-muted-foreground">
            Leading:{" "}
            <span className="font-semibold" style={{ color: PARTY_META[lead].color }}>
              {PARTY_META[lead].label}
            </span>
          </p>
        )}
      </div>
      {noData && <p className="mt-2 text-[11px] text-muted-foreground">No data available for this selection.</p>}
    </div>
  );
}
