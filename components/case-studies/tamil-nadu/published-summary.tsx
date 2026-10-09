"use client";

import { useEffect, useState } from "react";

type Counts = { total: number; valid: number; blank: number; invalid: number; recorded: number; estimated: number };
type Shares = { denominator: number; shares: { party: string; count: number; pct: number }[] };
type Payload = { ok: boolean; published: boolean; exit?: { counts: Counts | null; shares: Shares }; asOf?: string | null };

/**
 * Shows the published (real) Exit Poll aggregates for this case study when the
 * admin has published a dataset. Until then it renders nothing, so the page
 * falls back to the labelled demonstration figures.
 */
export default function PublishedSummary({ slug }: { slug: string }) {
  const [data, setData] = useState<Payload | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/public/case-studies/${slug}/summary`).then((r) => (r.ok ? r.json() : null)).then((d) => alive && setData(d)).catch(() => {});
    return () => { alive = false; };
  }, [slug]);

  if (!data?.published || !data.exit?.counts || data.exit.counts.total === 0) return null;
  const c = data.exit.counts;
  const shares = data.exit.shares?.shares ?? [];
  const card = (label: string, value: number) => (
    <div key={label} className="rounded-xl border border-border bg-card/60 px-3 py-2">
      <p className="font-display text-lg font-semibold tabular-nums text-foreground">{value.toLocaleString("en-IN")}</p>
      <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
    </div>
  );
  return (
    <section className="mx-auto mt-6 max-w-3xl rounded-3xl border border-[#2fbf4a]/40 bg-[#2fbf4a]/[0.06] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2fbf4a]">Published dataset · Exit Poll</p>
      <p className="mt-1 text-[11.5px] text-muted-foreground">Live figures from the imported dataset{data.asOf ? ` · ${new Date(data.asOf).toLocaleDateString()}` : ""}.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {card("Total", c.total)}{card("Valid party", c.valid)}{card("Recorded", c.recorded)}{card("Estimated", c.estimated)}
      </div>
      {shares.length > 0 && (
        <ul className="mt-3 space-y-1 text-[12px]">
          {shares.map((s) => (
            <li key={s.party} className="flex items-baseline gap-2" title={s.party}>
              <span className="min-w-0 flex-1 break-words text-foreground/80">{s.party}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{s.count.toLocaleString("en-IN")} · {s.pct}%</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[9.5px] text-muted-foreground">Denominator: valid party responses ({data.exit.shares?.denominator.toLocaleString("en-IN")}). Estimated scenario is separate.</p>
    </section>
  );
}
