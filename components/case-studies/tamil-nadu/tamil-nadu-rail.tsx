"use client";

import { useMemo } from "react";
import { Maximize2 } from "lucide-react";
import { TN_COLOR, TN_GROUPS, TN_SURVEY_GROUPS, TN_LABEL, TN_FULL, TN_SEAT_GROUPS, tnPct, type TnGroup, type TnSeatGroup, type TnShares, type TnYear } from "@/lib/tamil-nadu/model";
import { AMI_EXIT_POLL, TN_SOCIAL } from "@/lib/tamil-nadu/comparison";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import EChart from "@/components/case-studies/telangana/echart";
import { cn } from "@/lib/utils";

export type TnTab = "change" | "share" | "seats";
const TABS: { id: TnTab; label: string }[] = [
  { id: "change", label: "Change" }, { id: "share", label: "Share" }, { id: "seats", label: "Seats" },
];
export type TnView = "polls" | "social";

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

type DisplayGroup = { key: string; label: string; color: string; groups: TnGroup[] };

const fmtNumber = (n: number) => n.toLocaleString("en-US");
const sumShares = (shares: TnShares | null | undefined, groups: TnGroup[]) => {
  const values = groups
    .map((group) => shares?.[group])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
};

/* One active-tab treatment across the whole compact panel. */
const segWrap = "inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-muted/20 p-0.5";
const segButton = (active: boolean) => cn(
  "rounded-md px-2 py-1 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60",
  active ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
);

function SocialMediaPanel({ compact }: { compact: boolean }) {
  return (
    <div className="mt-2">
      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table className={cn("w-full table-fixed border-collapse", compact ? "min-w-[270px] text-[8px]" : "min-w-[300px] text-[8.5px]")}>
          <caption className="sr-only">Tamil Nadu statewide Meta reach</caption>
          <colgroup><col className="w-[20%]" /><col className="w-[20%]" /><col className="w-[20%]" /><col className="w-[22%]" /><col className="w-[18%]" /></colgroup>
          <thead>
            <tr className="border-b border-border/70 text-right text-[7px] uppercase tracking-wide text-muted-foreground">
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
                <tr key={row.platform} className={cn("border-t border-border/50", total && "bg-muted/15 font-semibold")}>
                  <th scope="row" className={cn("px-1 text-left font-medium", compact ? "py-1" : "py-1.5")}>{row.platform}</th>
                  <td className={cn("px-1 text-right tabular-nums", compact ? "py-1" : "py-1.5")}>{fmtNumber(row.organic)}</td>
                  <td className={cn("px-1 text-right tabular-nums", compact ? "py-1" : "py-1.5")}>{fmtNumber(row.paid)}</td>
                  <td className={cn("px-1 text-right tabular-nums", compact ? "py-1" : "py-1.5")}>{fmtNumber(row.total)}</td>
                  <td className={cn("px-1 text-right tabular-nums", compact ? "py-1" : "py-1.5")}>{fmtNumber(row.followers)}</td>
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

function PartyCell({ group, compact }: { group: TnGroup; compact: boolean }) {
  const partners = TN_FULL[group].split("+").slice(1).join(" + ");
  return (
    <span className="flex items-start gap-1">
      <span className={cn("shrink-0 rounded-sm", compact ? "mt-[4px] size-1.5" : "mt-[5px] size-1.5")} style={{ background: TN_COLOR[group] }} />
      <span className="min-w-0">
        <span className="block leading-tight">{TN_LABEL[group]}</span>
        {partners && !compact && <span className="mt-0.5 block text-[7px] font-normal leading-tight text-muted-foreground">{partners}</span>}
      </span>
    </span>
  );
}

function DisplayPartyCell({ group, compact }: { group: DisplayGroup; compact: boolean }) {
  if (group.groups.length === 1) return <PartyCell group={group.groups[0]} compact={compact} />;
  return (
    <span className="flex items-start gap-1">
      <span className={cn("shrink-0 rounded-sm", compact ? "mt-[4px] size-1.5" : "mt-[5px] size-1.5")} style={{ background: group.color }} />
      <span className="min-w-0"><span className="block leading-tight">{group.label}</span></span>
    </span>
  );
}

export default function TamilNaduRail({
  scope, tab, onTab, onExpand, theme, selectedYear, isStatewide, opinionPoll, actualShares,
  view, onView, panelWidth = 500,
}: {
  scope: TnScopeResult; tab: TnTab; onTab: (t: TnTab) => void; onExpand: () => void;
  theme: "light" | "dark"; selectedYear: TnYear | "2026"; isStatewide: boolean;
  opinionPoll: OpinionPollView; actualShares: TnShares | null;
  view: TnView; onView: (view: TnView) => void; panelWidth?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const p = palette(theme);
  const compact = panelWidth < 430;
  const roomy = panelWidth >= 540;
  const baselineLabel = scope.baselineYear;
  const displayGroups = useMemo<DisplayGroup[]>(() => {
    const source = isStatewide ? TN_GROUPS : TN_SURVEY_GROUPS;
    const base = source.filter((group) => group !== "NOTA" && group !== "Others");
    return [
      ...base.map((group) => ({ key: group, label: TN_LABEL[group], color: TN_COLOR[group], groups: [group] })),
      { key: "others-nota", label: "Others & NOTA", color: "#64748B", groups: ["NOTA", "Others"] },
    ];
  }, [isStatewide]);

  const baselineValue = (group: DisplayGroup) => {
    if (!scope.baselineAvailable) return null;
    if (!group.groups.some((key) => scope.presence[scope.baselineYear][key])) return null;
    return sumShares(scope.baseline, group.groups);
  };
  const currentValue = (group: DisplayGroup) => (scope.currentValid > 0 ? sumShares(scope.current, group.groups) : null);
  const changeValue = (group: DisplayGroup) => {
    const base = baselineValue(group); const current = currentValue(group);
    return base == null || current == null ? null : (current - base) * 100;
  };
  const baselineTitle = (group: DisplayGroup) => {
    if (!group.groups.some((key) => scope.presence[scope.baselineYear][key])) return "Not applicable — this party/group did not contest this election";
    if (!scope.baselineAvailable) return "No verified result at this scope";
    return undefined;
  };
  const partners = (group: TnGroup) => TN_FULL[group].split("+").slice(1).join(" + ");
  const rowPad = compact ? "py-1" : "py-1.5";

  const changeOption = useMemo(() => {
    const values = displayGroups.map(changeValue).filter((value): value is number => value != null);
    const magnitude = Math.max(0.5, ...values.map((value) => Math.abs(value)));
    const step = Math.max(1, Math.ceil((magnitude * 1.12) / 2));
    const limit = step * 2;
    const sorted = [...displayGroups].sort((a, b) => (changeValue(b) ?? -999) - (changeValue(a) ?? -999));
    return {
      animation: !reduced, animationDuration: 500, animationEasing: "cubicOut",
      grid: { left: compact ? 96 : 108, right: roomy ? 46 : 38, top: 8, bottom: 22 },
      tooltip: {
        ...tip(p), trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const index = Array.isArray(params) ? (params[0] as { dataIndex: number } | undefined)?.dataIndex ?? 0 : 0;
          const group = sorted[index];
          if (!group) return "";
          const base = baselineValue(group), current = currentValue(group), change = changeValue(group);
          return `<div style="font-weight:600;margin-bottom:2px">${group.label}</div>${baselineLabel} result <b>${tnPct(base)}</b><br/>2026 estimate <b>${tnPct(current)}</b><br/>Change <b>${change == null ? "—" : signed(change)} pp</b>`;
        },
      },
      xAxis: {
        type: "value", min: -limit, max: limit, interval: step,
        axisLabel: { color: p.muted, fontSize: 8.5, formatter: (value: number) => `${value > 0 ? "+" : ""}${value}` },
        splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false },
      },
      yAxis: {
        type: "category", data: sorted.map((group) => group.label), inverse: true,
        axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } },
        axisLabel: { color: p.text, fontSize: 9 },
      },
      series: [{
        type: "bar", barMaxWidth: 12,
        data: sorted.map((group) => {
          const value = changeValue(group);
          const showLabel = roomy && value != null;
          return {
            value: value == null ? null : +value.toFixed(2),
            itemStyle: { color: group.color, borderRadius: 2 },
            label: showLabel ? {
              show: true, position: value >= 0 ? "right" : "left", color: p.text, fontSize: 8.5, fontWeight: 600,
              formatter: `${value > 0 ? "+" : ""}${value.toFixed(1)}`,
            } : { show: false },
          };
        }),
        markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: p.axis, width: 1 }, data: [{ xAxis: 0 }] },
      }],
    };
  }, [scope, baselineLabel, p, reduced, displayGroups, compact, roomy]);

  const shareOption = useMemo(() => {
    const max = Math.max(10, Math.ceil((Math.max(...displayGroups.map((group) => currentValue(group) ?? 0)) * 100 + 4) / 10) * 10);
    return {
      animation: !reduced, animationDuration: 500,
      grid: { left: compact ? 96 : 108, right: roomy ? 52 : 44, top: 8, bottom: 22 },
      tooltip: {
        ...tip(p), trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const index = Array.isArray(params) ? (params[0] as { dataIndex: number } | undefined)?.dataIndex ?? 0 : 0;
          const group = displayGroups[index];
          if (!group) return "";
          return `<div style="font-weight:600;margin-bottom:2px">${group.label}</div>2026 estimate <b>${tnPct(currentValue(group))}</b><br/>${baselineLabel} result <b>${tnPct(baselineValue(group))}</b>`;
        },
      },
      xAxis: { type: "value", max, axisLabel: { color: p.muted, fontSize: 8.5, formatter: "{value}%" }, splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: { type: "category", data: displayGroups.map((group) => group.label), inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.text, fontSize: 9 } },
      series: [{
        type: "bar", barMaxWidth: 12,
        data: displayGroups.map((group) => ({
          value: +((currentValue(group) ?? 0) * 100).toFixed(2),
          itemStyle: { color: group.color, borderRadius: 2 },
          label: compact ? { show: false } : { show: true, position: "right", color: p.text, fontSize: 8.5, formatter: currentValue(group) == null ? "—" : `${((currentValue(group) ?? 0) * 100).toFixed(2)}%` },
        })),
      }],
    };
  }, [scope, baselineLabel, p, reduced, displayGroups, compact, roomy]);

  const chartHeight = roomy ? 210 : compact ? 160 : 180;
  const seatRows = [...TN_SEAT_GROUPS];
  const estimatedTotal = seatRows.reduce((s2, g) => s2 + (scope.estimatedSeats[g] ?? 0), 0);
  const actualTotal = seatRows.reduce((s2, g) => s2 + (scope.actualSeats[g] ?? 0), 0);

  return (
    <section aria-label="Tamil Nadu vote share" className="rounded-2xl border border-border bg-card/95 p-3 shadow-[0_18px_50px_-30px_rgba(15,20,30,0.55)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold leading-tight">Tamil Nadu {selectedYear} · Vote Share</h2>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            {isStatewide ? "Statewide" : scope.label}
          </p>
        </div>
        <button type="button" onClick={onExpand} aria-label="Expand the vote-share analysis"
          className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-saffron/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
          <Maximize2 className="size-3" /> Expand
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className={cn(segWrap, "grid min-w-0 flex-1 grid-cols-2")} role="tablist" aria-label="Comparison content">
          <button type="button" role="tab" aria-selected={view === "polls"} onClick={() => onView("polls")} className={segButton(view === "polls")}>
            Polls
          </button>
          <button type="button" role="tab" aria-selected={view === "social"} onClick={() => onView("social")} className={segButton(view === "social")}>
            Social Media
          </button>
        </div>
      </div>

      {view === "social" ? (
        <SocialMediaPanel compact={compact} />
      ) : (
        <>
          {isStatewide ? (
            <div className="mt-2 overflow-x-auto rounded-lg border border-border/70">
              <table className={cn("w-full table-fixed border-collapse", compact ? "min-w-[318px] text-[8.5px]" : "min-w-[400px] text-[9.5px]")}>
                <caption className="sr-only">Tamil Nadu vote-share comparison</caption>
                <colgroup><col className="w-[34%]" /><col className="w-[22%]" /><col className="w-[22%]" /><col className="w-[22%]" /></colgroup>
                <thead>
                  <tr className="border-b border-border/70 text-left text-[8px] uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className={cn("px-1.5 text-left font-semibold", compact ? "py-1" : "py-1.5")}>Party</th>
                    <th scope="col" className={cn("px-1 text-right font-semibold", compact ? "py-1" : "py-1.5")}>Exit Poll</th>
                    <th scope="col" className={cn("px-1 text-right font-semibold", compact ? "py-1" : "py-1.5")}>Opinion Poll</th>
                    <th scope="col" className={cn("border-l border-border/60 px-1 text-right font-semibold", compact ? "py-1" : "py-1.5")}>Actual Result</th>
                  </tr>
                </thead>
                <tbody>
                  {displayGroups.map((group) => (
                    <tr key={group.key} className="border-t border-border/50">
                      <th scope="row" className={cn("px-1.5 text-left font-medium", rowPad)}><DisplayPartyCell group={group} compact={compact} /></th>
                      <td className={cn("px-1 text-right tabular-nums", rowPad)}>{tnPct(sumShares(AMI_EXIT_POLL.shares, group.groups))}</td>
                      <td className={cn("px-1 text-right tabular-nums", rowPad)}>{tnPct(opinionPoll.available ? sumShares(opinionPoll.shares, group.groups) : null)}</td>
                      <td className={cn("border-l border-border/60 px-1 text-right tabular-nums", rowPad)}>{tnPct(sumShares(actualShares, group.groups))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-lg border border-border/70">
              <table className={cn("w-full table-fixed border-collapse", compact ? "min-w-[312px] text-[8.5px]" : "min-w-[390px] text-[9.5px]")}>
                <caption className="sr-only">{scope.label} local survey estimate, {baselineLabel} historical result and local actual availability.</caption>
                <colgroup><col className="w-[34%]" /><col className="w-[22%]" /><col className="w-[22%]" /><col className="w-[22%]" /></colgroup>
                <thead>
                  <tr className="border-b border-border/70 text-left text-[8px] uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className={cn("px-1.5 text-left font-semibold", compact ? "py-1" : "py-1.5")}>Party</th>
                    <th scope="col" className={cn("px-1 text-right font-semibold", compact ? "py-1" : "py-1.5")}>Survey Estimate</th>
                    <th scope="col" className={cn("px-1 text-right font-semibold", compact ? "py-1" : "py-1.5")}>{baselineLabel} Result</th>
                    <th scope="col" className={cn("border-l border-border/60 px-1 text-right font-semibold", compact ? "py-1" : "py-1.5")}>Actual Result</th>
                  </tr>
                </thead>
                <tbody>
                  {displayGroups.map((group) => (
                    <tr key={group.key} className="border-t border-border/50">
                      <th scope="row" className={cn("px-1.5 text-left font-medium", rowPad)}><DisplayPartyCell group={group} compact={compact} /></th>
                      <td className={cn("px-1 text-right font-semibold tabular-nums", rowPad)}>{tnPct(currentValue(group))}</td>
                      <td className={cn("px-1 text-right tabular-nums text-muted-foreground", rowPad)} title={baselineTitle(group)}>{tnPct(baselineValue(group))}</td>
                      <td className={cn("border-l border-border/60 px-1 text-right tabular-nums text-muted-foreground", rowPad)}>—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={cn(segWrap, "mt-2 grid w-full grid-cols-3")} role="tablist" aria-label="Comparison views">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => onTab(t.id)} className={segButton(tab === t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="pt-2">
            {tab === "change" && (
              <>
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Estimated minus {baselineLabel} (pp)</p>
                <EChart option={changeOption} height={chartHeight} reduced={reduced} ariaLabel={`Signed percentage-point change from ${baselineLabel} to the 2026 estimate for ${scope.label}`} />
              </>
            )}
            {tab === "share" && (
              <>
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Estimated vote share</p>
                <EChart option={shareOption} height={chartHeight} reduced={reduced} ariaLabel={`2026 estimated vote share for ${scope.label}`} />
              </>
            )}
            {tab === "seats" && (
              <div className="space-y-2">
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Estimated seats · actual shown separately</p>
                <div className="overflow-hidden rounded-md border border-border/70">
                  <table className={cn("w-full border-collapse", compact ? "text-[9px]" : "text-[10px]")}>
                    <thead>
                      <tr className="border-b border-border/70 text-[8px] uppercase tracking-wide text-muted-foreground">
                        <th className={cn("px-1 text-left", rowPad)}>Party</th>
                        <th className={cn("px-1 text-right", rowPad)}>Estimated</th>
                        <th className={cn("px-1 text-right", rowPad)}>Actual 2026</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seatRows.map((g) => (
                        <tr key={g} className="border-t border-border/50">
                          <td className={cn("px-1", rowPad)}>
                            <span className="inline-flex items-start gap-1" style={{ color: TN_COLOR[g] }}>
                              <span className="mt-[4px] size-1.5 shrink-0 rounded-sm" style={{ background: TN_COLOR[g] }} />
                              <span className="min-w-0">
                                <span className="block leading-tight">{TN_LABEL[g]}</span>
                                {partners(g) && !compact && <span className="mt-0.5 block text-[7px] font-normal leading-tight text-muted-foreground">{partners(g)}</span>}
                              </span>
                            </span>
                          </td>
                          <td className={cn("px-1 text-right font-semibold tabular-nums", rowPad)}>{scope.estimatedSeats[g] ?? 0}</td>
                          <td className={cn("px-1 text-right tabular-nums", rowPad)}>{scope.actualSeats[g] ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border bg-muted/20 text-[9px]">
                        <td className={cn("px-1", rowPad)}>Total</td>
                        <td className={cn("px-1 text-right tabular-nums", rowPad)}>{estimatedTotal}</td>
                        <td className={cn("px-1 text-right tabular-nums", rowPad)}>{actualTotal}</td>
                      </tr>
                    </tfoot>
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
