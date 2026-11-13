"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdsSocialCampaign, AdsSocialView } from "@/lib/ads-desk/client-dto";
import { ArrowUpRight, Check, ChevronRight, Download, Search } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import OpenMenu from "@/components/ads-desk/open-menu";
import { exactNumber, indianUnits, percent, rate } from "@/lib/ads-desk/format";
import { cn } from "@/lib/utils";

const number = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
const money = (value: number) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value)}`;
const compactMoney = (value: number) => `₹${indianUnits(value)}`;
const REACH_CAVEAT = "Reach is summed per campaign; one person can count more than once.";

type Metric = "impressions" | "reach" | "engagements";
type CampaignSort = "impressions" | "reach" | "clicks" | "results";

type AccountRow = {
  name: string; campaigns: AdsSocialView["accounts"][number]["campaigns"];
  href?: string | null; billingHref?: string | null; allAdsetsHref?: string | null; allAdsHref?: string | null;
  campaignCount: number; impressions: number; reach: number; engagements: number; clicks: number; spend: number; results: number;
};

type CampaignCache = { campaigns: AdsSocialCampaign[]; total: number; page: number; hasMore: boolean };

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started.current) return;
      started.current = true;
      observer.disconnect();
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setDisplay(value); return; }
      const from = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - from) / 400);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(value * eased));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.4 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);

  return <span ref={ref}>{indianUnits(display)}</span>;
}

function StatCard({ label, value, note, exact, tooltip }: { label: string; value: number | string; note?: string; exact?: string; tooltip?: string }) {
  return (
    <div className="report-stat" title={tooltip ?? exact ?? (typeof value === "number" ? exactNumber(value) : undefined)}>
      <p className="report-stat-label">{label}</p>
      <p className="report-stat-value">{typeof value === "number" ? <AnimatedNumber value={value} /> : value}</p>
      {typeof value === "number" && <span className="sr-only">Exact value: {exactNumber(value)}</span>}
      {note && <p className="report-stat-note good">{note}</p>}
    </div>
  );
}

function MetricText({ value, label }: { value: number; label: string }) {
  return <span className="tabular-nums whitespace-nowrap" title={exactNumber(value)}>{indianUnits(value)} {label}</span>;
}

export default function SocialPanel({ regions, compact = false }: { regions: AdsSocialView[]; compact?: boolean }) {
  const [active, setActive] = useState(0);
  const [metric, setMetric] = useState<Metric>("impressions");
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: keyof AccountRow; asc: boolean }>({ key: "impressions", asc: false });
  const [openAccount, setOpenAccount] = useState<AccountRow | null>(null);
  const [campaigns, setCampaigns] = useState<AdsSocialCampaign[]>([]);
  const [campaignTotal, setCampaignTotal] = useState(0);
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignHasMore, setCampaignHasMore] = useState(false);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignError, setCampaignError] = useState("");
  const [campaignQuery, setCampaignQuery] = useState("");
  const [campaignSort, setCampaignSort] = useState<CampaignSort>("impressions");
  const [retryKey, setRetryKey] = useState(0);
  const [chartGrown, setChartGrown] = useState(false);
  const [chartStagger, setChartStagger] = useState(true);
  const [downloaded, setDownloaded] = useState(false);
  const downloadTimer = useRef(0);
  const cache = useRef(new Map<string, CampaignCache>());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(320);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setChartGrown(true));
    const timer = window.setTimeout(() => setChartStagger(false), 700);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, []);

  useEffect(() => {
    const node = chartRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setChartWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const region = regions[Math.min(active, regions.length - 1)];
  const rows = useMemo(() => {
    if (!region) return [];
    return region.accounts.map((account) => {
      const campaignsList = account.campaigns;
      const impressions = account.impressions ?? campaignsList.reduce((sum, item) => sum + item.impressions, 0);
      const reach = account.reach ?? campaignsList.reduce((sum, item) => sum + item.reach, 0);
      const engagements = account.engagements ?? campaignsList.reduce((sum, item) => sum + item.engagements, 0);
      const clicks = account.clicks ?? campaignsList.reduce((sum, item) => sum + item.clicks, 0);
      const spend = account.spend ?? campaignsList.reduce((sum, item) => sum + (item.spend ?? 0), 0);
      const results = account.results ?? campaignsList.reduce((sum, item) => sum + (item.results ?? 0), 0);
      return {
        name: account.name, campaigns: campaignsList, href: account.href, billingHref: account.billingHref,
        allAdsetsHref: account.allAdsetsHref, allAdsHref: account.allAdsHref,
        campaignCount: account.campaignCount ?? campaignsList.length, impressions, reach, engagements, clicks, spend, results,
      };
    });
  }, [region]);

  if (!regions.length || !region) return <section className="social-panel report-card p-4 text-[13px] text-[var(--r-muted)]">Social data not uploaded yet.</section>;

  const owner = region.totals.spend != null;
  const totalImpressions = region.totals.impressions;
  const ctr = rate(region.totals.clicks, totalImpressions);
  const engagementRate = rate(region.totals.engagements, totalImpressions);
  const cpm = region.totals.spend != null && totalImpressions > 0 ? (region.totals.spend / totalImpressions) * 1000 : 0;
  const totalAccounts = rows.length;

  const filteredRows = expanded && query.trim() ? rows.filter((row) => row.name.toLowerCase().includes(query.trim().toLowerCase())) : rows;
  const visibleRows = useMemo(() => [...filteredRows].sort((a, b) => {
    const left = a[sort.key], right = b[sort.key];
    if (typeof left === "number" && typeof right === "number") return sort.asc ? left - right : right - left;
    return sort.asc ? String(left).localeCompare(String(right)) : String(right).localeCompare(String(left));
  }), [filteredRows, sort]);
  const tableRows = expanded ? visibleRows : visibleRows.slice(0, 10);
  const chartRows = useMemo(() => [...rows].sort((a, b) => b[metric] - a[metric]).slice(0, 10), [rows, metric]);
  const chartMax = Math.max(1, ...chartRows.map((row) => row[metric]));
  const labelWidth = Math.min(chartWidth * 0.4, Math.max(96, chartWidth * 0.3));

  function downloadCsv() {
    if (!owner) return;
    setDownloaded(true);
    window.clearTimeout(downloadTimer.current);
    downloadTimer.current = window.setTimeout(() => setDownloaded(false), 1200);
    const header = ["Account", "Campaigns", "Impressions", "Share", "CTR", "Engagement rate", "Spend", "CPM"];
    const body = rows.map((row) => [
      row.name, String(row.campaignCount), String(row.impressions),
      percent(rate(row.impressions, totalImpressions)), percent(rate(row.clicks, row.impressions)),
      percent(rate(row.engagements, row.impressions)), String(row.spend.toFixed(2)),
      row.impressions > 0 ? (row.spend / row.impressions * 1000).toFixed(2) : "0",
    ]);
    const csv = [header, ...body].map((line) => line.map((cell) => /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `social-${region.label.replace(/\s+/g, "-").toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const fetchPage = useCallback(async (account: AccountRow, page: number, q: string, sortKey: CampaignSort, replace: boolean) => {
    if (!region.key) return;
    setCampaignLoading(true);
    setCampaignError("");
    try {
      const params = new URLSearchParams({ region: region.key, account: account.name, page: String(page), pageSize: "25", sort: sortKey });
      if (q.trim()) params.set("q", q.trim());
      const response = await fetch(`/api/ads/campaigns?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCampaignError(typeof payload.error === "string" ? payload.error : "Could not load campaigns.");
        return;
      }
      const next = replace ? payload.campaigns as AdsSocialCampaign[] : [...(replace ? [] : campaigns), ...(payload.campaigns as AdsSocialCampaign[])];
      setCampaigns(next);
      setCampaignTotal(Number(payload.total ?? 0));
      setCampaignPage(page);
      setCampaignHasMore(Boolean(payload.hasMore));
      cache.current.set(`${account.name}|${q.trim()}|${sortKey}`, { campaigns: next, total: Number(payload.total ?? 0), page, hasMore: Boolean(payload.hasMore) });
    } catch {
      setCampaignError("Could not load campaigns.");
    } finally {
      setCampaignLoading(false);
    }
  }, [campaigns, region.key]);

  function openDrawer(row: AccountRow, trigger?: HTMLElement | null) {
    if (trigger) {
      if (trigger.tagName === "TR") trigger.tabIndex = -1;
      trigger.focus();
    }
    setOpenAccount(row);
    setCampaignQuery("");
    setCampaignSort("impressions");
    setCampaigns([]);
    setCampaignTotal(0);
    setCampaignPage(1);
    setCampaignHasMore(false);
    setCampaignError("");
  }

  useEffect(() => {
    if (!openAccount) return;
    const key = `${openAccount.name}|${campaignQuery.trim()}|${campaignSort}`;
    const cached = cache.current.get(key);
    if (cached) {
      setCampaigns(cached.campaigns);
      setCampaignTotal(cached.total);
      setCampaignPage(cached.page);
      setCampaignHasMore(cached.hasMore);
      setCampaignError("");
      return;
    }
    const timer = window.setTimeout(() => void fetchPage(openAccount, 1, campaignQuery, campaignSort, true), campaignQuery.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [openAccount, campaignQuery, campaignSort, retryKey, fetchPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !openAccount || !campaignHasMore || campaignLoading) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void fetchPage(openAccount, campaignPage + 1, campaignQuery, campaignSort, false);
    }, { rootMargin: "160px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [openAccount, campaignHasMore, campaignLoading, campaignPage, campaignQuery, campaignSort, fetchPage]);

  const accountLink = (row: AccountRow, className: string) => row.href
    ? <a href={row.href} target="_blank" rel="noopener noreferrer" className={className} title={row.name}>{row.name}<ArrowUpRight className="ml-0.5 inline size-3" aria-hidden /></a>
    : <span className={className} title={row.name}>{row.name}</span>;

  const campaignsHref = (row: AccountRow) => row.href ?? row.allAdsetsHref ?? null;

  return (
    <section className={cn("social-panel report-card", compact && "social-compact")} aria-label="Social media" style={{ borderLeft: `3px solid ${region.band}` }}>
      <div className="social-inner p-4">
        <div className="social-head">
          <div className="min-w-0">
            <h2 className="social-title">{region.label}</h2>
            <p className="social-sub">{region.range}</p>
            <p className="social-sub">Meta ads delivery · data as of {region.asOf}</p>
          </div>
          {owner && <button type="button" onClick={downloadCsv} className="report-btn-secondary social-download">{downloaded ? <Check className="size-3.5" /> : <Download className="size-3.5" />} {downloaded ? "Downloaded" : "Download CSV"}</button>}
        </div>

        {regions.length > 1 && (
          <div className="report-tabs" role="tablist" aria-label="Regions">
            {regions.map((item, index) => (
              <button key={item.label} type="button" role="tab" aria-selected={active === index} onClick={() => { setActive(index); setExpanded(false); setQuery(""); }} className="report-tab">
                <span className="mr-1 inline-block size-2 rounded-full align-middle" style={{ background: item.band }} />{item.label}
              </button>
            ))}
          </div>
        )}

        <div className="social-stats mt-4">
          <StatCard label="Reach" value={region.totals.reach} note={`${number(region.totals.campaigns)} campaigns · ${number(region.totals.accounts)} accounts`} tooltip={REACH_CAVEAT} />
          <StatCard label="Impressions" value={region.totals.impressions} note={`CTR ${percent(ctr)}`} />
          <StatCard label={region.viewsLabel ?? "Views"} value={region.totals.views} note="Video views in the report" />
          <StatCard label="Engagement rate" value={percent(engagementRate)} note={`${indianUnits(region.totals.engagements)} engagements`} exact={percent(engagementRate)} />
          {owner && <StatCard label="Spend" value={region.totals.spend ?? 0} note={`CPM ${money(cpm)}`} />}
        </div>
        <p className="social-caveat">{REACH_CAVEAT}</p>

        <div className="social-chart report-card mt-4 p-3" ref={chartRef}>
          <div className="social-chart-head">
            <h3 className="social-chart-title">Top accounts</h3>
            <div className="social-toggle" role="group" aria-label="Chart metric">
              {(["impressions", "reach", "engagements"] as Metric[]).map((item) => (
                <button key={item} type="button" onClick={() => setMetric(item)} aria-pressed={metric === item} className={cn("social-toggle-button", metric === item && "on")}>{item === "engagements" ? "Engagement" : item[0].toUpperCase() + item.slice(1)}</button>
              ))}
            </div>
          </div>
          <div className="social-chart-body mt-3">
            {chartRows.map((row, index) => (
              <div key={row.name} className="social-chart-row" style={{ "--social-label": `${labelWidth}px` } as React.CSSProperties}>
                <span className="social-chart-label" title={row.name}>{row.name}</span>
                <span className="social-chart-track"><span className="social-chart-bar" style={{ width: `${chartGrown ? Math.max(1, (row[metric] / chartMax) * 100) : 0}%`, transitionDelay: chartStagger ? `${Math.min(index, 9) * 30}ms` : "0ms" }} title={`${exactNumber(row[metric])} ${metric}`} /></span>
                <span className="social-chart-value">{indianUnits(row[metric])}</span>
              </div>
            ))}
          </div>
          <p className="social-chart-caption">Top 10 of {number(totalAccounts)} accounts by {metric}.</p>
        </div>

        <div className="social-accounts-head">
          <h3 className="social-accounts-title">Accounts</h3>
          <div className="social-accounts-actions">
            {expanded && <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search accounts" aria-label="Search accounts" className="social-search" />}
            {totalAccounts > 10 && <button type="button" onClick={() => setExpanded((value) => !value)} className="social-showall">{expanded ? "Show top 10" : `Show all ${number(totalAccounts)} accounts`}</button>}
          </div>
        </div>

        <ul className="social-list">
          {tableRows.map((row) => (
            <li key={row.name} className={cn("social-list-row", expanded && "row-enter")}>
              <div className="social-list-top">
                {accountLink(row, "social-list-name")}
                <button type="button" aria-label={`Campaigns for ${row.name}`} onClick={(event) => openDrawer(row, event.currentTarget)} className="social-chevron"><ChevronRight className="size-4" /></button>
              </div>
              <p className="social-list-metrics">
                <MetricText value={row.impressions} label="impressions" />
                <MetricText value={row.reach} label="reach" />
                <span>{percent(rate(row.impressions, totalImpressions))} share</span>
                {owner && <span>{money(row.spend)}</span>}
              </p>
            </li>
          ))}
        </ul>

        <div className="social-table-wrap">
          <table className="social-table">
            <thead><tr><th>Account</th><th className="right">Campaigns</th><th className="right">Impressions</th><th className="right">Share</th><th className="right social-col-wide">CTR</th><th className="right social-col-wide">Engagement rate</th>{owner && <><th className="right social-col-wide">Spend</th><th className="right social-col-wide">CPM</th></>}<th className="right"><span className="sr-only">Campaigns</span></th></tr></thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.name} className={cn("social-account-row", openAccount?.name === row.name && "is-open")} onClick={(event) => { if ((event.target as Element).closest("a,button")) return; openDrawer(row, event.currentTarget as HTMLElement); }}>
                  <td>{accountLink(row, "social-account-link")}</td>
                  <td className="right tabular-nums">{number(row.campaignCount)}</td>
                  <td className="right tabular-nums" title={exactNumber(row.impressions)}>{indianUnits(row.impressions)}</td>
                  <td className="right tabular-nums">{percent(rate(row.impressions, totalImpressions))}</td>
                  <td className="right tabular-nums social-col-wide">{percent(rate(row.clicks, row.impressions))}</td>
                  <td className="right tabular-nums social-col-wide">{percent(rate(row.engagements, row.impressions))}</td>
                  {owner && <><td className="right tabular-nums social-col-wide" title={money(row.spend)}>{indianUnits(row.spend)}</td><td className="right tabular-nums social-col-wide">{row.impressions > 0 ? money(row.spend / row.impressions * 1000) : "-"}</td></>}
                  <td className="right"><button type="button" aria-label={`Campaigns for ${row.name}`} onClick={(event) => { event.stopPropagation(); openDrawer(row, event.currentTarget); }} className="social-chevron"><ChevronRight className="size-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Dialog
          open={Boolean(openAccount)}
          onClose={() => setOpenAccount(null)}
          title={openAccount ? (openAccount.href ? <a href={openAccount.href} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">{openAccount.name}<ArrowUpRight className="ml-1 inline size-4" aria-hidden /></a> : openAccount.name) : "Account"}
          description={openAccount ? `${region.label} · ${number(openAccount.campaignCount)} campaigns` : undefined}
          headerExtra={openAccount && (openAccount.allAdsetsHref || openAccount.allAdsHref || (owner && openAccount.billingHref)) ? (
            <div className="flex flex-wrap gap-3 text-[11px] font-normal">
              {openAccount.allAdsetsHref && <a href={openAccount.allAdsetsHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-[var(--r-muted)] underline-offset-2 hover:underline">All ad sets<ArrowUpRight className="ml-0.5 inline size-3" aria-hidden /></a>}
              {openAccount.allAdsHref && <a href={openAccount.allAdsHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-[var(--r-muted)] underline-offset-2 hover:underline">All ads<ArrowUpRight className="ml-0.5 inline size-3" aria-hidden /></a>}
              {owner && openAccount.billingHref && <a href={openAccount.billingHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-[var(--r-muted)] underline-offset-2 hover:underline">Billing<ArrowUpRight className="ml-0.5 inline size-3" aria-hidden /></a>}
            </div>
          ) : undefined}
          placement="right"
          className="max-w-none sm:max-w-[720px]"
        >
          {openAccount && (
            <>
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="report-stat"><p className="report-stat-label">Impressions</p><p className="report-stat-value !text-[18px]">{indianUnits(openAccount.impressions)}</p></div>
                <div className="report-stat"><p className="report-stat-label">Reach</p><p className="report-stat-value !text-[18px]">{indianUnits(openAccount.reach)}</p></div>
                <div className="report-stat"><p className="report-stat-label">Clicks</p><p className="report-stat-value !text-[18px]">{indianUnits(openAccount.clicks)}</p></div>
                <div className="report-stat"><p className="report-stat-label">Results</p><p className="report-stat-value !text-[18px]">{indianUnits(openAccount.results)}</p></div>
                {owner && <div className="report-stat"><p className="report-stat-label">Spend</p><p className="report-stat-value !text-[18px]">{indianUnits(openAccount.spend)}</p></div>}
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Search campaigns</span>
                  <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[var(--r-muted)]" aria-hidden />
                  <input value={campaignQuery} onChange={(event) => setCampaignQuery(event.target.value)} placeholder="Search campaigns" className="min-h-10 w-full rounded-md border border-[var(--r-line)] bg-white pl-7 pr-2 text-[11.5px]" />
                </label>
                <select aria-label="Sort campaigns" value={campaignSort} onChange={(event) => setCampaignSort(event.target.value as CampaignSort)} className="min-h-10 rounded-md border border-[var(--r-line)] bg-white px-2 text-[11.5px]"><option value="impressions">Impressions</option><option value="reach">Reach</option><option value="clicks">Clicks</option><option value="results">Results</option></select>
              </div>
              {campaignLoading && campaigns.length === 0 && <div className="space-y-2">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-10 animate-pulse rounded bg-[var(--r-bg)]" />)}</div>}
              {campaignError && <div className="rounded-md border border-[var(--r-coral)]/40 bg-[#fdf0eb] p-3 text-[12px] text-[var(--r-coral)]"><p>{campaignError}</p><button type="button" onClick={() => { cache.current.delete(`${openAccount.name}|${campaignQuery.trim()}|${campaignSort}`); setRetryKey((value) => value + 1); }} className="mt-2 rounded border border-[var(--r-coral)]/40 px-2 py-1 text-[11px] font-semibold">Retry</button></div>}
              {!campaignLoading && !campaignError && campaigns.length === 0 && <div className="rounded-md border border-[var(--r-line)] p-6 text-center text-[12px] text-[var(--r-muted)]"><p>No campaigns match</p>{campaignQuery && <button type="button" onClick={() => setCampaignQuery("")} className="mt-2 text-[var(--r-navy)] underline">Clear search</button>}</div>}
              {campaigns.length > 0 && (
                <>
                  <div className="campaign-table-wrap">
                    <table className="campaign-table">
                      <thead><tr><th>Campaign</th><th className="right">Impressions</th><th className="right">Reach</th><th className="right">Clicks</th><th className="right">Results</th>{owner && <><th className="right">Spend</th><th className="right">Cost/result</th></>}</tr></thead>
                      <tbody>
                        {campaigns.map((campaign) => (
                          <tr key={campaign.name} className="row-enter">
                            <td>
                              <div className="min-w-0">
                                {campaign.href ? <a href={campaign.href} target="_blank" rel="noopener noreferrer" className="campaign-name" title={campaign.name}>{campaign.name}<ArrowUpRight className="ml-1 inline size-3" aria-hidden /></a> : <span className="campaign-name" title={campaign.name}>{campaign.name}</span>}
                                {(campaign.adsetsHref || campaign.adsHref) && <div className="mt-1 flex gap-2 text-[10px] text-[var(--r-muted)]">{campaign.adsetsHref && <a href={campaign.adsetsHref} target="_blank" rel="noopener noreferrer" className="hover:underline">Ad sets<ArrowUpRight className="ml-0.5 inline size-2.5" aria-hidden /></a>}{campaign.adsHref && <a href={campaign.adsHref} target="_blank" rel="noopener noreferrer" className="hover:underline">Ads<ArrowUpRight className="ml-0.5 inline size-2.5" aria-hidden /></a>}</div>}
                              </div>
                            </td>
                            <td className="right"><span className="num-nowrap" title={exactNumber(campaign.impressions)}>{indianUnits(campaign.impressions)}</span></td>
                            <td className="right"><span className="num-nowrap" title={exactNumber(campaign.reach)}>{indianUnits(campaign.reach)}</span></td>
                            <td className="right"><span className="num-nowrap" title={exactNumber(campaign.clicks)}>{indianUnits(campaign.clicks)}</span></td>
                            <td className="right"><span className="num-nowrap">{campaign.results == null ? "-" : indianUnits(campaign.results)}</span></td>
                            {owner && <><td className="right"><span className="num-nowrap" title={campaign.spend == null ? undefined : money(campaign.spend)}>{campaign.spend == null ? "-" : compactMoney(campaign.spend)}</span></td><td className="right"><span className="num-nowrap" title={campaign.costPerResult == null ? undefined : money(campaign.costPerResult)}>{campaign.costPerResult == null ? "-" : compactMoney(campaign.costPerResult)}</span></td></>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="campaign-cards">
                    {campaigns.map((campaign) => (
                      <article key={campaign.name} className="campaign-card row-enter">
                        <div className="flex items-start justify-between gap-2">
                          {campaign.href ? <a href={campaign.href} target="_blank" rel="noopener noreferrer" className="campaign-name" title={campaign.name}>{campaign.name}<ArrowUpRight className="ml-1 inline size-3" aria-hidden /></a> : <span className="campaign-name" title={campaign.name}>{campaign.name}</span>}
                        </div>
                        <p className="campaign-card-metrics"><MetricText value={campaign.impressions} label="Impr" /><MetricText value={campaign.reach} label="Reach" /><MetricText value={campaign.clicks} label="Clicks" /><MetricText value={campaign.results ?? 0} label="Results" />{owner && campaign.spend != null && <span>{money(campaign.spend)}</span>}</p>
                        {(campaign.adsetsHref || campaign.adsHref) && <div className="mt-1 flex gap-2 text-[10px] text-[var(--r-muted)]">{campaign.adsetsHref && <a href={campaign.adsetsHref} target="_blank" rel="noopener noreferrer" className="hover:underline">Ad sets<ArrowUpRight className="ml-0.5 inline size-2.5" aria-hidden /></a>}{campaign.adsHref && <a href={campaign.adsHref} target="_blank" rel="noopener noreferrer" className="hover:underline">Ads<ArrowUpRight className="ml-0.5 inline size-2.5" aria-hidden /></a>}</div>}
                      </article>
                    ))}
                  </div>
                  {campaignLoading && <p className="mt-3 text-[11px] text-[var(--r-muted)]">Loading more...</p>}
                  <div ref={sentinelRef} aria-hidden className="h-px" />
                  {campaignHasMore && <button type="button" onClick={() => void fetchPage(openAccount, campaignPage + 1, campaignQuery, campaignSort, false)} disabled={campaignLoading} className="mt-3 rounded-md border border-[var(--r-line)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--r-navy)] disabled:opacity-50">Load more</button>}
                  <p className="mt-2 text-[10px] text-[var(--r-muted)]">Showing {campaigns.length} of {campaignTotal} campaigns.</p>
                </>
              )}
            </>
          )}
        </Dialog>
      </div>
    </section>
  );
}
