"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpRight } from "lucide-react";
import { PartyMark } from "@/components/site/party-mark";
import { indianUnits, percent } from "@/lib/ads-desk/format";
import type { DashboardAnalytics, DashboardState } from "@/lib/dashboard/data";
import { cn } from "@/lib/utils";

const rupees = (value: number) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
const money = (value: number) => `₹${indianUnits(value)}`;

function Delta({ current, previous, mode = "percent" }: { current: number; previous: number | null; mode?: "percent" | "money" }) {
  if (previous == null) return null;
  if (previous === 0) return <span className="text-[10.5px] text-[#6B6B6B]">new</span>;
  const change = ((current - previous) / previous) * 100;
  if (!Number.isFinite(change) || Math.abs(change) < 0.05) return <span className="text-[10.5px] text-[#6B6B6B]">flat</span>;
  const up = change > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10.5px] font-semibold", up ? "text-[#166534]" : "text-[#B42318]")}>
      {up ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
      {mode === "money" ? money(Math.abs(current - previous)) : `${Math.abs(change).toFixed(1)}%`}
    </span>
  );
}

function Kpi({ label, value, delta }: { label: string; value: string; delta?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#EAEAEA] bg-white p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B6B6B]">{label}</p>
      <p className="mt-1.5 font-display text-[24px] font-semibold leading-none tracking-[-0.02em] text-[#0B0B0C]">{value}</p>
      <div className="mt-1.5 min-h-4">{delta}</div>
    </div>
  );
}

const COLUMNS: { key: keyof DashboardState; label: string; align?: "right" }[] = [
  { key: "spend", label: "Spend", align: "right" },
  { key: "impressions", label: "Impressions", align: "right" },
  { key: "reach", label: "Reach", align: "right" },
  { key: "clicks", label: "Clicks", align: "right" },
  { key: "results", label: "Results", align: "right" },
  { key: "costPerResult", label: "Cost / result", align: "right" },
  { key: "campaigns", label: "Campaigns", align: "right" },
];

export default function MetaAnalytics({ data }: { data: DashboardAnalytics }) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: keyof DashboardState; asc: boolean }>({ key: "spend", asc: false });
  const states = useMemo(() => [...data.states].sort((a, b) => {
    const left = a[sort.key], right = b[sort.key];
    if (typeof left === "number" && typeof right === "number") return sort.asc ? left - right : right - left;
    return sort.asc ? String(left).localeCompare(String(right)) : String(right).localeCompare(String(left));
  }), [data.states, sort]);
  const maxSpend = Math.max(1, ...data.states.map((state) => state.spend));
  const maxDotSpend = Math.max(1, ...data.states.map((state) => state.spend));
  const maxDotResult = Math.max(1, ...data.states.map((state) => state.results));

  if (!data.version || !data.states.some((state) => state.impressions > 0)) {
    return (
      <section id="meta-analytics" className="rounded-2xl border border-[#EAEAEA] bg-white p-6 text-center shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
        <p className="font-display text-[20px] font-semibold text-[#0B0B0C]">No Meta report yet</p>
        <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Publish an Ads Manager HTML report above to see spend, reach and results here.</p>
      </section>
    );
  }

  return (
    <section id="meta-analytics" className="space-y-4" aria-label="Meta analytics">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6B6B6B]">Meta analytics</p>
          <h2 className="mt-1 font-display text-[26px] font-semibold tracking-[-0.03em] text-[#0B0B0C]">Last published report</h2>
        </div>
        <p className="text-[11.5px] text-[#6B6B6B]">
          Uploaded {new Date(data.version.uploadedAt).toLocaleString("en-IN")} · covers {data.version.range || data.version.takenAt} · version {data.version.number}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Kpi label="Total spend" value={money(data.totals.spend)} delta={<Delta current={data.totals.spend} previous={data.previous?.spend ?? null} />} />
        <Kpi label="Impressions" value={indianUnits(data.totals.impressions)} delta={<Delta current={data.totals.impressions} previous={data.previous?.impressions ?? null} />} />
        <Kpi label="Reach" value={indianUnits(data.totals.reach)} delta={<Delta current={data.totals.reach} previous={data.previous?.reach ?? null} />} />
        <Kpi label="Clicks" value={indianUnits(data.totals.clicks)} delta={<Delta current={data.totals.clicks} previous={data.previous?.clicks ?? null} />} />
        <Kpi label="Results" value={indianUnits(data.totals.results)} delta={<Delta current={data.totals.results} previous={data.previous?.results ?? null} />} />
        <Kpi label="Cost / result" value={data.totals.results > 0 ? money(data.totals.costPerResult) : "—"} delta={<Delta current={data.totals.costPerResult} previous={data.previous?.costPerResult ?? null} />} />
        <Kpi label="CTR" value={percent(data.totals.ctr)} delta={<Delta current={data.totals.ctr} previous={data.previous?.ctr ?? null} />} />
        <Kpi label="Active campaigns" value={indianUnits(data.totals.active)} delta={<Delta current={data.totals.active} previous={data.previous?.active ?? null} />} />
      </div>

      <div className="rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAEAEA] px-4 py-3">
          <h3 className="font-display text-[16px] font-semibold text-[#0B0B0C]">By state</h3>
          <p className="text-[11px] text-[#6B6B6B]">Click a row to open the social view</p>
        </div>
        <div className="overflow-x-auto">
          <table className="owner-table w-full min-w-[820px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="bg-[#FAFAFA] text-[9.5px] uppercase tracking-[0.08em] text-[#555]">
                <th className="px-4 py-2.5 font-semibold">State</th>
                {COLUMNS.map((column) => (
                  <th key={column.key} className={cn("px-3 py-2.5 font-semibold", column.align === "right" && "text-right")}>
                    <button type="button" onClick={() => setSort((current) => ({ key: column.key, asc: current.key === column.key ? !current.asc : false }))} className="inline-flex items-center gap-1 hover:text-[#0B0B0C]">{column.label}{sort.key === column.key && (sort.asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {states.map((state) => (
                <tr key={state.slug} tabIndex={0} onClick={() => router.push(`/case-studies/${state.slug}?view=social`)} onKeyDown={(event) => { if (event.key === "Enter") router.push(`/case-studies/${state.slug}?view=social`); }} className="cursor-pointer border-t border-[#EAEAEA] hover:bg-[#FAFAFA] focus:bg-[#FAFAFA]">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-lg border border-[#EAEAEA]"><PartyMark party={state.party} size="sm" /></span><span className="min-w-0"><span className="block font-semibold text-[#0B0B0C]">{state.stateName}</span><span className="text-[10px] text-[#6B6B6B]">{state.party}</span></span></span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(state.spend)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{indianUnits(state.impressions)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{indianUnits(state.reach)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{indianUnits(state.clicks)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{indianUnits(state.results)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{state.results > 0 ? money(state.costPerResult) : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{indianUnits(state.campaigns)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
          <h3 className="font-display text-[16px] font-semibold text-[#0B0B0C]">Spend by state</h3>
          <ul className="mt-3 space-y-2">
            {[...data.states].sort((a, b) => b.spend - a.spend).map((state) => (
              <li key={state.slug} className="grid grid-cols-[110px_minmax(0,1fr)_76px] items-center gap-2 text-[11px]">
                <span className="truncate text-[#555]">{state.stateName}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-[#F4F4F5]"><span className="block h-full rounded-full" style={{ width: `${(state.spend / maxSpend) * 100}%`, background: state.band }} /></span>
                <span className="text-right tabular-nums text-[#555]">{money(state.spend)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
          <h3 className="font-display text-[16px] font-semibold text-[#0B0B0C]">Results vs spend</h3>
          <p className="mt-1 text-[11px] text-[#6B6B6B]">Each dot is a state. Higher is more results for the spend.</p>
          <div className="relative mt-3 h-[190px] rounded-xl border-l border-b border-[#EAEAEA] bg-[linear-gradient(to_right,#F7F7F7_1px,transparent_1px),linear-gradient(to_bottom,#F7F7F7_1px,transparent_1px)] [background-size:25%_25%]">
            {data.states.map((state) => (
              <span key={state.slug} title={`${state.stateName}: ${money(state.spend)} spend, ${indianUnits(state.results)} results`} className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white" style={{ left: `${12 + (state.spend / maxDotSpend) * 84}%`, top: `${92 - (state.results / maxDotResult) * 80}%`, background: state.band }} />
            ))}
            <span className="absolute bottom-1 left-1 text-[9px] text-[#6B6B6B]">spend →</span>
            <span className="absolute left-1 top-1 text-[9px] text-[#6B6B6B]">results ↑</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#EAEAEA] bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-[16px] font-semibold text-[#0B0B0C]">Top 10 campaigns by results</h3>
          <p className="text-[11px] text-[#6B6B6B]">Links open Ads Manager</p>
        </div>
        <ul className="mt-2 divide-y divide-[#EAEAEA]">
          {data.campaigns.map((campaign, index) => (
            <li key={`${campaign.id}-${index}`} className="flex flex-wrap items-center gap-2 py-2 text-[11.5px]">
              <span className="w-5 text-right tabular-nums text-[#6B6B6B]">{index + 1}</span>
              <span className="size-2 shrink-0 rounded-full" style={{ background: campaign.band }} />
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-[#0B0B0C]">{campaign.name}</span><span className="text-[10.5px] text-[#6B6B6B]">{campaign.party} · {campaign.stateName}</span></span>
              <span className="tabular-nums text-[#555]">{indianUnits(campaign.results)} results</span>
              <span className="w-20 text-right tabular-nums text-[#6B6B6B]">{money(campaign.spend)}</span>
              {campaign.href && <a href={campaign.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[#EAEAEA] px-2 text-[10.5px] font-semibold text-[#0B0B0C]">Ads Manager<ArrowUpRight className="size-3" /></a>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function AnalyticsSkeleton() {
  return (
    <section aria-label="Loading Meta analytics" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-[92px] animate-pulse rounded-xl border border-[#EAEAEA] bg-white" />)}</div>
      <div className="h-[260px] animate-pulse rounded-2xl border border-[#EAEAEA] bg-white" />
      <div className="grid gap-4 xl:grid-cols-2"><div className="h-[260px] animate-pulse rounded-2xl border border-[#EAEAEA] bg-white" /><div className="h-[260px] animate-pulse rounded-2xl border border-[#EAEAEA] bg-white" /></div>
    </section>
  );
}
