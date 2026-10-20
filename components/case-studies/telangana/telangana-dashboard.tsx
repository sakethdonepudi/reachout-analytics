"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Check, ChevronRight, Layers, MapPin, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { TG_PARTIES, PARTY_META, partyMeta } from "@/lib/telangana/parties";
import {
  acsInScope, combineAcs, fmtInt, fmtPct, fmtPp, leadingParty, partyShares, SMALL_SAMPLE,
  type AcRecord, type Baseline,
} from "@/lib/telangana/model";
import { cn } from "@/lib/utils";
import TelanganaAnalysis, { type ChartId, type ScopeData } from "./telangana-charts";
import AboutTelangana from "./about-telangana";
import type { MapTheme } from "./telangana-map";

const TelanganaMap = dynamic(() => import("./telangana-map"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading Telangana…</div>,
});

type Payload = Baseline & {
  published: boolean;
  importVersion: string | null;
  importAt: string | null;
  historicalSourceVersion: string;
  originalEntrySource: string;
};

const CONTESTED = ["BRS", "INC", "BJP", "AIMIM", "TDP", "JSP", "Others"] as const;
const LABEL = "text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";

export default function TelanganaDashboard() {
  const { theme } = useTheme();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<number | null>(null);
  const requestSeq = useRef(0);

  const [group, setGroup] = useState<string | null>(null);
  const [selectedAcs, setSelectedAcs] = useState<number[]>([]);
  const [layer, setLayer] = useState<"party" | "device">("party");
  const [showLabels, setShowLabels] = useState(false);
  const [chart, setChart] = useState<ChartId>("share");
  const [parties, setParties] = useState<string[]>([...CONTESTED]);
  const [resetNonce, setResetNonce] = useState(0);
  const [hover, setHover] = useState<{ ac: number; x: number; y: number } | null>(null);
  const [acFilter, setAcFilter] = useState("");

  const load = useCallback(async (isRefresh: boolean) => {
    const controller = new AbortController();
    const seq = ++requestSeq.current;
    if (isRefresh) { setUpdating(true); setRefreshError(null); }
    try {
      const r = await fetch("/api/public/case-studies/telangana/aggregates", { cache: "no-store", signal: controller.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: Payload = await r.json();
      // a slower, older response must never overwrite a newer selection/request
      if (seq !== requestSeq.current) return;
      setData(d);
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setRefreshError(null);
      if (isRefresh) {
        setFlash(true);
        if (flashTimer.current) window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setFlash(false), 1400);
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : "Could not load Telangana aggregates";
      if (isRefresh) setRefreshError(msg);
      else setError(msg);
    } finally {
      if (isRefresh) setUpdating(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);
  useEffect(() => () => { if (flashTimer.current) window.clearTimeout(flashTimer.current); }, []);

  const acByNo = useMemo(() => new Map((data?.acs ?? []).map((a) => [a.no, a])), [data]);
  const groups = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, { group: string; acs: AcRecord[] }>();
    for (const a of data.acs) {
      const g = m.get(a.group) ?? { group: a.group, acs: [] };
      g.acs.push(a);
      m.set(a.group, g);
    }
    return [...m.values()].sort((a, b) => a.group.localeCompare(b.group));
  }, [data]);

  const scopeAcs = useMemo(() => (data ? acsInScope(data, { district: group, acs: selectedAcs }) : []), [data, group, selectedAcs]);
  const agg = useMemo(() => combineAcs(scopeAcs), [scopeAcs]);
  const shares2028 = useMemo(() => partyShares(agg.a2028, [...TG_PARTIES], agg.answered2028), [agg]);
  const shares2023 = useMemo(() => partyShares(agg.v2023, [...TG_PARTIES], agg.total2023), [agg]);
  const shares2018 = useMemo(() => partyShares(agg.v2018, [...TG_PARTIES], agg.total2018), [agg]);

  const scope: ScopeData = useMemo(() => ({
    label: selectedAcs.length
      ? selectedAcs.length === 1 ? acByNo.get(selectedAcs[0])?.name ?? "1 assembly" : `${selectedAcs.length} assemblies`
      : group ?? "Statewide",
    acs: scopeAcs,
    counts2028: agg.a2028, answered2028: agg.answered2028,
    counts2023: agg.v2023, total2023: agg.total2023,
    counts2018: agg.v2018, total2018: agg.total2018,
    shares2028, shares2023, shares2018,
    device: agg.device, deviceTotal: agg.deviceTotal,
  }), [scopeAcs, agg, shares2028, shares2023, shares2018, selectedAcs, acByNo, group]);

  /* age cross-tab follows the same geography (per-AC age counts are bundled) */
  const scopedAge = useMemo(() => {
    if (!data) return [];
    const byBand = new Map<string, Record<string, number>>();
    for (const a of scopeAcs) {
      for (const [band, counts] of Object.entries(a.ageByAc ?? {})) {
        const b = byBand.get(band) ?? {};
        for (const [party, n] of Object.entries(counts)) b[party] = (b[party] ?? 0) + n;
        byBand.set(band, b);
      }
    }
    if (!byBand.size) return data.age;
    const ORDER = ["18–25", "26-35", "36–45", "46–60", "60+", "(missing)"];
    return ORDER.filter((b) => byBand.has(b)).map((band) => {
      const parties = byBand.get(band)!;
      return { band, answered: Object.values(parties).reduce((s, n) => s + n, 0), parties };
    });
  }, [data, scopeAcs]);

  const lead = useMemo(() => leadingParty(agg.a2028, CONTESTED as unknown as string[]), [agg]);

  const reset = useCallback(() => {
    setGroup(null); setSelectedAcs([]); setLayer("party"); setShowLabels(false); setResetNonce((n) => n + 1);
  }, []);
  const selectGroup = useCallback((g: string | null) => { setGroup(g); setSelectedAcs([]); setAcFilter(""); }, []);
  const toggleAc = useCallback((no: number, additive: boolean) => {
    setSelectedAcs((prev) => (additive ? (prev.includes(no) ? prev.filter((x) => x !== no) : [...prev, no]) : prev.length === 1 && prev[0] === no ? [] : [no]));
  }, []);

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
        <div><h1 className="font-display text-2xl font-semibold">Telangana data unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p></div>
      </main>
    );
  }
  if (!data) {
    return <main className="grid min-h-screen place-items-center bg-background text-foreground"><p className="text-sm text-muted-foreground">Loading Telangana election intelligence…</p></main>;
  }

  const groupAcs = group ? groups.find((g) => g.group === group)?.acs ?? [] : [];
  const filteredGroupAcs = groupAcs.filter((a) => !acFilter || a.name.toLowerCase().includes(acFilter.toLowerCase()) || String(a.no) === acFilter);
  const hoveredAc = hover ? acByNo.get(hover.ac) : null;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_18%_8%,rgba(245,138,36,0.07),transparent_60%)]" aria-hidden />

      <section className="relative isolate mx-auto max-w-[1720px] px-4 pb-4 pt-24 sm:pt-28 lg:h-[100svh] lg:min-h-[780px] lg:overflow-hidden lg:px-6 lg:pt-20">
        {/* left column: heading → context → filters, one spacing system */}
        <aside aria-label="Filters" className="relative z-30 lg:absolute lg:left-8 lg:top-24 lg:w-[284px] lg:max-h-[calc(100svh-7rem)] lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]">
          <Link href="/case-studies" className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-[12.5px] text-muted-foreground backdrop-blur-xl transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
            <ArrowLeft className="size-3.5" /> Back to Case Studies
          </Link>

          <h1 className="mt-4 font-display text-[clamp(34px,4vw,52px)] font-semibold leading-[0.98] tracking-[-0.03em] text-foreground">Telangana</h1>
          <p className="mt-2 text-[13px] font-semibold text-foreground/70">Election intelligence</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full border border-border bg-card/70 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
              title="The 2028 figures are a survey scenario built from a 30,000-row workbook that repeats 5,090 supplied entries."
            >
              Survey scenario
            </span>
          </div>

          <p className="mt-4 text-[13px] font-medium leading-snug text-foreground">119-assembly opinion survey · 2028 vote intentions</p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">Set against the actual 2018 and 2023 assembly results.</p>

          {group && (
            <nav aria-label="Breadcrumb" className="mt-4 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
              <button type="button" onClick={() => setSelectedAcs([])} className={cn("truncate transition-colors hover:text-foreground", !selectedAcs.length && "font-semibold text-foreground")}>{group}</button>
              {selectedAcs.length > 0 && (
                <>
                  <ChevronRight className="size-3 opacity-50" />
                  <span className="truncate font-semibold text-foreground">{selectedAcs.length === 1 ? acByNo.get(selectedAcs[0])?.name : `${selectedAcs.length} assemblies`}</span>
                </>
              )}
            </nav>
          )}

          {/* 28px before filters */}
          <div className="mt-7 space-y-4">
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                <SlidersHorizontal className="size-3.5" /> Filters
              </div>
              <p className="text-[10px] leading-snug text-muted-foreground">AC-derived analytical grouping, not an official district boundary.</p>
              <div className="mt-2 max-h-52 space-y-0.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
                <button type="button" onClick={() => selectGroup(null)}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors", !group ? "bg-saffron/15 font-semibold text-saffron-2" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground")}>
                  <span className="size-2 shrink-0 rounded-full bg-saffron/70" />
                  <span>All Telangana</span>
                </button>
                {groups.map((g) => {
                  const gLead = leadingParty(combineAcs(g.acs).a2028, CONTESTED as unknown as string[]);
                  return (
                    <button key={g.group} type="button" onClick={() => selectGroup(g.group)}
                      className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors", group === g.group ? "bg-saffron/15 font-semibold text-saffron-2" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground")}>
                      <span className="size-2 shrink-0 rounded-full ring-1 ring-inset ring-black/10" style={{ background: gLead.party ? partyMeta(gLead.party).color : "transparent", border: gLead.party ? "none" : "1px solid var(--border)" }} />
                      <span className="truncate">{g.group}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {group && (
              <div>
                <p className={LABEL}>Assemblies · multi-select</p>
                <input value={acFilter} onChange={(e) => setAcFilter(e.target.value)} placeholder="Filter assemblies"
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11.5px] outline-none focus-visible:ring-2 focus-visible:ring-saffron/50" />
                <div className="mt-1.5 max-h-44 space-y-0.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {filteredGroupAcs.map((a) => {
                    const on = selectedAcs.includes(a.no);
                    return (
                      <button key={a.no} type="button" onClick={(e) => toggleAc(a.no, e.shiftKey || e.metaKey || e.ctrlKey)}
                        className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11.5px] transition-colors", on ? "bg-saffron/15 font-semibold text-saffron-2" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground")}>
                        <span className={cn("grid size-3.5 shrink-0 place-items-center rounded-[4px] border", on ? "border-saffron bg-saffron text-[#241203]" : "border-border")}>
                          {on && <Check className="size-2.5" strokeWidth={3} />}
                        </span>
                        <span className="truncate">{a.no}. {a.name}</span>
                        {a.reservation && <span className="ml-auto text-[9px] opacity-60">{a.reservation}</span>}
                      </button>
                    );
                  })}
                  {!filteredGroupAcs.length && <p className="px-2 py-2 text-[11px] text-muted-foreground">No assemblies match.</p>}
                </div>
              </div>
            )}

            <div>
              <p className={LABEL}>Map layer</p>
              <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg border border-border p-0.5">
                {([["party", "Party mix"], ["device", "Devices"]] as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setLayer(id)}
                    className={cn("flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors", layer === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                    {id === "party" ? <MapPin className="size-3" /> : <Layers className="size-3" />}{label}
                  </button>
                ))}
              </div>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11.5px] text-muted-foreground">
                <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="size-3.5 accent-[var(--saffron)]" />
                Show labels
              </label>
            </div>

            <button type="button" onClick={reset}
              className="flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2 text-left text-[12px] font-semibold transition-colors hover:border-saffron/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
              <RotateCcw className="size-3.5 text-saffron-2" /> Reset View
            </button>
          </div>
        </aside>

        {/* map */}
        <div className="relative z-0 mt-4 h-[52svh] min-h-[380px] overflow-hidden rounded-2xl border border-border bg-card lg:absolute lg:inset-x-0 lg:top-16 lg:bottom-0 lg:mt-0 lg:h-auto lg:rounded-none lg:border-0 lg:bg-transparent">
          <TelanganaMap
            acs={data.acs}
            theme={(theme === "light" ? "light" : "dark") as MapTheme}
            group={group}
            selectedAcs={selectedAcs}
            layer={layer}
            showLabels={showLabels}
            onSelectGroup={selectGroup}
            onToggleAc={toggleAc}
            onHover={(ac, x, y) => setHover(ac == null ? null : { ac, x, y })}
            resetNonce={resetNonce}
          />
          {group && <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(62%_62%_at_50%_48%,transparent_40%,rgba(0,0,0,0.30)_100%)]" />}
        </div>

        {/* legend row, aligned to the map content width */}
        <div className="relative z-10 mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-xl border border-border bg-card/85 px-3 py-2 lg:absolute lg:bottom-4 lg:left-[330px] lg:right-[330px] lg:mt-0 lg:flex-nowrap">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Party legend">
            {CONTESTED.map((p) => (
              <span key={p} className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: PARTY_META[p].color }} />
                {PARTY_META[p].short}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: theme === "dark" ? "#2b3442" : "#e7ebef", boxShadow: "inset 0 0 0 1px rgba(120,130,145,.5)" }} />
              No answers
            </span>
          </div>
          <p className="text-[9.5px] leading-tight text-muted-foreground lg:max-w-[44%] lg:text-right">
            Fill = leading 2028 survey party; polygon area is not vote volume.
            {group ? " Analytical grouping, not an official district boundary." : " Select a district or assembly to focus."}
          </p>
        </div>

        {/* right: scope summary — names and percentages only */}
        <section className="relative z-20 mx-auto mt-4 max-w-xl rounded-2xl border border-border bg-card/85 p-4 shadow-[0_18px_50px_-30px_rgba(15,20,30,0.45)] backdrop-blur-2xl lg:absolute lg:right-6 lg:top-24 lg:mt-0 lg:max-h-[calc(100svh-8rem)] lg:w-[300px] lg:max-w-none lg:overflow-y-auto lg:[scrollbar-width:thin]">
          <p className={LABEL}>Current scope</p>
          <div className="mt-0.5 flex items-start justify-between gap-2">
            <h2 className="min-w-0 truncate font-display text-lg font-semibold leading-tight">{scope.label}</h2>
          </div>

          {/* Leading party — integrated into the summary, not floating over the map */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg border border-border/70 bg-background/50 px-2.5 py-1.5">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Leading party</span>
            {!lead.party || agg.answered2028 === 0 ? (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: "var(--border)" }} />
                {agg.answered2028 === 0 ? "No answered survey responses" : "Unavailable"}
              </span>
            ) : lead.tie.length > 1 ? (
              <span className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {lead.tie.map((t) => (
                  <span key={t} className="flex items-center gap-1 font-semibold">
                    <span className="size-2 rounded-sm" style={{ background: partyMeta(t).color }} />
                    {partyMeta(t).short}
                  </span>
                ))}
                <span className="text-muted-foreground">tied</span>
                <span className="tabular-nums font-semibold">{fmtPct(lead.share)}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="size-2 rounded-sm" style={{ background: partyMeta(lead.party).color }} />
                <b className="font-semibold">{partyMeta(lead.party).label}</b>
                <span className="tabular-nums text-muted-foreground">{fmtPct(lead.share)}</span>
              </span>
            )}
          </div>

          {agg.answered2028 === 0 && <p className="mt-2.5 rounded-lg bg-muted/40 px-2 py-2 text-[11px] text-muted-foreground">No answered survey responses in this scope.</p>}
          {agg.answered2028 > 0 && agg.answered2028 < SMALL_SAMPLE && (
            <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10.5px] leading-relaxed text-amber-800 dark:text-amber-300">
              Low sample in this scope. Percentages are indicative; nothing is redistributed to improve coverage.
            </p>
          )}

          <div className="mt-3 space-y-2">
            {shares2028.filter((s) => s.party !== "NOTA" && (s.count > 0 || s.share !== null)).map((s) => {
              const s23 = shares2023.find((x) => x.party === s.party)?.share ?? null;
              const diff = s.count > 0 && s.share !== null && s23 !== null ? s.share - s23 : null;
              return (
                <div key={s.party}>
                  <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
                    <span className="flex items-center gap-1.5 font-medium"><span className="size-2 rounded-sm" style={{ background: partyMeta(s.party).color }} />{partyMeta(s.party).label}</span>
                    <span className="whitespace-nowrap tabular-nums"><b>{s.count === 0 ? "—" : fmtPct(s.share)}</b>
                      {diff !== null && <span className={cn("ml-1 text-[10px]", diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{fmtPp(diff, 1)}</span>}
                    </span>
                  </div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-muted/40">
                    <div className="h-full rounded" style={{ width: `${Math.max(0.5, s.share ?? 0)}%`, background: partyMeta(s.party).color }} />
                  </div>
                </div>
              );
            })}
          </div>

          {selectedAcs.length > 0 && (
            <div className="mt-3 border-t border-border pt-2.5">
              <div className="flex items-center justify-between">
                <p className={LABEL}>Selected assemblies</p>
                <button type="button" onClick={() => setSelectedAcs([])} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {selectedAcs.map((no) => {
                  const a = acByNo.get(no);
                  return (
                    <span key={no} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10.5px]">
                      {a?.name ?? no}
                      <button type="button" aria-label={`Remove ${a?.name ?? no}`} onClick={() => toggleAc(no, false)} className="text-muted-foreground hover:text-foreground"><X className="size-2.5" /></button>
                    </span>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[9.5px] text-muted-foreground">Counts are summed before shares are calculated — never an average of AC percentages.</p>
            </div>
          )}

          <p className="mt-2.5 text-[9.5px] leading-snug text-muted-foreground">2028 difference is a survey difference vs actual 2023 — not a measured swing.</p>
        </section>
      </section>

      {/* analysis */}
      <section className="mx-auto mt-8 min-h-[calc(100svh-6rem)] max-w-[1720px] px-4 pb-8 sm:px-6">
        <TelanganaAnalysis
          scope={scope}
          age={scopedAge}
          rounds={data.rounds}
          daily={data.daily}
          statewide={data.statewide}
          chart={chart}
          onChart={setChart}
          parties={parties}
          onParties={setParties}
          selectedAc={selectedAcs.length === 1 ? selectedAcs[0] : null}
          onSelectAc={(no) => toggleAc(no, false)}
          theme={theme === "light" ? "light" : "dark"}
          status={{ updating, lastRefreshed, error: refreshError, flash, onRefresh: () => load(true) }}
        />
        <div className="mt-3">
          <AboutTelangana
            totals={data.totals}
            conflictRows={data.totals.conflictRows}
            sourceEntries={data.totals.sourceEntries}
            groups={data.totals.groups}
            acs={data.totals.acs}
          />
        </div>
      </section>

      {/* hover tooltip for assemblies (map hover) */}
      {hover && hoveredAc && (
        <div
          className="pointer-events-none fixed z-50 w-56 rounded-xl border border-border bg-card/95 p-2.5 text-[11px] shadow-xl backdrop-blur"
          style={{ left: Math.min(hover.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1200) - 236), top: Math.min(hover.y + 14, (typeof window !== "undefined" ? window.innerHeight : 800) - 170) }}
        >
          <p className="font-display text-[12px] font-semibold">{hoveredAc.no}. {hoveredAc.name}</p>
          <p className="text-[10px] text-muted-foreground">{hoveredAc.group}{hoveredAc.reservation ? ` · ${hoveredAc.reservation}` : ""}</p>
          {hoveredAc.answered2028 > 0 ? (
            <div className="mt-1.5 space-y-1">
              {CONTESTED.map((p) => {
                const n = hoveredAc.a2028[p] ?? 0;
                if (!n) return null;
                const pct = (n / hoveredAc.answered2028) * 100;
                return (
                  <div key={p} className="flex items-center gap-1.5 text-[10px]">
                    <span className="size-1.5 rounded-sm" style={{ background: partyMeta(p).color }} />
                    <span className="w-12 truncate">{partyMeta(p).short}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded bg-muted/40"><span className="block h-full rounded" style={{ width: `${pct}%`, background: partyMeta(p).color }} /></span>
                    <span className="w-11 text-right tabular-nums">{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-1.5 text-[10.5px] text-muted-foreground">No answered survey responses</p>
          )}
          <p className="mt-1 text-[9px] text-muted-foreground">Click to {group ? "select this assembly" : "focus its district"}.</p>
        </div>
      )}
    </div>
  );
}
