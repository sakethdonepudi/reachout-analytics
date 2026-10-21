"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, RotateCcw, X } from "lucide-react";
import { PARTY_COLOR, fmtPct, type AcRow, type DistrictRow } from "@/lib/telangana/oct26";
import { historicalAc, type HistoricYear } from "@/lib/telangana/history";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import EChart from "@/components/case-studies/telangana/echart";
import { cn } from "@/lib/utils";

/* =====================================================================
   Expanded Telangana analysis.

   Survey periods are aggregate-only: 388/688 sequential rounds, calendar
   days and deterministic 50-response blocks from the source records. The
   2028 series is the raw survey (AIMIM separate); the compact map table
   keeps the model projection and its four comparison groups.
   ===================================================================== */

type P5 = "BRS" | "Congress" | "BJP" | "AIMIM" | "Others";
const P5S: P5[] = ["BRS", "Congress", "BJP", "AIMIM", "Others"];
const P5_LABEL: Record<P5, string> = { BRS: "BRS", Congress: "Congress+", BJP: "BJP", AIMIM: "AIMIM", Others: "Others" };
const P5_COLOR: Record<P5, string> = { BRS: PARTY_COLOR.BRS, Congress: PARTY_COLOR.Congress, BJP: PARTY_COLOR.BJP, AIMIM: "#16a34a", Others: PARTY_COLOR.Others };
const HIST_YEARS: HistoricYear[] = ["2014", "2018", "2023"];
const BASELINES: HistoricYear[] = ["2014", "2018", "2023"];
const SMOOTHS = [{ id: "raw", label: "Raw" }, { id: "7", label: "7-day" }, { id: "14", label: "14-day" }, { id: "30", label: "30-day" }, { id: "quarter", label: "Quarterly" }] as const;

type Counts = Record<P5, number>;
type Period = { index: number; label: string; start: string; end: string; n: number; counts: Counts; partial?: boolean };
type DistPeriod = { label?: string; start: string; end: string; n: number; counts: Counts; partial?: boolean; index?: number };
type DayRow = { date: string; n: number; counts: Counts };
type ScopeData = {
  version: string; parties?: string[]; partyGroups?: Record<string, string>;
  scope: string; name: string; eligible: number; dateMin: string | null; dateMax: string | null;
  rounds388: Period[]; rounds688: Period[]; daily: DayRow[]; blocks50: DistPeriod[];
};
type Stats = { q1: number; median: number; q3: number; lower: number; upper: number; whiskerLow: number; whiskerHigh: number; outliers: number[] };
type BoxPoint = { value: number; label: string; date: string; n: number; periodIndex: number };

const dateOf = (iso: string) => iso.slice(0, 10);
const dates = (start: string, end: string) => (dateOf(start) === dateOf(end) ? dateOf(start) : `${dateOf(start)} – ${dateOf(end)}`);
const emptyCounts = (): Counts => ({ BRS: 0, Congress: 0, BJP: 0, AIMIM: 0, Others: 0 });
const signed = (v: number, d = 1) => `${v > 0 ? "+" : ""}${v.toFixed(d)}`;

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
    whiskerLow: inside.length ? inside[0] : sorted[0],
    whiskerHigh: inside.length ? inside[inside.length - 1] : sorted[sorted.length - 1],
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
    panel: dark ? "rgba(255,255,255,.03)" : "rgba(20,24,31,.025)",
  };
}
type Pal = ReturnType<typeof palette>;
const tooltipStyle = (p: Pal) => ({
  confine: true, backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, padding: [8, 10],
  textStyle: { color: p.text, fontSize: 11, fontFamily: "inherit" },
  extraCssText: "border-radius:8px;box-shadow:0 14px 34px -16px rgba(0,0,0,.6);max-width:340px;",
});

function historicalSeries(acs: AcRow[], year: HistoricYear) {
  let weight = 0;
  const out: Counts = emptyCounts();
  for (const a of acs) {
    const rec = historicalAc(year, a.no);
    if (!rec || !(rec.total > 0)) continue;
    weight += rec.total;
    out.BRS += rec.shares.BRS * rec.total;
    out.Congress += rec.shares.Congress * rec.total;
    out.BJP += rec.shares.BJP * rec.total;
    out.AIMIM += rec.aimimShare * rec.total;
    out.Others += Math.max(0, rec.shares.Others - rec.aimimShare) * rec.total;
  }
  if (weight) for (const p of P5S) out[p] /= weight;
  return out;
}

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
  const [parties, setParties] = useState<P5[]>([...P5S]);
  const [showMedian, setShowMedian] = useState(true);
  const [highlightOutliers, setHighlightOutliers] = useState(true);
  const [distUnit, setDistUnit] = useState<"day" | "block">("day");
  const [focusPeriod, setFocusPeriod] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "leader" | "margin">("name");

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
    const no = Number(scope.slice(2));
    return acs.filter((a) => a.no === no);
  }, [acs, scope]);

  const scopeName = data?.name ?? initialLabel;
  const hist = useMemo(() => ({
    "2014": historicalSeries(scopeAcs, "2014"),
    "2018": historicalSeries(scopeAcs, "2018"),
    "2023": historicalSeries(scopeAcs, "2023"),
  }), [scopeAcs]);
  const baselineShares = hist[baseline];

  const baseRounds = useMemo(() => (data ? (roundSize === "388" ? data.rounds388 : data.rounds688) : []), [data, roundSize]);
  const filteredBase = baseRounds;

  const periods = useMemo<Period[]>(() => {
    if (!filteredBase.length) return [];
    if (smooth === "raw") return filteredBase.map((r) => ({ ...r, label: `R${r.index}` }));
    if (smooth === "quarter") {
      /* true calendar quarters from the day groups, not round end dates */
      const groups = new Map<string, { start: string; end: string; n: number; counts: Counts }>();
      for (const rawDay of (data?.daily ?? [])) {
        const day = { start: rawDay.date, end: rawDay.date, n: rawDay.n, counts: rawDay.counts };
        const d = new Date(day.start);
        const label = `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
        const cur = groups.get(label) ?? { start: day.start, end: day.end, n: 0, counts: emptyCounts() };
        cur.start = cur.start < day.start ? cur.start : day.start;
        cur.end = cur.end > day.end ? cur.end : day.end;
        cur.n += day.n;
        for (const party of P5S) cur.counts[party] += day.counts[party];
        groups.set(label, cur);
      }
      return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, g], index) => ({ index, label, ...g }));
    }
    const days = Number(smooth);
    return filteredBase.map((r) => {
      const end = new Date(r.end).getTime();
      const start = end - days * 86_400_000;
      const window = filteredBase.filter((x) => {
        const t = new Date(x.end).getTime();
        return t >= start && t <= end;
      });
      const counts = emptyCounts();
      let n = 0, first = window[0]?.start ?? r.start, last = r.end;
      for (const x of window) {
        n += x.n;
        for (const party of P5S) counts[party] += x.counts[party];
        if (x.start < first) first = x.start;
        if (x.end > last) last = x.end;
      }
      return { index: r.index, label: `R${r.index}`, start: first, end: last, n, counts };
    });
  }, [filteredBase, smooth, data]);

  const surveyValue = useCallback((period: Period, party: P5) => {
    if (!period.n) return null;
    const share = (period.counts[party] / period.n) * 100;
    return metric === "share" ? share : share - baselineShares[party] * 100;
  }, [metric, baselineShares]);

  const showPeriods = periods.length > 0;
  const offset = metric === "share" ? 4 : 0;
  const categories = useMemo(() => {
    if (metric === "share") return ["2014", "2018", "2023", "", ...periods.map((x) => x.label)];
    return periods.map((x) => x.label);
  }, [metric, periods]);
  const unit = metric === "share" ? "%" : "pp";
  const selected = selectedPeriod ?? focusPeriod;

  useEffect(() => { setSelectedPeriod(null); setFocusPeriod(null); }, [scope, roundSize, smooth, metric, baseline]);

  const series = useMemo(() => {
    const out: Record<string, unknown>[] = [];
    const surveyStats: Record<P5, Stats | null> = {} as Record<P5, Stats | null>;
    const surveyValues: Record<P5, (number | null)[]> = {} as Record<P5, (number | null)[]>;
    for (const party of parties) {
      const values = periods.map((per) => surveyValue(per, party));
      surveyValues[party] = values;
      const clean = values.filter((v): v is number => v != null);
      surveyStats[party] = boxStats(clean);
      if (metric === "share") {
        out.push({
          name: `${P5_LABEL[party]} · actual`, type: "line",
          data: [
            { value: +(hist["2014"][party] * 100).toFixed(2), symbolSize: baseline === "2014" ? 9 : 6 },
            { value: +(hist["2018"][party] * 100).toFixed(2), symbolSize: baseline === "2018" ? 9 : 6 },
            { value: +(hist["2023"][party] * 100).toFixed(2), symbolSize: baseline === "2023" ? 9 : 6 },
            null,
            ...periods.map(() => null),
          ],
          color: P5_COLOR[party], symbol: "circle",
          lineStyle: { color: P5_COLOR[party], width: 1.8, type: "solid" },
          itemStyle: { color: P5_COLOR[party] }, emphasis: { focus: "series" }, z: 4,
        });
      }
      out.push({
        name: `${P5_LABEL[party]} · survey`, type: "line",
        data: [...(metric === "share" ? [null, null, null, null] : []), ...values],
        color: P5_COLOR[party], symbol: "circle", symbolSize: 5.5,
        lineStyle: { color: P5_COLOR[party], width: 2.1, type: "solid" }, itemStyle: { color: P5_COLOR[party] },
        emphasis: { focus: "series" }, z: 5,
        markLine: showMedian && surveyStats[party]?.median != null ? {
          silent: true, symbol: "none",
          lineStyle: { color: P5_COLOR[party], type: "dashed", width: 1.15, opacity: 0.8 },
          label: { show: false },
          data: [{ yAxis: +surveyStats[party]!.median.toFixed(2) }],
        } : undefined,
      });
      if (highlightOutliers) {
        const st = surveyStats[party];
        if (st && st.outliers.length) {
          const points = periods.flatMap((per, i) => {
            const v = values[i];
            if (v == null || !(v < st.lower || v > st.upper)) return [];
            return [{
              value: [offset + i, +v.toFixed(2)],
              party, label: per.label, date: dates(per.start, per.end), n: per.n,
              deviation: v - st.median,
            }];
          });
          if (points.length) {
            out.push({
              name: `${P5_LABEL[party]} · outlier`,
              type: reduced ? "scatter" : "effectScatter",
              data: points, symbolSize: 15,
              itemStyle: { color: "transparent", borderColor: P5_COLOR[party], borderWidth: 2 },
              rippleEffect: reduced ? undefined : { scale: 2.2, brushType: "stroke" },
              label: {
                show: true, position: "top", color: P5_COLOR[party], fontSize: 8.5, fontWeight: 600,
                formatter: (params: unknown) => {
                  const d = (params as { data?: { value?: [number, number] } }).data;
                  return d?.value ? `${d.value[1].toFixed(1)}${unit}` : "";
                },
              },
              labelLayout: { hideOverlap: true },
              tooltip: {
                formatter: (params: unknown) => {
                  const d = (params as { data?: { party: P5; label: string; date: string; value: [number, number]; n: number; deviation: number } }).data;
                  if (!d) return "";
                  return `<b>${P5_LABEL[d.party]} · ${d.label}</b><br/>${d.date}<br/>Value <b>${d.value[1].toFixed(2)}${unit}</b> · n=${d.n}<br/>Deviation from median <b>${signed(d.deviation)} ${unit}</b>`;
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
  }, [parties, periods, surveyValue, hist, baseline, metric, showMedian, highlightOutliers, reduced, offset, selected, categories, p, unit]);

  const chartOption = useMemo(() => ({
    animation: !reduced, animationDuration: 450, animationEasing: "cubicOut",
    grid: { left: 44, right: 22, top: 20, bottom: 38 },
    tooltip: {
      ...tooltipStyle(p), trigger: "axis", axisPointer: { type: "line", lineStyle: { color: p.axis, type: "dashed" } },
      formatter: (params: unknown) => {
        const list = Array.isArray(params) ? params as { dataIndex: number }[] : [];
        const index = list[0]?.dataIndex ?? -1;
        if (index < 0) return "";
        if (metric === "share" && index < 3) {
          const year = HIST_YEARS[index];
          return `<div style="font-weight:600;margin-bottom:3px">${year} actual</div>` + parties.map((party) => `<div style="display:flex;justify-content:space-between;gap:14px"><span><i style="display:inline-block;width:7px;height:7px;border-radius:2px;background:${P5_COLOR[party]};margin-right:5px"></i>${P5_LABEL[party]}</span><b>${(hist[year][party] * 100).toFixed(2)}%</b></div>`).join("");
        }
        const pi = index - offset;
        const per = periods[pi];
        if (!per) return "";
        const rows = parties.map((party) => {
          const v = surveyValue(per, party);
          if (v == null) return "";
          const share = (per.counts[party] / per.n) * 100;
          return `<div style="display:flex;justify-content:space-between;gap:14px"><span><i style="display:inline-block;width:7px;height:7px;border-radius:2px;background:${P5_COLOR[party]};margin-right:5px"></i>${P5_LABEL[party]}</span><b>${v.toFixed(2)}${unit}</b>${metric === "swing" ? `<span style="opacity:.6"> (${share.toFixed(1)}%)</span>` : ""}</div>`;
        }).join("");
        return `<div style="font-weight:600">${per.label} · ${dates(per.start, per.end)}</div><div style="opacity:.65;margin-bottom:2px">${per.n.toLocaleString("en-IN")} responses${per.partial ? " · partial" : ""}</div>${rows}`;
      },
    },
    xAxis: {
      type: "category", data: categories, boundaryGap: metric === "swing",
      axisLine: { lineStyle: { color: p.axis } }, axisTick: { show: false },
      axisLabel: { color: p.muted, fontSize: 8.5, interval: "auto", hideOverlap: true, formatter: (v: string) => v === "" ? "" : v },
    },
    yAxis: {
      type: "value", axisLabel: { color: p.muted, fontSize: 9, formatter: `{value}${unit}` },
      splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false },
    },
    series,
  }), [series, categories, metric, offset, periods, parties, surveyValue, hist, p, reduced, unit]);

  /* ---------------- distribution periods ---------------- */
  const distPeriods = useMemo<DistPeriod[]>(() => {
    if (!data) return [];
    const source: DistPeriod[] = distUnit === "day"
      ? data.daily.map((d) => ({ start: d.date, end: d.date, n: d.n, counts: d.counts }))
      : data.blocks50;
    return source.map((x) => ({ ...x, label: distUnit === "day" ? dateOf(x.start) : `#${x.index ?? ""}` }));
  }, [data, distUnit]);
  const distValues = useMemo<Record<P5, BoxPoint[]>>(() => {
    const out = {} as Record<P5, BoxPoint[]>;
    for (const party of P5S) {
      out[party] = distPeriods.flatMap((per, i) => {
        if (!per.n) return [];
        const share = (per.counts[party] / per.n) * 100;
        return [{ value: metric === "share" ? share : share - baselineShares[party] * 100, label: per.label ?? (distUnit === "day" ? dateOf(per.start) : `#${per.index ?? i + 1}`), date: dates(per.start, per.end), n: per.n, periodIndex: i }];
      });
    }
    return out;
  }, [distPeriods, metric, baselineShares, distUnit]);

  const distOption = useMemo(() => {
    const cats = parties.map((x) => P5_LABEL[x]);
    const box: unknown[] = [];
    const medians: unknown[] = [];
    const points: unknown[] = [];
    const outliers: unknown[] = [];
    parties.forEach((party, i) => {
      const values = distValues[party].map((x) => x.value);
      const st = boxStats(values);
      if (!st) return;
      box.push({
        value: [+st.whiskerLow.toFixed(2), +st.q1.toFixed(2), +st.median.toFixed(2), +st.q3.toFixed(2), +st.whiskerHigh.toFixed(2)],
        party,
        itemStyle: { color: `${P5_COLOR[party]}22`, borderColor: P5_COLOR[party], borderWidth: 1.5 },
      });
      medians.push({
        value: [i, +st.median.toFixed(2)], party,
        itemStyle: { color: P5_COLOR[party] },
        label: { show: showMedian, formatter: `${st.median.toFixed(1)}${unit}`, color: P5_COLOR[party], fontSize: 8.5, position: "top" },
      });
      for (const point of distValues[party]) {
        const x = i + ((point.periodIndex % 7) - 3) * 0.055;
        if (point.value < st.lower || point.value > st.upper) {
          outliers.push({ value: [x, +point.value.toFixed(2)], party, label: point.label, date: point.date, n: point.n, deviation: point.value - st.median, itemStyle: { color: "transparent", borderColor: P5_COLOR[party], borderWidth: 1.5 } });
        } else {
          points.push({ value: [x, +point.value.toFixed(2)], party, label: point.label, date: point.date, n: point.n, itemStyle: { color: P5_COLOR[party], opacity: 0.35 } });
        }
      }
    });
    return {
      animation: !reduced, animationDuration: 400,
      grid: { left: 46, right: 18, top: 28, bottom: 34 },
      tooltip: {
        ...tooltipStyle(p), trigger: "item",
        formatter: (params: unknown) => {
          const q = params as { seriesType?: string; name?: string; data?: { party?: P5; label?: string; date?: string; n?: number; deviation?: number; value?: number[] } };
          const d = q.data;
          if (!d) return "";
          if (q.seriesType === "boxplot") {
            const st = d.party ? boxStats(distValues[d.party].map((x) => x.value)) : null;
            if (!st) return "";
            return `<b>${P5_LABEL[d.party!]}</b><br/>Q1 ${st.q1.toFixed(2)}${unit} · median ${st.median.toFixed(2)}${unit} · Q3 ${st.q3.toFixed(2)}${unit}<br/>Fences ${st.lower.toFixed(1)} / ${st.upper.toFixed(1)}`;
          }
          if (d.party && d.label) {
            return `<b>${P5_LABEL[d.party]} · ${d.label}</b><br/>${d.date ?? ""}<br/>Value <b>${(d.value?.[1] ?? 0).toFixed(2)}${unit}</b> · n=${d.n}${d.deviation != null ? `<br/>Deviation ${signed(d.deviation)} ${unit}` : ""}`;
          }
          return "";
        },
      },
      xAxis: {
        type: "category", data: cats, axisLine: { lineStyle: { color: p.axis } }, axisTick: { show: false },
        axisLabel: { color: p.text, fontSize: 9, interval: 0 },
      },
      yAxis: {
        type: "value", axisLabel: { color: p.muted, fontSize: 9, formatter: `{value}${unit}` },
        splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false },
      },
      series: [
        { name: "Distribution", type: "boxplot", data: box, boxWidth: [10, 28], z: 3 },
        { name: "Periods", type: "scatter", data: points, symbolSize: 4, itemStyle: { opacity: 0.35 }, z: 2 },
        { name: "Outliers", type: reduced ? "scatter" : "effectScatter", data: outliers, symbolSize: 11, itemStyle: { color: "transparent", borderWidth: 1.5 }, rippleEffect: reduced ? undefined : { scale: 2, brushType: "stroke" }, z: 5 },
        { name: "Median", type: "scatter", data: medians, symbol: "diamond", symbolSize: 7, itemStyle: { color: "transparent" }, z: 6 },
      ],
    };
  }, [parties, distValues, metric, baselineShares, p, reduced, showMedian, unit]);

  const medianRows = parties.map((party) => {
    const values = periods.map((per) => surveyValue(per, party)).filter((v): v is number => v != null);
    const st = boxStats(values);
    return { party, median: st?.median ?? null };
  });
  const distResponses = distPeriods.reduce((s, x) => s + x.n, 0);

  const sortedDistricts = useMemo(() => {
    const list = [...districts];
    list.sort((a, b) => {
      if (sortBy === "leader") return String(a.leader).localeCompare(String(b.leader)) || a.name.localeCompare(b.name);
      if (sortBy === "margin") return b.marginPp - a.marginPp;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [districts, sortBy]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-background/80 p-0 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="tg-analysis-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="min-h-full w-full max-w-6xl overflow-y-auto border border-border bg-card shadow-2xl sm:min-h-0 sm:max-h-[96svh] sm:rounded-2xl">
        <div className="sticky top-0 z-30 flex items-start justify-between gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <h2 id="tg-analysis-title" className="font-display text-lg font-semibold leading-tight">Telangana analysis</h2>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{scopeName} · 2014–2023 results and 2028 survey rounds</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close analysis"
            className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="inline-flex rounded-full border border-border p-0.5" role="group" aria-label="Metric">
            {([["share", "Vote share"], ["swing", "Swing"]] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={metric === id} onClick={() => setMetric(id)} className={cn("rounded-full px-3 py-1 text-[11px] font-medium", metric === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{label}</button>
            ))}
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
          <div className="flex flex-wrap gap-1" role="group" aria-label="Parties">
            {P5S.map((party) => <button key={party} type="button" aria-pressed={parties.includes(party)} onClick={() => setParties((prev) => prev.includes(party) ? (prev.length > 1 ? prev.filter((x) => x !== party) : prev) : [...prev, party])} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px]", parties.includes(party) ? "border-border text-foreground" : "border-border/60 text-muted-foreground opacity-45")}><span className="size-2 rounded-sm" style={{ background: P5_COLOR[party] }} />{P5_LABEL[party]}</button>)}
          </div>
          <span className="text-[10px] text-muted-foreground">Range <b className="font-medium text-foreground/80">{data?.dateMin ?? "—"} – {data?.dateMax ?? "—"}</b></span>
          <button type="button" aria-pressed={showMedian} onClick={() => setShowMedian((v) => !v)} className={cn("rounded-full border px-2 py-1 text-[10px]", showMedian ? "border-foreground/40 bg-muted/40 text-foreground" : "border-border text-muted-foreground")}>Show median</button>
          <button type="button" aria-pressed={highlightOutliers} onClick={() => setHighlightOutliers((v) => !v)} className={cn("rounded-full border px-2 py-1 text-[10px]", highlightOutliers ? "border-foreground/40 bg-muted/40 text-foreground" : "border-border text-muted-foreground")}>Highlight outliers</button>
          <button type="button" onClick={() => { setMetric("share"); setBaseline("2023"); setSmooth("raw"); setRoundSize("388"); setParties([...P5S]); setShowMedian(true); setHighlightOutliers(true); setDistUnit("day"); }} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"><RotateCcw className="size-3" /> Reset</button>
        </div>

        <div className="space-y-5 px-4 pb-8 pt-4">
          {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-600 dark:text-rose-400">{error}</div>}
          {loading && !data && <div className="grid h-48 place-items-center text-[12px] text-muted-foreground">Loading survey periods…</div>}

          {data && (
            <>
              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-[15px] font-semibold">{metric === "share" ? "Vote share · election results and 2028 survey rounds" : `Swing · 2028 survey minus ${baseline}`}</h3>
                  <span className="text-[10px] text-muted-foreground">{data.dateMin} – {data.dateMax} · {periods.length} {smooth === "quarter" ? "quarters" : "rounds"} · {smooth === "quarter" ? "calendar quarters" : `${roundSize} samples`}</span>
                </div>
                {showMedian && medianRows.some((r) => r.median != null) && (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[9.5px] text-muted-foreground">
                    {medianRows.filter((r) => r.median != null).map((r) => <span key={r.party} className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: P5_COLOR[r.party] }} />{P5_LABEL[r.party]} median <b className="tabular-nums text-foreground/80">{r.median!.toFixed(1)}{unit}</b></span>)}
                  </div>
                )}
                {showPeriods ? (
                  <EChart option={chartOption} height={340} reduced={reduced} replaceSeries ariaLabel={`${metric === "share" ? "Vote share" : "Swing"} chart for ${scopeName}, election results and 2028 survey rounds`} onEvents={{ click: (params) => {
                    const q = params as { dataIndex?: number; data?: { value?: [number, number] } };
                    const x = Array.isArray(q.data?.value) ? q.data.value[0] : (q.dataIndex ?? -1);
                    const idx = x - offset;
                    if (idx >= 0 && idx < periods.length) {
                      setSelectedPeriod(idx);
                      document.getElementById(`tg-round-${idx}`)?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
                    }
                  } }} />
                ) : <div className="grid h-36 place-items-center text-[12px] text-muted-foreground">No rounds in this date range.</div>}
              </section>

              <section>
                <h3 className="font-display text-[15px] font-semibold">Round-wise detail</h3>
                <div className="mt-2 max-h-[420px] overflow-auto rounded-xl border border-border">
                  <table className="w-full border-collapse text-[10px]">
                    <caption className="sr-only">Round-wise survey detail for {scopeName}</caption>
                    <thead className="sticky top-0 z-20 bg-card">
                      <tr className="text-left text-[8.5px] uppercase tracking-wide text-muted-foreground">
                        <th rowSpan={2} className="sticky left-0 z-30 w-14 bg-card px-2 py-1.5">Round</th>
                        <th rowSpan={2} className="sticky left-14 z-30 w-28 bg-card px-2 py-1.5">Dates</th>
                        <th rowSpan={2} className="sticky left-[10.5rem] z-30 w-16 bg-card px-2 py-1.5 text-right">Responses</th>
                        <th colSpan={parties.length} className={cn("px-2 py-1 text-center", metric === "share" && "text-foreground/85")}>Party percentages</th>
                        <th colSpan={parties.length} className={cn("px-2 py-1 text-center", metric === "swing" && "text-foreground/85")}>Party swings vs {baseline}</th>
                      </tr>
                      <tr className="text-left text-[8.5px] text-muted-foreground">
                        {parties.map((party) => <th key={`p-${party}`} className="whitespace-nowrap px-2 py-1 text-right" style={{ color: P5_COLOR[party] }}>{P5_LABEL[party]}</th>)}
                        {parties.map((party) => <th key={`s-${party}`} className="whitespace-nowrap px-2 py-1 text-right" style={{ color: P5_COLOR[party] }}>Δ {P5_LABEL[party]}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((per, i) => (
                        <tr key={`${per.label}-${i}`} id={`tg-round-${i}`} tabIndex={0}
                          onMouseEnter={() => setFocusPeriod(i)} onMouseLeave={() => setFocusPeriod(null)} onFocus={() => setFocusPeriod(i)} onBlur={() => setFocusPeriod(null)}
                          onClick={() => { setSelectedPeriod(i); document.getElementById(`tg-round-${i}`)?.scrollIntoView({ block: "nearest" }); }}
                          className={cn("cursor-pointer border-t border-border/60 outline-none", (selected === i) ? "bg-saffron/10" : "hover:bg-muted/30 focus:bg-muted/30")}
                        >
                          <td className="sticky left-0 z-10 bg-card px-2 py-1 font-medium">{per.label}</td>
                          <td className="sticky left-14 z-10 bg-card px-2 py-1 text-muted-foreground">{dates(per.start, per.end)}</td>
                          <td className="sticky left-[10.5rem] z-10 bg-card px-2 py-1 text-right tabular-nums">{per.n.toLocaleString("en-IN")}{per.partial ? <span className="ml-0.5 opacity-60">*</span> : null}</td>
                          {parties.map((party) => <td key={`p-${party}`} className={cn("px-2 py-1 text-right tabular-nums", metric === "share" ? "font-semibold text-foreground" : "text-muted-foreground")}>{per.n ? ((per.counts[party] / per.n) * 100).toFixed(2) : "—"}</td>)}
                          {parties.map((party) => <td key={`s-${party}`} className={cn("px-2 py-1 text-right tabular-nums", metric === "swing" ? "font-semibold text-foreground" : "text-muted-foreground")}>{per.n ? signed((per.counts[party] / per.n) * 100 - baselineShares[party] * 100, 1) : "—"}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Campaign funnel</h4>
                  <div className="mt-1.5 space-y-0.5 text-[10.5px]">
                    {["Impressions", "People reached", "Link clicks"].map((x) => <div key={x} className="flex justify-between gap-2"><span className="text-muted-foreground">{x}</span><span className="text-muted-foreground/70">Data unavailable</span></div>)}
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Completed survey responses</span><b className="tabular-nums">{data.eligible.toLocaleString("en-IN")}</b></div>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Platform</h4>
                  <p className="mt-1.5 text-[10.5px] text-muted-foreground">Instagram · Facebook · X</p>
                  <p className="text-[10.5px] text-muted-foreground/70">Data unavailable</p>
                </div>
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Age</h4>
                  <p className="mt-1.5 text-[10.5px] text-muted-foreground">Survey age groups</p>
                  <p className="text-[10.5px] text-muted-foreground/70">Data unavailable</p>
                </div>
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Religion</h4>
                  <p className="mt-1.5 text-[10.5px] text-muted-foreground">Explicit responses</p>
                  <p className="text-[10.5px] text-muted-foreground/70">Data unavailable</p>
                </div>
              </section>

              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-[15px] font-semibold">District projection</h3>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">Sort
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="rounded-md border border-border bg-background px-1.5 py-1 text-[10px] text-foreground">
                      <option value="name">Name</option><option value="leader">2028 leader</option><option value="margin">Margin</option>
                    </select>
                  </div>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">2028 model projection · weighted by 2023 votes.</p>
                <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-border">
                  <table className="w-full border-collapse text-[10.5px]">
                    <caption className="sr-only">District 2028 model projection</caption>
                    <thead className="sticky top-0 z-10 bg-card"><tr className="text-left text-[8.5px] uppercase tracking-wide text-muted-foreground"><th className="px-2 py-1.5">District</th><th className="px-2 py-1.5">2028 leader</th><th className="px-2 py-1.5 text-right">BRS</th><th className="px-2 py-1.5 text-right">Congress+</th><th className="px-2 py-1.5 text-right">BJP</th><th className="px-2 py-1.5 text-right">Others</th><th className="px-2 py-1.5 text-right">Margin</th></tr></thead>
                    <tbody>
                      {sortedDistricts.map((d) => (
                        <tr key={d.name} className={cn("cursor-pointer border-t border-border/60 hover:bg-muted/30", scope === `d:${d.name}` && "bg-saffron/10")} onClick={() => { setScope(`d:${d.name}`); onSelectDistrict(d.name); }}>
                          <td className="px-2 py-1 font-medium">{d.name}</td>
                          <td className="px-2 py-1"><span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: d.leader === "Tie" ? p.muted : P5_COLOR[(d.leader === "Congress" ? "Congress" : d.leader) as P5] ?? P5_COLOR.Others }} />{d.leader}</span></td>
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
                <p className="mt-1 text-[10px] text-muted-foreground">Age-group projection · Data unavailable</p>
              </section>

              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-[15px] font-semibold">Swing distribution</h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="inline-flex rounded-full border border-border p-0.5" role="group" aria-label="Distribution period">
                      {([["day", "Daily"], ["block", "Every 50 responses"]] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={distUnit === id} onClick={() => setDistUnit(id)} className={cn("rounded-full px-2.5 py-1 text-[10px]", distUnit === id ? "bg-foreground text-background" : "text-muted-foreground")}>{label}</button>)}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{metric === "share" ? "Vote share" : `Swing vs ${baseline}`} · {distPeriods.length} periods · {distResponses.toLocaleString("en-IN")} responses</span>
                  </div>
                </div>
                {showMedian && (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[9.5px] text-muted-foreground">
                    {parties.map((party) => {
                      const st = boxStats(distValues[party].map((x) => x.value));
                      if (!st) return null;
                      return <span key={party} className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: P5_COLOR[party] }} />{P5_LABEL[party]} median <b className="tabular-nums text-foreground/80">{st.median.toFixed(1)}{unit}</b></span>;
                    })}
                  </div>
                )}
                <EChart option={distOption} height={310} reduced={reduced} replaceSeries ariaLabel={`${metric === "share" ? "Vote share" : "Swing"} distribution by party for ${scopeName}`} />
                <p className="mt-0.5 text-[9px] text-muted-foreground">Box Q1–Q3 · line median · rings IQR outliers</p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
