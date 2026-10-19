"use client";

import { useMemo, useState } from "react";
import { partyMeta } from "@/lib/telangana/parties";
import { brandMarker } from "@/lib/telangana/brands";
import { fmtInt, fmtPct, fmtPp, type Counts, type PartyShare } from "@/lib/telangana/model";
import type { AgeRow, BrandRow, RoundRow, AcRecord } from "@/lib/telangana/model";
import { cn } from "@/lib/utils";

export type ChartId = "share" | "swing" | "scenario" | "trend" | "assemblies" | "age" | "device";

export const CHARTS: { id: ChartId; label: string; note: string }[] = [
  { id: "share", label: "Party share", note: "2028 survey scenario, answered questions" },
  { id: "swing", label: "2018 → 2023", note: "Actual results (candidate votes + NOTA)" },
  { id: "scenario", label: "2023 → 2028", note: "Actual 2023 vs survey scenario" },
  { id: "trend", label: "Trend", note: "Original entries · 2026 collection dates" },
  { id: "assemblies", label: "Assemblies", note: "Ranked within the current scope" },
  { id: "age", label: "Age groups", note: "Answered 2028 questions by supplied age" },
  { id: "device", label: "Device mix", note: "Original-entry device metadata" },
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

function Section({ title, note, children, className }: { title: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 sm:p-5", className)}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
        {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="py-6 text-center text-[12px] text-muted-foreground">No answered survey responses in this scope.</p>;
}

/* ---------------- 1. party share ---------------- */
function PartyShareChart({ scope }: { scope: ScopeData }) {
  if (!scope.answered2028) return <Empty />;
  return (
    <div className="space-y-2.5">
      {scope.shares2028.filter((s) => s.party !== "NOTA").map((s) => {
        const s23 = pctOf(scope.shares2023, s.party);
        const diff = s.count > 0 && s.share !== null && s23 !== null ? s.share - s23 : null;
        const shown = s.count === 0 ? "—" : fmtPct(s.share);
        return (
          <div key={s.party} className="grid grid-cols-[76px_minmax(0,1fr)_104px] items-center gap-2">
            <span className="flex items-center gap-1.5 text-[12px] font-medium">
              <span className="size-2.5 rounded-sm" style={{ background: partyMeta(s.party).color }} />
              {partyMeta(s.party).label}
            </span>
            <span className="h-5 overflow-hidden rounded bg-muted/40">
              <span className="block h-full rounded" style={{ width: `${Math.max(0.5, s.share ?? 0)}%`, background: partyMeta(s.party).color }} />
            </span>
            <span className="whitespace-nowrap text-right text-[12px] tabular-nums">
              <b>{shown}</b>
              <span className={cn("ml-1.5 text-[10.5px]", (diff ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                {diff === null ? "" : fmtPp(diff)}
              </span>
            </span>
          </div>
        );
      })}
      <p className="pt-1 text-[10.5px] text-muted-foreground">
        {fmtInt(scope.answered2028)} answered 2028 questions. The pp figure is the survey difference vs actual 2023 — not a measured swing.
        Options with no recorded answers are shown as “—”; that does not establish zero electorate support.
      </p>
    </div>
  );
}

/* ---------------- 2. actual 2018 → 2023 ---------------- */
function SwingChart({ scope }: { scope: ScopeData }) {
  const rows = CONTESTED.map((p) => ({ p, s18: pctOf(scope.shares2018, p), s23: pctOf(scope.shares2023, p) }))
    .filter((r) => r.s18 != null || r.s23 != null)
    .sort((a, b) => (b.s23 ?? 0) - (a.s23 ?? 0));
  if (!rows.length) return <Empty />;
  const max = Math.max(...rows.flatMap((r) => [r.s18 ?? 0, r.s23 ?? 0]), 1);
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const swing = r.s18 !== null && r.s23 !== null ? r.s23 - r.s18 : null;
        return (
          <div key={r.p} className="grid grid-cols-[86px_minmax(0,1fr)_80px] items-center gap-2">
            <span className="text-[12px] font-medium">{partyMeta(r.p).label}</span>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 rounded-sm bg-foreground/25" style={{ width: `${((r.s18 ?? 0) / max) * 100}%` }} />
                <span className="text-[10px] tabular-nums text-muted-foreground">{fmtPct(r.s18)} <span className="opacity-60">2018</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 rounded-sm" style={{ width: `${((r.s23 ?? 0) / max) * 100}%`, background: partyMeta(r.p).color }} />
                <span className="text-[10px] tabular-nums text-foreground/80">{fmtPct(r.s23)} <span className="opacity-60">2023</span></span>
              </div>
            </div>
            <span className={cn("text-right text-[11px] tabular-nums font-medium", (swing ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {fmtPp(swing)}
            </span>
          </div>
        );
      })}
      <p className="text-[10.5px] text-muted-foreground">Actual results. Historical swing = 2023 share − 2018 share; denominator is candidate votes + NOTA.</p>
    </div>
  );
}

/* ---------------- 3. 2023 actual → 2028 survey ---------------- */
function ScenarioChart({ scope }: { scope: ScopeData }) {
  const rows = CONTESTED.map((p) => ({ p, s23: pctOf(scope.shares2023, p), s28: pctOf(scope.shares2028, p) }))
    .filter((r) => r.s23 != null || r.s28 != null)
    .sort((a, b) => (b.s28 ?? 0) - (a.s28 ?? 0));
  if (!rows.length) return <Empty />;
  const max = Math.max(...rows.flatMap((r) => [r.s23 ?? 0, r.s28 ?? 0]), 1);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-[10.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm" style={{ background: ACTUAL, opacity: 0.45 }} /> Actual 2023</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm border border-dashed border-foreground/60" /> Survey 2028</span>
      </div>
      {rows.map((r) => {
        const diff = r.s28 !== null && r.s23 !== null ? r.s28 - r.s23 : null;
        return (
          <div key={r.p} className="grid grid-cols-[86px_minmax(0,1fr)_80px] items-center gap-2">
            <span className="text-[12px] font-medium">{partyMeta(r.p).label}</span>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 rounded-sm" style={{ width: `${((r.s23 ?? 0) / max) * 100}%`, background: ACTUAL, opacity: 0.4 }} />
                <span className="text-[10px] tabular-nums text-muted-foreground">{fmtPct(r.s23)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 rounded-sm border border-dashed border-foreground/40" style={{ width: `${((r.s28 ?? 0) / max) * 100}%`, background: partyMeta(r.p).color, opacity: 0.85 }} />
                <span className="text-[10px] tabular-nums text-foreground/80">{fmtPct(r.s28)}</span>
              </div>
            </div>
            <span className={cn("text-right text-[11px] tabular-nums font-medium", (diff ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {fmtPp(diff)}
            </span>
          </div>
        );
      })}
      <p className="text-[10.5px] text-muted-foreground">Survey difference vs 2023, not a measured election swing or confirmed voter transfer.</p>
    </div>
  );
}

/* ---------------- 4. trend (2026 collection) ---------------- */
function TrendChart({ rounds }: { rounds: RoundRow[] }) {
  const [batch, setBatch] = useState<number>(388);
  const series = useMemo(() => {
    const pts = rounds.filter((r) => r.batchSize === batch && r.share > 0);
    const parties = ["BRS", "INC", "BJP"];
    const byParty = parties.map((p) => ({
      p,
      pts: pts.filter((r) => r.party === p).sort((a, b) => a.batch - b.batch),
    }));
    const all = byParty.flatMap((x) => x.pts.map((r) => r.share * 100));
    const rawMin = all.length ? Math.min(...all) : 0;
    const rawMax = all.length ? Math.max(...all) : 100;
    const min = Math.max(0, Math.floor((rawMin - 2) / 5) * 5);
    const max = Math.ceil((rawMax + 2) / 5) * 5;
    return { byParty, min, max, n: pts.length };
  }, [rounds, batch]);

  const W = 640, H = 190, padL = 34, padR = 10, padT = 14, padB = 26;
  const span = Math.max(1, series.max - series.min);
  const x = (i: number, n: number) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - series.min) / span) * (H - padT - padB);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {[388, 688].map((b) => (
          <button key={b} type="button" onClick={() => setBatch(b)}
            className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              batch === b ? "border-saffron/60 bg-saffron/15 text-saffron-2" : "border-border text-muted-foreground hover:text-foreground")}>
            {b}-entry batches
          </button>
        ))}
        <span className="text-[10.5px] text-muted-foreground">2026 collection dates · dashed = uncalibrated original-entry batches</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Survey share by collection round, 2026">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const v = series.min + span * (1 - t);
          return (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.08} />
              <text x={padL - 5} y={y(v) + 3} textAnchor="end" fontSize="8" fill="currentColor" opacity="0.55">{v.toFixed(0)}%</text>
            </g>
          );
        })}
        {series.byParty.map(({ p, pts }) => {
          if (!pts.length) return null;
          const d = pts.map((r, i) => `${i ? "L" : "M"}${x(i, pts.length).toFixed(1)},${y(r.share * 100).toFixed(1)}`).join(" ");
          return (
            <g key={p}>
              <path d={d} fill="none" stroke={partyMeta(p).color} strokeWidth="1.8" strokeDasharray="5 3" strokeLinecap="round" />
              {pts.map((r, i) => <circle key={r.batch} cx={x(i, pts.length)} cy={y(r.share * 100)} r="2.2" fill={partyMeta(p).color} />)}
            </g>
          );
        })}
        {series.byParty.map(({ p, pts }, i) => (
          <g key={`l-${p}`}>
            <line x1={padL + 4} x2={padL + 20} y1={padT + 6 + i * 12} y2={padT + 6 + i * 12} stroke={partyMeta(p).color} strokeWidth="2" strokeDasharray="4 2" />
            <text x={padL + 24} y={padT + 9 + i * 12} fontSize="9" fill="currentColor" opacity="0.75">{partyMeta(p).label}</text>
          </g>
        ))}
        <text x={padL} y={H - 6} fontSize="8.5" fill="currentColor" opacity="0.55">{series.byParty[0]?.pts[0]?.from.slice(0, 10)}</text>
        <text x={W - padR} y={H - 6} textAnchor="end" fontSize="8.5" fill="currentColor" opacity="0.55">{series.byParty[0]?.pts.at(-1)?.to.slice(0, 10)}</text>
      </svg>
      <p className="mt-1 text-[10.5px] text-muted-foreground">
        Weighted rolling share = party answers ÷ answered entries in each window. Batches are a grouping choice, not a random-sample or margin-of-error claim.
        Actual 2023 shares are shown in the 2018 → 2023 and 2023 → 2028 views.
      </p>
    </div>
  );
}

/* ---------------- 5. assemblies ---------------- */
function AssembliesChart({ scope }: { scope: ScopeData }) {
  const rows = scope.acs
    .map((a) => {
      const total28 = Object.values(a.a2028).reduce((s, n) => s + n, 0);
      const best = CONTESTED.map((p) => ({ p, n: a.a2028[p] ?? 0 })).sort((x, y) => y.n - x.n)[0];
      const total23 = Object.values(a.v2023).reduce((s, n) => s + n, 0);
      const n23 = a.v2023[best?.p ?? ""] ?? 0;
      return {
        a,
        lead: best?.p ?? null,
        share28: total28 && best ? (best.n / total28) * 100 : null,
        share23: total23 && best ? (n23 / total23) * 100 : null,
        low: a.answered2028 > 0 && a.answered2028 < 30,
      };
    })
    .sort((x, y) => (y.share28 ?? -1) - (x.share28 ?? -1));

  return (
    <div>
      <div className="max-h-[380px] overflow-auto rounded-lg border border-border">
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
      </div>
      <p className="mt-1.5 text-[10.5px] text-muted-foreground">2023 column is that AC's actual share for the same party in 2028. Ranked by 2028 lead share.</p>
    </div>
  );
}

/* ---------------- 6. age ---------------- */
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
      <p className="text-[10.5px] text-muted-foreground">Missing ages are retained as their own band; they are not redistributed.</p>
    </div>
  );
}

/* ---------------- 7. device mix ---------------- */
function DeviceChart({ device, total }: { device: Record<string, number>; total: number }) {
  const rows = Object.entries(device).sort((a, b) => b[1] - a[1]).slice(0, 14);
  if (!rows.length) return <Empty />;
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
      <p className="text-[10.5px] text-muted-foreground">
        Aggregate observed/predicted device metadata from {fmtInt(total)} original entries. A brand is not proof of a verified handset, unique voter or political preference.
      </p>
    </div>
  );
}

/* ---------------- tabs ---------------- */
export default function TelanganaCharts({
  scope, age, rounds, chart, onChart,
}: {
  scope: ScopeData;
  age: AgeRow[];
  rounds: RoundRow[];
  chart: ChartId;
  onChart: (id: ChartId) => void;
}) {
  const active = CHARTS.find((c) => c.id === chart) ?? CHARTS[0];
  return (
    <section aria-label="Telangana analysis charts" className="mt-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Chart selector">
        {CHARTS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={chart === c.id}
            onClick={() => onChart(c.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60",
              chart === c.id ? "border-saffron/60 bg-saffron/15 text-saffron-2" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <Section title={active.label} note={active.note}>
        {chart === "share" && <PartyShareChart scope={scope} />}
        {chart === "swing" && <SwingChart scope={scope} />}
        {chart === "scenario" && <ScenarioChart scope={scope} />}
        {chart === "trend" && <TrendChart rounds={rounds} />}
        {chart === "assemblies" && <AssembliesChart scope={scope} />}
        {chart === "age" && <AgeChart age={age} />}
        {chart === "device" && <DeviceChart device={scope.device} total={scope.deviceTotal} />}
      </Section>
    </section>
  );
}

/* end of charts */
