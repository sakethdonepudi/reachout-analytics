"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Table2, X } from "lucide-react";
import {
  PARTIES, PARTY_COLOR, PARTY_LABEL, fmtPct, type Party, type ShareSet, weightedShares,
} from "@/lib/telangana/oct26";
import {
  EXTRA_INTERVALS, SWING_INTERVALS, acSwing, cohortStats, historicalShares, outlierRows,
  type ElectionYear,
} from "@/lib/telangana/history";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import EChart from "@/components/case-studies/telangana/echart";
import { cn } from "@/lib/utils";
import type { AcRow } from "@/lib/telangana/oct26";

/* =====================================================================
   Maximised history chart.

   Vote share: 2014/2018/2023 actual segments are solid; 2028 is a dashed
   prediction segment. Swing: three election intervals plus optional
   2014→2028 / 2018→2028 baseline comparisons. The median is the median AC
   swing (never the vote-weighted aggregate), and outlier rings/list only
   reference assemblies, never the aggregate itself.
   ===================================================================== */

const YEARS: ElectionYear[] = ["2014", "2018", "2023", "2028"];
const signed = (v: number, d = 2) => `${v > 0 ? "+" : ""}${v.toFixed(d)}`;

function palette(theme: "light" | "dark") {
  const dark = theme === "dark";
  return {
    axis: dark ? "rgba(190,202,218,.45)" : "rgba(70,86,104,.5)",
    grid: dark ? "rgba(255,255,255,.08)" : "rgba(20,24,31,.09)",
    text: dark ? "#e5ebf4" : "#20262e",
    muted: dark ? "rgba(229,235,244,.55)" : "rgba(32,38,46,.55)",
    bg: dark ? "rgba(16,22,30,.97)" : "rgba(255,255,255,.98)",
    border: dark ? "rgba(120,135,155,.35)" : "rgba(20,24,31,.12)",
    median: dark ? "#a7b4c8" : "#64748b",
  };
}
type Pal = ReturnType<typeof palette>;
const tipStyle = (p: Pal) => ({
  confine: true, backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, padding: [8, 10],
  textStyle: { color: p.text, fontSize: 11.5, fontFamily: "inherit" },
  extraCssText: "border-radius:8px;box-shadow:0 12px 30px -14px rgba(0,0,0,.55);max-width:320px;",
});

export default function TelanganaChartModal({
  open, onClose, acs, cohortAcs, scopeLabel, cohortLabel, year, selectedNo, onSelectAc, theme,
}: {
  open: boolean;
  onClose: () => void;
  acs: AcRow[];
  cohortAcs: AcRow[];
  scopeLabel: string;
  cohortLabel: string;
  year: ElectionYear;
  selectedNo: number | null;
  onSelectAc: (no: number) => void;
  theme: "light" | "dark";
}) {
  const reduced = usePrefersReducedMotion();
  const p = palette(theme);
  const [mode, setMode] = useState<"share" | "swing">("share");
  const [visible, setVisible] = useState<Party[]>([...PARTIES]);
  const [medianParty, setMedianParty] = useState<Party>("BRS");
  const [showMedian, setShowMedian] = useState(false);
  const [highlightOutliers, setHighlightOutliers] = useState(true);
  const [includeBaselines, setIncludeBaselines] = useState(false);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sharesByYear = useMemo<Record<ElectionYear, ShareSet>>(() => ({
    "2014": historicalShares(acs, "2014"),
    "2018": historicalShares(acs, "2018"),
    "2023": historicalShares(acs, "2023"),
    "2028": weightedShares(acs, "prediction"),
  }), [acs]);

  const intervals = useMemo(
    () => (includeBaselines ? [...SWING_INTERVALS, ...EXTRA_INTERVALS] : SWING_INTERVALS),
    [includeBaselines],
  );
  const swingOf = (from: ElectionYear, to: ElectionYear, party: Party) =>
    (sharesByYear[to][party] - sharesByYear[from][party]) * 100;

  const cohorts = useMemo(
    () => intervals.map((iv) => cohortStats(cohortAcs, Number(iv.from), Number(iv.to), medianParty)),
    [intervals, cohortAcs, medianParty],
  );
  const outlierGroups = useMemo(
    () => intervals.map((iv) => ({
      iv,
      rows: outlierRows(cohortAcs, Number(iv.from), Number(iv.to), medianParty, 4),
    })),
    [intervals, cohortAcs, medianParty],
  );
  const nForMedian = cohorts.find(Boolean)?.n ?? 0;

  const toggleParty = (party: Party) =>
    setVisible((prev) => (prev.includes(party) ? (prev.length > 1 ? prev.filter((x) => x !== party) : prev) : [...prev, party]));

  const shareOption = useMemo(() => {
    const max = Math.max(35, Math.ceil(Math.max(...PARTIES.flatMap((x) => YEARS.map((y) => sharesByYear[y][x] * 100))) / 10) * 10 + 5);
    const series: unknown[] = [];
    for (const party of visible) {
      series.push({
        name: `${PARTY_LABEL[party]} actual`, type: "line", data: [...YEARS.slice(0, 3).map((y) => +(sharesByYear[y][party] * 100).toFixed(2)), null],
        smooth: false, symbol: "circle", symbolSize: 7, itemStyle: { color: PARTY_COLOR[party] },
        lineStyle: { color: PARTY_COLOR[party], width: 2.2, type: "solid" }, emphasis: { focus: "series" },
      });
      series.push({
        name: `${PARTY_LABEL[party]} predicted`, type: "line",
        data: [null, null, +(sharesByYear["2023"][party] * 100).toFixed(2), +(sharesByYear["2028"][party] * 100).toFixed(2)],
        smooth: false, symbol: "emptyCircle", symbolSize: 8, itemStyle: { color: PARTY_COLOR[party] },
        lineStyle: { color: PARTY_COLOR[party], width: 2, type: "dashed" }, emphasis: { focus: "series" },
      });
    }
    return {
      animation: !reduced, animationDuration: 550,
      grid: { left: 44, right: 18, top: 24, bottom: 30 },
      tooltip: {
        ...tipStyle(p), trigger: "axis",
        formatter: (params: unknown) => {
          const items = Array.isArray(params) ? params as { dataIndex: number; seriesName: string; value: number | null; color: string }[] : [];
          if (!items.length) return "";
          const idx = items[0].dataIndex;
          const y = YEARS[idx];
          const seen = new Set<string>();
          const rows = items.filter((i) => i.value != null).filter((i) => {
            const name = i.seriesName.replace(/ (actual|predicted)$/, "");
            if (seen.has(name)) return false;
            seen.add(name);
            return true;
          }).map((i) => `<div style="display:flex;justify-content:space-between;gap:12px"><span><span style="display:inline-block;width:7px;height:7px;border-radius:2px;background:${i.color};margin-right:5px"></span>${i.seriesName.replace(/ (actual|predicted)$/, "")}</span><b>${Number(i.value).toFixed(2)}%</b></div>`);
          return `<div style="font-weight:600;margin-bottom:3px">${y === "2028" ? "2028 prediction" : `${y} actual`}</div>${rows.join("")}`;
        },
      },
      xAxis: {
        type: "category", data: ["2014", "2018", "2023", "2028 P"], boundaryGap: false,
        axisLine: { lineStyle: { color: p.axis } }, axisTick: { show: false },
        axisLabel: { color: p.text, fontSize: 10.5 },
      },
      yAxis: {
        type: "value", min: 0, max, axisLabel: { color: p.muted, fontSize: 9.5, formatter: "{value}%" },
        splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false },
      },
      series,
    };
  }, [sharesByYear, visible, p, reduced]);

  const swingOption = useMemo(() => {
    const values: number[] = [];
    for (const iv of intervals) for (const party of visible) values.push(swingOf(iv.from, iv.to, party));
    if (showMedian) for (const c of cohorts) if (c) values.push(c.medianPp);
    const bound = Math.max(5, Math.ceil(Math.max(5, ...values.map((v) => Math.abs(v))) / 5) * 5);
    const series: unknown[] = visible.map((party) => ({
      name: PARTY_LABEL[party], type: "line",
      data: intervals.map((iv) => +swingOf(iv.from, iv.to, party).toFixed(2)),
      symbol: "circle", symbolSize: 7, itemStyle: { color: PARTY_COLOR[party] },
      lineStyle: { color: PARTY_COLOR[party], width: 2.2, type: "solid" }, emphasis: { focus: "series" },
    }));
    if (showMedian) {
      series.push({
        name: `Median (${PARTY_LABEL[medianParty]})`, type: "line",
        data: cohorts.map((c) => (c ? +c.medianPp.toFixed(2) : null)),
        symbol: "diamond", symbolSize: 7, itemStyle: { color: p.median },
        lineStyle: { color: p.median, width: 1.5, type: "dashed" },
        connectNulls: false,
      });
    }
    if (highlightOutliers && selectedNo != null) {
      const pts: [number, number][] = [];
      intervals.forEach((iv, i) => {
        const c = cohorts[i];
        if (!c || !c.flags.get(selectedNo)) return;
        const v = acSwing(selectedNo, Number(iv.from), Number(iv.to), medianParty);
        if (v != null) pts.push([i, +v.toFixed(2)]);
      });
      if (pts.length) {
        series.push({
          name: "Selected outlier", type: "scatter", data: pts,
          symbolSize: 18, itemStyle: { color: "transparent", borderColor: PARTY_COLOR[medianParty], borderWidth: 2 },
          label: { show: true, formatter: "outlier", color: p.text, fontSize: 8.5, position: "top" },
          z: 12,
        });
      }
    }
    return {
      animation: !reduced, animationDuration: 550,
      grid: { left: 46, right: 18, top: 26, bottom: 42 },
      tooltip: {
        ...tipStyle(p), trigger: "axis",
        formatter: (params: unknown) => {
          const items = Array.isArray(params) ? params as { dataIndex: number }[] : [];
          const i = items[0]?.dataIndex ?? 0;
          const iv = intervals[i];
          const rows = visible.map((party) => {
            const v = swingOf(iv.from, iv.to, party);
            return `<div style="display:flex;justify-content:space-between;gap:12px"><span><span style="display:inline-block;width:7px;height:7px;border-radius:2px;background:${PARTY_COLOR[party]};margin-right:5px"></span>${PARTY_LABEL[party]}</span><span><b>${signed(v)} pp</b> <span style="opacity:.65">(${fmtPct(sharesByYear[iv.from][party])} → ${fmtPct(sharesByYear[iv.to][party])})</span></span></div>`;
          });
          const c = cohorts[i];
          const median = c ? `<div style="margin-top:3px;opacity:.75">Median ${PARTY_LABEL[medianParty]} ${signed(c.medianPp)} pp · n=${c.n}</div>` : `<div style="margin-top:3px;opacity:.75">Median needs at least 10 comparable assemblies.</div>`;
          return `<div style="font-weight:600;margin-bottom:3px">${iv.label}</div>${rows.join("")}${showMedian ? median : ""}`;
        },
      },
      xAxis: {
        type: "category", data: intervals.map((iv) => `${iv.from}→${iv.to}`),
        axisLine: { lineStyle: { color: p.axis } }, axisTick: { show: false },
        axisLabel: { color: p.text, fontSize: 9.5, interval: 0 },
      },
      yAxis: {
        type: "value", min: -bound, max: bound, axisLabel: { color: p.muted, fontSize: 9.5, formatter: (v: number) => `${v > 0 ? "+" : ""}${v}` },
        splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false },
      },
      series: [
        ...series,
        { type: "line", data: [], markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: p.axis, width: 1 }, data: [{ yAxis: 0 }] } },
      ],
    };
  }, [intervals, visible, cohorts, showMedian, highlightOutliers, selectedNo, medianParty, sharesByYear, p, reduced]);

  const option = mode === "share" ? shareOption : swingOption;
  const selectedAc = acs.find((a) => a.no === selectedNo) ?? null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/80 p-2 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="tg-chart-title" onClick={onClose}>
      <div className="flex max-h-[96svh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 id="tg-chart-title" className="font-display text-lg font-semibold">Telangana history · vote share and swing</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{scopeLabel} · 2014, 2018, 2023 actual and 2028 prediction · 2028 is a prediction, not an observed election</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close chart"
            className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          <div className="inline-flex rounded-full border border-border p-0.5" role="group" aria-label="Chart mode">
            {([["share", "Vote share"], ["swing", "Swing"]] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}
                className={cn("rounded-full px-3 py-1 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60", mode === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1" aria-label="Party series">
            {PARTIES.map((party) => (
              <button key={party} type="button" aria-pressed={visible.includes(party)} onClick={() => toggleParty(party)}
                className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10.5px] font-medium transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60",
                  visible.includes(party) ? "border-border text-foreground" : "border-border/60 text-muted-foreground opacity-45")}>
                <span className="size-2 rounded-sm" style={{ background: PARTY_COLOR[party] }} />{PARTY_LABEL[party]}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button type="button" aria-pressed={showMedian} onClick={() => setShowMedian((v) => !v)}
              className={cn("rounded-full border px-2 py-1 text-[10px] font-medium", showMedian ? "border-foreground/40 bg-muted/40 text-foreground" : "border-border text-muted-foreground")}>
              Show median
            </button>
            <button type="button" aria-pressed={highlightOutliers} onClick={() => setHighlightOutliers((v) => !v)}
              className={cn("rounded-full border px-2 py-1 text-[10px] font-medium", highlightOutliers ? "border-foreground/40 bg-muted/40 text-foreground" : "border-border text-muted-foreground")}>
              Highlight outliers
            </button>
            {mode === "swing" && (
              <button type="button" aria-pressed={includeBaselines} onClick={() => setIncludeBaselines((v) => !v)}
                className={cn("rounded-full border px-2 py-1 text-[10px] font-medium", includeBaselines ? "border-foreground/40 bg-muted/40 text-foreground" : "border-border text-muted-foreground")}>
                2014→2028 / 2018→2028
              </button>
            )}
            <label className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              Median party
              <select value={medianParty} onChange={(e) => setMedianParty(e.target.value as Party)}
                className="rounded-md border border-border bg-background px-1.5 py-1 text-[10px] text-foreground">
                {PARTIES.map((party) => <option key={party} value={party}>{PARTY_LABEL[party]}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">
              <Table2 className="size-3" /> Data table
            </button>
            <button type="button" onClick={() => { setMode("share"); setVisible([...PARTIES]); setShowMedian(false); setHighlightOutliers(true); setIncludeBaselines(false); setMedianParty("BRS"); }}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">
              <RotateCcw className="size-3" /> Reset
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <div className="pt-3">
            <EChart option={option} height={350} reduced={reduced} replaceSeries ariaLabel={`${mode === "share" ? "Vote share" : "Swing"} chart for ${scopeLabel}, 2014 to 2028`} />
          </div>
          <p className="mt-1 text-[9.5px] text-muted-foreground">
            {mode === "share" ? "Solid segments are actual election results (2014, 2018, 2023); the dashed segment is the 2028 prediction." : "Swing is in percentage points. The median is the median assembly swing across comparable ACs, not the vote-weighted aggregate. Optional 2014→2028 and 2018→2028 lines are baseline comparisons, not extra election periods."}
          </p>

          {mode === "swing" && (showMedian || highlightOutliers) && (
            <div className="mt-3 grid gap-2 rounded-xl border border-border bg-background/40 p-3 md:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Median and fences · {PARTY_LABEL[medianParty]} · {nForMedian ? `n=${nForMedian}` : "insufficient data"} · cohort {cohortLabel}
                </p>
                {nForMedian === 0 ? (
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">At least 10 comparable assemblies are needed for a median or outlier fences. This scope has fewer; no statistics are invented.</p>
                ) : (
                  <div className="mt-1 space-y-1 text-[10.5px] text-muted-foreground">
                    {intervals.map((iv, i) => {
                      const c = cohorts[i];
                      if (!c) return <div key={iv.label}>{iv.label}: insufficient data</div>;
                      return <div key={iv.label} className="flex flex-wrap gap-x-2"><span className="font-medium text-foreground/80">{iv.label}</span><span>median {signed(c.medianPp)} pp</span><span>fences {signed(c.lowerFencePp, 1)} / {signed(c.upperFencePp, 1)}</span></div>;
                    })}
                  </div>
                )}
                {selectedAc && nForMedian > 0 && <p className="mt-1 text-[10px] text-muted-foreground">Selected assembly: {selectedAc.name}. Rings mark points outside the relevant fences for {PARTY_LABEL[medianParty]}.</p>}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Outlier assemblies</p>
                {nForMedian === 0 ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">—</p>
                ) : (
                  <div className="mt-1 space-y-1">
                    {outlierGroups.map(({ iv, rows }) => rows.length === 0 ? null : (
                      <div key={iv.label}>
                        <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{iv.label}</p>
                        <div className="flex flex-wrap gap-1">
                          {rows.map((r) => (
                            <button key={`${iv.label}-${r.no}`} type="button" onClick={() => { onSelectAc(r.no); onClose(); }}
                              className="rounded-full border border-border px-2 py-0.5 text-[10px] hover:border-saffron/50">
                              {r.ac?.name ?? `AC ${r.no}`} <b className="tabular-nums">{signed(r.changePp, 1)}</b>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {outlierGroups.every((g) => g.rows.length === 0) && <p className="text-[10.5px] text-muted-foreground">No assemblies outside the fences for this party.</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {showTable && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-[10.5px]">
                <caption className="sr-only">Chart data table for {scopeLabel}</caption>
                <thead>
                  <tr className="bg-muted/30 text-left text-[9px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-1.5">{mode === "share" ? "Year" : "Interval"}</th>
                    {PARTIES.map((party) => <th key={party} className="px-2 py-1.5 text-right">{PARTY_LABEL[party]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {mode === "share"
                    ? YEARS.map((y) => (
                      <tr key={y} className="border-t border-border/60">
                        <th scope="row" className="px-2 py-1 text-left font-medium">{y === "2028" ? "2028 predicted" : y}</th>
                        {PARTIES.map((party) => <td key={party} className="px-2 py-1 text-right tabular-nums">{fmtPct(sharesByYear[y][party])}</td>)}
                      </tr>
                    ))
                    : intervals.map((iv) => (
                      <tr key={iv.label} className="border-t border-border/60">
                        <th scope="row" className="px-2 py-1 text-left font-medium">{iv.label}</th>
                        {PARTIES.map((party) => <td key={party} className="px-2 py-1 text-right tabular-nums">{signed(swingOf(iv.from, iv.to, party))} pp</td>)}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
