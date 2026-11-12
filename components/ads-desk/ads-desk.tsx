"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Upload } from "lucide-react";
import { useReauth } from "@/components/auth/reauth-provider";
import type { AdsParse, AdsAccount, AdsCampaign } from "@/lib/ads-desk/parse";
import { cn } from "@/lib/utils";

type Version = { _id: string; uploadedAt: string; fileName: string; status: string; takenAt: string };
type Preview = { versionId: string; regions: { key: string; label: string; totals: AdsParse["regions"][number]["totals"] }[]; takenAt: string };

const money = (value: number) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value)}`;
const count = (value: number) => new Intl.NumberFormat("en-IN").format(value);

export default function AdsDesk({ data, versions, defaultRegion }: { data: AdsParse | null; versions: Version[]; defaultRegion: string }) {
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
    setBusy("upload"); setMessage(""); setPreview(null);
    const form = new FormData(); form.append("file", file);
    try {
      const response = await fetch("/api/ads/upload", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(payload.error ?? "Upload failed."); return; }
      setPreview({ versionId: payload.versionId, regions: payload.preview.regions, takenAt: payload.preview.takenAt });
      setMessage("Parsed successfully. Review the preview, then publish.");
    } catch { setMessage("Upload failed."); } finally { setBusy(""); }
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
        {message && <p role="status" className="mt-2 text-[12px] text-[var(--text-muted)]">{message}</p>}
        {preview && (
          <div className="mt-3 rounded border border-[var(--accent-brass)]/40 p-3">
            <p className="text-[12px] font-semibold">Preview · {preview.takenAt}</p>
            <ul className="mt-2 space-y-1 text-[11.5px]">{preview.regions.map((item) => <li key={item.key}>{item.label}: {item.totals.accounts} accounts · {item.totals.campaigns} campaigns · {money(item.totals.spend)}</li>)}</ul>
            <button type="button" onClick={() => void publish(preview.versionId)} disabled={Boolean(busy)} className="mt-3 min-h-9 rounded bg-[var(--accent-brass)] px-3 text-[12px] font-semibold text-[var(--text-on-brass)] disabled:opacity-50">Publish</button>
          </div>
        )}
        {versions.length > 0 && <div className="mt-3 flex flex-wrap gap-2 text-[11px]">{versions.slice(0, 6).map((version) => <span key={version._id} className="rounded border border-[var(--border-hairline)] px-2 py-1">{version.status} · {version.fileName}{version.status !== "active" && <button type="button" onClick={() => void rollback(version._id)} disabled={Boolean(busy)} className="ml-2 underline">Roll back</button>}</span>)}</div>}
      </section>

      {!data ? (
        <section className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-panel)] p-6 text-[13px] text-[var(--text-muted)]">Social data not uploaded yet.</section>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 border-b border-[var(--border-hairline)]">
            {data.regions.map((item) => (
              <button key={item.key} type="button" onClick={() => { setTab(item.key); setOpenAccount(null); }} style={tab === item.key ? { borderBottomColor: item.colors.band } : undefined} className={cn("min-h-10 border-b-2 border-transparent px-3 text-[12px] font-semibold", tab === item.key ? "text-foreground" : "text-[var(--text-muted)]")}>{item.label}</button>
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
                <select value={delivery} onChange={(event) => setDelivery(event.target.value)} className="min-h-9 rounded border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-2 text-[12px]"><option value="all">All delivery</option>{Object.values(["Delivering", "Stopped by account spend limit", "Off", "Completed", "Ad set switched off", "Started today"]).map((value) => <option key={value} value={value}>{value}</option>)}</select>
                <button type="button" onClick={exportCsv} className="min-h-9 rounded border border-[var(--border-hairline)] px-3 text-[12px] font-semibold">Export CSV</button>
              </div>

              <div className="overflow-x-auto rounded border border-[var(--border-hairline)] bg-[var(--surface-panel)]">
                <table className="w-full min-w-[1100px] border-collapse text-left text-[11.5px]">
                  <thead className="sticky top-0 bg-[var(--surface-raised)] text-[9.5px] uppercase tracking-[0.08em] text-[var(--text-muted)]"><tr>
                    {["Account / campaign", "Delivery", "Start", "End", "Reach", "Impressions", "Views", "Clicks", "Post engagement", "Results", "Cost per result"].map((label) => <th key={label} className="px-2 py-2">{label}</th>)}
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

          {tab === "all" && (
            <div className="overflow-x-auto rounded border border-[var(--border-hairline)] bg-[var(--surface-panel)]">
              <table className="w-full min-w-[900px] border-collapse text-left text-[11.5px]">
                <thead className="bg-[var(--surface-raised)] text-[9.5px] uppercase tracking-[0.08em] text-[var(--text-muted)]"><tr>{["Account", "Status", "Payment", "Spend", "Reach", "Impressions", "Views", "Clicks", "Engagement", "Owner links"].map((label) => <th key={label} className="px-2 py-2">{label}</th>)}</tr></thead>
                <tbody>{data.snap.accounts.map((account) => <tr key={account.id} className="border-t border-[var(--border-hairline)]/60"><td className="px-2 py-2 font-medium">{account.name}</td><td className="px-2 py-2">{account.status}</td><td className="px-2 py-2">{account.hasPayment ? "Yes" : "No"}</td>{account.stats.map((value, index) => <td key={index} className="px-2 py-2 text-right tabular-nums">{index === 0 ? money(value) : count(value)}</td>)}<td className="px-2 py-2"><div className="flex gap-2"><a href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${account.id}`} target="_blank" rel="noreferrer" className="underline">Ads Manager</a><a href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${account.id}&business_id=`} target="_blank" rel="noreferrer" className="underline">Billing</a></div></td></tr>)}</tbody>
              </table>
            </div>
          )}

          {tab === "pages" && (
            <div className="overflow-x-auto rounded border border-[var(--border-hairline)] bg-[var(--surface-panel)]">
              <table className="w-full min-w-[520px] border-collapse text-left text-[12px]"><thead className="bg-[var(--surface-raised)] text-[9.5px] uppercase tracking-[0.08em] text-[var(--text-muted)]"><tr><th className="px-2 py-2">Page</th><th className="px-2 py-2">Links</th></tr></thead><tbody>{data.snap.pages.map((page) => <tr key={page.id} className="border-t border-[var(--border-hairline)]/60"><td className="px-2 py-2">{page.name}</td><td className="px-2 py-2"><div className="flex flex-wrap gap-2"><a href={`https://www.facebook.com/${page.id}`} target="_blank" rel="noreferrer" className="underline">Page</a><a href={`https://www.facebook.com/ads/library/?view_all_page_id=${page.id}`} target="_blank" rel="noreferrer" className="underline">Ad Library</a><a href={`https://business.facebook.com/latest/insights?asset_id=${page.id}`} target="_blank" rel="noreferrer" className="underline">Business insights</a></div></td></tr>)}</tbody></table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AccountRows({ account, open, onToggle, sorted, sort, setSort }: { account: AdsAccount; open: boolean; onToggle: () => void; sorted: (rows: AdsCampaign[]) => AdsCampaign[]; sort: { key: keyof AdsCampaign | "name"; asc: boolean }; setSort: (value: { key: keyof AdsCampaign | "name"; asc: boolean }) => void }) {
  const campaigns = sorted(account.campaigns);
  const totals = campaigns.reduce((acc, item) => ({ reach: acc.reach + item.reach, impressions: acc.impressions + item.impressions, views: acc.views + item.views, clicks: acc.clicks + item.clicks, engagements: acc.engagements + item.engagements, spend: acc.spend + item.spend }), { reach: 0, impressions: 0, views: 0, clicks: 0, engagements: 0, spend: 0 });
  return (
    <>
      <tr className="border-t border-[var(--border-hairline)] bg-[var(--surface-raised)]/60">
        <td className="px-2 py-2"><button type="button" onClick={onToggle} className="flex items-center gap-1.5 font-semibold"><span className="text-[10px]">{open ? "▾" : "▸"}</span>{account.name}<span className="text-[10px] font-normal text-[var(--text-muted)]">{account.campaigns.length} campaigns</span></button></td>
        <td className="px-2 py-2" /><td className="px-2 py-2" /><td className="px-2 py-2" />
        <td className="px-2 py-2 text-right tabular-nums">{count(totals.reach)}</td><td className="px-2 py-2 text-right tabular-nums">{count(totals.impressions)}</td><td className="px-2 py-2 text-right tabular-nums">{count(totals.views)}</td><td className="px-2 py-2 text-right tabular-nums">{count(totals.clicks)}</td><td className="px-2 py-2 text-right tabular-nums">{count(totals.engagements)}</td><td className="px-2 py-2" /><td className="px-2 py-2" />
        <td className="sticky right-0 bg-[var(--surface-raised)] px-2 py-2 text-right font-semibold tabular-nums">{money(totals.spend)}</td>
      </tr>
      {open && campaigns.map((campaign) => (
        <tr key={campaign.id} className="border-t border-[var(--border-hairline)]/50">
          <td className="px-2 py-1.5 pl-6">{campaign.name}</td><td className="px-2 py-1.5">{campaign.delivery}</td><td className="px-2 py-1.5">{campaign.start || "—"}</td><td className="px-2 py-1.5">{campaign.end || "—"}</td>
          <td className="px-2 py-1.5 text-right tabular-nums">{count(campaign.reach)}</td><td className="px-2 py-1.5 text-right tabular-nums">{count(campaign.impressions)}</td><td className="px-2 py-1.5 text-right tabular-nums">{count(campaign.views)}</td><td className="px-2 py-1.5 text-right tabular-nums">{count(campaign.clicks)}</td><td className="px-2 py-1.5 text-right tabular-nums">{count(campaign.engagements)}</td>
          <td className="px-2 py-1.5">{campaign.results == null ? "—" : `${count(campaign.results)} ${campaign.resultLabel ?? ""}`}</td><td className="px-2 py-1.5 text-right tabular-nums">{campaign.costPerResult == null ? "—" : money(campaign.costPerResult)}</td>
          <td className="sticky right-0 bg-[var(--surface-panel)] px-2 py-1.5 text-right tabular-nums">{money(campaign.spend)}</td>
        </tr>
      ))}
    </>
  );
}
