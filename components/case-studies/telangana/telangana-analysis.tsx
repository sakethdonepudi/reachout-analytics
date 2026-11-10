"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { PARTY_COLOR, fmtPct, type AcRow, type DistrictRow } from "@/lib/telangana/oct26";
import { historicalDetail, type HistoricYear } from "@/lib/telangana/history";
import {
  P7S, P7_COLOR, P7_LABEL, projectVector, type Counts7, type P7, type Projected,
} from "@/lib/telangana/round-model";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import EChart from "@/components/case-studies/telangana/echart";
import AnalysisShell from "@/components/case-studies/shared/analysis-shell";
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
          if (d.label) return `<b>${P7_LABEL[d.party]} · ${d.label}</b><br/>${d.date ?? ""}<br/>Value <b>${d.value?.[1] == null ? "—" : `${d.value[1].toFixed(2)}${unit}`}</b> · ${d.entries} entries${d.deviation != null ? `<br/>Deviation ${signed(d.deviation)} ${unit}` : ""}`;
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

  const controls = (
    <div className="analysis-soft rounded-xl p-3">
      <div className="inline-flex w-full rounded-lg border border-[var(--a-border)] bg-[var(--a-panel)] p-0.5" role="group" aria-label="Metric">
        {([["share", "Vote share"], ["swing", "Swing"]] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={metric === id} onClick={() => setMetric(id)} className={cn("flex-1 rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors", metric === id ? "bg-[var(--a-ink)] text-[var(--a-canvas)]" : "text-[var(--a-muted)] hover:text-[var(--a-ink)]")}>{label}</button>
        ))}
      </div>

      <label className="mt-3 flex items-center justify-between gap-2 text-[10px] font-medium text-[var(--a-muted)]">Baseline
        <select value={baseline} onChange={(event) => setBaseline(event.target.value as HistoricYear)} className="rounded-md border border-[var(--a-border)] bg-[var(--a-panel)] px-1.5 py-1 text-[10px] text-[var(--a-ink)]">
          {BASELINES.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </label>

      <div className="mt-3">
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--a-muted)]">Smoothing</span>
        <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Smoothing">
          {SMOOTHS.map((item) => <button key={item.id} type="button" aria-pressed={smooth === item.id} onClick={() => setSmooth(item.id)} className={cn("rounded-full border px-2 py-1 text-[9.5px]", smooth === item.id ? "border-[var(--a-brass)]/50 bg-[var(--a-brass-soft)] text-[var(--a-ink)]" : "border-[var(--a-border)] text-[var(--a-muted)]")}>{item.label}</button>)}
        </div>
      </div>

      <div className="mt-3">
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--a-muted)]">Round size</span>
        <div className="mt-1 grid grid-cols-2 gap-1" role="group" aria-label="Round size">
          {(["388", "688"] as const).map((count) => <button key={count} type="button" aria-pressed={roundSize === count} onClick={() => setRoundSize(count)} className={cn("rounded-md border px-2 py-1 text-[9.5px]", roundSize === count ? "border-[var(--a-brass)]/50 bg-[var(--a-brass-soft)] text-[var(--a-ink)]" : "border-[var(--a-border)] text-[var(--a-muted)]")}>Samples {count}</button>)}
        </div>
      </div>

      <div className="mt-3">
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--a-muted)]">Parties</span>
        <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Parties">
          {P7S.map((party) => <button key={party} type="button" aria-pressed={parties.includes(party)} onClick={() => setParties((previous) => previous.includes(party) ? (previous.length > 1 ? previous.filter((item) => item !== party) : previous) : [...previous, party])} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9.5px]", parties.includes(party) ? "border-[var(--a-border)] text-[var(--a-ink)]" : "border-[var(--a-border)]/60 text-[var(--a-muted)] opacity-50")}><span className="size-2 rounded-sm" style={{ background: P7_COLOR[party] }} />{P7_LABEL[party]}</button>)}
          <button type="button" onClick={() => setParties([...P7S])} className={cn("rounded-full border px-2 py-1 text-[9.5px]", parties.length === P7S.length ? "border-[var(--a-brass)]/50 bg-[var(--a-brass-soft)] text-[var(--a-ink)]" : "border-[var(--a-border)] text-[var(--a-muted)]")}>All</button>
        </div>
      </div>

      <div className="mt-3 grid gap-1">
        <button type="button" aria-pressed={showMedian} onClick={() => setShowMedian((value) => !value)} className={cn("rounded-lg border px-2 py-1.5 text-left text-[10px]", showMedian ? "border-[var(--a-brass)]/50 bg-[var(--a-brass-soft)] text-[var(--a-ink)]" : "border-[var(--a-border)] text-[var(--a-muted)]")}>Show median</button>
        <button type="button" aria-pressed={highlightOutliers} onClick={() => setHighlightOutliers((value) => !value)} className={cn("rounded-lg border px-2 py-1.5 text-left text-[10px]", highlightOutliers ? "border-[var(--a-brass)]/50 bg-[var(--a-brass-soft)] text-[var(--a-ink)]" : "border-[var(--a-border)] text-[var(--a-muted)]")}>Highlight outliers</button>
      </div>

      <button type="button" onClick={() => { setMetric("share"); setBaseline("2023"); setSmooth("raw"); setRoundSize("388"); setParties([...P7S]); setShowMedian(true); setHighlightOutliers(true); setDistUnit("day"); setResetKey((key) => key + 1); }} className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-[var(--a-border)] px-2 py-1.5 text-[10px] font-semibold text-[var(--a-muted)] hover:text-[var(--a-ink)]">
        <RotateCcw className="size-3" /> Reset controls
      </button>
    </div>
  );

  return (
    <AnalysisShell
      open={open}
      onClose={onClose}
      eyebrow="2028 analysis"
      title={`${scopeName} · projection`}
      subtitle="2028 projection by survey round · round model"
      contentClassName="space-y-5"
    >
      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-600 dark:text-rose-400">{error}</div>}
      {loading && !data && <div className="grid h-48 place-items-center text-[12px] text-[var(--a-muted)]">Loading survey periods…</div>}

      {data && (
        <>
          <section className="analysis-panel rounded-2xl p-4 sm:p-5" aria-label="Projection by survey round">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--a-brass)]">Survey rounds</p>
                <h3 className="mt-0.5 font-display text-[18px] font-semibold leading-tight text-[var(--a-ink)]">{metric === "share" ? "Projected 2028 vote share" : `Swing vs ${baseline}`}</h3>
                <p className="mt-0.5 text-[10.5px] text-[var(--a-muted)]">Round model · 2023 actual + (2028 intention − recalled 2023) · normalised</p>
              </div>
              <span className="text-[10px] text-[var(--a-muted)]">{periods.length} {smooth === "quarter" ? "quarters" : "rounds"} · {smooth === "quarter" ? "calendar quarters" : `${roundSize} samples`}</span>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
              <aside aria-label="Projection controls">{controls}</aside>
              <div className="min-w-0">
                {showMedian && medianRows.some((row) => row.median != null) && (
                  <div className="mb-1 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[var(--a-muted)]">
                    {medianRows.filter((row) => row.median != null).map((row) => <span key={row.party} className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: P7_COLOR[row.party] }} />{P7_LABEL[row.party]} median <b className="tabular-nums text-[var(--a-ink)]/80">{row.median!.toFixed(1)}{unit}</b></span>)}
                  </div>
                )}
                <div className="analysis-chart-enter">
                  {periods.length ? (
                    <EChart key={resetKey} option={chartOption} height={340} reduced={reduced} replaceSeries ariaLabel={`${metric === "share" ? "Projected 2028 vote share" : `Swing vs ${baseline}`} for ${scopeName}`} onEvents={{ click: (params) => {
                      const query = params as { dataIndex?: number; data?: { value?: [number, number] } };
                      const x = Array.isArray(query.data?.value) ? query.data.value[0] : (query.dataIndex ?? -1);
                      const index = x - offset;
                      if (index >= 0 && index < periods.length) {
                        setSelectedPeriod(index);
                        document.getElementById(`tg-round-${index}`)?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
                      }
                    } }} />
                  ) : <div className="grid h-36 place-items-center text-[12px] text-[var(--a-muted)]">No rounds in this dataset.</div>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--a-border)] pt-2 text-[10px] text-[var(--a-muted)]">
                  <span>Collection <b className="text-[var(--a-ink)]/80">{data.dateMin && data.dateMax ? `${data.dateMin.slice(0, 10)} – ${data.dateMax.slice(0, 10)}` : "—"}</b></span>
                  <span>Rounds <b className="text-[var(--a-ink)]/80">{periods.length || "—"}</b></span>
                  <span>Latest <b className="text-[var(--a-ink)]/80">{latestPeriod ? dateOf(latestPeriod.end) : "—"}</b></span>
                  {latestLeader && <span className="ml-auto">Leading <b style={{ color: P7_COLOR[latestLeader] }}>{P7_LABEL[latestLeader]}</b> <b className="text-[var(--a-ink)]/80">{latestLeaderShare == null ? "—" : `${latestLeaderShare.toFixed(2)}%`}</b> {latestLeaderSwing == null ? "" : `· ${signed(latestLeaderSwing)} pp`}</span>}
                </div>
              </div>
            </div>
          </section>

          <section className="analysis-panel rounded-2xl p-4 sm:p-5" aria-label="Round-wise detail">
            <h3 className="font-display text-[18px] font-semibold leading-tight text-[var(--a-ink)]">Round-wise detail</h3>
            <div className="mt-3 max-h-[460px] overflow-auto rounded-xl border border-[var(--a-border)]">
              <table className="w-full border-collapse text-[10px]">
                <caption className="sr-only">Projected round detail for {scopeName}</caption>
                <thead className="sticky top-0 z-20 bg-[var(--a-panel)]">
                  <tr className="border-b border-[var(--a-border)] text-left text-[8px] uppercase tracking-wide text-[var(--a-muted)]">
                    <th rowSpan={2} className="sticky left-0 z-30 w-14 bg-[var(--a-panel)] px-2 py-1.5">Round</th>
                    <th rowSpan={2} className="sticky left-14 z-30 w-28 bg-[var(--a-panel)] px-2 py-1.5">Dates</th>
                    <th rowSpan={2} className="sticky left-[10.5rem] z-30 w-16 bg-[var(--a-panel)] px-2 py-1.5 text-right">Entries</th>
                    <th colSpan={parties.length} className={cn("px-2 py-1 text-center", metric === "share" && "text-[var(--a-ink)]")}>Projected party shares</th>
                    <th colSpan={parties.length} className={cn("px-2 py-1 text-center", metric === "swing" && "text-[var(--a-ink)]")}>Party swings vs {baseline}</th>
                  </tr>
                  <tr className="text-left text-[8px] text-[var(--a-muted)]">
                    {parties.map((party) => <th key={`p-${party}`} className="whitespace-nowrap px-2 py-1 text-right" style={{ color: P7_COLOR[party] }}>{P7_LABEL[party]}</th>)}
                    {parties.map((party) => <th key={`s-${party}`} className="whitespace-nowrap px-2 py-1 text-right" style={{ color: P7_COLOR[party] }}>Δ {P7_LABEL[party]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((period, index) => {
                    const projection = projections[index];
                    return (
                      <tr key={`${period.label}-${index}`} id={`tg-round-${index}`} tabIndex={0}
                        onMouseEnter={() => setFocusPeriod(index)} onMouseLeave={() => setFocusPeriod(null)} onFocus={() => setFocusPeriod(index)} onBlur={() => setFocusPeriod(null)}
                        onClick={() => { setSelectedPeriod(index); document.getElementById(`tg-round-${index}`)?.scrollIntoView({ block: "nearest" }); }}
                        className={cn("cursor-pointer border-t border-[var(--a-border)]/70 outline-none", selected === index ? "bg-[var(--a-brass-soft)]" : "hover:bg-[var(--a-panel-2)] focus:bg-[var(--a-panel-2)]")}>
                        <td className="sticky left-0 z-10 bg-[var(--a-panel)] px-2 py-1 font-medium">{period.label}</td>
                        <td className="sticky left-14 z-10 bg-[var(--a-panel)] px-2 py-1 text-[var(--a-muted)]">{dates(period.start, period.end)}</td>
                        <td className="sticky left-[10.5rem] z-10 bg-[var(--a-panel)] px-2 py-1 text-right tabular-nums">{period.entries.toLocaleString("en-IN")}{period.partial ? <span className="ml-0.5 opacity-60">*</span> : null}</td>
                        {parties.map((party) => <td key={`p-${party}`} className={cn("px-2 py-1 text-right tabular-nums", metric === "share" ? "font-semibold text-[var(--a-ink)]" : "text-[var(--a-muted)]")}>{projection ? projection[party].toFixed(2) : "—"}</td>)}
                        {parties.map((party) => <td key={`s-${party}`} className={cn("px-2 py-1 text-right tabular-nums", metric === "swing" ? "font-semibold text-[var(--a-ink)]" : "text-[var(--a-muted)]")}>{projection ? signed(projection[party] - baselineDetail[party] * 100) : "—"}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-[9px] text-[var(--a-muted)]">* Final remainder round, not a full sample.</p>
          </section>

          <section className="analysis-panel rounded-2xl p-4 sm:p-5" aria-label="District projection">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div><h3 className="font-display text-[18px] font-semibold leading-tight text-[var(--a-ink)]">District projection</h3><p className="mt-0.5 text-[10.5px] text-[var(--a-muted)]">2028 final AC model · AIMIM extracted from Others · weighted by 2023 votes.</p></div>
              <label className="inline-flex items-center gap-1 text-[10px] text-[var(--a-muted)]">Sort
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="rounded-md border border-[var(--a-border)] bg-[var(--a-panel)] px-1.5 py-1 text-[10px] text-[var(--a-ink)]"><option value="name">Name</option><option value="leader">2028 leading party</option><option value="margin">Margin</option></select>
              </label>
            </div>
            <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-[var(--a-border)]">
              <table className="w-full border-collapse text-[10.5px]">
                <caption className="sr-only">District 2028 AC model projection</caption>
                <thead className="sticky top-0 z-10 bg-[var(--a-panel)]"><tr className="border-b border-[var(--a-border)] text-left text-[8px] uppercase tracking-wide text-[var(--a-muted)]"><th className="px-2 py-1.5">District</th><th className="px-2 py-1.5">2028 leading party</th><th className="px-2 py-1.5 text-right">BRS</th><th className="px-2 py-1.5 text-right">Congress+</th><th className="px-2 py-1.5 text-right">BJP</th><th className="px-2 py-1.5 text-right">AIMIM</th><th className="px-2 py-1.5 text-right">Others</th><th className="px-2 py-1.5 text-right">Margin</th></tr></thead>
                <tbody>
                  {sortedDistricts.map((district) => (
                    <tr key={district.name} className={cn("cursor-pointer border-t border-[var(--a-border)]/70 hover:bg-[var(--a-panel-2)]", scope === `d:${district.name}` && "bg-[var(--a-brass-soft)]")} onClick={() => setScope(`d:${district.name}`)}>
                      <td className="px-2 py-1 font-medium">{district.name}</td>
                      <td className="px-2 py-1"><span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: district.leader === "Tie" ? p.muted : P7_COLOR[(district.leader === "Congress" ? "Congress" : district.leader) as P7] ?? P7_COLOR.Others }} />{district.leader}</span></td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtPct(district.prediction.BRS)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtPct(district.prediction.Congress)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtPct(district.prediction.BJP)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtPct(district.prediction.AIMIM)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtPct(district.prediction.Others)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{district.marginPp.toFixed(1)} pp</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="analysis-panel rounded-2xl p-4 sm:p-5" aria-label="Projected distribution">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div><h3 className="font-display text-[18px] font-semibold leading-tight text-[var(--a-ink)]">Projected 2028 distribution</h3><p className="mt-0.5 text-[10.5px] text-[var(--a-muted)]">{metric === "share" ? "Projected 2028 share" : `Swing vs ${baseline}`} · {distAvailable} periods · {distEntries.toLocaleString("en-IN")} entries</p></div>
              <div className="inline-flex rounded-full border border-[var(--a-border)] bg-[var(--a-panel-2)] p-0.5" role="group" aria-label="Distribution period">
                {([["day", "Daily"], ["block", "Every 50 responses"]] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={distUnit === id} onClick={() => setDistUnit(id)} className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", distUnit === id ? "bg-[var(--a-ink)] text-[var(--a-canvas)]" : "text-[var(--a-muted)]")}>{label}</button>)}
              </div>
            </div>
            {showMedian && (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[var(--a-muted)]">
                {parties.map((party) => { const stats = boxStats(distValues[party].map((point) => point.value)); return stats ? <span key={party} className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: P7_COLOR[party] }} />{P7_LABEL[party]} median <b className="tabular-nums text-[var(--a-ink)]/80">{stats.median.toFixed(1)}{unit}</b></span> : null; })}
              </div>
            )}
            <div className="analysis-chart-enter"><EChart option={distOption} height={310} reduced={reduced} replaceSeries ariaLabel={`${metric === "share" ? "Projected 2028 share" : "Swing"} distribution by party for ${scopeName}`} /></div>
            <p className="mt-0.5 text-[9px] text-[var(--a-muted)]">Box Q1–Q3 · line median · rings IQR outliers</p>
          </section>
        </>
      )}
    </AnalysisShell>
  );
}
