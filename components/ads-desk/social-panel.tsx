"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AdsSocialCampaign, AdsSocialView } from "@/lib/ads-desk/client-dto";
import { Download } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import OpenMenu from "@/components/ads-desk/open-menu";
import { exactNumber, indianUnits, percent, rate } from "@/lib/ads-desk/format";
import { cn } from "@/lib/utils";

const number = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
const money = (value: number) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value)}`;
const REACH_CAVEAT = "Reach is summed per campaign; one person can count more than once.";

type Metric = "impressions" | "reach" | "engagements";

type AccountRow = {
  name: string; campaigns: AdsSocialView["accounts"][number]["campaigns"];
  href?: string | null; billingHref?: string | null; allAdsetsHref?: string | null; allAdsHref?: string | null;
  campaignCount: number; impressions: number; reach: number; engagements: number; clicks: number; spend: number; results: number;
};

function statusTone(delivery: string): string {
  if (delivery === "Delivering" || delivery === "Started today") return "live";
  return "soon";
}

function StatCard({ label, value, note, exact, tooltip }: { label: string; value: number | string; note?: string; exact?: string; tooltip?: string }) {
  const display = typeof value === "number" ? indianUnits(value) : value;
  return (
    <div className="report-stat" title={tooltip ?? exact ?? (typeof value === "number" ? exactNumber(value) : undefined)}>
      <p className="report-stat-label">{label}</p>
      <p className="report-stat-value">{display}</p>
      {typeof value === "number" && <span className="sr-only">Exact value: {exactNumber(value)}</span>}
      {note && <p className="report-stat-note good">{note}</p>}
    </div>
  );
}

export default function SocialPanel({ regions, compact = false }: { regions: AdsSocialView[]; compact?: boolean }) {
  const [active, setActive] = useState(0);
  const [metric, setMetric] = useState<Metric>("impressions");
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: keyof AccountRow; asc: boolean }>({ key: "impressions", asc: false });
  const [openAccount, setOpenAccount] = useState<AccountRow | null>(null);
  const [allCampaigns, setAllCampaigns] = useState(false);
  const [remoteCampaigns, setRemoteCampaigns] = useState<AdsSocialCampaign[]>([]);
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [remotePage, setRemotePage] = useState(1);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignError, setCampaignError] = useState("");
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(320);

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
      const campaigns = account.campaigns;
      const impressions = account.impressions ?? campaigns.reduce((sum, item) => sum + item.impressions, 0);
      const reach = account.reach ?? campaigns.reduce((sum, item) => sum + item.reach, 0);
      const engagements = account.engagements ?? campaigns.reduce((sum, item) => sum + item.engagements, 0);
      const clicks = account.clicks ?? campaigns.reduce((sum, item) => sum + item.clicks, 0);
      const spend = account.spend ?? campaigns.reduce((sum, item) => sum + (item.spend ?? 0), 0);
      const results = account.results ?? campaigns.reduce((sum, item) => sum + (item.results ?? 0), 0);
      return {
        name: account.name, campaigns, href: account.href, billingHref: account.billingHref,
        allAdsetsHref: account.allAdsetsHref, allAdsHref: account.allAdsHref,
        campaignCount: account.campaignCount ?? campaigns.length, impressions, reach, engagements, clicks, spend, results,
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
  const visibleRows = [...filteredRows].sort((a, b) => {
    const left = a[sort.key], right = b[sort.key];
    if (typeof left === "number" && typeof right === "number") return sort.asc ? left - right : right - left;
    return sort.asc ? String(left).localeCompare(String(right)) : String(right).localeCompare(String(left));
  });
  const tableRows = expanded ? visibleRows : visibleRows.slice(0, 10);
  const chartRows = [...rows].sort((a, b) => b[metric] - a[metric]).slice(0, 10);
  const chartMax = Math.max(1, ...chartRows.map((row) => row[metric]));
  const labelWidth = Math.min(chartWidth * 0.4, Math.max(96, chartWidth * 0.3));

  function downloadCsv() {
    if (!owner) return;
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

  async function loadCampaigns(account: AccountRow, page: number) {
    if (!region.key || account.campaigns.length) return;
    setLoadingCampaigns(true);
    setCampaignError("");
    try {
      const response = await fetch(`/api/ads/campaigns?region=${encodeURIComponent(region.key)}&account=${encodeURIComponent(account.name)}&page=${page}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setCampaignError(typeof payload.error === "string" ? payload.error : "Could not load campaigns."); return; }
      setRemoteCampaigns((previous) => page === 1 ? payload.campaigns : [...previous, ...payload.campaigns]);
      setRemoteTotal(Number(payload.total ?? 0));
      setRemotePage(page);
    } catch { setCampaignError("Could not load campaigns."); }
    finally { setLoadingCampaigns(false); }
  }

  function openAccountDrawer(row: AccountRow) {
    setOpenAccount(row); setAllCampaigns(false); setRemoteCampaigns([]); setRemoteTotal(0); setRemotePage(1);
    void loadCampaigns(row, 1);
  }

  const campaignRows = openAccount
    ? (openAccount.campaigns.length ? [...openAccount.campaigns] : remoteCampaigns).sort((a, b) => b.impressions - a.impressions)
    : [];
  const shownCampaigns = openAccount?.campaigns.length && !allCampaigns ? campaignRows.slice(0, 20) : campaignRows;
  const hasMoreCampaigns = openAccount
    ? (openAccount.campaigns.length ? campaignRows.length > 20 : remoteCampaigns.length < remoteTotal)
    : false;

  return (
    <section className={cn("social-panel report-card", compact && "social-compact")} aria-label="Social media" style={{ borderLeft: `3px solid ${region.band}` }}>
      <div className="social-inner p-4">
      <div className="social-head">
        <div className="min-w-0">
          <h2 className="social-title">{region.label}</h2>
          <p className="social-sub">{region.range}</p>
          <p className="social-sub">Meta ads delivery · data as of {region.asOf}</p>
        </div>
        {owner && <button type="button" onClick={downloadCsv} className="report-btn-secondary social-download"><Download className="size-3.5" /> Download CSV</button>}
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
          {chartRows.map((row) => (
            <div key={row.name} className="social-chart-row" style={{ "--social-label": `${labelWidth}px` } as React.CSSProperties}>
              <span className="social-chart-label" title={row.name}>{row.name}</span>
              <span className="social-chart-track"><span className="social-chart-bar" style={{ width: `${Math.max(1, (row[metric] / chartMax) * 100)}%` }} title={`${exactNumber(row[metric])} ${metric}`} /></span>
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
          <li key={row.name} className="social-list-row">
            <button type="button" onClick={() => openAccountDrawer(row)} className="social-list-name" title={row.name}>{row.name}</button>
            <p className="social-list-metrics">
              <span>{number(row.campaignCount)} campaigns</span>
              <span>{indianUnits(row.impressions)} impressions</span>
              <span>{percent(rate(row.impressions, totalImpressions))} share</span>
              {owner && <span>{money(row.spend)}</span>}
            </p>
          </li>
        ))}
      </ul>

      <div className="social-table-wrap">
        <table className="social-table">
          <thead><tr><th>Account</th><th className="right">Campaigns</th><th className="right">Impressions</th><th className="right">Share</th><th className="right social-col-wide">CTR</th><th className="right social-col-wide">Engagement rate</th>{owner && <><th className="right social-col-wide">Spend</th><th className="right social-col-wide">CPM</th><th className="right social-col-wide">Open</th></>}</tr></thead>
          <tbody>
            {tableRows.map((row) => (
              <tr key={row.name}>
                <td><button type="button" onClick={() => openAccountDrawer(row)} className="social-account-link" title={row.name}>{row.name}</button></td>
                <td className="right tabular-nums">{number(row.campaignCount)}</td>
                <td className="right tabular-nums" title={exactNumber(row.impressions)}>{indianUnits(row.impressions)}</td>
                <td className="right tabular-nums">{percent(rate(row.impressions, totalImpressions))}</td>
                <td className="right tabular-nums social-col-wide">{percent(rate(row.clicks, row.impressions))}</td>
                <td className="right tabular-nums social-col-wide">{percent(rate(row.engagements, row.impressions))}</td>
                {owner && <><td className="right tabular-nums social-col-wide" title={money(row.spend)}>{indianUnits(row.spend)}</td><td className="right tabular-nums social-col-wide">{row.impressions > 0 ? money(row.spend / row.impressions * 1000) : "-"}</td><td className="right social-col-wide"><OpenMenu links={[{ href: row.href, label: "Ads Manager" }, { href: row.billingHref, label: "Billing" }, { href: row.allAdsetsHref, label: "All ad sets" }, { href: row.allAdsHref, label: "All ads" }]} /></td></>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(openAccount)} onClose={() => setOpenAccount(null)} title={openAccount?.name ?? "Account"} description={openAccount ? `${number(openAccount.campaignCount)} campaigns` : undefined} placement="right" className="max-w-none sm:max-w-[480px]">
        {openAccount && (
          <>
            {owner && <div className="mb-3 flex flex-wrap gap-2 border-b border-[var(--r-line)] pb-3"><OpenMenu links={[{ href: openAccount.href, label: "Ads Manager" }, { href: openAccount.billingHref, label: "Billing" }, { href: openAccount.allAdsetsHref, label: "All ad sets" }, { href: openAccount.allAdsHref, label: "All ads" }]} /></div>}
            <div className="overflow-x-auto rounded-[10px] border border-[var(--r-line)]">
              <table className="w-full min-w-[620px] text-left text-[11.5px]">
                <thead><tr>{["Campaign", "Status", "Start", "End", "Impressions", "Reach", "Clicks", "Results"].map((label) => <th key={label} className={cn("px-2 py-2", !["Campaign", "Status", "Start", "End", "Results"].includes(label) && "text-right")}>{label}</th>)}{owner && <><th className="px-2 py-2 text-right">Spend</th><th className="px-2 py-2 text-right">Cost/result</th><th className="px-2 py-2 text-right">Open</th></>}</tr></thead>
                <tbody>
                  {shownCampaigns.map((campaign) => (
                    <tr key={campaign.name}>
                      <td className="px-2 py-2">{campaign.name}</td>
                      <td className="px-2 py-2"><span className={`report-pill ${statusTone(campaign.delivery)}`}>{campaign.delivery}</span></td>
                      <td className="px-2 py-2">{campaign.start || "-"}</td>
                      <td className="px-2 py-2">{campaign.end || "-"}</td>
                      <td className="px-2 py-2 text-right tabular-nums" title={exactNumber(campaign.impressions)}>{indianUnits(campaign.impressions)}</td>
                      <td className="px-2 py-2 text-right tabular-nums" title={exactNumber(campaign.reach)}>{indianUnits(campaign.reach)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{number(campaign.clicks)}</td>
                      <td className="px-2 py-2">{campaign.results == null ? "-" : `${number(campaign.results)} ${campaign.resultLabel ?? ""}`}</td>
                      {owner && <><td className="px-2 py-2 text-right tabular-nums">{campaign.spend == null ? "-" : money(campaign.spend)}</td><td className="px-2 py-2 text-right tabular-nums">{campaign.costPerResult == null ? "-" : money(campaign.costPerResult)}</td><td className="px-2 py-2 text-right"><OpenMenu links={[{ href: campaign.href, label: "Campaign in Ads Manager" }, { href: campaign.adsetsHref, label: "Ad sets" }, { href: campaign.adsHref, label: "Ads" }]} /></td></>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {campaignError && <p role="alert" className="mt-2 text-[11.5px] text-[var(--r-coral)]">{campaignError}</p>}
            {loadingCampaigns && <p className="mt-2 text-[11.5px] text-[var(--r-muted)]">Loading campaigns...</p>}
            {hasMoreCampaigns && <button type="button" onClick={() => { if (openAccount?.campaigns.length) setAllCampaigns((value) => !value); else if (openAccount) void loadCampaigns(openAccount, remotePage + 1); }} className="mt-3 rounded-md border border-[var(--r-line)] px-2 py-1 text-[11.5px] font-semibold text-[var(--r-navy)]">{openAccount?.campaigns.length && allCampaigns ? "Show top 20" : `Show all ${number(openAccount?.campaigns.length ? campaignRows.length : remoteTotal)} campaigns`}</button>}
            {openAccount?.campaigns.length === 0 && remoteCampaigns.length > 0 && remoteCampaigns.length >= remoteTotal && <p className="mt-2 text-[10.5px] text-[var(--r-muted)]">{number(remoteTotal)} campaigns loaded.</p>}
          </>
        )}
      </Dialog>
      </div>
    </section>
  );
}
