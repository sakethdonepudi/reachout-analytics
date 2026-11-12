"use client";

import { useState } from "react";
import type { AdsSocialView } from "@/lib/ads-desk/client-dto";
import { cn } from "@/lib/utils";

const number = (value: number) => value.toLocaleString("en-IN");
const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function SocialPanel({ regions, compact = false }: { regions: AdsSocialView[]; compact?: boolean }) {
  const [active, setActive] = useState(0);
  if (!regions.length) return <section className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-panel)] p-5 text-[13px] text-[var(--text-muted)]">Social data not uploaded yet.</section>;
  const region = regions[Math.min(active, regions.length - 1)];
  const owner = region.totals.spend != null;
  const kpis = [
    ["Reach", number(region.totals.reach)], ["Impressions", number(region.totals.impressions)],
    [region.viewsLabel ?? "Views", number(region.totals.views)], ["Clicks", number(region.totals.clicks)],
    ["Post engagement", number(region.totals.engagements)], ["Campaigns", number(region.totals.campaigns)], ["Accounts", number(region.totals.accounts)],
    ...(owner ? [["Spend", money(region.totals.spend ?? 0)]] : []),
  ];
  return (
    <section className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-panel)] p-4 sm:p-5" aria-label="Social media">
      <div className="h-1 rounded" style={{ background: region.band }} />
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Social media</p>
      <h2 className="mt-1 font-display text-xl font-semibold">{region.label}</h2>
      <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">{region.range} · {region.note} · Data as of {region.asOf}</p>
      {regions.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1 border-b border-[var(--border-hairline)]">
          {regions.map((item, index) => (
            <button key={item.label} type="button" onClick={() => setActive(index)} style={active === index ? { borderBottomColor: item.band } : undefined} className={cn("min-h-9 border-b-2 border-transparent px-2 text-[11.5px] font-semibold", active === index ? "text-foreground" : "text-[var(--text-muted)]")}>{item.label}</button>
          ))}
        </div>
      )}
      <div className={cn("mt-3 grid gap-2", compact ? "grid-cols-3" : "sm:grid-cols-3 lg:grid-cols-4")}>
        {kpis.map(([label, value]) => <div key={label} className="rounded border border-[var(--border-hairline)] px-2.5 py-2"><p className="text-[9px] uppercase tracking-[0.1em] text-[var(--text-muted)]">{label}</p><p className="mt-1 text-[14px] font-semibold tabular-nums">{value}</p></div>)}
      </div>
      <p className="mt-2 text-[10.5px] text-[var(--text-muted)]">Reach is added up per campaign, so a person reached by two campaigns counts twice.</p>
      <div className="mt-3 space-y-2">
        {region.accounts.map((account) => (
          <div key={account.name} className="rounded border border-[var(--border-hairline)]">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-[12px] font-semibold">
              {owner && account.href ? <a href={account.href} target="_blank" rel="noopener noreferrer" className="underline">{account.name}</a> : account.name}
              <span className="text-[10px] font-normal text-[var(--text-muted)]">{account.campaigns.length} campaigns</span>
              {owner && <span className="flex flex-wrap gap-2 text-[10px] font-normal">
                {account.billingHref && <a href={account.billingHref} target="_blank" rel="noopener noreferrer" className="underline">Billing</a>}
                {account.allAdsetsHref && <a href={account.allAdsetsHref} target="_blank" rel="noopener noreferrer" className="underline">All ad sets</a>}
                {account.allAdsHref && <a href={account.allAdsHref} target="_blank" rel="noopener noreferrer" className="underline">All ads</a>}
              </span>}
            </div>
            <details className="border-t border-[var(--border-hairline)]">
              <summary className="cursor-pointer px-3 py-1.5 text-[10px] font-semibold text-[var(--text-muted)]">Campaigns</summary>
              <div className="overflow-x-auto border-t border-[var(--border-hairline)]">
                <table className="w-full min-w-[760px] border-collapse text-left text-[10.5px]">
                  <thead><tr className="sticky top-0 bg-[var(--surface-raised)] text-[8.5px] uppercase tracking-wide text-[var(--text-muted)]">{["Campaign", "Delivery", "Start", "End", "Reach", "Impressions", "Views", "Clicks", "Engagement", ...(owner ? ["Ad sets", "Ads"] : []), "Results"].map((label) => <th key={label} className="px-2 py-1.5">{label}</th>)}{owner && <><th className="px-2 py-1.5 text-right">Cost per result</th><th className="px-2 py-1.5 text-right">Spend</th></>}</tr></thead>
                  <tbody>{account.campaigns.map((campaign) => <tr key={campaign.name} className="border-t border-[var(--border-hairline)]/60"><td className="px-2 py-1.5">{owner && campaign.href ? <a href={campaign.href} target="_blank" rel="noopener noreferrer" className="underline">{campaign.name}</a> : campaign.name}</td><td className="px-2 py-1.5">{campaign.delivery}</td><td className="px-2 py-1.5">{campaign.start || "—"}</td><td className="px-2 py-1.5">{campaign.end || "—"}</td><td className="px-2 py-1.5 text-right tabular-nums">{number(campaign.reach)}</td><td className="px-2 py-1.5 text-right tabular-nums">{number(campaign.impressions)}</td><td className="px-2 py-1.5 text-right tabular-nums">{number(campaign.views)}</td><td className="px-2 py-1.5 text-right tabular-nums">{number(campaign.clicks)}</td><td className="px-2 py-1.5 text-right tabular-nums">{number(campaign.engagements)}</td>{owner && <><td className="px-2 py-1.5 text-right tabular-nums">{campaign.adsets == null ? "–" : campaign.adsetsHref ? <a href={campaign.adsetsHref} target="_blank" rel="noopener noreferrer" className="underline">{number(campaign.adsets)}</a> : number(campaign.adsets)}</td><td className="px-2 py-1.5 text-right tabular-nums">{campaign.ads == null ? "–" : campaign.adsHref ? <a href={campaign.adsHref} target="_blank" rel="noopener noreferrer" className="underline">{number(campaign.ads)}</a> : number(campaign.ads)}</td></>}<td className="px-2 py-1.5">{campaign.results == null ? "—" : `${number(campaign.results)} ${campaign.resultLabel ?? ""}`}</td>{owner && <><td className="px-2 py-1.5 text-right tabular-nums">{campaign.costPerResult == null ? "—" : money(campaign.costPerResult)}</td><td className="px-2 py-1.5 text-right tabular-nums">{campaign.spend == null ? "—" : money(campaign.spend)}</td></>}</tr>)}</tbody>
                </table>
              </div>
            </details>
          </div>
        ))}
      </div>
    </section>
  );
}
