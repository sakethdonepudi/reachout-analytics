"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, RefreshCw, Upload } from "lucide-react";
import { useReauth } from "@/components/auth/reauth-provider";
import type { AdsParse, AdsAccount } from "@/lib/ads-desk/parse";
import OpenMenu from "@/components/ads-desk/open-menu";
import { indianUnits } from "@/lib/ads-desk/format";
import { cn } from "@/lib/utils";

type Version = { _id: string; uploadedAt: string; uploadedBy?: string; sha256?: string; fileName: string; status: string; takenAt: string };
type Preview = { versionId: string; regions: { key: string; label: string; totals: AdsParse["regions"][number]["totals"] }[]; takenAt: string };

const money = (value: number) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value)}`;
const count = (value: number) => new Intl.NumberFormat("en-IN").format(value);

export default function AdsDesk({ data, versions, defaultRegion, unmapped = [], clientLinks = true }: { data: AdsParse | null; versions: Version[]; defaultRegion: string; unmapped?: string[]; clientLinks?: boolean }) {
  const router = useRouter();
  const { requestReauth } = useReauth();
  const [tab, setTab] = useState<string>(data && defaultRegion && data.regions.some((region) => region.key === defaultRegion) ? defaultRegion : data?.regions[0]?.key ?? "all");
  const [query, setQuery] = useState("");
  const [delivery, setDelivery] = useState("all");
  const [openAccount, setOpenAccount] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [linksToClients, setLinksToClients] = useState(clientLinks);
  const [savingLinks, setSavingLinks] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
  const [allQuery, setAllQuery] = useState("");

  const region = data?.regions.find((item) => item.key === tab) ?? null;
  const accounts = useMemo(() => {
    if (!region) return [];
    const needle = query.trim().toLowerCase();
    return region.accounts
      .map((account) => ({
        ...account,
        campaigns: account.campaigns.filter((campaign) => {
          if (delivery !== "all" && campaign.delivery !== delivery) return false;
          return !needle || campaign.name.toLowerCase().includes(needle) || account.name.toLowerCase().includes(needle);
        }),
      }))
      .filter((account) => account.campaigns.length > 0 || !needle);
  }, [region, query, delivery]);

  const allRows = useMemo(() => {
    if (!data) return [];
    return data.snap.accounts
      .filter((account) => !allQuery.trim() || account.name.toLowerCase().includes(allQuery.trim().toLowerCase()))
      .sort((a, b) => (b.stats[0] ?? 0) - (a.stats[0] ?? 0));
  }, [data, allQuery]);

  async function upload(file: File) {
    setBusy("upload"); setMessage("Uploading 0%"); setPreview(null); setProgress(0);
    const form = new FormData(); form.append("file", file);
    const csrf = document.cookie.split("; ").find((item) => item.startsWith("ro_csrf="))?.split("=")[1] ?? "";
    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/ads/upload");
      xhr.setRequestHeader("x-csrf-token", decodeURIComponent(csrf));
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const pct = Math.round((event.loaded / event.total) * 100);
        setProgress(pct); setMessage(`Uploading ${pct}%`);
      };
      xhr.onload = () => {
        setMessage("Parsing...");
        try {
          const payload = JSON.parse(xhr.responseText || "{}");
          if (xhr.status < 200 || xhr.status >= 300) { setMessage(payload.error ?? "Upload failed."); return; }
          setPreview({ versionId: payload.versionId, regions: payload.preview.regions, takenAt: payload.preview.takenAt });
          setMessage("Parsed successfully. Review the preview, then publish.");
        } catch { setMessage("Upload failed."); }
      };
      xhr.onerror = () => setMessage("Upload failed.");
      xhr.onloadend = () => { setBusy(""); setProgress(null); resolve(); };
      xhr.send(form);
    });
  }

  async function publish(versionId: string, retry = false) {
    setBusy(versionId); setMessage("");
    try {
      const response = await fetch("/api/ads/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ versionId }) });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 403 && payload.code === "reauth_required" && !retry) {
        if (await requestReauth()) return publish(versionId, true);
      }
      if (!response.ok) { setMessage(payload.error ?? "Publish failed."); return; }
      setMessage("Published."); router.refresh();
    } catch { setMessage("Publish failed."); } finally { setBusy(""); }
  }

  async function toggleClientLinks(retry = false) {
    const next = !linksToClients;
    setSavingLinks(true); setMessage("");
    try {
      const response = await fetch("/api/ads/client-links", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientLinks: next }) });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 403 && payload.code === "reauth_required" && !retry) {
        if (await requestReauth()) return toggleClientLinks(true);
      }
      if (!response.ok) { setMessage(payload.error ?? "Could not update the client link setting."); return; }
      setLinksToClients(Boolean(payload.clientLinks));
      setMessage(`Ads Manager links for clients are ${payload.clientLinks ? "on" : "off"}.`);
      router.refresh();
    } catch { setMessage("Could not update the client link setting."); }
    finally { setSavingLinks(false); }
  }

  async function rebuildSummaries(retry = false) {
    setRebuilding(true); setMessage("");
    try {
      const response = await fetch("/api/ads/summaries", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 403 && payload.code === "reauth_required" && !retry) {
        if (await requestReauth()) return rebuildSummaries(true);
      }
      if (!response.ok) { setMessage(payload.error ?? "Could not rebuild summaries."); return; }
      setMessage(`Rebuilt summaries for ${payload.regions ?? 0} regions.`);
      router.refresh();
    } catch { setMessage("Could not rebuild summaries."); }
    finally { setRebuilding(false); }
  }

  async function rollback(versionId: string) {
    if (!window.confirm("Make this version active?")) return;
    setBusy(versionId);
    const response = await fetch("/api/ads/rollback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ versionId }) });
    const payload = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) { setMessage(payload.error ?? "Rollback failed."); return; }
    setMessage("Rolled back."); router.refresh();
  }

  function exportCsv() {
    if (!region) return;
    const rows = [["Account", "Campaign", "Delivery", "Start", "End", "Reach", "Impressions", "Views", "Clicks", "Engagement", "Ad sets", "Ads", "Results", "Result label", "Cost per result", "Spend"]];
    for (const account of region.accounts) for (const campaign of account.campaigns) {
      rows.push([account.name, campaign.name, campaign.delivery, campaign.start, campaign.end, String(campaign.reach), String(campaign.impressions), String(campaign.views), String(campaign.clicks), String(campaign.engagements), campaign.adsets == null ? "" : String(campaign.adsets), campaign.ads == null ? "" : String(campaign.ads), campaign.results == null ? "" : String(campaign.results), campaign.resultLabel ?? "", campaign.costPerResult == null ? "" : String(campaign.costPerResult), String(campaign.spend)]);
    }
    const csv = rows.map((row) => row.map((cell) => /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `ads-${region.key}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  const days = data?.snap.days ?? [];
  const dailyAccounts = data?.snap.accounts.filter((account) => data.snap.daily[account.id]?.length) ?? [];
  const dailyTotals = days.map((_day, index) => dailyAccounts.reduce((sum, account) => sum + (data?.snap.daily[account.id]?.[index] ?? 0), 0));
  const dailyMax = Math.max(1, ...dailyTotals);
  const totalSpend30 = dailyTotals.reduce((sum, value) => sum + value, 0);
  const avgDay = dailyTotals.length ? totalSpend30 / dailyTotals.length : 0;

  return (
    <div className="space-y-4">
      <section className="report-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-[15px] font-semibold text-[var(--r-navy)]">Ads data</h2><p className="text-[12px] text-[var(--r-muted)]">{data ? `Data as of ${data.asOf}, ${data.takenAt}` : "No active upload yet."}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void toggleClientLinks()} disabled={savingLinks} aria-pressed={linksToClients} className="report-btn-secondary disabled:opacity-60">
              {savingLinks && <Loader2 className="size-3.5" />} Show Ads Manager links to clients: {linksToClients ? "On" : "Off"}
            </button>
            <button type="button" onClick={() => void rebuildSummaries()} disabled={rebuilding} className="report-btn-secondary disabled:opacity-60">
              {rebuilding ? <Loader2 className="size-3.5" /> : <RefreshCw className="size-3.5" />} Rebuild social summaries
            </button>
            <label className={cn("report-btn-secondary cursor-pointer", busy === "upload" && "opacity-60")}>
              {busy === "upload" ? <Loader2 className="size-3.5" /> : <Upload className="size-3.5" />} Choose HTML
              <input type="file" accept=".html,text/html" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
            </label>
          </div>
        </div>
        <div
          role="button" tabIndex={0}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files?.[0]; if (file) void upload(file); }}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") event.currentTarget.querySelector("input")?.click(); }}
          className={cn("mt-3 rounded-[10px] border border-dashed px-4 py-4 text-center text-[12px] text-[var(--r-muted)] transition-transform duration-150", dragging ? "scale-[1.01] border-[var(--r-teal)] bg-[var(--r-hl)]" : "border-[var(--r-line)]")}
        >
          Drop the Reachout Ads Desk HTML here, or use Choose HTML. Maximum 15 MB.
          <input type="file" accept=".html,text/html" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
        </div>
        {unmapped.length > 0 && <p role="status" className="report-note mt-2">Unmapped regions: {unmapped.join(", ")}. Map them in the case-studies dashboard.</p>}
        {message && <p role="status" className="mt-2 text-[12px] text-[var(--r-muted)]">{message}{progress != null ? ` (${progress}%)` : ""}</p>}
        {preview && (
          <div className="mt-3 rounded-[10px] border border-[var(--r-line)] p-3">
            <p className="text-[12px] font-semibold">Preview · {preview.takenAt}</p>
            <ul className="mt-2 space-y-1 text-[11.5px]">{preview.regions.map((item) => { const old = data?.regions.find((region) => region.key === item.key)?.totals; const delta = old ? item.totals.spend - old.spend : null; return <li key={item.key}>{item.label}: {item.totals.accounts} accounts · {item.totals.campaigns} campaigns · {money(item.totals.spend)}{delta == null ? "" : ` (${delta >= 0 ? "+" : ""}${money(delta)} vs active)`}</li>; })}</ul>
            <button type="button" onClick={() => void publish(preview.versionId)} disabled={Boolean(busy)} className="report-btn mt-3 disabled:opacity-50">Publish</button>
          </div>
        )}
        {versions.length > 0 && <div className="mt-3 space-y-1 text-[11px]">{versions.slice(0, 6).map((version) => <div key={version._id} className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--r-line)] px-2 py-1"><span className="font-semibold">{version.status}</span><span>{version.takenAt}</span><span>by {version.uploadedBy ?? "owner"}</span><span>{new Date(version.uploadedAt).toLocaleString()}</span><span className="font-mono">{version.sha256?.slice(0, 8) ?? "-"}</span>{version.status !== "active" && <button type="button" onClick={() => void rollback(version._id)} disabled={Boolean(busy)} className="ml-auto underline">Roll back</button>}</div>)}</div>}
      </section>

      {!data ? (
        <section className="report-card p-6 text-[13px] text-[var(--r-muted)]">Social data not uploaded yet.</section>
      ) : (
        <>
          <div className="report-tabs" role="tablist" aria-label="Ads Desk views">
            {data.regions.map((item) => (
              <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => { setTab(item.key); setOpenAccount(null); }} className="report-tab">
                <span className="mr-1 inline-block size-2 rounded-full align-middle" style={{ background: item.colors.band }} />{item.label}{unmapped.includes(item.key) && <span className="ml-1 text-[9px] uppercase text-[var(--r-coral)]">Unmapped</span>}
              </button>
            ))}
            <button type="button" role="tab" aria-selected={tab === "all"} onClick={() => setTab("all")} className="report-tab">All accounts (30 days)</button>
            <button type="button" role="tab" aria-selected={tab === "pages"} onClick={() => setTab("pages")} className="report-tab">Pages</button>
          </div>

          {region && tab !== "all" && tab !== "pages" && (
            <>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-[19px] font-semibold text-[var(--r-navy)]">{region.label} · {region.range}</h2>
                  <p className="mt-1 text-[12px] text-[var(--r-muted)]">Meta ads delivery · data as of {region.asOf}</p>
                </div>
                <button type="button" onClick={exportCsv} className="report-btn-secondary"><Download className="size-3.5" /> Export CSV</button>
              </div>
              <p className="mt-2 text-[12px] text-[var(--r-muted)]">{region.note}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  ["Accounts", count(region.totals.accounts)], ["Campaigns", count(region.totals.campaigns)], ["Active", count(region.totals.active)],
                  ["Reach", indianUnits(region.totals.reach)], ["Impressions", indianUnits(region.totals.impressions)],
                  [region.viewsLabel ?? "Views", indianUnits(region.totals.views)], ["Clicks", indianUnits(region.totals.clicks)],
                  ["Engagement", indianUnits(region.totals.engagements)], ["Spend", money(region.totals.spend)],
                ].map(([label, value]) => <div key={label} className="report-stat"><p className="report-stat-label">{label}</p><p className="report-stat-value">{value}</p></div>)}
              </div>
              <p className="mt-2 text-[11px] text-[var(--r-muted)]">Reach is added up per campaign, so a person reached by two campaigns counts twice.</p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search campaigns" aria-label="Search campaigns" className="min-h-9 min-w-[220px] rounded-md border border-[var(--r-line)] bg-white px-2 text-[12px]" />
                <select aria-label="Delivery filter" value={delivery} onChange={(event) => setDelivery(event.target.value)} className="min-h-9 rounded-md border border-[var(--r-line)] bg-white px-2 text-[12px]"><option value="all">All delivery</option>{["Delivering", "Stopped by account limit", "Off", "Completed", "Ad set switched off", "Started today"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
              </div>

              <div className="mt-2 overflow-x-auto rounded-[10px] border border-[var(--r-line)]">
                <table className="w-full min-w-[1100px] text-left text-[11.5px]">
                  <thead><tr>{["Account / campaign", "Delivery", "Start", "End", "Reach", "Impressions", "Views", "Clicks", "Engagement", "Ad sets", "Ads", "Results", "Cost/result", "Open"].map((label) => <th key={label} className={cn("px-2 py-2", !["Account / campaign", "Delivery", "Start", "End", "Results"].includes(label) && "text-right")}>{label}</th>)}<th className="px-2 py-2 text-right">Spend</th></tr></thead>
                  <tbody>
                    {accounts.map((account) => (
                      <AccountRows key={account.id} account={account} open={openAccount === account.id} onToggle={() => setOpenAccount(openAccount === account.id ? null : account.id)} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "all" && (
            <>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="report-stat"><p className="report-stat-label">Spend, last 30 days</p><p className="report-stat-value">{money(totalSpend30)}</p><p className="report-stat-note good">{dailyTotals.length} days</p></div>
                <div className="report-stat"><p className="report-stat-label">Accounts</p><p className="report-stat-value">{count(data.snap.accounts.length)}</p><p className="report-stat-note good">With daily data: {count(dailyAccounts.length)}</p></div>
                <div className="report-stat"><p className="report-stat-label">Average day</p><p className="report-stat-value">{money(avgDay)}</p><p className="report-stat-note good">Across available days</p></div>
                <div className="report-stat"><p className="report-stat-label">Peak day</p><p className="report-stat-value">{money(Math.max(0, ...dailyTotals))}</p><p className="report-stat-note good">{days[dailyTotals.indexOf(Math.max(...dailyTotals))] ?? "-"}</p></div>
              </div>
              <div className="report-card mt-3 p-4">
                <h3 className="text-[14px] font-semibold text-[var(--r-navy)]">Daily spend</h3>
                <div className="relative mt-3 flex h-44 items-end gap-1 border-b border-l border-[var(--r-line)] pl-1" role="img" aria-label={`Daily spend from ${days[0] ?? "-"} to ${days[days.length - 1] ?? "-"}`}>
                  <span className="pointer-events-none absolute inset-x-0 border-t border-[var(--r-teal)]" style={{ bottom: `${(avgDay / dailyMax) * 100}%` }} title={`Average day ${money(avgDay)}`} />
                  {days.map((day, index) => (
                    <div key={day} className="flex flex-1 flex-col justify-end" title={`${day} · ${money(dailyTotals[index])}`}>
                      <div className="bg-[var(--r-navy)]" style={{ height: `${Math.max(1, (dailyTotals[index] / dailyMax) * 100)}%` }} />
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[9px] text-[var(--r-muted)]"><span>{days[0]}</span><span>Total {money(totalSpend30)}</span><span>{days[days.length - 1]}</span></div>
                <p className="mt-1 text-[10.5px] text-[var(--r-muted)]">Flat navy bars show daily spend. The table below carries the account totals.</p>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[15px] font-semibold text-[var(--r-navy)]">All accounts</h3>
                <div className="flex items-center gap-2">
                  {allExpanded && <input value={allQuery} onChange={(event) => setAllQuery(event.target.value)} placeholder="Search accounts" aria-label="Search all accounts" className="min-h-9 rounded-md border border-[var(--r-line)] bg-white px-2 text-[12px]" />}
                  <button type="button" onClick={() => setAllExpanded((value) => !value)} className="rounded-md border border-[var(--r-line)] px-2 py-1 text-[11.5px] font-semibold text-[var(--r-navy)]">{allExpanded ? "Show top 10" : `Show all ${count(allRows.length)} accounts`}</button>
                </div>
              </div>
              <div className="mt-2 overflow-x-auto rounded-[10px] border border-[var(--r-line)]">
                <table className="w-full min-w-[720px] text-left text-[12px]">
                  <thead><tr>{["Account", "Status", "Spend", "Reach", "Impressions", "Views", "Clicks", "Engagement", "Open"].map((label) => <th key={label} className={cn("px-2 py-2", !["Account", "Status"].includes(label) && "text-right")}>{label}</th>)}</tr></thead>
                  <tbody>{(allExpanded ? allRows : allRows.slice(0, 10)).map((account) => <tr key={account.id}><td className="px-2 py-2 font-medium">{account.href ? <a href={account.href} target="_blank" rel="noopener noreferrer" className="text-[var(--r-navy)] underline-offset-2 hover:underline">{account.name}</a> : account.name}</td><td className="px-2 py-2">{account.status}</td>{account.stats.slice(0, 6).map((value, index) => <td key={index} className="px-2 py-2 text-right tabular-nums">{index === 0 ? money(value) : indianUnits(value)}</td>)}<td className="px-2 py-2 text-right"><OpenMenu links={[{ href: account.href, label: "Ads Manager" }, { href: account.billingHref, label: "Billing" }, { href: account.allAdsetsHref, label: "All ad sets" }, { href: account.allAdsHref, label: "All ads" }]} /></td></tr>)}</tbody>
                </table>
              </div>
            </>
          )}

          {tab === "pages" && (
            <div className="mt-4 overflow-x-auto rounded-[10px] border border-[var(--r-line)]">
              <table className="w-full min-w-[420px] text-left text-[12px]"><thead><tr><th className="px-2 py-2">Page</th><th className="px-2 py-2 text-right">Open</th></tr></thead><tbody>{data.snap.pages.map((page) => <tr key={page.id}><td className="px-2 py-2">{page.href ? <a href={page.href} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--r-navy)] underline-offset-2 hover:underline">{page.name}</a> : page.name}</td><td className="px-2 py-2 text-right"><OpenMenu links={[{ href: page.insightsHref, label: "Insights" }, { href: page.adLibraryHref, label: "Ad Library" }]} /></td></tr>)}</tbody></table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AccountRows({ account, open, onToggle }: { account: AdsAccount; open: boolean; onToggle: () => void }) {
  const campaigns = account.campaigns;
  const totals = campaigns.reduce((acc, item) => ({ reach: acc.reach + item.reach, impressions: acc.impressions + item.impressions, views: acc.views + item.views, clicks: acc.clicks + item.clicks, engagements: acc.engagements + item.engagements, spend: acc.spend + item.spend }), { reach: 0, impressions: 0, views: 0, clicks: 0, engagements: 0, spend: 0 });
  return (
    <>
      <tr className="bg-[var(--r-bg)]">
        <td className="px-2 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`Toggle ${account.name}`} className="text-[10px]">{open ? "▾" : "▸"}</button>
            {account.href ? <a href={account.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--r-navy)] underline-offset-2 hover:underline">{account.name}</a> : <span className="font-semibold">{account.name}</span>}
            <span className="text-[10px] text-[var(--r-muted)]">{account.campaigns.length} campaigns</span>
            <OpenMenu links={[{ href: account.billingHref, label: "Billing" }, { href: account.allAdsetsHref, label: "All ad sets" }, { href: account.allAdsHref, label: "All ads" }]} />
          </div>
        </td>
        <td className="px-2 py-2" /><td className="px-2 py-2" /><td className="px-2 py-2" />
        <td className="px-2 py-2 text-right tabular-nums">{indianUnits(totals.reach)}</td><td className="px-2 py-2 text-right tabular-nums">{indianUnits(totals.impressions)}</td><td className="px-2 py-2 text-right tabular-nums">{indianUnits(totals.views)}</td><td className="px-2 py-2 text-right tabular-nums">{indianUnits(totals.clicks)}</td><td className="px-2 py-2 text-right tabular-nums">{indianUnits(totals.engagements)}</td><td className="px-2 py-2" /><td className="px-2 py-2" /><td className="px-2 py-2" /><td className="px-2 py-2" /><td className="px-2 py-2" />
        <td className="px-2 py-2 text-right font-semibold tabular-nums">{money(totals.spend)}</td>
      </tr>
      {open && campaigns.map((campaign) => (
        <tr key={campaign.id}>
          <td className="px-2 py-1.5 pl-6">{campaign.href ? <a href={campaign.href} target="_blank" rel="noopener noreferrer" className="text-[var(--r-navy)] underline-offset-2 hover:underline">{campaign.name}</a> : campaign.name}</td>
          <td className="px-2 py-1.5">{campaign.delivery}</td><td className="px-2 py-1.5">{campaign.start || "-"}</td><td className="px-2 py-1.5">{campaign.end || "-"}</td>
          <td className="px-2 py-1.5 text-right tabular-nums">{indianUnits(campaign.reach)}</td><td className="px-2 py-1.5 text-right tabular-nums">{indianUnits(campaign.impressions)}</td><td className="px-2 py-1.5 text-right tabular-nums">{indianUnits(campaign.views)}</td><td className="px-2 py-1.5 text-right tabular-nums">{indianUnits(campaign.clicks)}</td><td className="px-2 py-1.5 text-right tabular-nums">{indianUnits(campaign.engagements)}</td>
          <td className="px-2 py-1.5 text-right tabular-nums">{campaign.adsets == null ? "-" : campaign.adsetsHref ? <a href={campaign.adsetsHref} target="_blank" rel="noopener noreferrer" className="text-[var(--r-navy)] underline-offset-2 hover:underline">{count(campaign.adsets)}</a> : count(campaign.adsets)}</td>
          <td className="px-2 py-1.5 text-right tabular-nums">{campaign.ads == null ? "-" : campaign.adsHref ? <a href={campaign.adsHref} target="_blank" rel="noopener noreferrer" className="text-[var(--r-navy)] underline-offset-2 hover:underline">{count(campaign.ads)}</a> : count(campaign.ads)}</td>
          <td className="px-2 py-1.5">{campaign.results == null ? "-" : `${count(campaign.results)} ${campaign.resultLabel ?? ""}`}</td><td className="px-2 py-1.5 text-right tabular-nums">{campaign.costPerResult == null ? "-" : money(campaign.costPerResult)}</td>
          <td className="px-2 py-1.5 text-right"><OpenMenu links={[{ href: campaign.href, label: "Campaign in Ads Manager" }, { href: campaign.adsetsHref, label: "Ad sets" }, { href: campaign.adsHref, label: "Ads" }]} /></td>
          <td className="px-2 py-1.5 text-right tabular-nums">{money(campaign.spend)}</td>
        </tr>
      ))}
    </>
  );
}
