"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Maximize2, Minimize2, RefreshCw, RotateCcw, Search, Table2 } from "lucide-react";
import { partyMeta } from "@/lib/telangana/parties";
import { brandMarker } from "@/lib/telangana/brands";
import {
  fmtInt, fmtPct, fmtPp,
  type AgeRow, type AcRecord, type Counts, type DailyRow, type PartyShare, type RoundRow, type StatewideRow,
} from "@/lib/telangana/model";
import { usePrefersReducedMotion } from "./chart-motion";
import EChart from "./echart";
import { cn } from "@/lib/utils";

/* =====================================================================
   Telangana analysis — interactive ECharts dashboard.

   Chart-only state (hidden series, sort, zoom, category filters) is kept
   here and is separate from the page's global geography/party filters.
   ===================================================================== */

export type ChartId = "share" | "seats" | "swing" | "trend" | "assemblies" | "devices" | "age";

export const CHARTS: { id: ChartId; label: string; note: string }[] = [
  { id: "share", label: "Party share", note: "2018 actual · 2023 actual · 2028 survey" },
  { id: "seats", label: "Seats", note: "Actual 2018 and 2023 seats · statewide" },
  { id: "swing", label: "Swing", note: "Signed percentage points around zero" },
  { id: "trend", label: "Trend", note: "Statewide 2026 collection rounds · actuals shown separately" },
  { id: "assemblies", label: "Assemblies", note: "Rank, search and select an assembly" },
  { id: "devices", label: "Devices", note: "Original-entry device metadata" },
  { id: "age", label: "Age groups", note: "Answered 2028 questions by age" },
];

export type ScopeData = {
  label: string;
  acs: AcRecord[];
  counts2028: Counts;
  answered2028: number;
  counts2023: Counts;
  total2023: number;
  counts2018: Counts;
  total2018: number;
  shares2028: PartyShare[];
  shares2023: PartyShare[];
  shares2018: PartyShare[];
  device: Record<string, number>;
  deviceTotal: number;
};

export type ChartStatus = {
  updating: boolean;
  lastRefreshed: string | null;
  error: string | null;
  flash: boolean;
  onRefresh: () => void;
};

type TrendMode = "r388" | "r688" | "d7" | "d14" | "d30";

export type Prefs = {
  share: { hidden: string[] };
  swing: { metric: "actual" | "survey"; sort: "gain" | "decline" | "name" };
  trend: { mode: TrendMode; zoom: [number, number] };
  assemblies: { metric: "share" | "margin" | "swing"; q: string };
  devices: { brand: string | null };
  age: { party: string | null };
};

export const DEFAULT_PREFS: Prefs = {
  share: { hidden: [] },
  swing: { metric: "actual", sort: "gain" },
  trend: { mode: "r388", zoom: [0, 100] },
  assemblies: { metric: "share", q: "" },
  devices: { brand: null },
  age: { party: null },
};

const CONTESTED = ["BRS", "INC", "BJP", "AIMIM", "TDP", "JSP", "Others"];
const PERIODS = ["2018 actual", "2023 actual", "2028 survey"];
const C = (p: string) => partyMeta(p).color;
const pctOf = (s: PartyShare[], p: string) => s.find((x) => x.party === p)?.share ?? null;
const gradV = (p: string) => ({ type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: C(p) }, { offset: 1, color: `${C(p)}b8` }] });
const gradH = (p: string) => ({ type: "linear", x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: `${C(p)}cc` }, { offset: 1, color: C(p) }] });

function palette(theme: "light" | "dark") {
  const dark = theme === "dark";
  return {
    axis: dark ? "rgba(190,202,218,.42)" : "rgba(70,86,104,.45)",
    grid: dark ? "rgba(255,255,255,.07)" : "rgba(20,24,31,.08)",
    text: dark ? "#dfe5ee" : "#232a33",
    muted: dark ? "rgba(223,229,238,.58)" : "rgba(35,42,51,.58)",
    tipBg: dark ? "rgba(16,22,30,.97)" : "rgba(255,255,255,.98)",
    tipBorder: dark ? "rgba(120,135,155,.35)" : "rgba(20,24,31,.12)",
    tipText: dark ? "#f1f5fa" : "#20242b",
  };
}
type Pal = ReturnType<typeof palette>;

const dot = (p: string) => `<span style="display:inline-block;width:7px;height:7px;border-radius:2px;background:${C(p)};margin-right:5px"></span>`;
const tooltipBase = (p: Pal) => ({
  confine: true,
  backgroundColor: p.tipBg,
  borderColor: p.tipBorder,
  borderWidth: 1,
  padding: [7, 9],
  textStyle: { color: p.tipText, fontSize: 11, fontFamily: "inherit" },
  extraCssText: "border-radius:8px;box-shadow:0 12px 30px -14px rgba(0,0,0,.55);max-width:230px;",
});

/* ---------------- small controls ---------------- */
function Segmented<T extends string>({ options, value, onChange, label }: { options: [T, string][]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="inline-flex rounded-full border border-border p-0.5" role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} type="button" onClick={() => onChange(id)} aria-pressed={value === id}
          className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60",
            value === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
          {text}
        </button>
      ))}
    </div>
  );
}

function ResetChart({ show, onClick }: { show: boolean; onClick: () => void }) {
  if (!show) return null;
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
      <RotateCcw className="size-3" /> Reset chart
    </button>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-saffron/50 bg-saffron/10 px-2 py-0.5 text-[10.5px] font-semibold text-saffron-2">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove filter ${label}`} className="rounded-full p-0.5 hover:bg-saffron/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-saffron/60">×</button>
    </span>
  );
}

function DataTable({ caption, head, rows, rowHead = true }: { caption: string; head: string[]; rows: (string | number)[][]; rowHead?: boolean }) {
  return (
    <div className="mt-3 max-h-[220px] overflow-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-[11.5px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-card">
          <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            {head.map((h, i) => <th key={h} scope="col" className={cn("px-2 py-1.5 font-semibold", i > 0 && "text-right")}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border/60">
              {r.map((cell, j) => j === 0 && rowHead
                ? <th key={j} scope="row" className="px-2 py-1.5 text-left font-medium">{cell}</th>
                : <td key={j} className={cn("px-2 py-1.5 tabular-nums", j > 0 && "text-right")}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={open}
      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60",
        open ? "border-saffron/50 bg-saffron/10 text-saffron-2" : "border-border text-muted-foreground hover:text-foreground")}>
      <Table2 className="size-3" /> {open ? "Hide table" : "Data table"}
    </button>
  );
}

function Controls({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 flex flex-wrap items-center gap-1.5">{children}</div>;
}

function EmptyChart({ text = "No answered survey responses in this scope." }: { text?: string }) {
  return <div className="grid h-[330px] place-items-center rounded-lg border border-dashed border-border text-center text-[12px] text-muted-foreground">{text}</div>;
}

/* ================================================================== *
 *  PARTY SHARE — grouped bars by period, party series
 * ================================================================== */
function ShareChart({ scope, parties, prefs, setPrefs, theme, reduced, showTable }: {
  scope: ScopeData; parties: string[]; prefs: Prefs; setPrefs: (p: Prefs) => void; theme: "light" | "dark"; reduced: boolean; showTable: boolean;
}) {
  const p = palette(theme);
  const visible = CONTESTED.filter((x) => !prefs.share.hidden.includes(x) && parties.includes(x));
  const vals = visible.map((x) => ({ party: x, v: [pctOf(scope.shares2018, x), pctOf(scope.shares2023, x), pctOf(scope.shares2028, x)] }));
  const yMax = Math.max(10, Math.ceil((Math.max(...vals.flatMap((x) => x.v.map((v) => v ?? 0))) + 4) / 10) * 10);
  const dirty = prefs.share.hidden.length > 0;

  const option = useMemo(() => ({
    animation: !reduced, animationDuration: 600, animationDurationUpdate: 450, animationEasing: "cubicOut",
    grid: { left: 46, right: 14, top: 16, bottom: 28 },
    tooltip: {
      ...tooltipBase(p), trigger: "axis", axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const arr = params as { dataIndex: number }[];
        if (!arr.length) return "";
        const i = arr[0]?.dataIndex ?? 0;
        return `<div style="font-weight:600;margin-bottom:3px">${PERIODS[i]}</div>` +
          vals.map((x) => `<div style="display:flex;align-items:center;gap:4px">${dot(x.party)}<span>${partyMeta(x.party).label}</span><b style="margin-left:auto;padding-left:12px">${x.v[i] === null ? "—" : `${x.v[i]!.toFixed(2)}%`}</b></div>`).join("");
      },
    },
    xAxis: { type: "category", data: PERIODS, axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.muted, fontSize: 10 } },
    yAxis: { type: "value", max: yMax, axisLabel: { color: p.muted, fontSize: 10, formatter: "{value}%" }, splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false } },
    series: vals.map((x) => ({
      id: x.party, name: partyMeta(x.party).label, type: "bar", barMaxWidth: 16, barGap: "18%",
      data: x.v.map((v, i) => ({
        value: v,
        itemStyle: { color: i === 0 ? `${C(x.party)}66` : i === 1 ? `${C(x.party)}b3` : C(x.party), borderRadius: [3, 3, 0, 0] },
      })),
      emphasis: { focus: "series" },
    })),
  }), [vals, yMax, p, reduced]);

  return (
    <div>
      <Controls>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Series</span>
        {CONTESTED.map((x) => {
          const off = prefs.share.hidden.includes(x);
          return (
            <button key={x} type="button" aria-pressed={!off}
              onClick={() => setPrefs({ ...prefs, share: { hidden: off ? prefs.share.hidden.filter((h) => h !== x) : [...prefs.share.hidden, x] } })}
              className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60",
                off ? "border-border opacity-45" : "border-transparent")}
              style={{ color: C(x) }}>
              <span className="size-2 rounded-sm" style={{ background: off ? "var(--border)" : C(x) }} />
              {partyMeta(x).short}
            </button>
          );
        })}
        <ResetChart show={dirty} onClick={() => setPrefs({ ...prefs, share: { hidden: [] } })} />
      </Controls>
      {!scope.answered2028 ? <EmptyChart /> : (
        <EChart option={option} height={330} ariaLabel={`Party share for ${scope.label}: 2018 actual, 2023 actual and 2028 survey`} reduced={reduced} replaceSeries />
      )}
      <p className="mt-1 text-[10.5px] text-muted-foreground">Bars are grouped by period; opacity separates actual results from the 2028 survey. Percentages use candidate votes + NOTA (actual) and answered 2028 questions (survey).</p>
      {showTable && (
        <DataTable caption={`Party share data for ${scope.label}`} head={["Party", "2018 actual", "2023 actual", "2028 survey", "Δ pp"]}
          rows={visible.map((x) => {
            const v = vals.find((z) => z.party === x)!.v;
            return [partyMeta(x).label, fmtPct(v[0]), fmtPct(v[1]), fmtPct(v[2]), fmtPp(v[1] !== null && v[2] !== null ? v[2] - v[1] : null)];
          })} />
      )}
    </div>
  );
}

/* ================================================================== *
 *  SEATS
 * ================================================================== */
function SeatsChart({ statewide, parties, theme, reduced, showTable }: { statewide: StatewideRow[]; parties: string[]; theme: "light" | "dark"; reduced: boolean; showTable: boolean }) {
  const p = palette(theme);
  const rows = statewide.filter((r) => (r.seats2018 > 0 || r.seats2023 > 0) && parties.includes(r.party));
  const option = useMemo(() => ({
    animation: !reduced, animationDuration: 600,
    grid: { left: 40, right: 12, top: 26, bottom: 28 },
    tooltip: {
      ...tooltipBase(p), trigger: "axis", axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const i = (params as { dataIndex: number }[])[0]?.dataIndex ?? 0;
        const r = rows[i];
        if (!r) return "";
        const d = r.seats2023 - r.seats2018;
        return `<div style="font-weight:600;margin-bottom:3px">${dot(r.party)}${partyMeta(r.party).label}</div>2018 actual <b>${r.seats2018}</b> seats<br/>2023 actual <b>${r.seats2023}</b> seats<br/>Change <b>${d > 0 ? "+" : ""}${d} seats</b>`;
      },
    },
    xAxis: { type: "category", data: rows.map((r) => partyMeta(r.party).short), axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.muted, fontSize: 10 } },
    yAxis: { type: "value", axisLabel: { color: p.muted, fontSize: 10 }, splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false } },
    series: [
      { id: "y2018", name: "2018 actual", type: "bar", barMaxWidth: 14, barGap: "18%", data: rows.map((r) => ({ value: r.seats2018, itemStyle: { color: `${C(r.party)}59`, borderRadius: [3, 3, 0, 0] } })) },
      { id: "y2023", name: "2023 actual", type: "bar", barMaxWidth: 14, data: rows.map((r) => ({ value: r.seats2023, itemStyle: { color: gradV(r.party), borderRadius: [3, 3, 0, 0] } })) },
    ],
  }), [rows, p, reduced]);

  return (
    <div>
      <Controls>
        <span className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground"><span className="h-2.5 w-4 rounded-sm bg-foreground/30" /> 2018 actual</span>
        <span className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground"><span className="h-2.5 w-4 rounded-sm bg-foreground" /> 2023 actual</span>
      </Controls>
      <EChart option={option} height={330} ariaLabel="Actual 2018 and 2023 seat comparison" reduced={reduced} />
      <p className="mt-1 text-[10.5px] text-muted-foreground">Actual statewide seat counts only. A 2028 seat projection is unavailable: survey shares are not converted into seats.</p>
      {showTable && <DataTable caption="Seat results by party" head={["Party", "2018 seats", "2023 seats", "Change"]} rows={rows.map((r) => [partyMeta(r.party).label, r.seats2018, r.seats2023, `${r.seats2023 - r.seats2018 > 0 ? "+" : ""}${r.seats2023 - r.seats2018}`])} />}
    </div>
  );
}

/* ================================================================== *
 *  SWING
 * ================================================================== */
function SwingChart({ scope, parties, prefs, setPrefs, theme, reduced, showTable }: {
  scope: ScopeData; parties: string[]; prefs: Prefs; setPrefs: (p: Prefs) => void; theme: "light" | "dark"; reduced: boolean; showTable: boolean;
}) {
  const p = palette(theme);
  const { metric, sort } = prefs.swing;
  const all = CONTESTED.filter((x) => parties.includes(x)).map((x) => {
    const a = pctOf(scope.shares2018, x), b = pctOf(scope.shares2023, x), c = pctOf(scope.shares2028, x);
    const value = metric === "actual" ? (a !== null && b !== null ? b - a : null) : (b !== null && c !== null ? c - b : null);
    return { x, a, b, c, value };
  });
  const sorted = [...all].sort((u, v) => {
    if (sort === "name") return partyMeta(u.x).label.localeCompare(partyMeta(v.x).label);
    if (sort === "decline") return (u.value ?? -999) - (v.value ?? -999);
    return (v.value ?? -999) - (u.value ?? -999);
  });
  const maxAbs = Math.max(2, ...sorted.map((r) => Math.abs(r.value ?? 0)));
  const axisMax = Math.ceil(maxAbs * 1.15 * 2) / 2;
  const dirty = metric !== "actual" || sort !== "gain";

  const option = useMemo(() => ({
    animation: !reduced, animationDuration: 600, animationEasing: "cubicOut",
    grid: { left: 104, right: 58, top: 12, bottom: 30 },
    tooltip: {
      ...tooltipBase(p), trigger: "axis", axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const i = (params as { dataIndex: number }[])[0]?.dataIndex ?? 0;
        const r = sorted[i];
        if (!r) return "";
        const ends = metric === "actual"
          ? `2018 actual <b>${fmtPct(r.a)}</b><br/>2023 actual <b>${fmtPct(r.b)}</b>`
          : `2023 actual <b>${fmtPct(r.b)}</b><br/>2028 survey <b>${fmtPct(r.c)}</b>`;
        return `<div style="font-weight:600;margin-bottom:3px">${dot(r.x)}${partyMeta(r.x).label}</div>${ends}<br/>Difference <b>${fmtPp(r.value)}</b>`;
      },
    },
    xAxis: {
      type: "value", min: -axisMax, max: axisMax, splitNumber: 4,
      axisLabel: { color: p.muted, fontSize: 9, formatter: (v: number) => `${v > 0 ? "+" : ""}${Math.abs(v) < 0.05 ? "0" : v.toFixed(1)} pp` },
      splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false },
    },
    yAxis: { type: "category", data: sorted.map((r) => partyMeta(r.x).label), inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.text, fontSize: 10.5 } },
    series: [{
      type: "bar", barMaxWidth: 16,
      data: sorted.map((r) => ({
        value: r.value,
        itemStyle: { color: gradH(r.x), borderRadius: 2 },
        label: {
          show: true, position: (r.value ?? 0) >= 0 ? "right" : "left",
          formatter: r.value === null ? "—" : `${r.value > 0 ? "+" : ""}${r.value.toFixed(2)} pp`,
          color: p.text, fontSize: 9.5, fontWeight: 600,
        },
      })),
      markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: p.axis, width: 1, type: "solid" }, data: [{ xAxis: 0 }] },
    }],
  }), [sorted, axisMax, metric, p, reduced]);

  return (
    <div>
      <Controls>
        <Segmented label="Swing comparison" value={metric} onChange={(v) => setPrefs({ ...prefs, swing: { ...prefs.swing, metric: v } })}
          options={[["actual", "2018 → 2023"], ["survey", "2023 → 2028 survey"]]} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sort</span>
        <Segmented label="Swing sort" value={sort} onChange={(v) => setPrefs({ ...prefs, swing: { ...prefs.swing, sort: v } })}
          options={[["gain", "Largest gain"], ["decline", "Largest decline"], ["name", "Party name"]]} />
        <ResetChart show={dirty} onClick={() => setPrefs({ ...prefs, swing: { metric: "actual", sort: "gain" } })} />
      </Controls>
      <EChart option={option} height={330} ariaLabel={`${metric === "actual" ? "Actual swing 2018 to 2023" : "Survey difference 2023 to 2028"} in percentage points`} reduced={reduced} />
      <p className="mt-1 text-[10.5px] text-muted-foreground">
        {metric === "actual" ? "Historical swing = actual 2023 share − actual 2018 share." : "Survey difference = 2028 scenario share − actual 2023 share; not a measured swing or voter transfer."}
        {metric === "survey" && !scope.answered2028 ? " No answered survey responses in this scope." : ""}
      </p>
      {showTable && (
        <DataTable caption="Swing data" head={["Party", "2018", "2023", "2028 survey", "2018→2023 pp", "2023→2028 pp"]}
          rows={all.map((r) => [partyMeta(r.x).label, fmtPct(r.a), fmtPct(r.b), fmtPct(r.c), fmtPp(r.a !== null && r.b !== null ? r.b - r.a : null), fmtPp(r.b !== null && r.c !== null ? r.c - r.b : null)])} />
      )}
    </div>
  );
}

/* ================================================================== *
 *  TREND
 * ================================================================== */
function TrendChart({ scope, rounds, daily, parties, prefs, setPrefs, theme, reduced, showTable }: {
  scope: ScopeData; rounds: RoundRow[]; daily: DailyRow[]; parties: string[]; prefs: Prefs; setPrefs: (p: Prefs) => void; theme: "light" | "dark"; reduced: boolean; showTable: boolean;
}) {
  const p = palette(theme);
  const { mode, zoom } = prefs.trend;
  const seriesParties = ["BRS", "INC", "BJP"].filter((x) => parties.includes(x));

  const survey = useMemo(() => {
    if (mode === "r388" || mode === "r688") {
      const batch = mode === "r388" ? 388 : 688;
      return seriesParties.map((x) => ({
        party: x,
        pts: rounds.filter((r) => r.batchSize === batch && r.party === x && r.share > 0).sort((a, b) => a.batch - b.batch)
          .map((r) => ({ date: r.to.slice(0, 10), label: `Round ${r.batch}`, value: r.share * 100 })),
      }));
    }
    const days = mode === "d7" ? 7 : mode === "d14" ? 14 : 30;
    const byDate = new Map<string, { answers: Record<string, number>; answered: number }>();
    for (const r of daily) {
      const d = byDate.get(r.date) ?? { answers: {}, answered: 0 };
      d.answers[r.party] = (d.answers[r.party] ?? 0) + r.answers;
      d.answered += r.answered;
      byDate.set(r.date, d);
    }
    const dates = [...byDate.keys()].sort();
    return seriesParties.map((x) => {
      const pts: { date: string; label: string; value: number }[] = [];
      for (let i = 0; i < dates.length; i++) {
        const start = Math.max(0, i - days + 1);
        let num = 0, den = 0;
        for (let j = start; j <= i; j++) { const d = byDate.get(dates[j])!; num += d.answers[x] ?? 0; den += d.answered; }
        if (den >= 20) pts.push({ date: dates[i], label: `${days}-day to ${dates[i]}`, value: (num / den) * 100 });
      }
      return { party: x, pts };
    });
  }, [mode, rounds, daily, seriesParties.join("|")]);

  const actual = seriesParties.map((x) => ({ party: x, y18: pctOf(scope.shares2018, x), y23: pctOf(scope.shares2023, x) }));
  const allValues = [...survey.flatMap((s) => s.pts.map((q) => q.value)), ...actual.flatMap((a) => [a.y18 ?? 0, a.y23 ?? 0])];
  const yMin = Math.max(0, Math.floor((Math.min(...allValues, 100) - 4) / 5) * 5);
  const yMax = Math.ceil((Math.max(...allValues, 0) + 4) / 5) * 5;
  const dirty = mode !== "r388" || zoom[0] !== 0 || zoom[1] !== 100;

  const option = useMemo(() => ({
    animation: !reduced, animationDuration: 600,
    grid: [
      { left: 40, width: "15%", top: 34, bottom: 40 },
      { left: "24%", right: 16, top: 34, bottom: 40 },
    ],
    tooltip: { ...tooltipBase(p), trigger: "axis", axisPointer: { type: "cross", lineStyle: { color: p.axis } } },
    title: [
      { text: "Actual", left: 40, top: 4, textStyle: { color: p.muted, fontSize: 9, fontWeight: 500 } },
      { text: "Survey · 2026 collection", left: "24%", top: 4, textStyle: { color: p.muted, fontSize: 9, fontWeight: 500 } },
    ],
    xAxis: [
      { type: "category", gridIndex: 0, data: ["’18", "’23"], axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.muted, fontSize: 9 } },
      { type: "time", gridIndex: 1, axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.muted, fontSize: 9, hideOverlap: true, formatter: "{d} {MMM}" }, splitLine: { show: false } },
    ],
    yAxis: [
      { type: "value", gridIndex: 0, min: yMin, max: yMax, axisLabel: { color: p.muted, fontSize: 9, formatter: "{value}%" }, splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false } },
      { type: "value", gridIndex: 1, min: yMin, max: yMax, axisLabel: { show: false }, splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false } },
    ],
    dataZoom: [
      { type: "inside", xAxisIndex: 1, start: zoom[0], end: zoom[1] },
      { type: "slider", xAxisIndex: 1, height: 14, bottom: 6, start: zoom[0], end: zoom[1], borderColor: p.tipBorder, backgroundColor: "transparent", fillerColor: `${C(seriesParties[0] ?? "BRS")}22`, handleStyle: { color: p.muted }, textStyle: { color: p.muted, fontSize: 8 }, dataBackground: { lineStyle: { color: p.axis }, areaStyle: { color: p.grid } } },
    ],
    series: [
      ...actual.flatMap((a) => [
        { id: `a18-${a.party}`, name: `${partyMeta(a.party).short} 2018`, type: "scatter", xAxisIndex: 0, yAxisIndex: 0, data: a.y18 !== null ? [[0, +a.y18.toFixed(2)]] : [], symbolSize: 8, itemStyle: { color: C(a.party), opacity: 0.55 } },
        { id: `a23-${a.party}`, name: `${partyMeta(a.party).short} 2023`, type: "scatter", xAxisIndex: 0, yAxisIndex: 0, data: a.y23 !== null ? [[1, +a.y23.toFixed(2)]] : [], symbolSize: 10, itemStyle: { color: C(a.party), borderColor: p.tipBg, borderWidth: 1.5 } },
      ]),
      ...survey.map((s) => ({
        id: `s-${s.party}`, name: partyMeta(s.party).label, type: "line", xAxisIndex: 1, yAxisIndex: 1, smooth: true, symbolSize: 4,
        lineStyle: { color: C(s.party), width: 2, type: "dashed" }, itemStyle: { color: C(s.party) },
        data: s.pts.map((q) => [q.date, +q.value.toFixed(2)]),
      })),
    ],
  }), [actual, survey, yMin, yMax, zoom, p, reduced, seriesParties.join("|")]);

  return (
    <div>
      <Controls>
        <Segmented label="Trend window" value={mode} onChange={(v) => setPrefs({ ...prefs, trend: { ...prefs.trend, mode: v } })}
          options={[["r388", "Rounds 388"], ["r688", "Rounds 688"], ["d7", "7-day"], ["d14", "14-day"], ["d30", "30-day"]]} />
        <ResetChart show={dirty} onClick={() => setPrefs({ ...prefs, trend: { mode: "r388", zoom: [0, 100] } })} />
        <button type="button" onClick={() => setPrefs({ ...prefs, trend: { ...prefs.trend, zoom: [0, 100] } })}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground">Reset zoom</button>
      </Controls>
      <EChart option={option} height={330} reduced={reduced}
        ariaLabel="Survey trend by 2026 collection date with separate 2018 and 2023 actual points"
        onEvents={{ dataZoom: (ev: unknown) => {
          const e = ev as { start?: number; end?: number; batch?: { start: number; end: number }[] };
          const start = Math.round(e.batch?.[0]?.start ?? e.start ?? 0);
          const end = Math.round(e.batch?.[0]?.end ?? e.end ?? 100);
          if (start === prefs.trend.zoom[0] && end === prefs.trend.zoom[1]) return;
          setPrefs({ ...prefs, trend: { ...prefs.trend, zoom: [start, end] } });
        } }} />
      <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
        Solid points are actual 2018 and 2023 results in their own panel — they are not connected to the 2026 survey.
        Dashed lines use original-entry {mode.startsWith("r") ? "rounds" : "rolling windows"}; dates are the 2026 collection period for 2028 intentions.
        Round-level collection data is supplied statewide only, so this chart is not filtered by the selected region.
      </p>
      {showTable && (
        <DataTable caption="Survey rounds and rolling values" head={["Period", ...seriesParties.map((x) => partyMeta(x).short)]}
          rows={(() => {
            const dates = [...new Set(survey.flatMap((s) => s.pts.map((q) => q.label)))];
            return dates.map((d) => [d, ...seriesParties.map((x) => {
              const pt = survey.find((s) => s.party === x)?.pts.find((q) => q.label === d);
              return pt ? `${pt.value.toFixed(2)}%` : "—";
            })]);
          })()} />
      )}
    </div>
  );
}

/* ================================================================== *
 *  ASSEMBLIES
 * ================================================================== */
function AssembliesChart({ scope, parties, prefs, setPrefs, theme, reduced, selectedAc, onSelectAc, showTable }: {
  scope: ScopeData; parties: string[]; prefs: Prefs; setPrefs: (p: Prefs) => void; theme: "light" | "dark"; reduced: boolean; selectedAc: number | null; onSelectAc: (no: number) => void; showTable: boolean;
}) {
  const p = palette(theme);
  const { metric, q } = prefs.assemblies;

  const rows = useMemo(() => {
    const mapped = scope.acs.map((a) => {
      const counts = a.a2028;
      const ranked = CONTESTED.filter((x) => parties.includes(x)).map((x) => ({ p: x, n: counts[x] ?? 0 })).sort((u, v) => v.n - u.n);
      const total28 = Object.values(counts).reduce((s, n) => s + n, 0);
      const lead = ranked[0]?.p ?? null;
      const share = total28 && lead ? (ranked[0].n / total28) * 100 : null;
      const second = total28 && ranked[1] ? (ranked[1].n / total28) * 100 : null;
      const margin = share !== null && second !== null ? share - second : null;
      const total23 = Object.values(a.v2023).reduce((s, n) => s + n, 0);
      const share23 = total23 && lead ? ((a.v2023[lead] ?? 0) / total23) * 100 : null;
      const swing = share !== null && share23 !== null ? share - share23 : null;
      return { a, lead, share, margin, swing, share23, answered: a.answered2028 };
    });
    const needle = q.trim().toLowerCase();
    const filtered = mapped.filter((r) => !needle || r.a.name.toLowerCase().includes(needle) || r.a.group.toLowerCase().includes(needle) || String(r.a.no) === needle);
    const sorted = filtered.sort((u, v) => ((v[metric] ?? -999) as number) - ((u[metric] ?? -999) as number));
    const withSelected = selectedAc != null ? mapped.find((r) => r.a.no === selectedAc) : undefined;
    const top = sorted.slice(0, 14);
    if (withSelected && !top.some((r) => r.a.no === withSelected.a.no)) top.unshift(withSelected);
    return top;
  }, [scope, parties, q, metric, selectedAc]);

  const dirty = metric !== "share" || q.trim() !== "";

  const option = useMemo(() => {
    const labels = rows.map((r) => `${r.a.no}. ${r.a.name}`);
    const max = Math.max(1, ...rows.map((r) => (r[metric] ?? 0) as number));
    return {
      animation: !reduced, animationDuration: 600,
      grid: { left: 132, right: 46, top: 10, bottom: 26 },
      tooltip: {
        ...tooltipBase(p), trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const i = (params as { dataIndex: number }[])[0]?.dataIndex ?? 0;
          const r = rows[i];
          if (!r) return "";
          return `<div style="font-weight:600;margin-bottom:2px">${r.a.no}. ${r.a.name}</div><span style="opacity:.7">${r.a.group}</span><br/>` +
            `Lead 2028 ${r.lead ? `<b>${partyMeta(r.lead).label} ${fmtPct(r.share)}</b>` : "—"}<br/>Lead margin <b>${fmtPp(r.margin, 1)}</b><br/>` +
            `2023 actual (same party) <b>${fmtPct(r.share23)}</b><br/>Survey change <b>${fmtPp(r.swing, 1)}</b>`;
        },
      },
      xAxis: { type: "value", max: Math.ceil(max + 4), axisLabel: { color: p.muted, fontSize: 9 }, splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: { type: "category", data: labels, inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.text, fontSize: 9.5, width: 120, overflow: "truncate" } },
      series: [{
        type: "bar", barMaxWidth: 14,
        data: rows.map((r) => ({
          value: r[metric] === null ? null : +(r[metric] as number).toFixed(2),
          itemStyle: { color: r.lead ? gradH(r.lead) : p.axis, borderRadius: 2, opacity: selectedAc != null && r.a.no !== selectedAc ? 0.55 : 1 },
          label: { show: true, position: "right", color: p.text, fontSize: 9.5, formatter: r[metric] === null ? "—" : `${(r[metric] as number).toFixed(1)}${metric === "margin" || metric === "swing" ? " pp" : "%"}` },
        })),
      }],
    };
  }, [rows, metric, selectedAc, p, reduced]);

  return (
    <div>
      <Controls>
        <label className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px]">
          <Search className="size-3 text-muted-foreground" />
          <input value={q} onChange={(e) => setPrefs({ ...prefs, assemblies: { ...prefs.assemblies, q: e.target.value } })}
            placeholder="Search assembly or group" className="w-40 bg-transparent outline-none" aria-label="Search assemblies" />
        </label>
        <Segmented label="Assembly ranking" value={metric} onChange={(v) => setPrefs({ ...prefs, assemblies: { ...prefs.assemblies, metric: v } })}
          options={[["share", "Party share"], ["margin", "Lead margin"], ["swing", "Survey change"]]} />
        <ResetChart show={dirty} onClick={() => setPrefs({ ...prefs, assemblies: { metric: "share", q: "" } })} />
      </Controls>
      <EChart option={option} height={330} reduced={reduced} ariaLabel="Interactive assembly ranking. Click a bar to select that assembly."
        onEvents={{ click: (ev: unknown) => {
          const e = ev as { dataIndex?: number };
          const r = rows[e.dataIndex ?? -1];
          if (r) onSelectAc(r.a.no);
        } }} />
      {!rows.length && <EmptyChart text="No assemblies match the current search." />}
      <p className="mt-1 text-[10.5px] text-muted-foreground">Ranked by {metric === "share" ? "2028 lead share" : metric === "margin" ? "2028 lead margin (pp)" : "survey change vs 2023 (pp)"}. Click a bar to select that assembly on the map; historical values are that assembly&apos;s own, never statewide substitutes.</p>
      {showTable && (
        <DataTable caption="Assembly comparison" head={["Assembly", "Lead", "2028", "Margin", "2023", "Change"]}
          rows={rows.map((r) => [`${r.a.no}. ${r.a.name}`, r.lead ? partyMeta(r.lead).short : "—", fmtPct(r.share), fmtPp(r.margin, 1), fmtPct(r.share23), fmtPp(r.swing, 1)])} />
      )}
    </div>
  );
}

/* ================================================================== *
 *  DEVICES
 * ================================================================== */
function DevicesChart({ scope, prefs, setPrefs, theme, reduced, showTable }: {
  scope: ScopeData; prefs: Prefs; setPrefs: (p: Prefs) => void; theme: "light" | "dark"; reduced: boolean; showTable: boolean;
}) {
  const p = palette(theme);
  const all = Object.entries(scope.device).sort((a, b) => b[1] - a[1]);
  const rows = all.slice(0, 11);
  const base = scope.deviceTotal;
  const active = prefs.devices.brand;

  const option = useMemo(() => ({
    animation: !reduced, animationDuration: 600,
    grid: { left: 104, right: 48, top: 8, bottom: 24 },
    tooltip: {
      ...tooltipBase(p), trigger: "axis", axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const i = (params as { dataIndex: number }[])[0]?.dataIndex ?? 0;
        const pair = rows[i];
        if (!pair) return "";
        const [brand, n] = pair;
        return `<div style="font-weight:600;margin-bottom:2px">${brand}</div>${((n / base) * 100).toFixed(2)}% of ${fmtInt(base)} original-entry device records in this scope.`;
      },
    },
    xAxis: { type: "value", axisLabel: { color: p.muted, fontSize: 9, formatter: "{value}%" }, splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false } },
    yAxis: { type: "category", data: rows.map(([b]) => b), inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.text, fontSize: 9.5, width: 92, overflow: "truncate" } },
    series: [{
      type: "bar", barMaxWidth: 14,
      data: rows.map(([b, n]) => ({
        value: +((n / base) * 100).toFixed(2),
        itemStyle: { color: { type: "linear", x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: "#64748b" }, { offset: 1, color: "#94a3b8" }] }, borderRadius: 2, opacity: active && active !== b ? 0.35 : 1 },
        label: { show: true, position: "right", color: p.text, fontSize: 9.5, formatter: `${((n / base) * 100).toFixed(2)}%` },
      })),
    }],
  }), [rows, base, active, p, reduced]);

  return (
    <div>
      <Controls>
        {active && <FilterChip label={`Brand: ${active}`} onRemove={() => setPrefs({ ...prefs, devices: { brand: null } })} />}
        <span className="text-[10.5px] text-muted-foreground">Click a bar to highlight that brand.</span>
        <ResetChart show={!!active} onClick={() => setPrefs({ ...prefs, devices: { brand: null } })} />
      </Controls>
      <EChart option={option} height={330} reduced={reduced} ariaLabel="Device brand composition, percentages of original-entry device metadata"
        onEvents={{ click: (ev: unknown) => {
          const e = ev as { dataIndex?: number };
          const b = rows[e.dataIndex ?? -1]?.[0];
          if (b) setPrefs({ ...prefs, devices: { brand: active === b ? null : b } });
        } }} />
      {!base && <EmptyChart text="No device metadata in this scope." />}
      <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
        Percentage base: {fmtInt(base)} original-entry device records in this scope. Replicated scenario rows never create additional devices; brands are observed/predicted metadata, not verified handsets.
      </p>
      {showTable && <DataTable caption="Device mix" head={["Brand", "Entries", "Share"]} rows={all.map(([b, n]) => [b, fmtInt(n), fmtPct((n / base) * 100)])} />}
    </div>
  );
}

/* ================================================================== *
 *  AGE
 * ================================================================== */
function AgeChart({ age, parties, prefs, setPrefs, theme, reduced, showTable }: {
  age: AgeRow[]; parties: string[]; prefs: Prefs; setPrefs: (p: Prefs) => void; theme: "light" | "dark"; reduced: boolean; showTable: boolean;
}) {
  const p = palette(theme);
  const rows = age.filter((r) => r.answered > 0);
  const show = CONTESTED.filter((x) => parties.includes(x));
  const active = prefs.age.party;

  const option = useMemo(() => ({
    animation: !reduced, animationDuration: 600,
    grid: { left: 36, right: 12, top: 24, bottom: 28 },
    tooltip: {
      ...tooltipBase(p), trigger: "axis", axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const i = (params as { dataIndex: number }[])[0]?.dataIndex ?? 0;
        const r = rows[i];
        if (!r) return "";
        return `<div style="font-weight:600;margin-bottom:2px">${r.band === "(missing)" ? "Age not supplied" : r.band}</div>` +
          `<div style="opacity:.7;margin-bottom:3px">${fmtInt(r.answered)} answered</div>` +
          show.map((x) => `<div style="display:flex;align-items:center;gap:4px">${dot(x)}<span>${partyMeta(x).label}</span><b style="margin-left:auto;padding-left:10px">${(((r.parties[x] ?? 0) / r.answered) * 100).toFixed(2)}%</b></div>`).join("");
      },
    },
    xAxis: { type: "category", data: rows.map((r) => (r.band === "(missing)" ? "No age" : r.band)), axisTick: { show: false }, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.muted, fontSize: 9.5 } },
    yAxis: { type: "value", max: 100, axisLabel: { color: p.muted, fontSize: 9, formatter: "{value}%" }, splitLine: { lineStyle: { color: p.grid } }, axisLine: { show: false }, axisTick: { show: false } },
    series: show.map((x) => ({
      id: x, name: partyMeta(x).label, type: "bar", stack: "age", barMaxWidth: 34,
      itemStyle: { color: C(x), opacity: active && active !== x ? 0.3 : 1 },
      emphasis: { focus: "series" },
      data: rows.map((r) => +(((r.parties[x] ?? 0) / r.answered) * 100).toFixed(2)),
    })),
  }), [rows, show.join("|"), active, p, reduced]);

  return (
    <div>
      <Controls>
        {active && <FilterChip label={`Party: ${partyMeta(active).label}`} onRemove={() => setPrefs({ ...prefs, age: { party: null } })} />}
        <span className="text-[10.5px] text-muted-foreground">Click a segment to highlight that party. Base is answered 2028 rows per age band.</span>
        <ResetChart show={!!active} onClick={() => setPrefs({ ...prefs, age: { party: null } })} />
      </Controls>
      <EChart option={option} height={330} reduced={reduced} ariaLabel="Party share by age band, 100% stacked"
        onEvents={{ click: (ev: unknown) => {
          const e = ev as { seriesName?: string };
          const found = CONTESTED.find((x) => partyMeta(x).label === e.seriesName);
          if (found) setPrefs({ ...prefs, age: { party: active === found ? null : found } });
        } }} />
      {!rows.length && <EmptyChart text="No answered age data in this scope." />}
      <p className="mt-1 text-[10.5px] text-muted-foreground">Missing ages are kept as their own band and never redistributed. Clicking a segment only filters this chart.</p>
      {showTable && (
        <DataTable caption="Age group party shares" head={["Age band", "Answered", ...show.map((x) => partyMeta(x).short)]}
          rows={rows.map((r) => [r.band === "(missing)" ? "No age" : r.band, fmtInt(r.answered), ...show.map((x) => fmtPct(((r.parties[x] ?? 0) / r.answered) * 100))])} />
      )}
    </div>
  );
}

/* ================================================================== *
 *  Container
 * ================================================================== */
export default function TelanganaAnalysis({
  scope, age, rounds, daily, statewide, chart, onChart, parties, onParties, selectedAc, onSelectAc, status, theme,
}: {
  scope: ScopeData;
  age: AgeRow[];
  rounds: RoundRow[];
  daily: DailyRow[];
  statewide: StatewideRow[];
  chart: ChartId;
  onChart: (id: ChartId) => void;
  parties: string[];
  onParties: (p: string[]) => void;
  selectedAc: number | null;
  onSelectAc: (no: number) => void;
  status: ChartStatus;
  theme: "light" | "dark";
}) {
  const active = CHARTS.find((c) => c.id === chart) ?? CHARTS[0];
  const reduced = usePrefersReducedMotion();
  const [full, setFull] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  const height = full ? 540 : 330;

  return (
    <section aria-label="Telangana analysis"
      className={cn("scroll-mt-24 rounded-2xl border border-border bg-card", full && "fixed inset-2 z-[70] flex flex-col overflow-auto shadow-2xl sm:inset-4")}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Selected region</p>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px]", status.error ? "border-rose-500/30 text-rose-600 dark:text-rose-400" : "border-border text-muted-foreground", status.flash && "ring-2 ring-emerald-500/25")}>
              <span className={cn("size-1.5 rounded-full", status.updating ? "soft-pulse bg-saffron" : status.error ? "bg-rose-500" : "bg-emerald-500")} />
              {status.updating ? "Updating…" : status.error ? "Refresh failed" : "Survey insights"}
            </span>
            <button type="button" onClick={status.onRefresh} disabled={status.updating} aria-label="Refresh aggregates"
              className="grid size-6 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
              <RefreshCw className={cn("size-3", status.updating && "animate-spin")} />
            </button>
            {status.lastRefreshed && <span className="text-[10px] text-muted-foreground">refreshed {status.lastRefreshed}</span>}
          </div>
          <h2 className="mt-0.5 truncate font-display text-xl font-semibold leading-tight">{scope.label}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Parties</span>
          {CONTESTED.map((x) => {
            const on = parties.includes(x);
            return (
              <button key={x} type="button" onClick={() => onParties(on ? parties.filter((y) => y !== x) : [...parties, x])} aria-pressed={on}
                className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-saffron/60"
                style={on ? { borderColor: `${C(x)}99`, color: C(x), background: `${C(x)}16` } : { borderColor: "transparent", color: "var(--muted-foreground)", opacity: 0.65 }}>
                <span className="size-2 rounded-sm" style={{ background: on ? C(x) : "var(--border)" }} />
                {partyMeta(x).short}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 sm:px-5" role="tablist" aria-label="Chart selector">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">View</span>
        {CHARTS.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={chart === c.id} onClick={() => onChart(c.id)}
            className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60",
              chart === c.id ? "border-saffron/60 bg-saffron/15 text-saffron-2" : "border-border text-muted-foreground hover:text-foreground")}>
            {c.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <TableToggle open={showTable} onToggle={() => setShowTable((v) => !v)} />
          <button type="button" onClick={() => setFull((v) => !v)} aria-pressed={full}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
            {full ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}{full ? "Exit" : "Full screen"}
          </button>
        </div>
      </div>

      <div className={cn("h-[440px] p-4 sm:p-5", full && "h-auto flex-1")}>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 className="font-display text-[13px] font-semibold">{active.label}</h3>
          <p className="text-[10.5px] text-muted-foreground">{active.note}</p>
        </div>
        <div className="h-[392px] overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={chart} data-chart-body className="h-full"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: reduced ? 0 : 0.22, ease: [0.2, 0.7, 0.2, 1] }}>
              {chart === "share" && <ShareChart scope={scope} parties={parties} prefs={prefs} setPrefs={setPrefs} theme={theme} reduced={reduced} showTable={showTable} />}
              {chart === "seats" && <SeatsChart statewide={statewide} parties={parties} theme={theme} reduced={reduced} showTable={showTable} />}
              {chart === "swing" && <SwingChart scope={scope} parties={parties} prefs={prefs} setPrefs={setPrefs} theme={theme} reduced={reduced} showTable={showTable} />}
              {chart === "trend" && <TrendChart scope={scope} rounds={rounds} daily={daily} parties={parties} prefs={prefs} setPrefs={setPrefs} theme={theme} reduced={reduced} showTable={showTable} />}
              {chart === "assemblies" && <AssembliesChart scope={scope} parties={parties} prefs={prefs} setPrefs={setPrefs} theme={theme} reduced={reduced} selectedAc={selectedAc} onSelectAc={onSelectAc} showTable={showTable} />}
              {chart === "devices" && <DevicesChart scope={scope} prefs={prefs} setPrefs={setPrefs} theme={theme} reduced={reduced} showTable={showTable} />}
              {chart === "age" && <AgeChart age={age} parties={parties} prefs={prefs} setPrefs={setPrefs} theme={theme} reduced={reduced} showTable={showTable} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
