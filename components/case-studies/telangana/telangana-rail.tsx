"use client";

import { useMemo } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import {
  PARTIES, PARTY_COLOR, PARTY_LABEL, fmtPct, fmtPp, type Party, type ShareSet,
} from "@/lib/telangana/oct26";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import EChart from "@/components/case-studies/telangana/echart";
import { cn } from "@/lib/utils";

export type ScopeResult = {
  label: string;
  actual: ShareSet;
  prediction: ShareSet;
  raw: ShareSet;
  answered: number;
  votes2023: number;
  leader: Party | null;
  tied: Party[];
  marginPp: number;
};

type Tab = "change" | "share" | "seats" | "more";

const TABS: { id: Tab; label: string }[] = [
  { id: "change", label: "Change" },
  { id: "share", label: "Share" },
  { id: "seats", label: "Seats" },
  { id: "more", label: "More" },
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
  extraCssText: "border-radius:8px;box-shadow:0 12px 30px -14px rgba(0,0,0,.55);max-width:230px;",
});

export default function TelanganaRail({
  scope, series, onSeries, tab, onTab, full, onFull, theme, statewideLeads, isStatewide,
}: {
  scope: ScopeResult;
  series: "prediction" | "raw";
  onSeries: (s: "prediction" | "raw") => void;
  tab: Tab;
  onTab: (t: Tab) => void;
  full: boolean;
  onFull: () => void;
  theme: "light" | "dark";
  statewideLeads: Record<string, number>;
  isStatewide: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const p = palette(theme);
  const shown = series === "prediction" ? scope.prediction : scope.raw;
  const shownLabel = series === "prediction" ? "2028 prediction" : "Raw 2028 survey";

  const change = useMemo(() => {
    const out: Record<Party, number> = { BRS: 0, Congress: 0, BJP: 0, Others: 0 };
    for (const x of PARTIES) out[x] = (shown[x] - scope.actual[x]) * 100;
    return out;
  }, [scope, shown]);

  const changeOption = useMemo(() => {
    const maxAbs = Math.max(0.5, ...PARTIES.map((x) => Math.abs(change[x])));
    const step = Math.max(1, Math.ceil((maxAbs * 1.12) / 2));
    const M = step * 2;
    const sorted = [...PARTIES].sort((a, b) => change[b] - change[a]);
    return {
      animation: !reduced, animationDuration: 600, animationEasing: "cubicOut",
      grid: { left: 62, right: 24, top: 8, bottom: 24 },
      tooltip: {
        ...tip(p), trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const i = Array.isArray(params) ? (params[0] as { dataIndex: number } | undefined)?.dataIndex ?? 0 : 0;
          const x = sorted[i];
          return `<div style="font-weight:600;margin-bottom:2px">${PARTY_LABEL[x]}</div>2023 result <b>${fmtPct(scope.actual[x])}</b><br/>${shownLabel} <b>${fmtPct(shown[x])}</b><br/>Change <b>${fmtPp(change[x])}</b>`;
        },
      },
      xAxis: {
        type: "value", min: -M, max: M, interval: step,
        axisLabel: { color: p.muted, fontSize: 8.5, formatter: (v: number) => `${v > 0 ? "+" : ""}${Math.abs(v) < 0.05 ? "0" : v.toFixed(1)}` },
        splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false },
      },
      yAxis: { type: "category", data: sorted.map((x) => PARTY_LABEL[x]), inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.text, fontSize: 9 } },
      series: [{
        type: "bar", barMaxWidth: 12,
        data: sorted.map((x) => ({
          value: +change[x].toFixed(2),
          itemStyle: { color: PARTY_COLOR[x], borderRadius: 2 },
        })),
        markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: p.axis, width: 1 }, data: [{ xAxis: 0 }] },
      }],
    };
  }, [change, scope, shown, shownLabel, p, reduced]);

  const shareOption = useMemo(() => {
    const max = Math.max(10, Math.ceil((Math.max(...PARTIES.map((x) => shown[x])) * 100 + 4) / 10) * 10);
    return {
      animation: !reduced, animationDuration: 600,
      grid: { left: 74, right: 40, top: 8, bottom: 24 },
      tooltip: {
        ...tip(p), trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const i = Array.isArray(params) ? (params[0] as { dataIndex: number } | undefined)?.dataIndex ?? 0 : 0;
          const x = PARTIES[i];
          return `<div style="font-weight:600;margin-bottom:2px">${PARTY_LABEL[x]}</div>${shownLabel} <b>${fmtPct(shown[x])}</b><br/>2023 result <b>${fmtPct(scope.actual[x])}</b>`;
        },
      },
      xAxis: { type: "value", max, axisLabel: { color: p.muted, fontSize: 8.5, formatter: "{value}%" }, splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: { type: "category", data: PARTIES.map((x) => PARTY_LABEL[x]), inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.text, fontSize: 9 } },
      series: [{
        type: "bar", barMaxWidth: 12,
        data: PARTIES.map((x) => ({
          value: +(shown[x] * 100).toFixed(2),
          itemStyle: { color: PARTY_COLOR[x], borderRadius: 2 },
          label: { show: true, position: "right", color: p.text, fontSize: 8.5, formatter: `${(shown[x] * 100).toFixed(2)}%` },
        })),
      }],
    };
  }, [shown, shownLabel, scope, p, reduced]);

  const chartHeight = full ? 420 : 190;

  return (
    <>
      {full && <div aria-hidden onClick={onFull} className="fixed inset-x-0 bottom-0 top-16 z-[95] bg-background/70 backdrop-blur-sm" />}
    <section aria-label="Telangana comparison" className={cn("flex min-h-0 flex-col", full ? "fixed inset-x-3 bottom-3 top-24 z-[100] mx-auto w-[min(100%,60rem)] overflow-auto rounded-2xl border border-border bg-card p-4 shadow-2xl sm:inset-x-6 sm:bottom-6" : "rounded-2xl border border-border bg-card/95 p-3 shadow-[0_18px_50px_-30px_rgba(15,20,30,0.55)] backdrop-blur-xl")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{isStatewide ? "Statewide" : "Selected scope"}</p>
          <h2 className="mt-0.5 truncate font-display text-lg font-semibold leading-tight">{scope.label} comparison</h2>
        </div>
        <button type="button" onClick={onFull} aria-label={full ? "Exit full screen" : "Expand comparison"}
          className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
          {full ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
        </button>
      </div>

      {/* prediction / raw survey display control */}
      <div className="mt-2 inline-flex self-start rounded-full border border-border p-0.5" role="group" aria-label="Displayed 2028 series">
        {([["prediction", "Prediction"], ["raw", "Raw survey"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => onSeries(id)} aria-pressed={series === id}
            className={cn("rounded-full px-2.5 py-0.5 text-[10.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60",
              series === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {/* comparison table */}
      <div className="mt-2 overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse text-[11px]">
          <caption className="sr-only">{scope.label} 2023 result and 2028 series comparison</caption>
          <thead>
            <tr className="bg-muted/30 text-left text-[9px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-2 py-1.5 font-semibold">Party</th>
              <th scope="col" className="px-2 py-1.5 text-right font-semibold">2023 result</th>
              <th scope="col" className="px-2 py-1.5 text-right font-semibold">{shownLabel}</th>
            </tr>
          </thead>
          <tbody>
            {PARTIES.map((x) => (
              <tr key={x} className="border-t border-border/60">
                <th scope="row" className="px-2 py-1.5 text-left font-medium">
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: PARTY_COLOR[x] }} />{PARTY_LABEL[x]}</span>
                  <span className="mt-0.5 block pl-3.5 text-[9px] font-normal tabular-nums text-muted-foreground">{fmtPp(change[x])}</span>
                </th>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmtPct(scope.actual[x])}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  <span className="font-semibold">{fmtPct(shown[x])}</span>
                  <span className="block text-[9px] leading-tight text-muted-foreground">
                    {series === "prediction" ? `Raw survey ${fmtPct(scope.raw[x])}` : `Prediction ${fmtPct(scope.prediction[x])}`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[9.5px] text-muted-foreground">
        <span>Leading: <b className="text-foreground/85">{scope.tied.length > 1 ? `${scope.tied.map((x) => PARTY_LABEL[x]).join(" / ")} tie` : scope.leader ? PARTY_LABEL[scope.leader] : "—"}</b>{scope.marginPp > 0 ? ` · ${scope.marginPp.toFixed(1)} pp` : ""}</span>
        <span className="tabular-nums">{scope.answered.toLocaleString("en-IN")} answered</span>
      </div>

      {/* compact tabs */}
      <div className="mt-2 flex gap-1 border-b border-border" role="tablist" aria-label="Comparison views">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => onTab(t.id)}
            className={cn("-mb-px rounded-t-md border-b-2 px-2 py-1 text-[10.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60",
              tab === t.id ? "border-saffron text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 pt-2">
        {tab === "change" && (
          <>
            <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">2023 → 2028 change ({series === "prediction" ? "prediction" : "raw survey"} − 2023 result)</p>
            <EChart option={changeOption} height={chartHeight} reduced={reduced} ariaLabel={`Signed percentage-point change from the 2023 result to the ${series === "prediction" ? "2028 prediction" : "raw 2028 survey"} for ${scope.label}`} />
          </>
        )}
        {tab === "share" && (
          <>
            <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{shownLabel} share</p>
            <EChart option={shareOption} height={chartHeight} reduced={reduced} ariaLabel={`${shownLabel} share for ${scope.label}`} />
          </>
        )}
        {tab === "seats" && (
          <div>
            <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Projected leading assemblies</p>
            {isStatewide ? (
              <div className="space-y-1.5">
                {[...PARTIES, "Tie"].filter((x) => statewideLeads[x] != null).map((x) => (
                  <div key={x} className="flex items-center gap-2 text-[10.5px]">
                    <span className="w-16 shrink-0 font-medium" style={{ color: x === "Tie" ? "var(--muted-foreground)" : PARTY_COLOR[x as Party] }}>{x === "Tie" ? "Tie" : PARTY_LABEL[x as Party]}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-sm bg-muted/40">
                      <span className="block h-full rounded-sm" style={{ width: `${(statewideLeads[x] / Math.max(...Object.values(statewideLeads))) * 100}%`, background: x === "Tie" ? "var(--muted-foreground)" : PARTY_COLOR[x as Party] }} />
                    </span>
                    <span className="w-8 text-right tabular-nums">{statewideLeads[x]}</span>
                  </div>
                ))}
                <p className="pt-1 text-[9px] leading-snug text-muted-foreground">Modelled leading assemblies from the numeric prediction — not certified seats and not a seat projection at district level.</p>
              </div>
            ) : (
              <p className="rounded-lg bg-muted/30 p-2 text-[10px] leading-relaxed text-muted-foreground">
                Projected leads are computed statewide only. This scope leads with
                <b className="text-foreground/85"> {scope.tied.length > 1 ? `${scope.tied.map((x) => PARTY_LABEL[x]).join(" / ")} (tie)` : scope.leader ? PARTY_LABEL[scope.leader] : "no leader"}</b>
                {scope.marginPp > 0 ? ` by ${scope.marginPp.toFixed(2)} pp` : ""} in the {series === "prediction" ? "prediction" : "raw survey"}.
              </p>
            )}
          </div>
        )}
        {tab === "more" && (
          <div className="space-y-2 text-[10px] leading-relaxed text-muted-foreground">
            <table className="w-full border-collapse text-[10px]">
              <caption className="sr-only">Prediction and raw survey comparison</caption>
              <thead><tr className="text-[9px] uppercase tracking-wide"><th className="text-left font-semibold">Party</th><th className="text-right font-semibold">2028 prediction</th><th className="text-right font-semibold">Raw survey</th></tr></thead>
              <tbody>
                {PARTIES.map((x) => (
                  <tr key={x} className="border-t border-border/60">
                    <th scope="row" className="py-1 text-left font-medium text-foreground/80">{PARTY_LABEL[x]}</th>
                    <td className="py-1 text-right tabular-nums">{fmtPct(scope.prediction[x])}</td>
                    <td className="py-1 text-right tabular-nums">{fmtPct(scope.raw[x])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>Prediction is the workbook&apos;s AC model weighted by 2023 votes; the raw survey counts answered 2028 questions at the cutoff. They are different measures and are never merged.</p>
            {scope.leader && <p>Leader is derived from the displayed shares ({series === "prediction" ? "prediction" : "raw survey"}); ties are reported as ties.</p>}
          </div>
        )}
      </div>
    </section>
    </>
  );
}
