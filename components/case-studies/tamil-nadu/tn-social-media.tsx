"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, BarChart3, Check, ChevronDown, ChevronRight, Eye, Heart, Loader2, Megaphone, MousePointerClick, Users, X } from "lucide-react";
import type { SocialFilter, TnSocialAccount, TnSocialCampaign, TnSocialFiltered, TnSocialMonth, TnSocialOverview, TnSocialPeriod } from "@/lib/survey/social-types";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import { cn } from "@/lib/utils";
import { PartyBadge } from "./party-badge";
import { SocialCluster } from "./social-icons";
import { TrendChart } from "./trend-chart";
import { TN_CONFIG, type CaseStudyConfig } from "@/lib/case-study/config";

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

function aliasRank(name: string) {
  return /^Ad account (\d+)$/.exec(name.trim())?.[1] ?? null;
}

function aliasText(name: string) {
  if (name === "All accounts") return "All";
  return aliasRank(name) ?? initialsOf(name);
}

type ExplorerMetric = "reach" | "impressions" | "views" | "clicks" | "engagements" | "campaigns";
type AccountSortKey = "name" | ExplorerMetric;
const EXPLORER_METRICS: Array<{ key: ExplorerMetric; label: string }> = [
  { key: "reach", label: "Reach" },
  { key: "impressions", label: "Impressions" },
  { key: "views", label: "Views" },
  { key: "clicks", label: "Clicks" },
  { key: "engagements", label: "Engagement" },
  { key: "campaigns", label: "Campaigns" },
];
const accountValue = (account: TnSocialAccount, metric: ExplorerMetric) => metric === "campaigns" ? account.campaignCount : account[metric];
const campaignValue = (campaign: TnSocialCampaign, metric: ExplorerMetric) => metric === "campaigns" ? 0 : campaign[metric];
const explorerNumber = (value: number, metric: ExplorerMetric) => metric === "campaigns" ? number(value) : compact(value);

function AnimatedNumber({ value, mode = "int" }: { value: number; mode?: "int" | "compact" }) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(value);
  const previous = useRef(value);
  useEffect(() => {
    if (reduced) { setShown(value); previous.current = value; return; }
    const from = previous.current;
    if (from === value) { setShown(value); return; }
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
  chart,
  display,
}: {
  label: string;
  value: number;
  note: string;
  display?: string;
  icon: React.ReactNode;
  tint: string;
  mode?: "int" | "compact";
  chart?: { data: TnSocialMonth[]; metric: "campaigns" | "reach" | "impressions" | "views" | "clicks" | "engagements"; color: string; mode?: "int" | "compact" };
}) {
  return (
    <div className="group flex min-h-[152px] flex-col rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.03)] transition-transform duration-200 ease-out hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <span className={cn("grid size-8 place-items-center rounded-full", tint)}>{icon}</span>
      </div>
      <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-[color:var(--theme-text-3)]">{label}</p>
      <p className="mt-1 font-display text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[color:var(--theme-text)]">{display ?? <AnimatedNumber value={value} mode={mode} />}</p>
      {note && <p className="mt-0.5 text-[12px] text-[color:var(--theme-text-3)]">{note}</p>}
      {chart && <TrendChart data={chart.data} series={[{ metric: chart.metric, label, color: chart.color }]} height={34} mode={chart.mode} label={`Monthly ${label.toLowerCase()}`} className="mt-auto h-9 w-full pt-2" />}
    </div>
  );
}

const periodStyle = (period: string) => {
  if (/opinion/i.test(period)) return "bg-[color:var(--theme-warning-soft)] text-[color:var(--theme-warning)]";
  if (/exit/i.test(period)) return "bg-[color:var(--tn-soft-blue)] text-[color:var(--theme-link)]";
  if (/pre/i.test(period)) return "bg-[color:var(--tn-soft-violet)] text-[color:var(--tn-party-ntk)]";
  return "bg-[color:var(--theme-positive-soft)] text-[color:var(--theme-positive)]";
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
  const totalReach = Math.max(1, totals?.reach ?? 0);
  const selectedPeriod = periods.find((period) => period.key === selected);
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-period-card]")];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next = index;
    if (event.key === "ArrowLeft") next = (index - 1 + buttons.length) % buttons.length;
    if (event.key === "ArrowRight") next = (index + 1) % buttons.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = buttons.length - 1;
    buttons[next]?.focus();
  };
  const card = (period: TnSocialPeriod, index: number) => {
    const active = selected === period.key;
    const share = Math.round((period.reach / totalReach) * 100);
    return (
      <button
        key={period.key}
        type="button"
        data-period-card
        aria-pressed={active}
        onClick={() => onSelect(active ? null : period.key)}
        className={cn(
          "period-card relative flex w-full flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all duration-200 ease-out",
          `period-${period.key}`,
          active ? "period-selected -translate-y-0.5" : selected ? "opacity-65 hover:opacity-100" : "hover:-translate-y-0.5",
        )}
      >
        {active && <span className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-[color:var(--period-ink)] text-[color:var(--theme-surface)]"><Check className="size-3.5" aria-hidden /></span>}
        <span className="mt-1 text-[14px] font-bold leading-tight text-[color:var(--theme-text)]">{period.name}</span>
        <span className="rounded-full bg-[color:var(--theme-surface)]/70 px-2 py-0.5 text-[12px] text-[color:var(--theme-text-3)]">{period.range}</span>
        <span className="mt-2 font-display text-[28px] font-semibold leading-none tabular-nums text-[color:var(--theme-text)]">{number(period.campaigns)}</span>
        <span className="text-[12px] text-[color:var(--theme-text-3)]">campaign{period.campaigns === 1 ? "" : "s"}</span>
        <span className="mt-1 text-[12px] tabular-nums text-[color:var(--theme-text-2)]">Reach {compact(period.reach)}</span>
        <span className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--theme-surface-2)]" aria-hidden>
          <span className="block h-full rounded-full" style={{ width: `${Math.max(2, share)}%`, background: "var(--period-ink)" }} />
        </span>
        <span className="text-[12px] font-semibold tabular-nums text-[color:var(--period-ink)]">{share}% of reach</span>
      </button>
    );
  };
  return (
    <section className="rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.03)]" aria-label="Campaign periods">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-semibold text-[color:var(--theme-text)]">Campaign periods</h3>
          <p className="mt-0.5 text-[12px] text-[color:var(--theme-text-3)]">Click a period to filter the page</p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-pressed={!selected}
          className={cn(
            "inline-flex min-h-11! items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-semibold transition-colors",
            selected ? "border-[color:var(--theme-accent)] text-[color:var(--theme-link)] hover:bg-[color:var(--theme-surface-2)]" : "border-[color:var(--theme-border)] bg-[color:var(--theme-surface-2)] text-[color:var(--theme-text-3)]",
          )}
        >
          {selected ? <X className="size-3.5" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
          {selected ? "Clear filter" : "Showing all periods"}
        </button>
      </div>
      <div className="relative mt-5 hidden min-[640px]:block">
        <span className="period-connector absolute top-[14px] hidden h-px min-[640px]:block" style={{ left: `${50 / Math.max(1, periods.length)}%`, right: `${50 / Math.max(1, periods.length)}%` }} aria-hidden />
        <div className={cn("relative grid grid-cols-2 gap-4", periods.length === 3 ? "min-[640px]:grid-cols-3" : "min-[1024px]:grid-cols-4")} onKeyDown={onKeyDown} role="group" aria-label="Campaign period filter">
          {periods.map((period, index) => (
            <div key={`${period.key}-h`} className="flex flex-col items-center">
              <span className={cn("period-dot z-10 grid size-7 place-items-center rounded-full border-2 bg-[color:var(--theme-surface)] text-[12px] font-bold", selected === period.key ? "border-[color:var(--period-ink)] text-[color:var(--period-ink)]" : "border-[color:var(--theme-border)] text-[color:var(--theme-text-3)]")}>{index + 1}</span>
              <div className="mt-3 w-full">{card(period, index)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="period-mobile mt-4 min-[640px]:hidden" role="group" aria-label="Campaign period filter" onKeyDown={onKeyDown}>
        <ol className="relative space-y-3 border-l border-[color:var(--theme-border)] pl-5">
          {periods.map((period, index) => (
            <li key={period.key} className="relative">
              <span className={cn("absolute -left-[26px] top-3 grid size-5 place-items-center rounded-full border-2 bg-[color:var(--theme-surface)] text-[12px] font-bold", selected === period.key ? "border-[color:var(--period-ink)] text-[color:var(--period-ink)]" : "border-[color:var(--theme-border)] text-[color:var(--theme-text-3)]")}>{index + 1}</span>
              {card(period, index)}
            </li>
          ))}
        </ol>
      </div>
      {selectedPeriod && <p className="mt-2 text-[12px] text-[color:var(--theme-text-3)]">Showing {selectedPeriod.name}. Stats and expanded campaign rows follow this period; accounts stay all-time.</p>}
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
    <th scope="col" className={cn("px-3 py-2.5", align === "right" ? "text-right" : "text-left")} aria-sort={active ? (sort.asc ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(sortKey)} className={cn("inline-flex min-h-11! items-center gap-1 rounded px-1 hover:bg-[color:var(--theme-surface)]/10", align === "right" && "justify-end")} title={`Sort by ${label}`}>
        {label}
        {active ? (sort.asc ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />) : <ArrowUpDown className="size-3 opacity-45" aria-hidden />}
      </button>
    </th>
  );
}

type SortKey = "name" | "campaignCount" | "reach" | "impressions" | "views" | "clicks" | "engagements";

export default function TnSocialMedia({ stateSlug, config, initialFilter, initialOverview, onClose, owner = false }: { stateSlug: string; config?: CaseStudyConfig; initialFilter?: SocialFilter | null; initialOverview?: TnSocialOverview | null; onClose?: () => void; owner?: boolean }) {
  const activeConfig = config ?? TN_CONFIG;
  const hidden = new Set(activeConfig.hiddenMetrics ?? []);
  const showMetric = (key: string) => !hidden.has(key as "views" | "engagements");
  const [overview, setOverview] = useState<TnSocialOverview | null>(initialOverview ?? null);
  const [filtered, setFiltered] = useState<TnSocialFiltered | null>(null);
  const [account, setAccount] = useState<TnSocialFiltered | null>(null);
  const [openAccount, setOpenAccount] = useState<string | null>(null);
  const [accountPage, setAccountPage] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "reach", asc: false });
  const [periodKey, setPeriodKey] = useState<string | null>(null);
  const [explorerAccount, setExplorerAccount] = useState<string | null>(() => initialOverview?.accounts?.length === 1 ? initialOverview.accounts[0].key : null);
  const [explorerMetric, setExplorerMetric] = useState<ExplorerMetric>("reach");
  const [explorerSort, setExplorerSort] = useState<{ key: AccountSortKey; asc: boolean }>({ key: "reach", asc: false });
  const [explorerShowAll, setExplorerShowAll] = useState(false);
  const [loading, setLoading] = useState(!initialOverview);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLElement>(null);
  const wantTop = useRef(Boolean(initialFilter));

  const load = useCallback(async (filter: SocialFilter | null | undefined) => {
    setLoading(true);
    setError("");
    setFiltered(null);
    setAccount(null);
    setOpenAccount(null);
    if (!filter) setPeriodKey(null);
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

  const skipInitialLoad = useRef(Boolean(initialOverview) && !initialFilter);
  useEffect(() => {
    if (skipInitialLoad.current) { skipInitialLoad.current = false; return; }
    if (!initialFilter && overview) {
      setFiltered(null);
      setAccount(null);
      setOpenAccount(null);
      setPeriodKey(null);
      setLoading(false);
      return;
    }
    void load(initialFilter);
  }, [initialFilter, load, overview]);
  useEffect(() => { if (initialFilter) wantTop.current = true; }, [initialFilter]);
  useEffect(() => {
    setExplorerAccount(filtered ? (filtered.accounts.length === 1 ? filtered.accounts[0].key : null) : (overview?.accounts.length === 1 ? overview.accounts[0].key : null));
    setExplorerMetric("reach");
    setExplorerSort({ key: "reach", asc: false });
    setExplorerShowAll(false);
  }, [filtered, overview]);
  useEffect(() => {
    if (explorerMetric === "campaigns" && explorerAccount) setExplorerMetric("reach");
  }, [explorerAccount, explorerMetric]);
  useEffect(() => { setExplorerShowAll(false); }, [explorerAccount, explorerMetric]);
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
    return <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-8 text-[14px] text-[color:var(--theme-text-3)]"><Loader2 className="size-5 animate-spin" /> Loading the social view...</div>;
  }
  if (error) {
    return <div role="alert" className="rounded-xl border border-[#B42318]/30 bg-[color:var(--theme-negative-soft)] px-4 py-3 text-[14px] text-[color:var(--theme-negative)]">{error}</div>;
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
  const overviewExplorer = activeConfig.explorerOnOverview && !filtered && overview
    ? { title: "All campaigns", note: "", how: "", accounts: overview.accounts, campaigns: [], campaignsByAccount: overview.campaignsByAccount ?? {}, totalMatching: overview.totals.campaigns } as TnSocialFiltered
    : null;
  const explorerData = filtered ?? overviewExplorer;
  const explorerAccounts = (explorerData?.accounts ?? []) as TnSocialAccount[];
  const compactExplorer = explorerAccounts.length > 0 && explorerAccounts.length <= 2;
  const explorerSelected = explorerAccount ? explorerAccounts.find((item) => item.key === explorerAccount) ?? null : null;
  const explorerCampaigns = explorerSelected ? explorerData?.campaignsByAccount?.[explorerSelected.key] ?? [] : [];
  const explorerRows = [...explorerAccounts].sort((left, right) => {
    if (explorerSort.key === "name") return explorerSort.asc ? left.name.localeCompare(right.name) : right.name.localeCompare(left.name);
    const a = accountValue(left, explorerSort.key), b = accountValue(right, explorerSort.key);
    return explorerSort.asc ? a - b : b - a;
  });
  const allAccountsRow: TnSocialAccount = {
    key: "all",
    name: "All accounts",
    campaignCount: explorerAccounts.reduce((sum, item) => sum + item.campaignCount, 0),
    reach: explorerAccounts.reduce((sum, item) => sum + item.reach, 0),
    impressions: explorerAccounts.reduce((sum, item) => sum + item.impressions, 0),
    views: explorerAccounts.reduce((sum, item) => sum + item.views, 0),
    clicks: explorerAccounts.reduce((sum, item) => sum + item.clicks, 0),
    engagements: explorerAccounts.reduce((sum, item) => sum + item.engagements, 0),
  };
  const metricLabel = EXPLORER_METRICS.find((item) => item.key === explorerMetric)?.label ?? "Reach";
  const chartRows = explorerSelected
    ? [...explorerCampaigns].sort((left, right) => campaignValue(right, explorerMetric) - campaignValue(left, explorerMetric))
    : [...explorerAccounts].sort((left, right) => accountValue(right, explorerMetric) - accountValue(left, explorerMetric));
  const chartLimit = explorerSelected && !explorerShowAll ? 15 : chartRows.length;
  const visibleChartRows = chartRows.slice(0, chartLimit);
  const chartMax = Math.max(1, ...visibleChartRows.map((item) => explorerSelected ? campaignValue(item as TnSocialCampaign, explorerMetric) : accountValue(item as TnSocialAccount, explorerMetric)));
  const tableCampaigns = explorerSelected ? explorerCampaigns : explorerData?.campaigns ?? [];
  const toggleExplorerSort = (key: AccountSortKey) => setExplorerSort((current) => current.key === key ? { key, asc: !current.asc } : { key, asc: key === "name" });
  const chooseExplorerAccount = (key: string | null) => setExplorerAccount((current) => !key || current === key ? null : key);
  const sortLabel: Record<SortKey, string> = { name: "name", campaignCount: "campaigns", reach: "reach", impressions: "impressions", views: "views", clicks: "clicks", engagements: "engagement" };
  const monthly = filtered ? [] : overview?.monthly ?? [];
  const kpis = [
    { label: "Campaigns", value: totals?.campaigns ?? 0, note: "", mode: "int" as const, metric: "campaigns" as const, color: "var(--theme-chart-campaigns)", icon: <Megaphone className="size-4" />, tint: "bg-[color:var(--tn-soft-blue)] text-[color:var(--theme-chart-campaigns)]" },
    { label: "Impressions", value: totals?.impressions ?? 0, note: number(totals?.impressions), mode: "compact" as const, metric: "impressions" as const, color: "var(--theme-chart-impressions)", icon: <Eye className="size-4" />, tint: "bg-[color:var(--tn-soft-violet)] text-[color:var(--theme-chart-impressions)]" },
    { label: "Views", value: totals?.views ?? 0, note: number(totals?.views), mode: "compact" as const, metric: "views" as const, color: "var(--theme-chart-views)", icon: <BarChart3 className="size-4" />, tint: "bg-[color:var(--theme-warning-soft)] text-[color:var(--theme-chart-views)]" },
    { label: "Clicks", value: totals?.clicks ?? 0, note: number(totals?.clicks), mode: "compact" as const, metric: "clicks" as const, color: "var(--theme-chart-clicks)", icon: <MousePointerClick className="size-4" />, tint: "bg-[color:var(--theme-positive-soft)] text-[color:var(--theme-chart-clicks)]" },
    ...(filtered ? [
      { label: "Reach", value: totals?.reach ?? 0, note: number(totals?.reach), mode: "compact" as const, metric: "reach" as const, color: "var(--theme-chart-reach)", icon: <Users className="size-4" />, tint: "bg-[color:var(--tn-soft-pink)] text-[color:var(--theme-chart-engagement)]" },
      { label: "Engagement", value: totals?.engagements ?? 0, note: number(totals?.engagements), mode: "compact" as const, metric: "engagements" as const, color: "var(--theme-chart-engagement)", icon: <Heart className="size-4" />, tint: "bg-[color:var(--tn-soft-rose)] text-[color:var(--theme-chart-engagement)]" },
    ] : []),
  ].filter((kpi) => showMetric(kpi.metric));

  const toggleSort = (key: SortKey) => {
    setSort((current) => current.key === key ? { key, asc: !current.asc } : { key, asc: key === "name" });
    setAccountPage(0);
  };

  return (
    <section ref={rootRef} className="space-y-4" aria-label="Social media">
      {filtered ? (
        <div className="rounded-2xl border border-[color:var(--theme-border)] social-filter-hero p-5 shadow-[0_10px_30px_rgba(0,0,0,0.035)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--theme-warning)]">{filtered.title.startsWith("Target") && <PartyBadge party={activeConfig.target?.party ?? activeConfig.parties[0]} size={20} />}{filtered.title.startsWith("Target") ? "Target campaign" : "Campaigns"}</p>
              <h2 className="mt-1 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--theme-text)]">{filtered.place ?? filtered.title}</h2>
              <p className="mt-1 max-w-[70ch] text-[14px] leading-relaxed text-[color:var(--theme-text-2)]">{filtered.how}. {filtered.note}</p>
            </div>
            {onClose && (
              <button type="button" onClick={onClose} className="inline-flex min-h-11! items-center gap-1.5 rounded-full border border-[color:var(--theme-text)] px-4 text-[13px] font-semibold text-[color:var(--theme-text)] hover:bg-[color:var(--theme-text)] hover:text-[color:var(--theme-surface)]">
                <X className="size-4" /> Back to survey
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-[color:var(--theme-border)] social-hero p-5 shadow-[0_12px_34px_rgba(0,0,0,0.04)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <SocialCluster iconSize={24} tileSize={34} columns={2} className="grid sm:hidden" />
              <SocialCluster iconSize={30} tileSize={42} columns={2} className="hidden sm:grid" />
              <div>
                <h2 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-[color:var(--theme-text)] sm:text-[32px]">{activeConfig.socialCardTitle ?? "Social Media"}</h2>
                <p className="mt-1 text-[13.5px] text-[color:var(--theme-text-3)]">{overview?.range}{overview?.asOf ? ` · as of ${overview.asOf}` : ""}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-6 sm:gap-8">
              <div>
                <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--theme-text-3)]"><Users className="size-3.5" /> Total reach</p>
                <p className="mt-1 font-display text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[color:var(--theme-text)] sm:text-[42px]"><AnimatedNumber value={totals?.reach ?? 0} mode="compact" /></p>
                <p className="mt-1 text-[12px] tabular-nums text-[color:var(--theme-text-3)]">{number(totals?.reach)}</p>
              </div>
              {showMetric("engagements") && (
                <div>
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--theme-text-3)]"><Heart className="size-3.5" /> Engagement</p>
                  <p className="mt-1 font-display text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[color:var(--theme-text)] sm:text-[42px]"><AnimatedNumber value={totals?.engagements ?? 0} mode="compact" /></p>
                  <p className="mt-1 text-[12px] tabular-nums text-[color:var(--theme-text-3)]">{number(totals?.engagements)}</p>
                </div>
              )}
              <TrendChart data={overview?.monthly ?? []} series={[{ metric: "reach", label: "Reach", color: "var(--theme-chart-reach)" }, ...(showMetric("engagements") ? [{ metric: "engagements" as const, label: "Engagement", color: "var(--theme-chart-engagement)" }] : [])]} height={56} label={showMetric("engagements") ? "Monthly reach and engagement" : "Monthly reach"} className="hidden h-14 w-44 md:block" />
            </div>
          </div>
        </div>
      )}

      {totals && (
        <div className={cn("grid grid-cols-2 gap-2", kpis.length === 2 ? "lg:grid-cols-2" : kpis.length === 3 ? "lg:grid-cols-3" : kpis.length === 5 ? "lg:grid-cols-5" : kpis.length === 6 ? "lg:grid-cols-6" : "lg:grid-cols-4")}>
          {kpis.map((kpi) => (
            <Stat key={kpi.label} label={kpi.label} value={kpi.value} note={kpi.note} mode={kpi.mode} icon={kpi.icon} tint={kpi.tint} chart={monthly.length >= 3 ? { data: monthly, metric: kpi.metric, color: kpi.color, mode: kpi.mode } : undefined} />
          ))}
        </div>
      )}

      {!filtered && overview && overview.periods.length > 1 && (
        <>
          <PeriodTimeline periods={overview.periods} selected={periodKey} totals={overview.totals} onSelect={setPeriodKey} />
          {selectedPeriod && (
            <p className="-mt-2 px-1 text-[12px] text-[color:var(--theme-text-3)]">Showing {selectedPeriod.label}. Stats and expanded campaign rows follow this period; accounts stay all-time.</p>
          )}
        </>
      )}

      {active && (
        explorerData ? (
          <section aria-label="Campaign explorer" className="grid gap-3 lg:grid-cols-[55fr_45fr]">
            <section className={cn("order-1 flex max-h-[520px] min-h-0 flex-col rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.03)] lg:order-2 lg:h-[560px] lg:max-h-none", compactExplorer && "lg:h-auto")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[16px] font-semibold text-[color:var(--theme-text)]">{explorerSelected ? `Top campaigns · ${explorerSelected.name}` : `Ad accounts by ${metricLabel.toLowerCase()}`}</h3>
                  {!activeConfig.minimalCopy && <p className="mt-0.5 text-[12px] text-[color:var(--theme-text-3)]">{explorerSelected ? `${number(explorerCampaigns.length)} campaign${explorerCampaigns.length === 1 ? "" : "s"} shown · choose All accounts to compare accounts` : `${number(explorerAccounts.length)} account${explorerAccounts.length === 1 ? "" : "s"} · select a row to inspect its campaigns`}</p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Explorer metric">
                {EXPLORER_METRICS.filter((item) => (!explorerSelected || item.key !== "campaigns") && !(activeConfig.explorerNoCampaigns && item.key === "campaigns") && showMetric(item.key)).map((item) => (
                  <button key={item.key} type="button" aria-pressed={explorerMetric === item.key} onClick={() => setExplorerMetric(item.key)} className={cn("min-h-9 rounded-full border px-3 text-[11.5px] font-semibold transition-colors", explorerMetric === item.key ? "border-[color:var(--theme-selected)] bg-[color:var(--theme-selected)] text-[color:var(--theme-selected-ink)]" : "border-[color:var(--theme-border)] text-[color:var(--theme-text-2)] hover:border-[color:var(--theme-text)] hover:text-[color:var(--theme-text)]")}>{item.label}</button>
                ))}
              </div>
              <div className="relative mt-3 min-h-0 flex-1 overflow-y-auto pr-1" role="region" aria-label="Ranked chart" tabIndex={0}>
                <div className="explorer-grid pointer-events-none absolute inset-y-0 left-[32%] right-0" aria-hidden />
                <div className="relative space-y-2">
                  {visibleChartRows.map((item, index) => {
                    const isAccount = !explorerSelected;
                    const name = isAccount ? (item as TnSocialAccount).name : (item as TnSocialCampaign).name;
                    const value = isAccount ? accountValue(item as TnSocialAccount, explorerMetric) : campaignValue(item as TnSocialCampaign, explorerMetric);
                    const width = Math.max(1, (value / chartMax) * 82);
                    return (
                      <div key={isAccount ? (item as TnSocialAccount).key : `${name}-${index}`} className={cn("grid items-center gap-2", explorerSelected ? "grid-cols-[minmax(120px,42%)_minmax(0,1fr)]" : "grid-cols-[minmax(72px,32%)_minmax(0,1fr)]")}>
                        <span className="truncate text-[11.5px] text-[color:var(--theme-text-2)]" title={name}>{name}</span>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 rounded-full bg-[color:var(--theme-chart-explorer)] transition-[width] duration-200 ease-out" style={{ width: `${width.toFixed(2)}%` }} />
                          <span className="shrink-0 text-[11px] tabular-nums text-[color:var(--theme-text-2)]">{explorerNumber(value, explorerMetric)}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {explorerSelected && explorerCampaigns.length > 15 && (
                <button type="button" onClick={() => setExplorerShowAll((value) => !value)} className="mt-2 inline-flex min-h-10 self-start rounded-full border border-[color:var(--theme-border)] px-3 text-[11.5px] font-semibold text-[color:var(--theme-link)] hover:border-[color:var(--theme-link)]">
                  {explorerShowAll ? "Show top 15" : `Show more (${explorerCampaigns.length - 15})`}
                </button>
              )}
            </section>

            <section className={cn("order-2 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] shadow-[0_10px_30px_rgba(0,0,0,0.03)] lg:order-1 lg:h-[560px]", compactExplorer && "lg:h-auto")}>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[680px] border-collapse text-[13px]">
                  <thead className="sticky top-0 z-20 text-left text-[10.5px] uppercase tracking-wide">
                    <tr>
                      {([{ key: "name", label: "Ad account" }, { key: "reach", label: "Reach" }, { key: "impressions", label: "Impressions" }, { key: "views", label: "Views" }, { key: "clicks", label: "Clicks" }, { key: "engagements", label: "Engagement" }, { key: "campaigns", label: "Campaigns" }] as Array<{ key: AccountSortKey; label: string }>).filter((column) => showMetric(column.key)).map((column) => (
                        <th key={column.key} scope="col" aria-sort={explorerSort.key === column.key ? (explorerSort.asc ? "ascending" : "descending") : "none"} className={cn("px-2.5 py-2 font-semibold", column.key === "name" ? "sticky left-0 z-30 bg-[color:var(--theme-selected)]" : column.key === "campaigns" ? "text-right" : "text-right")}>
                          <button type="button" onClick={() => toggleExplorerSort(column.key)} className={cn("inline-flex min-h-9 items-center gap-1 whitespace-nowrap rounded px-1 hover:bg-white/10", column.key === "name" ? "text-left" : "justify-end")} title={`Sort by ${column.label}`}>
                            {column.label}
                            {explorerSort.key === column.key ? (explorerSort.asc ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />) : <ArrowUpDown className="size-3 opacity-40" aria-hidden />}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {([{ account: allAccountsRow, key: null, selected: explorerAccount === null }, ...explorerRows.map((account) => ({ account, key: account.key, selected: explorerAccount === account.key }))]).map(({ account, key, selected }) => (
                      <tr
                        key={key ?? "all"}
                        tabIndex={0}
                        aria-selected={selected}
                        onClick={() => chooseExplorerAccount(key)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          chooseExplorerAccount(key);
                        }}
                        className={cn("cursor-pointer border-t border-[color:var(--theme-border)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--theme-link)]", selected ? "bg-[color:var(--theme-selected)] text-[color:var(--theme-selected-ink)]" : "hover:bg-[color:var(--theme-surface-2)]")}
                      >
                        <th scope="row" className={cn("sticky left-0 z-10 px-2.5 py-2 text-left font-semibold", selected ? "bg-[color:var(--theme-selected)]" : "bg-[color:var(--theme-surface)]")}>
                          <span className="inline-flex items-center gap-2">
                            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold", selected ? "bg-white/15" : "bg-[color:var(--theme-surface-2)] text-[color:var(--theme-link)]")} aria-hidden>{aliasText(account.name)}</span>
                            <span className="min-w-0">
                              <span className="block truncate">{account.name}</span>
                              {owner && account.id && <span className={cn("mt-0.5 block truncate text-[10.5px] font-normal", selected ? "text-white/70" : "text-[color:var(--theme-text-3)]")}>{account.business || "Ad account"} · {account.id}</span>}
                            </span>
                          </span>
                        </th>
                        {(["reach", "impressions", "views", "clicks", "engagements", "campaigns"] as ExplorerMetric[]).filter(showMetric).map((metric) => (
                          <td key={metric} className="px-2.5 py-2 text-right tabular-nums">{explorerNumber(accountValue(account, metric), metric)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] shadow-[0_10px_30px_rgba(0,0,0,0.03)]" aria-label="Ad accounts">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--theme-border)] px-4 py-3">
              <h3 className="text-[16px] font-semibold text-[color:var(--theme-text)]">Ad accounts</h3>
              <p className="text-[12px] text-[color:var(--theme-text-3)]">{allAccounts.length} accounts · sorted by {sortLabel[sort.key]}</p>
            </div>
            {!allAccounts.length && <p className="px-4 py-6 text-[14px] text-[color:var(--theme-text-3)]">No ad accounts in this period. Pick another period or clear the filter.</p>}
            {allAccounts.length > 0 && <div className="edge-fade-right hidden max-h-[560px] overflow-auto min-[640px]:block">
              <table className="w-full min-w-[860px] border-collapse text-[14px]">
                <thead className="sticky top-0 z-10 text-left text-[12px] uppercase tracking-wide">
                  <tr>
                    <SortHead label="Ad account" sortKey="name" sort={sort} onSort={toggleSort} align="left" />
                    <SortHead label="Campaigns" sortKey="campaignCount" sort={sort} onSort={toggleSort} />
                    <SortHead label="Reach" sortKey="reach" sort={sort} onSort={toggleSort} />
                    <SortHead label="Impressions" sortKey="impressions" sort={sort} onSort={toggleSort} />
                    {showMetric("views") && <SortHead label="Views" sortKey="views" sort={sort} onSort={toggleSort} />}
                    <SortHead label="Clicks" sortKey="clicks" sort={sort} onSort={toggleSort} />
                    {showMetric("engagements") && <SortHead label="Engagement" sortKey="engagements" sort={sort} onSort={toggleSort} />}
                  </tr>
                </thead>
                <tbody>
                  {pageAccounts.map((item) => (
                    <Fragment key={item.key}>
                    <tr className="border-t border-[color:var(--theme-border)] transition-colors hover:bg-[color:var(--theme-surface-3)] align-middle">
                      <th scope="row" className="sticky left-0 z-10 bg-[color:var(--theme-surface)] px-4 py-2.5 text-left font-semibold text-[color:var(--theme-text)]">
                        <button type="button" onClick={() => void toggleAccount(item.key)} className="inline-flex min-h-11! items-center gap-2 align-middle text-left hover:text-[color:var(--theme-link)]">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[color:var(--tn-soft-blue)] text-[12px] font-bold text-[color:var(--theme-link)]" aria-hidden>{aliasText(item.name)}</span>
                          {item.name}
                          {openAccount === item.key ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                        </button>
                        {owner && item.id && <span className="mt-0.5 block text-[12px] font-normal text-[color:var(--theme-text-3)]">{item.business || "Ad account"} · {item.id}</span>}
                      </th>
                      <td className="px-3 py-2.5 text-right align-middle tabular-nums">{number(item.campaignCount)}</td>
                      <td className="px-3 py-2.5 text-right align-middle tabular-nums"><CellBar value={item.reach} max={maxAccountReach} /></td>
                      <td className="px-3 py-2.5 text-right align-middle tabular-nums"><Num value={item.impressions} /></td>
                      {showMetric("views") && <td className="px-3 py-2.5 text-right align-middle tabular-nums"><Num value={item.views} /></td>}
                      <td className="px-3 py-2.5 text-right align-middle tabular-nums"><Num value={item.clicks} /></td>
                      {showMetric("engagements") && <td className="px-3 py-2.5 text-right align-middle tabular-nums"><CellBar value={item.engagements} max={maxAccountEng} tone="sky" /></td>}
                    </tr>
                    {openAccount === item.key && account?.accounts[0]?.key === item.key && (
                      <tr className="border-t border-[color:var(--theme-border)] bg-[color:var(--theme-surface-3)]">
                        <td colSpan={5 + (showMetric("views") ? 1 : 0) + (showMetric("engagements") ? 1 : 0)} className="p-0">
                          <div className="tn-expand">
                            <div className="min-h-0 overflow-hidden">
                              <CampaignTable title={`Campaigns · ${item.name}`} campaigns={account.campaigns} total={account.totalMatching} periodLabel={periodLabel} flush hidden={hidden} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>}
            <div className="space-y-2 p-3 min-[640px]:hidden">
              {pageAccounts.map((item) => (
                <div key={item.key} className="rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-3">
                  <button type="button" onClick={() => void toggleAccount(item.key)} className="flex min-h-11! w-full items-center gap-2 text-left">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color:var(--tn-soft-blue)] text-[12px] font-bold text-[color:var(--theme-link)]" aria-hidden>{aliasText(item.name)}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-[color:var(--theme-text)]">{item.name}</span>{owner && item.id && <span className="block truncate text-[12px] text-[color:var(--theme-text-3)]">{item.business || "Ad account"} · {item.id}</span>}</span>
                    {openAccount === item.key ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                  </button>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                    <div><p className="text-[color:var(--theme-text-3)]">Reach</p><p className="font-semibold tabular-nums text-[color:var(--theme-text)]" title={number(item.reach)}>{compact(item.reach)}</p></div>
                    <div><p className="text-[color:var(--theme-text-3)]">Impressions</p><p className="font-semibold tabular-nums text-[color:var(--theme-text)]" title={number(item.impressions)}>{compact(item.impressions)}</p></div>
                    {showMetric("views") && <div><p className="text-[color:var(--theme-text-3)]">Views</p><p className="font-semibold tabular-nums text-[color:var(--theme-text)]" title={number(item.views)}>{compact(item.views)}</p></div>}
                    <div><p className="text-[color:var(--theme-text-3)]">Clicks</p><p className="font-semibold tabular-nums text-[color:var(--theme-text)]" title={number(item.clicks)}>{compact(item.clicks)}</p></div>
                    {showMetric("engagements") && <div><p className="text-[color:var(--theme-text-3)]">Engagement</p><p className="font-semibold tabular-nums text-[color:var(--theme-text)]" title={number(item.engagements)}>{compact(item.engagements)}</p></div>}
                    <div><p className="text-[color:var(--theme-text-3)]">Campaigns</p><p className="font-semibold tabular-nums text-[color:var(--theme-text)]">{number(item.campaignCount)}</p></div>
                  </div>
                  {openAccount === item.key && account?.accounts[0]?.key === item.key && (
                    <div className="tn-expand mt-2"><div className="min-h-0 overflow-hidden"><CampaignTable title={`Campaigns · ${item.name}`} campaigns={account.campaigns} total={account.totalMatching} periodLabel={periodLabel} flush hidden={hidden} /></div></div>
                  )}
                </div>
              ))}
            </div>
            {accountPageCount > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--theme-border)] px-4 py-2 text-[12.5px] text-[color:var(--theme-text-3)]">
                <span className="tabular-nums">{currentAccountPage * accountPageSize + 1}-{Math.min(sortedAccounts.length, (currentAccountPage + 1) * accountPageSize)} of {sortedAccounts.length}</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={currentAccountPage === 0} onClick={() => setAccountPage((value) => Math.max(0, value - 1))} className="inline-flex min-h-11! min-w-11 items-center justify-center rounded-full border border-[color:var(--theme-border)] px-3 font-semibold text-[color:var(--theme-text)] disabled:opacity-40">Previous</button>
                  <button type="button" disabled={currentAccountPage >= accountPageCount - 1} onClick={() => setAccountPage((value) => Math.min(accountPageCount - 1, value + 1))} className="inline-flex min-h-11! min-w-11 items-center justify-center rounded-full border border-[color:var(--theme-border)] px-3 font-semibold text-[color:var(--theme-text)] disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </section>
        )
      )}

      {filtered && <CampaignTable title={explorerSelected ? `Campaigns · ${explorerSelected.name}` : `Top ${Math.min(100, filtered.campaigns.length)} campaigns`} campaigns={tableCampaigns} total={explorerSelected ? tableCampaigns.length : filtered.totalMatching} hidden={hidden} />}
    </section>
  );
}

function CampaignTable({ title, campaigns, total, periodLabel, flush = false, hidden = new Set<string>() }: { title: string; campaigns: TnSocialCampaign[]; total: number; periodLabel?: string | null; flush?: boolean; hidden?: Set<string> }) {
  const showMetric = (key: string) => !hidden.has(key);
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
    <section className={cn("overflow-hidden bg-[color:var(--theme-surface)]", flush ? "border-t border-[color:var(--theme-border)]" : "rounded-2xl border border-[color:var(--theme-border)] shadow-[0_10px_30px_rgba(0,0,0,0.03)]")} aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--theme-border)] px-4 py-3">
        <h3 className="text-[18px] font-semibold text-[color:var(--theme-text)]">{title}{periodLabel ? ` · ${periodLabel}` : ""}</h3>
        <p className="text-[12px] text-[color:var(--theme-text-3)]">{rows.length} of {total}</p>
      </div>
      {!rows.length && <p className="px-4 py-6 text-[14px] text-[color:var(--theme-text-3)]">No campaigns match this period. Try another period or clear the filter.</p>}
      <div className={cn("edge-fade-right hidden min-[640px]:block", flush ? "overflow-x-auto" : "max-h-[520px] overflow-auto")} role="region" aria-label={`${title} table`} tabIndex={0}>
        <table className="tn-long-table w-full min-w-[980px] border-collapse text-[14px]">
          <thead className="sticky top-0 z-10 text-left text-[12px] uppercase tracking-wide">
            <tr><th scope="col" className="px-4 py-2.5">Campaign</th><th scope="col" className="px-3 py-2.5">Period</th><th scope="col" className="px-3 py-2.5">Status</th><th scope="col" className="px-3 py-2.5">Start</th><th scope="col" className="px-3 py-2.5 text-right">Reach</th><th scope="col" className="px-3 py-2.5 text-right">Impressions</th>{showMetric("views") && <th scope="col" className="px-3 py-2.5 text-right">Views</th>}<th scope="col" className="px-3 py-2.5 text-right">Clicks</th>{showMetric("engagements") && <th scope="col" className="px-3 py-2.5 text-right">Engagement</th>}</tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && <tr><td colSpan={7 + (showMetric("views") ? 1 : 0) + (showMetric("engagements") ? 1 : 0)} className="px-4 py-6 text-center text-[13px] text-[color:var(--theme-text-3)]">No campaigns in this period.</td></tr>}
            {pageRows.map((campaign, index) => (
              <tr key={campaign.id ?? `${campaign.name}-${index}`} className="border-t border-[color:var(--theme-border)] transition-colors hover:bg-[color:var(--theme-surface-3)] align-middle">
                <th scope="row" className="sticky left-0 z-10 bg-[color:var(--theme-surface)] px-4 py-2 text-left font-medium text-[color:var(--theme-text)]">{campaign.href ? <a href={campaign.href} target="_blank" rel="noopener" className="inline-flex min-h-11! items-center gap-1 text-[color:var(--theme-link)] hover:underline">{campaign.name}<ArrowUpRight className="size-3" /></a> : campaign.name}</th>
                <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-[12px] font-semibold", periodStyle(campaign.period))}>{campaign.period}</span></td>
                <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-[12px] font-semibold", /on/i.test(campaign.status) ? "bg-[color:var(--theme-positive-soft)] text-[color:var(--theme-positive)]" : "bg-[color:var(--theme-surface-2)] text-[color:var(--theme-text-2)]")}>{campaign.status || "—"}</span></td>
                <td className="px-3 py-2 whitespace-nowrap">{campaign.start}</td>
                <td className="px-3 py-2 text-right align-middle tabular-nums"><CellBar value={campaign.reach} max={maxReach} /></td>
                <td className="px-3 py-2 text-right align-middle tabular-nums"><Num value={campaign.impressions} /></td>
                {showMetric("views") && <td className="px-3 py-2 text-right align-middle tabular-nums"><Num value={campaign.views} /></td>}
                <td className="px-3 py-2 text-right align-middle tabular-nums"><Num value={campaign.clicks} /></td>
                {showMetric("engagements") && <td className="px-3 py-2 text-right align-middle tabular-nums"><CellBar value={campaign.engagements} max={maxEng} tone="sky" /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 p-3 min-[640px]:hidden">
        {pageRows.length === 0 && <p className="py-4 text-center text-[12px] text-[color:var(--theme-text-3)]">No campaigns in this period.</p>}
        {pageRows.map((campaign, index) => (
          <div key={campaign.id ?? `${campaign.name}-${index}`} className="rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-3">
            <p className="text-[13px] font-semibold text-[color:var(--theme-text)]">{campaign.href ? <a href={campaign.href} target="_blank" rel="noopener" className="inline-flex min-h-11! items-center gap-1 text-[color:var(--theme-link)] hover:underline">{campaign.name}<ArrowUpRight className="size-3" /></a> : campaign.name}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-semibold", periodStyle(campaign.period))}>{campaign.period}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-semibold", /on/i.test(campaign.status) ? "bg-[color:var(--theme-positive-soft)] text-[color:var(--theme-positive)]" : "bg-[color:var(--theme-surface-2)] text-[color:var(--theme-text-2)]")}>{campaign.status || "—"}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
              <div><p className="text-[color:var(--theme-text-3)]">Reach</p><p className="font-semibold tabular-nums text-[color:var(--theme-text)]" title={number(campaign.reach)}>{compact(campaign.reach)}</p></div>
              <div><p className="text-[color:var(--theme-text-3)]">Impressions</p><p className="font-semibold tabular-nums text-[color:var(--theme-text)]" title={number(campaign.impressions)}>{compact(campaign.impressions)}</p></div>
              {showMetric("views") && <div><p className="text-[color:var(--theme-text-3)]">Views</p><p className="font-semibold tabular-nums text-[color:var(--theme-text)]" title={number(campaign.views)}>{compact(campaign.views)}</p></div>}
              <div><p className="text-[color:var(--theme-text-3)]">Clicks</p><p className="font-semibold tabular-nums text-[color:var(--theme-text)]" title={number(campaign.clicks)}>{compact(campaign.clicks)}</p></div>
              {showMetric("engagements") && <div><p className="text-[color:var(--theme-text-3)]">Engagement</p><p className="font-semibold tabular-nums text-[color:var(--theme-text)]" title={number(campaign.engagements)}>{compact(campaign.engagements)}</p></div>}
              <div><p className="text-[color:var(--theme-text-3)]">Start</p><p className="font-semibold text-[color:var(--theme-text)]">{campaign.start}</p></div>
            </div>
          </div>
        ))}
      </div>
      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--theme-border)] px-4 py-2 text-[12.5px] text-[color:var(--theme-text-3)]">
          <span className="tabular-nums">{currentPage * pageSize + 1}-{Math.min(rows.length, (currentPage + 1) * pageSize)} of {rows.length}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="inline-flex min-h-11! min-w-11 items-center justify-center rounded-full border border-[color:var(--theme-border)] px-3 font-semibold text-[color:var(--theme-text)] disabled:opacity-40">Previous</button>
            <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} className="inline-flex min-h-11! min-w-11 items-center justify-center rounded-full border border-[color:var(--theme-border)] px-3 font-semibold text-[color:var(--theme-text)] disabled:opacity-40">Next</button>
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
      <span className="h-[3px] w-full overflow-hidden rounded-full bg-[color:var(--theme-grid)]" aria-hidden>
        <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (value / max) * 100)}%`, background: tone === "sky" ? "var(--theme-chart-reach)" : "color-mix(in srgb, var(--theme-text) 60%, transparent)" }} />
      </span>
    </span>
  );
}
