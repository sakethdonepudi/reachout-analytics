"use client";

import { PARTY_META, leadingParty, type PartyResult } from "@/lib/data/tamil-nadu-poll-data";

/**
 * Headline figures for the current geographic selection. Reacts to district /
 * pincode selection: shows the selected region, the total sample count and the
 * leading party.
 */
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
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Selected region</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="min-w-0 truncate font-display text-[15px] font-semibold text-white">{scope}</p>
        {chip && (
          <span className="shrink-0 rounded-full border border-saffron/40 bg-saffron/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-saffron-2">
            {chip}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Total samples</p>
          <p className="font-display text-3xl font-semibold tabular-nums leading-tight text-white">
            {samples.toLocaleString("en-IN")}
          </p>
        </div>
        <p className="shrink-0 text-right text-[11px] text-white/40">
          Leading:{" "}
          <span className="font-semibold" style={{ color: PARTY_META[lead].color }}>
            {PARTY_META[lead].label}
          </span>
        </p>
      </div>
    </div>
  );
}
