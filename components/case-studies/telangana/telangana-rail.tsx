"use client";

import { useMemo } from "react";
import { Expand, Maximize2 } from "lucide-react";
import {
  PARTIES, PARTY_COLOR, PARTY_LABEL, fmtPct, fmtPp, type Party, type ShareSet,
} from "@/lib/telangana/oct26";
import { winnerColour, winnerLabel, type ElectionYear, type HistoricYear } from "@/lib/telangana/history";
import { fmtInt } from "@/lib/telangana/model";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import EChart from "@/components/case-studies/telangana/echart";
import { cn } from "@/lib/utils";

export type ScopeResult = {
  label: string;
  baselineYear: HistoricYear;
  baseline: ShareSet;
  prediction: ShareSet;
  change: ShareSet;
  predictedLeader: Party | null;
  predictedTied: Party[];
  votes: number;
  answered: number;
  baselineTotal: number;
  aimimShare: number;
  device: { total: number; brands: { brand: string; entries: number; share: number }[] } | null;
};

type Tab = "change" | "share" | "seats" | "more";
const TABS: { id: Tab; label: string }[] = [
  { id: "change", label: "Change" }, { id: "share", label: "Share" },
  { id: "seats", label: "Seats" }, { id: "more", label: "More" },
];

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
  extraCssText: "border-radius:8px;box-shadow:0 12px 30px -14px rgba(0,0,0,.55);max-width:240px;",
});
const signed = (v: number, digits = 2) => `${v > 0 ? "+" : ""}${v.toFixed(digits)}`;

export default function TelanganaRail({
  scope, year, tab, onTab, onExpand, theme, leads2028, actualSeats, actualSeatsYear, isStatewide,
}: {
  scope: ScopeResult;
  year: ElectionYear;
  tab: Tab;
  onTab: (t: Tab) => void;
  onExpand: () => void;
  theme: "light" | "dark";
  leads2028: Record<string, number>;
  actualSeats: Record<string, number>;
  actualSeatsYear: HistoricYear;
  isStatewide: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const p = palette(theme);
  const baselineLabel = scope.baselineYear;
  const predictedLabel = scope.predictedTied.length > 1
    ? `${scope.predictedTied.map((x) => PARTY_LABEL[x]).join(" / ")} tie`
    : scope.predictedLeader ? PARTY_LABEL[scope.predictedLeader] : "—";
  const baselineSorted = [...PARTIES].sort((a, b) => scope.baseline[b] - scope.baseline[a]);
  const baselineLeader = baselineSorted[0];

  const changeOption = useMemo(() => {
    const vals = Math.max(0.5, ...PARTIES.map((x) => Math.abs(scope.change[x])));
    const step = Math.max(1, Math.ceil((vals * 1.12) / 2));
    const M = step * 2;
    const sorted = [...PARTIES].sort((a, b) => scope.change[b] - scope.change[a]);
    return {
      animation: !reduced, animationDuration: 500, animationEasing: "cubicOut",
      grid: { left: 82, right: 42, top: 8, bottom: 22 },
      tooltip: {
        ...tip(p), trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const i = Array.isArray(params) ? (params[0] as { dataIndex: number } | undefined)?.dataIndex ?? 0 : 0;
          const x = sorted[i];
          return `<div style="font-weight:600;margin-bottom:2px">${PARTY_LABEL[x]}</div>${baselineLabel} result <b>${fmtPct(scope.baseline[x])}</b><br/>2028 prediction <b>${fmtPct(scope.prediction[x])}</b><br/>Change <b>${fmtPp(scope.change[x])}</b>`;
        },
      },
      xAxis: {
        type: "value", min: -M, max: M, interval: step,
        axisLabel: { color: p.muted, fontSize: 8.5, formatter: (v: number) => `${v > 0 ? "+" : ""}${v}` },
        splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false },
      },
      yAxis: {
        type: "category", data: sorted.map((x) => PARTY_LABEL[x]), inverse: true,
        axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } },
        axisLabel: { color: p.text, fontSize: 9 },
      },
      series: [{
        type: "bar", barMaxWidth: 12,
        data: sorted.map((x) => ({
          value: +scope.change[x].toFixed(2),
          itemStyle: { color: PARTY_COLOR[x], borderRadius: 2 },
        })),
        markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: p.axis, width: 1 }, data: [{ xAxis: 0 }] },
      }],
    };
  }, [scope, baselineLabel, p, reduced]);

  const shareOption = useMemo(() => {
    const max = Math.max(10, Math.ceil((Math.max(...PARTIES.map((x) => scope.prediction[x])) * 100 + 4) / 10) * 10);
    return {
      animation: !reduced, animationDuration: 500,
      grid: { left: 82, right: 42, top: 8, bottom: 22 },
      tooltip: {
        ...tip(p), trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const i = Array.isArray(params) ? (params[0] as { dataIndex: number } | undefined)?.dataIndex ?? 0 : 0;
          const x = PARTIES[i];
          return `<div style="font-weight:600;margin-bottom:2px">${PARTY_LABEL[x]}</div>2028 prediction <b>${fmtPct(scope.prediction[x])}</b><br/>${baselineLabel} result <b>${fmtPct(scope.baseline[x])}</b>`;
        },
      },
      xAxis: { type: "value", max, axisLabel: { color: p.muted, fontSize: 8.5, formatter: "{value}%" }, splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: { type: "category", data: PARTIES.map((x) => PARTY_LABEL[x]), inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.text, fontSize: 9 } },
      series: [{
        type: "bar", barMaxWidth: 12,
        data: PARTIES.map((x) => ({
          value: +(scope.prediction[x] * 100).toFixed(2),
          itemStyle: { color: PARTY_COLOR[x], borderRadius: 2 },
          label: { show: true, position: "right", color: p.text, fontSize: 8.5, formatter: `${(scope.prediction[x] * 100).toFixed(2)}%` },
        })),
      }],
    };
  }, [scope, baselineLabel, p, reduced]);

  const chartHeight = 176;
  const leadRows = (counts: Record<string, number>, label: string, detailed = false) => {
    const keys = Object.keys(counts).filter((x) => (counts[x] ?? 0) > 0).sort((a, b) => counts[b] - counts[a]);
    const max = Math.max(1, ...Object.values(counts));
    const colourOf = (x: string) => detailed ? winnerColour(x) : x === "Tie" ? "var(--muted-foreground)" : PARTY_COLOR[x as Party];
    const labelOf = (x: string) => detailed ? winnerLabel(x) : x === "Tie" ? "Tie" : PARTY_LABEL[x as Party];
    return (
      <div>
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <div className="space-y-1">
          {keys.map((x) => (
            <div key={x} className="flex items-center gap-2 text-[10px]">
              <span className="w-[86px] shrink-0 truncate font-medium" style={{ color: colourOf(x) }}>{labelOf(x)}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-sm bg-muted/40">
                <span className="block h-full rounded-sm" style={{ width: `${(counts[x] / max) * 100}%`, background: colourOf(x) }} />
              </span>
              <span className="w-6 text-right tabular-nums">{counts[x]}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <section aria-label="Telangana comparison" className="rounded-2xl border border-border bg-card/95 p-3 shadow-[0_18px_50px_-30px_rgba(15,20,30,0.55)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold leading-tight">Telangana comparison</h2>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            {isStatewide ? "Statewide" : scope.label} · {baselineLabel} vs 2028
          </p>
        </div>
        <button type="button" onClick={onExpand} aria-label="Open the large history chart"
          className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
          <Maximize2 className="size-3" />
        </button>
      </div>

      <div className="mt-2 overflow-hidden rounded-lg border border-border">
        <table className="w-full table-fixed border-collapse text-[10.5px]">
          <caption className="sr-only">{scope.label} {baselineLabel} result, 2028 prediction and change</caption>
          <colgroup><col className="w-[33%]" /><col className="w-[22%]" /><col className="w-[24%]" /><col className="w-[21%]" /></colgroup>
          <thead>
            <tr className="bg-muted/30 text-left text-[8.5px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-1.5 py-1.5 font-semibold">Party</th>
              <th scope="col" className="px-1 py-1.5 text-right font-semibold">{baselineLabel} result</th>
              <th scope="col" className="px-1 py-1.5 text-right font-semibold">2028 prediction</th>
              <th scope="col" className="px-1 py-1.5 text-right font-semibold">Change (pp)</th>
            </tr>
          </thead>
          <tbody>
            {PARTIES.map((x) => (
              <tr key={x} className="border-t border-border/60">
                <th scope="row" className="px-1.5 py-1.5 text-left font-medium">
                  <span className="flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: PARTY_COLOR[x] }} />{PARTY_LABEL[x]}</span>
                </th>
                <td className="px-1 py-1.5 text-right tabular-nums text-muted-foreground">{fmtPct(scope.baseline[x])}</td>
                <td className="px-1 py-1.5 text-right tabular-nums font-semibold">{fmtPct(scope.prediction[x])}</td>
                <td className={cn("px-1 py-1.5 text-right tabular-nums", scope.change[x] > 0 ? "text-emerald-600 dark:text-emerald-400" : scope.change[x] < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
                  {signed(scope.change[x])}
                </td>
              </tr>
            ))}
            {scope.aimimShare > 0 && (
              <tr className="border-t border-border/60 bg-muted/15">
                <th scope="row" className="px-1.5 py-1.5 text-left font-medium">
                  <span className="flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: winnerColour("AIMIM") }} />AIMIM</span>
                </th>
                <td className="px-1 py-1.5 text-right tabular-nums text-muted-foreground">{fmtPct(scope.aimimShare)}</td>
                <td className="px-1 py-1.5 text-right text-[9px] leading-tight text-muted-foreground">Inside Others</td>
                <td className="px-1 py-1.5 text-right text-muted-foreground">—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {scope.aimimShare > 0 && (
        <p className="mt-1 text-[8.5px] leading-snug text-muted-foreground">
          AIMIM has its own historical result where available; it sits inside the Others comparison group and has no separate 2028 prediction.
        </p>
      )}

      <div className="mt-2 space-y-0.5 text-[9.5px] leading-snug text-muted-foreground">
        <p><span className="font-semibold text-foreground/80">{baselineLabel} vote-share leader:</span> {PARTY_LABEL[baselineLeader]} · {fmtPct(scope.baseline[baselineLeader])}</p>
        <p><span className="font-semibold text-foreground/80">2028 predicted leader:</span> {predictedLabel}{scope.predictedLeader && scope.predictedTied.length < 2 ? ` · ${fmtPct(scope.prediction[scope.predictedLeader])}` : ""}</p>
      </div>

      <div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground">
        <span>{year === "2028" ? "Predicted leads, not certified seats" : `${year} actual · election result`}</span>
        <span className="tabular-nums">{fmtInt(scope.answered)} 2028 survey answers</span>
      </div>

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
        {tab === "change" && (
          <>
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">2028 minus {baselineLabel} (pp)</p>
            <EChart option={changeOption} height={chartHeight} reduced={reduced} ariaLabel={`Signed percentage-point change from ${baselineLabel} to the 2028 prediction for ${scope.label}`} />
          </>
        )}
        {tab === "share" && (
          <>
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">2028 prediction share</p>
            <EChart option={shareOption} height={chartHeight} reduced={reduced} ariaLabel={`2028 prediction share for ${scope.label}`} />
          </>
        )}
        {tab === "seats" && (
          <div className="space-y-2">
            {leadRows(leads2028, "2028 projected leading assemblies")}
            {Object.keys(actualSeats).length > 0 && leadRows(actualSeats, `${actualSeatsYear} actual AC winners`, true)}
            <p className="text-[9px] leading-snug text-muted-foreground">
              {isStatewide ? "Projected leads are modelled from numeric predictions, not certified seats. The actual AC winners are election results; a vote-share leader can differ from the party winning the most ACs." : "Counts are within this scope only. A vote-share leader is not necessarily the party winning the most assemblies."}
            </p>
          </div>
        )}
        {tab === "more" && (
          <div className="space-y-2 text-[9.5px] leading-relaxed text-muted-foreground">
            <p>2014 and 2018 are ECI-derived mirror results; 2023 is the supplied workbook result table. None are exit polls. The 2028 prediction is a separate model measured against the selected baseline.</p>
            <p>{scope.baselineYear} vote base: {fmtInt(scope.baselineTotal)}.</p>
            {scope.device && scope.device.total > 0 && (
              <div className="rounded-lg border border-border/70 bg-background/40 p-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-foreground/70">Device mix · illustrative placement</p>
                <div className="mt-1 space-y-0.5">
                  {scope.device.brands.slice(0, 5).map((b) => (
                    <div key={b.brand} className="flex justify-between gap-2 tabular-nums">
                      <span className="truncate">{b.brand}</span>
                      <span>{fmtInt(b.entries)} · {(b.share * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-[8.5px] leading-snug">October survey metadata: {fmtInt(scope.device.total)} cutoff-matched entries. Predicted brands, not verified handsets or GPS.</p>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Expand className="size-3" />
              <button type="button" onClick={onExpand} className="font-medium text-foreground/80 underline decoration-border underline-offset-2 hover:text-foreground">
                Open vote-share / swing chart
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
