"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import {
  TN_COLOR, TN_GROUPS, TN_LABEL, tnLeader,
  type TnAggregates, type TnGroup, type TnShares, type TnYear,
} from "@/lib/tamil-nadu/model";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import EChart from "@/components/case-studies/telangana/echart";
import { cn } from "@/lib/utils";

const BASELINES: TnYear[] = ["2011", "2016", "2021"];

type Stats = { q1: number; median: number; q3: number; lower: number; upper: number; whiskerLow: number; whiskerHigh: number; outliers: number[] };

function quantile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}
function boxStats(values: number[]): Stats | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25), median = quantile(sorted, 0.5), q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1, lower = q1 - 1.5 * iqr, upper = q3 + 1.5 * iqr;
  const inside = sorted.filter((v) => v >= lower && v <= upper);
  return {
    q1, median, q3, lower, upper,
    whiskerLow: inside[0] ?? sorted[0],
    whiskerHigh: inside[inside.length - 1] ?? sorted[sorted.length - 1],
    outliers: sorted.filter((v) => v < lower || v > upper),
  };
}
function palette(theme: "light" | "dark") {
  const dark = theme === "dark";
  return {
    axis: dark ? "rgba(190,202,218,.45)" : "rgba(70,86,104,.5)",
    grid: dark ? "rgba(255,255,255,.075)" : "rgba(20,24,31,.08)",
    text: dark ? "#e7edf6" : "#20262e",
    muted: dark ? "rgba(231,237,246,.55)" : "rgba(32,38,46,.55)",
    bg: dark ? "rgba(16,22,30,.98)" : "rgba(255,255,255,.99)",
    border: dark ? "rgba(120,135,155,.34)" : "rgba(20,24,31,.12)",
  };
}
type Pal = ReturnType<typeof palette>;
const tooltipStyle = (p: Pal) => ({
  confine: true,
  backgroundColor: p.bg,
  borderColor: p.border,
  borderWidth: 1,
  padding: [8, 10],
  textStyle: { color: p.text, fontSize: 11, fontFamily: "inherit" },
  extraCssText: "border-radius:8px;box-shadow:0 14px 34px -16px rgba(0,0,0,.6);max-width:360px;",
});
const pct = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(1)}%`);
const changePp = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}pp`);
const rawValue = (d: unknown): unknown => (d && typeof d === "object" && "value" in d ? (d as { value: unknown }).value : d);
const numericValue = (d: unknown): number | null => { const v = rawValue(d); if (typeof v === "number") return v; if (Array.isArray(v) && typeof v[1] === "number") return v[1]; return null; };
const emptySeats = () => Object.fromEntries(TN_GROUPS.map((g) => [g, 0])) as Record<TnGroup, number>;

export default function TamilNaduAnalysis({ open, onClose, data, theme, initialScope, defaultBaseline, onSelectDistrict }: {
  open: boolean;
  onClose: () => void;
  data: TnAggregates;
  theme: "light" | "dark";
  initialScope: string;
  defaultBaseline: TnYear;
  onSelectDistrict: (name: string) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const p = palette(theme);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [scope, setScope] = useState(initialScope);
  const [baselineYear, setBaselineYear] = useState<TnYear>(defaultBaseline);
  const [parties, setParties] = useState<TnGroup[]>([...TN_GROUPS]);
  const [showMedian, setShowMedian] = useState(true);
  const [highlightOutliers, setHighlightOutliers] = useState(true);
  const [distUnit, setDistUnit] = useState<"district" | "assembly">("district");
  const [onlyMismatch, setOnlyMismatch] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "leader" | "responses">("name");

  useEffect(() => { if (open) setScope(initialScope); }, [open, initialScope]);
  useEffect(() => { if (open) setBaselineYear(defaultBaseline); }, [open, defaultBaseline]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => closeRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "Tab" && dialogRef.current) {
        const nodes = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!nodes.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  const scopeRecord = useMemo(() => {
    if (scope.startsWith("a:")) return data.acs.find((a) => a.no === Number(scope.slice(2))) ?? data.acs[0];
    if (scope.startsWith("d:")) return data.districts.find((d) => d.name === scope.slice(2)) ?? data.districts[0];
    return data.statewide;
  }, [data, scope]);
  const scopeName = scope.startsWith("a:")
    ? data.acs.find((a) => a.no === Number(scope.slice(2)))?.name ?? "Assembly"
    : scope.startsWith("d:") ? scope.slice(2) : "Tamil Nadu";
  const scopeIsState = !scope.startsWith("a:") && !scope.startsWith("d:");
  const current = scopeRecord.survey;
  const baseline = scopeRecord.actual[baselineYear] ?? null;
  const baselineShares = baseline?.shares ?? null;
  const currentShares = current.shares ?? {};
  const currentLeader = tnLeader(currentShares);
  const currentLabel = scopeIsState ? "All responses" : "Adjusted";

  const projectedSeats = useMemo(() => {
    if (scope.startsWith("a:")) {
      const ac = data.acs.find((a) => a.no === Number(scope.slice(2)));
      return { ...emptySeats(), ...(ac?.projected.leader ? { [ac.projected.leader]: 1 } : {}) };
    }
    if (scope.startsWith("d:")) return data.districts.find((d) => d.name === scope.slice(2))?.projectedSeats ?? emptySeats();
    return data.statewide.projectedSeats;
  }, [data, scope]);
  const actualSeats = useMemo(() => {
    if (scope.startsWith("a:")) {
      const ac = data.acs.find((a) => a.no === Number(scope.slice(2)));
      return { ...emptySeats(), ...(ac?.actual2026.winner ? { [ac.actual2026.winner]: 1 } : {}) };
    }
    if (scope.startsWith("d:")) return data.districts.find((d) => d.name === scope.slice(2))?.actualSeats ?? emptySeats();
    return data.statewide.actualSeats;
  }, [data, scope]);

  const change = useMemo(() => {
    const out = {} as TnShares;
    for (const g of TN_GROUPS) {
      const b = baselineShares?.[g], c = currentShares?.[g];
      out[g] = baseline?.available && data.presence[baselineYear][g] && b != null && c != null ? (c - b) * 100 : undefined;
    }
    return out;
  }, [baseline?.available, baselineShares, currentShares, data.presence, baselineYear]);

  const historicalOption = useMemo(() => {
    const cats = parties.map((g) => TN_LABEL[g]);
    const baseData = parties.map((g) => (baseline?.available && data.presence[baselineYear][g] && baselineShares?.[g] != null
      ? { value: (baselineShares[g] ?? 0) * 100, itemStyle: { color: TN_COLOR[g], opacity: 0.3 } }
      : null));
    const currentData = parties.map((g) => (currentShares[g] == null ? null : { value: (currentShares[g] ?? 0) * 100, itemStyle: { color: TN_COLOR[g] } }));
    return {
      animationDuration: reduced ? 0 : 450,
      grid: { left: 44, right: 12, top: 34, bottom: 42 },
      legend: { top: 0, left: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: p.muted, fontSize: 10 }, data: [`${baselineYear} result`, `2026 exit poll`] },
      tooltip: {
        ...tooltipStyle(p), trigger: "axis", axisPointer: { type: "shadow" },
        valueFormatter: (v: unknown) => (typeof v === "number" ? `${v.toFixed(2)}%` : "—"),
      },
      xAxis: { type: "category", data: cats, axisLabel: { color: p.muted, fontSize: 9.5, interval: 0, rotate: cats.length > 3 ? 20 : 0 }, axisLine: { lineStyle: { color: p.axis } }, axisTick: { show: false } },
      yAxis: { type: "value", max: 60, axisLabel: { color: p.muted, fontSize: 9, formatter: "{value}%" }, splitLine: { lineStyle: { color: p.grid } } },
      series: [
        { id: "baseline", name: `${baselineYear} result`, type: "bar", data: baseData, barMaxWidth: 22, itemStyle: { borderRadius: [3, 3, 0, 0] }, emphasis: { focus: "series" } },
        { id: "current", name: "2026 exit poll", type: "bar", data: currentData, barMaxWidth: 22, itemStyle: { borderRadius: [3, 3, 0, 0] }, emphasis: { focus: "series" } },
      ],
    };
  }, [baseline?.available, baselineShares, baselineYear, currentShares, data.presence, parties, p, reduced]);

  const distribution = useMemo(() => {
    const units = distUnit === "district"
      ? data.districts.map((d) => ({ name: d.name, shares: d.survey.shares, valid: d.survey.valid }))
      : data.acs.map((a) => ({ name: `${a.no}. ${a.name}`, shares: a.survey.shares, valid: a.survey.valid }));
    const rows = parties.map((g) => ({ group: g, values: units.map((u) => u.shares?.[g]).filter((v): v is number => v != null && Number.isFinite(v)).map((v) => v * 100) }));
    const boxes = rows.map((r) => { const st = boxStats(r.values); return st ? [st.whiskerLow, st.q1, st.median, st.q3, st.whiskerHigh] : null; });
    const medians = rows.map((r) => { const st = boxStats(r.values); return st ? st.median : null; });
    const outliers = rows.flatMap((r, i) => { const st = boxStats(r.values); return st ? st.outliers.map((v) => [i, v]) : []; });
    return { units, rows, boxes, medians, outliers };
  }, [data, distUnit, parties]);

  const distributionOption = useMemo(() => ({
    animationDuration: reduced ? 0 : 450,
    grid: { left: 44, right: 16, top: 20, bottom: 8, containLabel: true },
    tooltip: {
      ...tooltipStyle(p), trigger: "item",
      formatter: (params: unknown) => {
        const q = params as { seriesName?: string; data?: unknown; name?: string };
        const value = rawValue(q.data);
        if (Array.isArray(value) && value.length === 5 && q.seriesName === "Distribution") {
          const [lo, q1, med, q3, hi] = (value as number[]).map((v) => v.toFixed(1));
          return `<b>${q.name}</b><br/>whiskers ${lo}–${hi}%<br/>Q1 ${q1}% · median ${med}% · Q3 ${q3}%`;
        }
        if (Array.isArray(value) && value.length === 2 && q.seriesName === "Outliers") return `${q.name}<br/>outlier ${Number(value[1]).toFixed(1)}%`;
        if (q.seriesName === "Median") { const v = numericValue(q.data); return `${q.name}<br/>median ${v == null ? "—" : v.toFixed(1)}%`; }
        return "";
      },
    },
    xAxis: { type: "category", data: parties.map((g) => TN_LABEL[g]), axisLabel: { show: true, color: p.muted, fontSize: 9, interval: 0, rotate: 0, margin: 10, formatter: (v: string) => (v.includes("+") ? `${v.split("+")[0]}+` : v) }, axisLine: { lineStyle: { color: p.axis } }, axisTick: { show: false } },
    yAxis: { type: "value", name: "share", nameTextStyle: { color: p.muted, fontSize: 9 }, axisLabel: { color: p.muted, fontSize: 9, formatter: "{value}%" }, splitLine: { lineStyle: { color: p.grid } } },
    series: [
      {
        id: "distribution", name: "Distribution", type: "boxplot",
        data: distribution.boxes.map((b, i) => (b ? { value: b, itemStyle: { color: `${TN_COLOR[parties[i]]}22`, borderColor: TN_COLOR[parties[i]], borderWidth: 1.4 } } : null)),
        itemStyle: { borderWidth: 1.2, color: "transparent" },
        emphasis: { itemStyle: { borderWidth: 2 } },
      },
      ...(showMedian ? [{
        id: "median", name: "Median", type: "line", data: distribution.medians.map((v, i) => ({ value: v, itemStyle: { color: TN_COLOR[parties[i]] } })), symbol: "diamond", symbolSize: 6,
        lineStyle: { opacity: 0 },
        label: { show: true, position: "top", color: p.text, fontSize: 9, formatter: (v: { value?: unknown }) => { const n = numericValue(v.value); return n == null ? "" : n.toFixed(1); } },
      }] : []),
      ...(highlightOutliers ? [{
        id: "outliers", name: "Outliers", type: "scatter", data: distribution.outliers.map(([i, v]) => ({ value: [i, v], itemStyle: { borderColor: TN_COLOR[parties[i]] } })), symbolSize: 5,
        itemStyle: { color: "transparent", borderWidth: 1 },
        emphasis: { itemStyle: { color: p.text } },
      }] : []),
    ],
  }), [distribution, highlightOutliers, p, parties, reduced, showMedian]);

  const seatOption = useMemo(() => ({
    animationDuration: reduced ? 0 : 450,
    grid: { left: 34, right: 12, top: 34, bottom: 38 },
    legend: { top: 0, left: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: p.muted, fontSize: 10 }, data: ["Projected", "Actual 2026"] },
    tooltip: { ...tooltipStyle(p), trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: { type: "category", data: TN_GROUPS.map((g) => TN_LABEL[g]), axisLabel: { color: p.muted, fontSize: 9, interval: 0, rotate: 20 }, axisLine: { lineStyle: { color: p.axis } }, axisTick: { show: false } },
    yAxis: { type: "value", minInterval: 1, axisLabel: { color: p.muted, fontSize: 9 }, splitLine: { lineStyle: { color: p.grid } } },
    series: [
      { id: "projected", name: "Projected", type: "bar", data: TN_GROUPS.map((g) => ({ value: projectedSeats[g] ?? 0, itemStyle: { color: TN_COLOR[g], opacity: 0.35 } })), barMaxWidth: 26, label: { show: true, position: "top", color: p.muted, fontSize: 9 } },
      { id: "actual", name: "Actual 2026", type: "bar", data: TN_GROUPS.map((g) => ({ value: actualSeats[g] ?? 0, itemStyle: { color: TN_COLOR[g] } })), barMaxWidth: 26, label: { show: true, position: "top", color: p.text, fontSize: 9, fontWeight: 600 } },
    ],
  }), [actualSeats, p, projectedSeats, reduced]);

  const districtsSorted = useMemo(() => {
    const rows = [...data.districts];
    if (sortBy === "leader") rows.sort((a, b) => (TN_GROUPS.indexOf(tnLeader(b.survey.shares) ?? "TVK") - TN_GROUPS.indexOf(tnLeader(a.survey.shares) ?? "TVK")) || a.name.localeCompare(b.name));
    else if (sortBy === "responses") rows.sort((a, b) => b.survey.valid - a.survey.valid);
    else rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [data.districts, sortBy]);

  const constituencyRows = useMemo(() => data.acs.filter((a) => !onlyMismatch || !a.match), [data.acs, onlyMismatch]);
  const totalProjected = TN_GROUPS.reduce((s, g) => s + (projectedSeats[g] ?? 0), 0);
  const totalActual = TN_GROUPS.reduce((s, g) => s + (actualSeats[g] ?? 0), 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="tn-analysis-title" className="flex h-[94svh] w-full max-w-[1380px] flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:h-[92svh] sm:rounded-2xl">
        <div className="sticky top-0 z-30 flex items-start justify-between gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <h2 id="tn-analysis-title" className="font-display text-lg font-semibold leading-tight">Tamil Nadu analysis</h2>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{scopeName} · 2026 exit-poll estimate · {currentLabel} · aggregate workbook</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close analysis" className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60"><X className="size-4" /></button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <label className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">Historical baseline
            <select value={baselineYear} onChange={(e) => setBaselineYear(e.target.value as TnYear)} className="rounded-md border border-border bg-background px-1.5 py-1 text-[10px] text-foreground">
              {BASELINES.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <div className="inline-flex rounded-full border border-border p-0.5" role="group" aria-label="Distribution geography">
            {([["district", "Districts"], ["assembly", "Assemblies"]] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={distUnit === id} onClick={() => setDistUnit(id)} className={cn("rounded-full px-2.5 py-1 text-[10px]", distUnit === id ? "bg-foreground text-background" : "text-muted-foreground")}>{label}</button>)}
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Parties">
            {TN_GROUPS.map((g) => <button key={g} type="button" aria-pressed={parties.includes(g)} onClick={() => setParties((prev) => prev.includes(g) ? (prev.length > 1 ? prev.filter((x) => x !== g) : prev) : [...prev, g])} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px]", parties.includes(g) ? "border-border text-foreground" : "border-border/60 text-muted-foreground opacity-45")}><span className="size-2 rounded-sm" style={{ background: TN_COLOR[g] }} />{TN_LABEL[g]}</button>)}
          </div>
          <button type="button" aria-pressed={showMedian} onClick={() => setShowMedian((v) => !v)} className={cn("rounded-full border px-2 py-1 text-[10px]", showMedian ? "border-foreground/40 bg-muted/40 text-foreground" : "border-border text-muted-foreground")}>Show median</button>
          <button type="button" aria-pressed={highlightOutliers} onClick={() => setHighlightOutliers((v) => !v)} className={cn("rounded-full border px-2 py-1 text-[10px]", highlightOutliers ? "border-foreground/40 bg-muted/40 text-foreground" : "border-border text-muted-foreground")}>Highlight outliers</button>
          <button type="button" onClick={() => { setParties([...TN_GROUPS]); setBaselineYear(defaultBaseline); setShowMedian(true); setHighlightOutliers(true); setDistUnit("district"); setOnlyMismatch(false); setSortBy("name"); }} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"><RotateCcw className="size-3" /> Reset</button>
          <span className="text-[10px] text-muted-foreground">TVK reference <b className="font-medium text-foreground/80">{(data.referenceShare.value * 100).toFixed(2)}%</b> · statewide workbook <b className="font-medium text-foreground/80">{(((data.statewide.survey.shares?.TVK ?? 0) * 100)).toFixed(2)}%</b></span>
        </div>

        <div className="space-y-5 overflow-y-auto px-4 pb-10 pt-4">
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {TN_GROUPS.map((g) => {
              const v = currentShares[g];
              const c = change[g];
              return (
                <div key={g} className="rounded-lg border border-border/70 bg-muted/10 px-2.5 py-2">
                  <span className="flex items-center gap-1.5 text-[9.5px] font-medium text-muted-foreground"><span className="size-1.5 rounded-sm" style={{ background: TN_COLOR[g] }} />{TN_LABEL[g]}</span>
                  <div className="mt-1 text-[21px] font-semibold leading-none tabular-nums">{pct(v)}</div>
                  <div className="mt-1 text-[9px] text-muted-foreground">{c == null ? `No ${baselineYear} share` : `${changePp(c)} vs ${baselineYear}`}</div>
                </div>
              );
            })}
          </section>

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-display text-[15px] font-semibold">2026 exit poll vs {baselineYear}</h3>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Numeric historical shares only · {currentLabel.toLowerCase()} 2026 measure · no time series</p>
              </div>
              <span className="text-[10px] text-muted-foreground">{current.valid.toLocaleString("en-IN")} responses · {currentLeader ? TN_LABEL[currentLeader] : "—"} leads</span>
            </div>
            <EChart option={historicalOption} height={290} reduced={reduced} replaceSeries ariaLabel={`2026 exit-poll shares compared with ${baselineYear} for ${scopeName}`} />
            <p className="mt-0.5 text-[9px] text-muted-foreground">Historical shares are regrouped to the same five groups; historical Others are included under DMK+. TVK did not contest 2011–2021, so it has no historical bar.</p>
          </section>

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-display text-[15px] font-semibold">Geographic distribution</h3>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{distUnit === "district" ? "All 38 districts" : "All 234 assemblies"} · adjusted shares · median and IQR across {distUnit === "district" ? "districts" : "assemblies"}</p>
              </div>
              <span className="text-[10px] text-muted-foreground">Box Q1–Q3 · whiskers 1.5×IQR · rings outliers</span>
            </div>
            {showMedian && <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[9.5px] text-muted-foreground">{distribution.rows.map((r) => { const st = boxStats(r.values); return st ? <span key={r.group} className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: TN_COLOR[r.group] }} />{TN_LABEL[r.group]} median <b className="tabular-nums text-foreground/80">{st.median.toFixed(1)}%</b></span> : null; })}</div>}
            <EChart option={distributionOption} height={320} reduced={reduced} replaceSeries ariaLabel={`Distribution of adjusted 2026 shares across ${distUnit === "district" ? "districts" : "assemblies"}`} />
          </section>

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-display text-[15px] font-semibold">Projected vs Actual 2026 seats</h3>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Projected from adjusted AC leaders · Actual 2026 from ECI result rows · {scopeName}</p>
              </div>
              <span className="text-[10px] text-muted-foreground">Projected {totalProjected} · Actual {totalActual}</span>
            </div>
            <div className="mt-2 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
              <EChart option={seatOption} height={250} reduced={reduced} replaceSeries ariaLabel={`Projected and Actual 2026 seats for ${scopeName}`} />
              <div className="overflow-hidden rounded-xl border border-border self-start">
                <table className="w-full border-collapse text-[10.5px]"><caption className="sr-only">Projected and actual 2026 seats</caption>
                  <thead><tr className="bg-muted/30 text-left text-[8.5px] uppercase tracking-wide text-muted-foreground"><th className="px-2 py-1.5">Group</th><th className="px-2 py-1.5 text-right">Projected</th><th className="px-2 py-1.5 text-right">Actual 2026</th><th className="px-2 py-1.5 text-right">Difference</th></tr></thead>
                  <tbody>{TN_GROUPS.map((g) => <tr key={g} className="border-t border-border/60"><td className="px-2 py-1.5"><span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: TN_COLOR[g] }} />{TN_LABEL[g]}</span></td><td className="px-2 py-1.5 text-right tabular-nums">{projectedSeats[g] ?? 0}</td><td className="px-2 py-1.5 text-right font-semibold tabular-nums">{actualSeats[g] ?? 0}</td><td className={cn("px-2 py-1.5 text-right tabular-nums", (projectedSeats[g] ?? 0) === (actualSeats[g] ?? 0) ? "text-muted-foreground" : "text-foreground")}>{(projectedSeats[g] ?? 0) - (actualSeats[g] ?? 0) > 0 ? "+" : ""}{(projectedSeats[g] ?? 0) - (actualSeats[g] ?? 0)}</td></tr>)}</tbody>
                  <tfoot><tr className="border-t border-border bg-muted/20 text-[10px]"><td className="px-2 py-1.5">Total</td><td className="px-2 py-1.5 text-right tabular-nums">{totalProjected}</td><td className="px-2 py-1.5 text-right tabular-nums">{totalActual}</td><td className="px-2 py-1.5 text-right tabular-nums">{totalProjected - totalActual}</td></tr></tfoot>
                </table>
              </div>
            </div>
            <p className="mt-1 text-[9px] text-muted-foreground">Actual 2026 is shown as seats, not as a vote share. Statewide prediction accuracy: {data.statewide.accuracy}/234 constituency calls.</p>
          </section>

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-display text-[15px] font-semibold">Constituency prediction vs result</h3>
                <p className="mt-0.5 text-[10px] text-muted-foreground">All 234 ACs · predicted adjusted leader vs Actual 2026 · click a row to switch scope</p>
              </div>
              <label className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground"><input type="checkbox" checked={onlyMismatch} onChange={(e) => setOnlyMismatch(e.target.checked)} className="size-3 accent-current" /> Only mismatches ({data.acs.filter((a) => !a.match).length})</label>
            </div>
            <div className="mt-2 max-h-[430px] overflow-auto rounded-xl border border-border">
              <table className="w-full min-w-[780px] border-collapse text-[10px]"><caption className="sr-only">Constituency prediction versus Actual 2026 result</caption>
                <thead className="sticky top-0 z-10 bg-card"><tr className="text-left text-[8.5px] uppercase tracking-wide text-muted-foreground"><th className="px-2 py-1.5">AC</th><th className="px-2 py-1.5">Constituency</th><th className="px-2 py-1.5">District</th><th className="px-2 py-1.5">Projected</th><th className="px-2 py-1.5">Actual 2026</th><th className="px-2 py-1.5">Match</th><th className="px-2 py-1.5 text-right">Margin</th><th className="px-2 py-1.5">Confidence</th></tr></thead>
                <tbody>{constituencyRows.map((a) => <tr key={a.no} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setScope(`a:${a.no}`); }} onClick={() => setScope(`a:${a.no}`)} className={cn("cursor-pointer border-t border-border/60 hover:bg-muted/30 focus:bg-muted/30", scope === `a:${a.no}` && "bg-saffron/10")}><td className="px-2 py-1 tabular-nums text-muted-foreground">{a.no}</td><td className="px-2 py-1 font-medium">{a.name}</td><td className="px-2 py-1 text-muted-foreground">{a.district}</td><td className="px-2 py-1">{a.projected.leader ? <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: TN_COLOR[a.projected.leader] }} />{TN_LABEL[a.projected.leader]}</span> : "—"}</td><td className="px-2 py-1">{a.actual2026.winner ? <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: TN_COLOR[a.actual2026.winner] }} />{TN_LABEL[a.actual2026.winner]}</span> : "—"}</td><td className="px-2 py-1"><span className={cn("rounded-full px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wide", a.match ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/15 text-rose-700 dark:text-rose-400")}>{a.match ? "Match" : "Miss"}</span></td><td className="px-2 py-1 text-right tabular-nums">{a.projected.marginPp.toFixed(1)}</td><td className="px-2 py-1 text-muted-foreground">{a.projected.confidence || "—"}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div><h3 className="font-display text-[15px] font-semibold">District shares</h3><p className="mt-0.5 text-[10px] text-muted-foreground">Adjusted shares · current 38-district grouping · click a district to select it</p></div>
              <label className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">Sort<select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="rounded-md border border-border bg-background px-1.5 py-1 text-[10px] text-foreground"><option value="name">Name</option><option value="leader">2026 leader</option><option value="responses">Responses</option></select></label>
            </div>
            <div className="mt-2 max-h-80 overflow-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] border-collapse text-[10px]"><caption className="sr-only">District adjusted 2026 shares</caption>
                <thead className="sticky top-0 z-10 bg-card"><tr className="text-left text-[8.5px] uppercase tracking-wide text-muted-foreground"><th className="px-2 py-1.5">District</th><th className="px-2 py-1.5 text-right">Responses</th><th className="px-2 py-1.5">Leader</th>{parties.map((g) => <th key={g} className="whitespace-nowrap px-2 py-1.5 text-right" style={{ color: TN_COLOR[g] }}>{TN_LABEL[g]}</th>)}<th className="px-2 py-1.5 text-right">Proj.</th><th className="px-2 py-1.5 text-right">Actual</th></tr></thead>
                <tbody>{districtsSorted.map((d) => { const lead = tnLeader(d.survey.shares); return <tr key={d.name} onClick={() => { setScope(`d:${d.name}`); onSelectDistrict(d.name); }} className={cn("cursor-pointer border-t border-border/60 hover:bg-muted/30", scope === `d:${d.name}` && "bg-saffron/10")}><td className="px-2 py-1 font-medium">{d.name}</td><td className="px-2 py-1 text-right tabular-nums text-muted-foreground">{d.survey.valid.toLocaleString("en-IN")}</td><td className="px-2 py-1">{lead ? <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: TN_COLOR[lead] }} />{TN_LABEL[lead]}</span> : "—"}</td>{parties.map((g) => <td key={g} className="px-2 py-1 text-right tabular-nums">{d.survey.shares?.[g] == null ? "—" : `${(d.survey.shares[g] * 100).toFixed(1)}`}</td>)}<td className="px-2 py-1 text-right tabular-nums">{TN_GROUPS.reduce((s, g) => s + (d.projectedSeats[g] ?? 0), 0)}</td><td className="px-2 py-1 text-right tabular-nums">{TN_GROUPS.reduce((s, g) => s + (d.actualSeats[g] ?? 0), 0)}</td></tr>; })}</tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="flex items-baseline justify-between gap-2">
              <div><h3 className="font-display text-[15px] font-semibold">Assembly adjusted shares</h3><p className="mt-0.5 text-[10px] text-muted-foreground">AC Results adjusted percentages · 234 assemblies · click a row to switch scope</p></div>
              <span className="text-[10px] text-muted-foreground">{data.acs.length} assemblies</span>
            </div>
            <div className="mt-2 max-h-[360px] overflow-auto rounded-xl border border-border">
              <table className="w-full min-w-[700px] border-collapse text-[10px]"><caption className="sr-only">Assembly adjusted 2026 shares</caption>
                <thead className="sticky top-0 z-10 bg-card"><tr className="text-left text-[8.5px] uppercase tracking-wide text-muted-foreground"><th className="px-2 py-1.5">AC</th><th className="px-2 py-1.5">Constituency</th><th className="px-2 py-1.5">District</th>{parties.map((g) => <th key={g} className="whitespace-nowrap px-2 py-1.5 text-right" style={{ color: TN_COLOR[g] }}>{TN_LABEL[g]}</th>)}</tr></thead>
                <tbody>{data.acs.map((a) => <tr key={a.no} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setScope(`a:${a.no}`); }} onClick={() => setScope(`a:${a.no}`)} className={cn("cursor-pointer border-t border-border/60 hover:bg-muted/30 focus:bg-muted/30", scope === `a:${a.no}` && "bg-saffron/10")}><td className="px-2 py-1 tabular-nums text-muted-foreground">{a.no}</td><td className="px-2 py-1 font-medium">{a.name}</td><td className="px-2 py-1 text-muted-foreground">{a.district}</td>{parties.map((g) => <td key={g} className="px-2 py-1 text-right tabular-nums">{a.survey.shares?.[g] == null ? "—" : `${(a.survey.shares[g] * 100).toFixed(1)}`}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </section>

          <p className="text-[9px] leading-relaxed text-muted-foreground">
            Statewide shares use all 31,316 responses, including 19,867 without a location. District and assembly views use the workbook&apos;s adjusted percentages and are not mixed with the statewide all-response measure. There is no Others bucket; Others is already included under DMK+. No survey rounds, collection dates, smoothing windows or fabricated time distributions are shown because this workbook is an aggregate export.
          </p>
        </div>
      </div>
    </div>
  );
}
