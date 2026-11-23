"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronRight, Loader2, X } from "lucide-react";
import type { SocialFilter, TnSocialFiltered, TnSocialOverview } from "@/lib/survey/social-types";
import { cn } from "@/lib/utils";

const number = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("en-IN").format(Math.round(value)));
const compact = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
  if (value >= 1e5) return `${(value / 1e5).toFixed(2)} L`;
  return number(value);
};

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-[#EAEAEA] bg-white p-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6B6B6B]">{label}</p>
      <p className="mt-1 font-display text-[20px] font-semibold leading-none tracking-[-0.02em] text-[#0B0B0C]">{value}</p>
      {note && <p className="mt-1 text-[9px] text-[#6B6B6B]">{note}</p>}
    </div>
  );
}

export default function TnSocialMedia({ stateSlug, initialFilter, onClose }: { stateSlug: string; initialFilter?: SocialFilter | null; onClose?: () => void }) {
  const [overview, setOverview] = useState<TnSocialOverview | null>(null);
  const [filtered, setFiltered] = useState<TnSocialFiltered | null>(null);
  const [account, setAccount] = useState<TnSocialFiltered | null>(null);
  const [openAccount, setOpenAccount] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (filter: SocialFilter | null | undefined) => {
    setLoading(true);
    setError("");
    try {
      if (filter) {
        const params = new URLSearchParams({ state: stateSlug, mode: "filter", match: filter.match, kind: filter.kind ?? "", place: filter.place ?? "", label: filter.label ?? "", value: filter.value ?? "", average: filter.average ?? "", group: filter.group ?? "" });
        const response = await fetch(`/api/survey/social?${params}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) throw new Error(payload.error ?? "The filtered campaigns could not be loaded.");
        setFiltered(payload.filtered as TnSocialFiltered);
      } else {
        const response = await fetch(`/api/survey/social?state=${stateSlug}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) throw new Error(payload.error ?? "The social view could not be loaded.");
        setOverview(payload.overview as TnSocialOverview);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The social view could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [stateSlug]);

  useEffect(() => {
    void load(initialFilter);
  }, [initialFilter, load]);

  async function toggleAccount(id: string) {
    if (openAccount === id) { setOpenAccount(null); return; }
    setOpenAccount(id);
    if (account?.accounts[0]?.id === id) return;
    try {
      const response = await fetch(`/api/survey/social?state=${stateSlug}&mode=account&account=${encodeURIComponent(id)}`);
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.ok) setAccount(payload.account as TnSocialFiltered);
    } catch { /* keep the overview usable */ }
  }

  if (loading && !overview && !filtered) {
    return <div className="flex items-center gap-2 rounded-xl border border-[#EAEAEA] bg-white p-6 text-[12px] text-[#6B6B6B]"><Loader2 className="size-4 animate-spin" /> Loading the social view...</div>;
  }
  if (error) {
    return <div role="alert" className="rounded-xl border border-[#B42318]/30 bg-[#FEF3F2] px-3 py-2 text-[12px] text-[#B42318]">{error}</div>;
  }

  const active = filtered ?? overview;
  const totals = filtered
    ? { campaigns: filtered.totalMatching, reach: filtered.accounts.reduce((sum, item) => sum + item.reach, 0), impressions: filtered.accounts.reduce((sum, item) => sum + item.impressions, 0), views: filtered.accounts.reduce((sum, item) => sum + item.views, 0), clicks: filtered.accounts.reduce((sum, item) => sum + item.clicks, 0), engagements: filtered.accounts.reduce((sum, item) => sum + item.engagements, 0) }
    : overview?.totals;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-[#0B0B0C]">{filtered ? filtered.title : "Social Media"}</h2>
          <p className="mt-1 text-[11.5px] text-[#6B6B6B]">{filtered ? filtered.note : `${overview?.range ?? ""}${overview?.asOf ? ` · as of ${overview.asOf}` : ""}`}</p>
        </div>
        {filtered && onClose && (
          <button type="button" onClick={onClose} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#0B0B0C] px-3 text-[11px] font-semibold text-[#0B0B0C] hover:bg-[#0B0B0C] hover:text-white">
            <X className="size-3.5" /> Close · back to survey
          </button>
        )}
      </div>

      {filtered && <p className="rounded-lg border border-[#EAEAEA] bg-[#FAFAFA] px-3 py-2 text-[11px] text-[#555]">{filtered.how}. Ranked by reach. Top {Math.min(100, filtered.campaigns.length)} shown.</p>}

      {totals && (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Campaigns" value={number(totals.campaigns)} />
          <Stat label="Reach" value={compact(totals.reach)} note={number(totals.reach)} />
          <Stat label="Impressions" value={compact(totals.impressions)} note={number(totals.impressions)} />
          <Stat label="Views" value={compact(totals.views)} note={number(totals.views)} />
          <Stat label="Clicks" value={compact(totals.clicks)} note={number(totals.clicks)} />
          <Stat label="Engagement" value={compact(totals.engagements)} note={number(totals.engagements)} />
        </div>
      )}

      {!filtered && overview && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {overview.periods.map((period) => (
            <div key={period.key} className="rounded-xl border border-[#EAEAEA] bg-white p-3">
              <p className="text-[10px] font-semibold text-[#0B0B0C]">{period.label}</p>
              <p className="mt-1 text-[11px] text-[#555]"><b className="text-[#0B0B0C]">{number(period.campaigns)}</b> campaigns · reach {compact(period.reach)}</p>
              {period.responses != null && <p className="mt-0.5 text-[10px] text-[#6B6B6B]">{number(period.responses)} survey responses</p>}
            </div>
          ))}
        </div>
      )}

      {active && (
        <section className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white" aria-label={filtered ? "Ad accounts used" : "Ad accounts"}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAEAEA] px-3 py-2">
            <h3 className="text-[12px] font-semibold text-[#0B0B0C]">{filtered ? "Ad accounts used" : "Ad accounts"}</h3>
            <p className="text-[10px] text-[#6B6B6B]">{(active.accounts ?? []).length} accounts</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[10px]">
              <thead className="bg-[#FAFAFA] text-left text-[8px] uppercase tracking-wide text-[#6B6B6B]">
                <tr>
                  <th className="px-3 py-2">Ad account</th>
                  <th className="px-2 py-2 text-right">Campaigns</th>
                  <th className="px-2 py-2 text-right">Reach</th>
                  <th className="px-2 py-2 text-right">Impressions</th>
                  <th className="px-2 py-2 text-right">Views</th>
                  <th className="px-2 py-2 text-right">Clicks</th>
                  <th className="px-2 py-2 text-right">Engagement</th>
                </tr>
              </thead>
              <tbody>
                {(active.accounts ?? []).map((item) => (
                  <tr key={item.id} className="border-t border-[#EAEAEA] align-top">
                    <th scope="row" className="px-3 py-2 text-left font-semibold text-[#0B0B0C]">
                      {filtered ? item.name : (
                        <button type="button" onClick={() => void toggleAccount(item.id)} className="inline-flex items-center gap-1 text-left hover:text-[#1f6fd1]">
                          {openAccount === item.id ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                          {item.name}
                        </button>
                      )}
                      <span className="mt-0.5 block text-[8.5px] font-normal text-[#6B6B6B]">{item.business || "Ad account"} · {item.id}</span>
                    </th>
                    <td className="px-2 py-2 text-right tabular-nums">{number(item.campaignCount)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{number(item.reach)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{number(item.impressions)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{number(item.views)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{number(item.clicks)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{number(item.engagements)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!filtered && openAccount && account?.accounts[0]?.id === openAccount && (
        <CampaignTable title={`Campaigns · ${account.accounts[0].name}`} campaigns={account.campaigns} total={account.totalMatching} />
      )}

      {filtered && <CampaignTable title={`Top ${Math.min(100, filtered.campaigns.length)} campaigns`} campaigns={filtered.campaigns} total={filtered.totalMatching} />}
    </div>
  );
}

function CampaignTable({ title, campaigns, total }: { title: string; campaigns: TnSocialFiltered["campaigns"]; total: number }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAEAEA] px-3 py-2">
        <h3 className="text-[12px] font-semibold text-[#0B0B0C]">{title}</h3>
        <p className="text-[10px] text-[#6B6B6B]">{campaigns.length} of {total}</p>
      </div>
      <div className="max-h-[460px] overflow-auto">
        <table className="w-full min-w-[760px] border-collapse text-[10px]">
          <thead className="sticky top-0 z-10 bg-[#FAFAFA] text-left text-[8px] uppercase tracking-wide text-[#6B6B6B]">
            <tr>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-2 py-2">Period</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Start</th>
              <th className="px-2 py-2 text-right">Reach</th>
              <th className="px-2 py-2 text-right">Impressions</th>
              <th className="px-2 py-2 text-right">Views</th>
              <th className="px-2 py-2 text-right">Clicks</th>
              <th className="px-2 py-2 text-right">Engagement</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.id} className="border-t border-[#EAEAEA]">
                <th scope="row" className="px-3 py-1.5 text-left font-medium text-[#0B0B0C]">
                  {campaign.href ? <a href={campaign.href} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-[#002147] hover:underline">{campaign.name}<ArrowUpRight className="size-2.5" /></a> : campaign.name}
                </th>
                <td className="px-2 py-1.5">{campaign.period}</td>
                <td className="px-2 py-1.5">{campaign.status}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{campaign.start}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{number(campaign.reach)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{number(campaign.impressions)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{number(campaign.views)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{number(campaign.clicks)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{number(campaign.engagements)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
