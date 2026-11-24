"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronRight, Loader2, X } from "lucide-react";
import type { SocialFilter, TnSocialAccount, TnSocialCampaign, TnSocialFiltered, TnSocialOverview } from "@/lib/survey/social-types";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import { cn } from "@/lib/utils";

const number = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("en-IN").format(Math.round(value)));
const compact = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
  if (value >= 1e5) return `${(value / 1e5).toFixed(2)} L`;
  return number(value);
};

function AnimatedNumber({ value, mode = "int" }: { value: number; mode?: "int" | "compact" }) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const previous = useRef(reduced ? value : 0);
  useEffect(() => {
    if (reduced) { setShown(value); previous.current = value; return; }
    const from = previous.current;
    const started = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / 280);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (value - from) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
      else previous.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [reduced, value]);
  return <>{mode === "compact" ? compact(shown) : number(shown)}</>;
}

function Stat({ label, value, note, mode = "compact" }: { label: string; value: number; note?: string; mode?: "int" | "compact" }) {
  return (
    <div className="rounded-xl border border-[#EAEAEA] bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.03)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B6B6B]">{label}</p>
      <p className="mt-1 font-display text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[#0B0B0C]"><AnimatedNumber value={value} mode={mode} /></p>
      {note && <p className="mt-1 text-[11px] text-[#6B6B6B]">{note}</p>}
    </div>
  );
}

const periodStyle = (period: string) => {
  if (/opinion/i.test(period)) return "bg-[#FEF3C7] text-[#92400E]";
  if (/exit/i.test(period)) return "bg-[#DBEAFE] text-[#1E40AF]";
  if (/pre/i.test(period)) return "bg-[#F3E8FF] text-[#6B21A8]";
  return "bg-[#DCFCE7] text-[#166534]";
};

export default function TnSocialMedia({ stateSlug, initialFilter, onClose, owner = false }: { stateSlug: string; initialFilter?: SocialFilter | null; onClose?: () => void; owner?: boolean }) {
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

  useEffect(() => { void load(initialFilter); }, [initialFilter, load]);

  async function toggleAccount(key: string) {
    if (openAccount === key) { setOpenAccount(null); return; }
    setOpenAccount(key);
    if (account?.accounts[0]?.key === key) return;
    try {
      const response = await fetch(`/api/survey/social?state=${stateSlug}&mode=account&account=${encodeURIComponent(key)}`);
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.ok) setAccount(payload.account as TnSocialFiltered);
    } catch { /* keep the overview usable */ }
  }

  if (loading && !overview && !filtered) {
    return <div className="flex items-center gap-2 rounded-2xl border border-[#EAEAEA] bg-white p-8 text-[14px] text-[#6B6B6B]"><Loader2 className="size-5 animate-spin" /> Loading the social view...</div>;
  }
  if (error) {
    return <div role="alert" className="rounded-xl border border-[#B42318]/30 bg-[#FEF3F2] px-4 py-3 text-[14px] text-[#B42318]">{error}</div>;
  }

  const active = filtered ?? overview;
  const totals = filtered
    ? { campaigns: filtered.totalMatching, reach: filtered.accounts.reduce((sum, item) => sum + item.reach, 0), impressions: filtered.accounts.reduce((sum, item) => sum + item.impressions, 0), views: filtered.accounts.reduce((sum, item) => sum + item.views, 0), clicks: filtered.accounts.reduce((sum, item) => sum + item.clicks, 0), engagements: filtered.accounts.reduce((sum, item) => sum + item.engagements, 0) }
    : overview?.totals;

  return (
    <section className="space-y-4" aria-label="Social media">
      {filtered ? (
        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.035)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8C6A2F]">{filtered.title.startsWith("Target") ? "Target campaign" : "Campaigns"}</p>
              <h2 className="mt-1 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-[#0B0B0C]">{filtered.place ?? filtered.title}</h2>
              <p className="mt-1 max-w-[70ch] text-[14px] leading-relaxed text-[#555]">{filtered.how}. {filtered.note}</p>
            </div>
            {onClose && (
              <button type="button" onClick={onClose} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#0B0B0C] px-4 text-[13px] font-semibold text-[#0B0B0C] hover:bg-[#0B0B0C] hover:text-white">
                <X className="size-4" /> Back to survey
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-[#0B0B0C]">Social Media</h2>
            <p className="mt-1 text-[14px] text-[#6B6B6B]">{overview?.range}{overview?.asOf ? ` · as of ${overview.asOf}` : ""}</p>
          </div>
        </div>
      )}

      {totals && (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Campaigns" value={totals.campaigns} mode="int" />
          <Stat label="Reach" value={totals.reach} note={number(totals.reach)} />
          <Stat label="Impressions" value={totals.impressions} note={number(totals.impressions)} />
          <Stat label="Views" value={totals.views} note={number(totals.views)} />
          <Stat label="Clicks" value={totals.clicks} note={number(totals.clicks)} />
          <Stat label="Engagement" value={totals.engagements} note={number(totals.engagements)} />
        </div>
      )}

      {!filtered && overview && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {overview.periods.map((period) => (
            <div key={period.key} className="rounded-xl border border-[#EAEAEA] bg-white p-4">
              <p className="text-[12px] font-semibold text-[#0B0B0C]">{period.label}</p>
              <p className="mt-1 text-[13px] text-[#555]"><b className="text-[#0B0B0C]">{number(period.campaigns)}</b> campaigns · reach {compact(period.reach)}</p>
              {period.responses != null && <p className="mt-0.5 text-[11px] text-[#6B6B6B]">{number(period.responses)} survey responses</p>}
            </div>
          ))}
        </div>
      )}

      {active && (
        filtered ? (
          <section aria-label="Ad accounts used">
            <h3 className="mb-2 text-[16px] font-semibold text-[#0B0B0C]">Ad accounts used</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(active.accounts ?? []).map((item) => <AccountCard key={item.key} account={item} maxReach={Math.max(1, ...(active.accounts ?? []).map((accountItem) => accountItem.reach))} owner={owner} />)}
            </div>
          </section>
        ) : (
          <section className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white" aria-label="Ad accounts">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAEAEA] px-4 py-3">
              <h3 className="text-[16px] font-semibold text-[#0B0B0C]">Ad accounts</h3>
              <p className="text-[12px] text-[#6B6B6B]">{(active.accounts ?? []).length} accounts</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-[14px]">
                <thead className="bg-[#FAFAFA] text-left text-[12px] uppercase tracking-wide text-[#6B6B6B]">
                  <tr><th className="px-4 py-2.5">Ad account</th><th className="px-3 py-2.5 text-right">Campaigns</th><th className="px-3 py-2.5 text-right">Reach</th><th className="px-3 py-2.5 text-right">Impressions</th><th className="px-3 py-2.5 text-right">Views</th><th className="px-3 py-2.5 text-right">Clicks</th><th className="px-3 py-2.5 text-right">Engagement</th></tr>
                </thead>
                <tbody>
                  {(active.accounts ?? []).map((item) => (
                    <tr key={item.key} className="border-t border-[#EAEAEA] transition-colors hover:bg-[#FAFAFA] align-top">
                      <th scope="row" className="px-4 py-2.5 text-left font-semibold text-[#0B0B0C]">
                        <button type="button" onClick={() => void toggleAccount(item.key)} className="inline-flex items-center gap-1 text-left hover:text-[#1f6fd1]">
                          {openAccount === item.key ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          {item.name}
                        </button>
                        {owner && item.id && <span className="mt-0.5 block text-[10px] font-normal text-[#6B6B6B]">{item.business || "Ad account"} · {item.id}</span>}
                      </th>
                      <td className="px-3 py-2.5 text-right tabular-nums">{number(item.campaignCount)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{number(item.reach)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{number(item.impressions)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{number(item.views)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{number(item.clicks)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{number(item.engagements)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      )}

      {!filtered && openAccount && account?.accounts[0]?.key === openAccount && (
        <CampaignTable title={`Campaigns · ${account.accounts[0].name}`} campaigns={account.campaigns} total={account.totalMatching} />
      )}

      {filtered && <CampaignTable title={`Top ${Math.min(100, filtered.campaigns.length)} campaigns`} campaigns={filtered.campaigns} total={filtered.totalMatching} />}
    </section>
  );
}

function AccountCard({ account, maxReach, owner }: { account: TnSocialAccount; maxReach: number; owner: boolean }) {
  return (
    <div className="rounded-xl border border-[#EAEAEA] bg-white p-3">
      <p className="truncate text-[13px] font-semibold text-[#0B0B0C]">{account.name}</p>
      {owner && account.id && <p className="mt-0.5 truncate text-[10px] text-[#6B6B6B]">{account.business || "Ad account"} · {account.id}</p>}
      <p className="mt-1 text-[12px] text-[#555]">{number(account.campaignCount)} campaigns · reach {compact(account.reach)}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F1F1F1]"><span className="block h-full rounded-full bg-[#0B0B0C]" style={{ width: `${Math.max(4, (account.reach / maxReach) * 100)}%` }} /></div>
    </div>
  );
}

function CampaignTable({ title, campaigns, total }: { title: string; campaigns: TnSocialCampaign[]; total: number }) {
  const maxReach = Math.max(1, ...campaigns.map((campaign) => campaign.reach));
  const maxEng = Math.max(1, ...campaigns.map((campaign) => campaign.engagements));
  return (
    <section className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.03)]" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAEAEA] px-4 py-3">
        <h3 className="text-[18px] font-semibold text-[#0B0B0C]">{title}</h3>
        <p className="text-[12px] text-[#6B6B6B]">{campaigns.length} of {total}</p>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="tn-long-table w-full min-w-[980px] border-collapse text-[14px]">
          <thead className="sticky top-0 z-10 bg-[#FAFAFA] text-left text-[12px] uppercase tracking-wide text-[#6B6B6B]">
            <tr><th className="px-4 py-2.5">Campaign</th><th className="px-3 py-2.5">Period</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Start</th><th className="px-3 py-2.5 text-right">Reach</th><th className="px-3 py-2.5 text-right">Impressions</th><th className="px-3 py-2.5 text-right">Views</th><th className="px-3 py-2.5 text-right">Clicks</th><th className="px-3 py-2.5 text-right">Engagement</th></tr>
          </thead>
          <tbody>
            {campaigns.map((campaign, index) => (
              <tr key={campaign.id ?? `${campaign.name}-${index}`} className="border-t border-[#EAEAEA] transition-colors hover:bg-[#FAFAFA]">
                <th scope="row" className="px-4 py-2 text-left font-medium text-[#0B0B0C]">{campaign.href ? <a href={campaign.href} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-[#002147] hover:underline">{campaign.name}<ArrowUpRight className="size-3" /></a> : campaign.name}</th>
                <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", periodStyle(campaign.period))}>{campaign.period}</span></td>
                <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", /on/i.test(campaign.status) ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F1F5F9] text-[#475569]")}>{campaign.status || "—"}</span></td>
                <td className="px-3 py-2 whitespace-nowrap">{campaign.start}</td>
                <td className="px-3 py-2 text-right tabular-nums"><BarCell value={campaign.reach} max={maxReach} /></td>
                <td className="px-3 py-2 text-right tabular-nums">{number(campaign.impressions)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{number(campaign.views)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{number(campaign.clicks)}</td>
                <td className="px-3 py-2 text-right tabular-nums"><BarCell value={campaign.engagements} max={maxEng} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BarCell({ value, max }: { value: number; max: number }) {
  return (
    <span className="relative inline-flex min-w-[80px] justify-end px-1 py-0.5">
      <span className="absolute inset-y-0 left-0 rounded bg-[#E0F2FE]" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} aria-hidden />
      <span className="relative">{number(value)}</span>
    </span>
  );
}
