"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, RefreshCw, Search } from "lucide-react";
import { partyMeta } from "@/lib/telangana/parties";
import { brandMarker } from "@/lib/telangana/brands";
import {
  fmtPct, fmtPp,
  type AgeRow, type AcRecord, type Counts, type DailyRow, type PartyShare, type RoundRow, type StatewideRow,
} from "@/lib/telangana/model";
import { useAnimatedNumbers, useChartProgress, useEnterOnce, useMeasuredWidth, usePrefersReducedMotion, clampP } from "./chart-motion";
import { cn } from "@/lib/utils";

export type ChartId = "share" | "seats" | "vote" | "swing" | "survey" | "trend" | "assemblies" | "devices" | "age";

export const CHARTS: { id: ChartId; label: string; note: string }[] = [
  { id: "share", label: "Party share", note: "2028 survey scenario · answered questions" },
  { id: "seats", label: "Seats", note: "Actual 2018 and 2023 results · statewide" },
  { id: "vote", label: "Vote share 2018 → 2023", note: "Actual results · candidate votes + NOTA" },
  { id: "swing", label: "Swing 2018 → 2023", note: "Actual result swing · percentage points" },
  { id: "survey", label: "2028 survey", note: "Survey scenario against actual 2023" },
  { id: "trend", label: "Trend", note: "Original entries · 2026 collection dates" },
  { id: "assemblies", label: "Assemblies", note: "Searchable assembly comparison" },
  { id: "devices", label: "Devices", note: "Original-entry device metadata" },
  { id: "age", label: "Age groups", note: "Answered 2028 questions by supplied age" },
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

const CONTESTED = ["BRS", "INC", "BJP", "AIMIM", "TDP", "JSP", "Others"];
const C = (p: string) => partyMeta(p).color;
const grad = (p: string) => `linear-gradient(90deg, ${C(p)} 0%, ${C(p)}c9 100%)`;
const pctOf = (s: PartyShare[], p: string) => s.find((x) => x.party === p)?.share ?? null;
const sortedParties = (vals: { party: string; value: number | null }[]) =>
  [...vals].sort((a, b) => (b.value ?? -1) - (a.value ?? -1)).map((v) => v.party);

type TipRow = { label: string; value: string; color?: string };
type TipData = { x: number; y: number; title: string; rows: TipRow[] };

function makeTip(clientX: number, clientY: number, title: string, rows: TipRow[]): TipData {
  const w = typeof window !== "undefined" ? window.innerWidth : 1200;
  const h = typeof window !== "undefined" ? window.innerHeight : 800;
  return { x: Math.min(clientX + 14, w - 228), y: Math.min(clientY + 14, h - 150), title, rows };
}
function Tip({ tip }: { tip: TipData | null }) {
  if (!tip) return null;
  return (
    <div role="tooltip" className="chart-tip pointer-events-none fixed z-[80] w-max max-w-[216px] rounded-lg border border-border bg-card/95 px-2.5 py-1.5 shadow-lg backdrop-blur">
      <p className="text-[11.5px] font-semibold leading-tight">{tip.title}</p>
      {tip.rows.map((r) => (
        <p key={r.label} className="mt-0.5 flex items-center gap-1.5 text-[10px] leading-tight text-muted-foreground">
          {r.color && <span className="size-1.5 shrink-0 rounded-sm" style={{ background: r.color }} />}
          <span className="truncate">{r.label}</span>
          <b className="ml-auto shrink-0 tabular-nums text-foreground/85">{r.value}</b>
        </p>
      ))}
    </div>
  );
}

type Motion = { animate: boolean; initialZero: boolean; grown: boolean; reduced: boolean };

/** Entrance-once wrapper: charts animate when first seen, never on small scrolls. */
function ChartShell({ id, children }: { id: string; children: (m: Motion) => React.ReactNode }) {
  const reduced = usePrefersReducedMotion();
  const { ref, entered, already } = useEnterOnce(id);
  const m: Motion = {
    animate: entered && !already && !reduced,
    initialZero: !already && !reduced,
    grown: entered || reduced,
    reduced,
  };
  return <div ref={ref}>{children(m)}</div>;
}

function Empty({ text = "No answered survey responses in this scope." }: { text?: string }) {
  return <div className="grid h-[300px] place-items-center text-center text-[12px] text-muted-foreground">{text}</div>;
}

/* ================================================================== *
 *  Row hover/focus helper
 * ================================================================== */
function useRowTip() {
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<TipData | null>(null);
  const enter = (e: React.MouseEvent | React.FocusEvent, key: string, title: string, rows: TipRow[]) => {
    setHover(key);
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const cx = "clientX" in e ? (e as React.MouseEvent).clientX : r.left + r.width * 0.65;
    const cy = "clientY" in e ? (e as React.MouseEvent).clientY : r.top + r.height / 2;
    setTip(makeTip(cx, cy, title, rows));
  };
  const leave = () => { setHover(null); setTip(null); };
  const esc = (e: React.KeyboardEvent) => { if (e.key === "Escape") leave(); };
  return { hover, tip, enter, leave, esc, setHover };
}

/* ================================================================== *
 *  Party share — animated horizontal bars with direct labels
 * ================================================================== */
function PartyShareChart({ scope, parties, m }: { scope: ScopeData; parties: string[]; m: Motion }) {
  const { hover, tip, enter, leave, esc } = useRowTip();
  const rows = scope.shares2028.filter((s) => s.party !== "NOTA" && parties.includes(s.party));
  if (!scope.answered2028 || !rows.length) return <Empty />;
  const max = Math.max(60, Math.ceil((Math.max(...rows.map((r) => r.share ?? 0)) + 4) / 10) * 10);
  const ticks = [0, max / 2, max];
  const vals = useAnimatedNumbers(rows.map((r) => r.share ?? 0), m.animate, m.initialZero);
  const lead = rows[0]?.party;

  return (
    <div>
      <div className="relative ml-[88px] mr-[96px] mt-8 h-[300px] sm:ml-[112px] sm:mr-[128px]">
        {ticks.map((t) => (
          <div key={t} className="absolute inset-y-0" style={{ left: `${(t / max) * 100}%` }}>
            <div className="h-full w-px bg-border/70" />
            <span className="absolute -top-5 -translate-x-1/2 text-[9.5px] tabular-nums text-muted-foreground">{Math.round(t)}%</span>
          </div>
        ))}
        <div className="absolute inset-0 flex flex-col justify-around">
          {rows.map((s, i) => {
            const s23 = pctOf(scope.shares2023, s.party);
            const diff = s.count > 0 && s.share !== null && s23 !== null ? s.share - s23 : null;
            return (
              <div
                key={s.party}
                tabIndex={0}
                role="group"
                aria-label={`${partyMeta(s.party).label}: ${fmtPct(s.share)} in 2028${diff !== null ? `, ${fmtPp(diff)} versus 2023` : ""}`}
                onMouseEnter={(e) => enter(e, s.party, partyMeta(s.party).label, [
                  { label: "2028 survey", value: s.count === 0 ? "not recorded" : fmtPct(s.share), color: C(s.party) },
                  ...(diff !== null ? [{ label: "vs 2023", value: fmtPp(diff) }] : []),
                ])}
                onMouseLeave={leave}
                onFocus={(e) => enter(e, s.party, partyMeta(s.party).label, [
                  { label: "2028 survey", value: s.count === 0 ? "not recorded" : fmtPct(s.share), color: C(s.party) },
                  ...(diff !== null ? [{ label: "vs 2023", value: fmtPp(diff) }] : []),
                ])}
                onBlur={leave}
                onKeyDown={esc}
                className="chart-row relative flex cursor-default items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-saffron/60"
                style={{ opacity: hover && hover !== s.party ? 0.45 : 1 }}
              >
                <span className="absolute right-full mr-2 flex w-[84px] items-center justify-end gap-1.5 text-[11.5px] font-medium sm:w-[104px] sm:text-[12px]">
                  {s.party === lead && <span className="rounded-full bg-saffron/20 px-1 py-px text-[7.5px] font-bold uppercase tracking-wide text-saffron-2">lead</span>}
                  {partyMeta(s.party).label}
                  <span className="size-2 shrink-0 rounded-sm" style={{ background: C(s.party) }} />
                </span>
                <div className="relative h-4 flex-1">
                  {s.count === 0 ? (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">not recorded</span>
                  ) : (
                    <span
                      className="chart-bar absolute inset-y-0 left-0 rounded-r-sm shadow-[0_0_16px_-6px_rgba(0,0,0,.5)]"
                      style={{ width: m.grown ? `${((s.share ?? 0) / max) * 100}%` : "0%", background: grad(s.party), transitionDelay: `${i * 42}ms` }}
                    />
                  )}
                </div>
                <span className="absolute left-full ml-2 flex w-[96px] items-baseline gap-1 whitespace-nowrap text-[11px] tabular-nums sm:w-[118px] sm:gap-1.5 sm:text-[11.5px]">
                  <b className="text-[13px]">{s.count === 0 ? "—" : fmtPct(vals[i] ?? 0)}</b>
                  {diff !== null && <span className={cn("text-[10px]", diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{fmtPp(diff)}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
        The pp figure is the survey difference vs actual 2023 — not a measured swing. Denominator counts are in About this data.
      </p>
      <Tip tip={tip} />
    </div>
  );
}

/* ================================================================== *
 *  Seats — animated actual comparison only
 * ================================================================== */
function SeatsChart({ statewide, parties, m }: { statewide: StatewideRow[]; parties: string[]; m: Motion }) {
  const { hover, tip, enter, leave, esc } = useRowTip();
  const rows = statewide.filter((r) => (r.seats2018 > 0 || r.seats2023 > 0) && parties.includes(r.party)).sort((a, b) => b.seats2023 - a.seats2023);
  if (!rows.length) return <Empty text="No seat results in the supplied tables." />;
  const max = Math.max(...rows.flatMap((r) => [r.seats2018, r.seats2023]), 1);
  const vals = useAnimatedNumbers(rows.flatMap((r) => [r.seats2018, r.seats2023]), m.animate, m.initialZero);
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-[10.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-foreground/30" /> 2018 actual</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-foreground" /> 2023 actual</span>
      </div>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div
            key={r.party}
            tabIndex={0}
            role="group"
            aria-label={`${partyMeta(r.party).label}: 2018 ${r.seats2018} seats, 2023 ${r.seats2023} seats`}
            onMouseEnter={(e) => enter(e, r.party, partyMeta(r.party).label, [
              { label: "2018 actual", value: `${r.seats2018} seats` },
              { label: "2023 actual", value: `${r.seats2023} seats`, color: C(r.party) },
              { label: "Change", value: `${r.seats2023 - r.seats2018 > 0 ? "+" : ""}${r.seats2023 - r.seats2018} seats` },
            ])}
            onMouseLeave={leave}
            onFocus={(e) => enter(e, r.party, partyMeta(r.party).label, [
              { label: "2018 actual", value: `${r.seats2018} seats` },
              { label: "2023 actual", value: `${r.seats2023} seats`, color: C(r.party) },
              { label: "Change", value: `${r.seats2023 - r.seats2018 > 0 ? "+" : ""}${r.seats2023 - r.seats2018} seats` },
            ])}
            onBlur={leave}
            onKeyDown={esc}
            className="chart-row grid cursor-default grid-cols-[104px_minmax(0,1fr)_92px] items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-saffron/60"
            style={{ opacity: hover && hover !== r.party ? 0.45 : 1 }}
          >
            <span className="text-[12px] font-medium">{partyMeta(r.party).label}</span>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="chart-bar h-2.5 rounded-sm bg-foreground/25" style={{ width: m.grown ? `${(r.seats2018 / max) * 100}%` : "0%", transitionDelay: `${i * 42}ms` }} />
                <span className="text-[10px] tabular-nums text-muted-foreground">{Math.round(vals[i * 2] ?? 0)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="chart-bar h-2.5 rounded-sm" style={{ width: m.grown ? `${(r.seats2023 / max) * 100}%` : "0%", background: grad(r.party), transitionDelay: `${i * 42 + 40}ms` }} />
                <span className="text-[10px] tabular-nums text-foreground/80">{Math.round(vals[i * 2 + 1] ?? 0)}</span>
              </div>
            </div>
            <span className={cn("whitespace-nowrap text-right text-[11px] tabular-nums font-medium", r.seats2023 - r.seats2018 >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {r.seats2023 - r.seats2018 > 0 ? "+" : ""}{r.seats2023 - r.seats2018} seats
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-lg bg-muted/30 px-2.5 py-2 text-[10.5px] leading-relaxed text-muted-foreground">
        Actual statewide 2018 and 2023 seat counts from the supplied result tables. A 2028 seat projection is
        <b className="text-foreground/80"> unavailable</b>: no supported seat model is supplied and survey shares are not converted into seats.
      </p>
      <Tip tip={tip} />
    </div>
  );
}

/* ================================================================== *
 *  Vote share 2018 → 2023 — animated slope chart
 * ================================================================== */
function VoteShareChart({ scope, parties, m }: { scope: ScopeData; parties: string[]; m: Motion }) {
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<TipData | null>(null);
  const p = useChartProgress(m.animate);
  const { ref: boxRef, width: W } = useMeasuredWidth(660);
  const rows = CONTESTED.filter((x) => parties.includes(x)).map((x) => ({ p: x, a: pctOf(scope.shares2018, x), b: pctOf(scope.shares2023, x) }))
    .filter((r) => r.a !== null || r.b !== null);
  if (!rows.length) return <Empty />;

  const H = 300, padL = 118, padR = 118, padT = 34, padB = 26;
  const max = Math.max(10, Math.ceil((Math.max(...rows.flatMap((r) => [r.a ?? 0, r.b ?? 0])) + 4) / 10) * 10);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const x0 = padL, x1 = W - padR;
  const lineP = clampP((p - 0.15) / 0.7);
  const showLeft = p > 0.02, showRight = p > 0.55, showLabels = p > 0.7;

  const place = (items: { p: string; v: number; y: number }[]) => {
    const sorted = [...items].sort((a, b) => a.y - b.y);
    let last = -Infinity;
    return sorted.map((it) => { const labelY = Math.max(it.y, last + 12); last = labelY; return { ...it, labelY }; });
  };
  const left = place(rows.filter((r) => r.a !== null).map((r) => ({ p: r.p, v: r.a!, y: y(r.a!) })));
  const right = place(rows.filter((r) => r.b !== null).map((r) => ({ p: r.p, v: r.b!, y: y(r.b!) })));

  const showTip = (e: React.MouseEvent | React.FocusEvent, r: { p: string; a: number | null; b: number | null }) => {
    setHover(r.p);
    const el = e.currentTarget as HTMLElement;
    const box = el.getBoundingClientRect();
    const cx = "clientX" in e ? (e as React.MouseEvent).clientX : box.left + box.width / 2;
    const cy = "clientY" in e ? (e as React.MouseEvent).clientY : box.top + box.height / 2;
    setTip(makeTip(cx, cy, partyMeta(r.p).label, [
      { label: "2018 actual", value: fmtPct(r.a) },
      { label: "2023 actual", value: fmtPct(r.b), color: C(r.p) },
      ...(r.a !== null && r.b !== null ? [{ label: "Swing", value: fmtPp(r.b - r.a) }] : []),
    ]));
  };

  return (
    <div ref={boxRef}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Vote share 2018 to 2023 actual results">
        {[0, max / 2, max].map((t) => (
          <line key={t} x1={padL - 10} x2={W - padR + 10} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.07} />
        ))}
        <text x={x0} y={16} textAnchor="middle" fontSize="10" fontWeight="600" fill="currentColor" opacity={0.2 + 0.5 * p}>2018 actual</text>
        <text x={x1} y={16} textAnchor="middle" fontSize="10" fontWeight="600" fill="currentColor" opacity={showRight ? 0.7 : 0.2}>2023 actual</text>
        {rows.map((r) => {
          const ya = r.a !== null ? y(r.a) : null, yb = r.b !== null ? y(r.b) : null;
          const dim = hover && hover !== r.p;
          return (
            <g key={r.p} opacity={dim ? 0.32 : 1} style={{ transition: "opacity 180ms ease" }}>
              {ya !== null && yb !== null && (
                <line x1={x0} y1={ya} x2={x1} y2={yb} stroke={C(r.p)} strokeWidth={hover === r.p ? 3 : 2} strokeOpacity={0.85}
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1 - lineP} strokeLinecap="round" />
              )}
              {ya !== null && <circle cx={x0} cy={ya} r="3.6" fill={C(r.p)} opacity={showLeft ? 1 : 0} style={{ transition: "opacity 220ms ease" }} />}
              {yb !== null && <circle cx={x1} cy={yb} r="3.6" fill={C(r.p)} opacity={showRight ? 1 : 0} style={{ transition: "opacity 220ms ease" }} />}
            </g>
          );
        })}
        {left.map((it) => (
          <g key={`l-${it.p}`} opacity={showLabels ? (hover && hover !== it.p ? 0.3 : 0.85) : 0} style={{ transition: "opacity 220ms ease" }}>
            {Math.abs(it.labelY - it.y) > 1 && <line x1={x0 - 4} y1={it.y} x2={x0 - 8} y2={it.labelY} stroke={C(it.p)} strokeOpacity="0.5" strokeWidth="0.8" />}
            <text x={x0 - 10} y={it.labelY + 3} textAnchor="end" fontSize="9.5" fill="currentColor">{it.v.toFixed(1)}%</text>
          </g>
        ))}
        {right.map((it) => (
          <g key={`r-${it.p}`} opacity={showLabels ? (hover && hover !== it.p ? 0.3 : 0.9) : 0} style={{ transition: "opacity 220ms ease" }}>
            {Math.abs(it.labelY - it.y) > 1 && <line x1={x1 + 4} y1={it.y} x2={x1 + 8} y2={it.labelY} stroke={C(it.p)} strokeOpacity="0.5" strokeWidth="0.8" />}
            <text x={x1 + 10} y={it.labelY + 3} fontSize="9.5" fill="currentColor">{it.v.toFixed(1)}%</text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <button key={r.p} type="button" onMouseEnter={(e) => showTip(e, r)} onMouseLeave={() => { setHover(null); setTip(null); }}
            onFocus={(e) => showTip(e, r)} onBlur={() => { setHover(null); setTip(null); }}
            aria-label={`${partyMeta(r.p).label}: 2018 ${fmtPct(r.a)}, 2023 ${fmtPct(r.b)}`}
            className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-saffron/60"
            style={hover === r.p ? { borderColor: `${C(r.p)}99`, color: C(r.p), background: `${C(r.p)}14` } : undefined}>
            <span className="size-2 rounded-sm" style={{ background: C(r.p) }} />
            {partyMeta(r.p).short}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[10.5px] text-muted-foreground">Actual results only. Shares use candidate votes plus NOTA in the same scope.</p>
      <Tip tip={tip} />
    </div>
  );
}

/* ================================================================== *
 *  Diverging bars (Swing + 2028 difference)
 * ================================================================== */
function Diverging({ values, unit, note, m }: { values: { party: string; value: number | null }[]; unit: "pp" | "share"; note: string; m: Motion }) {
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<TipData | null>(null);
  const { ref: boxRef, width: W } = useMeasuredWidth(660);
  const maxAbs = Math.max(2, ...values.map((v) => Math.abs(v.value ?? 0)));
  const ticks = [-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs];
  const H = 288, padL = 110, padR = 66, padT = 26, padB = 20;
  const zero = padL + (W - padL - padR) / 2;
  const scale = (W - padL - padR) / 2 / maxAbs;
  const rowH = (H - padT - padB) / Math.max(1, values.length);
  const vals = useAnimatedNumbers(values.map((v) => v.value ?? 0), m.animate, m.initialZero);

  return (
    <div ref={boxRef}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={unit === "pp" ? "Swing in percentage points" : "Share in percent"}>
        {ticks.map((t) => (
          <g key={t} opacity={hover ? 0.6 : 1} style={{ transition: "opacity 180ms ease" }}>
            <line x1={zero + t * scale} x2={zero + t * scale} y1={padT - 6} y2={H - padB} stroke="currentColor" strokeOpacity={t === 0 ? 0.35 : 0.08} strokeWidth={t === 0 ? 1.2 : 1} />
            <text x={zero + t * scale} y={H - 6} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.5">{t > 0 ? "+" : ""}{Number.isInteger(t) ? t : t.toFixed(1)}{unit === "pp" ? " pp" : "%"}</text>
          </g>
        ))}
        {values.map((v, i) => {
          const cy = padT + rowH * i + rowH / 2;
          const value = vals[i] ?? 0;
          const w = Math.abs(value) * scale;
          const gain = value >= 0;
          const final = v.value;
          return (
            <g key={v.party} opacity={hover && hover !== v.party ? 0.38 : 1} style={{ transition: "opacity 180ms ease" }}>
              <rect x={0} y={cy - rowH / 2} width={W} height={rowH} fill="transparent" tabIndex={0} role="group"
                aria-label={`${partyMeta(v.party).label}: ${final === null ? "no value" : `${final > 0 ? "+" : ""}${final.toFixed(2)} ${unit === "pp" ? "percentage points" : "percent"}`}`}
                onMouseEnter={(e) => {
                  setHover(v.party);
                  const box = (e.currentTarget as SVGRectElement).getBoundingClientRect();
                  setTip(makeTip(e.clientX || box.left + box.width / 2, e.clientY || box.top + box.height / 2, partyMeta(v.party).label, [
                    { label: unit === "pp" ? "Swing" : "Difference", value: final === null ? "—" : `${final > 0 ? "+" : ""}${final.toFixed(2)} ${unit === "pp" ? "pp" : "%"}`, color: C(v.party) },
                  ]));
                }}
                onMouseLeave={() => { setHover(null); setTip(null); }}
                onFocus={() => setHover(v.party)}
                onBlur={() => { setHover(null); setTip(null); }}
                className="cursor-default outline-none"
              />
              <text x={padL - 10} y={cy + 3.5} textAnchor="end" fontSize="10.5" fill="currentColor" opacity="0.85">{partyMeta(v.party).label}</text>
              {final !== null && (
                <rect x={gain ? zero : zero - w} y={cy - 8} width={Math.max(1, w)} height={16} rx="2" fill={C(v.party)} fillOpacity="0.92" />
              )}
              <text x={gain ? zero + w + 6 : zero - w - 6} y={cy + 3.5} textAnchor={gain ? "start" : "end"} fontSize="10" fontWeight="600" fill="currentColor" opacity="0.9">
                {final === null ? "—" : `${final > 0 ? "+" : ""}${final.toFixed(2)}`}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">{note}</p>
      <Tip tip={tip} />
    </div>
  );
}

function SwingChart({ scope, parties, m }: { scope: ScopeData; parties: string[]; m: Motion }) {
  const order = sortedParties(CONTESTED.map((p) => ({ party: p, value: pctOf(scope.shares2023, p) })));
  const values = order.filter((p) => parties.includes(p)).map((p) => {
    const a = pctOf(scope.shares2018, p), b = pctOf(scope.shares2023, p);
    return { party: p, value: a !== null && b !== null ? b - a : null };
  });
  return <Diverging values={values} unit="pp" m={m} note="Historical swing = actual 2023 share − actual 2018 share, in percentage points (candidate votes + NOTA)." />;
}

/* ================================================================== *
 *  2028 survey — vote share or difference vs 2023
 * ================================================================== */
function SurveyChart({ scope, parties, m }: { scope: ScopeData; parties: string[]; m: Motion }) {
  const [metric, setMetric] = useState<"share" | "diff">("share");
  const { hover, tip, enter, leave, esc } = useRowTip();
  const order = sortedParties(CONTESTED.map((p) => ({ party: p, value: pctOf(scope.shares2028, p) })));
  const rows = order.filter((p) => parties.includes(p)).map((p) => ({ p, a: pctOf(scope.shares2023, p), b: pctOf(scope.shares2028, p) }));
  const vals = useAnimatedNumbers(rows.map((r) => r.b ?? 0), m.animate, m.initialZero);

  return (
    <div>
      <div className="mb-3 inline-flex rounded-full border border-border p-0.5">
        {([["share", "Vote share"], ["diff", "Difference vs 2023"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setMetric(id)} aria-pressed={metric === id}
            className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors", metric === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
      </div>
      {metric === "diff" ? (
        <Diverging values={rows.map((r) => ({ party: r.p, value: r.a !== null && r.b !== null ? r.b - r.a : null }))} unit="pp" m={m}
          note="Survey difference = 2028 scenario share − actual 2023 share. Not a measured election swing or confirmed voter transfer." />
      ) : (
        <div>
          <div className="mb-3 flex items-center gap-4 text-[10.5px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-foreground" style={{ opacity: 0.85 }} /> 2028 survey</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-foreground/60" /> 2023 actual (reference)</span>
          </div>
          <div className="space-y-3">
            {rows.map((r, i) => {
              const max = Math.max(...rows.flatMap((x) => [x.a ?? 0, x.b ?? 0]), 1);
              const diff = r.a !== null && r.b !== null ? r.b - r.a : null;
              return (
                <div key={r.p} tabIndex={0} role="group"
                  aria-label={`${partyMeta(r.p).label}: 2023 ${fmtPct(r.a)}, 2028 ${fmtPct(r.b)}`}
                  onMouseEnter={(e) => enter(e, r.p, partyMeta(r.p).label, [
                    { label: "2023 actual", value: fmtPct(r.a) },
                    { label: "2028 survey", value: fmtPct(r.b), color: C(r.p) },
                    ...(diff !== null ? [{ label: "Difference", value: fmtPp(diff) }] : []),
                  ])}
                  onMouseLeave={leave}
                  onFocus={(e) => enter(e, r.p, partyMeta(r.p).label, [
                    { label: "2023 actual", value: fmtPct(r.a) },
                    { label: "2028 survey", value: fmtPct(r.b), color: C(r.p) },
                    ...(diff !== null ? [{ label: "Difference", value: fmtPp(diff) }] : []),
                  ])}
                  onBlur={leave} onKeyDown={esc}
                  className="chart-row grid cursor-default grid-cols-[96px_minmax(0,1fr)_88px] items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-saffron/60"
                  style={{ opacity: hover && hover !== r.p ? 0.45 : 1 }}>
                  <span className="text-[11.5px] font-medium">{partyMeta(r.p).label}</span>
                  <div className="relative h-5">
                    <span className="chart-bar absolute inset-y-1 left-0 rounded-sm"
                      style={{ width: m.grown ? `${((r.b ?? 0) / max) * 100}%` : "0%", background: grad(r.p), transitionDelay: `${i * 40}ms` }} />
                    {r.a !== null && <span className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: `${(r.a / max) * 100}%` }} title={`2023 actual ${fmtPct(r.a)}`} />}
                    <span className="absolute -top-0.5 text-[9px] tabular-nums text-muted-foreground" style={{ left: `calc(${((r.b ?? 0) / max) * 100}% + 6px)` }}>
                      {fmtPct(vals[i] ?? 0)}
                    </span>
                  </div>
                  <span className={cn("whitespace-nowrap text-right text-[10.5px] tabular-nums", (diff ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{fmtPp(diff)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[10.5px] text-muted-foreground">Bars are the 2028 survey share; the vertical tick marks the actual 2023 share for the same party. The right column is the survey difference in pp.</p>
        </div>
      )}
      <Tip tip={tip} />
    </div>
  );
}

/* ================================================================== *
 *  Trend — actual reference points + survey rounds / rolling windows
 * ================================================================== */
type TrendMode = "r388" | "r688" | "d7" | "d14" | "d30";

function TrendChart({ scope, rounds, daily, parties, m }: { scope: ScopeData; rounds: RoundRow[]; daily: DailyRow[]; parties: string[]; m: Motion }) {
  const [mode, setMode] = useState<TrendMode>("r388");
  const [cross, setCross] = useState<number | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<TipData | null>(null);
  const p = useChartProgress(m.animate);
  const { ref: boxRef, width: W } = useMeasuredWidth(680);
  const seriesParties = ["BRS", "INC", "BJP"].filter((x) => parties.includes(x));

  const series = useMemo(() => {
    if (mode === "r388" || mode === "r688") {
      const batch = mode === "r388" ? 388 : 688;
      return seriesParties.map((p) => ({
        p,
        pts: rounds.filter((r) => r.batchSize === batch && r.party === p && r.share > 0)
          .sort((a, b) => a.batch - b.batch)
          .map((r) => ({ label: `#${r.batch}`, value: r.share * 100 })),
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
    return seriesParties.map((p) => {
      const pts: { label: string; value: number }[] = [];
      for (let i = 0; i < dates.length; i++) {
        const start = Math.max(0, i - days + 1);
        let num = 0, den = 0;
        for (let j = start; j <= i; j++) { const d = byDate.get(dates[j])!; num += d.answers[p] ?? 0; den += d.answered; }
        if (den >= 20) pts.push({ label: dates[i], value: (num / den) * 100 });
      }
      return { p, pts };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, rounds, daily, parties.join("|")]);

  const actual = seriesParties.map((p) => ({ p, y2018: pctOf(scope.shares2018, p), y2023: pctOf(scope.shares2023, p) }));
  const all = [...series.flatMap((s) => s.pts.map((x) => x.value)), ...actual.flatMap((a) => [a.y2018 ?? 0, a.y2023 ?? 0])];
  const min = Math.max(0, Math.floor((Math.min(...all, 100) - 4) / 5) * 5);
  const max = Math.ceil((Math.max(...all, 0) + 4) / 5) * 5;

  const H = 300, padL = 36, padR = 12, padT = 18, padB = 30;
  const startX = padL + (W - padL - padR) * 0.2;
  const y = (v: number) => padT + (1 - (v - min) / Math.max(1, max - min)) * (H - padT - padB);
  const xSur = (i: number, n: number) => startX + (i / Math.max(1, n - 1)) * (W - padR - startX);

  const longest = series.reduce((a, b) => (a && a.pts.length >= b.pts.length ? a : b), series[0]);
  const n = longest?.pts.length ?? 0;
  const crossX = cross !== null && n > 1 ? xSur(cross, n) : null;

  const moveCross = (e: React.MouseEvent<SVGRectElement>) => {
    if (n < 2) return;
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const idx = Math.round(((px - startX) / (W - padR - startX)) * (n - 1));
    const i = Math.max(0, Math.min(n - 1, idx));
    setCross(i);
    const rows = series.filter((s) => s.pts[i]).map((s) => ({ label: partyMeta(s.p).short, value: `${s.pts[i].value.toFixed(2)}%`, color: C(s.p) }));
    setTip(makeTip(e.clientX, e.clientY, longest.pts[i].label, rows));
  };

  return (
    <div ref={boxRef}>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {([["r388", "Rounds 388"], ["r688", "Rounds 688"], ["d7", "7-day"], ["d14", "14-day"], ["d30", "30-day"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => { setMode(id); setCross(null); setTip(null); }} aria-pressed={mode === id}
            className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors", mode === id ? "border-saffron/60 bg-saffron/15 text-saffron-2" : "border-border text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
        <span className="ml-1 text-[10px] text-muted-foreground">2026 collection · rolling windows use weighted shares</span>
      </div>

      {series.every((s) => s.pts.length === 0) ? <Empty text="No rounds in this view yet." /> : (
        <div
          tabIndex={0}
          role="img"
          aria-label="Survey trend with historical reference points. Use left and right arrows to inspect a round."
          className="outline-none focus-visible:ring-2 focus-visible:ring-saffron/60"
          onKeyDown={(e) => {
            if (!n) return;
            if (e.key === "ArrowRight") { e.preventDefault(); const i = Math.min(n - 1, (cross ?? -1) + 1); setCross(i); }
            if (e.key === "ArrowLeft") { e.preventDefault(); const i = Math.max(0, (cross ?? n) - 1); setCross(i); }
            if (e.key === "Escape") { setCross(null); setTip(null); }
          }}
          onBlur={() => { setCross(null); setTip(null); }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
            <defs>
              <clipPath id="trend-reveal">
                <rect x={0} y={0} width={startX + (W - startX) * clampP((p - 0.25) / 0.75)} height={H} />
              </clipPath>
            </defs>
            {[0, 0.5, 1].map((t) => {
              const v = min + (max - min) * (1 - t);
              return (
                <g key={t}>
                  <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.08} />
                  <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.5">{v.toFixed(0)}%</text>
                </g>
              );
            })}
            <line x1={startX - 12} x2={startX - 12} y1={padT - 4} y2={H - padB} stroke="currentColor" strokeOpacity={0.18} strokeDasharray="3 4" />
            <text x={padL + 4} y={12} fontSize="8.5" fill="currentColor" opacity="0.5">actual</text>
            <text x={startX + 4} y={12} fontSize="8.5" fill="currentColor" opacity="0.5">survey · 2026 collection</text>

            {actual.map((a) => (
              <g key={`a-${a.p}`} opacity={hover && hover !== a.p ? 0.35 : 1} style={{ transition: "opacity 180ms ease" }}>
                {a.y2018 !== null && a.y2023 !== null && (
                  <line x1={padL + 4} y1={y(a.y2018)} x2={padL + 26} y2={y(a.y2023)} stroke={C(a.p)} strokeWidth="1.8" strokeOpacity="0.85"
                    pathLength={1} strokeDasharray="1" strokeDashoffset={1 - clampP(p / 0.28)} />
                )}
                {a.y2018 !== null && <circle cx={padL + 4} cy={y(a.y2018)} r="2.8" fill={C(a.p)} opacity={p > 0.02 ? 1 : 0} />}
                {a.y2023 !== null && <circle cx={padL + 26} cy={y(a.y2023)} r="2.8" fill={C(a.p)} opacity={p > 0.18 ? 1 : 0} />}
              </g>
            ))}
            <text x={padL} y={H - 8} fontSize="8.5" fill="currentColor" opacity="0.5">’18</text>
            <text x={padL + 30} y={H - 8} fontSize="8.5" fill="currentColor" opacity="0.5">’23</text>

            <g clipPath="url(#trend-reveal)">
              {series.map((s) => {
                if (!s.pts.length) return null;
                const d = s.pts.map((pt, i) => `${i ? "L" : "M"}${xSur(i, s.pts.length).toFixed(1)},${y(pt.value).toFixed(1)}`).join(" ");
                const dim = hover && hover !== s.p;
                return (
                  <g key={s.p} opacity={dim ? 0.3 : 1} style={{ transition: "opacity 180ms ease" }}>
                    <path d={d} fill="none" stroke={C(s.p)} strokeWidth={hover === s.p ? 2.4 : 1.9} strokeDasharray="5 3" strokeLinecap="round" />
                    {s.pts.map((pt, i) => (
                      <circle key={`${s.p}-${i}`} cx={xSur(i, s.pts.length)} cy={y(pt.value)} r={cross === i ? 3.4 : 2.2} fill={C(s.p)} opacity={p > 0.5 ? 1 : 0} style={{ transition: "r 120ms ease" }} />
                    ))}
                  </g>
                );
              })}
            </g>

            {crossX !== null && (
              <line x1={crossX} x2={crossX} y1={padT - 4} y2={H - padB} stroke="currentColor" strokeOpacity="0.3" strokeDasharray="2 3" />
            )}

            <rect x={startX} y={padT} width={W - padR - startX} height={H - padT - padB} fill="transparent"
              onMouseMove={moveCross} onMouseLeave={() => { setCross(null); setTip(null); }} />
          </svg>
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        {seriesParties.map((p) => (
          <button key={p} type="button" onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(p)} onBlur={() => setHover(null)}
            className="flex items-center gap-1 rounded-full px-1 text-[10px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-saffron/60"
            style={hover === p ? { color: C(p) } : undefined}>
            <span className="size-2 rounded-sm" style={{ background: C(p) }} />{partyMeta(p).short}
          </button>
        ))}
        <span className="text-[10px] text-muted-foreground">solid = actual 2018→2023 · dashed = survey rounds</span>
      </div>
      <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
        {mode.startsWith("r") ? "Weighted share within each original-entry batch; batches are a grouping choice, not a random sample." : "Rolling weighted share = party answers ÷ answered entries in the window."}
        {" "}Survey dates are the original 2026 collection period for 2028 intentions.
      </p>
      <Tip tip={tip} />
    </div>
  );
}

/* ================================================================== *
 *  Assemblies — animated rows, search, selected assembly pinned
 * ================================================================== */
function AssembliesChart({ scope, parties, selectedAc, m }: { scope: ScopeData; parties: string[]; selectedAc: number | null; m: Motion }) {
  const [q, setQ] = useState("");
  const [hover, setHover] = useState<number | null>(null);
  const [tip, setTip] = useState<TipData | null>(null);

  const rows = useMemo(() => {
    const mapped = scope.acs.map((a) => {
      const total28 = Object.values(a.a2028).reduce((s, x) => s + x, 0);
      const best = CONTESTED.filter((x) => parties.includes(x)).map((x) => ({ p: x, n: a.a2028[x] ?? 0 })).sort((x, y) => y.n - x.n)[0];
      const total23 = Object.values(a.v2023).reduce((s, x) => s + x, 0);
      const n23 = a.v2023[best?.p ?? ""] ?? 0;
      return {
        a,
        lead: total28 && best?.n ? best.p : null,
        share28: total28 && best ? (best.n / total28) * 100 : null,
        share23: total23 && best ? (n23 / total23) * 100 : null,
      };
    });
    const needle = q.trim().toLowerCase();
    const filtered = mapped.filter((r) => !needle || r.a.name.toLowerCase().includes(needle) || r.a.group.toLowerCase().includes(needle) || String(r.a.no) === needle);
    const sorted = filtered.sort((x, y) => (y.share28 ?? -1) - (x.share28 ?? -1));
    const pinned = selectedAc != null ? mapped.find((r) => r.a.no === selectedAc) : undefined;
    if (pinned && !sorted.some((r) => r.a.no === pinned.a.no)) return [pinned, ...sorted];
    return sorted;
  }, [scope, q, parties, selectedAc]);

  return (
    <div>
      <label className="mb-2 flex max-w-xs items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5">
        <Search className="size-3.5 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search assembly or group" className="w-full bg-transparent text-[11.5px] outline-none" />
      </label>
      <div className="max-h-[300px] overflow-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-[11.5px]">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-1.5 font-semibold">Assembly</th>
              <th className="px-2 py-1.5 font-semibold">Group</th>
              <th className="px-2 py-1.5 font-semibold">Lead</th>
              <th className="px-2 py-1.5 text-right font-semibold">2028</th>
              <th className="px-2 py-1.5 text-right font-semibold">2023</th>
              <th className="px-2 py-1.5 text-right font-semibold">Δ pp</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ a, lead, share28, share23 }, i) => {
              const diff = share28 !== null && share23 !== null ? share28 - share23 : null;
              const isSel = a.no === selectedAc;
              return (
                <tr key={a.no}
                  tabIndex={0}
                  onMouseEnter={(e) => {
                    setHover(a.no);
                    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setTip(makeTip(e.clientX || box.left + 200, e.clientY || box.top, `${a.no}. ${a.name}`, [
                      ...(lead ? [{ label: "Lead 2028", value: `${partyMeta(lead).short} ${fmtPct(share28)}`, color: C(lead) }] : []),
                      { label: "2023 (same party)", value: fmtPct(share23) },
                      { label: "Difference", value: fmtPp(diff) },
                    ]));
                  }}
                  onMouseLeave={() => { setHover(null); setTip(null); }}
                  onFocus={() => setHover(a.no)}
                  onBlur={() => { setHover(null); setTip(null); }}
                  className={cn("chart-in cursor-default border-t border-border/60 outline-none transition-colors focus-visible:bg-muted/40", isSel && "bg-saffron/10", hover === a.no && "bg-muted/40")}
                  style={{ animationDelay: m.grown ? `${Math.min(i, 10) * 28}ms` : undefined, animationDuration: m.reduced ? "0ms" : undefined }}
                >
                  <td className="px-2 py-1.5 font-medium">
                    {isSel && <span className="mr-1 rounded bg-saffron/25 px-1 text-[8px] font-bold uppercase text-saffron-2">selected</span>}
                    {a.no}. {a.name}{a.reservation ? ` (${a.reservation})` : ""}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{a.group}</td>
                  <td className="px-2 py-1.5">
                    {lead ? <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm" style={{ background: C(lead) }} />{partyMeta(lead).short}</span> : <span className="text-muted-foreground">No answers</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{a.answered2028 > 0 ? fmtPct(share28) : "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmtPct(share23)}</td>
                  <td className={cn("px-2 py-1.5 text-right tabular-nums", (diff ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{fmtPp(diff, 1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="p-4 text-center text-[11.5px] text-muted-foreground">No assemblies match “{q}”.</p>}
      </div>
      <p className="mt-1.5 text-[10.5px] text-muted-foreground">2023 is that assembly&apos;s actual share for the same party shown in 2028. Ranked by 2028 lead share; the selected assembly stays visible.</p>
      <Tip tip={tip} />
    </div>
  );
}

/* ================================================================== *
 *  Devices
 * ================================================================== */
function DevicesChart({ device, total, m }: { device: Record<string, number>; total: number; m: Motion }) {
  const { hover, tip, enter, leave, esc } = useRowTip();
  const rows = Object.entries(device).sort((a, b) => b[1] - a[1]).slice(0, 11);
  const vals = useAnimatedNumbers(rows.map(([, n]) => (n / total) * 100), m.animate, m.initialZero);
  if (!rows.length) return <Empty text="No device metadata in this scope." />;
  return (
    <div className="space-y-2">
      {rows.map(([brand, n], i) => {
        const pct = (n / total) * 100;
        const asset = brandMarker(brand, "png");
        return (
          <div key={brand} tabIndex={0} role="group" aria-label={`${asset.brand}: ${fmtPct(pct)} of device metadata`}
            onMouseEnter={(e) => enter(e, brand, asset.brand, [{ label: "Device mix", value: fmtPct(pct), color: "var(--muted-foreground)" }])}
            onMouseLeave={leave} onFocus={(e) => enter(e, brand, asset.brand, [{ label: "Device mix", value: fmtPct(pct) }])} onBlur={leave} onKeyDown={esc}
            className="chart-row grid cursor-default grid-cols-[34px_110px_minmax(0,1fr)_84px] items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-saffron/60"
            style={{ opacity: hover && hover !== brand ? 0.45 : 1 }}>
            <span className="grid h-7 w-9 place-items-center rounded border border-border bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.src} alt="" className="h-5 w-7 object-contain" />
            </span>
            <span className="truncate text-[11.5px] font-medium" title={asset.brand}>{asset.brand}</span>
            <span className="chart-bar h-2.5 rounded-sm bg-[linear-gradient(90deg,#64748b_0%,#94a3b8_100%)]" style={{ width: m.grown ? `${pct}%` : "0%", transitionDelay: `${i * 32}ms` }} />
            <span className="whitespace-nowrap text-right text-[11px] tabular-nums">{fmtPct(vals[i] ?? 0)}</span>
          </div>
        );
      })}
      <p className="text-[10.5px] leading-relaxed text-muted-foreground">
        Aggregate observed/predicted metadata from the original entries. Not proof of a verified handset, a unique voter or
        political preference.
      </p>
      <Tip tip={tip} />
    </div>
  );
}

/* ================================================================== *
 *  Age
 * ================================================================== */
function AgeChart({ age, parties, m }: { age: AgeRow[]; parties: string[]; m: Motion }) {
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<TipData | null>(null);
  const rows = age.filter((r) => r.answered > 0);
  if (!rows.length) return <Empty />;
  const show = CONTESTED.filter((p) => parties.includes(p));
  return (
    <div className="space-y-3">
      {rows.map((r, ri) => (
        <div key={r.band}>
          <div className="mb-1 flex items-baseline justify-between text-[11px]">
            <span className="font-medium">{r.band === "(missing)" ? "Age not supplied" : r.band}</span>
          </div>
          <div className="flex h-4 overflow-hidden rounded bg-muted/30" style={{ transform: m.grown ? "none" : "scaleX(0)", transformOrigin: "left", transition: m.reduced ? "none" : `transform 680ms cubic-bezier(.2,.7,.2,1) ${ri * 40}ms` }}>
            {show.map((p) => {
              const n = r.parties[p] ?? 0;
              if (!n) return null;
              const pct = (n / r.answered) * 100;
              return (
                <span key={p} role="img" aria-label={`${partyMeta(p).label}: ${fmtPct(pct)}`}
                  onMouseEnter={(e) => { setHover(p); const box = (e.currentTarget as HTMLElement).getBoundingClientRect(); setTip(makeTip(e.clientX || box.left, e.clientY || box.top, r.band === "(missing)" ? "Age not supplied" : r.band, [{ label: partyMeta(p).label, value: fmtPct(pct), color: C(p) }])); }}
                  onMouseLeave={() => { setHover(null); setTip(null); }}
                  title={`${partyMeta(p).label}: ${fmtPct(pct)}`}
                  style={{ width: `${pct}%`, background: grad(p), opacity: hover && hover !== p ? 0.4 : 1, transition: "opacity 180ms ease" }} />
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        {show.map((p) => (
          <button key={p} type="button" onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(p)} onBlur={() => setHover(null)}
            className="flex items-center gap-1 rounded-full px-1 text-[10px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-saffron/60"
            style={hover === p ? { color: C(p) } : undefined}>
            <span className="size-2 rounded-sm" style={{ background: C(p) }} />{partyMeta(p).short}
          </button>
        ))}
      </div>
      <p className="text-[10.5px] text-muted-foreground">Missing ages are retained as their own band; sparse groups are not redistributed.</p>
      <Tip tip={tip} />
    </div>
  );
}

/* ================================================================== *
 *  Analysis container
 * ================================================================== */
export default function TelanganaAnalysis({
  scope, age, rounds, daily, statewide, chart, onChart, parties, onParties, selectedAc, status,
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
  status: ChartStatus;
}) {
  const active = CHARTS.find((c) => c.id === chart) ?? CHARTS[0];
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [full]);

  return (
    <section
      aria-label="Telangana analysis"
      className={cn(
        "scroll-mt-24 rounded-2xl border border-border bg-card",
        full && "fixed inset-2 z-[70] flex flex-col overflow-auto shadow-2xl sm:inset-4",
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Selected region</p>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px]",
              status.error ? "border-rose-500/30 text-rose-600 dark:text-rose-400" : "border-border text-muted-foreground",
              status.flash && "ring-2 ring-emerald-500/25")}>
              <span className={cn("size-1.5 rounded-full", status.updating ? "soft-pulse bg-saffron" : status.error ? "bg-rose-500" : "bg-emerald-500")} />
              {status.updating ? "Updating…" : status.error ? "Refresh failed" : "Survey insights"}
            </span>
            <button type="button" onClick={status.onRefresh} disabled={status.updating} aria-label="Refresh aggregates"
              className="grid size-6 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
              <RefreshCw className={cn("size-3", status.updating && "animate-spin")} />
            </button>
            {status.lastRefreshed && (
              <span className="text-[10px] text-muted-foreground">{status.updating ? "as of" : "refreshed"} {status.lastRefreshed}</span>
            )}
          </div>
          <h2 className="mt-0.5 truncate font-display text-xl font-semibold leading-tight">{scope.label}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Parties</span>
          {CONTESTED.map((p) => {
            const on = parties.includes(p);
            return (
              <button key={p} type="button" onClick={() => onParties(on ? parties.filter((x) => x !== p) : [...parties, p])} aria-pressed={on}
                className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-saffron/60"
                style={on ? { borderColor: `${C(p)}99`, color: C(p), background: `${C(p)}16` } : { borderColor: "transparent", color: "var(--muted-foreground)", opacity: 0.65 }}>
                <span className="size-2 rounded-sm" style={{ background: on ? C(p) : "var(--border)" }} />
                {partyMeta(p).short}
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
        <button type="button" onClick={() => setFull((v) => !v)} aria-pressed={full}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
          {full ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}{full ? "Exit full screen" : "Full screen"}
        </button>
      </div>

      <div className={cn("min-h-[380px] p-4 sm:p-5", full && "flex-1")}>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="font-display text-[13px] font-semibold">{active.label}</h3>
          <p className="text-[10.5px] text-muted-foreground">{active.note}</p>
        </div>
        <div key={chart} className={cn("chart-in h-[440px]", full && "h-[calc(100vh-13rem)]")}>
          <ChartShell id={chart}>
            {(m) => (
              <>
                {chart === "share" && <PartyShareChart scope={scope} parties={parties} m={m} />}
                {chart === "seats" && <SeatsChart statewide={statewide} parties={parties} m={m} />}
                {chart === "vote" && <VoteShareChart scope={scope} parties={parties} m={m} />}
                {chart === "swing" && <SwingChart scope={scope} parties={parties} m={m} />}
                {chart === "survey" && <SurveyChart scope={scope} parties={parties} m={m} />}
                {chart === "trend" && <TrendChart scope={scope} rounds={rounds} daily={daily} parties={parties} m={m} />}
                {chart === "assemblies" && <AssembliesChart scope={scope} parties={parties} selectedAc={selectedAc} m={m} />}
                {chart === "devices" && <DevicesChart device={scope.device} total={scope.deviceTotal} m={m} />}
                {chart === "age" && <AgeChart age={age} parties={parties} m={m} />}
              </>
            )}
          </ChartShell>
        </div>
      </div>
    </section>
  );
}
