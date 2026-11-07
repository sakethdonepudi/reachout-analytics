"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Maximize2 } from "lucide-react";
import { TN_COLOR, TN_GROUPS, TN_SURVEY_GROUPS, TN_LABEL, TN_FULL, TN_SEAT_GROUPS, tnPct, type TnGroup, type TnSeatGroup, type TnShares, type TnYear } from "@/lib/tamil-nadu/model";
import { AMI_EXIT_POLL, ECI_ACTUAL, TN_OPINION_POLL, TN_SOCIAL } from "@/lib/tamil-nadu/comparison";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import EChart from "@/components/case-studies/telangana/echart";
import { cn } from "@/lib/utils";

export type TnTab = "change" | "share" | "seats";
const TABS: { id: TnTab; label: string }[] = [
  { id: "change", label: "Change" }, { id: "share", label: "Share" }, { id: "seats", label: "Seats" },
];

export type TnScopeResult = {
  label: string;
  baselineYear: TnYear;
  baseline: TnShares;
  current: TnShares;
  change: TnShares;
  baselineAvailable: boolean;
  currentValid: number;
  presence: Record<TnYear, Record<TnGroup, boolean>>;
  estimatedSeats: Record<TnSeatGroup, number>;
  actualSeats: Record<TnSeatGroup, number>;
  currentLabel: string;
  surveyLeader: TnGroup | null;
};

function palette(theme: "light" | "dark") {
  const dark = theme === "dark";
  return {
    axis: dark ? "rgba(190,202,218,.4)" : "rgba(70,86,104,.45)",
    grid: dark ? "rgba(255,255,255,.07)" : "rgba(20,24,31,.08)",
    text: dark ? "#dfe5ee" : "#232a33",
    muted: dark ? "rgba(223,229,238,.55)" : "rgba(35,42,51,.55)",
    bg: dark ? "rgba(16,22,30,.97)" : "rgba(255,255,255,.98)",
    border: dark ? "rgba(120,135,155,.35)" : "rgba(20,24,31,.12)",
  };
}
type Pal = ReturnType<typeof palette>;
const tip = (p: Pal) => ({
  confine: true, backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, padding: [7, 9],
  textStyle: { color: p.text, fontSize: 11, fontFamily: "inherit" },
  extraCssText: "border-radius:8px;box-shadow:0 12px 30px -14px rgba(0,0,0,.55);max-width:280px;",
});
const signed = (v: number, digits = 2) => `${v > 0 ? "+" : ""}${v.toFixed(digits)}`;

export type OpinionPollView = { shares: TnShares; valid: number; asOf: string | null; available: boolean; source: "published" | "workbook" };

const fmtNumber = (n: number) => n.toLocaleString("en-US");
const fmtDate = (iso: string | null) => {
  if (!iso) return "date unavailable";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "date unavailable" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

function SocialMediaPanel() {
  return (
    <div className="mt-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[300px] table-fixed border-collapse text-[8.5px]">
          <caption className="sr-only">Tamil Nadu statewide Meta reach</caption>
          <colgroup><col className="w-[20%]" /><col className="w-[20%]" /><col className="w-[20%]" /><col className="w-[22%]" /><col className="w-[18%]" /></colgroup>
          <thead>
            <tr className="bg-muted/30 text-right text-[7px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-1 py-1.5 text-left font-semibold">Platform</th>
              <th scope="col" className="px-1 py-1.5 font-semibold">Organic reach</th>
              <th scope="col" className="px-1 py-1.5 font-semibold">Paid reach</th>
              <th scope="col" className="px-1 py-1.5 font-semibold">Total reach</th>
              <th scope="col" className="px-1 py-1.5 font-semibold">Followers</th>
            </tr>
          </thead>
          <tbody>
            {TN_SOCIAL.rows.map((row) => {
              const total = row.platform === "Total";
              return (
                <tr key={row.platform} className={cn("border-t border-border/60", total && "bg-muted/20 font-semibold")}>
                  <th scope="row" className="px-1 py-1.5 text-left font-medium">{row.platform}</th>
                  <td className="px-1 py-1.5 text-right tabular-nums">{fmtNumber(row.organic)}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums">{fmtNumber(row.paid)}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums">{fmtNumber(row.total)}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums">{fmtNumber(row.followers)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2.5">
        <div className="flex items-center justify-between text-[8.5px] font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm bg-[#2fbf4a]" />Organic {TN_SOCIAL.organicPct}%</span>
          <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm bg-saffron" />Paid {TN_SOCIAL.paidPct}%</span>
        </div>
        <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Meta reach split: ${TN_SOCIAL.organicPct}% organic and ${TN_SOCIAL.paidPct}% paid`}>
          <span className="bg-[#2fbf4a]" style={{ width: `${TN_SOCIAL.organicPct}%` }} />
          <span className="bg-saffron" style={{ width: `${TN_SOCIAL.paidPct}%` }} />
        </div>
      </div>

    </div>
  );
}

function PartyCell({ group }: { group: TnGroup }) {
  const partners = TN_FULL[group].split("+").slice(1).join(" + ");
  return (
    <span className="flex items-start gap-1">
      <span className="mt-1 size-1.5 shrink-0 rounded-sm" style={{ background: TN_COLOR[group] }} />
      <span className="min-w-0">
        <span className="block leading-tight">{TN_LABEL[group]}</span>
        {partners && <span className="mt-0.5 block text-[7px] font-normal leading-tight text-muted-foreground">{partners}</span>}
      </span>
    </span>
  );
}

export default function TamilNaduRail({
  scope, tab, onTab, onExpand, theme, selectedYear, isStatewide, opinionPoll, actualShares,
}: {
  scope: TnScopeResult; tab: TnTab; onTab: (t: TnTab) => void; onExpand: () => void;
  theme: "light" | "dark"; selectedYear: TnYear | "2026"; isStatewide: boolean;
  opinionPoll: OpinionPollView; actualShares: TnShares | null;
}) {
  const reduced = usePrefersReducedMotion();
  const [view, setView] = useState<"polls" | "social">("polls");
  const p = palette(theme);
  const baselineLabel = scope.baselineYear;
  const baselineValue = (g: TnGroup) => {
    if (!scope.presence[scope.baselineYear][g]) return null;
    if (!scope.baselineAvailable) return null;
    return scope.baseline[g] ?? null;
  };
  const currentValue = (g: TnGroup) => (scope.currentValid > 0 ? scope.current[g] ?? 0 : null);
  const changeValue = (g: TnGroup) => {
    const b = baselineValue(g); const c = currentValue(g);
    return b == null || c == null ? null : (c - b) * 100;
  };
  const baselineTitle = (g: TnGroup) => {
    if (!scope.presence[scope.baselineYear][g]) return "Not applicable — this party/group did not contest this election";
    if (!scope.baselineAvailable) return "No verified result at this scope";
    return undefined;
  };

  const visibleGroups = isStatewide ? TN_GROUPS : TN_SURVEY_GROUPS;
  const partners = (g: TnGroup) => TN_FULL[g].split("+").slice(1).join(" + ");
  const changeOption = useMemo(() => {
    const values = visibleGroups.map(changeValue).filter((v): v is number => v != null);
    const vals = Math.max(0.5, ...values.map((v) => Math.abs(v)));
    const step = Math.max(1, Math.ceil((vals * 1.12) / 2));
    const M = step * 2;
    const sorted = [...visibleGroups].sort((a, b) => (changeValue(b) ?? -999) - (changeValue(a) ?? -999));
    return {
      animation: !reduced, animationDuration: 500, animationEasing: "cubicOut",
      grid: { left: 104, right: 42, top: 8, bottom: 22 },
      tooltip: {
        ...tip(p), trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const i = Array.isArray(params) ? (params[0] as { dataIndex: number } | undefined)?.dataIndex ?? 0 : 0;
          const x = sorted[i]; const b = baselineValue(x), c = currentValue(x), ch = changeValue(x);
          if (!x) return "";
          return `<div style="font-weight:600;margin-bottom:2px">${TN_LABEL[x]}</div>${baselineLabel} result <b>${tnPct(b)}</b><br/>2026 estimate <b>${tnPct(c)}</b><br/>Change <b>${ch == null ? "—" : signed(ch)} pp</b>`;
        },
      },
      xAxis: {
        type: "value", min: -M, max: M, interval: step,
        axisLabel: { color: p.muted, fontSize: 8.5, formatter: (v: number) => `${v > 0 ? "+" : ""}${v}` },
        splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false },
      },
      yAxis: {
        type: "category", data: sorted.map((x) => TN_LABEL[x]), inverse: true,
        axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } },
        axisLabel: { color: p.text, fontSize: 9 },
      },
      series: [{
        type: "bar", barMaxWidth: 12,
        data: sorted.map((x) => {
          const v = changeValue(x);
          return { value: v == null ? 0 : +v.toFixed(2), itemStyle: { color: v == null ? "transparent" : TN_COLOR[x], borderRadius: 2 }, opacity: v == null ? 0 : 1 };
        }),
        markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: p.axis, width: 1 }, data: [{ xAxis: 0 }] },
      }],
    };
  }, [scope, baselineLabel, p, reduced, theme, visibleGroups]);

  const shareOption = useMemo(() => {
    const max = Math.max(10, Math.ceil((Math.max(...visibleGroups.map((x) => currentValue(x) ?? 0)) * 100 + 4) / 10) * 10);
    return {
      animation: !reduced, animationDuration: 500,
      grid: { left: 104, right: 44, top: 8, bottom: 22 },
      tooltip: {
        ...tip(p), trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const i = Array.isArray(params) ? (params[0] as { dataIndex: number } | undefined)?.dataIndex ?? 0 : 0;
          const x = visibleGroups[i];
          if (!x) return "";
          return `<div style="font-weight:600;margin-bottom:2px">${TN_LABEL[x]}</div>2026 estimate <b>${tnPct(currentValue(x))}</b><br/>${baselineLabel} result <b>${tnPct(baselineValue(x))}</b>`;
        },
      },
      xAxis: { type: "value", max, axisLabel: { color: p.muted, fontSize: 8.5, formatter: "{value}%" }, splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: { type: "category", data: visibleGroups.map((x) => TN_LABEL[x]), inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.text, fontSize: 9 } },
      series: [{
        type: "bar", barMaxWidth: 12,
        data: visibleGroups.map((x) => ({
          value: +((currentValue(x) ?? 0) * 100).toFixed(2),
          itemStyle: { color: TN_COLOR[x], borderRadius: 2 },
          label: { show: true, position: "right", color: p.text, fontSize: 8.5, formatter: currentValue(x) == null ? "—" : `${((currentValue(x) ?? 0) * 100).toFixed(2)}%` },
        })),
      }],
    };
  }, [scope, baselineLabel, p, reduced, theme, visibleGroups]);

  const chartHeight = 176;
  const seatRows = [...TN_SEAT_GROUPS];
  const estimatedTotal = seatRows.reduce((s2, g) => s2 + (scope.estimatedSeats[g] ?? 0), 0);
  const actualTotal = seatRows.reduce((s2, g) => s2 + (scope.actualSeats[g] ?? 0), 0);
  return (
    <section aria-label="Tamil Nadu comparison" className="rounded-2xl border border-border bg-card/95 p-3 shadow-[0_18px_50px_-30px_rgba(15,20,30,0.55)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold leading-tight">Tamil Nadu comparison</h2>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            {isStatewide ? "Statewide" : scope.label}
          </p>
        </div>
        <button type="button" onClick={onExpand} aria-label="Open the large history chart"
          className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
          <Maximize2 className="size-3" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-border p-0.5" role="tablist" aria-label="Comparison content">
        <button type="button" role="tab" aria-selected={view === "polls"} onClick={() => setView("polls")}
          className={cn("rounded-md px-2 py-1 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60", view === "polls" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
          Polls
        </button>
        <button type="button" role="tab" aria-selected={view === "social"} onClick={() => setView("social")}
          className={cn("rounded-md px-2 py-1 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60", view === "social" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
          Social Media
        </button>
      </div>

      {view === "social" ? (
        <SocialMediaPanel />
      ) : (
        <>
          {isStatewide ? (
            <div className="mt-2 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[400px] table-fixed border-collapse text-[9.5px]">
                <caption className="sr-only">Tamil Nadu statewide vote-share comparison: Axis My India exit poll, ReachOut opinion poll where published, and ECI actual result.</caption>
                <colgroup><col className="w-[35%]" /><col className="w-[20%]" /><col className="w-[23%]" /><col className="w-[22%]" /></colgroup>
                <thead>
                  <tr className="bg-muted/30 text-left text-[8px] uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-1.5 py-1.5 font-semibold">Party / group</th>
                    <th scope="col" className="px-1 py-1.5 text-right font-semibold">Exit poll<span className="mt-0.5 block text-[7px] font-normal normal-case tracking-normal">Axis My India</span></th>
                    <th scope="col" className="px-1 py-1.5 text-right font-semibold">Opinion poll<span className="mt-0.5 block text-[7px] font-normal normal-case tracking-normal">ReachOut</span></th>
                    <th scope="col" className="border-l border-border/70 px-1 py-1.5 text-right font-semibold">Actual 2026<span className="mt-0.5 block text-[7px] font-normal normal-case tracking-normal">ECI</span></th>
                  </tr>
                </thead>
                <tbody>
                  {TN_GROUPS.map((g) => (
                    <tr key={g} className="border-t border-border/60">
                      <th scope="row" className="px-1.5 py-1.5 text-left font-medium"><PartyCell group={g} /></th>
                      <td className="px-1 py-1.5 text-right tabular-nums">{tnPct(AMI_EXIT_POLL.shares[g])}</td>
                      <td className="px-1 py-1.5 text-right tabular-nums">{opinionPoll.available ? tnPct(opinionPoll.shares[g]) : "—"}</td>
                      <td className="border-l border-border/70 px-1 py-1.5 text-right tabular-nums">{tnPct(actualShares?.[g])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[390px] table-fixed border-collapse text-[9.5px]">
                <caption className="sr-only">{scope.label} local survey estimate, {baselineLabel} historical result and local actual availability.</caption>
                <colgroup><col className="w-[36%]" /><col className="w-[22%]" /><col className="w-[24%]" /><col className="w-[18%]" /></colgroup>
                <thead>
                  <tr className="bg-muted/30 text-left text-[8px] uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-1.5 py-1.5 font-semibold">Party / group</th>
                    <th scope="col" className="px-1 py-1.5 text-right font-semibold">Survey estimate<span className="mt-0.5 block text-[7px] font-normal normal-case tracking-normal">2026</span></th>
                    <th scope="col" className="px-1 py-1.5 text-right font-semibold">{baselineLabel} result<span className="mt-0.5 block text-[7px] font-normal normal-case tracking-normal">verified</span></th>
                    <th scope="col" className="border-l border-border/70 px-1 py-1.5 text-right font-semibold">Actual 2026<span className="mt-0.5 block text-[7px] font-normal normal-case tracking-normal">ECI</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleGroups.map((g) => (
                    <tr key={g} className="border-t border-border/60">
                      <th scope="row" className="px-1.5 py-1.5 text-left font-medium"><PartyCell group={g} /></th>
                      <td className="px-1 py-1.5 text-right tabular-nums font-semibold">{tnPct(currentValue(g))}</td>
                      <td className="px-1 py-1.5 text-right tabular-nums text-muted-foreground" title={baselineTitle(g)}>{tnPct(baselineValue(g))}</td>
                      <td className="border-l border-border/70 px-1 py-1.5 text-right tabular-nums text-muted-foreground">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-1.5 space-y-1 text-[8.5px] leading-relaxed text-muted-foreground">
            {isStatewide ? (
              <>
                <p>
                  <a href={AMI_EXIT_POLL.source} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-foreground">Exit Poll · {AMI_EXIT_POLL.sourceName}<ExternalLink className="ml-0.5 inline size-2.5" /></a> · Statewide projection.
                </p>
                <p>
                  {opinionPoll.available
                    ? opinionPoll.source === "published"
                      ? `Opinion Poll · ReachOut Analytics — dataset updated ${fmtDate(opinionPoll.asOf)} · ${fmtNumber(opinionPoll.valid)} valid responses (unweighted).`
                      : `Opinion Poll · ReachOut Analytics — raw survey share from SAKET_TN_District_Estimate_calibrated_v2.xlsx · ${fmtNumber(opinionPoll.valid)} party-choice responses (unweighted).`
                    : "Opinion poll data unavailable."}
                </p>
                {opinionPoll.available && <p>{TN_OPINION_POLL.note}</p>}
                <p>
                  <a href={ECI_ACTUAL.source} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-foreground">Actual result source: {ECI_ACTUAL.sourceName}<ExternalLink className="ml-0.5 inline size-2.5" /></a> · {ECI_ACTUAL.declaration}.
                </p>
                <p>{ECI_ACTUAL.note}</p>
              </>
            ) : (
              <p>Exit and opinion polls are statewide only and are not applied to district or assembly views. Local actual vote shares are not supplied; seat projections remain in the Seats view.</p>
            )}
          </div>

          <details className="mt-1.5 text-[9px] leading-relaxed text-muted-foreground">
            <summary className="cursor-pointer select-none">Comparison notes</summary>
            <p className="mt-1">Historical Others is retained separately and is never folded into the alliance groups. TVK did not contest 2011–2021; NTK and NOTA are not applicable in 2011. Those baselines are shown as “—”, not zero or missing. 2016 covers 232 of 234 ACs; Aravakurichi and Thanjavur are no data.</p>
          </details>

          <div className="mt-2 flex gap-1 border-b border-border" role="tablist" aria-label="Comparison views">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => onTab(t.id)}
                className={cn("-mb-px rounded-t-md border-b-2 px-2 py-1 text-[10.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60",
                  tab === t.id ? "border-saffron text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="pt-2">
            {tab === "change" && <><p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Estimated minus {baselineLabel} (pp)</p><EChart option={changeOption} height={chartHeight} reduced={reduced} ariaLabel={`Signed percentage-point change from ${baselineLabel} to the 2026 estimate for ${scope.label}`} /></>}
            {tab === "share" && <><p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Estimated vote share</p><EChart option={shareOption} height={chartHeight} reduced={reduced} ariaLabel={`2026 estimated vote share for ${scope.label}`} /></>}
            {tab === "seats" && (
              <div className="space-y-2">
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Estimated seats · actual shown separately</p>
                <div className="overflow-hidden rounded-md border border-border">
                  <table className="w-full border-collapse text-[10px]">
                    <thead><tr className="bg-muted/30 text-[8px] uppercase tracking-wide text-muted-foreground"><th className="px-1 py-1 text-left">Party</th><th className="px-1 py-1 text-right">Estimated</th><th className="px-1 py-1 text-right">Actual 2026</th></tr></thead>
                    <tbody>{seatRows.map((g) => <tr key={g} className="border-t border-border/60"><td className="px-1 py-1"><span className="inline-flex items-start gap-1" style={{ color: TN_COLOR[g] }}><span className="mt-1 size-1.5 shrink-0 rounded-sm" style={{ background: TN_COLOR[g] }} /><span className="min-w-0"><span className="block leading-tight">{TN_LABEL[g]}</span>{partners(g) && <span className="mt-0.5 block text-[7px] font-normal leading-tight text-muted-foreground">{partners(g)}</span>}</span></span></td><td className="px-1 py-1 text-right font-semibold tabular-nums">{scope.estimatedSeats[g] ?? 0}</td><td className="px-1 py-1 text-right tabular-nums">{scope.actualSeats[g] ?? 0}</td></tr>)}</tbody>
                    <tfoot><tr className="border-t border-border bg-muted/20 text-[9px]"><td className="px-1 py-1">Total</td><td className="px-1 py-1 text-right tabular-nums">{estimatedTotal}</td><td className="px-1 py-1 text-right tabular-nums">{actualTotal}</td></tr></tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {selectedYear === "2026" && scope.currentValid === 0 && <p className="mt-1 text-[9px] text-muted-foreground">No valid 2026 estimate in this scope.</p>}
    </section>
  );
}
