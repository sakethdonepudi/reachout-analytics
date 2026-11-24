"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpDown, ArrowUpRight, BarChart3, ChevronDown, ChevronRight, Eye, Heart, Loader2, Megaphone, MousePointerClick, Users, X } from "lucide-react";
import type { SocialFilter, TnSocialAccount, TnSocialCampaign, TnSocialFiltered, TnSocialOverview, TnSocialPeriod } from "@/lib/survey/social-types";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import { cn } from "@/lib/utils";
import { PartyBadge } from "./party-badge";
import { ReachSparkline, SocialCluster } from "./social-icons";

const number = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("en-IN").format(Math.round(value)));
const compact = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
  if (value >= 1e5) return `${(value / 1e5).toFixed(2)} L`;
  return number(value);
};

function Num({ value, className }: { value: number | null | undefined; className?: string }) {
  return <span className={cn("tabular-nums", className)} title={number(value)}>{compact(value)}</span>;
}

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0] ?? "").join("").toUpperCase() || "AD";
}

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
      const t = Math.min(1, (now - started) / 300);
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

function Stat({
  label,
  value,
  note,
  icon,
  tint,
  mode = "compact",
}: {
  label: string;
  value: number;
  note: string;
  icon: React.ReactNode;
  tint: string;
  mode?: "int" | "compact";
}) {
  return (
    <div className="group flex min-h-[138px] flex-col rounded-2xl border border-[#EAEAEA] bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.03)] transition-transform duration-200 ease-out hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <span className={cn("grid size-8 place-items-center rounded-full", tint)}>{icon}</span>
        <ReachSparkline gradient={false} className="h-6 w-16 opacity-70" />
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B6B6B]">{label}</p>
      <p className="mt-1 font-display text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[#0B0B0C]"><AnimatedNumber value={value} mode={mode} /></p>
      <p className="mt-auto pt-1 text-[11px] text-[#6B6B6B]">{note}</p>
    </div>
  );
}

const periodStyle = (period: string) => {
  if (/opinion/i.test(period)) return "bg-[#FEF3C7] text-[#92400E]";
  if (/exit/i.test(period)) return "bg-[#DBEAFE] text-[#1E40AF]";
  if (/pre/i.test(period)) return "bg-[#F3E8FF] text-[#6B21A8]";
  return "bg-[#DCFCE7] text-[#166534]";
};

function periodMatches(period: string, label: string | null | undefined) {
  if (!label) return true;
  const haystack = `${period}`.toLowerCase();
  const needle = label.toLowerCase();
  if (needle.includes("pre") && haystack.includes("pre")) return true;
  if (needle.includes("opinion") && haystack.includes("opinion")) return true;
  if (needle.includes("exit") && haystack.includes("exit")) return true;
  if (needle.includes("post") && haystack.includes("post")) return true;
  if (needle.includes("election") && haystack.includes("election")) return true;
  return false;
}

function PeriodTimeline({
  periods,
  selected,
  totals,
  onSelect,
}: {
  periods: TnSocialPeriod[];
  selected: string | null;
  totals: TnSocialOverview["totals"] | undefined;
  onSelect: (key: string | null) => void;
}) {
  const step = (key: string | null, label: string, campaigns: number, reach: number, responses?: number) => {
    const active = selected === key;
    return (
      <button
        type="button"
        onClick={() => onSelect(active ? null : key)}
        aria-pressed={active}
        className={cn(
          "relative flex min-h-[98px] w-full flex-col items-start gap-0.5 rounded-xl px-3 pb-2 pt-5 text-left transition-colors",
          active ? "bg-[#F3F7FB] ring-1 ring-[#002147]/10" : "hover:bg-[#FAFAFA]",
        )}
      >
        <span className={cn("absolute left-3 top-[9px] size-3.5 rounded-full border-2 bg-white", active ? "border-[#002147] ring-4 ring-[#002147]/10" : "border-[#C9CDD4]")} aria-hidden />
        <span className={cn("text-[12.5px] font-semibold leading-snug", active ? "text-[#0B0B0C]" : "text-[#555]")}>{label}</span>
        <span className="text-[11.5px] tabular-nums text-[#555]">{number(campaigns)} campaigns</span>
        <span className="text-[11.5px] tabular-nums text-[#6B6B6B]">Reach {compact(reach)}</span>
        {responses != null && <span className="text-[11px] tabular-nums text-[#8A8F98]">{number(responses)} responses</span>}
      </button>
    );
  };
  return (
    <section className="rounded-2xl border border-[#EAEAEA] bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.03)]" aria-label="Campaign periods">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[16px] font-semibold text-[#0B0B0C]">Campaign periods</h3>
        <p className="text-[12px] text-[#6B6B6B]">Click a period to filter the page</p>
      </div>
      <div className="mt-3 overflow-x-auto pb-1">
        <div className="relative min-w-[700px]">
          <span className="absolute left-5 right-5 top-[15px] h-px bg-[#E4E2DA]" aria-hidden />
          <div className="relative flex items-stretch">
            <div className="flex-1">{step(null, "All periods", totals?.campaigns ?? 0, totals?.reach ?? 0)}</div>
            {periods.map((period) => (
              <div key={period.key} className="flex-1">
                {step(period.key, period.label, period.campaigns, period.reach, period.responses)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SortHead({
  label,
  sortKey,
  sort,
  onSort,
  align = "right",
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; asc: boolean };
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  return (
    <th className={cn("px-3 py-2.5", align === "right" ? "text-right" : "text-left")} aria-sort={active ? (sort.asc ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(sortKey)} className={cn("inline-flex min-h-11! items-center gap-1 rounded px-1 hover:bg-white/10", align === "right" && "justify-end")} title={`Sort by ${label}`}>
        {label}
        <ArrowUpDown className={cn("size-3 opacity-45", active && "opacity-100")} />
      </button>
    </th>
  );
}

type SortKey = "name" | "campaignCount" | "reach" | "impressions" | "views" | "clicks" | "engagements";

export default function TnSocialMedia({ stateSlug, initialFilter, onClose, owner = false }: { stateSlug: string; initialFilter?: SocialFilter | null; onClose?: () => void; owner?: boolean }) {
  const [overview, setOverview] = useState<TnSocialOverview | null>(null);
  const [filtered, setFiltered] = useState<TnSocialFiltered | null>(null);
  const [account, setAccount] = useState<TnSocialFiltered | null>(null);
  const [openAccount, setOpenAccount] = useState<string | null>(null);
  const [accountPage, setAccountPage] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "reach", asc: false });
  const [periodKey, setPeriodKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLElement>(null);
  const wantTop = useRef(Boolean(initialFilter));

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
  useEffect(() => { if (initialFilter) wantTop.current = true; }, [initialFilter]);
  useEffect(() => {
    if (loading || !wantTop.current) return;
    wantTop.current = false;
    requestAnimationFrame(() => rootRef.current?.scrollIntoView({ block: "start", behavior: "auto" }));
  }, [loading]);

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
  const selectedPeriod = !filtered && overview ? overview.periods.find((period) => period.key === periodKey) ?? null : null;
  const periodLabel = selectedPeriod?.label ?? null;
  const totals = filtered
    ? { campaigns: filtered.totalMatching, reach: filtered.accounts.reduce((sum, item) => sum + item.reach, 0), impressions: filtered.accounts.reduce((sum, item) => sum + item.impressions, 0), views: filtered.accounts.reduce((sum, item) => sum + item.views, 0), clicks: filtered.accounts.reduce((sum, item) => sum + item.clicks, 0), engagements: filtered.accounts.reduce((sum, item) => sum + item.engagements, 0) }
    : selectedPeriod
      ? { campaigns: selectedPeriod.campaigns, reach: selectedPeriod.reach, impressions: selectedPeriod.impressions, views: selectedPeriod.views, clicks: selectedPeriod.clicks, engagements: selectedPeriod.engagements }
      : overview?.totals;
  const accountPageSize = 12;
  const allAccounts = (active?.accounts ?? []) as TnSocialAccount[];
  const sortedAccounts = [...allAccounts].sort((a, b) => {
    if (sort.key === "name") return sort.asc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    const left = Number(a[sort.key] ?? 0);
    const right = Number(b[sort.key] ?? 0);
    return sort.asc ? left - right : right - left;
  });
  const accountPageCount = Math.max(1, Math.ceil(sortedAccounts.length / accountPageSize));
  const currentAccountPage = Math.min(accountPage, accountPageCount - 1);
  const pageAccounts = sortedAccounts.slice(currentAccountPage * accountPageSize, currentAccountPage * accountPageSize + accountPageSize);
  const maxAccountReach = Math.max(1, ...allAccounts.map((item) => item.reach));
  const maxAccountEng = Math.max(1, ...allAccounts.map((item) => item.engagements));
  const sortLabel: Record<SortKey, string> = { name: "name", campaignCount: "campaigns", reach: "reach", impressions: "impressions", views: "views", clicks: "clicks", engagements: "engagement" };
  const kpis = [
    { label: "Campaigns", value: totals?.campaigns ?? 0, note: "campaigns", mode: "int" as const, icon: <Megaphone className="size-4" />, tint: "bg-[#EFF6FF] text-[#1f6fd1]" },
    { label: "Impressions", value: totals?.impressions ?? 0, note: number(totals?.impressions), mode: "compact" as const, icon: <Eye className="size-4" />, tint: "bg-[#F3E8FF] text-[#7e22ce]" },
    { label: "Views", value: totals?.views ?? 0, note: number(totals?.views), mode: "compact" as const, icon: <BarChart3 className="size-4" />, tint: "bg-[#FEF3C7] text-[#92400E]" },
    { label: "Clicks", value: totals?.clicks ?? 0, note: number(totals?.clicks), mode: "compact" as const, icon: <MousePointerClick className="size-4" />, tint: "bg-[#DCFCE7] text-[#166534]" },
    ...(filtered ? [
      { label: "Reach", value: totals?.reach ?? 0, note: number(totals?.reach), mode: "compact" as const, icon: <Users className="size-4" />, tint: "bg-[#FDF2F8] text-[#be185d]" },
      { label: "Engagement", value: totals?.engagements ?? 0, note: number(totals?.engagements), mode: "compact" as const, icon: <Heart className="size-4" />, tint: "bg-[#FFF1F2] text-[#be123c]" },
    ] : []),
  ];

  const toggleSort = (key: SortKey) => {
    setSort((current) => current.key === key ? { key, asc: !current.asc } : { key, asc: key === "name" });
    setAccountPage(0);
  };

  return (
    <section ref={rootRef} className="space-y-4" aria-label="Social media">
      {filtered ? (
        <div className="rounded-2xl border border-[#EAEAEA] bg-gradient-to-br from-[#FFF8F0] via-white to-[#F6F9FC] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.035)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8C6A2F]">{filtered.title.startsWith("Target") && <PartyBadge party="AIADMK+" size={20} />}{filtered.title.startsWith("Target") ? "Target campaign" : "Campaigns"}</p>
              <h2 className="mt-1 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-[#0B0B0C]">{filtered.place ?? filtered.title}</h2>
              <p className="mt-1 max-w-[70ch] text-[14px] leading-relaxed text-[#555]">{filtered.how}. {filtered.note}</p>
            </div>
            {onClose && (
              <button type="button" onClick={onClose} className="inline-flex min-h-11! items-center gap-1.5 rounded-full border border-[#0B0B0C] px-4 text-[13px] font-semibold text-[#0B0B0C] hover:bg-[#0B0B0C] hover:text-white">
                <X className="size-4" /> Back to survey
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-[#E4E8EE] bg-[linear-gradient(135deg,#F3F8FC_0%,#FFFFFF_52%,#F2F8F3_100%)] p-5 shadow-[0_12px_34px_rgba(0,0,0,0.04)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <SocialCluster iconSize={24} tileSize={34} columns={2} className="grid sm:hidden" />
              <SocialCluster iconSize={30} tileSize={42} columns={2} className="hidden sm:grid" />
              <div>
                <h2 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-[#0B0B0C] sm:text-[32px]">Social Media</h2>
                <p className="mt-1 text-[13.5px] text-[#6B6B6B]">{overview?.range}{overview?.asOf ? ` · as of ${overview.asOf}` : ""}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-6 sm:gap-8">
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B6B6B]"><Users className="size-3.5" /> Total reach</p>
                <p className="mt-1 font-display text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[#0B0B0C] sm:text-[42px]"><AnimatedNumber value={totals?.reach ?? 0} mode="compact" /></p>
                <p className="mt-1 text-[11.5px] tabular-nums text-[#6B6B6B]">{number(totals?.reach)}</p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B6B6B]"><Heart className="size-3.5" /> Engagement</p>
                <p className="mt-1 font-display text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[#0B0B0C] sm:text-[42px]"><AnimatedNumber value={totals?.engagements ?? 0} mode="compact" /></p>
                <p className="mt-1 text-[11.5px] tabular-nums text-[#6B6B6B]">{number(totals?.engagements)}</p>
              </div>
              <ReachSparkline className="hidden h-14 w-44 md:block" />
            </div>
          </div>
        </div>
      )}

      {totals && (
        <div className={cn("grid gap-2 sm:grid-cols-2", filtered ? "lg:grid-cols-6" : "lg:grid-cols-4")}>
          {kpis.map((kpi) => (
            <Stat key={kpi.label} label={kpi.label} value={kpi.value} note={kpi.note} mode={kpi.mode} icon={kpi.icon} tint={kpi.tint} />
          ))}
        </div>
      )}

      {!filtered && overview && (
        <>
          <PeriodTimeline periods={overview.periods} selected={periodKey} totals={overview.totals} onSelect={setPeriodKey} />
          {selectedPeriod && (
            <p className="-mt-2 px-1 text-[12px] text-[#6B6B6B]">Showing {selectedPeriod.label}. Stats and expanded campaign rows follow this period; accounts stay all-time.</p>
          )}
        </>
      )}

      {active && (
        filtered ? (
          <section aria-label="Ad accounts used">
            <h3 className="mb-2 text-[16px] font-semibold text-[#0B0B0C]">Ad accounts used</h3>
            <div className={cn("grid gap-2 sm:grid-cols-2", filtered ? "lg:grid-cols-6" : "lg:grid-cols-4")}>
              {(active.accounts ?? []).map((item) => <AccountCard key={item.key} account={item} maxReach={Math.max(1, ...(active.accounts ?? []).map((accountItem) => accountItem.reach))} owner={owner} />)}
            </div>
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.03)]" aria-label="Ad accounts">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAEAEA] px-4 py-3">
              <h3 className="text-[16px] font-semibold text-[#0B0B0C]">Ad accounts</h3>
              <p className="text-[12px] text-[#6B6B6B]">{allAccounts.length} accounts · sorted by {sortLabel[sort.key]}</p>
            </div>
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[860px] border-collapse text-[14px]">
                <thead className="sticky top-0 z-10 text-left text-[12px] uppercase tracking-wide">
                  <tr>
                    <SortHead label="Ad account" sortKey="name" sort={sort} onSort={toggleSort} align="left" />
                    <SortHead label="Campaigns" sortKey="campaignCount" sort={sort} onSort={toggleSort} />
                    <SortHead label="Reach" sortKey="reach" sort={sort} onSort={toggleSort} />
                    <SortHead label="Impressions" sortKey="impressions" sort={sort} onSort={toggleSort} />
                    <SortHead label="Views" sortKey="views" sort={sort} onSort={toggleSort} />
                    <SortHead label="Clicks" sortKey="clicks" sort={sort} onSort={toggleSort} />
                    <SortHead label="Engagement" sortKey="engagements" sort={sort} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {pageAccounts.map((item) => (
                    <Fragment key={item.key}>
                    <tr className="border-t border-[#EAEAEA] transition-colors hover:bg-[#FAFAFA] align-middle">
                      <th scope="row" className="px-4 py-2.5 text-left font-semibold text-[#0B0B0C]">
                        <button type="button" onClick={() => void toggleAccount(item.key)} className="inline-flex min-h-11! items-center gap-2 align-middle text-left hover:text-[#1f6fd1]">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#EFF6FF] text-[10.5px] font-bold text-[#1f6fd1]" aria-hidden>{initialsOf(item.name)}</span>
                          {item.name}
                          {openAccount === item.key ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                        </button>
                        {owner && item.id && <span className="mt-0.5 block text-[10px] font-normal text-[#6B6B6B]">{item.business || "Ad account"} · {item.id}</span>}
                      </th>
                      <td className="px-3 py-2.5 text-right align-middle tabular-nums">{number(item.campaignCount)}</td>
                      <td className="px-3 py-2.5 text-right align-middle tabular-nums"><CellBar value={item.reach} max={maxAccountReach} /></td>
                      <td className="px-3 py-2.5 text-right align-middle tabular-nums"><Num value={item.impressions} /></td>
                      <td className="px-3 py-2.5 text-right align-middle tabular-nums"><Num value={item.views} /></td>
                      <td className="px-3 py-2.5 text-right align-middle tabular-nums"><Num value={item.clicks} /></td>
                      <td className="px-3 py-2.5 text-right align-middle tabular-nums"><CellBar value={item.engagements} max={maxAccountEng} tone="sky" /></td>
                    </tr>
                    {openAccount === item.key && account?.accounts[0]?.key === item.key && (
                      <tr className="border-t border-[#EAEAEA] bg-[#FAFAFA]">
                        <td colSpan={7} className="p-0">
                          <div className="tn-expand">
                            <div className="min-h-0 overflow-hidden">
                              <CampaignTable title={`Campaigns · ${item.name}`} campaigns={account.campaigns} total={account.totalMatching} periodLabel={periodLabel} flush />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {accountPageCount > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EAEAEA] px-4 py-2 text-[12.5px] text-[#6B6B6B]">
                <span className="tabular-nums">{currentAccountPage * accountPageSize + 1}-{Math.min(sortedAccounts.length, (currentAccountPage + 1) * accountPageSize)} of {sortedAccounts.length}</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={currentAccountPage === 0} onClick={() => setAccountPage((value) => Math.max(0, value - 1))} className="inline-flex min-h-11! min-w-11 items-center justify-center rounded-full border border-[#CFCFCF] px-3 font-semibold text-[#0B0B0C] disabled:opacity-40">Previous</button>
                  <button type="button" disabled={currentAccountPage >= accountPageCount - 1} onClick={() => setAccountPage((value) => Math.min(accountPageCount - 1, value + 1))} className="inline-flex min-h-11! min-w-11 items-center justify-center rounded-full border border-[#CFCFCF] px-3 font-semibold text-[#0B0B0C] disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </section>
        )
      )}

      {filtered && <CampaignTable title={`Top ${Math.min(100, filtered.campaigns.length)} campaigns`} campaigns={filtered.campaigns} total={filtered.totalMatching} />}
    </section>
  );
}

function AccountCard({ account, maxReach, owner }: { account: TnSocialAccount; maxReach: number; owner: boolean }) {
  return (
    <div className="rounded-2xl border border-[#EAEAEA] bg-white p-3 shadow-[0_6px_18px_rgba(0,0,0,0.025)] transition-transform duration-200 ease-out hover:-translate-y-0.5">
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#EFF6FF] text-[10.5px] font-bold text-[#1f6fd1]" aria-hidden>{initialsOf(account.name)}</span>
        <p className="truncate text-[13px] font-semibold text-[#0B0B0C]">{account.name}</p>
      </div>
      {owner && account.id && <p className="mt-0.5 truncate text-[10px] text-[#6B6B6B]">{account.business || "Ad account"} · {account.id}</p>}
      <p className="mt-1 text-[12px] text-[#555]">{number(account.campaignCount)} campaigns · reach <span title={number(account.reach)}>{compact(account.reach)}</span></p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F1F1F1]" title={`Reach ${number(account.reach)}`}><span className="block h-full rounded-full bg-[#0B0B0C]" style={{ width: `${Math.max(4, (account.reach / maxReach) * 100)}%` }} /></div>
    </div>
  );
}

function CampaignTable({ title, campaigns, total, periodLabel, flush = false }: { title: string; campaigns: TnSocialCampaign[]; total: number; periodLabel?: string | null; flush?: boolean }) {
  const [page, setPage] = useState(0);
  const rows = periodLabel ? campaigns.filter((campaign) => periodMatches(campaign.period, periodLabel)) : campaigns;
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  useEffect(() => { setPage(0); }, [campaigns, periodLabel]);
  const maxReach = Math.max(1, ...rows.map((campaign) => campaign.reach));
  const maxEng = Math.max(1, ...rows.map((campaign) => campaign.engagements));
  return (
    <section className={cn("overflow-hidden bg-white", flush ? "border-t border-[#EAEAEA]" : "rounded-2xl border border-[#EAEAEA] shadow-[0_10px_30px_rgba(0,0,0,0.03)]")} aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAEAEA] px-4 py-3">
        <h3 className="text-[18px] font-semibold text-[#0B0B0C]">{title}{periodLabel ? ` · ${periodLabel}` : ""}</h3>
        <p className="text-[12px] text-[#6B6B6B]">{rows.length} of {total}</p>
      </div>
      <div className={flush ? "overflow-x-auto" : "max-h-[520px] overflow-auto"}>
        <table className="tn-long-table w-full min-w-[980px] border-collapse text-[14px]">
          <thead className="sticky top-0 z-10 text-left text-[12px] uppercase tracking-wide">
            <tr><th className="px-4 py-2.5">Campaign</th><th className="px-3 py-2.5">Period</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Start</th><th className="px-3 py-2.5 text-right">Reach</th><th className="px-3 py-2.5 text-right">Impressions</th><th className="px-3 py-2.5 text-right">Views</th><th className="px-3 py-2.5 text-right">Clicks</th><th className="px-3 py-2.5 text-right">Engagement</th></tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-[13px] text-[#6B6B6B]">No campaigns in this period.</td></tr>}
            {pageRows.map((campaign, index) => (
              <tr key={campaign.id ?? `${campaign.name}-${index}`} className="border-t border-[#EAEAEA] transition-colors hover:bg-[#FAFAFA] align-middle">
                <th scope="row" className="px-4 py-2 text-left font-medium text-[#0B0B0C]">{campaign.href ? <a href={campaign.href} target="_blank" rel="noopener" className="inline-flex min-h-11! items-center gap-1 text-[#002147] hover:underline">{campaign.name}<ArrowUpRight className="size-3" /></a> : campaign.name}</th>
                <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", periodStyle(campaign.period))}>{campaign.period}</span></td>
                <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", /on/i.test(campaign.status) ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F1F5F9] text-[#475569]")}>{campaign.status || "—"}</span></td>
                <td className="px-3 py-2 whitespace-nowrap">{campaign.start}</td>
                <td className="px-3 py-2 text-right align-middle tabular-nums"><CellBar value={campaign.reach} max={maxReach} /></td>
                <td className="px-3 py-2 text-right align-middle tabular-nums"><Num value={campaign.impressions} /></td>
                <td className="px-3 py-2 text-right align-middle tabular-nums"><Num value={campaign.views} /></td>
                <td className="px-3 py-2 text-right align-middle tabular-nums"><Num value={campaign.clicks} /></td>
                <td className="px-3 py-2 text-right align-middle tabular-nums"><CellBar value={campaign.engagements} max={maxEng} tone="sky" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EAEAEA] px-4 py-2 text-[12.5px] text-[#6B6B6B]">
          <span className="tabular-nums">{currentPage * pageSize + 1}-{Math.min(rows.length, (currentPage + 1) * pageSize)} of {rows.length}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="inline-flex min-h-11! min-w-11 items-center justify-center rounded-full border border-[#CFCFCF] px-3 font-semibold text-[#0B0B0C] disabled:opacity-40">Previous</button>
            <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} className="inline-flex min-h-11! min-w-11 items-center justify-center rounded-full border border-[#CFCFCF] px-3 font-semibold text-[#0B0B0C] disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </section>
  );
}

function CellBar({ value, max, tone = "navy" }: { value: number; max: number; tone?: "navy" | "sky" }) {
  return (
    <span className="flex w-full min-w-[76px] flex-col items-end gap-1" title={number(value)}>
      <span>{compact(value)}</span>
      <span className={cn("h-[2px] w-full overflow-hidden rounded-full", tone === "sky" ? "bg-[#EFF6FF]" : "bg-[#EEF1F5]")} aria-hidden>
        <span className={cn("block h-full rounded-full", tone === "sky" ? "bg-[#1f6fd1]" : "bg-[#0B0B0C]/45")} style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
      </span>
    </span>
  );
}
