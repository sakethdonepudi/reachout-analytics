"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { TN_COLOR, TN_GROUPS, TN_LABEL, TN_NO_DATA, tnPct, type TnAggregates, type TnGroup, type TnRoundBundle, type TnShares, type TnYear } from "@/lib/tamil-nadu/model";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import EChart from "@/components/case-studies/telangana/echart";
import { cn } from "@/lib/utils";

const BASELINES: TnYear[] = ["2011", "2016", "2021"];
const SMOOTHS = [
  { id: "raw", label: "Raw" }, { id: "7", label: "7-day" }, { id: "14", label: "14-day" },
  { id: "30", label: "30-day" }, { id: "quarter", label: "Quarterly" },
] as const;

type Period = { index: number; label: string; start: string; end: string; entries: number; answered: number; counts: Record<TnGroup, number>; partial?: boolean };
type BoxPoint = { value: number; label: string; date: string; entries: number };
type Stats = { q1: number; median: number; q3: number; lower: number; upper: number; whiskerLow: number; whiskerHigh: number; outliers: number[] };
type ScopeRecord = {
  name: string; actual: Record<TnYear, { shares: TnShares | null; available: boolean; winner: TnGroup | null }>;
  survey: { valid: number; shares: TnShares | null };
};

const dateOf = (iso: string) => iso.slice(0, 10);
const dates = (start: string, end: string) => (dateOf(start) === dateOf(end) ? dateOf(start) : `${dateOf(start)} – ${dateOf(end)}`);
const signed = (v: number, d = 1) => `${v > 0 ? "+" : ""}${v.toFixed(d)}`;
const empty = (): Record<TnGroup, number> => Object.fromEntries(TN_GROUPS.map((g) => [g, 0])) as Record<TnGroup, number>;
function quantile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const h = (sorted.length - 1) * p; const lo = Math.floor(h), hi = Math.ceil(h);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}
function boxStats(values: number[]): Stats | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25), median = quantile(sorted, 0.5), q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1, lower = q1 - 1.5 * iqr, upper = q3 + 1.5 * iqr;
  const inside = sorted.filter((v) => v >= lower && v <= upper);
  return { q1, median, q3, lower, upper, whiskerLow: inside[0] ?? sorted[0], whiskerHigh: inside[inside.length - 1] ?? sorted[sorted.length - 1], outliers: sorted.filter((v) => v < lower || v > upper) };
}
function palette(theme: "light" | "dark") {
  const dark = theme === "dark";
  return {
    axis: dark ? "rgba(190,202,218,.45)" : "rgba(70,86,104,.5)", grid: dark ? "rgba(255,255,255,.075)" : "rgba(20,24,31,.08)",
    text: dark ? "#e7edf6" : "#20262e", muted: dark ? "rgba(231,237,246,.55)" : "rgba(32,38,46,.55)",
    bg: dark ? "rgba(16,22,30,.98)" : "rgba(255,255,255,.99)", border: dark ? "rgba(120,135,155,.34)" : "rgba(20,24,31,.12)",
  };
}
type Pal = ReturnType<typeof palette>;
const tooltipStyle = (p: Pal) => ({
  confine: true, backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, padding: [8, 10],
  textStyle: { color: p.text, fontSize: 11, fontFamily: "inherit" },
  extraCssText: "border-radius:8px;box-shadow:0 14px 34px -16px rgba(0,0,0,.6);max-width:340px;",
});

export default function TamilNaduAnalysis({ open, onClose, data, theme, initialScope, defaultBaseline, onSelectDistrict }: {
  open: boolean; onClose: () => void; data: TnAggregates; theme: "light" | "dark";
  initialScope: string; defaultBaseline: TnYear; onSelectDistrict: (name: string) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const p = palette(theme);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const seq = useRef(0);
  const [scope, setScope] = useState(initialScope);
  const [bundle, setBundle] = useState<TnRoundBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<"share" | "swing">("share");
  const [baseline, setBaseline] = useState<TnYear>(defaultBaseline);
  const [smooth, setSmooth] = useState<(typeof SMOOTHS)[number]["id"]>("raw");
  const [roundSize, setRoundSize] = useState<"388" | "688">("388");
  const [parties, setParties] = useState<TnGroup[]>([...TN_GROUPS]);
  const [showMedian, setShowMedian] = useState(true);
  const [highlightOutliers, setHighlightOutliers] = useState(true);
  const [distUnit, setDistUnit] = useState<"day" | "block">("day");
  const [focusPeriod, setFocusPeriod] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "leader" | "responses">("name");
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => { if (open) setScope(initialScope); }, [open, initialScope]);
  useEffect(() => { if (open) setBaseline(defaultBaseline); }, [open, defaultBaseline]);

  useEffect(() => {
    if (!open) return;
    const id = ++seq.current; const ctrl = new AbortController();
    setLoading(true); setError(null);
    fetch(`/api/public/case-studies/tamil-nadu/rounds?scope=${encodeURIComponent(scope)}`, { cache: "no-store", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: TnRoundBundle) => { if (id === seq.current) setBundle(d); })
      .catch((e) => { if ((e as Error)?.name !== "AbortError" && id === seq.current) setError(e instanceof Error ? e.message : "Could not load survey periods"); })
      .finally(() => { if (id === seq.current) setLoading(false); });
    return () => ctrl.abort();
  }, [open, scope]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => closeRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "Tab" && dialogRef.current) {
        const nodes = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!nodes.length) return; const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); window.clearTimeout(t); };
  }, [open, onClose]);

  const scopeRecord: ScopeRecord = useMemo(() => {
    if (scope.startsWith("a:")) return (data.acs.find((a) => a.no === Number(scope.slice(2))) ?? data.acs[0]) as ScopeRecord;
    if (scope.startsWith("d:")) return (data.districts.find((d) => d.name === scope.slice(2)) ?? data.districts[0]) as ScopeRecord;
    return data.statewide as unknown as ScopeRecord;
  }, [data, scope]);
  const scopeName = scope.startsWith("a:")
    ? data.acs.find((a) => a.no === Number(scope.slice(2)))?.name ?? "Assembly"
    : scope.startsWith("d:") ? scope.slice(2) : "Tamil Nadu";
  const scopeActual = scopeRecord.actual;
  const baselineShares = scopeActual[baseline]?.shares ?? null;
  const baselinePresent = (g: TnGroup) => data.presence[baseline][g] && baselineShares?.[g] != null;
  const surveyValid = scopeRecord.survey.valid;

  const base = useMemo(() => (bundle ? (roundSize === "388" ? bundle.rounds388 : bundle.rounds688) : []), [bundle, roundSize]);
  const daily = useMemo(() => (bundle?.daily ?? []).map((d) => ({ ...d, start: d.date, end: d.date, label: d.date })), [bundle]);
  const periods = useMemo<Period[]>(() => {
    if (!base.length) return [];
    if (smooth === "raw") return base.map((r) => ({ ...r, index: r.i, label: `R${r.i}` }));
    if (smooth === "quarter") {
      const groups = new Map<string, Period>();
      for (const d of daily) {
        const dt = new Date(d.start); const label = `Q${Math.floor(dt.getUTCMonth() / 3) + 1} ${dt.getUTCFullYear()}`;
        const cur = groups.get(label) ?? { index: groups.size, label, start: d.start, end: d.end, entries: 0, answered: 0, counts: empty() };
        cur.start = cur.start < d.start ? cur.start : d.start; cur.end = cur.end > d.end ? cur.end : d.end;
        cur.entries += d.entries; cur.answered += d.answered;
        for (const g of TN_GROUPS) cur.counts[g] += d.counts[g];
        groups.set(label, cur);
      }
      return [...groups.values()].sort((a, b) => a.start.localeCompare(b.start)).map((g, i) => ({ ...g, index: i }));
    }
    const days = Number(smooth);
    return base.map((r) => {
      const end = new Date(r.end).getTime(); const start = end - days * 86_400_000;
      const window = daily.filter((d) => { const t = new Date(d.end).getTime(); return t >= start && t <= end; });
      const agg: Period = { index: r.i, label: `R${r.i}`, start: window[0]?.start ?? r.start, end: r.end, entries: 0, answered: 0, counts: empty() };
      for (const d of window) { agg.entries += d.entries; agg.answered += d.answered; for (const g of TN_GROUPS) agg.counts[g] += d.counts[g]; }
      return agg;
    });
  }, [base, daily, smooth]);

  const surveyValues = useMemo<(Record<TnGroup, number> | null)[]>(() => periods.map((r) => {
    if (!(r.answered > 0)) return null;
    return Object.fromEntries(TN_GROUPS.map((g) => [g, (r.counts[g] / r.answered) * 100])) as Record<TnGroup, number>;
  }), [periods]);
  const valueOf = useCallback((vals: Record<TnGroup, number> | null, g: TnGroup) => {
    if (!vals) return null;
    if (metric === "share") return vals[g];
    if (!baselinePresent(g)) return null;
    return vals[g] - (baselineShares?.[g] ?? 0) * 100;
  }, [metric, baselinePresent, baselineShares]);
  const unit = metric === "share" ? "%" : "pp";
  const offset = 4;
  const categories = useMemo(() => ["2011", "2016", "2021", "", ...periods.map((r) => r.label)], [periods]);
  const selected = selectedPeriod ?? focusPeriod;
  useEffect(() => { setSelectedPeriod(null); setFocusPeriod(null); }, [scope, roundSize, smooth, metric, baseline]);

  const historicalValue = useCallback((year: TnYear, g: TnGroup) => {
    const rec = scopeActual[year];
    if (!data.presence[year][g] || !rec?.available || rec.shares?.[g] == null) return null;
    const v = rec.shares[g] * 100;
    if (metric === "share") return v;
    const b = baselinePresent(g) ? (baselineShares?.[g] ?? 0) * 100 : null;
    return b == null ? null : v - b;
  }, [scopeActual, data.presence, metric, baselinePresent, baselineShares]);

  const series = useMemo(() => {
    const out: Record<string, unknown>[] = [];
    const stats: Record<TnGroup, Stats | null> = {} as Record<TnGroup, Stats | null>;
    for (const g of parties) {
      const vals = surveyValues.map((v) => valueOf(v, g));
      stats[g] = boxStats(vals.filter((v): v is number => v != null));
      out.push({
        name: `${TN_LABEL[g]} · actual`, type: "line",
        data: [{ value: historicalValue("2011", g), symbolSize: baseline === "2011" ? 9 : 6 }, { value: historicalValue("2016", g), symbolSize: baseline === "2016" ? 9 : 6 }, { value: historicalValue("2021", g), symbolSize: baseline === "2021" ? 9 : 6 }, null, ...periods.map(() => null)],
        color: TN_COLOR[g], symbol: "circle", lineStyle: { color: TN_COLOR[g], width: 1.8, type: "solid" }, itemStyle: { color: TN_COLOR[g] }, z: 4,
      });
      out.push({
        name: `${TN_LABEL[g]} · survey`, type: "line", data: [null, null, null, null, ...vals],
        color: TN_COLOR[g], symbol: "circle", symbolSize: 5.5, lineStyle: { color: TN_COLOR[g], width: 2.1 }, itemStyle: { color: TN_COLOR[g] }, z: 5,
        markLine: showMedian && stats[g]?.median != null ? { silent: true, symbol: "none", lineStyle: { color: TN_COLOR[g], type: "dashed", width: 1.15, opacity: 0.8 }, label: { show: false }, data: [{ yAxis: +stats[g]!.median.toFixed(2) }] } : undefined,
      });
      if (highlightOutliers && stats[g]) {
        const st = stats[g]!;
        const points = periods.flatMap((r, i) => {
          const v = vals[i];
          if (v == null || !(v < st.lower || v > st.upper)) return [];
          return [{ value: [offset + i, +v.toFixed(2)], party: g, label: r.label, date: dates(r.start, r.end), entries: r.entries, deviation: v - st.median }];
        });
        if (points.length) out.push({
          name: `${TN_LABEL[g]} · outlier`, type: reduced ? "scatter" : "effectScatter", data: points, symbolSize: 15,
          itemStyle: { color: "transparent", borderColor: TN_COLOR[g], borderWidth: 2 }, rippleEffect: reduced ? undefined : { scale: 2.2, brushType: "stroke" },
          label: { show: true, position: "top", color: TN_COLOR[g], fontSize: 8.5, fontWeight: 600, formatter: (params: unknown) => { const d = (params as { data?: { value?: [number, number] } }).data; return d?.value ? `${d.value[1].toFixed(1)}${unit}` : ""; } },
          labelLayout: { hideOverlap: true },
          tooltip: { formatter: (params: unknown) => { const d = (params as { data?: { party: TnGroup; label: string; date: string; value: [number, number]; entries: number; deviation: number } }).data; if (!d) return ""; return `<b>${TN_LABEL[d.party]} · ${d.label}</b><br/>${d.date}<br/>Value <b>${d.value[1].toFixed(2)}${unit}</b> · ${d.entries} entries<br/>Deviation <b>${signed(d.deviation)} ${unit}</b>`; } },
          z: 14,
        });
      }
    }
    if (selected != null && periods[selected]) out.push({ name: "Selected period", type: "line", data: [], silent: true, z: 1, markLine: { silent: true, symbol: "none", lineStyle: { color: p.text, type: "dotted", width: 1, opacity: 0.55 }, label: { show: true, position: "insideEndTop", color: p.muted, fontSize: 8, formatter: periods[selected].label }, data: [{ xAxis: categories[offset + selected] }] } });
    return out;
  }, [parties, periods, surveyValues, valueOf, historicalValue, baseline, metric, showMedian, highlightOutliers, reduced, unit, selected, categories, p]);

  const chartOption = useMemo(() => ({
    animation: !reduced, animationDuration: 450, animationEasing: "cubicOut",
    grid: { left: 44, right: 22, top: 20, bottom: 44 },
    dataZoom: [{ type: "inside", xAxisIndex: 0, start: 0, end: 100, filterMode: "none" }],
    tooltip: {
      ...tooltipStyle(p), trigger: "axis", axisPointer: { type: "line", lineStyle: { color: p.axis, type: "dashed" } },
      formatter: (params: unknown) => {
        const list = Array.isArray(params) ? params as { dataIndex: number }[] : [];
        const index = list[0]?.dataIndex ?? -1;
        if (index < 0) return "";
        if (index < 3) {
          const year = BASELINES[index]; const rows = parties.map((g) => `<div style="display:flex;justify-content:space-between;gap:14px"><span><i style="display:inline-block;width:7px;height:7px;border-radius:2px;background:${TN_COLOR[g]};margin-right:5px"></i>${TN_LABEL[g]}</span><b>${historicalValue(year, g) == null ? "—" : historicalValue(year, g)!.toFixed(2) + unit}</b></div>`).join("");
          return `<div style="font-weight:600;margin-bottom:3px">${year} actual${metric === "swing" ? ` · vs ${baseline}` : ""}</div>${rows}`;
        }
        const pi = index - offset; const per = periods[pi]; const vals = surveyValues[pi];
        if (!per || !vals) return "";
        const rows = parties.map((g) => { const v = valueOf(vals, g); return v == null ? "" : `<div style="display:flex;justify-content:space-between;gap:14px"><span><i style="display:inline-block;width:7px;height:7px;border-radius:2px;background:${TN_COLOR[g]};margin-right:5px"></i>${TN_LABEL[g]}</span><b>${v.toFixed(2)}${unit}</b></div>`; }).join("");
        return `<div style="font-weight:600">${per.label} · ${dates(per.start, per.end)}</div><div style="opacity:.65;margin-bottom:2px">${per.entries.toLocaleString("en-IN")} entries · ${per.answered.toLocaleString("en-IN")} valid answers</div>${rows}`;
      },
    },
    xAxis: { type: "category", data: categories, boundaryGap: false, axisLine: { lineStyle: { color: p.axis } }, axisTick: { show: false }, axisLabel: { color: p.muted, fontSize: 8.5, interval: "auto", hideOverlap: true } },
    yAxis: { type: "value", axisLabel: { color: p.muted, fontSize: 9, formatter: `{value}${unit}` }, splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false } },
    series,
  }), [series, categories, metric, offset, periods, surveyValues, parties, valueOf, historicalValue, p, reduced, unit, baseline]);

  const medianRows = parties.map((g) => {
    const vals = surveyValues.map((v) => valueOf(v, g)).filter((v): v is number => v != null);
    return { party: g, median: boxStats(vals)?.median ?? null };
  });
  const distPeriods = useMemo(() => (distUnit === "day" ? daily : bundle?.blocks50 ?? []), [distUnit, daily, bundle]);
  const distValues = useMemo<Record<TnGroup, BoxPoint[]>>(() => {
    const out = {} as Record<TnGroup, BoxPoint[]>;
    for (const g of TN_GROUPS) {
      out[g] = [];
      distPeriods.forEach((per, i) => {
        if (!(per.answered > 0)) return;
        const vals = Object.fromEntries(TN_GROUPS.map((q) => [q, (per.counts[q] / per.answered) * 100])) as Record<TnGroup, number>;
        const v = metric === "share" ? vals[g] : baselinePresent(g) ? vals[g] - (baselineShares?.[g] ?? 0) * 100 : null;
        if (v == null) return;
        out[g].push({ value: v, label: (per as { label?: string }).label || `#${i + 1}`, date: dates(per.start, per.end), entries: per.entries });
      });
    }
    return out;
  }, [distPeriods, metric, baselinePresent, baselineShares]);
  const distEntries = distPeriods.reduce((s, x) => s + x.entries, 0);
  const distAvailable = distPeriods.filter((x) => x.answered > 0).length;
  const distOption = useMemo(() => {
    const cats = parties.map((g) => TN_LABEL[g]);
    const box: unknown[] = [], medians: unknown[] = [], points: unknown[] = [], outliers: unknown[] = [];
    parties.forEach((g, i) => {
      const st = boxStats(distValues[g].map((x) => x.value));
      if (!st) return;
      box.push({ value: [+st.whiskerLow.toFixed(2), +st.q1.toFixed(2), +st.median.toFixed(2), +st.q3.toFixed(2), +st.whiskerHigh.toFixed(2)], party: g, itemStyle: { color: `${TN_COLOR[g]}22`, borderColor: TN_COLOR[g], borderWidth: 1.5 } });
      medians.push({ value: [i, +st.median.toFixed(2)], party: g, itemStyle: { color: TN_COLOR[g] }, label: { show: showMedian, formatter: `${st.median.toFixed(1)}${unit}`, color: TN_COLOR[g], fontSize: 8.5, position: "top" } });
      for (const point of distValues[g]) {
        const x = i + ((point.entries % 7) - 3) * 0.05;
        if (point.value < st.lower || point.value > st.upper) outliers.push({ value: [x, +point.value.toFixed(2)], party: g, label: point.label, date: point.date, entries: point.entries, deviation: point.value - st.median, itemStyle: { color: "transparent", borderColor: TN_COLOR[g], borderWidth: 1.5 } });
        else points.push({ value: [x, +point.value.toFixed(2)], party: g, label: point.label, date: point.date, entries: point.entries, itemStyle: { color: TN_COLOR[g], opacity: 0.35 } });
      }
    });
    return {
      animation: !reduced, animationDuration: 400, grid: { left: 46, right: 18, top: 28, bottom: 34 },
      tooltip: { ...tooltipStyle(p), trigger: "item", formatter: (params: unknown) => { const q = params as { seriesType?: string; data?: { party?: TnGroup; label?: string; date?: string; entries?: number; deviation?: number; value?: number[] } }; const d = q.data; if (!d?.party) return ""; if (q.seriesType === "boxplot") { const st = boxStats(distValues[d.party].map((x) => x.value)); if (!st) return ""; return `<b>${TN_LABEL[d.party]}</b><br/>Q1 ${st.q1.toFixed(2)}${unit} · median ${st.median.toFixed(2)}${unit} · Q3 ${st.q3.toFixed(2)}${unit}<br/>Fences ${st.lower.toFixed(1)} / ${st.upper.toFixed(1)}`; } if (d.label) return `<b>${TN_LABEL[d.party]} · ${d.label}</b><br/>${d.date ?? ""}<br/>Value <b>${(d.value?.[1] ?? 0).toFixed(2)}${unit}</b> · ${d.entries} entries${d.deviation != null ? `<br/>Deviation ${signed(d.deviation)} ${unit}` : ""}`; return ""; } },
      xAxis: { type: "category", data: cats, axisLine: { lineStyle: { color: p.axis } }, axisTick: { show: false }, axisLabel: { color: p.text, fontSize: 9, interval: 0 } },
      yAxis: { type: "value", axisLabel: { color: p.muted, fontSize: 9, formatter: `{value}${unit}` }, splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false } },
      series: [
        { name: "Distribution", type: "boxplot", data: box, boxWidth: [10, 28], z: 3 },
        { name: "Periods", type: "scatter", data: points, symbolSize: 4, itemStyle: { opacity: 0.35 }, z: 2 },
        { name: "Outliers", type: reduced ? "scatter" : "effectScatter", data: outliers, symbolSize: 11, itemStyle: { color: "transparent", borderWidth: 1.5 }, rippleEffect: reduced ? undefined : { scale: 2, brushType: "stroke" }, z: 5 },
        { name: "Median", type: "scatter", data: medians, symbol: "diamond", symbolSize: 7, itemStyle: { color: "transparent" }, z: 6 },
      ],
    };
  }, [parties, distValues, p, reduced, showMedian, unit]);

  const sortedDistricts = useMemo(() => {
    const list = [...data.districts];
    list.sort((a, b) => sortBy === "leader" ? String(tnLeaderLocal(a.survey.shares)).localeCompare(String(tnLeaderLocal(b.survey.shares))) || a.name.localeCompare(b.name) : sortBy === "responses" ? b.survey.valid - a.survey.valid : a.name.localeCompare(b.name));
    return list;
  }, [data.districts, sortBy]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-background/80 p-0 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="tn-analysis-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="min-h-full w-full max-w-6xl overflow-y-auto border border-border bg-card shadow-2xl sm:min-h-0 sm:max-h-[96svh] sm:rounded-2xl">
        <div className="sticky top-0 z-30 flex items-start justify-between gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-xl">
          <div className="min-w-0"><h2 id="tn-analysis-title" className="font-display text-lg font-semibold leading-tight">Tamil Nadu analysis</h2><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{scopeName} · 2026 exit-poll estimate · survey-only</p></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close analysis" className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60"><X className="size-4" /></button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="inline-flex rounded-full border border-border p-0.5" role="group" aria-label="Metric">
            {([["share", "Vote share"], ["swing", "Swing"]] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={metric === id} onClick={() => setMetric(id)} className={cn("rounded-full px-3 py-1 text-[11px] font-medium", metric === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{label}</button>)}
          </div>
          <label className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">Baseline<select value={baseline} onChange={(e) => setBaseline(e.target.value as TnYear)} className="rounded-md border border-border bg-background px-1.5 py-1 text-[10px] text-foreground">{BASELINES.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
          <div className="inline-flex flex-wrap gap-1" role="group" aria-label="Smoothing">{SMOOTHS.map((s) => <button key={s.id} type="button" aria-pressed={smooth === s.id} onClick={() => setSmooth(s.id)} className={cn("rounded-full border px-2 py-1 text-[10px]", smooth === s.id ? "border-foreground/40 bg-muted/40 text-foreground" : "border-border text-muted-foreground")}>{s.label}</button>)}</div>
          <div className="inline-flex gap-1" role="group" aria-label="Round size">{(["388", "688"] as const).map((n) => <button key={n} type="button" aria-pressed={roundSize === n} onClick={() => setRoundSize(n)} className={cn("rounded-full border px-2 py-1 text-[10px]", roundSize === n ? "border-foreground/40 bg-muted/40 text-foreground" : "border-border text-muted-foreground")}>Samples {n}</button>)}</div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Parties">{TN_GROUPS.map((g) => <button key={g} type="button" aria-pressed={parties.includes(g)} onClick={() => setParties((prev) => prev.includes(g) ? (prev.length > 1 ? prev.filter((x) => x !== g) : prev) : [...prev, g])} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px]", parties.includes(g) ? "border-border text-foreground" : "border-border/60 text-muted-foreground opacity-45")}><span className="size-2 rounded-sm" style={{ background: TN_COLOR[g] }} />{TN_LABEL[g]}</button>)}</div>
          <span className="text-[10px] text-muted-foreground">Range <b className="font-medium text-foreground/80">{bundle ? `${bundle.dateMin.slice(0, 10)} – ${bundle.dateMax.slice(0, 10)}` : "—"}</b></span>
          <button type="button" aria-pressed={showMedian} onClick={() => setShowMedian((v) => !v)} className={cn("rounded-full border px-2 py-1 text-[10px]", showMedian ? "border-foreground/40 bg-muted/40 text-foreground" : "border-border text-muted-foreground")}>Show median</button>
          <button type="button" aria-pressed={highlightOutliers} onClick={() => setHighlightOutliers((v) => !v)} className={cn("rounded-full border px-2 py-1 text-[10px]", highlightOutliers ? "border-foreground/40 bg-muted/40 text-foreground" : "border-border text-muted-foreground")}>Highlight outliers</button>
          <button type="button" onClick={() => { setMetric("share"); setBaseline(defaultBaseline); setSmooth("raw"); setRoundSize("388"); setParties([...TN_GROUPS]); setShowMedian(true); setHighlightOutliers(true); setDistUnit("day"); setResetKey((k) => k + 1); }} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"><RotateCcw className="size-3" /> Reset</button>
        </div>

        <div className="space-y-5 px-4 pb-8 pt-4">
          {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-600 dark:text-rose-400">{error}</div>}
          {loading && !bundle && <div className="grid h-48 place-items-center text-[12px] text-muted-foreground">Loading survey periods…</div>}
          {bundle && (
            <>
              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div><h3 className="font-display text-[15px] font-semibold">{metric === "share" ? "2026 exit-poll estimate by survey round" : `2026 survey vs ${baseline} by survey round`}</h3><p className="mt-0.5 text-[10px] text-muted-foreground">Survey shares · no recalled previous-election field · no prediction model</p></div>
                  <span className="text-[10px] text-muted-foreground">{bundle.dateMin.slice(0, 10)} – {bundle.dateMax.slice(0, 10)} · {periods.length} {smooth === "quarter" ? "quarters" : "rounds"} · {smooth === "quarter" ? "calendar quarters" : `${roundSize} samples`}</span>
                </div>
                {showMedian && medianRows.some((r) => r.median != null) && <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[9.5px] text-muted-foreground">{medianRows.filter((r) => r.median != null).map((r) => <span key={r.party} className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: TN_COLOR[r.party] }} />{TN_LABEL[r.party]} median <b className="tabular-nums text-foreground/80">{r.median!.toFixed(1)}{unit}</b></span>)}</div>}
                {periods.length ? <EChart key={resetKey} option={chartOption} height={340} reduced={reduced} replaceSeries ariaLabel={`${metric === "share" ? "2026 survey share" : `Swing vs ${baseline}`} for ${scopeName}`} onEvents={{ click: (params) => { const q = params as { dataIndex?: number; data?: { value?: [number, number] } }; const x = Array.isArray(q.data?.value) ? q.data.value[0] : (q.dataIndex ?? -1); const idx = x - offset; if (idx >= 0 && idx < periods.length) { setSelectedPeriod(idx); document.getElementById(`tn-round-${idx}`)?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" }); } } }} /> : <div className="grid h-36 place-items-center text-[12px] text-muted-foreground">No survey periods in this dataset.</div>}
              </section>

              <section>
                <h3 className="font-display text-[15px] font-semibold">Round-wise detail</h3>
                <div className="mt-2 max-h-[460px] overflow-auto rounded-xl border border-border">
                  <table className="w-full border-collapse text-[10px]"><caption className="sr-only">Survey round detail for {scopeName}</caption>
                    <thead className="sticky top-0 z-20 bg-card">
                      <tr className="text-left text-[8.5px] uppercase tracking-wide text-muted-foreground"><th rowSpan={2} className="sticky left-0 z-30 w-14 bg-card px-2 py-1.5">Round</th><th rowSpan={2} className="sticky left-14 z-30 w-28 bg-card px-2 py-1.5">Dates</th><th rowSpan={2} className="sticky left-[10.5rem] z-30 w-16 bg-card px-2 py-1.5 text-right">Entries</th><th colSpan={parties.length} className={cn("px-2 py-1 text-center", metric === "share" && "text-foreground/85")}>2026 survey shares</th><th colSpan={parties.length} className={cn("px-2 py-1 text-center", metric === "swing" && "text-foreground/85")}>Differences vs {baseline}</th></tr>
                      <tr className="text-left text-[8.5px] text-muted-foreground">{parties.map((g) => <th key={`p-${g}`} className="whitespace-nowrap px-2 py-1 text-right" style={{ color: TN_COLOR[g] }}>{TN_LABEL[g]}</th>)}{parties.map((g) => <th key={`s-${g}`} className="whitespace-nowrap px-2 py-1 text-right" style={{ color: TN_COLOR[g] }}>Δ {TN_LABEL[g]}</th>)}</tr>
                    </thead>
                    <tbody>{periods.map((per, i) => { const vals = surveyValues[i]; return <tr key={`${per.label}-${i}`} id={`tn-round-${i}`} tabIndex={0} onMouseEnter={() => setFocusPeriod(i)} onMouseLeave={() => setFocusPeriod(null)} onFocus={() => setFocusPeriod(i)} onBlur={() => setFocusPeriod(null)} onClick={() => { setSelectedPeriod(i); document.getElementById(`tn-round-${i}`)?.scrollIntoView({ block: "nearest" }); }} className={cn("cursor-pointer border-t border-border/60 outline-none", selected === i ? "bg-saffron/10" : "hover:bg-muted/30 focus:bg-muted/30")}><td className="sticky left-0 z-10 bg-card px-2 py-1 font-medium">{per.label}</td><td className="sticky left-14 z-10 bg-card px-2 py-1 text-muted-foreground">{dates(per.start, per.end)}</td><td className="sticky left-[10.5rem] z-10 bg-card px-2 py-1 text-right tabular-nums">{per.entries.toLocaleString("en-IN")}{per.partial ? <span className="ml-0.5 opacity-60">*</span> : null}</td>{parties.map((g) => <td key={`p-${g}`} className={cn("px-2 py-1 text-right tabular-nums", metric === "share" ? "font-semibold text-foreground" : "text-muted-foreground")}>{vals ? `${vals[g].toFixed(2)}%` : "—"}</td>)}{parties.map((g) => { const v = vals && baselinePresent(g) ? vals[g] - (baselineShares?.[g] ?? 0) * 100 : null; return <td key={`s-${g}`} className={cn("px-2 py-1 text-right tabular-nums", metric === "swing" ? "font-semibold text-foreground" : "text-muted-foreground")}>{v == null ? "—" : signed(v)}</td>; })}</tr>; })}</tbody>
                  </table>
                </div><p className="mt-1 text-[9px] text-muted-foreground">* Final remainder round, not a full sample. Shares use valid answers only; blank and invalid entries remain in the round count.</p>
              </section>

              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-2"><div><h3 className="font-display text-[15px] font-semibold">District analysis</h3><p className="mt-0.5 text-[10px] text-muted-foreground">Recorded/source-mapped 2026 survey only · click to select the same district.</p></div><div className="flex items-center gap-1 text-[10px] text-muted-foreground">Sort<select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="rounded-md border border-border bg-background px-1.5 py-1 text-[10px] text-foreground"><option value="name">Name</option><option value="leader">2026 leader</option><option value="responses">Responses</option></select></div></div>
                <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-border"><table className="w-full border-collapse text-[10.5px]"><caption className="sr-only">Tamil Nadu district survey detail</caption><thead className="sticky top-0 z-10 bg-card"><tr className="text-left text-[8.5px] uppercase tracking-wide text-muted-foreground"><th className="px-2 py-1.5">District</th><th className="px-2 py-1.5 text-right">Responses</th><th className="px-2 py-1.5">2026 leader</th>{TN_GROUPS.map((g) => <th key={g} className="whitespace-nowrap px-2 py-1.5 text-right" style={{ color: TN_COLOR[g] }}>{TN_LABEL[g]}</th>)}</tr></thead><tbody>{sortedDistricts.map((d) => { const lead = tnLeaderLocal(d.survey.shares); return <tr key={d.name} className={cn("cursor-pointer border-t border-border/60 hover:bg-muted/30", scope === `d:${d.name}` && "bg-saffron/10")} onClick={() => { setScope(`d:${d.name}`); onSelectDistrict(d.name); }}><td className="px-2 py-1 font-medium">{d.name}</td><td className="px-2 py-1 text-right tabular-nums">{d.survey.valid.toLocaleString("en-IN")}</td><td className="px-2 py-1"><span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: lead ? TN_COLOR[lead] : TN_NO_DATA }} />{lead ? TN_LABEL[lead] : "No data"}</span></td>{TN_GROUPS.map((g) => <td key={g} className="px-2 py-1 text-right tabular-nums">{d.survey.shares?.[g] == null ? "—" : `${(d.survey.shares[g] * 100).toFixed(1)}`}</td>)}</tr>; })}</tbody></table></div>
              </section>

              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-display text-[15px] font-semibold">2026 survey distribution</h3><div className="flex flex-wrap items-center gap-1.5"><div className="inline-flex rounded-full border border-border p-0.5" role="group" aria-label="Distribution period">{([["day", "Daily"], ["block", "Every 50 responses"]] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={distUnit === id} onClick={() => setDistUnit(id)} className={cn("rounded-full px-2.5 py-1 text-[10px]", distUnit === id ? "bg-foreground text-background" : "text-muted-foreground")}>{label}</button>)}</div><span className="text-[10px] text-muted-foreground">{metric === "share" ? "Survey share" : `Swing vs ${baseline}`} · {distAvailable} periods · {distEntries.toLocaleString("en-IN")} entries</span></div></div>
                {showMedian && <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[9.5px] text-muted-foreground">{parties.map((g) => { const st = boxStats(distValues[g].map((x) => x.value)); return st ? <span key={g} className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: TN_COLOR[g] }} />{TN_LABEL[g]} median <b className="tabular-nums text-foreground/80">{st.median.toFixed(1)}{unit}</b></span> : null; })}</div>}
                <EChart option={distOption} height={310} reduced={reduced} replaceSeries ariaLabel={`${metric === "share" ? "Survey share" : "Swing"} distribution by group for ${scopeName}`} />
                <p className="mt-0.5 text-[9px] text-muted-foreground">Box Q1–Q3 · line median · rings IQR outliers. Same survey series as the main chart.</p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function tnLeaderLocal(shares: TnShares | null | undefined): TnGroup | null {
  if (!shares) return null;
  let best: TnGroup | null = null, v = -1;
  for (const g of TN_GROUPS) { const x = shares[g] ?? 0; if (x > v) { v = x; best = g; } }
  return best;
}
