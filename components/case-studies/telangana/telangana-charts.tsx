"use client";

import { useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, Search } from "lucide-react";
import { partyMeta } from "@/lib/telangana/parties";
import { brandMarker } from "@/lib/telangana/brands";
import {
  fmtInt, fmtPct, fmtPp,
  type AgeRow, type AcRecord, type Counts, type DailyRow, type PartyShare, type RoundRow, type StatewideRow,
} from "@/lib/telangana/model";
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

const CONTESTED = ["BRS", "INC", "BJP", "AIMIM", "TDP", "JSP", "Others"];
const pctOf = (s: PartyShare[], p: string) => s.find((x) => x.party === p)?.share ?? null;
const C = (p: string) => partyMeta(p).color;

function Empty({ text = "No answered survey responses in this scope." }: { text?: string }) {
  return <div className="grid h-[300px] place-items-center text-center text-[12px] text-muted-foreground">{text}</div>;
}

/* ------------------------------------------------------------------ *
 *  Party share — bars against a real percentage axis (no progress track)
 * ------------------------------------------------------------------ */
function PartyShareChart({ scope }: { scope: ScopeData }) {
  if (!scope.answered2028) return <Empty />;
  const rows = scope.shares2028.filter((s) => s.party !== "NOTA");
  const max = Math.max(60, Math.ceil((Math.max(...rows.map((r) => r.share ?? 0)) + 4) / 10) * 10);
  const ticks = [0, max / 2, max];
  return (
    <div>
      <div className="relative ml-[104px] mr-[104px] mt-8 h-[292px]">
        {ticks.map((t) => (
          <div key={t} className="absolute inset-y-0" style={{ left: `${(t / max) * 100}%` }}>
            <div className="h-full w-px bg-border/70" />
            <span className="absolute -top-5 -translate-x-1/2 text-[9.5px] tabular-nums text-muted-foreground">{Math.round(t)}%</span>
          </div>
        ))}
        <div className="absolute inset-0 flex flex-col justify-around">
          {rows.map((s) => {
            const s23 = pctOf(scope.shares2023, s.party);
            const diff = s.count > 0 && s.share !== null && s23 !== null ? s.share - s23 : null;
            return (
              <div key={s.party} className="relative flex items-center">
                <span className="absolute right-full mr-2 flex w-[96px] items-center justify-end gap-1.5 text-[11.5px] font-medium">
                  {partyMeta(s.party).label}
                  <span className="size-2 shrink-0 rounded-sm" style={{ background: C(s.party) }} />
                </span>
                <div className="relative h-4 flex-1">
                  {s.count === 0 ? (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">not recorded</span>
                  ) : (
                    <span className="absolute inset-y-0 left-0 rounded-r-sm" style={{ width: `${((s.share ?? 0) / max) * 100}%`, background: C(s.party) }} />
                  )}
                </div>
                <span className="absolute left-full ml-2 flex w-[100px] items-baseline gap-1.5 whitespace-nowrap text-[11px] tabular-nums">
                  <b>{s.count === 0 ? "—" : fmtPct(s.share)}</b>
                  {diff !== null && <span className={cn("text-[9.5px]", diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{fmtPp(diff)}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
        The pp figure is the survey difference vs actual 2023 — not a measured swing. Options with no recorded answers are
        labelled “not recorded”; denominator counts are in About this data.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Seats — actual only
 * ------------------------------------------------------------------ */
function SeatsChart({ statewide }: { statewide: StatewideRow[] }) {
  const rows = statewide.filter((r) => r.seats2018 > 0 || r.seats2023 > 0).sort((a, b) => b.seats2023 - a.seats2023);
  if (!rows.length) return <Empty text="No seat results in the supplied tables." />;
  const max = Math.max(...rows.flatMap((r) => [r.seats2018, r.seats2023]), 1);
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-[10.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-foreground/30" /> 2018 actual</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-foreground" /> 2023 actual</span>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.party} className="grid grid-cols-[104px_minmax(0,1fr)_86px] items-center gap-2">
            <span className="text-[12px] font-medium">{partyMeta(r.party).label}</span>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 rounded-sm bg-foreground/25" style={{ width: `${(r.seats2018 / max) * 100}%` }} />
                <span className="text-[10px] tabular-nums text-muted-foreground">{r.seats2018}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 rounded-sm" style={{ width: `${(r.seats2023 / max) * 100}%`, background: C(r.party) }} />
                <span className="text-[10px] tabular-nums text-foreground/80">{r.seats2023}</span>
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
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Vote share 2018 → 2023 — slope chart
 * ------------------------------------------------------------------ */
function VoteShareChart({ scope }: { scope: ScopeData }) {
  const rows = CONTESTED.map((p) => ({ p, a: pctOf(scope.shares2018, p), b: pctOf(scope.shares2023, p) }))
    .filter((r) => r.a !== null || r.b !== null);
  if (!rows.length) return <Empty />;
  const W = 660, H = 300, padL = 118, padR = 118, padT = 34, padB = 26;
  const max = Math.max(10, Math.ceil((Math.max(...rows.flatMap((r) => [r.a ?? 0, r.b ?? 0])) + 4) / 10) * 10);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const x0 = padL, x1 = W - padR;

  // push labels apart so close values stay readable
  const place = (items: { p: string; v: number; y: number }[]) => {
    const sorted = [...items].sort((a, b) => a.y - b.y);
    let last = -Infinity;
    return sorted.map((it) => {
      const labelY = Math.max(it.y, last + 12);
      last = labelY;
      return { ...it, labelY };
    });
  };
  const left = place(rows.filter((r) => r.a !== null).map((r) => ({ p: r.p, v: r.a!, y: y(r.a!) })));
  const right = place(rows.filter((r) => r.b !== null).map((r) => ({ p: r.p, v: r.b!, y: y(r.b!) })));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Vote share 2018 to 2023 actual results">
        {[0, max / 2, max].map((t) => (
          <line key={t} x1={padL - 10} x2={W - padR + 10} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.08} />
        ))}
        <text x={x0} y={16} textAnchor="middle" fontSize="10" fontWeight="600" fill="currentColor" opacity="0.7">2018 actual</text>
        <text x={x1} y={16} textAnchor="middle" fontSize="10" fontWeight="600" fill="currentColor" opacity="0.7">2023 actual</text>
        {rows.map((r) => {
          const ya = r.a !== null ? y(r.a) : null, yb = r.b !== null ? y(r.b) : null;
          return (
            <g key={r.p}>
              {ya !== null && yb !== null && <line x1={x0} y1={ya} x2={x1} y2={yb} stroke={C(r.p)} strokeWidth="2" strokeOpacity="0.75" />}
              {ya !== null && <circle cx={x0} cy={ya} r="3.4" fill={C(r.p)} />}
              {yb !== null && <circle cx={x1} cy={yb} r="3.4" fill={C(r.p)} />}
            </g>
          );
        })}
        {left.map((it) => (
          <g key={`l-${it.p}`}>
            {Math.abs(it.labelY - it.y) > 1 && <line x1={x0 - 4} y1={it.y} x2={x0 - 8} y2={it.labelY} stroke={C(it.p)} strokeOpacity="0.5" strokeWidth="0.8" />}
            <text x={x0 - 10} y={it.labelY + 3} textAnchor="end" fontSize="9.5" fill="currentColor" opacity="0.8">{it.v.toFixed(1)}%</text>
          </g>
        ))}
        {right.map((it) => (
          <g key={`r-${it.p}`}>
            {Math.abs(it.labelY - it.y) > 1 && <line x1={x1 + 4} y1={it.y} x2={x1 + 8} y2={it.labelY} stroke={C(it.p)} strokeOpacity="0.5" strokeWidth="0.8" />}
            <text x={x1 + 10} y={it.labelY + 3} fontSize="9.5" fill="currentColor" opacity="0.85">{it.v.toFixed(1)}%</text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {rows.map((r) => (
          <span key={r.p} className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="size-2 rounded-sm" style={{ background: C(r.p) }} />{partyMeta(r.p).short}</span>
        ))}
      </div>
      <p className="mt-1 text-[10.5px] text-muted-foreground">Actual results only. Shares use candidate votes plus NOTA in the same scope.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Diverging bars — shared by Swing and the 2028 difference view
 * ------------------------------------------------------------------ */
function Diverging({
  values, unit = "pp", note,
}: { values: { party: string; value: number | null }[]; unit?: "pp" | "share"; note: string }) {
  const maxAbs = Math.max(2, ...values.map((v) => Math.abs(v.value ?? 0)));
  const ticks = [-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs];
  const W = 660, H = 288, padL = 110, padR = 66, padT = 26, padB = 20;
  const zero = padL + (W - padL - padR) / 2;
  const scale = (W - padL - padR) / 2 / maxAbs;
  const rowH = (H - padT - padB) / Math.max(1, values.length);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={unit === "pp" ? "Swing in percentage points" : "Share in percent"}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={zero + t * scale} x2={zero + t * scale} y1={padT - 6} y2={H - padB} stroke="currentColor" strokeOpacity={t === 0 ? 0.35 : 0.08} strokeWidth={t === 0 ? 1.2 : 1} />
            <text x={zero + t * scale} y={H - 6} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.5">{t > 0 ? "+" : ""}{Number.isInteger(t) ? t : t.toFixed(1)}{unit === "pp" ? " pp" : "%"}</text>
          </g>
        ))}
        {values.map((v, i) => {
          const cy = padT + rowH * i + rowH / 2;
          const w = v.value === null ? 0 : Math.abs(v.value) * scale;
          const gain = (v.value ?? 0) >= 0;
          return (
            <g key={v.party}>
              <text x={padL - 10} y={cy + 3.5} textAnchor="end" fontSize="10.5" fill="currentColor" opacity="0.85">{partyMeta(v.party).label}</text>
              {v.value !== null && (
                <rect x={gain ? zero : zero - w} y={cy - 8} width={Math.max(1, w)} height={16} rx="2" fill={C(v.party)} fillOpacity="0.9" />
              )}
              <text x={gain ? zero + w + 6 : zero - w - 6} y={cy + 3.5} textAnchor={gain ? "start" : "end"} fontSize="10" fontWeight="600" fill="currentColor" opacity="0.9">
                {v.value === null ? "—" : `${v.value > 0 ? "+" : ""}${v.value.toFixed(2)}`}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">{note}</p>
    </div>
  );
}

function SwingChart({ scope }: { scope: ScopeData }) {
  const values = CONTESTED.map((p) => {
    const a = pctOf(scope.shares2018, p), b = pctOf(scope.shares2023, p);
    return { party: p, value: a !== null && b !== null ? b - a : null };
  });
  return <Diverging values={values} note="Historical swing = actual 2023 share − actual 2018 share, in percentage points (candidate votes + NOTA)." />;
}

/* ------------------------------------------------------------------ *
 *  2028 survey — vote share or difference vs 2023
 * ------------------------------------------------------------------ */
function SurveyChart({ scope }: { scope: ScopeData }) {
  const [metric, setMetric] = useState<"share" | "diff">("share");
  const rows = CONTESTED.map((p) => ({ p, a: pctOf(scope.shares2023, p), b: pctOf(scope.shares2028, p) }));
  const diff = rows.map((r) => ({ party: r.p, value: r.a !== null && r.b !== null ? r.b - r.a : null }));

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
        <Diverging values={diff} note="Survey difference = 2028 scenario share − actual 2023 share. Not a measured election swing or confirmed voter transfer." />
      ) : (
        <div>
          <div className="mb-3 flex items-center gap-4 text-[10.5px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm" style={{ background: "var(--foreground)", opacity: 0.85 }} /> 2028 survey</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-foreground/60" /> 2023 actual (reference)</span>
          </div>
          <div className="space-y-3">
            {rows.map((r) => {
              const max = Math.max(...rows.flatMap((x) => [x.a ?? 0, x.b ?? 0]), 1);
              return (
                <div key={r.p} className="grid grid-cols-[96px_minmax(0,1fr)_88px] items-center gap-2">
                  <span className="text-[11.5px] font-medium">{partyMeta(r.p).label}</span>
                  <div className="relative h-5">
                    <span className="absolute inset-y-1 left-0 rounded-sm" style={{ width: `${((r.b ?? 0) / max) * 100}%`, background: C(r.p), opacity: 0.9 }} />
                    {r.a !== null && (
                      <span className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: `${(r.a / max) * 100}%` }} title={`2023 actual ${fmtPct(r.a)}`} />
                    )}
                    <span className="absolute -top-0.5 text-[9px] tabular-nums text-muted-foreground" style={{ left: `calc(${((r.b ?? 0) / max) * 100}% + 6px)` }}>{fmtPct(r.b)}</span>
                  </div>
                  <span className={cn("whitespace-nowrap text-right text-[10.5px] tabular-nums", (r.b ?? 0) - (r.a ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                    {fmtPp(r.a !== null && r.b !== null ? r.b - r.a : null)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[10.5px] text-muted-foreground">Bars are the 2028 survey share; the vertical tick marks the actual 2023 share for the same party. The right column is the survey difference in pp.</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Trend — actual reference points + survey rounds / rolling windows
 * ------------------------------------------------------------------ */
type TrendMode = "r388" | "r688" | "d7" | "d14" | "d30";

function TrendChart({ scope, rounds, daily }: { scope: ScopeData; rounds: RoundRow[]; daily: DailyRow[] }) {
  const [mode, setMode] = useState<TrendMode>("r388");
  const parties = ["BRS", "INC", "BJP"];

  const series = useMemo(() => {
    if (mode === "r388" || mode === "r688") {
      const batch = mode === "r388" ? 388 : 688;
      return parties.map((p) => ({
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
    return parties.map((p) => {
      const pts: { label: string; value: number }[] = [];
      for (let i = 0; i < dates.length; i++) {
        const start = Math.max(0, i - days + 1);
        let num = 0, den = 0;
        for (let j = start; j <= i; j++) {
          const d = byDate.get(dates[j])!;
          num += d.answers[p] ?? 0;
          den += d.answered;
        }
        if (den >= 20) pts.push({ label: dates[i], value: (num / den) * 100 });
      }
      return { p, pts };
    });
  }, [mode, rounds, daily]);

  const actual = parties.map((p) => ({
    p,
    y2018: pctOf(scope.shares2018, p),
    y2023: pctOf(scope.shares2023, p),
  }));

  const all = [...series.flatMap((s) => s.pts.map((x) => x.value)), ...actual.flatMap((a) => [a.y2018 ?? 0, a.y2023 ?? 0])];
  const min = Math.max(0, Math.floor((Math.min(...all, 100) - 4) / 5) * 5);
  const max = Math.ceil((Math.max(...all, 0) + 4) / 5) * 5;

  const W = 680, H = 300, padL = 36, padR = 12, padT = 18, padB = 30;
  const breakX = padL + (W - padL - padR) * 0.14;
  const startX = padL + (W - padL - padR) * 0.2;
  const y = (v: number) => padT + (1 - (v - min) / Math.max(1, max - min)) * (H - padT - padB);
  const xSur = (i: number, n: number) => startX + (i / Math.max(1, n - 1)) * (W - padR - startX);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {([["r388", "Rounds 388"], ["r688", "Rounds 688"], ["d7", "7-day"], ["d14", "14-day"], ["d30", "30-day"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setMode(id)} aria-pressed={mode === id}
            className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors", mode === id ? "border-saffron/60 bg-saffron/15 text-saffron-2" : "border-border text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
        <span className="ml-1 text-[10px] text-muted-foreground">2026 collection · rolling windows use weighted shares</span>
      </div>

      {series.every((s) => s.pts.length === 0) ? (
        <Empty text="No rounds in this view yet." />
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Survey trend by round with historical reference points">
          {[0, 0.5, 1].map((t) => {
            const v = min + (max - min) * (1 - t);
            return (
              <g key={t}>
                <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.08} />
                <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.5">{v.toFixed(0)}%</text>
              </g>
            );
          })}
          {/* actual reference points with a visual break before the survey window */}
          <line x1={breakX} x2={breakX} y1={padT - 4} y2={H - padB} stroke="currentColor" strokeOpacity={0.18} strokeDasharray="3 4" />
          <text x={padL + 4} y={12} fontSize="8.5" fill="currentColor" opacity="0.5">actual</text>
          <text x={startX + 4} y={12} fontSize="8.5" fill="currentColor" opacity="0.5">survey · 2026 collection</text>
          {actual.map((a) => (
            <g key={a.p}>
              {a.y2018 !== null && a.y2023 !== null && (
                <line x1={padL + 4} y1={y(a.y2018)} x2={padL + 22} y2={y(a.y2023)} stroke={C(a.p)} strokeWidth="1.6" strokeOpacity="0.8" />
              )}
              {a.y2018 !== null && <circle cx={padL + 4} cy={y(a.y2018)} r="2.6" fill={C(a.p)} />}
              {a.y2023 !== null && <circle cx={padL + 22} cy={y(a.y2023)} r="2.6" fill={C(a.p)} stroke="currentColor" strokeOpacity="0.4" />}
            </g>
          ))}
          <text x={padL} y={H - 8} fontSize="8.5" fill="currentColor" opacity="0.5">’18</text>
          <text x={padL + 30} y={H - 8} fontSize="8.5" fill="currentColor" opacity="0.5">’23</text>

          {series.map((s) => {
            if (!s.pts.length) return null;
            const d = s.pts.map((pt, i) => `${i ? "L" : "M"}${xSur(i, s.pts.length).toFixed(1)},${y(pt.value).toFixed(1)}`).join(" ");
            return (
              <g key={s.p}>
                <path d={d} fill="none" stroke={C(s.p)} strokeWidth="1.9" strokeDasharray="5 3" strokeLinecap="round" />
                {s.pts.map((pt, i) => (
                  <circle key={`${s.p}-${i}`} cx={xSur(i, s.pts.length)} cy={y(pt.value)} r="2.2" fill={C(s.p)}>
                    <title>{`${partyMeta(s.p).label} · ${pt.label} · ${pt.value.toFixed(2)}%`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        {parties.map((p) => (
          <span key={p} className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="size-2 rounded-sm" style={{ background: C(p) }} />{partyMeta(p).short}</span>
        ))}
        <span className="text-[10px] text-muted-foreground">solid = actual 2018→2023 · dashed = survey rounds</span>
      </div>
      <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
        {mode.startsWith("r") ? "Weighted share within each original-entry batch; batches are a grouping choice, not a random sample." : "Rolling weighted share = party answers ÷ answered entries in the window."}
        {" "}Survey dates are the original 2026 collection period for 2028 intentions.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Assemblies
 * ------------------------------------------------------------------ */
function AssembliesChart({ scope }: { scope: ScopeData }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const mapped = scope.acs.map((a) => {
      const total28 = Object.values(a.a2028).reduce((s, n) => s + n, 0);
      const best = CONTESTED.map((p) => ({ p, n: a.a2028[p] ?? 0 })).sort((x, y) => y.n - x.n)[0];
      const total23 = Object.values(a.v2023).reduce((s, n) => s + n, 0);
      const n23 = a.v2023[best?.p ?? ""] ?? 0;
      return {
        a,
        lead: total28 && best?.n ? best.p : null,
        share28: total28 && best ? (best.n / total28) * 100 : null,
        share23: total23 && best ? (n23 / total23) * 100 : null,
      };
    });
    const needle = q.trim().toLowerCase();
    return mapped
      .filter((r) => !needle || r.a.name.toLowerCase().includes(needle) || r.a.group.toLowerCase().includes(needle) || String(r.a.no) === needle)
      .sort((x, y) => (y.share28 ?? -1) - (x.share28 ?? -1));
  }, [scope, q]);

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
            {rows.map(({ a, lead, share28, share23 }) => {
              const diff = share28 !== null && share23 !== null ? share28 - share23 : null;
              return (
                <tr key={a.no} className="border-t border-border/60">
                  <td className="px-2 py-1.5 font-medium">{a.no}. {a.name}{a.reservation ? ` (${a.reservation})` : ""}</td>
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
      <p className="mt-1.5 text-[10.5px] text-muted-foreground">2023 is that assembly&apos;s actual share for the same party shown in 2028. Ranked by 2028 lead share.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Devices
 * ------------------------------------------------------------------ */
function DevicesChart({ device, total }: { device: Record<string, number>; total: number }) {
  const rows = Object.entries(device).sort((a, b) => b[1] - a[1]).slice(0, 14);
  if (!rows.length) return <Empty text="No device metadata in this scope." />;
  return (
    <div className="space-y-2">
      {rows.map(([brand, n]) => {
        const m = brandMarker(brand, "png");
        return (
          <div key={brand} className="grid grid-cols-[34px_110px_minmax(0,1fr)_92px] items-center gap-2">
            <span className="grid h-7 w-9 place-items-center rounded border border-border bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.src} alt="" className="h-5 w-7 object-contain" />
            </span>
            <span className="truncate text-[11.5px] font-medium" title={m.brand}>{m.brand}</span>
            <span className="h-2.5 rounded-sm bg-foreground/35" style={{ width: `${(n / total) * 100}%` }} />
            <span className="whitespace-nowrap text-right text-[11px] tabular-nums">{fmtPct((n / total) * 100)}</span>
          </div>
        );
      })}
      <p className="text-[10.5px] leading-relaxed text-muted-foreground">
        Aggregate observed/predicted metadata from {fmtInt(total)} original entries. Not proof of a verified handset, a unique
        voter or political preference.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Age
 * ------------------------------------------------------------------ */
function AgeChart({ age }: { age: AgeRow[] }) {
  const rows = age.filter((r) => r.answered > 0);
  if (!rows.length) return <Empty />;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.band}>
          <div className="mb-1 flex items-baseline justify-between text-[11px]">
            <span className="font-medium">{r.band === "(missing)" ? "Age not supplied" : r.band}</span>
          </div>
          <div className="flex h-3.5 overflow-hidden rounded bg-muted/30">
            {CONTESTED.map((p) => {
              const n = r.parties[p] ?? 0;
              if (!n) return null;
              return <span key={p} title={`${partyMeta(p).label}: ${fmtPct((n / r.answered) * 100)}`} style={{ width: `${(n / r.answered) * 100}%`, background: C(p) }} />;
            })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        {CONTESTED.map((p) => (
          <span key={p} className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="size-2 rounded-sm" style={{ background: C(p) }} />{partyMeta(p).short}</span>
        ))}
      </div>
      <p className="text-[10.5px] text-muted-foreground">Missing ages are retained as their own band; sparse groups are not redistributed.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Analysis container
 * ------------------------------------------------------------------ */
export default function TelanganaAnalysis({
  scope, age, rounds, daily, statewide, chart, onChart, parties, onParties,
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
}) {
  const active = CHARTS.find((c) => c.id === chart) ?? CHARTS[0];
  const [full, setFull] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <section
      aria-label="Telangana analysis"
      className={cn(
        "scroll-mt-24 rounded-2xl border border-border bg-card",
        full && "fixed inset-2 z-[70] flex flex-col overflow-auto shadow-2xl sm:inset-4",
      )}
    >
      {/* header: region + party filters */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Selected region</p>
          <h2 className="mt-0.5 truncate font-display text-xl font-semibold leading-tight">{scope.label}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Parties</span>
          {CONTESTED.map((p) => {
            const on = parties.includes(p);
            return (
              <button key={p} type="button" onClick={() => onParties(on ? parties.filter((x) => x !== p) : [...parties, p])} aria-pressed={on}
                className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-colors", on ? "border-border bg-background text-foreground" : "border-transparent text-muted-foreground/60")}>
                <span className="size-2 rounded-sm" style={{ background: on ? C(p) : "var(--border)" }} />
                {partyMeta(p).short}
              </button>
            );
          })}
        </div>
      </div>

      {/* grouped navigation row */}
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

      <div ref={bodyRef} className={cn("p-4 sm:p-5", full && "flex-1")}>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="font-display text-[13px] font-semibold">{active.label}</h3>
          <p className="text-[10.5px] text-muted-foreground">{active.note}</p>
        </div>
        <div className={cn("min-h-[300px]", full && "h-[calc(100vh-13rem)]")}>
          {chart === "share" && <PartyShareChart scope={scope} />}
          {chart === "seats" && <SeatsChart statewide={statewide} />}
          {chart === "vote" && <VoteShareChart scope={scope} />}
          {chart === "swing" && <SwingChart scope={scope} />}
          {chart === "survey" && <SurveyChart scope={scope} />}
          {chart === "trend" && <TrendChart scope={scope} rounds={rounds} daily={daily} />}
          {chart === "assemblies" && <AssembliesChart scope={scope} />}
          {chart === "devices" && <DevicesChart device={scope.device} total={scope.deviceTotal} />}
          {chart === "age" && <AgeChart age={age} />}
        </div>
      </div>
    </section>
  );
}
