"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { partyMeta } from "@/lib/telangana/parties";
import { brandMarker } from "@/lib/telangana/brands";
import { fmtInt, fmtPct, fmtPp, type AgeRow, type AcRecord, type Counts, type PartyShare, type RoundRow, type StatewideRow } from "@/lib/telangana/model";
import { cn } from "@/lib/utils";

export type ChartId = "share" | "seats" | "swing" | "trend" | "assemblies" | "devices" | "age";

export const CHARTS: { id: ChartId; label: string; note: string }[] = [
  { id: "share", label: "Party share", note: "2028 survey scenario · answered questions" },
  { id: "seats", label: "Seats", note: "Actual 2018 and 2023 results · statewide" },
  { id: "swing", label: "Swing", note: "Percentage points vs the zero line" },
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
const ACTUAL = "var(--foreground)";
const pctOf = (s: PartyShare[], p: string) => s.find((x) => x.party === p)?.share ?? null;

function Empty({ text = "No answered survey responses in this scope." }: { text?: string }) {
  return <p className="grid min-h-[220px] place-items-center text-center text-[12px] text-muted-foreground">{text}</p>;
}

/* ---------------- Party share ---------------- */
function PartyShareChart({ scope }: { scope: ScopeData }) {
  if (!scope.answered2028) return <Empty />;
  return (
    <div className="space-y-2.5">
      {scope.shares2028.filter((s) => s.party !== "NOTA").map((s) => {
        const s23 = pctOf(scope.shares2023, s.party);
        const diff = s.count > 0 && s.share !== null && s23 !== null ? s.share - s23 : null;
        return (
          <div key={s.party} className="grid grid-cols-[92px_minmax(0,1fr)_132px] items-center gap-2">
            <span className="flex items-center gap-1.5 text-[12px] font-medium">
              <span className="size-2.5 rounded-sm" style={{ background: partyMeta(s.party).color }} />
              {partyMeta(s.party).label}
            </span>
            <span className="h-5 overflow-hidden rounded bg-muted/40">
              <span className="block h-full rounded" style={{ width: `${Math.max(0.5, s.share ?? 0)}%`, background: partyMeta(s.party).color }} />
            </span>
            <span className="whitespace-nowrap text-right text-[12px] tabular-nums">
              <b>{s.count === 0 ? "—" : fmtPct(s.share)}</b>
              {diff !== null && <span className={cn("ml-1.5 text-[10.5px]", diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{fmtPp(diff)}</span>}
            </span>
          </div>
        );
      })}
      <p className="pt-1 text-[10.5px] text-muted-foreground">
        {fmtInt(scope.answered2028)} answered 2028 questions. The pp figure is the survey difference vs actual 2023 — not a measured swing.
        Options with no recorded answers show “—”; that does not establish zero electorate support.
      </p>
    </div>
  );
}

/* ---------------- Seats (actual only) ---------------- */
function SeatsChart({ statewide }: { statewide: StatewideRow[] }) {
  const rows = statewide.filter((r) => r.seats2018 > 0 || r.seats2023 > 0).sort((a, b) => b.seats2023 - a.seats2023);
  if (!rows.length) return <Empty text="No seat results in the supplied tables." />;
  const max = Math.max(...rows.flatMap((r) => [r.seats2018, r.seats2023]), 1);
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-[10.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm" style={{ background: ACTUAL, opacity: 0.35 }} /> 2018 actual</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm" style={{ background: ACTUAL }} /> 2023 actual</span>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.party} className="grid grid-cols-[92px_minmax(0,1fr)_72px] items-center gap-2">
            <span className="text-[12px] font-medium">{partyMeta(r.party).label}</span>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 rounded-sm" style={{ width: `${(r.seats2018 / max) * 100}%`, background: ACTUAL, opacity: 0.35 }} />
                <span className="text-[10px] tabular-nums text-muted-foreground">{r.seats2018}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 rounded-sm" style={{ width: `${(r.seats2023 / max) * 100}%`, background: partyMeta(r.party).color }} />
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
        Seat counts are the actual statewide 2018 and 2023 results from the supplied result tables. A 2028 seat projection is
        <b className="text-foreground/80"> unavailable</b>: no supported seat model is supplied, and survey shares are not converted into seats here.
      </p>
    </div>
  );
}

/* ---------------- Swing (diverging, zero line) ---------------- */
function SwingChart({ scope }: { scope: ScopeData }) {
  const [mode, setMode] = useState<"actual" | "survey">("actual");
  const rows = useMemo(() => {
    if (mode === "actual") {
      return CONTESTED.map((p) => {
        const a = pctOf(scope.shares2018, p), b = pctOf(scope.shares2023, p);
        return { p, from: a, to: b, delta: a !== null && b !== null ? b - a : null };
      });
    }
    return CONTESTED.map((p) => {
      const a = pctOf(scope.shares2023, p), b = pctOf(scope.shares2028, p);
      return { p, from: a, to: b, delta: a !== null && b !== null ? b - a : null };
    });
  }, [scope, mode]);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.delta ?? 0)));
  const sorted = [...rows].sort((a, b) => (b.delta ?? -999) - (a.delta ?? -999));

  return (
    <div>
      <div className="mb-3 inline-flex rounded-full border border-border p-0.5">
        {([["actual", "2018 → 2023 actual"], ["survey", "2023 → 2028 survey"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setMode(id)} aria-pressed={mode === id}
            className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors", mode === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {sorted.map((r) => {
          const d = r.delta;
          const w = d === null ? 0 : (Math.abs(d) / maxAbs) * 50;
          return (
            <div key={r.p} className="grid grid-cols-[92px_minmax(0,1fr)_92px] items-center gap-2">
              <span className="text-[12px] font-medium">{partyMeta(r.p).label}</span>
              <div className="relative h-5 rounded bg-muted/25">
                <span className="absolute inset-y-0 left-1/2 w-px bg-border" aria-hidden />
                {d !== null && (
                  <span className={cn("absolute inset-y-1 rounded-sm", d >= 0 ? "bg-emerald-500/70" : "bg-rose-500/70")}
                    style={d >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
                )}
              </div>
              <span className={cn("whitespace-nowrap text-right text-[11px] tabular-nums", (d ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{fmtPp(d)}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
        {mode === "actual"
          ? "Historical swing = actual 2023 share − actual 2018 share, in percentage points (candidate votes + NOTA)."
          : "Survey difference = 2028 scenario share − actual 2023 share. This is not a measured election swing or confirmed voter transfer."}
      </p>
    </div>
  );
}

/* ---------------- Trend ---------------- */
function TrendChart({ rounds }: { rounds: RoundRow[] }) {
  const [batch, setBatch] = useState<number>(388);
  const series = useMemo(() => {
    const pts = rounds.filter((r) => r.batchSize === batch && r.share > 0);
    const parties = ["BRS", "INC", "BJP"];
    const byParty = parties.map((p) => ({ p, pts: pts.filter((r) => r.party === p).sort((a, b) => a.batch - b.batch) }));
    const all = byParty.flatMap((x) => x.pts.map((r) => r.share * 100));
    const rawMin = all.length ? Math.min(...all) : 0;
    const rawMax = all.length ? Math.max(...all) : 100;
    return { byParty, min: Math.max(0, Math.floor((rawMin - 2) / 5) * 5), max: Math.ceil((rawMax + 2) / 5) * 5 };
  }, [rounds, batch]);

  const W = 640, H = 230, padL = 36, padR = 12, padT = 16, padB = 30;
  const span = Math.max(1, series.max - series.min);
  const x = (i: number, n: number) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - series.min) / span) * (H - padT - padB);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {[388, 688].map((b) => (
          <button key={b} type="button" onClick={() => setBatch(b)}
            className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors", batch === b ? "border-saffron/60 bg-saffron/15 text-saffron-2" : "border-border text-muted-foreground hover:text-foreground")}>
            {b}-entry batches
          </button>
        ))}
        <span className="text-[10.5px] text-muted-foreground">2026 collection dates · dashed = uncalibrated original-entry batches</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Survey share by collection round, 2026">
        {[0, 0.5, 1].map((t) => {
          const v = series.min + span * (1 - t);
          return (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.09} />
              <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.55">{v.toFixed(0)}%</text>
            </g>
          );
        })}
        {series.byParty.map(({ p, pts }) => {
          if (!pts.length) return null;
          const d = pts.map((r, i) => `${i ? "L" : "M"}${x(i, pts.length).toFixed(1)},${y(r.share * 100).toFixed(1)}`).join(" ");
          return (
            <g key={p}>
              <path d={d} fill="none" stroke={partyMeta(p).color} strokeWidth="1.9" strokeDasharray="5 3" strokeLinecap="round" />
              {pts.map((r, i) => <circle key={r.batch} cx={x(i, pts.length)} cy={y(r.share * 100)} r="2.3" fill={partyMeta(p).color} />)}
            </g>
          );
        })}
        {series.byParty.map(({ p }, i) => (
          <g key={`l-${p}`}>
            <line x1={padL + 4} x2={padL + 20} y1={padT + 6 + i * 12} y2={padT + 6 + i * 12} stroke={partyMeta(p).color} strokeWidth="2" strokeDasharray="4 2" />
            <text x={padL + 24} y={padT + 9 + i * 12} fontSize="9.5" fill="currentColor" opacity="0.75">{partyMeta(p).label}</text>
          </g>
        ))}
        <text x={padL} y={H - 8} fontSize="8.5" fill="currentColor" opacity="0.55">{series.byParty[0]?.pts[0]?.from.slice(0, 10)}</text>
        <text x={W - padR} y={H - 8} textAnchor="end" fontSize="8.5" fill="currentColor" opacity="0.55">{series.byParty[0]?.pts.at(-1)?.to.slice(0, 10)}</text>
      </svg>
      <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
        Weighted rolling share = party answers ÷ answered entries in each window. Batches are a grouping choice, not a random-sample
        or margin-of-error claim. Collection happened in 2026; actual 2018/2023 results are shown in the Seats and Swing views.
      </p>
    </div>
  );
}

/* ---------------- Assemblies ---------------- */
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
        low: a.answered2028 > 0 && a.answered2028 < 30,
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
      <div className="max-h-[340px] overflow-auto rounded-lg border border-border">
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
                    {lead ? <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm" style={{ background: partyMeta(lead).color }} />{partyMeta(lead).short}</span> : <span className="text-muted-foreground">No answers</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {a.answered2028 > 0 ? fmtPct(share28) : "—"}
                    {a.answered2028 > 0 && a.answered2028 < 30 && (
                      <span title={`Low sample: ${a.answered2028} answered rows`} className="ml-1 rounded bg-amber-500/15 px-1 text-[8.5px] font-semibold text-amber-700 dark:text-amber-400">low n</span>
                    )}
                  </td>
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

/* ---------------- Devices ---------------- */
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
            <span className="h-4 overflow-hidden rounded bg-muted/40">
              <span className="block h-full rounded bg-foreground/40" style={{ width: `${(n / total) * 100}%` }} />
            </span>
            <span className="whitespace-nowrap text-right text-[11px] tabular-nums">{fmtPct((n / total) * 100)} <span className="text-muted-foreground">({fmtInt(n)})</span></span>
          </div>
        );
      })}
      <p className="text-[10.5px] leading-relaxed text-muted-foreground">
        Brand composition from {fmtInt(total)} original entries (expanded scenario rows are never counted as extra devices).
        Aggregate observed/predicted metadata — not proof of a verified handset, a unique voter or political preference.
      </p>
    </div>
  );
}

/* ---------------- Age ---------------- */
function AgeChart({ age }: { age: AgeRow[] }) {
  const rows = age.filter((r) => r.answered > 0);
  if (!rows.length) return <Empty />;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.band}>
          <div className="mb-1 flex items-baseline justify-between text-[11px]">
            <span className="font-medium">{r.band === "(missing)" ? "Age not supplied" : r.band}</span>
            <span className="text-muted-foreground">{fmtInt(r.answered)} answered</span>
          </div>
          <div className="flex h-3.5 overflow-hidden rounded bg-muted/30">
            {CONTESTED.map((p) => {
              const n = r.parties[p] ?? 0;
              if (!n) return null;
              return <span key={p} title={`${partyMeta(p).label}: ${fmtPct((n / r.answered) * 100)}`} style={{ width: `${(n / r.answered) * 100}%`, background: partyMeta(p).color }} />;
            })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        {CONTESTED.map((p) => (
          <span key={p} className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="size-2 rounded-sm" style={{ background: partyMeta(p).color }} />{partyMeta(p).short}</span>
        ))}
      </div>
      <p className="text-[10.5px] text-muted-foreground">Missing ages are retained as their own band; sparse groups are not redistributed.</p>
    </div>
  );
}

/* ---------------- analysis container ---------------- */
export default function TelanganaAnalysis({
  scope, age, rounds, statewide, chart, onChart, parties, onParties,
}: {
  scope: ScopeData;
  age: AgeRow[];
  rounds: RoundRow[];
  statewide: StatewideRow[];
  chart: ChartId;
  onChart: (id: ChartId) => void;
  parties: string[];
  onParties: (p: string[]) => void;
}) {
  const active = CHARTS.find((c) => c.id === chart) ?? CHARTS[0];
  return (
    <section aria-label="Telangana analysis" className="mt-6 rounded-2xl border border-border bg-card">
      {/* header: selected region */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Selected region</p>
          <h2 className="mt-0.5 truncate font-display text-xl font-semibold leading-tight">{scope.label}</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {scope.acs.length} assembl{scope.acs.length === 1 ? "y" : "ies"} · {fmtInt(scope.answered2028)} answered in 2028 · actual 2018 &amp; 2023
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Parties</span>
          {CONTESTED.map((p) => {
            const on = parties.includes(p);
            return (
              <button key={p} type="button" onClick={() => onParties(on ? parties.filter((x) => x !== p) : [...parties, p])} aria-pressed={on}
                className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-colors", on ? "border-border bg-background text-foreground" : "border-transparent text-muted-foreground/60")}>
                <span className="size-2 rounded-sm" style={{ background: on ? partyMeta(p).color : "var(--border)" }} />
                {partyMeta(p).short}
              </button>
            );
          })}
        </div>
      </div>

      {/* toolbar: labelled chart selector */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 sm:px-5" role="tablist" aria-label="Chart selector">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">View</span>
        {CHARTS.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={chart === c.id} onClick={() => onChart(c.id)}
            className={cn("rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60",
              chart === c.id ? "border-saffron/60 bg-saffron/15 text-saffron-2" : "border-border text-muted-foreground hover:text-foreground")}>
            {c.label}
          </button>
        ))}
      </div>

      {/* body: consistent height */}
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="font-display text-[13px] font-semibold">{active.label}</h3>
          <p className="text-[10.5px] text-muted-foreground">{active.note}</p>
        </div>
        <div className="min-h-[300px]">
          {chart === "share" && <PartyShareChart scope={scope} />}
          {chart === "seats" && <SeatsChart statewide={statewide} />}
          {chart === "swing" && <SwingChart scope={scope} />}
          {chart === "trend" && <TrendChart rounds={rounds} />}
          {chart === "assemblies" && <AssembliesChart scope={scope} />}
          {chart === "devices" && <DevicesChart device={scope.device} total={scope.deviceTotal} />}
          {chart === "age" && <AgeChart age={age} />}
        </div>
      </div>
    </section>
  );
}
