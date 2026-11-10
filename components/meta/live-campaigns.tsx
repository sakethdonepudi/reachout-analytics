"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Play } from "lucide-react";
import { CreativeViewer } from "@/components/meta/creative-viewer";
import { formatInr } from "@/lib/meta/insights";
import type { ClientMetrics, ClientState } from "@/lib/meta/client-dto";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  /** Owner view adds the cost columns. Clients never receive cost keys from the server. */
  owner?: boolean;
  compact?: boolean;
  className?: string;
};

const RANGE_LABEL: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month",
  lifetime: "Lifetime",
};

function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1e7) return `${(value / 1e7).toFixed(1)}Cr`;
  if (Math.abs(value) >= 1e5) return `${(value / 1e5).toFixed(1)}L`;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function formatPct(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`;
}

function statusLabel(status: string | null): string {
  if (!status) return "—";
  return status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function statusTone(status: string | null): string {
  if (!status) return "text-muted-foreground";
  if (status === "ACTIVE") return "text-emerald-600 dark:text-emerald-400";
  if (["PENDING_BILLING_INFO", "WITH_ISSUES", "IN_PROCESS", "PAUSED"].includes(status)) return "text-amber-600 dark:text-amber-400";
  if (["DISABLED", "DISAPPROVED", "DELETED"].includes(status)) return "text-rose-600 dark:text-rose-400";
  return "text-muted-foreground";
}

function MetricsCells({ metrics, owner }: { metrics: ClientMetrics; owner: boolean }) {
  return (
    <>
      {owner && <td className="px-1 text-right tabular-nums">{formatInr(metrics.spend ?? null)}</td>}
      <td className="px-1 text-right tabular-nums">{formatCount(metrics.impressions)}</td>
      <td className="px-1 text-right tabular-nums">{formatCount(metrics.reach)}</td>
      <td className="px-1 text-right tabular-nums">{formatCount(metrics.clicks)}</td>
      <td className="px-1 text-right tabular-nums">{formatPct(metrics.ctr)}</td>
      <td className="px-1 text-right tabular-nums">{formatCount(metrics.thruPlays)}</td>
    </>
  );
}

export function LiveCampaigns({ slug, owner = false, compact = false, className }: Props) {
  const [state, setState] = useState<ClientState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openCampaign, setOpenCampaign] = useState<string | null>(null);
  const [viewAd, setViewAd] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const endpoint = owner ? `/api/meta/owner/state/${encodeURIComponent(slug)}` : `/api/meta/client/state/${encodeURIComponent(slug)}`;
      const response = await fetch(`${endpoint}?range=7d&platform=all`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load live campaign data");
      const payload = await response.json();
      setState(payload.state ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load live campaign data");
    } finally {
      setLoading(false);
    }
  }, [owner, slug]);

  useEffect(() => { void load(); }, [load]);

  const parties = useMemo(() => state?.parties ?? [], [state]);
  const campaigns = useMemo(() => state?.campaigns ?? [], [state]);
  const columnCount = owner ? 9 : 8;

  if (loading && !state) {
    return (
      <div className={cn("mt-2 flex items-center gap-1.5 rounded-lg border border-border/70 px-2 py-2 text-[9px] text-muted-foreground", className)} aria-live="polite">
        <Loader2 className="size-3 animate-spin motion-reduce:animate-none" /> Loading live campaigns…
      </div>
    );
  }

  if (!state || !campaigns.length) {
    return (
      <div className={cn("mt-2 rounded-lg border border-border/70 px-2 py-2 text-[9px] text-muted-foreground", className)} aria-live="polite">
        {error || "No live campaigns have synced for this state yet."}
      </div>
    );
  }

  return (
    <div className={cn("mt-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Live campaigns · {RANGE_LABEL[state.range] ?? state.range}
        </p>
        <p className="text-[8px] text-muted-foreground">{state.totals.activeCampaigns} active · Meta Ads</p>
      </div>

      {compact ? (
        <div className="mt-1 overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full min-w-[330px] border-collapse text-[8.5px]">
            <caption className="sr-only">Live Meta campaign delivery by party</caption>
            <thead>
              <tr className="border-b border-border/70 text-[7px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-1 py-1.5 text-left font-semibold">Party</th>
                <th scope="col" className="px-1 py-1.5 text-right font-semibold">Active</th>
                {owner && <th scope="col" className="px-1 py-1.5 text-right font-semibold">Spend</th>}
                <th scope="col" className="px-1 py-1.5 text-right font-semibold">Impressions</th>
                <th scope="col" className="px-1 py-1.5 text-right font-semibold">Reach</th>
                <th scope="col" className="px-1 py-1.5 text-right font-semibold">Clicks</th>
                <th scope="col" className="px-1 py-1.5 text-right font-semibold">CTR</th>
                <th scope="col" className="px-1 py-1.5 text-right font-semibold">ThruPlays</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((party) => (
                <tr key={party.party} className="border-t border-border/50">
                  <th scope="row" className="px-1 py-1 text-left font-medium">
                    <span className="inline-flex items-center gap-1">
                      <span className="size-1.5 shrink-0 rounded-sm" style={{ background: party.color }} />
                      {party.partyLabel}
                    </span>
                  </th>
                  <td className="px-1 py-1 text-right tabular-nums">{party.campaigns}</td>
                  <MetricsCells metrics={party.metrics} owner={owner} />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/20 font-semibold">
                <td className="px-1 py-1">Total</td>
                <td className="px-1 py-1 text-right tabular-nums">{state.totals.activeCampaigns}</td>
                <MetricsCells metrics={state.totals} owner={owner} />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="mt-1 overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full min-w-[520px] border-collapse text-[9.5px]">
            <caption className="sr-only">Live Meta campaigns by party with delivery metrics</caption>
            <thead>
              <tr className="border-b border-border/70 text-[8px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-2 py-1.5 text-left font-semibold">Campaign</th>
                <th scope="col" className="px-2 py-1.5 text-left font-semibold">Status</th>
                <th scope="col" className="px-2 py-1.5 text-right font-semibold">Ads</th>
                {owner && <th scope="col" className="px-2 py-1.5 text-right font-semibold">Spend</th>}
                <th scope="col" className="px-2 py-1.5 text-right font-semibold">Impressions</th>
                <th scope="col" className="px-2 py-1.5 text-right font-semibold">Reach</th>
                <th scope="col" className="px-2 py-1.5 text-right font-semibold">Clicks</th>
                <th scope="col" className="px-2 py-1.5 text-right font-semibold">CTR</th>
                <th scope="col" className="px-2 py-1.5 text-right font-semibold">ThruPlays</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((party) => {
                const partyCampaigns = campaigns.filter((campaign) => campaign.party === party.party);
                return [
                  <tr key={`party:${party.party}`} className="border-t border-border bg-muted/15">
                    <th scope="rowgroup" colSpan={2} className="px-2 py-1.5 text-left text-[9px] font-bold uppercase tracking-[0.1em]">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ background: party.color }} />
                        {party.partyLabel}
                      </span>
                    </th>
                    <td className="px-2 py-1.5 text-right tabular-nums">{party.campaigns}</td>
                    <MetricsCells metrics={party.metrics} owner={owner} />
                  </tr>,
                  ...partyCampaigns.flatMap((campaign) => {
                    const ads = campaign.adsets.flatMap((adset) => adset.ads);
                    const open = openCampaign === campaign.id;
                    const rows = [
                      <tr key={`campaign:${campaign.id}`} className="border-t border-border/50">
                        <th scope="row" className="px-2 py-1.5 text-left font-medium">
                          <span className="inline-flex items-center gap-1.5 pl-3">
                            <span className="size-1.5 shrink-0 rounded-sm" style={{ background: campaign.color }} />
                            <span className="min-w-0 truncate" title={campaign.name}>{campaign.name}</span>
                          </span>
                        </th>
                        <td className={cn("px-2 py-1.5 text-left text-[8.5px] font-semibold", statusTone(campaign.status))}>{statusLabel(campaign.status)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {ads.length ? (
                            <button type="button" onClick={() => setOpenCampaign(open ? null : campaign.id)} aria-expanded={open} className="inline-flex min-h-6 items-center gap-0.5 rounded px-1 font-semibold text-[var(--accent-brass-strong)] hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
                              {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />} {ads.length}
                            </button>
                          ) : "—"}
                        </td>
                        <MetricsCells metrics={campaign.metrics} owner={owner} />
                      </tr>,
                    ];
                    if (open && ads.length) {
                      rows.push(
                        <tr key={`ads:${campaign.id}`} className="border-t border-border/40 bg-muted/10">
                          <td colSpan={columnCount} className="px-2 py-2">
                            <ul className="space-y-1">
                              {ads.map((ad) => (
                                <li key={ad.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/50 px-2 py-1.5">
                                  <span className="min-w-0 flex-1 truncate text-[9px]" title={ad.name}>{ad.name}</span>
                                  <span className={cn("text-[8.5px] font-semibold", statusTone(ad.status))}>{statusLabel(ad.status)}</span>
                                  <span className="text-[8.5px] tabular-nums text-muted-foreground">{formatCount(ad.metrics.impressions)} impr · {formatPct(ad.metrics.ctr)} CTR</span>
                                  <button type="button" onClick={() => setViewAd(ad.id)} className="inline-flex min-h-7 items-center gap-1 rounded border border-border px-1.5 text-[8.5px] font-semibold hover:border-saffron/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
                                    <Play className="size-2.5" /> Creative
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>,
                      );
                    }
                    return rows;
                  }),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-1 text-[8px] text-muted-foreground">
        Campaign reach is per campaign and additive, not deduplicated across campaigns.
        {owner ? " Costs are visible to owners only." : ""}
      </p>

      <CreativeViewer adId={viewAd} slug={slug} owner={owner} onClose={() => setViewAd(null)} />
    </div>
  );
}
