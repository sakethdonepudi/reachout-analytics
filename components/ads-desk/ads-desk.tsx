"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { useReauth } from "@/components/auth/reauth-provider";
import type { AdsParse, AdsAccount, AdsCampaign } from "@/lib/ads-desk/parse";
import { cn } from "@/lib/utils";

type Version = { _id: string; uploadedAt: string; uploadedBy?: string; sha256?: string; fileName: string; status: string; takenAt: string };
type Preview = { versionId: string; regions: { key: string; label: string; totals: AdsParse["regions"][number]["totals"] }[]; takenAt: string };

const money = (value: number) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value)}`;
const count = (value: number) => new Intl.NumberFormat("en-IN").format(value);

export default function AdsDesk({ data, versions, defaultRegion, unmapped = [] }: { data: AdsParse | null; versions: Version[]; defaultRegion: string; unmapped?: string[] }) {
  const router = useRouter();
  const { requestReauth } = useReauth();
  const [tab, setTab] = useState<string>(data && defaultRegion && data.regions.some((r) => r.key === defaultRegion) ? defaultRegion : data?.regions[0]?.key ?? "all");
  const [query, setQuery] = useState("");
  const [delivery, setDelivery] = useState("all");
  const [sort, setSort] = useState<{ key: keyof AdsCampaign | "name"; asc: boolean }>({ key: "spend", asc: false });
  const [openAccount, setOpenAccount] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dragging, setDragging] = useState(false);
  const [chartMode, setChartMode] = useState<"bars" | "lines">("bars");
  const [progress, setProgress] = useState<number | null>(null);

  const region = data?.regions.find((item) => item.key === tab) ?? null;
  const accounts = useMemo(() => {
    if (!region) return [];
    const q = query.trim().toLowerCase();
    return region.accounts
      .map((account) => ({
        ...account,
        campaigns: account.campaigns.filter((campaign) => {
          if (delivery !== "all" && campaign.delivery !== delivery) return false;
          return !q || campaign.name.toLowerCase().includes(q) || account.name.toLowerCase().includes(q);
        }),
      }))
      .filter((account) => account.campaigns.length > 0 || !q);
  }, [region, query, delivery]);

  function sorted(campaigns: AdsCampaign[]) {
    return [...campaigns].sort((a, b) => {
      const left = (a[sort.key] ?? "") as string | number;
      const right = (b[sort.key] ?? "") as string | number;
      if (typeof left === "number" && typeof right === "number") return sort.asc ? left - right : right - left;
      return sort.asc ? String(left).localeCompare(String(right)) : String(right).localeCompare(String(left));
    });
  }

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
        setMessage("Parsing…");
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
    const rows = [["Account", "Campaign", "Delivery", "Start", "End", "Reach", "Impressions", "Views", "Clicks", "Engagement", "Results", "Result label", "Cost per result", "Spend"]];
    for (const account of region.accounts) for (const campaign of account.campaigns) {
      rows.push([account.name, campaign.name, campaign.delivery, campaign.start, campaign.end, String(campaign.reach), String(campaign.impressions), String(campaign.views), String(campaign.clicks), String(campaign.engagements), campaign.results == null ? "" : String(campaign.results), campaign.resultLabel ?? "", campaign.costPerResult == null ? "" : String(campaign.costPerResult), String(campaign.spend)]);
    }
    const csv = rows.map((row) => row.map((cell) => /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `ads-${region.key}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-panel)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-[15px] font-semibold">Ads data</h2><p className="text-[12px] text-[var(--text-muted)]">{data ? `Data as of ${data.asOf}, ${data.takenAt}` : "No active upload yet."}</p></div>
          <label className={cn("inline-flex min-h-10 cursor-pointer items-center gap-2 rounded border border-[var(--border-hairline)] px-3 text-[12px] font-semibold", busy === "upload" && "opacity-60")}>
            {busy === "upload" ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Choose HTML
            <input type="file" accept=".html,text/html" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
          </label>
        </div>
        <div
          role="button" tabIndex={0}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files?.[0]; if (file) void upload(file); }}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") event.currentTarget.querySelector("input")?.click(); }}
          className={cn("mt-3 rounded border border-dashed px-4 py-6 text-center text-[12px] text-[var(--text-muted)]", dragging ? "border-[var(--accent-brass)] bg-[var(--accent-brass-soft)]" : "border-[var(--border-hairline)]")}
        >
          Drop the Reachout Ads Desk HTML here, or use Choose HTML. Maximum 15 MB.
          <input type="file" accept=".html,text/html" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
        </div>
        {unmapped.length > 0 && <p role="status" className="mt-2 rounded border border-[var(--warning)]/40 bg-[var(--warning-bg)] px-2 py-1 text-[11.5px] text-[var(--warning)]">Unmapped regions: {unmapped.join(", ")}. Map them in the case-studies dashboard.</p>}
        {message && <p role="status" className="mt-2 text-[12px] text-[var(--text-muted)]">{message}</p>}
        {preview && (
          <div className="mt-3 rounded border border-[var(--accent-brass)]/40 p-3">
            <p className="text-[12px] font-semibold">Preview · {preview.takenAt}</p>
            <ul className="mt-2 space-y-1 text-[11.5px]">{preview.regions.map((item) => { const old = data?.regions.find((region) => region.key === item.key)?.totals; const delta = old ? item.totals.spend - old.spend : null; return <li key={item.key}>{item.label}: {item.totals.accounts} accounts · {item.totals.campaigns} campaigns · {money(item.totals.spend)}{delta == null ? "" : ` (${delta >= 0 ? "+" : ""}${money(delta)} vs active)`}</li>; })}</ul>
            <button type="button" onClick={() => void publish(preview.versionId)} disabled={Boolean(busy)} className="mt-3 min-h-9 rounded bg-[var(--accent-brass)] px-3 text-[12px] font-semibold text-[var(--text-on-brass)] disabled:opacity-50">Publish</button>
          </div>
        )}
        {versions.length > 0 && <div className="mt-3 space-y-1 text-[11px]">{versions.slice(0, 6).map((version) => <div key={version._id} className="flex flex-wrap items-center gap-2 rounded border border-[var(--border-hairline)] px-2 py-1"><span className="font-semibold">{version.status}</span><span>{version.takenAt}</span><span>by {version.uploadedBy ?? "owner"}</span><span>{new Date(version.uploadedAt).toLocaleString()}</span><span className="font-mono">{version.sha256?.slice(0, 8) ?? "—"}</span>{version.status !== "active" && <button type="button" onClick={() => void rollback(version._id)} disabled={Boolean(busy)} className="ml-auto underline">Roll back</button>}</div>)}</div>}
      </section>

      {!data ? (
        <section className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-panel)] p-6 text-[13px] text-[var(--text-muted)]">Social data not uploaded yet.</section>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 border-b border-[var(--border-hairline)]">
            {data.regions.map((item) => (
              <button key={item.key} type="button" onClick={() => { setTab(item.key); setOpenAccount(null); }} style={tab === item.key ? { borderBottomColor: item.colors.band } : undefined} className={cn("min-h-10 border-b-2 border-transparent px-3 text-[12px] font-semibold", tab === item.key ? "text-foreground" : "text-[var(--text-muted)]")}>{item.label}{unmapped.includes(item.key) && <span className="ml-1 rounded border border-[var(--warning)]/50 px-1 text-[8px] uppercase text-[var(--warning)]">Unmapped</span>}</button>
            ))}
            <button type="button" onClick={() => setTab("all")} className={cn("min-h-10 border-b-2 border-transparent px-3 text-[12px] font-semibold", tab === "all" ? "border-[var(--accent-brass)] text-foreground" : "text-[var(--text-muted)]")}>All accounts (last 30 days)</button>
            <button type="button" onClick={() => setTab("pages")} className={cn("min-h-10 border-b-2 border-transparent px-3 text-[12px] font-semibold", tab === "pages" ? "border-[var(--accent-brass)] text-foreground" : "text-[var(--text-muted)]")}>Pages</button>
          </div>

          {region && tab !== "all" && tab !== "pages" && (
            <>
              <div className="h-1 w-full rounded" style={{ background: region.colors.band }} />
              <p className="text-[12px] text-[var(--text-muted)]">{region.range} · {region.note} · Data as of {region.asOf}</p>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  ["Accounts", count(region.totals.accounts)], ["Campaigns", count(region.totals.campaigns)], ["Active", count(region.totals.active)],
                  ["Reach", count(region.totals.reach)], ["Impressions", count(region.totals.impressions)],
                  [region.viewsLabel ?? "Views", count(region.totals.views)], ["Clicks", count(region.totals.clicks)],
                  ["Post engagement", count(region.totals.engagements)], ["Spend", money(region.totals.spend)],
                ].map(([label, value]) => <div key={label} className="rounded border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">{label}</p><p className="mt-1 text-[15px] font-semibold tabular-nums">{value}</p></div>)}
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">Reach is added up per campaign, so a person reached by two campaigns counts twice.</p>

              <div className="flex flex-wrap items-center gap-2">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search campaigns" className="min-h-9 min-w-[220px] rounded border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-2 text-[12px]" />
                <select aria-label="Delivery filter" value={delivery} onChange={(event) => setDelivery(event.target.value)} className="min-h-9 rounded border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-2 text-[12px]"><option value="all">All delivery</option>{Object.values(["Delivering", "Stopped by account spend limit", "Off", "Completed", "Ad set switched off", "Started today"]).map((value) => <option key={value} value={value}>{value}</option>)}</select>
                <button type="button" onClick={exportCsv} className="min-h-9 rounded border border-[var(--border-hairline)] px-3 text-[12px] font-semibold">Export CSV</button>
              </div>

              <div className="overflow-x-auto rounded border border-[var(--border-hairline)] bg-[var(--surface-panel)]">
                <table className="w-full min-w-[1100px] border-collapse text-left text-[11.5px]">
                  <thead className="sticky top-0 bg-[var(--surface-raised)] text-[9.5px] uppercase tracking-[0.08em] text-[var(--text-muted)]"><tr>
                    {["Account / campaign", "Delivery", "Start", "End", "Reach", "Impressions", "Views", "Clicks", "Post engagement", "Ad sets", "Ads", "Results", "Cost per result"].map((label) => <th key={label} className="px-2 py-2">{label}</th>)}
                    <th className="sticky right-0 z-10 bg-[var(--surface-raised)] px-2 py-2 text-right">Spend</th>
                  </tr></thead>
                  <tbody>
                    {accounts.map((account) => (
                      <AccountRows key={account.id} account={account} open={openAccount === account.id} onToggle={() => setOpenAccount(openAccount === account.id ? null : account.id)} sorted={sorted} sort={sort} setSort={setSort} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "all" && (() => {
            const days = data.snap.days;
            const accountsWithDaily = data.snap.accounts.filter((account) => data.snap.daily[account.id]?.length);
            const totals = days.map((_day, index) => accountsWithDaily.reduce((sum, account) => sum + (data.snap.daily[account.id]?.[index] ?? 0), 0));
            const max = Math.max(1, ...totals);
            return (
            <>
            <div className="rounded border border-[var(--border-hairline)] bg-[var(--surface-panel)] p-4">
              <div className="flex items-center justify-between gap-2"><h3 className="text-[13px] font-semibold">Daily spend</h3><select aria-label="Chart type" value={chartMode} onChange={(event) => setChartMode(event.target.value as "bars" | "lines")} className="min-h-8 rounded border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-2 text-[11px]"><option value="bars">Stacked bars</option><option value="lines">Lines</option></select></div>
              {chartMode === "bars" ? (
                <div className="mt-3 flex h-48 items-end gap-1 border-b border-l border-[var(--border-hairline)] pl-1">
                  {days.map((day, index) => <div key={day} className="flex flex-1 flex-col justify-end gap-px" title={`${day} · total ₹${totals[index].toFixed(2)}`}>
                    {accountsWithDaily.map((account) => { const value = data.snap.daily[account.id]?.[index] ?? 0; return <div key={account.id} title={`${day} · ${account.name} · ₹${value.toFixed(2)}`} style={{ height: `${(value / max) * 100}%`, background: "var(--accent-brass)", opacity: 0.75 }} />; })}
                    <span className="mt-1 truncate text-center text-[8px] text-[var(--text-muted)]">{index === days.length - 1 ? "today so far" : day.slice(5)}</span>
                  </div>)}
                </div>
              ) : (
                <svg viewBox="0 0 100 40" className="mt-3 h-48 w-full overflow-visible" role="img" aria-label="Daily spend lines">
                  {[0, 10, 20, 30, 40].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="var(--border-hairline)" strokeWidth="0.2" />)}
                  {accountsWithDaily.map((account, accountIndex) => { const points = days.map((_day, index) => `${(index / Math.max(1, days.length - 1)) * 100},${40 - ((data.snap.daily[account.id]?.[index] ?? 0) / max) * 38}`).join(" "); return <polyline key={account.id} points={points} fill="none" stroke="var(--accent-brass)" strokeOpacity={0.35 + (accountIndex % 5) * 0.1} strokeWidth="0.7" />; })}
                  <polyline points={days.map((_day, index) => `${(index / Math.max(1, days.length - 1)) * 100},${40 - (totals[index] / max) * 38}`).join(" ")} fill="none" stroke="var(--text-primary)" strokeWidth="1" />
                </svg>
              )}
              <div className="mt-1 flex justify-between text-[9px] text-[var(--text-muted)]"><span>{days[0]}</span><span>Total ₹{totals.reduce((sum, value) => sum + value, 0).toFixed(2)}</span><span>{days[days.length - 1]} · today so far</span></div>
            </div>
            <div className="overflow-x-auto rounded border border-[var(--border-hairline)] bg-[var(--surface-panel)]">
              <table className="w-full min-w-[420px] border-collapse text-left text-[11px]"><thead className="bg-[var(--surface-raised)] text-[9px] uppercase tracking-[0.08em] text-[var(--text-muted)]"><tr><th className="px-2 py-2">Account</th><th className="px-2 py-2 text-right">{days.length}-day total</th></tr></thead><tbody>{accountsWithDaily.map((account) => <tr key={account.id} className="border-t border-[var(--border-hairline)]/60"><td className="px-2 py-1.5">{account.name}</td><td className="px-2 py-1.5 text-right tabular-nums">{money(data.snap.daily[account.id].reduce((sum, value) => sum + value, 0))}</td></tr>)}</tbody></table>
            </div>
            <div className="overflow-x-auto rounded border border-[var(--border-hairline)] bg-[var(--surface-panel)]">
              <table className="w-full min-w-[900px] border-collapse text-left text-[11.5px]">
                <thead className="bg-[var(--surface-raised)] text-[9.5px] uppercase tracking-[0.08em] text-[var(--text-muted)]"><tr>{["Account", "Status", "Payment", "Spend", "Reach", "Impressions", "Views", "Clicks", "Engagement", "Owner links"].map((label) => <th key={label} className="px-2 py-2">{label}</th>)}</tr></thead>
                <tbody>{data.snap.accounts.map((account) => <tr key={account.id} className="border-t border-[var(--border-hairline)]/60"><td className="px-2 py-2 font-medium">{account.href ? <OwnerLink href={account.href}>{account.name}</OwnerLink> : account.name}</td><td className="px-2 py-2">{account.status}</td><td className="px-2 py-2">{account.hasPayment ? "Yes" : "No"}</td>{account.stats.map((value, index) => <td key={index} className="px-2 py-2 text-right tabular-nums">{index === 0 ? money(value) : count(value)}</td>)}<td className="px-2 py-2"><div className="flex flex-wrap gap-2">{account.href && <OwnerLink href={account.href}>Ads Manager</OwnerLink>}{account.billingHref && <OwnerLink href={account.billingHref}>Billing</OwnerLink>}{account.allAdsetsHref && <OwnerLink href={account.allAdsetsHref}>All ad sets</OwnerLink>}{account.allAdsHref && <OwnerLink href={account.allAdsHref}>All ads</OwnerLink>}</div></td></tr>)}</tbody>
              </table>
            </div>
            </>
            );
          })()}

          {tab === "pages" && (
            <div className="overflow-x-auto rounded border border-[var(--border-hairline)] bg-[var(--surface-panel)]">
              <table className="w-full min-w-[520px] border-collapse text-left text-[12px]"><thead className="bg-[var(--surface-raised)] text-[9.5px] uppercase tracking-[0.08em] text-[var(--text-muted)]"><tr><th className="px-2 py-2">Page</th><th className="px-2 py-2">Links</th></tr></thead><tbody>{data.snap.pages.map((page) => <tr key={page.id} className="border-t border-[var(--border-hairline)]/60"><td className="px-2 py-2">{page.href ? <OwnerLink href={page.href}>{page.name}</OwnerLink> : page.name}</td><td className="px-2 py-2"><div className="flex flex-wrap gap-2">{page.insightsHref && <OwnerLink href={page.insightsHref}>Insights</OwnerLink>}{page.adLibraryHref && <OwnerLink href={page.adLibraryHref}>Ad Library</OwnerLink>}</div></td></tr>)}</tbody></table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OwnerLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="underline">{children}</a>;
}

function AccountRows({ account, open, onToggle, sorted, sort, setSort }: { account: AdsAccount; open: boolean; onToggle: () => void; sorted: (rows: AdsCampaign[]) => AdsCampaign[]; sort: { key: keyof AdsCampaign | "name"; asc: boolean }; setSort: (value: { key: keyof AdsCampaign | "name"; asc: boolean }) => void }) {
  const campaigns = sorted(account.campaigns);
  const totals = campaigns.reduce((acc, item) => ({ reach: acc.reach + item.reach, impressions: acc.impressions + item.impressions, views: acc.views + item.views, clicks: acc.clicks + item.clicks, engagements: acc.engagements + item.engagements, spend: acc.spend + item.spend }), { reach: 0, impressions: 0, views: 0, clicks: 0, engagements: 0, spend: 0 });
  return (
    <>
      <tr className="border-t border-[var(--border-hairline)] bg-[var(--surface-raised)]/60">
        <td className="px-2 py-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`Toggle ${account.name}`} className="flex items-center gap-1 text-[10px]">{open ? "▾" : "▸"}</button>
            {account.href ? <OwnerLink href={account.href}><span className="font-semibold">{account.name}</span></OwnerLink> : <span className="font-semibold">{account.name}</span>}
            <span className="text-[10px] font-normal text-[var(--text-muted)]">{account.campaigns.length} campaigns</span>
            <span className="flex flex-wrap gap-2 text-[10px] font-normal">
              {account.billingHref && <OwnerLink href={account.billingHref}>Billing</OwnerLink>}
              {account.allAdsetsHref && <OwnerLink href={account.allAdsetsHref}>All ad sets</OwnerLink>}
              {account.allAdsHref && <OwnerLink href={account.allAdsHref}>All ads</OwnerLink>}
            </span>
          </div>
        </td>
        <td className="px-2 py-2" /><td className="px-2 py-2" /><td className="px-2 py-2" />
        <td className="px-2 py-2 text-right tabular-nums">{count(totals.reach)}</td><td className="px-2 py-2 text-right tabular-nums">{count(totals.impressions)}</td><td className="px-2 py-2 text-right tabular-nums">{count(totals.views)}</td><td className="px-2 py-2 text-right tabular-nums">{count(totals.clicks)}</td><td className="px-2 py-2 text-right tabular-nums">{count(totals.engagements)}</td><td className="px-2 py-2" /><td className="px-2 py-2" /><td className="px-2 py-2" /><td className="px-2 py-2" />
        <td className="sticky right-0 bg-[var(--surface-raised)] px-2 py-2 text-right font-semibold tabular-nums">{money(totals.spend)}</td>
      </tr>
      {open && campaigns.map((campaign) => (
        <tr key={campaign.id} className="border-t border-[var(--border-hairline)]/50">
          <td className="px-2 py-1.5 pl-6">{campaign.href ? <OwnerLink href={campaign.href}>{campaign.name}</OwnerLink> : campaign.name}</td><td className="px-2 py-1.5">{campaign.delivery}</td><td className="px-2 py-1.5">{campaign.start || "—"}</td><td className="px-2 py-1.5">{campaign.end || "—"}</td>
          <td className="px-2 py-1.5 text-right tabular-nums">{count(campaign.reach)}</td><td className="px-2 py-1.5 text-right tabular-nums">{count(campaign.impressions)}</td><td className="px-2 py-1.5 text-right tabular-nums">{count(campaign.views)}</td><td className="px-2 py-1.5 text-right tabular-nums">{count(campaign.clicks)}</td><td className="px-2 py-1.5 text-right tabular-nums">{count(campaign.engagements)}</td>
          <td className="px-2 py-1.5 text-right tabular-nums">{campaign.adsets == null ? "–" : campaign.adsetsHref ? <OwnerLink href={campaign.adsetsHref}>{count(campaign.adsets)}</OwnerLink> : count(campaign.adsets)}</td>
          <td className="px-2 py-1.5 text-right tabular-nums">{campaign.ads == null ? "–" : campaign.adsHref ? <OwnerLink href={campaign.adsHref}>{count(campaign.ads)}</OwnerLink> : count(campaign.ads)}</td>
          <td className="px-2 py-1.5">{campaign.results == null ? "—" : `${count(campaign.results)} ${campaign.resultLabel ?? ""}`}</td><td className="px-2 py-1.5 text-right tabular-nums">{campaign.costPerResult == null ? "—" : money(campaign.costPerResult)}</td>
          <td className="sticky right-0 bg-[var(--surface-panel)] px-2 py-1.5 text-right tabular-nums">{money(campaign.spend)}</td>
        </tr>
      ))}
    </>
  );
}
