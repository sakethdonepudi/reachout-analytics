"use client";

import { useMemo } from "react";
import { Maximize2 } from "lucide-react";
import { TN_COLOR, TN_GROUPS, TN_LABEL, tnPct, type TnGroup, type TnShares, type TnYear } from "@/lib/tamil-nadu/model";
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
  projectedSeats: Record<TnGroup, number>;
  actualSeats: Record<TnGroup, number>;
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

export default function TamilNaduRail({
  scope, tab, onTab, onExpand, theme, selectedYear, isStatewide,
}: {
  scope: TnScopeResult; tab: TnTab; onTab: (t: TnTab) => void; onExpand: () => void;
  theme: "light" | "dark"; selectedYear: TnYear | "2026"; isStatewide: boolean;
}) {
  const reduced = usePrefersReducedMotion();
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

  const changeOption = useMemo(() => {
    const values = TN_GROUPS.map(changeValue).filter((v): v is number => v != null);
    const vals = Math.max(0.5, ...values.map((v) => Math.abs(v)));
    const step = Math.max(1, Math.ceil((vals * 1.12) / 2));
    const M = step * 2;
    const sorted = [...TN_GROUPS].sort((a, b) => (changeValue(b) ?? -999) - (changeValue(a) ?? -999));
    return {
      animation: !reduced, animationDuration: 500, animationEasing: "cubicOut",
      grid: { left: 104, right: 42, top: 8, bottom: 22 },
      tooltip: {
        ...tip(p), trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const i = Array.isArray(params) ? (params[0] as { dataIndex: number } | undefined)?.dataIndex ?? 0 : 0;
          const x = sorted[i]; const b = baselineValue(x), c = currentValue(x), ch = changeValue(x);
          if (!x) return "";
          return `<div style="font-weight:600;margin-bottom:2px">${TN_LABEL[x]}</div>${baselineLabel} result <b>${tnPct(b)}</b><br/>2026 exit-poll estimate <b>${tnPct(c)}</b><br/>Change <b>${ch == null ? "—" : signed(ch)} pp</b>`;
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
  }, [scope, baselineLabel, p, reduced, theme]);

  const shareOption = useMemo(() => {
    const max = Math.max(10, Math.ceil((Math.max(...TN_GROUPS.map((x) => currentValue(x) ?? 0)) * 100 + 4) / 10) * 10);
    return {
      animation: !reduced, animationDuration: 500,
      grid: { left: 104, right: 44, top: 8, bottom: 22 },
      tooltip: {
        ...tip(p), trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const i = Array.isArray(params) ? (params[0] as { dataIndex: number } | undefined)?.dataIndex ?? 0 : 0;
          const x = TN_GROUPS[i];
          if (!x) return "";
          return `<div style="font-weight:600;margin-bottom:2px">${TN_LABEL[x]}</div>2026 exit-poll estimate <b>${tnPct(currentValue(x))}</b><br/>${baselineLabel} result <b>${tnPct(baselineValue(x))}</b>`;
        },
      },
      xAxis: { type: "value", max, axisLabel: { color: p.muted, fontSize: 8.5, formatter: "{value}%" }, splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: { type: "category", data: TN_GROUPS.map((x) => TN_LABEL[x]), inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.text, fontSize: 9 } },
      series: [{
        type: "bar", barMaxWidth: 12,
        data: TN_GROUPS.map((x) => ({
          value: +((currentValue(x) ?? 0) * 100).toFixed(2),
          itemStyle: { color: TN_COLOR[x], borderRadius: 2 },
          label: { show: true, position: "right", color: p.text, fontSize: 8.5, formatter: currentValue(x) == null ? "—" : `${((currentValue(x) ?? 0) * 100).toFixed(2)}%` },
        })),
      }],
    };
  }, [scope, baselineLabel, p, reduced, theme]);

  const chartHeight = 176;
  const seatRows = TN_GROUPS.filter((g) => (scope.projectedSeats[g] ?? 0) > 0 || (scope.actualSeats[g] ?? 0) > 0);
  const seatTotal = seatRows.reduce((s2, g) => s2 + (scope.projectedSeats[g] ?? 0), 0);
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

      <div className="mt-2 overflow-hidden rounded-lg border border-border">
        <table className="w-full table-fixed border-collapse text-[10.5px]">
          <caption className="sr-only">{scope.label} {baselineLabel} result and 2026 exit-poll estimate</caption>
          <colgroup><col className="w-[44%]" /><col className="w-[19%]" /><col className="w-[22%]" /><col className="w-[15%]" /></colgroup>
          <thead>
            <tr className="bg-muted/30 text-left text-[8.5px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-1.5 py-1.5 font-semibold">Party / group</th>
              <th scope="col" className="px-1 py-1.5 text-right font-semibold">{baselineLabel} result</th>
              <th scope="col" className="px-1 py-1.5 text-right font-semibold">{scope.currentLabel}</th>
              <th scope="col" className="px-1 py-1.5 text-right font-semibold">Change (pp)</th>
            </tr>
          </thead>
          <tbody>
            {TN_GROUPS.map((g) => {
              const b = baselineValue(g), c = currentValue(g), ch = changeValue(g);
              return (
                <tr key={g} className="border-t border-border/60">
                  <th scope="row" className="px-1.5 py-1.5 text-left font-medium">
                    <span className="flex items-center gap-1"><span className="size-1.5 shrink-0 rounded-sm" style={{ background: TN_COLOR[g] }} /><span className="leading-tight">{TN_LABEL[g]}</span></span>
                  </th>
                  <td className="px-1 py-1.5 text-right tabular-nums text-muted-foreground" title={baselineTitle(g)}>{tnPct(b)}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums font-semibold">{tnPct(c)}</td>
                  <td className={cn("px-1 py-1.5 text-right tabular-nums", ch == null ? "text-muted-foreground" : ch > 0 ? "text-emerald-600 dark:text-emerald-400" : ch < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>{ch == null ? "—" : signed(ch)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="mt-1.5 text-[9px] leading-relaxed text-muted-foreground">
        <summary className="cursor-pointer select-none">Comparison notes</summary>
        <p className="mt-1">No Others bucket: the workbook already includes Others under DMK+. TVK did not contest 2011–2021; NTK and NOTA are not applicable in 2011. Those baselines are shown as “—”, not zero or missing. 2016 results cover 232 of 234 seats; Aravakurichi and Thanjavur are no data.</p>
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
        {tab === "change" && <><p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">2026 minus {baselineLabel} (pp)</p><EChart option={changeOption} height={chartHeight} reduced={reduced} ariaLabel={`Signed percentage-point change from ${baselineLabel} to the 2026 exit-poll estimate for ${scope.label}`} /></>}
        {tab === "share" && <><p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">2026 exit-poll estimate share</p><EChart option={shareOption} height={chartHeight} reduced={reduced} ariaLabel={`2026 exit-poll estimate share for ${scope.label}`} /></>}
        {tab === "seats" && (
          <div className="space-y-2">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">2026 projected vs actual seats</p>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full border-collapse text-[10px]">
                <thead><tr className="bg-muted/30 text-[8.5px] uppercase tracking-wide text-muted-foreground"><th className="px-1.5 py-1 text-left">Party / group</th><th className="px-1.5 py-1 text-right">Projected</th><th className="px-1.5 py-1 text-right">Actual 2026</th></tr></thead>
                <tbody>{seatRows.map((g) => <tr key={g} className="border-t border-border/60"><td className="px-1.5 py-1"><span className="inline-flex items-center gap-1" style={{ color: TN_COLOR[g] }}><span className="size-1.5 rounded-sm" style={{ background: TN_COLOR[g] }} />{TN_LABEL[g]}</span></td><td className="px-1.5 py-1 text-right tabular-nums">{scope.projectedSeats[g] ?? 0}</td><td className="px-1.5 py-1 text-right font-semibold tabular-nums">{scope.actualSeats[g] ?? 0}</td></tr>)}</tbody>
                <tfoot><tr className="border-t border-border bg-muted/20 text-[9px]"><td className="px-1.5 py-1">Total</td><td className="px-1.5 py-1 text-right tabular-nums">{seatTotal}</td><td className="px-1.5 py-1 text-right tabular-nums">{actualTotal}</td></tr></tfoot>
              </table>
            </div>
            <p className="rounded-md border border-border/70 bg-muted/20 px-2 py-1.5 text-[9px] leading-relaxed text-muted-foreground">Projected seats use combined-count AC leaders; Actual 2026 seats use the corresponding ECI result rows. Totals are derived, not hardcoded.</p>
          </div>
        )}
      </div>
      {selectedYear === "2026" && scope.currentValid === 0 && <p className="mt-1 text-[9px] text-muted-foreground">No valid 2026 survey responses in this scope.</p>}
    </section>
  );
}
