"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { PARTY_COLOR, fmtPct, type AcRow, type DistrictRow } from "@/lib/telangana/oct26";
import { historicalDetail, type HistoricYear } from "@/lib/telangana/history";
import {
  P7S, P7_COLOR, P7_LABEL, projectVector, type Counts7, type P7, type Projected,
} from "@/lib/telangana/round-model";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import EChart from "@/components/case-studies/telangana/echart";
import { cn } from "@/lib/utils";

/* =====================================================================
   Expanded Telangana analysis — round model.

   The main series is the reference-style projected 2028 vector by round:
   2023 actual + (2028 intention − recalled 2023), floor + normalise.
   The compact map table is the AC-based workbook model and is deliberately
   kept separate through its heading.
   ===================================================================== */

const BASELINES: HistoricYear[] = ["2014", "2018", "2023"];
const SMOOTHS = [
  { id: "raw", label: "Raw" }, { id: "7", label: "7-day" }, { id: "14", label: "14-day" },
  { id: "30", label: "30-day" }, { id: "quarter", label: "Quarterly" },
] as const;

type Period = {
  index: number; label: string; start: string; end: string;
  entries: number; answered2028: number; counts2028: Counts7;
  answered2023: number; counts2023: Counts7; partial?: boolean;
};
type DistPeriod = Period & { date?: string; periodIndex?: number };
type ScopeData = {
  version: string; source: string; scope: string; name: string;
  entries: number; dateMin: string | null; dateMax: string | null;
  rounds388: Period[]; rounds688: Period[]; daily: DistPeriod[]; blocks50: DistPeriod[];
  modelAssumptions?: Record<string, unknown>;
};
type BoxPoint = { value: number; label: string; date: string; entries: number };
type Stats = { q1: number; median: number; q3: number; lower: number; upper: number; whiskerLow: number; whiskerHigh: number; outliers: number[] };

const dateOf = (iso: string) => iso.slice(0, 10);
const dates = (start: string, end: string) => (dateOf(start) === dateOf(end) ? dateOf(start) : `${dateOf(start)} – ${dateOf(end)}`);
const signed = (v: number, d = 1) => `${v > 0 ? "+" : ""}${v.toFixed(d)}`;
const empty = (): Counts7 => Object.fromEntries(P7S.map((p) => [p, 0])) as Counts7;

function quantile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h), hi = Math.ceil(h);
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
  confine: true, backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, padding: [8, 10],
  textStyle: { color: p.text, fontSize: 11, fontFamily: "inherit" },
  extraCssText: "border-radius:8px;box-shadow:0 14px 34px -16px rgba(0,0,0,.6);max-width:340px;",
});

export default function TelanganaAnalysis({
  open, onClose, acs, districts, initialScope, initialLabel, theme, onSelectDistrict,
}: {
  open: boolean;
  onClose: () => void;
  acs: AcRow[];
  districts: DistrictRow[];
  initialScope: string;
  initialLabel: string;
  theme: "light" | "dark";
  onSelectDistrict: (name: string) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const p = palette(theme);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const requestSeq = useRef(0);

  const [scope, setScope] = useState(initialScope);
  const [data, setData] = useState<ScopeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<"share" | "swing">("share");
  const [baseline, setBaseline] = useState<HistoricYear>("2023");
  const [smooth, setSmooth] = useState<(typeof SMOOTHS)[number]["id"]>("raw");
  const [roundSize, setRoundSize] = useState<"388" | "688">("388");
  const [parties, setParties] = useState<P7[]>([...P7S]);
  const [showMedian, setShowMedian] = useState(true);
  const [highlightOutliers, setHighlightOutliers] = useState(true);
  const [distUnit, setDistUnit] = useState<"day" | "block">("day");
  const [focusPeriod, setFocusPeriod] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "leader" | "margin">("name");
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => { if (open) setScope(initialScope); }, [open, initialScope]);

  useEffect(() => {
    if (!open) return;
    const id = ++requestSeq.current;
    const controller = new AbortController();
    setLoading(true); setError(null);
    fetch(`/api/public/case-studies/telangana/rounds?scope=${encodeURIComponent(scope)}`, { cache: "no-store", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: ScopeData) => { if (id === requestSeq.current) setData(d); })
      .catch((e) => { if ((e as Error)?.name !== "AbortError" && id === requestSeq.current) setError(e instanceof Error ? e.message : "Could not load survey periods"); })
      .finally(() => { if (id === requestSeq.current) setLoading(false); });
    return () => controller.abort();
  }, [open, scope]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
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
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  const scopeAcs = useMemo(() => {
    if (scope === "state") return acs;
    if (scope.startsWith("d:")) return acs.filter((a) => a.district === scope.slice(2));
    return acs.filter((a) => a.no === Number(scope.slice(2)));
  }, [acs, scope]);

  const scopeName = scope === "state"
    ? "Telangana"
    : scope.startsWith("d:")
      ? scope.slice(2)
      : (acs.find((a) => a.no === Number(scope.slice(2)))?.name ?? data?.name ?? initialLabel);
  const actual = useMemo(() => historicalDetail(scopeAcs, "2023"), [scopeAcs]);
  const hist = useMemo(() => ({
    "2014": historicalDetail(scopeAcs, "2014"),
    "2018": historicalDetail(scopeAcs, "2018"),
    "2023": historicalDetail(scopeAcs, "2023"),
  }), [scopeAcs]);
  const baselineDetail = hist[baseline];

  const base = useMemo(() => (data ? (roundSize === "388" ? data.rounds388 : data.rounds688) : []), [data, roundSize]);
  const daily = useMemo(() => (data?.daily ?? []).map((d) => ({
    ...d, start: d.date ?? d.start, end: d.date ?? d.end,
    label: d.date ? dateOf(d.date) : "",
  })), [data]);

  const periods = useMemo<Period[]>(() => {
    if (!base.length) return [];
    if (smooth === "raw") return base.map((r) => ({ ...r, label: `R${r.index}` }));
    if (smooth === "quarter") {
      const groups = new Map<string, Period>();
      for (const d of daily) {
        const dt = new Date(d.start);
        const label = `Q${Math.floor(dt.getUTCMonth() / 3) + 1} ${dt.getUTCFullYear()}`;
        const cur = groups.get(label) ?? {
          index: groups.size, label, start: d.start, end: d.end, entries: 0,
          answered2028: 0, counts2028: empty(), answered2023: 0, counts2023: empty(),
        };
        cur.start = cur.start < d.start ? cur.start : d.start;
        cur.end = cur.end > d.end ? cur.end : d.end;
        cur.entries += d.entries;
        cur.answered2028 += d.answered2028;
        cur.answered2023 += d.answered2023;
        for (const q of P7S) { cur.counts2028[q] += d.counts2028[q]; cur.counts2023[q] += d.counts2023[q]; }
        groups.set(label, cur);
      }
      return [...groups.values()].sort((a, b) => a.start.localeCompare(b.start)).map((g, i) => ({ ...g, index: i }));
    }
    const days = Number(smooth);
    return base.map((r) => {
      const end = new Date(r.end).getTime();
      const start = end - days * 86_400_000;
      const window = daily.filter((d) => {
        const t = new Date(d.end).getTime();
        return t >= start && t <= end;
      });
      const agg: Period = {
        index: r.index, label: `R${r.index}`, start: window[0]?.start ?? r.start, end: r.end,
        entries: 0, answered2028: 0, counts2028: empty(), answered2023: 0, counts2023: empty(),
      };
      for (const d of window) {
        agg.entries += d.entries;
        agg.answered2028 += d.answered2028;
        agg.answered2023 += d.answered2023;
        for (const q of P7S) { agg.counts2028[q] += d.counts2028[q]; agg.counts2023[q] += d.counts2023[q]; }
      }
      return agg;
    });
  }, [base, daily, smooth]);

  const projections = useMemo< (Projected | null)[]>(() => periods.map((r) => projectVector(r, actual)), [periods, actual]);
  const valueOf = useCallback((proj: Projected | null, party: P7) => {
    if (!proj) return null;
    return metric === "share" ? proj[party] : proj[party] - baselineDetail[party] * 100;
  }, [metric, baselineDetail]);
  const unit = metric === "share" ? "%" : "pp";
  const anchorLabels = metric === "share" ? ["2014", "2018", "2023"] : ["2014 → 18", "2018 → 23"];
  const offset = anchorLabels.length + 1;
  const anchorTitle = (i: number) => metric === "share" ? `${anchorLabels[i]} actual` : `${anchorLabels[i]} actual swing`;
  const anchorAt = useCallback((i: number, party: P7) => {
    if (metric === "share") return hist[anchorLabels[i] as HistoricYear]?.[party] == null ? null : hist[anchorLabels[i] as HistoricYear][party] * 100;
    const from = i === 0 ? "2014" : "2018";
    const to = i === 0 ? "2018" : "2023";
    return (hist[to as HistoricYear][party] - hist[from as HistoricYear][party]) * 100;
  }, [metric, hist, anchorLabels]);
  const categories = useMemo(
    () => [...anchorLabels, "", ...periods.map((r) => r.label)],
    [anchorLabels, periods],
  );
  const selected = selectedPeriod ?? focusPeriod;

  useEffect(() => { setSelectedPeriod(null); setFocusPeriod(null); }, [scope, roundSize, smooth, metric, baseline]);

  const series = useMemo(() => {
    const out: Record<string, unknown>[] = [];
    const stats: Record<P7, Stats | null> = {} as Record<P7, Stats | null>;
    for (const party of parties) {
      const vals = projections.map((pr) => valueOf(pr, party));
      stats[party] = boxStats(vals.filter((v): v is number => v != null));
      out.push({
        name: `${P7_LABEL[party]} · actual`, type: "line",
        data: [
          ...anchorLabels.map((_, i) => ({ value: anchorAt(i, party) == null ? null : +anchorAt(i, party)!.toFixed(2), symbolSize: 6 })),
          null,
          ...periods.map(() => null),
        ],
        color: P7_COLOR[party], symbol: "circle",
        lineStyle: { color: P7_COLOR[party], width: 1.8, type: "solid" },
        itemStyle: { color: P7_COLOR[party] }, emphasis: { focus: "series" }, z: 4,
      });
      out.push({
        name: `${P7_LABEL[party]} · projected`, type: "line",
        data: [...Array(offset).fill(null), ...vals],
        color: P7_COLOR[party], symbol: "circle", symbolSize: 5.5,
        lineStyle: { color: P7_COLOR[party], width: 2.1, type: "solid" },
        itemStyle: { color: P7_COLOR[party] }, emphasis: { focus: "series" }, z: 5,
        markLine: showMedian && stats[party]?.median != null ? {
          silent: true, symbol: "none",
          lineStyle: { color: P7_COLOR[party], type: "dashed", width: 1.15, opacity: 0.8 },
          label: { show: false }, data: [{ yAxis: +stats[party]!.median.toFixed(2) }],
        } : undefined,
      });
      if (highlightOutliers) {
        const st = stats[party];
        if (st) {
          const points = periods.flatMap((r, i) => {
            const v = vals[i];
            if (v == null || !(v < st.lower || v > st.upper)) return [];
            return [{
              value: [offset + i, +v.toFixed(2)], party, label: r.label, date: dates(r.start, r.end),
              entries: r.entries, deviation: v - st.median,
            }];
          });
          if (points.length) {
            out.push({
              name: `${P7_LABEL[party]} · outlier`, type: reduced ? "scatter" : "effectScatter",
              data: points, symbolSize: 15,
              itemStyle: { color: "transparent", borderColor: P7_COLOR[party], borderWidth: 2 },
              rippleEffect: reduced ? undefined : { scale: 2.2, brushType: "stroke" },
              label: {
                show: true, position: "top", color: P7_COLOR[party], fontSize: 8.5, fontWeight: 600,
                formatter: (params: unknown) => {
                  const d = (params as { data?: { value?: [number, number] } }).data;
                  return d?.value ? `${d.value[1].toFixed(1)}${unit}` : "";
                },
              },
              labelLayout: { hideOverlap: true },
              tooltip: {
                formatter: (params: unknown) => {
                  const d = (params as { data?: { party: P7; label: string; date: string; value: [number, number]; entries: number; deviation: number } }).data;
                  if (!d) return "";
                  return `<b>${P7_LABEL[d.party]} · ${d.label}</b><br/>${d.date}<br/>Value <b>${d.value[1].toFixed(2)}${unit}</b> · ${d.entries} entries<br/>Deviation from median <b>${signed(d.deviation)} ${unit}</b>`;
                },
              },
              z: 14,
            });
          }
        }
      }
    }
    if (selected != null && periods[selected]) {
      out.push({
        name: "Selected period", type: "line", data: [], silent: true, z: 1,
        markLine: {
          silent: true, symbol: "none",
          lineStyle: { color: p.text, type: "dotted", width: 1, opacity: 0.55 },
          label: { show: true, position: "insideEndTop", color: p.muted, fontSize: 8, formatter: periods[selected].label },
          data: [{ xAxis: categories[offset + selected] }],
        },
      });
    }
    return out;
  }, [parties, periods, projections, valueOf, hist, baseline, metric, showMedian, highlightOutliers, reduced, selected, categories, p, unit, anchorAt, anchorLabels, offset]);

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
        if (index < anchorLabels.length) {
          const rows = parties.map((party) => { const v = anchorAt(index, party); return v == null ? "" : `<div style="display:flex;justify-content:space-between;gap:14px"><span><i style="display:inline-block;width:7px;height:7px;border-radius:2px;background:${P7_COLOR[party]};margin-right:5px"></i>${P7_LABEL[party]}</span><b>${v.toFixed(2)}${unit}</b></div>`; }).join("");
          return `<div style="font-weight:600;margin-bottom:3px">${anchorTitle(index)}</div>` + rows;
        }
        const pi = index - offset;
        const per = periods[pi];
        const proj = projections[pi];
        if (!per || !proj) return "";
        const rows = parties.map((party) => {
          const v = valueOf(proj, party);
          if (v == null) return "";
          return `<div style="display:flex;justify-content:space-between;gap:14px"><span><i style="display:inline-block;width:7px;height:7px;border-radius:2px;background:${P7_COLOR[party]};margin-right:5px"></i>${P7_LABEL[party]}</span><b>${v.toFixed(2)}${unit}</b></div>`;
        }).join("");
        return `<div style="font-weight:600">${per.label} · ${dates(per.start, per.end)}</div><div style="opacity:.65;margin-bottom:2px">${per.entries.toLocaleString("en-IN")} entries · ${per.answered2028.toLocaleString("en-IN")} answered 2028 · ${per.answered2023.toLocaleString("en-IN")} recalled 2023</div>${rows}`;
      },
    },
    xAxis: {
      type: "category", data: categories, boundaryGap: false,
      axisLine: { lineStyle: { color: p.axis } }, axisTick: { show: false },
      axisLabel: { color: p.muted, fontSize: 8.5, interval: "auto", hideOverlap: true, formatter: (v: string) => (v === "" ? "" : v) },
    },
    yAxis: {
      type: "value", axisLabel: { color: p.muted, fontSize: 9, formatter: `{value}${unit}` },
      splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false },
    },
    series,
  }), [series, categories, metric, offset, periods, projections, parties, valueOf, hist, p, reduced, unit, anchorAt, anchorLabels]);

  const medianRows = parties.map((party) => {
    const vals = projections.map((pr) => valueOf(pr, party)).filter((v): v is number => v != null);
    return { party, median: boxStats(vals)?.median ?? null };
  });

  const latestIndex = periods.length - 1;
  const latestPeriod = latestIndex >= 0 ? periods[latestIndex] : null;
  const latestProjection = latestIndex >= 0 ? projections[latestIndex] : null;
  const latestLeader = latestProjection ? P7S.reduce((best, party) => (latestProjection[party] > (latestProjection[best] ?? 0) ? party : best), P7S[0]) : null;
  const latestLeaderShare = latestLeader && latestProjection ? latestProjection[latestLeader] : null;
  const latestLeaderSwing = latestLeader && latestProjection ? latestProjection[latestLeader] - baselineDetail[latestLeader] * 100 : null;

  const distPeriods = useMemo<DistPeriod[]>(() => {
    if (!data) return [];
    const source = distUnit === "day" ? daily : data.blocks50;
    return source.map((x) => ({ ...x, start: x.start, end: x.end }));
  }, [data, distUnit, daily]);
  const distValues = useMemo<Record<P7, BoxPoint[]>>(() => {
    const out = {} as Record<P7, BoxPoint[]>;
    for (const party of P7S) {
      out[party] = [];
      distPeriods.forEach((per, i) => {
        const proj = projectVector(per, actual);
        if (!proj) return;
        const v = valueOf(proj, party);
        if (v == null) return;
        out[party].push({
          value: v, label: per.label || `#${i + 1}`,
          date: dates(per.start, per.end), entries: per.entries,
        });
      });
    }
    return out;
  }, [distPeriods, actual, valueOf]);
  const distEntries = distPeriods.reduce((s, x) => s + x.entries, 0);
  const distAvailable = distPeriods.filter((per) => projectVector(per, actual) != null).length;

  const distOption = useMemo(() => {
    const cats = parties.map((x) => P7_LABEL[x]);
    const box: unknown[] = [], medians: unknown[] = [], points: unknown[] = [], outliers: unknown[] = [];
    parties.forEach((party, i) => {
      const vals = distValues[party].map((x) => x.value);
      const st = boxStats(vals);
      if (!st) return;
      box.push({
        value: [+st.whiskerLow.toFixed(2), +st.q1.toFixed(2), +st.median.toFixed(2), +st.q3.toFixed(2), +st.whiskerHigh.toFixed(2)],
        party, itemStyle: { color: `${P7_COLOR[party]}22`, borderColor: P7_COLOR[party], borderWidth: 1.5 },
      });
      medians.push({
        value: [i, +st.median.toFixed(2)], party, itemStyle: { color: P7_COLOR[party] },
        label: { show: showMedian, formatter: `${st.median.toFixed(1)}${unit}`, color: P7_COLOR[party], fontSize: 8.5, position: "top" },
      });
      for (const point of distValues[party]) {
        const x = i + ((point.entries % 7) - 3) * 0.05;
        if (point.value < st.lower || point.value > st.upper) {
          outliers.push({ value: [x, +point.value.toFixed(2)], party, label: point.label, date: point.date, entries: point.entries, deviation: point.value - st.median, itemStyle: { color: "transparent", borderColor: P7_COLOR[party], borderWidth: 1.5 } });
        } else {
          points.push({ value: [x, +point.value.toFixed(2)], party, label: point.label, date: point.date, entries: point.entries, itemStyle: { color: P7_COLOR[party], opacity: 0.35 } });
        }
      }
    });
    return {
      animation: !reduced, animationDuration: 400,
      grid: { left: 46, right: 18, top: 28, bottom: 34 },
      tooltip: {
        ...tooltipStyle(p), trigger: "item",
        formatter: (params: unknown) => {
          const q = params as { seriesType?: string; data?: { party?: P7; label?: string; date?: string; entries?: number; deviation?: number; value?: number[] } };
          const d = q.data;
          if (!d?.party) return "";
          if (q.seriesType === "boxplot") {
            const st = boxStats(distValues[d.party].map((x) => x.value));
            if (!st) return "";
            return `<b>${P7_LABEL[d.party]}</b><br/>Q1 ${st.q1.toFixed(2)}${unit} · median ${st.median.toFixed(2)}${unit} · Q3 ${st.q3.toFixed(2)}${unit}<br/>Fences ${st.lower.toFixed(1)} / ${st.upper.toFixed(1)}`;
          }
          if (d.label) return `<b>${P7_LABEL[d.party]} · ${d.label}</b><br/>${d.date ?? ""}<br/>Value <b>${(d.value?.[1] ?? 0).toFixed(2)}${unit}</b> · ${d.entries} entries${d.deviation != null ? `<br/>Deviation ${signed(d.deviation)} ${unit}` : ""}`;
          return "";
        },
      },
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
    const list = [...districts];
    list.sort((a, b) => sortBy === "leader" ? String(a.leader).localeCompare(String(b.leader)) || a.name.localeCompare(b.name) : sortBy === "margin" ? b.marginPp - a.marginPp : a.name.localeCompare(b.name));
    return list;
  }, [districts, sortBy]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-background/80 p-0 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="tg-analysis-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="min-h-full w-full max-w-6xl overflow-y-auto border border-border bg-card shadow-2xl sm:min-h-0 sm:max-h-[96svh] sm:rounded-2xl">
        <div className="sticky top-0 z-30 flex items-start justify-between gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <h2 id="tg-analysis-title" className="font-display text-lg font-semibold leading-tight">Telangana analysis</h2>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{scopeName} · 2028 projection by survey round</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close analysis" className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60"><X className="size-4" /></button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="inline-flex rounded-full border border-border p-0.5" role="group" aria-label="Metric">
            {([["share", "Vote share"], ["swing", "Swing"]] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={metric === id} onClick={() => setMetric(id)} className={cn("rounded-full px-3 py-1 text-[11px] font-medium", metric === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{label}</button>)}
          </div>
          <label className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">Baseline
            <select value={baseline} onChange={(e) => setBaseline(e.target.value as HistoricYear)} className="rounded-md border border-border bg-background px-1.5 py-1 text-[10px] text-foreground">
              {BASELINES.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <div className="inline-flex flex-wrap gap-1" role="group" aria-label="Smoothing">
            {SMOOTHS.map((s) => <button key={s.id} type="button" aria-pressed={smooth === s.id} onClick={() => setSmooth(s.id)} className={cn("rounded-full border px-2 py-1 text-[10px]", smooth === s.id ? "border-foreground/40 bg-muted/40 text-foreground" : "border-border text-muted-foreground")}>{s.label}</button>)}
          </div>
          <div className="inline-flex gap-1" role="group" aria-label="Round size">
            {(["388", "688"] as const).map((n) => <button key={n} type="button" aria-pressed={roundSize === n} onClick={() => setRoundSize(n)} className={cn("rounded-full border px-2 py-1 text-[10px]", roundSize === n ? "border-foreground/40 bg-muted/40 text-foreground" : "border-border text-muted-foreground")}>Samples {n}</button>)}
          </div>
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Parties">
            {P7S.map((party) => <button key={party} type="button" aria-pressed={parties.includes(party)} onClick={() => setParties((prev) => prev.includes(party) ? (prev.length > 1 ? prev.filter((x) => x !== party) : prev) : [...prev, party])} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px]", parties.includes(party) ? "border-border text-foreground" : "border-border/60 text-muted-foreground opacity-45")}><span className="size-2 rounded-sm" style={{ background: P7_COLOR[party] }} />{P7_LABEL[party]}</button>)}
            <button type="button" onClick={() => setParties([...P7S])} className={cn("rounded-full border px-2 py-1 text-[10px]", parties.length === P7S.length ? "border-foreground/40 bg-muted/40 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>All parties</button>
          </div>
          <span className="text-[10px] text-muted-foreground">Range <b className="font-medium text-foreground/80">{data?.dateMin ?? "—"} – {data?.dateMax ?? "—"}</b></span>
          <button type="button" aria-pressed={showMedian} onClick={() => setShowMedian((v) => !v)} className={cn("rounded-full border px-2 py-1 text-[10px]", showMedian ? "border-foreground/40 bg-muted/40 text-foreground" : "border-border text-muted-foreground")}>Show median</button>
          <button type="button" aria-pressed={highlightOutliers} onClick={() => setHighlightOutliers((v) => !v)} className={cn("rounded-full border px-2 py-1 text-[10px]", highlightOutliers ? "border-foreground/40 bg-muted/40 text-foreground" : "border-border text-muted-foreground")}>Highlight outliers</button>
          <button type="button" onClick={() => { setMetric("share"); setBaseline("2023"); setSmooth("raw"); setRoundSize("388"); setParties([...P7S]); setShowMedian(true); setHighlightOutliers(true); setDistUnit("day"); setResetKey((k) => k + 1); }} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"><RotateCcw className="size-3" /> Reset</button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span>Collection <b className="text-foreground/80">{data?.dateMin && data?.dateMax ? `${data.dateMin.slice(0, 10)} – ${data.dateMax.slice(0, 10)}` : "—"}</b></span>
          <span>Rounds <b className="text-foreground/80">{periods.length || "—"}</b></span>
          <span>Latest <b className="text-foreground/80">{latestPeriod ? dateOf(latestPeriod.end) : "—"}</b></span>
          {latestLeader && <span className="ml-auto">Latest leader <b style={{ color: P7_COLOR[latestLeader] }}>{P7_LABEL[latestLeader]}</b> <b className="text-foreground/80">{latestLeaderShare == null ? "—" : `${latestLeaderShare.toFixed(2)}%`}</b> {latestLeaderSwing == null ? "" : `· ${signed(latestLeaderSwing)} pp`}</span>}
        </div>

        <div className="space-y-5 px-4 pb-8 pt-4">
          {latestProjection && (
            <section aria-label="Latest party summary">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-display text-[15px] font-semibold">Latest round · party summary</h3><span className="text-[10px] text-muted-foreground">{latestPeriod ? `${latestPeriod.label} · ${dates(latestPeriod.start, latestPeriod.end)}` : ""}</span></div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                {parties.map((party) => { const v = latestProjection[party]; const sw = latestProjection[party] - baselineDetail[party] * 100; return <div key={party} className="rounded-lg border border-border bg-card/70 px-2.5 py-2"><div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.08em]" style={{ color: P7_COLOR[party] }}><span className="size-1.5 rounded-sm" style={{ background: P7_COLOR[party] }} />{P7_LABEL[party]}</div><div className="mt-1 font-display text-[17px] tabular-nums text-foreground">{v.toFixed(2)}%</div><div className="text-[9px] tabular-nums text-muted-foreground">{sw == null ? "—" : `${signed(sw)} pp`} vs {baseline}</div></div>; })}
              </div>
            </section>
          )}
          {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-600 dark:text-rose-400">{error}</div>}
          {loading && !data && <div className="grid h-48 place-items-center text-[12px] text-muted-foreground">Loading survey periods…</div>}

          {data && (
            <>
              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3 className="font-display text-[15px] font-semibold">{metric === "share" ? "Projected 2028 vote share by survey round" : `Swing vs ${baseline} by survey round`}</h3>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Round model · 2023 actual + (2028 intention − recalled 2023) · normalised</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{data.dateMin} – {data.dateMax} · {periods.length} {smooth === "quarter" ? "quarters" : "rounds"} · {smooth === "quarter" ? "calendar quarters" : `${roundSize} samples`}</span>
                </div>
                {showMedian && medianRows.some((r) => r.median != null) && (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[9.5px] text-muted-foreground">
                    {medianRows.filter((r) => r.median != null).map((r) => <span key={r.party} className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: P7_COLOR[r.party] }} />{P7_LABEL[r.party]} median <b className="tabular-nums text-foreground/80">{r.median!.toFixed(1)}{unit}</b></span>)}
                  </div>
                )}
                {periods.length ? (
                  <EChart key={resetKey} option={chartOption} height={340} reduced={reduced} replaceSeries ariaLabel={`${metric === "share" ? "Projected 2028 vote share" : `Swing vs ${baseline}`} for ${scopeName}`} onEvents={{ click: (params) => {
                    const q = params as { dataIndex?: number; data?: { value?: [number, number] } };
                    const x = Array.isArray(q.data?.value) ? q.data.value[0] : (q.dataIndex ?? -1);
                    const idx = x - offset;
                    if (idx >= 0 && idx < periods.length) {
                      setSelectedPeriod(idx);
                      document.getElementById(`tg-round-${idx}`)?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
                    }
                  } }} />
                ) : <div className="grid h-36 place-items-center text-[12px] text-muted-foreground">No rounds in this dataset.</div>}
              </section>

              <section>
                <h3 className="font-display text-[15px] font-semibold">Round-wise detail</h3>
                <div className="mt-2 max-h-[460px] overflow-auto rounded-xl border border-border">
                  <table className="w-full border-collapse text-[10px]">
                    <caption className="sr-only">Projected round detail for {scopeName}</caption>
                    <thead className="sticky top-0 z-20 bg-card">
                      <tr className="text-left text-[8.5px] uppercase tracking-wide text-muted-foreground">
                        <th rowSpan={2} className="sticky left-0 z-30 w-14 bg-card px-2 py-1.5">Round</th>
                        <th rowSpan={2} className="sticky left-14 z-30 w-28 bg-card px-2 py-1.5">Dates</th>
                        <th rowSpan={2} className="sticky left-[10.5rem] z-30 w-16 bg-card px-2 py-1.5 text-right">Entries</th>
                        <th colSpan={parties.length} className={cn("px-2 py-1 text-center", metric === "share" && "text-foreground/85")}>Projected party shares</th>
                        <th colSpan={parties.length} className={cn("px-2 py-1 text-center", metric === "swing" && "text-foreground/85")}>Party swings vs {baseline}</th>
                      </tr>
                      <tr className="text-left text-[8.5px] text-muted-foreground">
                        {parties.map((party) => <th key={`p-${party}`} className="whitespace-nowrap px-2 py-1 text-right" style={{ color: P7_COLOR[party] }}>{P7_LABEL[party]}</th>)}
                        {parties.map((party) => <th key={`s-${party}`} className="whitespace-nowrap px-2 py-1 text-right" style={{ color: P7_COLOR[party] }}>Δ {P7_LABEL[party]}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((per, i) => {
                        const proj = projections[i];
                        return (
                          <tr key={`${per.label}-${i}`} id={`tg-round-${i}`} tabIndex={0}
                            onMouseEnter={() => setFocusPeriod(i)} onMouseLeave={() => setFocusPeriod(null)} onFocus={() => setFocusPeriod(i)} onBlur={() => setFocusPeriod(null)}
                            onClick={() => { setSelectedPeriod(i); document.getElementById(`tg-round-${i}`)?.scrollIntoView({ block: "nearest" }); }}
                            className={cn("cursor-pointer border-t border-border/60 outline-none", selected === i ? "bg-saffron/10" : "hover:bg-muted/30 focus:bg-muted/30")}>
                            <td className="sticky left-0 z-10 bg-card px-2 py-1 font-medium">{per.label}</td>
                            <td className="sticky left-14 z-10 bg-card px-2 py-1 text-muted-foreground">{dates(per.start, per.end)}</td>
                            <td className="sticky left-[10.5rem] z-10 bg-card px-2 py-1 text-right tabular-nums">{per.entries.toLocaleString("en-IN")}{per.partial ? <span className="ml-0.5 opacity-60">*</span> : null}</td>
                            {parties.map((party) => <td key={`p-${party}`} className={cn("px-2 py-1 text-right tabular-nums", metric === "share" ? "font-semibold text-foreground" : "text-muted-foreground")}>{proj ? proj[party].toFixed(2) : "—"}</td>)}
                            {parties.map((party) => <td key={`s-${party}`} className={cn("px-2 py-1 text-right tabular-nums", metric === "swing" ? "font-semibold text-foreground" : "text-muted-foreground")}>{proj ? signed(proj[party] - baselineDetail[party] * 100) : "—"}</td>)}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-[9px] text-muted-foreground">* Final remainder round, not a full sample.</p>
              </section>

              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div><h3 className="font-display text-[15px] font-semibold">District projection</h3><p className="mt-0.5 text-[10px] text-muted-foreground">2028 final AC model · four-group · weighted by 2023 votes.</p></div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">Sort
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="rounded-md border border-border bg-background px-1.5 py-1 text-[10px] text-foreground"><option value="name">Name</option><option value="leader">2028 leader</option><option value="margin">Margin</option></select>
                  </div>
                </div>
                <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-border">
                  <table className="w-full border-collapse text-[10.5px]">
                    <caption className="sr-only">District 2028 AC model projection</caption>
                    <thead className="sticky top-0 z-10 bg-card"><tr className="text-left text-[8.5px] uppercase tracking-wide text-muted-foreground"><th className="px-2 py-1.5">District</th><th className="px-2 py-1.5">2028 leader</th><th className="px-2 py-1.5 text-right">BRS</th><th className="px-2 py-1.5 text-right">Congress+</th><th className="px-2 py-1.5 text-right">BJP</th><th className="px-2 py-1.5 text-right">Others</th><th className="px-2 py-1.5 text-right">Margin</th></tr></thead>
                    <tbody>
                      {sortedDistricts.map((d) => (
                        <tr key={d.name} className={cn("cursor-pointer border-t border-border/60 hover:bg-muted/30", scope === `d:${d.name}` && "bg-saffron/10")} onClick={() => { setScope(`d:${d.name}`); onSelectDistrict(d.name); }}>
                          <td className="px-2 py-1 font-medium">{d.name}</td>
                          <td className="px-2 py-1"><span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: d.leader === "Tie" ? p.muted : P7_COLOR[(d.leader === "Congress" ? "Congress" : d.leader) as P7] ?? P7_COLOR.Others }} />{d.leader}</span></td>
                          <td className="px-2 py-1 text-right tabular-nums">{fmtPct(d.prediction.BRS)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{fmtPct(d.prediction.Congress)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{fmtPct(d.prediction.BJP)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{fmtPct(d.prediction.Others)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{d.marginPp.toFixed(1)} pp</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-[15px] font-semibold">Projected 2028 distribution</h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="inline-flex rounded-full border border-border p-0.5" role="group" aria-label="Distribution period">
                      {([["day", "Daily"], ["block", "Every 50 responses"]] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={distUnit === id} onClick={() => setDistUnit(id)} className={cn("rounded-full px-2.5 py-1 text-[10px]", distUnit === id ? "bg-foreground text-background" : "text-muted-foreground")}>{label}</button>)}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{metric === "share" ? "Projected 2028 share" : `Swing vs ${baseline}`} · {distAvailable} periods · {distEntries.toLocaleString("en-IN")} entries</span>
                  </div>
                </div>
                {showMedian && (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[9.5px] text-muted-foreground">
                    {parties.map((party) => { const st = boxStats(distValues[party].map((x) => x.value)); return st ? <span key={party} className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: P7_COLOR[party] }} />{P7_LABEL[party]} median <b className="tabular-nums text-foreground/80">{st.median.toFixed(1)}{unit}</b></span> : null; })}
                  </div>
                )}
                <EChart option={distOption} height={310} reduced={reduced} replaceSeries ariaLabel={`${metric === "share" ? "Projected 2028 share" : "Swing"} distribution by party for ${scopeName}`} />
                <p className="mt-0.5 text-[9px] text-muted-foreground">Box Q1–Q3 · line median · rings IQR outliers</p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
