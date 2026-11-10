"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  TN_COLOR, TN_GROUPS, TN_LABEL, TN_SEAT_GROUPS,
  type TnAggregates, type TnGroup, type TnSeatGroup, type TnShares, type TnYear,
} from "@/lib/tamil-nadu/model";
import type { TnEciActualView, TnExitPollView, TnForecaster, TnSocial } from "@/lib/tamil-nadu/view-data";
import type { OpinionPollView, TnTab, TnView } from "@/components/case-studies/tamil-nadu/tamil-nadu-rail";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import EChart from "@/components/case-studies/telangana/echart";
import { LiveCampaigns } from "@/components/meta/live-campaigns";
import AnalysisShell from "@/components/case-studies/shared/analysis-shell";
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
const signedPp = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : `${Math.abs(v) < 0.05 ? "" : v > 0 ? "+" : ""}${Math.abs(v) < 0.05 ? "0.0" : v.toFixed(1)}pp`);
const rawValue = (d: unknown): unknown => (d && typeof d === "object" && "value" in d ? (d as { value: unknown }).value : d);
const numericValue = (d: unknown): number | null => { const v = rawValue(d); if (typeof v === "number") return v; if (Array.isArray(v) && typeof v[1] === "number") return v[1]; return null; };
const emptySeats = () => Object.fromEntries(TN_SEAT_GROUPS.map((g) => [g, 0])) as Record<TnSeatGroup, number>;
const sumShares = (shares: TnShares | null | undefined, groups: TnGroup[]) => {
  const values = groups.map((group) => shares?.[group]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
};
const seatTotal = (record: Record<TnSeatGroup, number> | null | undefined) => {
  const values = TN_SEAT_GROUPS
    .map((group) => (record as Partial<Record<TnSeatGroup, number>> | null | undefined)?.[group])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
};

type AnalysisGroup = { key: string; label: string; color: string; groups: TnGroup[] };

const ANALYSIS_GROUPS: AnalysisGroup[] = [
  { key: "TVK", label: TN_LABEL.TVK, color: TN_COLOR.TVK, groups: ["TVK"] },
  { key: "AIADMK", label: TN_LABEL["AIADMK+BJP+PMK+AMMK"], color: TN_COLOR["AIADMK+BJP+PMK+AMMK"], groups: ["AIADMK+BJP+PMK+AMMK"] },
  { key: "DMK", label: TN_LABEL["DMK+INC+VCK"], color: TN_COLOR["DMK+INC+VCK"], groups: ["DMK+INC+VCK"] },
  { key: "NTK", label: TN_LABEL.NTK, color: TN_COLOR.NTK, groups: ["NTK"] },
  { key: "others-nota", label: "Others & NOTA", color: "#64748B", groups: ["NOTA", "Others"] },
];
const ALL_GROUP_KEYS = ANALYSIS_GROUPS.map((group) => group.key);
const groupByKey = (key: string) => ANALYSIS_GROUPS.find((group) => group.key === key) ?? ANALYSIS_GROUPS[0];
const groupSum = (shares: TnShares | null | undefined, group: AnalysisGroup) => sumShares(shares, group.groups);

/* Series colours stay close to the party colours, but the overview needs
   to distinguish poll source as well as party. Opacity carries the series. */
const SERIES_OPACITY = { exit: 0.42, opinion: 0.72, actual: 1, survey: 0.58, baseline: 0.34 };

export default function TamilNaduAnalysis({
  open, onClose, data, theme, initialScope, defaultBaseline, opinionPoll, exitPoll, eciActual, social, forecasters, forecastActualSeats, initialView, initialTab, owner = false,
}: {
  open: boolean;
  onClose: () => void;
  data: TnAggregates;
  theme: "light" | "dark";
  initialScope: string;
  defaultBaseline: TnYear;
  onSelectDistrict?: (name: string) => void;
  onSelectAc?: (no: number) => void;
  opinionPoll: OpinionPollView;
  exitPoll: TnExitPollView;
  eciActual: TnEciActualView;
  social: TnSocial;
  forecasters: TnForecaster[];
  forecastActualSeats: number;
  initialView: TnView;
  initialTab: TnTab;
  owner?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const p = palette(theme);
  const [narrow, setNarrow] = useState(false);
  const [scope, setScope] = useState(initialScope);
  const [view, setView] = useState<TnView>(initialView);
  const [chartMode, setChartMode] = useState<TnTab>(initialTab);
  const [visibleSeries, setVisibleSeries] = useState<string[]>(initialScope.startsWith("a:") || initialScope.startsWith("d:") ? ["survey", "baseline"] : opinionPoll.available ? ["exit", "opinion", "actual"] : ["exit", "actual"]);
  const [baselineYear, setBaselineYear] = useState<TnYear>(defaultBaseline);
  const [parties, setParties] = useState<string[]>([...ALL_GROUP_KEYS]);
  const [showMedian, setShowMedian] = useState(true);
  const [highlightOutliers, setHighlightOutliers] = useState(true);
  const [distUnit, setDistUnit] = useState<"district" | "assembly">("district");
  const [sortBy, setSortBy] = useState<"name" | "leader" | "responses">("name");

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    setScope(initialScope);
    setView(initialView);
    setChartMode(initialTab);
    setBaselineYear(defaultBaseline);
  }, [open, initialScope, initialView, initialTab, defaultBaseline]);

  const scopeRecord = useMemo(() => {
    if (scope.startsWith("a:")) return data.acs.find((a) => a.no === Number(scope.slice(2))) ?? data.acs[0];
    if (scope.startsWith("d:")) return data.districts.find((d) => d.name === scope.slice(2)) ?? data.districts[0];
    return data.statewide;
  }, [data, scope]);
  const scopeName = scope.startsWith("a:")
    ? data.acs.find((a) => a.no === Number(scope.slice(2)))?.name ?? "Assembly"
    : scope.startsWith("d:") ? scope.slice(2) : "Tamil Nadu";
  const scopeIsState = !scope.startsWith("a:") && !scope.startsWith("d:");

  const currentShares = scopeIsState ? opinionPoll.shares ?? {} : scopeRecord.survey.shares ?? {};
  const baseline = scopeRecord.historical[baselineYear] ?? null;
  const baselineShares = baseline?.shares ?? null;
  const baselineAvailable = !!baseline?.available;

  useEffect(() => {
    setVisibleSeries(scopeIsState ? (opinionPoll.available ? ["exit", "opinion", "actual"] : ["exit", "actual"]) : ["survey", "baseline"]);
  }, [scopeIsState, opinionPoll.available]);

  const scopeSeriesKeys = scopeIsState ? (opinionPoll.available ? ["exit", "opinion", "actual"] : ["exit", "actual"]) : ["survey", "baseline"];
  const toggleSeries = (key: string) => setVisibleSeries((previous) => previous.includes(key) ? (previous.length > 1 ? previous.filter((item) => item !== key) : previous) : [...previous, key]);
  const selectChartMode = (mode: TnTab) => {
    setChartMode(mode);
    if (mode === "change") {
      const changeKeys = scopeIsState ? (opinionPoll.available ? ["exit", "opinion"] : ["exit"]) : ["survey"];
      if (!changeKeys.some((key) => visibleSeries.includes(key))) setVisibleSeries((previous) => [...previous, changeKeys[0]]);
    }
  };

  const opinionSeats = useMemo(() => {
    if (scope.startsWith("a:")) return emptySeats();
    if (scope.startsWith("d:")) return data.districts.find((d) => d.name === scope.slice(2))?.originalSeats ?? emptySeats();
    return opinionPoll.seats ?? data.statewide.originalSeats ?? emptySeats();
  }, [data, scope, opinionPoll.seats]);
  const opinionCall = useMemo(() => {
    if (!scope.startsWith("a:")) return null;
    const ac = data.acs.find((a) => a.no === Number(scope.slice(2)));
    return ac?.original?.leader ?? ac?.surveyLeader ?? null;
  }, [data, scope]);
  const actualSeats = useMemo(() => {
    if (scope.startsWith("a:")) { const ac = data.acs.find((a) => a.no === Number(scope.slice(2))); return { ...emptySeats(), ...(ac?.actual2026.winner ? { [ac.actual2026.winner]: 1 } : {}) }; }
    if (scope.startsWith("d:")) return data.districts.find((d) => d.name === scope.slice(2))?.actualSeats ?? emptySeats();
    return data.statewide.actualSeats;
  }, [data, scope]);

  /* ------------------------------ overview ------------------------------ */
  const allOverviewSeries = useMemo(() => {
    const actualShares = eciActual.shares;
    if (scopeIsState) {
      return [
        { key: "exit", label: "Exit Poll", shares: exitPoll.shares, opacity: SERIES_OPACITY.exit },
        ...(opinionPoll.available ? [{ key: "opinion", label: "Opinion Poll", shares: opinionPoll.shares, opacity: SERIES_OPACITY.opinion }] : []),
        { key: "actual", label: "Actual Result", shares: actualShares, opacity: SERIES_OPACITY.actual },
      ];
    }
    return [
      { key: "survey", label: "Survey Estimate", shares: currentShares, opacity: SERIES_OPACITY.survey },
      { key: "baseline", label: `${baselineYear} Result`, shares: baselineAvailable ? baselineShares : null, opacity: SERIES_OPACITY.baseline },
    ];
  }, [scopeIsState, opinionPoll.available, opinionPoll.shares, currentShares, baselineYear, baselineAvailable, baselineShares]);

  const overviewSeries = useMemo(
    () => allOverviewSeries.filter((series) => visibleSeries.includes(series.key)),
    [allOverviewSeries, visibleSeries],
  );

  const shareChartOption = useMemo(() => {
    const values = overviewSeries.flatMap((series) => ANALYSIS_GROUPS.map((group) => (groupSum(series.shares, group) ?? 0) * 100));
    const max = Math.max(10, Math.ceil((Math.max(10, ...values) + 5) / 10) * 10);
    return {
      animation: !reduced, animationDuration: 520, animationEasing: "cubicOut",
      grid: { left: 92, right: 34, top: 12, bottom: 24 },
      tooltip: {
        ...tooltipStyle(p), trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const index = Array.isArray(params) ? (params[0] as { dataIndex: number } | undefined)?.dataIndex ?? 0 : 0;
          const group = ANALYSIS_GROUPS[index];
          if (!group) return "";
          const rows = overviewSeries.map((series) => {
            const value = groupSum(series.shares, group);
            return `<div style="display:flex;justify-content:space-between;gap:18px"><span>${series.label}</span><b>${value == null ? "—" : `${(value * 100).toFixed(1)}%`}</b></div>`;
          }).join("");
          return `<div style="font-weight:600;margin-bottom:3px">${group.label}</div>${rows}`;
        },
      },
      xAxis: { type: "value", max, axisLabel: { color: p.muted, fontSize: 9, formatter: "{value}%" }, splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: { type: "category", data: ANALYSIS_GROUPS.map((group) => group.label), inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.text, fontSize: 10 } },
      series: overviewSeries.map((series) => ({
        name: series.label, type: "bar", barMaxWidth: 12, barGap: "12%", barCategoryGap: "32%",
        itemStyle: { borderRadius: 2 },
        data: ANALYSIS_GROUPS.map((group) => {
          const value = groupSum(series.shares, group);
          return {
            value: value == null ? null : +(value * 100).toFixed(2),
            itemStyle: { color: group.color, opacity: value == null ? 0 : series.opacity },
            label: { show: !narrow && value != null, position: "right", color: p.text, fontSize: 8, formatter: value == null ? "—" : `${(value * 100).toFixed(1)}` },
          };
        }),
        labelLayout: { hideOverlap: true },
      })),
    };
  }, [overviewSeries, p, reduced, narrow]);

  const changeChartOption = useMemo(() => {
    const series = (scopeIsState
      ? [
          { key: "exit", label: "Exit Poll − Actual", opacity: SERIES_OPACITY.exit, value: (group: AnalysisGroup) => {
              const exit = groupSum(exitPoll.shares, group);
              const actual = groupSum(eciActual.shares, group);
              return exit == null || actual == null ? null : (exit - actual) * 100;
            } },
          ...(opinionPoll.available ? [{ key: "opinion", label: "Opinion Poll − Actual", opacity: SERIES_OPACITY.opinion, value: (group: AnalysisGroup) => {
              const opinion = groupSum(opinionPoll.shares, group);
              const actual = groupSum(eciActual.shares, group);
              return opinion == null || actual == null ? null : (opinion - actual) * 100;
            } }] : []),
        ]
      : [
          { key: "survey", label: `Survey − ${baselineYear}`, opacity: SERIES_OPACITY.survey, value: (group: AnalysisGroup) => {
              if (!baselineAvailable) return null;
              const present = group.groups.some((key) => data.presence[baselineYear][key]);
              if (!present) return null;
              const current = groupSum(currentShares, group);
              const base = groupSum(baselineShares, group);
              return current == null || base == null ? null : (current - base) * 100;
            } },
        ]).filter((item) => visibleSeries.includes(item.key));
    const values = series.flatMap((item) => ANALYSIS_GROUPS.map((group) => item.value(group))).filter((value): value is number => value != null);
    const magnitude = Math.max(0.5, ...values.map((value) => Math.abs(value)));
    const step = Math.max(1, Math.ceil((magnitude * 1.15) / 2));
    const limit = step * 2;
    return {
      animation: !reduced, animationDuration: 520, animationEasing: "cubicOut",
      grid: { left: 92, right: 34, top: 12, bottom: 24 },
      tooltip: {
        ...tooltipStyle(p), trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const index = Array.isArray(params) ? (params[0] as { dataIndex: number } | undefined)?.dataIndex ?? 0 : 0;
          const group = ANALYSIS_GROUPS[index];
          if (!group) return "";
          const rows = series.map((item) => `<div style="display:flex;justify-content:space-between;gap:18px"><span>${item.label}</span><b>${signedPp(item.value(group))}</b></div>`).join("");
          return `<div style="font-weight:600;margin-bottom:3px">${group.label}</div>${rows}`;
        },
      },
      xAxis: {
        type: "value", min: -limit, max: limit, interval: step,
        axisLabel: { color: p.muted, fontSize: 9, formatter: (value: number) => `${value > 0 ? "+" : ""}${value}` },
        splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false },
      },
      yAxis: { type: "category", data: ANALYSIS_GROUPS.map((group) => group.label), inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.text, fontSize: 10 } },
      series: series.map((item) => ({
        name: item.label, type: "bar", barMaxWidth: 12, barGap: "12%", barCategoryGap: "32%",
        data: ANALYSIS_GROUPS.map((group) => {
          const value = item.value(group);
          return {
            value: value == null ? null : +value.toFixed(2),
            itemStyle: { color: group.color, borderRadius: 2, opacity: value == null ? 0 : item.opacity },
            label: value == null ? { show: false } : {
              show: !narrow, position: value >= 0 ? "right" : "left", color: p.text, fontSize: 8.5, fontWeight: 600,
              formatter: `${Math.abs(value) < 0.05 ? "" : value > 0 ? "+" : ""}${Math.abs(value) < 0.05 ? "0.0" : value.toFixed(1)}`,
            },
          };
        }),
        labelLayout: { hideOverlap: true },
        markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: p.axis, width: 1 }, data: [{ xAxis: 0 }] },
      })),
    };
  }, [scopeIsState, opinionPoll.available, opinionPoll.shares, data.presence, baselineYear, baselineAvailable, currentShares, baselineShares, p, reduced, narrow, visibleSeries, eciActual, exitPoll]);

  const allChangeLegend = scopeIsState
    ? [
        { key: "exit", label: "Exit Poll − Actual", opacity: SERIES_OPACITY.exit },
        ...(opinionPoll.available ? [{ key: "opinion", label: "Opinion Poll − Actual", opacity: SERIES_OPACITY.opinion }] : []),
      ]
    : [{ key: "survey", label: `Survey − ${baselineYear}`, opacity: SERIES_OPACITY.survey }];
  const changeLegend = allChangeLegend.filter((item) => visibleSeries.includes(item.key));

  const seatChartOption = useMemo(() => {
    return {
      animation: !reduced, animationDuration: 520, animationEasing: "cubicOut",
      grid: { left: 92, right: 34, top: 12, bottom: 24 },
      tooltip: { ...tooltipStyle(p), trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: { type: "value", minInterval: 1, name: "seats", nameTextStyle: { color: p.muted, fontSize: 8.5 }, axisLabel: { color: p.muted, fontSize: 9, formatter: (value: number) => `${value}` }, splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: { type: "category", data: TN_SEAT_GROUPS.map((group) => TN_LABEL[group]), inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.text, fontSize: 10 } },
      series: [
        { name: "Opinion poll", type: "bar", barMaxWidth: 12, barGap: "12%", barCategoryGap: "32%", data: TN_SEAT_GROUPS.map((group) => {
          const value = (opinionSeats as Partial<Record<TnSeatGroup, number>>)[group];
          return { value: value ?? null, itemStyle: { color: TN_COLOR[group], opacity: value == null ? 0 : 0.55, borderRadius: 2 }, label: { show: value != null, position: "right", color: p.text, fontSize: 8.5, formatter: value == null ? "—" : `${value}` } };
        }) },
        { name: "Actual 2026", type: "bar", barMaxWidth: 12, data: TN_SEAT_GROUPS.map((group) => {
          const value = (actualSeats as Partial<Record<TnSeatGroup, number>>)[group];
          return { value: value ?? null, itemStyle: { color: TN_COLOR[group], opacity: value == null ? 0 : 1, borderRadius: 2 }, label: { show: value != null, position: "right", color: p.text, fontSize: 8.5, fontWeight: 600, formatter: value == null ? "—" : `${value}` } };
        }) },
      ],
    };
  }, [actualSeats, opinionSeats, p, reduced, eciActual]);

  /* ---------------------------- forecaster ----------------------------- */
  const forecasterChartOption = useMemo(() => {
    const max = Math.max(120, ...forecasters.map((row) => (row.projectedSeats ?? 0) + 12));
    return {
      animation: !reduced, animationDuration: 520, animationEasing: "cubicOut",
      grid: { left: narrow ? 116 : 152, right: 44, top: 22, bottom: 26 },
      tooltip: {
        ...tooltipStyle(p), trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const index = Array.isArray(params) ? (params[0] as { dataIndex: number } | undefined)?.dataIndex ?? 0 : 0;
          const row = forecasters[index];
          if (!row) return "";
          return `<div style="font-weight:600;margin-bottom:2px">${row.forecaster}</div>Projected <b>${row.projectedSeats ?? "—"}</b> seats<br/>Seats off <b>${row.differenceFromActual == null ? "—" : Math.abs(row.differenceFromActual)}</b><br/>${row.winnerCall}`;
        },
      },
      xAxis: { type: "value", max, axisLabel: { color: p.muted, fontSize: 9 }, splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: { type: "category", data: forecasters.map((row) => row.forecaster), inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.text, fontSize: narrow ? 7.5 : 8.5, width: narrow ? 104 : 140, overflow: "truncate" } },
      series: [{
        type: "bar", barMaxWidth: 10,
        data: forecasters.map((row) => ({
          value: row.projectedSeats,
          itemStyle: { color: TN_COLOR.TVK, opacity: row.projectedSeats == null ? 0 : 0.82, borderRadius: 2 },
          label: { show: row.projectedSeats != null, position: "right", color: p.text, fontSize: 8.5, formatter: `${row.projectedSeats ?? ""}` },
        })),
        markLine: {
          silent: true, symbol: "none",
          lineStyle: { color: p.text, type: "dashed", width: 1, opacity: 0.7 },
          label: { show: true, position: "end", color: p.text, fontSize: 8.5, formatter: `Actual ${forecastActualSeats}` },
          data: [{ xAxis: forecastActualSeats }],
        },
      }],
    };
  }, [p, reduced, narrow, forecasters, forecastActualSeats]);

  /* ---------------------------- historical ----------------------------- */
  const historicalOption = useMemo(() => {
    const selected = parties.map(groupByKey);
    const cats = selected.map((group) => group.label);
    const baseData = selected.map((group) => {
      const present = group.groups.some((key) => data.presence[baselineYear][key]);
      const value = baselineAvailable && present ? groupSum(baselineShares, group) : null;
      return value == null ? null : { value: +(value * 100).toFixed(2), itemStyle: { color: group.color, opacity: 0.3 } };
    });
    const currentData = selected.map((group) => {
      const value = groupSum(currentShares, group);
      return value == null ? null : { value: +(value * 100).toFixed(2), itemStyle: { color: group.color } };
    });
    return {
      animationDuration: reduced ? 0 : 480,
      grid: { left: 44, right: 14, top: 36, bottom: 44 },
      legend: { top: 0, left: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: p.muted, fontSize: 10 }, data: [`${baselineYear} result`, "2026 estimate"] },
      tooltip: { ...tooltipStyle(p), trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (value: unknown) => (typeof value === "number" ? `${value.toFixed(2)}%` : "—") },
      xAxis: { type: "category", data: cats, axisLabel: { color: p.muted, fontSize: 9.5, interval: 0, rotate: cats.length > 3 ? 18 : 0 }, axisLine: { lineStyle: { color: p.axis } }, axisTick: { show: false } },
      yAxis: { type: "value", max: 60, axisLabel: { color: p.muted, fontSize: 9, formatter: "{value}%" }, splitLine: { lineStyle: { color: p.grid } } },
      series: [
        { id: "baseline", name: `${baselineYear} result`, type: "bar", data: baseData, barMaxWidth: 22, itemStyle: { borderRadius: [3, 3, 0, 0] }, emphasis: { focus: "series" } },
        { id: "current", name: "2026 estimate", type: "bar", data: currentData, barMaxWidth: 22, itemStyle: { borderRadius: [3, 3, 0, 0] }, emphasis: { focus: "series" } },
      ],
    };
  }, [parties, data.presence, baselineYear, baselineAvailable, baselineShares, currentShares, p, reduced]);

  const distribution = useMemo(() => {
    const units = distUnit === "district"
      ? data.districts.map((district) => ({ name: district.name, shares: district.survey.shares }))
      : data.acs.map((ac) => ({ name: `${ac.no}. ${ac.name}`, shares: ac.survey.shares }));
    const rows = parties.map((key) => {
      const group = groupByKey(key);
      const values = units.map((unit) => groupSum(unit.shares, group)).filter((value): value is number => value != null && Number.isFinite(value)).map((value) => value * 100);
      return { group, values, stats: boxStats(values) };
    });
    const boxes = rows.map((row) => (row.stats ? [row.stats.whiskerLow, row.stats.q1, row.stats.median, row.stats.q3, row.stats.whiskerHigh] : null));
    const medians = rows.map((row) => row.stats?.median ?? null);
    const outliers = rows.flatMap((row, index) => (row.stats ? row.stats.outliers.map((value) => [index, value]) : []));
    return { units, rows, boxes, medians, outliers };
  }, [data, distUnit, parties]);

  const distributionOption = useMemo(() => ({
    animationDuration: reduced ? 0 : 480,
    grid: { left: 44, right: 16, top: 20, bottom: 8, containLabel: true },
    tooltip: {
      ...tooltipStyle(p), trigger: "item",
      formatter: (params: unknown) => {
        const query = params as { seriesName?: string; data?: unknown; name?: string };
        const value = rawValue(query.data);
        if (Array.isArray(value) && value.length === 5 && query.seriesName === "Distribution") {
          const [lo, q1, med, q3, hi] = (value as number[]).map((item) => item.toFixed(1));
          return `<b>${query.name}</b><br/>whiskers ${lo}–${hi}%<br/>Q1 ${q1}% · median ${med}% · Q3 ${q3}%`;
        }
        if (Array.isArray(value) && value.length === 2 && query.seriesName === "Outliers") return `${query.name}<br/>outlier ${Number(value[1]).toFixed(1)}%`;
        if (query.seriesName === "Median") { const current = numericValue(query.data); return `${query.name}<br/>median ${current == null ? "—" : current.toFixed(1)}%`; }
        return "";
      },
    },
    xAxis: { type: "category", data: parties.map((key) => groupByKey(key).label), axisLabel: { show: true, color: p.muted, fontSize: 9, interval: 0, rotate: 0, margin: 10, formatter: (value: string) => (value.includes("+") ? `${value.split("+")[0]}+` : value) }, axisLine: { lineStyle: { color: p.axis } }, axisTick: { show: false } },
    yAxis: { type: "value", name: "share", nameTextStyle: { color: p.muted, fontSize: 9 }, axisLabel: { color: p.muted, fontSize: 9, formatter: "{value}%" }, splitLine: { lineStyle: { color: p.grid } } },
    series: [
      {
        id: "distribution", name: "Distribution", type: "boxplot",
        data: distribution.boxes.map((box, index) => (box ? { value: box, itemStyle: { color: `${distribution.rows[index].group.color}22`, borderColor: distribution.rows[index].group.color, borderWidth: 1.4 } } : null)),
        itemStyle: { borderWidth: 1.2, color: "transparent" },
        emphasis: { itemStyle: { borderWidth: 2 } },
      },
      ...(showMedian ? [{
        id: "median", name: "Median", type: "line", data: distribution.medians.map((value, index) => ({ value, itemStyle: { color: distribution.rows[index].group.color } })), symbol: "diamond", symbolSize: 6,
        lineStyle: { opacity: 0 },
        label: { show: true, position: "top", color: p.text, fontSize: 9, formatter: (value: { value?: unknown }) => { const n = numericValue(value.value); return n == null ? "" : n.toFixed(1); } },
      }] : []),
      ...(highlightOutliers ? [{
        id: "outliers", name: "Outliers", type: "scatter", data: distribution.outliers.map(([index, value]) => ({ value: [index, value], itemStyle: { borderColor: distribution.rows[index].group.color } })), symbolSize: 5,
        itemStyle: { color: "transparent", borderWidth: 1 },
        emphasis: { itemStyle: { color: p.text } },
      }] : []),
    ],
  }), [distribution, highlightOutliers, p, parties, reduced, showMedian]);

  const districtsSorted = useMemo(() => {
    const rows = [...data.districts];
    if (sortBy === "leader") rows.sort((a, b) => (TN_GROUPS.indexOf(b.surveyLeader ?? "TVK") - TN_GROUPS.indexOf(a.surveyLeader ?? "TVK")) || a.name.localeCompare(b.name));
    else if (sortBy === "responses") rows.sort((a, b) => b.survey.valid - a.survey.valid);
    else rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [data.districts, sortBy]);

  const districtStats = useMemo(() => (
    parties.map((key) => {
      const group = groupByKey(key);
      const values = data.districts
        .map((district) => groupSum(district.survey.shares, group))
        .filter((value): value is number => value != null && Number.isFinite(value))
        .map((value) => value * 100);
      return { key, group, values, stats: boxStats(values) };
    })
  ), [data.districts, parties]);

  const districtChartOption = useMemo(() => {
    const districts = data.districts;
    const lines = districtStats.map(({ key, group, stats }) => ({
      id: `d-${key}`,
      name: group.label,
      type: "line",
      symbol: "circle",
      symbolSize: 4.5,
      showSymbol: true,
      connectNulls: false,
      lineStyle: { color: group.color, width: 1.8 },
      itemStyle: { color: group.color },
      emphasis: { focus: "series" },
      data: districts.map((district) => {
        const value = groupSum(district.survey.shares, group);
        return value == null ? null : +(value * 100).toFixed(2);
      }),
      ...(showMedian && stats?.median != null ? {
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: group.color, type: "dashed", width: 1.05, opacity: 0.75 },
          label: { show: false },
          data: [{ yAxis: +stats.median.toFixed(2) }],
        },
      } : {}),
    }));

    const outlierSeries = highlightOutliers
      ? districtStats.flatMap(({ key, group, stats }) => {
          if (!stats) return [];
          const points = districts.flatMap((district, index) => {
            const value = groupSum(district.survey.shares, group);
            if (value == null) return [];
            const pctValue = value * 100;
            if (!(pctValue < stats.lower || pctValue > stats.upper)) return [];
            return [{
              value: [index, +pctValue.toFixed(2)],
              name: district.name,
              party: group.label,
              colour: group.color,
              deviation: pctValue - stats.median,
            }];
          });
          if (!points.length) return [];
          return [{
            id: `d-outlier-${key}`,
            name: `${group.label} outliers`,
            type: reduced ? "scatter" : "effectScatter",
            data: points,
            symbolSize: 12,
            itemStyle: { color: "transparent", borderColor: group.color, borderWidth: 1.8 },
            rippleEffect: reduced ? undefined : { scale: 2, brushType: "stroke" },
            label: {
              show: true,
              position: "top",
              color: group.color,
              fontSize: 8,
              fontWeight: 600,
              formatter: (params: unknown) => {
                const data = (params as { data?: { value?: [number, number] } }).data;
                return data?.value ? `${data.value[1].toFixed(1)}` : "";
              },
            },
            labelLayout: { hideOverlap: true },
            tooltip: {
              formatter: (params: unknown) => {
                const data = (params as { data?: { name?: string; party?: string; value?: [number, number]; deviation?: number } }).data;
                if (!data?.value) return "";
                return `<b>${data.name}</b><br/>${data.party} <b>${data.value[1].toFixed(1)}%</b><br/>Deviation from median <b>${data.deviation != null ? `${data.deviation > 0 ? "+" : ""}${data.deviation.toFixed(1)}` : "—"} pp</b>`;
              },
            },
            z: 12,
          }];
        })
      : [];

    return {
      animationDuration: reduced ? 0 : 480,
      grid: { left: 42, right: 18, top: 34, bottom: 58 },
      dataZoom: [{ type: "inside", xAxisIndex: 0, start: 0, end: 100, filterMode: "none" }],
      legend: { top: 0, left: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: p.muted, fontSize: 9 }, data: districtStats.map((row) => row.group.label) },
      tooltip: {
        ...tooltipStyle(p),
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: p.axis, type: "dashed" } },
        valueFormatter: (value: unknown) => (typeof value === "number" ? `${value.toFixed(1)}%` : "—"),
      },
      xAxis: {
        type: "category",
        data: districts.map((district) => district.name),
        axisLabel: { show: true, color: p.muted, fontSize: 8, interval: "auto", hideOverlap: true, rotate: 38 },
        axisLine: { lineStyle: { color: p.axis } },
        axisTick: { show: false },
      },
      yAxis: { type: "value", axisLabel: { color: p.muted, fontSize: 8, formatter: "{value}%" }, splitLine: { lineStyle: { color: p.grid } } },
      series: [...lines, ...outlierSeries],
    };
  }, [data.districts, districtStats, highlightOutliers, p, reduced, showMedian]);

  const totalOpinion = seatTotal(opinionSeats);
  const totalActual = seatTotal(actualSeats);

  const resetControls = () => {
    setParties([...ALL_GROUP_KEYS]);
    setBaselineYear(defaultBaseline);
    setShowMedian(true);
    setHighlightOutliers(true);
    setDistUnit("district");
    setSortBy("name");
  };

  if (!open) return null;

  const modeTabs: { id: TnTab; label: string }[] = [
    { id: "share", label: "Share" }, { id: "change", label: "Change" }, { id: "seats", label: "Seats" },
  ];

  const headerTabs = (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--a-border)] bg-[var(--a-panel-2)] p-0.5" role="tablist" aria-label="Analysis content">
      {(["polls", "social"] as const).map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={view === id}
          onClick={() => setView(id)}
          className={cn(
            "min-h-10 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-brass)]/40 sm:min-h-7",
            view === id ? "bg-[var(--a-ink)] text-[var(--a-canvas)] shadow-sm" : "text-[var(--a-muted)] hover:text-[var(--a-ink)]",
          )}
        >
          {id === "polls" ? "Polls" : "Social Media"}
        </button>
      ))}
    </div>
  );

  return (
    <AnalysisShell
      open={open}
      onClose={onClose}
      eyebrow="2026 analysis"
      title={`${scopeName} · Vote share`}
      subtitle={scopeIsState
        ? `Statewide · Exit poll${opinionPoll.available ? ", opinion poll" : ""} and actual result`
        : `${scope.startsWith("a:") ? "Assembly" : "District"} · Survey estimate, ${baselineYear} result and actual availability`}
      headerTabs={headerTabs}
      contentClassName="space-y-5"
    >
      {view === "social" ? (
<div className="space-y-3"><SocialOverview social={social} /><section className="analysis-panel rounded-2xl p-4 sm:p-5" aria-label="Live campaigns"><LiveCampaigns slug="tamil-nadu" owner={owner} /></section></div>
      ) : (
        <>
          {/* ------------------------- polls overview ------------------------- */}
          <section className="analysis-panel rounded-2xl p-4 sm:p-5" aria-label="Polls overview">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--a-brass)]">Polls overview</p>
                <h3 className="mt-0.5 font-display text-[18px] font-semibold leading-tight text-[var(--a-ink)]">
                  {scopeIsState ? (opinionPoll.available ? "Exit, opinion and actual vote share" : "Exit poll and actual vote share") : `Survey, ${baselineYear} result and actual availability`}
                </h3>
                <p className="mt-0.5 text-[10.5px] text-[var(--a-muted)]">{scopeName} · {scopeIsState ? "Statewide" : scope.startsWith("a:") ? "Assembly" : "District"}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_300px]">
              <aside className="analysis-soft h-fit rounded-xl p-3" aria-label="Polls chart controls">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--a-muted)]">Chart mode</span>
                <div className="mt-1 grid gap-1">
                  {modeTabs.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      aria-pressed={chartMode === mode.id}
                      onClick={() => selectChartMode(mode.id)}
                      className={cn(
                        "rounded-lg border px-2 py-1.5 text-left text-[10px] font-semibold transition-colors",
                        chartMode === mode.id ? "border-[var(--a-brass)]/50 bg-[var(--a-brass-soft)] text-[var(--a-ink)]" : "border-[var(--a-border)] text-[var(--a-muted)] hover:text-[var(--a-ink)]",
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                <span className="mt-3 block text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--a-muted)]">Series</span>
                <div className="mt-1 grid gap-1">
                  {chartMode === "seats" ? (
                    [{ label: "Estimated", opacity: 0.55 }, { label: "Actual 2026", opacity: 1 }].map((item) => (
                      <div key={item.label} className="flex items-center gap-1.5 rounded-lg border border-[var(--a-border)] px-2 py-1.5 text-[10px] font-medium text-[var(--a-ink)]">
                        <span className="h-2 w-4 rounded-sm" style={{ background: "linear-gradient(90deg, #EAB308, #16A34A, #DC2626, #7C3AED, #64748B)", opacity: item.opacity }} />
                        {item.label}
                      </div>
                    ))
                  ) : (
                    (chartMode === "share" ? allOverviewSeries : allChangeLegend).map((series) => {
                      const active = visibleSeries.includes(series.key);
                      return (
                        <button
                          key={series.key}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleSeries(series.key)}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition-opacity",
                            active ? "border-[var(--a-border)] text-[var(--a-ink)]" : "border-[var(--a-border)]/60 text-[var(--a-muted)] opacity-50",
                          )}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-4 rounded-sm" style={{ background: "linear-gradient(90deg, #EAB308, #16A34A, #DC2626, #7C3AED, #64748B)", opacity: series.opacity }} />
                            {series.label}
                          </span>
                          <span className="text-[8px] uppercase tracking-wide">{active ? "On" : "Off"}</span>
                        </button>
                      );
                    })
                  )}
                </div>

                {chartMode !== "seats" && (
                  <button
                    type="button"
                    onClick={() => setVisibleSeries(scopeSeriesKeys)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-[var(--a-border)] px-2 py-1.5 text-[10px] font-semibold text-[var(--a-muted)] hover:text-[var(--a-ink)]"
                  >
                    <RotateCcw className="size-3" /> Show all series
                  </button>
                )}
              </aside>

              <div className="min-w-0 rounded-xl border border-[var(--a-border)] bg-[var(--a-panel-2)] p-2">
                <p className="mb-1 px-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--a-muted)]">
                  {chartMode === "share" ? "Vote share" : chartMode === "change" ? "Signed change (percentage points)" : "Seat counts"}
                </p>
                <div key={chartMode} className="analysis-chart-enter">
                  {chartMode === "share" && (
                    <>
                      <SeriesLegend items={overviewSeries.map((series) => ({ label: series.label, opacity: series.opacity }))} />
                      <EChart option={shareChartOption} height={340} reduced={reduced} ariaLabel={`Grouped vote share for ${scopeName}`} />
                    </>
                  )}
                  {chartMode === "change" && (
                    <>
                      <SeriesLegend items={changeLegend} />
                      <EChart option={changeChartOption} height={340} reduced={reduced} ariaLabel={`Signed change for ${scopeName}`} />
                    </>
                  )}
                  {chartMode === "seats" && (
                    <>
                      <SeriesLegend items={[{ label: "Opinion poll", opacity: 0.55 }, { label: "Actual 2026", opacity: 1 }]} />
                      <EChart option={seatChartOption} height={340} reduced={reduced} ariaLabel={`Opinion poll and actual seats for ${scopeName}`} />
                    </>
                  )}
                </div>
              </div>

              <div className="min-w-0 overflow-x-auto rounded-xl border border-[var(--a-border)] lg:col-span-2 xl:col-span-1">
                <table className="w-full min-w-[280px] border-collapse text-[9px]">
                  <caption className="sr-only">{scopeName} vote-share comparison</caption>
                  <thead>
                    <tr className="border-b border-[var(--a-border)] text-left text-[7.5px] uppercase tracking-wide text-[var(--a-muted)]">
                      <th scope="col" className="px-2 py-2 text-left font-semibold">Party</th>
                      {scopeIsState ? (
                        <>
                          <th scope="col" className="px-1.5 py-2 text-right font-semibold">Exit Poll</th>
                          <th scope="col" title={opinionPoll.available ? undefined : "No opinion-poll dataset is available"} className="px-1.5 py-2 text-right font-semibold">Opinion Poll</th>
                          <th scope="col" className="border-l border-[var(--a-border)] px-1.5 py-2 text-right font-semibold">Actual Result</th>
                        </>
                      ) : (
                        <>
                          <th scope="col" className="px-1.5 py-2 text-right font-semibold">Survey Estimate</th>
                          <th scope="col" className="px-1.5 py-2 text-right font-semibold">{baselineYear} Result</th>
                          <th scope="col" title="Opinion Poll is statewide only" className="px-1.5 py-2 text-right font-semibold">Opinion Poll</th>
                          <th scope="col" className="border-l border-[var(--a-border)] px-1.5 py-2 text-right font-semibold">Actual Result</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {ANALYSIS_GROUPS.map((group) => (
                      <tr key={group.key} className="border-t border-[var(--a-border)]/70">
                        <th scope="row" className="px-2 py-1.5 text-left font-medium">
                          <span className="flex items-center gap-1.5"><span className="size-1.5 shrink-0 rounded-sm" style={{ background: group.color }} />{group.label}</span>
                        </th>
                        {scopeIsState ? (
                          <>
                            <td className="px-1.5 py-1.5 text-right tabular-nums">{pct(groupSum(exitPoll.shares, group))}</td>
                            <td className="px-1.5 py-1.5 text-right tabular-nums">{pct(opinionPoll.available ? groupSum(opinionPoll.shares, group) : null)}</td>
                            <td className="border-l border-[var(--a-border)] px-1.5 py-1.5 text-right tabular-nums">{pct(groupSum(eciActual.shares, group))}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-1.5 py-1.5 text-right font-semibold tabular-nums">{pct(groupSum(currentShares, group))}</td>
                            <td className="px-1.5 py-1.5 text-right tabular-nums text-[var(--a-muted)]">{baselineAvailable && group.groups.some((key) => data.presence[baselineYear][key]) ? pct(groupSum(baselineShares, group)) : "—"}</td>
                            <td className="px-1.5 py-1.5 text-right tabular-nums text-[var(--a-muted)]" title="Opinion Poll is statewide only">—</td>
                            <td className="border-l border-[var(--a-border)] px-1.5 py-1.5 text-right tabular-nums text-[var(--a-muted)]">—</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!scopeIsState && <p className="px-2 py-1.5 text-[9px] text-[var(--a-muted)]">Local actual results are not available at this scope.</p>}
              </div>
            </div>
          </section>

          {/* ------------------------ forecaster comparison ------------------------ */}
          {scopeIsState && (
            <section className="analysis-panel rounded-2xl p-4 sm:p-5" aria-label="Forecaster comparison">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--a-brass)]">Forecasters</p>
                  <h3 className="mt-0.5 font-display text-[18px] font-semibold leading-tight text-[var(--a-ink)]">TVK seat projections</h3>
                  <p className="mt-0.5 text-[10.5px] text-[var(--a-muted)]">Rank, projected seats, seats off the actual result and winner call</p>
                </div>
                <span className="rounded-full border border-[var(--a-border)] bg-[var(--a-panel-2)] px-2.5 py-1 text-[10px] font-semibold text-[var(--a-ink)]">Actual {forecastActualSeats} seats</span>
              </div>

              {forecasters.length ? (
                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
                  <div className="min-w-0 overflow-x-auto rounded-xl border border-[var(--a-border)]">
                    <table className="w-full min-w-[300px] border-collapse text-[9px] sm:min-w-[540px] sm:text-[10px]">
                      <caption className="sr-only">Forecaster comparison for TVK seat projections</caption>
                      <thead>
                        <tr className="border-b border-[var(--a-border)] text-left text-[8px] uppercase tracking-wide text-[var(--a-muted)]">
                          <th scope="col" className="px-2 py-2">Rank</th>
                          <th scope="col" className="px-2 py-2">Forecaster</th>
                          <th scope="col" className="px-2 py-2 text-right">Projected seats</th>
                          <th scope="col" className="px-2 py-2 text-right">Seats Off</th>
                          <th scope="col" className="hidden px-2 py-2 sm:table-cell">Winner call</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forecasters.map((row) => (
                          <tr key={`${row.rank}-${row.forecaster}`} className="border-t border-[var(--a-border)]/70">
                            <td className="px-2 py-1.5 tabular-nums text-[var(--a-muted)]">{row.rank}</td>
                            <td className="px-2 py-1.5 font-medium">
                              {row.forecaster}
                              <span className="mt-0.5 block text-[8px] font-normal text-[var(--a-muted)] sm:hidden">{row.winnerCall || "—"}</span>
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{row.projectedSeats ?? "—"}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{row.differenceFromActual == null ? "—" : Math.abs(row.differenceFromActual)}</td>
                            <td className="hidden px-2 py-1.5 text-[var(--a-muted)] sm:table-cell">{row.winnerCall || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="min-w-0 rounded-xl border border-[var(--a-border)] bg-[var(--a-panel-2)] p-2">
                    <p className="mb-1 px-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--a-muted)]">Projected seats · dashed line at actual</p>
                    <div className="analysis-chart-enter">
                      <EChart option={forecasterChartOption} height={Math.max(260, forecasters.length * 24 + 40)} reduced={reduced} ariaLabel="TVK seat projections by forecaster with the actual seat reference line" />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed border-[var(--a-border)] px-3 py-3 text-[11px] text-[var(--a-muted)]">
                  Forecaster comparison data unavailable — the supplied multi-state report is not present in this workspace.
                </p>
              )}
            </section>
          )}

          {/* --------------------------- historical --------------------------- */}
          <section className="analysis-panel rounded-2xl p-4 sm:p-5" aria-label="Historical analysis">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--a-brass)]">Historical analysis</p>
                <h3 className="mt-0.5 font-display text-[18px] font-semibold leading-tight text-[var(--a-ink)]">2026 estimate against {baselineYear}</h3>
                <p className="mt-0.5 text-[10.5px] text-[var(--a-muted)]">{scopeName} · share, spread and seat context</p>
              </div>
              <span className="text-[10px] text-[var(--a-muted)]">Others &amp; NOTA combined throughout</span>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
              <aside className="analysis-soft h-fit rounded-xl p-3" aria-label="Historical analysis controls">
                <label className="flex items-center justify-between gap-2 text-[10px] font-medium text-[var(--a-muted)]">
                  Baseline
                  <select value={baselineYear} onChange={(event) => setBaselineYear(event.target.value as TnYear)} className="rounded-md border border-[var(--a-border)] bg-[var(--a-panel)] px-1.5 py-1 text-[10px] text-[var(--a-ink)]">
                    {BASELINES.map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                </label>

                <div className="mt-3">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--a-muted)]">Distribution unit</span>
                  <div className="mt-1 grid grid-cols-2 gap-0.5 rounded-lg border border-[var(--a-border)] bg-[var(--a-panel)] p-0.5" role="group" aria-label="Distribution geography">
                    {([["district", "Districts"], ["assembly", "Assemblies"]] as const).map(([id, label]) => (
                      <button key={id} type="button" aria-pressed={distUnit === id} onClick={() => setDistUnit(id)} className={cn("rounded-md px-2 py-1 text-[10px] font-semibold transition-colors", distUnit === id ? "bg-[var(--a-ink)] text-[var(--a-canvas)]" : "text-[var(--a-muted)] hover:text-[var(--a-ink)]")}>{label}</button>
                    ))}
                  </div>
                </div>

                <div className="mt-3">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--a-muted)]">Party filters</span>
                  <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Parties">
                    {ANALYSIS_GROUPS.map((group) => {
                      const active = parties.includes(group.key);
                      return (
                        <button key={group.key} type="button" aria-pressed={active} onClick={() => setParties((previous) => previous.includes(group.key) ? (previous.length > 1 ? previous.filter((key) => key !== group.key) : previous) : [...previous, group.key])} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9.5px] transition-opacity", active ? "border-[var(--a-border)] text-[var(--a-ink)]" : "border-[var(--a-border)]/60 text-[var(--a-muted)] opacity-50")}>
                          <span className="size-2 rounded-sm" style={{ background: group.color }} />{group.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 grid gap-1">
                  <button type="button" aria-pressed={showMedian} onClick={() => setShowMedian((value) => !value)} className={cn("rounded-lg border px-2 py-1.5 text-left text-[10px]", showMedian ? "border-[var(--a-brass)]/50 bg-[var(--a-brass-soft)] text-[var(--a-ink)]" : "border-[var(--a-border)] text-[var(--a-muted)]")}>Show median</button>
                  <button type="button" aria-pressed={highlightOutliers} onClick={() => setHighlightOutliers((value) => !value)} className={cn("rounded-lg border px-2 py-1.5 text-left text-[10px]", highlightOutliers ? "border-[var(--a-brass)]/50 bg-[var(--a-brass-soft)] text-[var(--a-ink)]" : "border-[var(--a-border)] text-[var(--a-muted)]")}>Highlight outliers</button>
                </div>

                <button type="button" onClick={resetControls} className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-[var(--a-border)] px-2 py-1.5 text-[10px] font-semibold text-[var(--a-muted)] hover:text-[var(--a-ink)]">
                  <RotateCcw className="size-3" /> Reset controls
                </button>
              </aside>

              <div className="min-w-0 space-y-4">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--a-muted)]">Estimated vote share vs {baselineYear}</p>
                  <div className="analysis-chart-enter"><EChart option={historicalOption} height={286} reduced={reduced} replaceSeries ariaLabel={`2026 estimated vote shares compared with ${baselineYear} for ${scopeName}`} /></div>
                </div>

                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--a-muted)]">Distribution across {distUnit === "district" ? "districts" : "assemblies"}</p>
                    <span className="text-[9px] text-[var(--a-muted)]">Box Q1–Q3 · whiskers 1.5×IQR · rings outliers</span>
                  </div>
                  {showMedian && (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[var(--a-muted)]">
                      {distribution.rows.map((row) => row.stats ? <span key={row.group.key} className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: row.group.color }} />{row.group.label} median <b className="tabular-nums text-[var(--a-ink)]/80">{row.stats.median.toFixed(1)}%</b></span> : null)}
                    </div>
                  )}
                  <div className="analysis-chart-enter"><EChart option={distributionOption} height={300} reduced={reduced} replaceSeries ariaLabel={`Distribution of estimated 2026 shares across ${distUnit === "district" ? "districts" : "assemblies"}`} /></div>
                </div>
              </div>
            </div>
          </section>

          {/* ------------------------------ seats ------------------------------ */}
          <section className="analysis-panel rounded-2xl p-4 sm:p-5" aria-label="Opinion poll and actual seats">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-display text-[18px] font-semibold leading-tight text-[var(--a-ink)]">Opinion poll seats and actual seats</h3>
                <p className="mt-0.5 text-[10.5px] text-[var(--a-muted)]">Opinion poll seats from the SAKET survey · Actual 2026 shown separately · {scopeName}</p>
              </div>
              <span className="text-[10px] text-[var(--a-muted)]">Opinion poll {totalOpinion || "—"} · Actual {totalActual ?? "—"}</span>
            </div>
            {opinionCall && <p className="mt-2 text-[10.5px] text-[var(--a-muted)]">Opinion poll call: {TN_LABEL[opinionCall] ?? opinionCall}</p>}
            <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-xl border border-[var(--a-border)] bg-[var(--a-panel-2)] p-2">
                <EChart option={seatChartOption} height={250} reduced={reduced} replaceSeries ariaLabel={`Opinion poll and Actual 2026 seats for ${scopeName}`} />
              </div>
              <div className="self-start overflow-hidden rounded-xl border border-[var(--a-border)]">
                <table className="w-full border-collapse text-[10px]">
                  <caption className="sr-only">Opinion poll and Actual 2026 seats</caption>
                  <thead>
                    <tr className="border-b border-[var(--a-border)] text-left text-[8px] uppercase tracking-wide text-[var(--a-muted)]">
                      <th className="px-2 py-1.5">Group</th>
                      <th className="px-2 py-1.5 text-right" title="SAKET survey seat estimate; NTK and Others & NOTA have no seat estimate">Opinion poll seats</th>
                      <th className="px-2 py-1.5 text-right">Actual 2026</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...TN_SEAT_GROUPS.map((group) => ({ key: group as string, label: TN_LABEL[group], color: TN_COLOR[group] })), { key: "NTK", label: TN_LABEL.NTK, color: TN_COLOR.NTK }, { key: "Others", label: "Others & NOTA", color: TN_COLOR.NOTA }].map((row) => {
                      const opinion = opinionCall ? "—" : (opinionSeats as Partial<Record<string, number>>)[row.key] ?? "—";
                      const actual = (actualSeats as Partial<Record<string, number>>)[row.key] ?? "—";
                      return (
                        <tr key={row.key} className="border-t border-[var(--a-border)]/70">
                          <td className="px-2 py-1.5"><span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: row.color }} />{row.label}</span></td>
                          <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{opinion}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{actual}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[var(--a-border)] bg-[var(--a-panel-2)] text-[10px]">
                      <td className="px-2 py-1.5">Total</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{totalOpinion || "—"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{totalActual ?? "—"}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>

          {/* ----------------------------- districts ----------------------------- */}
          <section className="analysis-panel rounded-2xl p-4 sm:p-5" aria-label="District comparison">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-display text-[18px] font-semibold leading-tight text-[var(--a-ink)]">District comparison</h3>
                <p className="mt-0.5 text-[10.5px] text-[var(--a-muted)]">Estimated shares · current 38-district grouping · select a district to inspect it here</p>
              </div>
              <label className="inline-flex items-center gap-1 text-[10px] text-[var(--a-muted)]">Sort
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="rounded-md border border-[var(--a-border)] bg-[var(--a-panel)] px-1.5 py-1 text-[10px] text-[var(--a-ink)]">
                  <option value="name">Name</option><option value="leader">2026 leading party</option><option value="responses">Responses</option>
                </select>
              </label>
            </div>
            <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-[var(--a-border)]">
              <table className="w-full min-w-[680px] border-collapse text-[10px]">
                <caption className="sr-only">District estimated shares and opinion poll seats</caption>
                <thead className="sticky top-0 z-10 bg-[var(--a-panel)]">
                  <tr className="border-b border-[var(--a-border)] text-left text-[8px] uppercase tracking-wide text-[var(--a-muted)]">
                    <th className="px-2 py-1.5">District</th>
                    <th className="px-2 py-1.5 text-right">Estimated votes</th>
                    <th className="px-2 py-1.5">Leading party</th>
                    {parties.map((key) => { const group = groupByKey(key); return <th key={key} className="whitespace-nowrap px-2 py-1.5 text-right" style={{ color: group.color }}>{group.label}</th>; })}
                    <th className="px-2 py-1.5 text-right" title="SAKET survey seat estimate">Opinion poll</th>
                    <th className="px-2 py-1.5 text-right">Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {districtsSorted.map((district) => {
                    const lead = district.surveyLeader;
                    return (
                      <tr key={district.name} onClick={() => setScope(`d:${district.name}`)} className={cn("cursor-pointer border-t border-[var(--a-border)]/70 hover:bg-[var(--a-brass-soft)]", scope === `d:${district.name}` && "bg-[var(--a-brass-soft)]")}>
                        <td className="px-2 py-1 font-medium">{district.name}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-[var(--a-muted)]">{district.survey.valid.toLocaleString("en-IN")}</td>
                        <td className="px-2 py-1">{lead ? <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-sm" style={{ background: TN_COLOR[lead] }} />{TN_LABEL[lead]}</span> : "—"}</td>
                        {parties.map((key) => { const group = groupByKey(key); const value = groupSum(district.survey.shares, group); return <td key={key} className="px-2 py-1 text-right tabular-nums">{value == null ? "—" : (value * 100).toFixed(1)}</td>; })}
                        <td className="px-2 py-1 text-right tabular-nums">{seatTotal(district.originalSeats) ?? "—"}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{seatTotal(district.actualSeats) ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="analysis-panel rounded-2xl p-4 sm:p-5" aria-label="District comparison chart">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--a-brass)]">District lines</p>
                <h3 className="mt-0.5 font-display text-[18px] font-semibold leading-tight text-[var(--a-ink)]">District comparison chart</h3>
                <p className="mt-0.5 text-[10.5px] text-[var(--a-muted)]">Estimated vote share by district · dashed median · rings mark outliers</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-[var(--a-muted)]">38 districts</span>
                <button type="button" aria-pressed={showMedian} onClick={() => setShowMedian((value) => !value)} className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold", showMedian ? "border-[var(--a-brass)]/50 bg-[var(--a-brass-soft)] text-[var(--a-ink)]" : "border-[var(--a-border)] text-[var(--a-muted)]")}>Median</button>
                <button type="button" aria-pressed={highlightOutliers} onClick={() => setHighlightOutliers((value) => !value)} className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold", highlightOutliers ? "border-[var(--a-brass)]/50 bg-[var(--a-brass-soft)] text-[var(--a-ink)]" : "border-[var(--a-border)] text-[var(--a-muted)]")}>Outliers</button>
              </div>
            </div>
            {showMedian && (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[var(--a-muted)]">
                {districtStats.filter((row) => row.stats).map((row) => (
                  <span key={row.key} className="inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-sm" style={{ background: row.group.color }} />
                    {row.group.label} median <b className="tabular-nums text-[var(--a-ink)]/80">{row.stats!.median.toFixed(1)}%</b>
                  </span>
                ))}
              </div>
            )}
            <div className="analysis-chart-enter"><EChart option={districtChartOption} height={330} reduced={reduced} replaceSeries ariaLabel="Estimated vote share by district with median lines and outliers" /></div>
            <p className="mt-0.5 text-[9px] text-[var(--a-muted)]">Box fences 1.5×IQR · rings show outlying districts · drag inside the chart to zoom</p>
          </section>

          {/* ----------------------------- assemblies ----------------------------- */}
          <section className="analysis-panel rounded-2xl p-4 sm:p-5" aria-label="Assembly comparison">
            <div className="flex items-baseline justify-between gap-2">
              <div><h3 className="font-display text-[18px] font-semibold leading-tight text-[var(--a-ink)]">Assembly comparison</h3><p className="mt-0.5 text-[10.5px] text-[var(--a-muted)]">Estimated shares and calls · 234 assemblies</p></div>
              <span className="text-[10px] text-[var(--a-muted)]">{data.acs.length} assemblies</span>
            </div>
            <div className="mt-3 max-h-[360px] overflow-auto rounded-xl border border-[var(--a-border)]">
              <table className="w-full min-w-[660px] border-collapse text-[10px]">
                <caption className="sr-only">Assembly estimated shares and calls</caption>
                <thead className="sticky top-0 z-10 bg-[var(--a-panel)]">
                  <tr className="border-b border-[var(--a-border)] text-left text-[8px] uppercase tracking-wide text-[var(--a-muted)]">
                    <th className="px-2 py-1.5">AC</th>
                    <th className="px-2 py-1.5">Constituency</th>
                    <th className="px-2 py-1.5">District</th>
                    {parties.map((key) => { const group = groupByKey(key); return <th key={key} className="whitespace-nowrap px-2 py-1.5 text-right" style={{ color: group.color }}>{group.label}</th>; })}
                    <th className="px-2 py-1.5">Estimated</th>
                    <th className="px-2 py-1.5">Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {data.acs.map((ac) => (
                    <tr key={ac.no} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") setScope(`a:${ac.no}`); }} onClick={() => setScope(`a:${ac.no}`)} className={cn("cursor-pointer border-t border-[var(--a-border)]/70 hover:bg-[var(--a-brass-soft)] focus:bg-[var(--a-brass-soft)]", scope === `a:${ac.no}` && "bg-[var(--a-brass-soft)]")}>
                      <td className="px-2 py-1 tabular-nums text-[var(--a-muted)]">{ac.no}</td>
                      <td className="px-2 py-1 font-medium">{ac.name}</td>
                      <td className="px-2 py-1 text-[var(--a-muted)]">{ac.district}</td>
                      {parties.map((key) => { const group = groupByKey(key); const value = groupSum(ac.survey.shares, group); return <td key={key} className="px-2 py-1 text-right tabular-nums">{value == null ? "—" : (value * 100).toFixed(1)}</td>; })}
                      <td className="px-2 py-1 text-[var(--a-muted)]">{ac.final.leader ? TN_LABEL[ac.final.leader] : "—"}</td>
                      <td className="px-2 py-1 text-[var(--a-muted)]">{ac.actual2026.winner ? TN_LABEL[ac.actual2026.winner] : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </AnalysisShell>
  );
}

/* Series labels for the overview chart. Each swatch carries the party
   palette, while its opacity matches the poll/actual series. */
function SeriesLegend({ items }: { items: { label: string; opacity: number }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[9.5px] text-[var(--a-muted)]">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-sm" style={{ background: "linear-gradient(90deg, #EAB308, #16A34A, #DC2626, #7C3AED, #64748B)", opacity: item.opacity }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Social media view, kept as a readable table plus direct reach bars.
 * ------------------------------------------------------------------ */
function SocialOverview({ social }: { social: TnSocial }) {
  const rows = social.rows.filter((row) => row.platform !== "Total");
  const total = social.rows.find((row) => row.platform === "Total");
  const max = Math.max(1, ...rows.map((row) => row.total));
  return (
    <section className="analysis-panel rounded-2xl p-4 sm:p-6" aria-label="Social media reach">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--a-brass)]">Social media</p>
      <h3 className="mt-0.5 font-display text-[19px] font-semibold leading-tight text-[var(--a-ink)]">Tamil Nadu Meta reach</h3>
      <p className="mt-0.5 text-[10.5px] text-[var(--a-muted)]">{social.window}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className="overflow-x-auto rounded-xl border border-[var(--a-border)]">
          <table className="w-full min-w-[440px] border-collapse text-[10.5px]">
            <caption className="sr-only">Tamil Nadu statewide Meta reach</caption>
            <thead>
              <tr className="border-b border-[var(--a-border)] text-left text-[8.5px] uppercase tracking-wide text-[var(--a-muted)]">
                <th className="px-2 py-2">Platform</th>
                <th className="px-2 py-2 text-right">Organic reach</th>
                <th className="px-2 py-2 text-right">Paid reach</th>
                <th className="px-2 py-2 text-right">Total reach</th>
                <th className="px-2 py-2 text-right">Followers</th>
              </tr>
            </thead>
            <tbody>
              {social.rows.map((row) => (
                <tr key={row.platform} className={cn("border-t border-[var(--a-border)]/70", row.platform === "Total" && "bg-[var(--a-panel-2)] font-semibold")}>
                  <th scope="row" className="px-2 py-2 text-left font-medium">{row.platform}</th>
                  <td className="px-2 py-2 text-right tabular-nums">{row.organic.toLocaleString("en-US")}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{row.paid.toLocaleString("en-US")}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{row.total.toLocaleString("en-US")}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{row.followers.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-[var(--a-border)] bg-[var(--a-panel-2)] p-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--a-muted)]">Reach by platform</p>
          <div className="mt-3 space-y-3">
            {rows.map((row) => (
              <div key={row.platform}>
                <div className="flex items-baseline justify-between gap-2 text-[10px]">
                  <span className="font-semibold text-[var(--a-ink)]">{row.platform}</span>
                  <span className="tabular-nums text-[var(--a-muted)]">{row.total.toLocaleString("en-US")}</span>
                </div>
                <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-[var(--a-border)]/40">
                  <span className="bg-[#2fbf4a]" style={{ width: `${(row.organic / max) * 100}%` }} />
                  <span className="bg-saffron" style={{ width: `${(row.paid / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] font-semibold">
            <span className="inline-flex items-center gap-1 text-[var(--a-muted)]"><span className="size-1.5 rounded-sm bg-[#2fbf4a]" />Organic {social.organicPct}%</span>
            <span className="inline-flex items-center gap-1 text-[var(--a-muted)]"><span className="size-1.5 rounded-sm bg-saffron" />Paid {social.paidPct}%</span>
          </div>
          <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-[var(--a-border)]/40" role="img" aria-label={`Meta reach split: ${social.organicPct}% organic and ${social.paidPct}% paid`}>
            <span className="bg-[#2fbf4a]" style={{ width: `${social.organicPct}%` }} />
            <span className="bg-saffron" style={{ width: `${social.paidPct}%` }} />
          </div>
          {total && <p className="mt-3 text-[10px] text-[var(--a-muted)]">Total reach <b className="tabular-nums text-[var(--a-ink)]">{total.total.toLocaleString("en-US")}</b> · {total.followers.toLocaleString("en-US")} followers</p>}
        </div>
      </div>
    </section>
  );
}
