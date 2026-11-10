"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, ChevronRight, Download, Loader2, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useReauth } from "@/components/auth/reauth-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DateRangePicker, type DateRangeValue } from "@/components/ui/date-range-picker";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { UpdatedAt } from "@/components/ui/updated-at";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import EChart from "@/components/case-studies/telangana/echart";
import { CASES } from "@/lib/cases";
import { formatInr } from "@/lib/meta/insights";
import { partiesForState } from "@/lib/meta/tags";
import type { ExplorerAd, ExplorerCampaign, Metrics, OwnerOverview, RangeKey } from "@/lib/meta/overview";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const PRESETS: { id: RangeKey; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
  { id: "lifetime", label: "Lifetime" },
  { id: "custom", label: "Custom" },
];
const PLATFORMS = [{ id: "all", label: "All platforms" }, { id: "facebook", label: "Facebook" }, { id: "instagram", label: "Instagram" }];
const EMPTY_METRICS: Metrics = { spend: 0, impressions: 0, reach: null, clicks: 0, ctr: null, cpm: null, cpc: null, videoPlays: 0, thruPlays: 0 };
const NO_METRICS: Metrics = { spend: Number.NaN, impressions: Number.NaN, reach: null, clicks: Number.NaN, ctr: null, cpm: null, cpc: null, videoPlays: Number.NaN, thruPlays: Number.NaN };

function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1e7) return `${(value / 1e7).toFixed(1)}Cr`;
  if (Math.abs(value) >= 1e5) return `${(value / 1e5).toFixed(1)}L`;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function formatPct(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`;
}

function delta(current: number | null | undefined, previous: number | null | undefined): { value: string; direction: "up" | "down" | "flat" } | null {
  if (previous == null || current == null) return null;
  if (previous === 0) return current === 0 ? { value: "0.0%", direction: "flat" } : null;
  const change = ((current - previous) / previous) * 100;
  return { value: `${change >= 0 ? "↑" : "↓"} ${Math.abs(change).toFixed(1)}%`, direction: change > 0 ? "up" : change < 0 ? "down" : "flat" };
}

function statusTone(status: string | null): "success" | "warning" | "danger" | "neutral" {
  if (!status) return "neutral";
  if (status === "ACTIVE") return "success";
  if (["PENDING_BILLING_INFO", "WITH_ISSUES", "IN_PROCESS", "PAUSED"].includes(status)) return "warning";
  if (["DISABLED", "DISAPPROVED", "DELETED"].includes(status)) return "danger";
  return "neutral";
}

function accountTone(account: OwnerOverview["accounts"][number]): { tone: "success" | "warning" | "danger"; label: string } {
  const cap = account.spendCap ? (account.amountSpent ?? 0) / account.spendCap : 0;
  if (account.disableReason) return { tone: "danger", label: account.disableReason };
  if (account.status != null && account.status !== 1) return { tone: "danger", label: account.status === 3 ? "Pending billing" : "Disabled" };
  if (cap >= 0.9) return { tone: "warning", label: `Cap ${Math.round(cap * 100)}%` };
  return { tone: "success", label: "Active" };
}

function Filters({ value, onChange, stateOptions }: {
  value: { range: RangeKey; from: string; to: string; state: string; party: string; platform: string };
  onChange: (next: typeof value) => void;
  stateOptions: { slug: string; stateName: string }[];
}) {
  const dateValue: DateRangeValue = { preset: value.range, from: value.from, to: value.to };
  const partyOptions = value.state ? partiesForState(value.state) : [];
  return (
    <div className="flex flex-wrap items-end gap-2">
      <DateRangePicker
        value={dateValue}
        onChange={(next) => onChange({ ...value, range: next.preset, from: next.from ?? "", to: next.to ?? "" })}
      />
      <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">State
        <select value={value.state} onChange={(event) => onChange({ ...value, state: event.target.value, party: "" })} className="mt-1 min-h-10 rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-2 text-[12px]">
          <option value="">All states</option>
          {stateOptions.map((state) => <option key={state.slug} value={state.slug}>{state.stateName}</option>)}
        </select>
      </label>
      <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Party
        <select value={value.party} onChange={(event) => onChange({ ...value, party: event.target.value })} disabled={!value.state} className="mt-1 min-h-10 rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-2 text-[12px] disabled:opacity-60">
          <option value="">All parties</option>
          {partyOptions.map((party) => <option key={party} value={party}>{party}</option>)}
        </select>
      </label>
      <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Platform
        <select value={value.platform} onChange={(event) => onChange({ ...value, platform: event.target.value })} className="mt-1 min-h-10 rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-2 text-[12px]">
          {PLATFORMS.map((platform) => <option key={platform.id} value={platform.id}>{platform.label}</option>)}
        </select>
      </label>
    </div>
  );
}

function MetricsCells({ metrics }: { metrics: Metrics }) {
  return (
    <>
      <td className="num-right px-3 py-2">{formatInr(metrics.spend)}</td>
      <td className="num-right px-3 py-2">{formatCount(metrics.impressions)}</td>
      <td className="num-right px-3 py-2">{formatPct(metrics.ctr)}</td>
      <td className="num-right px-3 py-2">{formatCount(metrics.thruPlays)}</td>
    </>
  );
}

function ExplorerRow({ level, label, status, metrics, expandable, expanded, onToggle, onClick, color }: {
  level: number; label: string; status: string | null; metrics: Metrics; expandable: boolean;
  expanded: boolean; onToggle: () => void; onClick?: () => void; color?: string;
}) {
  return (
    <tr className={cn("border-t border-[var(--border-hairline)]/70", onClick && "cursor-pointer hover:bg-[var(--surface-raised)]")} onClick={onClick}>
      <td className="px-3 py-2">
        <span className="flex items-center gap-1.5" style={{ paddingLeft: level * 14 }}>
          {expandable ? (
            <button type="button" onClick={(event) => { event.stopPropagation(); onToggle(); }} aria-label={expanded ? "Collapse" : "Expand"} className="grid size-6 place-items-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          ) : <span className="size-6" />}
          {color && <span className="size-2 rounded-full" style={{ background: color }} />}
          <span className="truncate">{label}</span>
        </span>
      </td>
      <td className="px-3 py-2"><span className={cn("font-semibold", status === "ACTIVE" ? "text-[var(--success)]" : status && ["DISABLED", "DISAPPROVED", "DELETED"].includes(status) ? "text-[var(--danger)]" : "text-[var(--warning)]")}>{status ?? "—"}</span></td>
      <MetricsCells metrics={metrics} />
    </tr>
  );
}

function CreativeDialog({ ad, onClose }: { ad: ExplorerAd | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(ad)} onClose={onClose} title={ad?.name ?? "Creative"} description={ad ? `${ad.metrics.impressions.toLocaleString("en-IN")} impressions · ${formatPct(ad.metrics.ctr)} CTR` : undefined}>
      {ad && (
        <div className="space-y-3">
          {ad.creative?.videoId ? (
            <video controls playsInline poster={ad.creative.thumbnailUrl ?? undefined} className="w-full rounded-[var(--radius-control)] bg-black">
              <source src={`/api/meta/owner/creative/${encodeURIComponent(ad.id)}`} />
            </video>
          ) : ad.creative?.imageUrl || ad.creative?.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.creative.imageUrl ?? ad.creative.thumbnailUrl ?? ""} alt={ad.creative.title ?? ad.name} className="w-full rounded-[var(--radius-control)]" />
          ) : <EmptyState title="No creative media is available for this ad." />}
          {ad.creative?.body && <p className="type-small text-[var(--text-muted)]">{ad.creative.body}</p>}
          <dl className="grid grid-cols-2 gap-2 text-[12px]">
            <div><dt className="text-[var(--text-muted)]">Impressions</dt><dd className="num font-semibold">{formatCount(ad.metrics.impressions)}</dd></div>
            <div><dt className="text-[var(--text-muted)]">Video plays</dt><dd className="num font-semibold">{formatCount(ad.metrics.videoPlays)}</dd></div>
            <div><dt className="text-[var(--text-muted)]">ThruPlays</dt><dd className="num font-semibold">{formatCount(ad.metrics.thruPlays)}</dd></div>
            <div><dt className="text-[var(--text-muted)]">Spend</dt><dd className="num font-semibold">{formatInr(ad.metrics.spend)}</dd></div>
          </dl>
          {ad.creative?.instagramPermalinkUrl && <a href={ad.creative.instagramPermalinkUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center text-[12px] font-semibold text-[var(--accent-brass-strong)]">Open on Instagram</a>}
        </div>
      )}
    </Dialog>
  );
}

export default function OwnerDashboard() {
  const { theme } = useTheme();
  const reduced = usePrefersReducedMotion();
  const { requestReauth } = useReauth();
  const [overview, setOverview] = useState<OwnerOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState({ range: "7d" as RangeKey, from: "", to: "", state: "", party: "", platform: "all" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedAd, setSelectedAd] = useState<ExplorerAd | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams({ range: filter.range, platform: filter.platform });
    if (filter.from) params.set("from", filter.from);
    if (filter.to) params.set("to", filter.to);
    if (filter.state) params.set("state", filter.state);
    if (filter.party) params.set("party", filter.party);
    return params.toString();
  }, [filter]);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/meta/owner/overview?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load Meta Ads data");
      const data = await response.json();
      setOverview(data.overview);
      setExpanded((current) => {
        const next = new Set(current);
        for (const campaign of data.overview?.campaigns ?? []) next.add(`state:${campaign.state}`);
        return next;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Meta Ads data");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => { void load(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!overview?.connection.connected || overview.connection.expired) return;
    const last = overview.connection.lastSyncAt ? new Date(overview.connection.lastSyncAt).getTime() : 0;
    if (Date.now() - last > 15 * 60 * 1000) void refresh(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview?.connection.connected, overview?.connection.expired, overview?.connection.lastSyncAt]);

  async function refresh(auto = false) {
    if (busy) return;
    setBusy("refresh");
    try {
      const response = await fetch("/api/meta/owner/sync", { method: "POST" });
      if (response.status === 429) {
        if (!auto) setMessage("Refresh is limited to once per minute.");
        return;
      }
      if (!response.ok) {
        if (!auto) setMessage("Sync could not start.");
        return;
      }
      if (!auto) setMessage("Sync started.");
      await load();
    } finally { setBusy(""); }
  }

  async function exportCsv(retry = false) {
    setBusy("export"); setMessage("");
    try {
      const response = await fetch(`/api/meta/owner/export?${query}`);
      if (response.status === 403) {
        const data = await response.json().catch(() => ({}));
        if (data.code === "reauth_required") {
          const ok = retry ? false : await requestReauth();
          if (ok) { await exportCsv(true); return; }
        }
        setMessage("Re-authentication is required to export.");
        return;
      }
      if (!response.ok) { setMessage("Export failed."); return; }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `meta-ads-${filter.range}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally { setBusy(""); }
  }

  async function markAllRead() {
    await fetch("/api/meta/owner/notifications/read", { method: "POST" });
    setNotificationsOpen(false);
    await load();
  }

  const dailyOption = useMemo(() => {
    const daily = overview?.daily ?? [];
    return {
      animation: !reduced, animationDuration: 450,
      grid: { left: 52, right: 44, top: 20, bottom: 26 },
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: daily.map((row) => row.date.slice(5)), axisLabel: { fontSize: 9, color: theme === "dark" ? "#adb7c4" : "#626b78" } },
      yAxis: [
        { type: "value", name: "₹", axisLabel: { fontSize: 9 }, splitLine: { lineStyle: { opacity: 0.12 } } },
        { type: "value", name: "impr.", axisLabel: { fontSize: 9 }, splitLine: { show: false } },
      ],
      series: [
        { name: "Spend", type: "bar", data: daily.map((row) => +(row.spend / 100).toFixed(2)), itemStyle: { color: "#f58a24", borderRadius: [2, 2, 0, 0] } },
        { name: "Impressions", type: "line", yAxisIndex: 1, data: daily.map((row) => row.impressions), itemStyle: { color: "#2563eb" }, smooth: true },
      ],
    };
  }, [overview?.daily, reduced, theme]);

  const platformOption = useMemo(() => {
    const platforms = overview?.platforms ?? [];
    return {
      animation: !reduced, animationDuration: 450,
      grid: { left: 64, right: 24, top: 16, bottom: 26 },
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: platforms.map((row) => row.platform), axisLabel: { fontSize: 10 } },
      yAxis: { type: "value", name: "₹", axisLabel: { fontSize: 9 }, splitLine: { lineStyle: { opacity: 0.12 } } },
      series: [{ type: "bar", data: platforms.map((row) => +(row.spend / 100).toFixed(2)), itemStyle: { color: "#16a34a", borderRadius: [3, 3, 0, 0] }, barMaxWidth: 34 }],
    };
  }, [overview?.platforms, reduced]);

  const stateGroups = useMemo(() => {
    const map = new Map<string, { state: string; stateLabel: string; rows: OwnerOverview["groups"] }>();
    for (const group of overview?.groups ?? []) {
      const entry = map.get(group.state) ?? { state: group.state, stateLabel: group.stateLabel, rows: [] };
      entry.rows.push(group);
      map.set(group.state, entry);
    }
    return [...map.values()].sort((a, b) => a.state === "unassigned" ? 1 : b.state === "unassigned" ? -1 : a.stateLabel.localeCompare(b.stateLabel));
  }, [overview?.groups]);

  const campaignGroups = useMemo(() => {
    const map = new Map<string, { state: string; stateLabel: string; parties: Map<string, { party: string; partyLabel: string; color: string; campaigns: ExplorerCampaign[] }> }>();
    for (const campaign of overview?.campaigns ?? []) {
      const stateEntry = map.get(campaign.state) ?? { state: campaign.state, stateLabel: campaign.stateLabel, parties: new Map() };
      const partyEntry = stateEntry.parties.get(campaign.party) ?? { party: campaign.party, partyLabel: campaign.partyLabel, color: campaign.color, campaigns: [] };
      partyEntry.campaigns.push(campaign);
      stateEntry.parties.set(campaign.party, partyEntry);
      map.set(campaign.state, stateEntry);
    }
    return [...map.values()].sort((a, b) => a.state === "unassigned" ? 1 : b.state === "unassigned" ? -1 : a.stateLabel.localeCompare(b.stateLabel));
  }, [overview?.campaigns]);

  const toggle = (key: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  if (!overview && loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-24" />)}</div>
        <SkeletonRows rows={6} />
      </div>
    );
  }
  if (!overview) return <ErrorState message={error || "Could not load Meta Ads data."} onRetry={() => void load()} />;

  const totals = overview.totals;
  const previous = totals.previous ?? EMPTY_METRICS;
  const connectionLabel = overview.connection.expired ? "Reconnect" : overview.connection.connected ? "Connected" : "Connect Meta Ads";
  const connectionTone = overview.connection.expired ? "danger" : overview.connection.connected ? "success" : "warning";
  const expiresMinutes = overview.connection.expiresAt ? Math.max(0, Math.round((new Date(overview.connection.expiresAt).getTime() - Date.now()) / 60_000)) : null;
  const displayConnection = overview.connection.connected && !overview.connection.expired
    ? `Connected · expires in ${Math.floor((expiresMinutes ?? 0) / 60)}h ${(expiresMinutes ?? 0) % 60}m`
    : connectionLabel;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[clamp(30px,4vw,48px)] font-semibold tracking-[-0.03em]">Meta Ads</h1>
        <Link href="/meta-ads/settings" className={cn("inline-flex min-h-9 items-center rounded-full border px-3 text-[11px] font-bold uppercase tracking-[0.08em]", connectionTone === "success" ? "border-[var(--success)]/40 bg-[var(--success-bg)] text-[var(--success)]" : connectionTone === "danger" ? "border-[var(--danger)]/40 bg-[var(--danger-bg)] text-[var(--danger)]" : "border-[var(--warning)]/40 bg-[var(--warning-bg)] text-[var(--warning)]")}>{displayConnection}</Link>
        <div className="ml-auto flex items-center gap-2">
          <UpdatedAt at={overview.connection.lastSyncAt} />
          <button type="button" onClick={() => void refresh()} disabled={busy === "refresh"} className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-hairline)] px-3 text-[12px] font-semibold hover:bg-[var(--surface-raised)] disabled:opacity-60">
            {busy === "refresh" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Refresh
          </button>
          <button type="button" onClick={() => setNotificationsOpen(true)} aria-label={`Notifications${overview.notifications.unread ? `, ${overview.notifications.unread} unread` : ""}`} className="relative grid size-10 place-items-center rounded-[var(--radius-control)] border border-[var(--border-hairline)] hover:bg-[var(--surface-raised)]">
            <Bell className="size-4" />
            {overview.notifications.unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-[var(--danger)] px-1 text-[9px] font-bold text-white">{overview.notifications.unread}</span>}
          </button>
        </div>
      </div>

      {message && <p role="status" className="rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] px-3 py-2 text-[12px] text-[var(--text-muted)]">{message}</p>}
      {(!overview.connection.connected || overview.connection.expired || (expiresMinutes != null && expiresMinutes <= 60)) && (
        <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border px-4 py-3 text-[13px]", overview.connection.connected && !overview.connection.expired ? "border-[var(--warning)]/40 bg-[var(--warning-bg)] text-[var(--warning)]" : "border-[var(--danger)]/40 bg-[var(--danger-bg)] text-[var(--danger)]")}>
          <span>{overview.connection.connected && !overview.connection.expired ? `Reconnect · expires in ${expiresMinutes ?? 0}m` : "Meta Ads is not connected."}</span>
          <Link href="/meta-ads/settings" className="inline-flex min-h-9 items-center rounded-full border border-current px-3 text-[11px] font-bold uppercase tracking-[0.08em]">{overview.connection.connected ? "Reconnect Meta" : "Connect Meta Ads"}</Link>
        </div>
      )}

      <div className="sticky top-20 z-30 hidden rounded-[var(--radius-card)] border border-[var(--border-hairline)] bg-[var(--surface-panel)]/95 p-3 backdrop-blur-xl sm:block">
        <Filters value={filter} onChange={setFilter} stateOptions={CASES.map((item) => ({ slug: item.slug, stateName: item.stateName }))} />
      </div>
      <div className="flex items-center gap-2 sm:hidden">
        <button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-hairline)] px-3 text-[12px] font-semibold"><SlidersHorizontal className="size-3.5" /> Filters</button>
        <button type="button" onClick={() => void exportCsv()} disabled={busy === "export"} className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-hairline)] px-3 text-[12px] font-semibold"><Download className="size-3.5" /> Export</button>
      </div>
      <div className="hidden justify-end sm:flex">
        <button type="button" onClick={() => void exportCsv()} disabled={busy === "export"} className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-hairline)] px-3 text-[12px] font-semibold hover:bg-[var(--surface-raised)] disabled:opacity-60">{busy === "export" ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />} Export</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Spend" value={formatInr(totals.spend)} delta={delta(totals.spend, previous.spend) ?? undefined} hint="vs previous period" />
        <StatTile label="Impressions" value={formatCount(totals.impressions)} delta={delta(totals.impressions, previous.impressions) ?? undefined} hint="vs previous period" />
        <StatTile label="Reach" value={formatCount(totals.reach)} delta={delta(totals.reach, previous.reach) ?? undefined} hint={totals.reachIsUnique ? "unique, not summed" : "campaign range"} />
        <StatTile label="Clicks · CTR" value={`${formatCount(totals.clicks)} · ${formatPct(totals.ctr)}`} delta={delta(totals.clicks, previous.clicks) ?? undefined} hint="link clicks" />
        <StatTile label="CPM" value={formatInr(totals.cpm)} delta={delta(totals.cpm, previous.cpm) ?? undefined} hint="per 1,000 impressions" />
        <StatTile label="CPC" value={formatInr(totals.cpc)} delta={delta(totals.cpc, previous.cpc) ?? undefined} hint="per link click" />
        <StatTile label="Video plays · ThruPlays" value={`${formatCount(totals.videoPlays)} · ${formatCount(totals.thruPlays)}`} delta={delta(totals.thruPlays, previous.thruPlays) ?? undefined} hint="starts · 15s / complete" />
        <StatTile label="Active campaigns" value={totals.activeCampaigns} hint="currently active" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <div className="p-4"><p className="type-micro text-[var(--text-muted)]">By state and party</p><h2 className="type-h3 mt-1">Spend and delivery</h2></div>
          {stateGroups.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left text-[12px]">
                <thead className="bg-[var(--surface-raised)] text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  <tr><th className="px-3 py-2">Party</th><th className="num-right px-3 py-2">Spend</th><th className="num-right px-3 py-2">Impr.</th><th className="num-right px-3 py-2">Reach</th><th className="num-right px-3 py-2">CTR</th><th className="num-right px-3 py-2">ThruPlays</th></tr>
                </thead>
                <tbody>
                  {stateGroups.flatMap((state) => [
                    <tr key={`state:${state.state}`} className="border-t border-[var(--border-hairline)] bg-[var(--surface-raised)]/60"><td colSpan={6} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{state.stateLabel}</td></tr>,
                    ...state.rows.map((group) => (
                      <tr key={`${state.state}:${group.party}`} className="border-t border-[var(--border-hairline)]/60">
                        <td className="px-3 py-2"><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: group.color }} />{group.partyLabel}</span></td>
                        <td className="num-right px-3 py-2">{formatInr(group.spend)}</td>
                        <td className="num-right px-3 py-2">{formatCount(group.impressions)}</td>
                        <td className="num-right px-3 py-2">{formatCount(group.reach)}</td>
                        <td className="num-right px-3 py-2">{formatPct(group.ctr)}</td>
                        <td className="num-right px-3 py-2">{formatCount(group.thruPlays)}</td>
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
          ) : <div className="p-4"><EmptyState title="No tagged campaigns for this filter." /></div>}
        </Card>

        <Card className="p-4">
          <p className="type-micro text-[var(--text-muted)]">Accounts and payments</p>
          <h2 className="type-h3 mt-1">Payment health</h2>
          <div className="mt-3 space-y-3">
            {overview.accounts.length ? overview.accounts.map((account) => {
              const status = accountTone(account);
              const progress = account.spendCap ? Math.min(100, Math.round(((account.amountSpent ?? 0) / account.spendCap) * 100)) : null;
              return (
                <div key={account.id} className="rounded-[var(--radius-card)] border border-[var(--border-hairline)] p-3">
                  <div className="flex items-start justify-between gap-2"><p className="font-semibold">{account.name}</p><Badge tone={status.tone}>{status.label}</Badge></div>
                  <p className="mt-2 text-[11.5px] text-[var(--text-muted)]">Spent {formatInr(account.amountSpent)} of {formatInr(account.spendCap)} cap</p>
                  {progress != null && <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface-raised)]"><div className={cn("h-full rounded-full", progress >= 90 ? "bg-[var(--warning)]" : "bg-[var(--accent-brass)]")} style={{ width: `${progress}%` }} /></div>}
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">Balance {formatInr(account.balance)}</p>
                </div>
              );
            }) : <EmptyState title="No ad accounts have synced yet." />}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4"><p className="type-micro text-[var(--text-muted)]">Daily delivery</p><h2 className="type-h3 mt-1">Spend vs impressions</h2>{overview.daily.length ? <EChart option={dailyOption} height={220} reduced={reduced} ariaLabel="Daily spend and impressions" /> : <EmptyState title="No daily delivery data for this range." className="mt-3" />}</Card>
        <Card className="p-4"><p className="type-micro text-[var(--text-muted)]">Platform split</p><h2 className="type-h3 mt-1">Facebook vs Instagram</h2>{overview.platforms.length ? <EChart option={platformOption} height={220} reduced={reduced} ariaLabel="Spend by platform" /> : <EmptyState title="No platform delivery data for this range." className="mt-3" />}</Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4"><div><p className="type-micro text-[var(--text-muted)]">Campaigns</p><h2 className="type-h3 mt-1">State › party › campaign › ad set › ad</h2></div><span className="text-[11px] text-[var(--text-muted)]">Click an ad for the creative</span></div>
        {campaignGroups.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-[12px]">
              <thead className="bg-[var(--surface-raised)] text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]"><tr><th className="px-3 py-2">Campaign</th><th className="px-3 py-2">Status</th><th className="num-right px-3 py-2">Spend</th><th className="num-right px-3 py-2">Impr.</th><th className="num-right px-3 py-2">CTR</th><th className="num-right px-3 py-2">ThruPlays</th></tr></thead>
              <tbody>
                {campaignGroups.flatMap((state) => {
                  const stateKey = `state:${state.state}`;
                  const stateRows = [<ExplorerRow key={stateKey} level={0} label={state.stateLabel} status={null} metrics={NO_METRICS} expandable expanded={expanded.has(stateKey)} onToggle={() => toggle(stateKey)} />];
                  if (!expanded.has(stateKey)) return stateRows;
                  for (const party of [...state.parties.values()].sort((a, b) => a.party === "unassigned" ? 1 : b.party === "unassigned" ? -1 : a.partyLabel.localeCompare(b.partyLabel))) {
                    const partyKey = `party:${state.state}:${party.party}`;
                    stateRows.push(<ExplorerRow key={`${stateKey}:${party.party}`} level={1} label={party.partyLabel} status={null} metrics={NO_METRICS} expandable expanded={expanded.has(partyKey)} onToggle={() => toggle(partyKey)} color={party.color} />);
                    if (!expanded.has(partyKey)) continue;
                    for (const campaign of party.campaigns) {
                      const campaignKey = `campaign:${campaign.id}`;
                      stateRows.push(<ExplorerRow key={`${partyKey}:${campaign.id}`} level={2} label={campaign.name} status={campaign.status} metrics={campaign.metrics} expandable expanded={expanded.has(campaignKey)} onToggle={() => toggle(campaignKey)} />);
                      if (!expanded.has(campaignKey)) continue;
                      for (const adset of campaign.adsets) {
                        const adsetKey = `adset:${adset.id}`;
                        stateRows.push(<ExplorerRow key={`${campaignKey}:${adset.id}`} level={3} label={adset.name} status={adset.status} metrics={adset.metrics} expandable expanded={expanded.has(adsetKey)} onToggle={() => toggle(adsetKey)} />);
                        if (!expanded.has(adsetKey)) continue;
                        for (const ad of adset.ads) {
                          stateRows.push(<ExplorerRow key={`${adsetKey}:${ad.id}`} level={4} label={ad.name} status={ad.status} metrics={ad.metrics} expandable={false} expanded={false} onToggle={() => {}} onClick={() => setSelectedAd(ad)} />);
                        }
                      }
                    }
                  }
                  return stateRows;
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="p-4"><EmptyState title="No campaigns have synced yet." /></div>}
      </Card>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <Filters value={filter} onChange={(next) => { setFilter(next); setFiltersOpen(false); }} stateOptions={CASES.map((item) => ({ slug: item.slug, stateName: item.stateName }))} />
      </Sheet>

      <Dialog open={notificationsOpen} onClose={() => setNotificationsOpen(false)} title="Notifications" description="Status, payment and delivery alerts" footer={<button type="button" onClick={() => void markAllRead()} className="min-h-10 rounded-[var(--radius-control)] bg-[var(--accent-brass)] px-4 text-[12px] font-semibold text-white">Mark all read</button>}>
        {overview.notifications.rows.length ? (
          <ul className="space-y-2">{overview.notifications.rows.map((row) => <li key={row.id} className="rounded-[var(--radius-control)] border border-[var(--border-hairline)] p-3"><div className="flex items-center justify-between gap-2"><p className="text-[12.5px] font-semibold">{row.title}</p><Badge tone={row.severity === "danger" ? "danger" : row.severity === "warning" ? "warning" : "neutral"}>{row.kind.replaceAll("_", " ")}</Badge></div><p className="mt-1 text-[11.5px] text-[var(--text-muted)]">{row.body}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{new Date(row.createdAt).toLocaleString()}</p></li>)}</ul>
        ) : <EmptyState title="No unread notifications." />}
      </Dialog>

      <CreativeDialog ad={selectedAd} onClose={() => setSelectedAd(null)} />
    </div>
  );
}
